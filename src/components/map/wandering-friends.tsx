"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useActivitySheet } from "@/components/map/activity-sheet-context";
import {
  useFriendsStatusWriter,
  type FriendStatus,
} from "@/components/map/friends-status-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { enterPlace } from "@/lib/mobile/drill";

export type POIRef = {
  label: string;
  /** Horizontal center of the POI chip (0..1 of map width). */
  centerXPct: number;
  /** Y where a friend's avatar TOP should sit when "standing at" this POI. */
  standYPct: number;
};

export type FriendDef = {
  name: string;
  avatarSrc: string;
  /** Map of POI label → behavior text shown while idling at that POI. */
  behaviors: Record<string, string>;
  /** Pool of random speech texts shown while the friend is wandering. */
  wanderings: readonly string[];
  /**
   * Pool of single-emoji mood markers for this character. Picked
   * fresh each time `speech` rotates so the avatar's mood bubble
   * mirrors the emotional swings of whatever the friend is doing.
   * Authors should keep these tonally on-brand for the character —
   * "周往" leans on cat / sport emoji, "钟辰时" on study emoji, etc.
   */
  moods: readonly string[];
  /** POI label where the friend starts. Must be a key of `behaviors`. */
  startPoi: string;
};

type Mode =
  | { kind: "idle"; untilMs: number; poi: POIRef }
  | {
      kind: "moving";
      /** Trip start point in map-fraction space. */
      ax: number;
      ay: number;
      /** Quadratic-bezier control point — perpendicular offset from A→B
       *  midpoint, sign/magnitude/along-axis all randomized per trip. */
      cx: number;
      cy: number;
      /** Cached approximate arc length (map-fraction units), used to convert
       *  linear walking speed into dProgress/dt. */
      length: number;
      /** Progress along the curve, 0..1. */
      progress: number;
    };

type Runtime = {
  def: FriendDef;
  /** Avatar center X in map-fraction space. */
  x: number;
  /** Avatar TOP Y in map-fraction space. */
  y: number;
  target: POIRef;
  mode: Mode;
  speech: string;
  /**
   * Single emoji shown in the bubble above this friend's avatar. Kept
   * in lockstep with `speech` — every place we re-pick `speech` we
   * also re-pick `mood`, so the bubble visibly "reacts" alongside
   * whatever the friend is now doing.
   */
  mood: string;
  nextSpeechChangeMs: number;
};

/**
 * Movement speed, in map-fraction units per second. At 0.04, a friend
 * walking across roughly half the map takes ~12s — slow enough to read as
 * "strolling" without making the demo feel sleepy.
 */
const WALK_SPEED = 0.04;
/**
 * Time a friend lingers at a POI after arriving. Randomized per visit so
 * multiple friends don't leave in lock-step (user spec: "5 秒以上都行").
 */
const IDLE_MIN_MS = 6_000;
const IDLE_MAX_MS = 14_000;
/** Speech-line rotation cadence while wandering. */
const SPEECH_MIN_MS = 4_000;
const SPEECH_MAX_MS = 7_000;
/**
 * Horizontal pixel gap between co-located avatars (center-to-center).
 * 30px lets two 40px avatars overlap ~10px (matches reference design) while
 * still keeping each avatar fully tappable.
 */
const CLUSTER_X_SPACING_PX = 30;
/** Vertical pixel gap between stacked speech chips of co-located friends. */
const SPEECH_STACK_SPACING_PX = 22;

const now = () => performance.now();

const randBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

function pickDifferent<T>(pool: readonly T[], exclude?: T): T {
  const filtered = exclude !== undefined ? pool.filter((p) => p !== exclude) : pool;
  const from = filtered.length > 0 ? filtered : pool;
  return from[Math.floor(Math.random() * from.length)];
}

function pickTarget(
  def: FriendDef,
  pois: readonly POIRef[],
  excludeLabel?: string,
): POIRef {
  const candidates = pois.filter(
    (p) => def.behaviors[p.label] !== undefined && p.label !== excludeLabel,
  );
  const pool = candidates.length > 0 ? candidates : pois.filter((p) => p.label !== excludeLabel);
  const safe = pool.length > 0 ? pool : pois;
  return safe[Math.floor(Math.random() * safe.length)];
}

/** Evaluate quadratic bezier at t ∈ [0..1]. */
function bezierAt(
  t: number,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

/**
 * Plan a gently-curved trip from (ax,ay) to (bx,by). Produces:
 *  - a bezier control point offset perpendicular to the line, on a random
 *    side, with random magnitude (12–32% of line length)
 *  - an asymmetric midpoint (tMid ∈ [0.35, 0.65]) so the curve doesn't
 *    feel symmetric/mirrored across trips
 *  - a polyline approximation of arc length so WALK_SPEED translates to a
 *    constant d(progress)/dt regardless of curvature
 *
 * Result: every trip looks different, and long trips still feel like a
 * "stroll" rather than a teleport.
 */
function planTrip(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { cx: number; cy: number; length: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lineDist = Math.hypot(dx, dy);
  // Unit perpendicular to A→B. Safe fallback if A≈B (shouldn't happen since
  // pickTarget excludes the current label, but guard against NaNs anyway).
  const safeDist = lineDist || 1;
  const perpX = -dy / safeDist;
  const perpY = dx / safeDist;

  const tMid = randBetween(0.35, 0.65);
  const midX = ax + dx * tMid;
  const midY = ay + dy * tMid;

  const sign = Math.random() < 0.5 ? -1 : 1;
  const curvature = randBetween(0.12, 0.32) * lineDist * sign;
  const cx = midX + perpX * curvature;
  const cy = midY + perpY * curvature;

  const SAMPLES = 12;
  let length = 0;
  let prevX = ax;
  let prevY = ay;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const { x, y } = bezierAt(t, ax, ay, cx, cy, bx, by);
    length += Math.hypot(x - prevX, y - prevY);
    prevX = x;
    prevY = y;
  }

  return { cx, cy, length };
}

/**
 * Renders a set of friend clusters (speech chip + avatar + down-arrow) that
 * slowly wander between POIs on the map. Each friend pauses for ~10s at a
 * POI, swaps to a location-appropriate line, then walks to the next POI.
 * While walking, speech text rotates through the friend's wandering pool.
 */
export function WanderingFriends({
  friends,
  pois,
}: {
  friends: readonly FriendDef[];
  pois: readonly POIRef[];
}) {
  /**
   * When a friend's action bubble is open we capture ONCE the avatar's
   * pixel position within the phone-frame overlay root. Because the bubble
   * portals into `#phone-overlay-root` (which sits above every other
   * phone-level layer — see PhoneFrame), we need coordinates in THAT
   * element's coordinate space, not in PannableMap's map-image space. The
   * pan is locked while the bubble is open, so these pixel anchors stay
   * valid for the lifetime of the open sheet.
   *
   * `active === null` means no bubble is open; while non-null the named
   * friend's runtime timers are frozen via `pauseAdjust`.
   */
  const [active, setActive] = useState<ActiveSheet | null>(null);
  const activeName = active?.friend.name ?? null;

  /**
   * Portal target is provided by the enclosing PhoneFrame via context,
   * so bubbles always land in the right frame's overlay even when
   * multiple PhoneFrames are stacked (chat modal over map).
   */
  const overlayEl = usePhoneOverlayRoot();

  const [runtime, setRuntime] = useState<Runtime[]>(() =>
    friends.map((def) => {
      const startPoi =
        pois.find((p) => p.label === def.startPoi) ?? pois[0];
      return {
        def,
        x: startPoi.centerXPct,
        y: startPoi.standYPct,
        target: pickTarget(def, pois, startPoi.label),
        mode: {
          kind: "idle" as const,
          untilMs: now() + randBetween(IDLE_MIN_MS, IDLE_MAX_MS),
          poi: startPoi,
        },
        speech: def.behaviors[startPoi.label] ?? "",
        mood: def.moods[0] ?? "🙂",
        nextSpeechChangeMs: Number.POSITIVE_INFINITY,
      };
    }),
  );

  useEffect(() => {
    /**
     * We throttle React updates to ~20fps — enough to read as smooth motion
     * for slow-walking avatars, but ~3× cheaper than firing setState every
     * animation frame. rAF still paces to the browser's refresh so the loop
     * pauses when the tab is hidden.
     */
    const MIN_STEP_MS = 50;
    let raf = 0;
    let last = now();
    let pendingSince = last;

    const tick = (t: number) => {
      if (t - pendingSince >= MIN_STEP_MS) {
        const dt = Math.min(0.2, (t - last) / 1000);
        last = t;
        pendingSince = t;
        setRuntime((prev) =>
          prev.map((r) =>
            r.def.name === activeName ? pauseAdjust(r, dt) : advance(r, dt, pois),
          ),
        );
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pois, activeName]);

  /**
   * Publish each friend's current `location · action` up to
   * `FriendsStatusContext` so the top-nav roster panel can render live
   * status. Dedup against the last published payload (via a joined key
   * string) so consumers only re-render on real state transitions,
   * not on every 50ms rAF-throttled position update.
   */
  const writeStatus = useFriendsStatusWriter();
  const lastStatusKeyRef = useRef<string>("");
  useEffect(() => {
    const snapshot = runtime.map(deriveStatus);
    const key = snapshot
      .map((s) => `${s.name}|${s.location}|${s.action}|${s.mood}`)
      .join(";");
    if (key !== lastStatusKeyRef.current) {
      lastStatusKeyRef.current = key;
      writeStatus(snapshot);
    }
  }, [runtime, writeStatus]);

  const layouts = computeCoLocationLayouts(runtime);

  /**
   * On avatar tap we measure the avatar's rect and the overlay root's
   * rect (in viewport coords) and derive anchor pixels relative to the
   * overlay. This lets the bubble be portaled into #phone-overlay-root
   * at the top of the stacking order without having to know anything
   * about PannableMap's current pan offset.
   */
  const handleAvatarClick = (
    def: FriendDef,
    currentLocation: string,
    displayLocation: string,
    avatarEl: HTMLElement,
  ) => {
    const container = overlayEl;
    if (!container) return;
    const a = avatarEl.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    setActive({
      friend: def,
      currentLocation,
      displayLocation,
      anchorLeft: a.left - c.left,
      anchorTop: a.top - c.top,
      anchorWidth: a.width,
      containerWidth: c.width,
    });
  };

  return (
    <>
      {runtime.map((r, i) => (
        <FriendCluster
          key={r.def.name}
          xPct={r.x}
          yPct={r.y}
          xOffsetPx={layouts[i].xOffsetPx}
          stackIndex={layouts[i].stackIndex}
          avatarSrc={r.def.avatarSrc}
          alt={r.def.name}
          mood={r.mood}
          onAvatarClick={(el) =>
            handleAvatarClick(
              r.def,
              r.mode.kind === "idle" ? r.mode.poi.label : r.target.label,
              r.mode.kind === "idle"
                ? r.mode.poi.label
                : `去${r.target.label}的路上`,
              el,
            )
          }
        />
      ))}

      {/*
       * Portal backdrop + bubble into the phone-frame's top-most overlay
       * layer. Three things fall out of this:
       *   1. The bubble escapes PannableMap's transform stacking context,
       *      so it renders above WorldBroadcast / BottomNav / top nav.
       *   2. The backdrop covers the ENTIRE phone frame (including top
       *      chips, bottom nav, even other avatars), so the first tap
       *      anywhere just closes — no other hot-zone fires. A second tap
       *      on an avatar opens a fresh bubble, matching the spec.
       *   3. Because pan is disabled while the sheet is open (backdrop
       *      intercepts pointerdown), the pixel anchors captured on open
       *      stay valid — no need to track PannableMap's pan offset.
       */}
      {active &&
        overlayEl &&
        createPortal(
          <>
            <div
              className="pointer-events-auto absolute inset-0"
              onPointerDown={(e) => {
                // Block pan/drag from starting; keep this as a pure close.
                e.stopPropagation();
              }}
              onClick={() => setActive(null)}
            />
            <ActionBubble active={active} onClose={() => setActive(null)} />
          </>,
          overlayEl,
        )}
    </>
  );
}

type ActiveSheet = {
  friend: FriendDef;
  /**
   * Where the friend is right now — POI label if idling, otherwise the
   * label of the POI they're walking toward. Used by "去TA这里" so the
   * free-chat we open is anchored to a real place (never "路上" which
   * isn't a scene).
   */
  currentLocation: string;
  /**
   * Human-readable status line shown under the friend's name in the
   * bubble. Matches the roster: bare POI label when idle ("后山"),
   * "去{POI}的路上" when walking — gives the sheet a sense of place.
   */
  displayLocation: string;
  /** Avatar left edge, in pixels relative to #phone-overlay-root. */
  anchorLeft: number;
  /** Avatar top edge, in pixels relative to #phone-overlay-root. */
  anchorTop: number;
  /** Avatar rendered width in pixels. */
  anchorWidth: number;
  /** Phone-frame (overlay root) rendered width in pixels. */
  containerWidth: number;
};

/**
 * While a friend has their action bubble open, their timers should pause —
 * otherwise a long-open bubble (say 20s) would cause them to leave the POI
 * the instant the bubble closes. We shift all future-ms timestamps forward
 * by `dt`, and leave `progress` / position untouched so mid-walk pauses
 * also freeze in place.
 */
/**
 * Project a runtime row into the FriendStatus shape the roster panel
 * consumes. Location reads the current POI label when idle, or
 * `"去{destination}的路上"` while walking — the destination POI gives
 * the status a sense of direction ("去图书馆的路上") instead of the
 * bare "路上". Action reuses the current speech line so the panel
 * naturally shows "where" AND "what" in one row.
 */
function deriveStatus(r: Runtime): FriendStatus {
  const currentPoiLabel =
    r.mode.kind === "idle" ? r.mode.poi.label : r.target.label;
  return {
    name: r.def.name,
    avatarSrc: r.def.avatarSrc,
    location:
      r.mode.kind === "idle" ? currentPoiLabel : `去${r.target.label}的路上`,
    /**
     * Prefer the destination POI when walking so that "去TA这里" opens
     * a real place-based chat instead of a literal "路上" fallback.
     * When idle it's just the current POI.
     */
    chatLocation: currentPoiLabel,
    action: r.speech,
    mood: r.mood,
  };
}

function pauseAdjust(r: Runtime, dt: number): Runtime {
  const deltaMs = dt * 1000;
  const shiftedSpeech =
    r.nextSpeechChangeMs === Number.POSITIVE_INFINITY
      ? r.nextSpeechChangeMs
      : r.nextSpeechChangeMs + deltaMs;
  if (r.mode.kind === "idle") {
    return {
      ...r,
      mode: { ...r.mode, untilMs: r.mode.untilMs + deltaMs },
      nextSpeechChangeMs: shiftedSpeech,
    };
  }
  return { ...r, nextSpeechChangeMs: shiftedSpeech };
}

/**
 * When multiple friends are idling at the same POI, lay them out
 * side-by-side (with a small horizontal offset per avatar) and stack
 * their speech chips vertically so that:
 *
 *   1. Each avatar remains a distinct tap target (no occlusion).
 *   2. Every speech chip stays fully visible (no truncation from
 *      overlapping chips).
 *
 * Moving friends keep the default (centered, stackIndex 0) — if they
 * pass near each other in transit, overlap is brief enough that the
 * extra layout logic isn't worth the visual churn.
 *
 * Members are ordered by `def.name` (localeCompare) so the left/right
 * assignment stays stable across re-renders — no flickering when one
 * friend leaves the group.
 */
function computeCoLocationLayouts(
  runtime: readonly Runtime[],
): { xOffsetPx: number; stackIndex: number }[] {
  const layouts = runtime.map(() => ({ xOffsetPx: 0, stackIndex: 0 }));

  const idleByPoi = new Map<string, number[]>();
  runtime.forEach((r, i) => {
    if (r.mode.kind !== "idle") return;
    const list = idleByPoi.get(r.mode.poi.label);
    if (list) list.push(i);
    else idleByPoi.set(r.mode.poi.label, [i]);
  });

  for (const indexes of idleByPoi.values()) {
    if (indexes.length < 2) continue;
    const sorted = [...indexes].sort((a, b) =>
      runtime[a].def.name.localeCompare(runtime[b].def.name, "zh"),
    );
    const n = sorted.length;
    sorted.forEach((idx, pos) => {
      layouts[idx] = {
        xOffsetPx: (pos - (n - 1) / 2) * CLUSTER_X_SPACING_PX,
        stackIndex: pos,
      };
    });
  }

  return layouts;
}

function advance(r: Runtime, dt: number, pois: readonly POIRef[]): Runtime {
  const t = now();

  if (r.mode.kind === "idle") {
    if (t < r.mode.untilMs) return r;
    // Time to leave: pick a target, plan a curved trip, and switch to moving.
    const next = pickTarget(r.def, pois, r.mode.poi.label);
    const trip = planTrip(r.x, r.y, next.centerXPct, next.standYPct);
    return {
      ...r,
      target: next,
      mode: {
        kind: "moving",
        ax: r.x,
        ay: r.y,
        cx: trip.cx,
        cy: trip.cy,
        length: trip.length,
        progress: 0,
      },
      speech: pickDifferent(r.def.wanderings, r.speech),
      mood: pickDifferent(r.def.moods, r.mood),
      nextSpeechChangeMs: t + randBetween(SPEECH_MIN_MS, SPEECH_MAX_MS),
    };
  }

  // mode.kind === "moving" — advance along the cached bezier.
  const bx = r.target.centerXPct;
  const by = r.target.standYPct;
  const dProgress =
    r.mode.length > 0 ? (WALK_SPEED * dt) / r.mode.length : 1;
  const nextProgress = r.mode.progress + dProgress;

  if (nextProgress >= 1) {
    return {
      ...r,
      x: bx,
      y: by,
      mode: {
        kind: "idle",
        untilMs: t + randBetween(IDLE_MIN_MS, IDLE_MAX_MS),
        poi: r.target,
      },
      speech: r.def.behaviors[r.target.label] ?? r.speech,
      mood: pickDifferent(r.def.moods, r.mood),
      nextSpeechChangeMs: Number.POSITIVE_INFINITY,
    };
  }

  const { x, y } = bezierAt(
    nextProgress,
    r.mode.ax,
    r.mode.ay,
    r.mode.cx,
    r.mode.cy,
    bx,
    by,
  );

  let speech = r.speech;
  let mood = r.mood;
  let nextChange = r.nextSpeechChangeMs;
  if (t >= r.nextSpeechChangeMs) {
    speech = pickDifferent(r.def.wanderings, r.speech);
    mood = pickDifferent(r.def.moods, r.mood);
    nextChange = t + randBetween(SPEECH_MIN_MS, SPEECH_MAX_MS);
  }

  return {
    ...r,
    x,
    y,
    mode: { ...r.mode, progress: nextProgress },
    speech,
    mood,
    nextSpeechChangeMs: nextChange,
  };
}

/**
 * Visual cluster: speech chip → avatar → down-arrow. Positioning anchor
 * is the AVATAR's center (achieved via `translateX(-50%)`).
 *
 * `xOffsetPx` nudges the whole cluster horizontally so two co-located
 * friends sit side-by-side instead of stacking on the same pixel.
 * `stackIndex` lifts the speech chip by a multiple of SPEECH_STACK_SPACING
 * so chips don't overlap each other. The avatar itself is a `<button>` so
 * each one stays independently tappable even when avatars slightly overlap.
 *
 * The cluster wrapper is `pointer-events-none` so drags still flow through
 * to PannableMap; only the avatar button reinstates pointer events.
 */
function FriendCluster({
  xPct,
  yPct,
  xOffsetPx,
  stackIndex,
  avatarSrc,
  alt,
  mood,
  onAvatarClick,
}: {
  xPct: number;
  yPct: number;
  xOffsetPx: number;
  stackIndex: number;
  avatarSrc: string;
  alt: string;
  /** Single-emoji mood marker shown in the bubble above the avatar. */
  mood: string;
  onAvatarClick: (avatarEl: HTMLElement) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute transition-transform duration-200 ease-out"
      style={{
        left: `${xPct * 100}%`,
        top: `${yPct * 100}%`,
        transform: `translateX(calc(-50% + ${xOffsetPx}px))`,
        // Stacked friends: higher stackIndex sits on top so the
        // "lifted" chip wins z-order over any sibling's background.
        zIndex: 10 + stackIndex,
      }}
    >
      {/*
       * Mood bubble — a circular badge above the avatar containing one
       * emoji that represents the friend's *current emotional state*.
       * Replaces the previous text speech chip (which used to read
       * "{name}:{speech}") so the map stays uncluttered: the avatar is
       * the identity, the bubble is the feeling. Width is fixed-circle
       * — emojis render in a 1ch box so co-located friends don't have
       * variable-width chips colliding.
       */}
      <div
        className="absolute left-1/2 flex size-[26px] -translate-x-1/2 items-center justify-center rounded-full bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06] backdrop-blur-[2px] transition-[bottom] duration-200 ease-out"
        style={{
          bottom: `calc(100% + 6px + ${stackIndex * SPEECH_STACK_SPACING_PX}px)`,
        }}
        aria-hidden="true"
      >
        <span className="select-none text-[15px] leading-none">{mood}</span>
      </div>

      {/* Avatar — each is its own button, so co-located friends remain
          independently tappable even with a few px of visual overlap. */}
      <button
        type="button"
        aria-label={alt}
        onClick={(e) => onAvatarClick(e.currentTarget)}
        /**
         * Stop pointerdown from reaching PannableMap. PannableMap calls
         * setPointerCapture on its container on pointerdown, which steals
         * subsequent pointermove/pointerup from the button — that causes
         * real taps to never fire a click. Intercepting here lets taps
         * on the avatar reliably open the bubble, while the surrounding
         * map area still pans normally.
         */
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto relative block size-[40px] cursor-pointer overflow-hidden rounded-[20px] border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-transform active:scale-95"
      >
        <Image
          src={avatarSrc}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          draggable={false}
        />
      </button>

      {/* Down arrow points at the POI label below (which stays fixed). */}
      <Image
        src="/figma/map/speech-arrow.svg"
        alt=""
        width={12}
        height={8}
        className="absolute left-1/2 top-[calc(100%+3px)] -translate-x-1/2"
      />
    </div>
  );
}

/** Approximate rendered width of the action bubble, used for side-flipping
 *  and keeping the sheet on-screen. Must match the card's actual width —
 *  update both if the card layout changes. */
const BUBBLE_WIDTH_PX = 150;
/** Gap between avatar edge and the bubble's nearest edge. */
const BUBBLE_AVATAR_GAP_PX = 14;

/**
 * Floating action sheet anchored to a friend's avatar. Positioned in the
 * phone-frame overlay root's pixel space (see WanderingFriends) so it
 * lives above every other phone-level layer — WorldBroadcast, top nav,
 * bottom nav. Placement auto-flips horizontally based on where the
 * avatar actually sits on screen so the sheet never runs off-edge.
 *
 * Entry animation is a pure fade at the final position (no translate /
 * scale) per spec — the sheet appears "at place" rather than sliding in.
 */
function ActionBubble({
  active,
  onClose,
}: {
  active: ActiveSheet;
  onClose: () => void;
}) {
  const {
    friend,
    currentLocation,
    displayLocation,
    anchorLeft,
    anchorTop,
    anchorWidth,
    containerWidth,
  } = active;
  const { open: openActivity } = useActivitySheet();
  const anchorCenterX = anchorLeft + anchorWidth / 2;
  // Flip to the left side of the avatar once its center crosses past ~55%
  // of the phone width; otherwise place on the right. Keeps the sheet
  // inside the visible phone regardless of map pan.
  const placeLeft = anchorCenterX > containerWidth * 0.55;
  const left = placeLeft
    ? anchorLeft - BUBBLE_WIDTH_PX - BUBBLE_AVATAR_GAP_PX
    : anchorLeft + anchorWidth + BUBBLE_AVATAR_GAP_PX;
  // Vertically align bubble's top with avatar's top (nudged up 8px for
  // breathing room), clamped so it never sits above the phone frame edge.
  const top = Math.max(8, anchorTop - 8);

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      role="dialog"
      aria-label={`${friend.name} 的动作菜单`}
      className="pointer-events-auto absolute flex w-[150px] flex-col gap-[2px] rounded-[12px] bg-white py-[8px] pl-[6px] pr-[12px] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5 animate-in fade-in duration-150"
      style={{ left, top }}
      onClick={stop}
      onPointerDown={stop}
    >
      <button
        type="button"
        className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-left transition-colors hover:bg-black/5 active:bg-black/10"
      >
        <div className="relative size-[28px] shrink-0 overflow-hidden rounded-full">
          <Image
            src={friend.avatarSrc}
            alt=""
            fill
            sizes="28px"
            className="object-cover"
            draggable={false}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="truncate text-[14px] font-medium leading-tight text-black">
            {friend.name}
          </span>
          <span className="truncate text-[11px] leading-tight text-black/55">
            📌 {displayLocation}
          </span>
        </div>
        <ChevronRightIcon className="size-[14px] shrink-0 text-black/70" />
      </button>

      <div className="mx-[8px] h-px bg-black/[0.06]" />

      <ActionRow
        icon={<CalendarIcon />}
        label="TA的动态"
        onClick={() => {
          onClose();
          openActivity(friend.name);
        }}
      />
      <ActionRow
        icon={<NavArrowIcon />}
        label="去TA这里"
        onClick={(e) => {
          onClose();
          enterPlace({ location: currentLocation, mode: "free" }, e.currentTarget);
        }}
      />
      <ActionRow icon={<ChatBubbleIcon />} label="单聊" />
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[8px] rounded-[8px] px-[8px] py-[6px] text-left transition-colors hover:bg-black/5 active:bg-black/10"
    >
      <span className="flex size-[24px] shrink-0 items-center justify-center text-black">
        {icon}
      </span>
      <span className="whitespace-nowrap text-[14px] font-medium text-black">
        {label}
      </span>
    </button>
  );
}

/* Inline SVG icons — authored to visually match the Figma card (stroke-only,
 * uniform 1.6 stroke weight, currentColor so hover states work). */

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[20px]"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

function NavArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[20px]"
    >
      <path d="M3.5 11l17.5-7.5L13.5 21l-2-8z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[20px]"
    >
      <path d="M20.5 12.2A8 8 0 019 19.7l-5.5 1.3L5 15.7a8 8 0 1115.5-3.5z" />
      <circle cx="8.5" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
