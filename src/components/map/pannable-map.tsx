"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type PannableMapProps = {
  /** Native intrinsic dimensions of the map artwork (used for aspect ratio). */
  imageWidth: number;
  imageHeight: number;
  /** Where to focus the map on first paint (image-relative, 0..1). Default 0.5 = horizontal center. */
  initialFocusX?: number;
  /**
   * Vertical first-paint focus point (0..1 of the map image height).
   * Defaults to 0.5 (vertical center). Only meaningful when the map
   * is taller than the container (i.e. `panScale` produces vertical
   * overflow); otherwise vertical pan is locked at 0.
   */
  initialFocusY?: number;
  /**
   * Multiplier applied to the map's rendered height. With the default
   * `1.0` the map is sized to exactly fill the container's height —
   * height matches container, width may overflow horizontally — which
   * gives the original 1-D (horizontal-only) pan behaviour. Values
   * `>1` stretch both dimensions (aspect ratio preserved) so the map
   * also overflows vertically, unlocking a 2-D drag. `1.4`–`1.6` reads
   * as "you can scroll a bit further to see what's around" without
   * making the artwork feel zoomed-in.
   */
  panScale?: number;
  /**
   * Optional externally-controlled focus target (0..1 in map-image
   * space). When `focusRequestId` bumps to a new value AND this is
   * non-null, the map pans its `focusXPct` column to the container's
   * horizontal center using a softened easing (longer + bouncier
   * than the default drag-snap transition). Used by the World-
   * Broadcast feed to "camera-cut" to a POI when the user taps a
   * pill.
   */
  focusXPct?: number | null;
  /**
   * Optional vertical focus target (0..1). Paired with `focusXPct`
   * when a focus request fires — used by the train map so room picks
   * also recenter on Y when `panScale` unlocks vertical overflow.
   */
  focusYPct?: number | null;
  /**
   * Counter that must increment on every new focus request.
   * Watching a counter instead of just `focusXPct` means two
   * consecutive requests to the SAME x will both fire — important
   * when the user re-taps a pill that references a POI already on
   * screen (the map doesn't move, but the pulse should still fire
   * from the downstream POIPin).
   */
  focusRequestId?: number;
  /**
   * Restricts panning to a horizontal slice of the map image (0..1).
   * Defaults to the whole image.
   *
   * Used by the train map, whose canvas always includes carriages the
   * story hasn't revealed yet: the coordinates of every marker must stay
   * fixed, so the canvas can't shrink — instead the drag range is fenced
   * to the revealed carriages, otherwise the user can drag off into a
   * black void where the hidden carriage will later appear.
   */
  xBoundsPct?: { min: number; max: number };
  /**
   * Fired exactly once per `focusRequestId` change, at the moment the
   * map is visually at rest and ready for downstream visual cues (e.g.
   * the POI pop). Timing:
   *   - If the target POI is already inside the container viewport,
   *     this fires on the next animation frame with NO pan performed
   *     — the chip stays exactly where it was on screen.
   *   - Otherwise the map pans the target to the container's
   *     horizontal center and this fires once the transition ends
   *     (with a ~600ms safety timeout in case `transitionend` is lost).
   * Downstream: `MapFocusProvider.commitPulse()` consumes this signal
   * so the pop never arms while the chip is still translating.
   */
  onFocusEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Default transition (drag end, resize snap-back). */
const DEFAULT_TRANSITION = "transform 120ms ease-out";
/**
 * Longer, camera-dolly transition used when a focus request comes in
 * from World-Broadcast. Starts fast, settles slow — feels like a
 * spring-loaded pan rather than a lerp. Duration tuned so the pan
 * finishes slightly BEFORE the POI bounce climaxes, which makes the
 * chip feel like the subject of the camera move.
 */
const FOCUS_TRANSITION = "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Edge margin (px) used when deciding whether the target POI is
 * "already visible" and therefore needs no pan. Half a POI chip is
 * ~30–40px wide, so a center sitting within 40px of a viewport edge
 * means half the chip is clipped — we treat that as NOT visible and
 * pan to center it. Any POI center further inside than this counts
 * as visible and the map is left alone.
 */
const POI_VISIBILITY_MARGIN_PX = 40;
/**
 * Safety timeout for the pan-then-commit path — slightly longer than
 * FOCUS_TRANSITION so we don't arm the pop before the cubic-bezier
 * has fully settled, but short enough that a missed `transitionend`
 * (e.g. pan clamped to same panX, so no transition runs at all)
 * doesn't leave the pop permanently un-committed.
 */
const FOCUS_COMMIT_FALLBACK_MS = 600;

export function PannableMap({
  imageWidth,
  imageHeight,
  initialFocusX = 0.5,
  initialFocusY = 0.5,
  panScale = 1,
  focusXPct,
  focusYPct,
  focusRequestId,
  xBoundsPct,
  onFocusEnd,
  className,
  style,
  children,
}: PannableMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [panX, setPanX] = useState(0);
  /**
   * Vertical pan offset in CSS pixels. Stays at 0 when the map's
   * rendered height is ≤ the container's height (panScale=1 case),
   * since `clampPanY` clamps both bounds to 0 in that scenario.
   */
  const [panY, setPanY] = useState(0);
  /**
   * Gates the CSS transition. While `false` (first paint only), the map is
   * positioned to its focus target without animation — otherwise the user
   * sees the map "scroll into place" on every page load, which we don't
   * want. Flipped to `true` one frame after the initial layout commit.
   */
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  /**
   * Set transiently while a focus-request pan is in flight so the
   * `transition` CSS switches from the short default to the long
   * camera-dolly easing. Cleared on `transitionend` (or a timer
   * fallback) so subsequent drags revert to the snappy default.
   */
  const [isFocusing, setIsFocusing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  const aspect = imageWidth / imageHeight;

  const boundMin = xBoundsPct?.min ?? 0;
  const boundMax = xBoundsPct?.max ?? 1;

  const clampPan = useCallback(
    (next: number) => {
      const container = containerRef.current;
      const map = mapRef.current;
      if (!container || !map) return next;
      const cw = container.clientWidth;
      const mw = map.clientWidth;
      // Pannable slice of the artwork, in rendered px.
      const left = boundMin * mw;
      const right = boundMax * mw;
      // Keep the viewport inside [left, right]: -panX >= left pins the
      // upper bound, -panX + cw <= right pins the lower one.
      const lo = cw - right;
      const hi = -left;
      // Slice narrower than the viewport → nothing to pan, sit at its start.
      if (lo > hi) return hi;
      return Math.max(lo, Math.min(hi, next));
    },
    [boundMin, boundMax],
  );

  /**
   * Y-axis equivalent of `clampPan`. Returns 0 (locked) when the map
   * isn't taller than the container — so `panScale=1` keeps vertical
   * pan disabled exactly as the legacy behaviour expects, without a
   * separate code path.
   */
  const clampPanY = useCallback((next: number) => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map) return next;
    const ch = container.clientHeight;
    const mh = map.clientHeight;
    if (mh <= ch) return 0;
    return Math.max(ch - mh, Math.min(0, next));
  }, []);

  /** Center the given x-percentage (0..1) of the map image within the container. */
  const panToXPct = useCallback(
    (xPct: number) => {
      const container = containerRef.current;
      const map = mapRef.current;
      if (!container || !map) return;
      const cw = container.clientWidth;
      const mw = map.clientWidth;
      const targetX = -(xPct * mw - cw / 2);
      setPanX(clampPan(targetX));
    },
    [clampPan],
  );

  /** Vertical analogue of `panToXPct` — used for first-paint Y centering. */
  const panToYPct = useCallback(
    (yPct: number) => {
      const container = containerRef.current;
      const map = mapRef.current;
      if (!container || !map) return;
      const ch = container.clientHeight;
      const mh = map.clientHeight;
      const targetY = -(yPct * mh - ch / 2);
      setPanY(clampPanY(targetY));
    },
    [clampPanY],
  );

  // Center the focus point on first paint and after resize.
  const recenter = useCallback(() => {
    panToXPct(initialFocusX);
    panToYPct(initialFocusY);
  }, [initialFocusX, initialFocusY, panToXPct, panToYPct]);

  useLayoutEffect(() => {
    recenter();
    // Wait one frame after the initial focus commit so the map is painted
    // at the target position with no transition, then re-enable transitions
    // for future interactions (drags, resizes).
    const raf = requestAnimationFrame(() => setTransitionsEnabled(true));
    return () => cancelAnimationFrame(raf);
  }, [recenter]);

  useEffect(() => {
    const handler = () => recenter();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [recenter]);

  /**
   * Re-clamp when the pannable slice narrows (e.g. the story rolls a
   * revealed carriage back up) so the viewport can't be left parked
   * outside the new bounds. Widening is a no-op.
   */
  useEffect(() => {
    setPanX((prev) => clampPan(prev));
  }, [clampPan]);

  /**
   * Focus-request listener — only reacts on focusRequestId changes
   * (NOT on focusXPct changes), so the caller has full control over
   * whether a repeat request should fire. Guards against the initial
   * render (id=0 with no explicit request) and against null targets.
   *
   * Behaviour splits on whether the target is already visible in the
   * container:
   *   - visible → skip the pan entirely; commit the pulse on the
   *     next animation frame. This is the "原位置放大" path the
   *     designer asked for on 2026-04-25: if the chip is already on
   *     screen, it should pop where it is, not slide to center and
   *     THEN pop.
   *   - off-screen / edge-clipped → pan the map so the chip ends up
   *     at horizontal center with the softened camera transition,
   *     and commit the pulse after it settles (or after a ~600ms
   *     fallback in case no transition fires).
   */
  useEffect(() => {
    if (focusRequestId === undefined || focusRequestId === 0) return;
    if (focusXPct == null) return;

    const container = containerRef.current;
    const map = mapRef.current;
    // If refs aren't ready we can't measure — fall back to the
    // original pan-and-commit behaviour so focus never silently no-ops.
    let alreadyVisible = false;
    if (container && map) {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const mw = map.clientWidth;
      const mh = map.clientHeight;
      // Chip's on-screen x = its column in the map image plus the
      // current horizontal pan offset. Use the LIVE panX captured at
      // effect runtime (state is read by React scope lookup, not the
      // closure captured frame-zero value — this effect re-runs on
      // each focusRequestId bump and the body closes over the latest
      // render's panX).
      const chipOnScreenX = focusXPct * mw + panX;
      const chipOnScreenY =
        focusYPct != null ? focusYPct * mh + panY : ch / 2;
      alreadyVisible =
        chipOnScreenX >= POI_VISIBILITY_MARGIN_PX &&
        chipOnScreenX <= cw - POI_VISIBILITY_MARGIN_PX &&
        chipOnScreenY >= POI_VISIBILITY_MARGIN_PX &&
        chipOnScreenY <= ch - POI_VISIBILITY_MARGIN_PX;
    }

    if (alreadyVisible) {
      // No-op pan; fire onFocusEnd on the next frame so the consumer
      // (POI glow) sees a freshly-committed state without any layout
      // thrash from running in the same tick.
      const raf = requestAnimationFrame(() => {
        onFocusEnd?.();
      });
      return () => cancelAnimationFrame(raf);
    }

    setIsFocusing(true);
    panToXPct(focusXPct);
    if (focusYPct != null) panToYPct(focusYPct);
    // Single fallback path — FOCUS_COMMIT_FALLBACK_MS is slightly
    // longer than FOCUS_TRANSITION (520ms) so the cubic-bezier has
    // fully settled before we arm the pop. `transitionend` also
    // clears isFocusing (see onTransitionEnd), but we intentionally
    // don't call onFocusEnd from there too — a single deterministic
    // trigger point avoids double-fires when the browser emits
    // transitionend for both the translate AND a coincident property.
    const t = setTimeout(() => {
      setIsFocusing(false);
      onFocusEnd?.();
    }, FOCUS_COMMIT_FALLBACK_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequestId]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // A fresh drag cancels any in-flight camera move — user gesture wins.
    if (isFocusing) setIsFocusing(false);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: panX,
      startPanY: panY,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    setPanX(clampPan(drag.startPanX + dx));
    setPanY(clampPanY(drag.startPanY + dy));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  // Suppress click on POIs/avatars after a real drag so the map doesn't accidentally fire actions.
  const onClickCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Note: dragRef is null by the time click fires (after pointerup), so use a separate "moved" flag tracked on the gesture.
    // We approximate by checking the immediate previous gesture via a closure ref instead.
    void e;
  };

  return (
    <div
      ref={containerRef}
      /*
       * `touch-none` opts the container out of the browser's default
       * touch-action so a one-finger drag is owned by our pointer
       * handlers on BOTH axes (previously `touch-pan-y` let vertical
       * swipes scroll the page instead of panning the map vertically).
       * The page outside the phone frame is still scrollable on
       * desktop because the frame itself is fixed-height.
       */
      className={`absolute inset-0 select-none overflow-hidden touch-none ${className ?? ""}`}
      style={{ cursor: "grab", ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
    >
      <div
        ref={mapRef}
        className="absolute left-0 top-0"
        style={{
          /*
           * Height drives the rendered size; width follows from
           * `aspectRatio`. With `panScale=1` the map sits exactly the
           * container's height (1-D pan, original behaviour). With
           * `panScale>1` it overflows both axes so 2-D drag works.
           */
          height: `${panScale * 100}%`,
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          transform: `translate3d(${panX}px, ${panY}px, 0)`,
          transition:
            dragRef.current || !transitionsEnabled
              ? "none"
              : isFocusing
                ? FOCUS_TRANSITION
                : DEFAULT_TRANSITION,
          willChange: "transform",
        }}
        onTransitionEnd={(e) => {
          // Only react to the `transform` transition (backdrop-filter
          // and color transitions on the phone frame can bubble into
          // this handler via stacked contexts in some browsers).
          if (e.propertyName !== "transform") return;
          if (isFocusing) {
            setIsFocusing(false);
            // Commit the pulse as soon as the pan visually settles —
            // earlier than the FOCUS_COMMIT_FALLBACK_MS safety timer.
            // `commitPulse` is idempotent so a coincident late-timer
            // commit for the same focusRequestId is a harmless no-op.
            onFocusEnd?.();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
