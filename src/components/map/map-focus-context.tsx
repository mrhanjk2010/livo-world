"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Request-counter + pulse-label bus shared between the World-Broadcast
 * feed, the PannableMap camera, and the individual POI chips.
 *
 * Lifecycle of a single "focus-on-location" tap:
 *   1. WorldBroadcast pill calls `focusOn(label)`.
 *   2. Provider looks up the POI's x-percentage on the map image,
 *      bumps `focusRequestId`, stashes the new target, and parks the
 *      label in `pendingLabelRef` awaiting a commit. No pulse state
 *      changes yet.
 *   3. PannableMap effect sees `focusRequestId` change →
 *        a. If the target POI is ALREADY inside the viewport the
 *           map doesn't pan at all (origin-preserving "原位置放大"
 *           path — the chip must not slide around).
 *        b. Otherwise it pans its inner map div horizontally with a
 *           softened transition so the move feels like a deliberate
 *           camera cut.
 *   4. PannableMap calls back `onFocusEnd` exactly once — on the
 *      next frame in case (a), or when the pan settles in case (b).
 *      MapScreen wires `onFocusEnd={commitPulse}` so the pop is
 *      always triggered on a stationary chip.
 *   5. `commitPulse` sets `pulsingLabel` + bumps `pulseToken`.
 *      POIPin watches both and restarts its pop keyframe via a
 *      direct ref-driven animation (so two taps on the same pin
 *      always re-trigger the pulse, even while already pulsing).
 *   6. A ~PULSE_MS timer then clears `pulsingLabel` back to null.
 *
 * The context intentionally decouples pan target (focusXPct) from
 * pulse target (pulsingLabel) so a future "pan without pulse" or
 * "pulse without pan" caller can use either independently.
 */
type MapFocusContextValue = {
  /** Pan the map (and pulse that POI) to the label's x-coordinate. No-op for unknown labels. */
  focusOn: (label: string) => void;
  /**
   * Called by PannableMap once the map is visually at rest for the
   * most recent `focusRequestId`. Arms the pop on the pending
   * label. Safe to call multiple times — only the first call per
   * focusOn commits, subsequent ones are idempotent no-ops.
   */
  commitPulse: () => void;
  /** Map-image-space x percentage (0..1) of the most recent focus target. */
  focusXPct: number | null;
  /**
   * Monotonically-increasing counter. Consumers watch this via
   * `useEffect([focusRequestId])` to trigger their own side effects
   * — each focusOn call bumps this exactly once, even if focusXPct
   * repeats (re-tapping the same POI still re-fires).
   */
  focusRequestId: number;
  /** The POI label to visually pulse, or null when no pulse is active. */
  pulsingLabel: string | null;
  /**
   * Companion counter to pulsingLabel. Even if a second tap picks
   * the SAME label as the current pulse (so `pulsingLabel` doesn't
   * appear to change), this still bumps — POIPin uses it as a
   * dependency to restart its one-shot animation.
   */
  pulseToken: number;
};

const MapFocusContext = createContext<MapFocusContextValue | null>(null);

/** How long a pulse stays "on" before auto-clearing. Matches the
 *  CSS keyframe `livo-poi-pop` duration plus a tiny buffer. */
const PULSE_MS = 620;

export function MapFocusProvider({
  children,
  /**
   * Label → map-image-space x percentage (0..1). Typically derived
   * from the same POI registry the PannableMap renders, so a
   * `focusOn(label)` lookup resolves to the exact chip position.
   */
  poiXPct,
}: {
  children: ReactNode;
  poiXPct: Readonly<Record<string, number>>;
}) {
  const [focusXPct, setFocusXPct] = useState<number | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [pulsingLabel, setPulsingLabel] = useState<string | null>(null);
  const [pulseToken, setPulseToken] = useState(0);
  /**
   * Label parked by `focusOn` awaiting a `commitPulse` callback from
   * PannableMap (once it knows the chip is at rest). Using a ref —
   * not state — because flipping it doesn't need to cause a re-render
   * and we want `commitPulse` identity to stay stable across focusOn
   * calls so PannableMap's effect deps are happy.
   */
  const pendingLabelRef = useRef<string | null>(null);
  /**
   * Id of the focusRequest that armed the currently-pending label.
   * Used by `commitPulse` to ignore stale callbacks — e.g. if two
   * focusOn taps race, the earlier pan's late onFocusEnd must not
   * mis-arm a pulse on the newer target.
   */
  const pendingRequestIdRef = useRef<number>(0);
  /** Fires PULSE_MS after the pulse turns on — clears the label. */
  const pulseClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusOn = useCallback(
    (label: string) => {
      const xPct = poiXPct[label];
      if (xPct === undefined) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[MapFocus] unknown POI label: ${label}`);
        }
        return;
      }
      // Kick off the pan (or no-op pan for an already-visible chip)
      // and park the label for PannableMap to commit via onFocusEnd.
      setFocusXPct(xPct);
      setFocusRequestId((n) => {
        const next = n + 1;
        pendingRequestIdRef.current = next;
        return next;
      });
      pendingLabelRef.current = label;
      // Any in-flight pulse from a prior tap is fully reset so the
      // new chip doesn't inherit a stale clear timer.
      if (pulseClearTimerRef.current) {
        clearTimeout(pulseClearTimerRef.current);
        pulseClearTimerRef.current = null;
      }
      setPulsingLabel(null);
    },
    [poiXPct],
  );

  const commitPulse = useCallback(() => {
    const label = pendingLabelRef.current;
    if (!label) return;
    // Defensive: ignore commits from a stale pan whose label has
    // since been overridden by a newer focusOn. pendingRequestIdRef
    // always reflects the latest focusOn's id.
    pendingLabelRef.current = null;
    setPulsingLabel(label);
    setPulseToken((n) => n + 1);
    if (pulseClearTimerRef.current) clearTimeout(pulseClearTimerRef.current);
    pulseClearTimerRef.current = setTimeout(() => {
      setPulsingLabel(null);
      pulseClearTimerRef.current = null;
    }, PULSE_MS);
  }, []);

  // Belt-and-braces: clear any pending clear-timer on unmount so a
  // late scheduler can't setState on a torn-down provider.
  useEffect(() => {
    return () => {
      if (pulseClearTimerRef.current) clearTimeout(pulseClearTimerRef.current);
    };
  }, []);

  const value = useMemo<MapFocusContextValue>(
    () => ({
      focusOn,
      commitPulse,
      focusXPct,
      focusRequestId,
      pulsingLabel,
      pulseToken,
    }),
    [
      focusOn,
      commitPulse,
      focusXPct,
      focusRequestId,
      pulsingLabel,
      pulseToken,
    ],
  );

  return (
    <MapFocusContext.Provider value={value}>{children}</MapFocusContext.Provider>
  );
}

export function useMapFocus(): MapFocusContextValue {
  const ctx = useContext(MapFocusContext);
  if (!ctx) {
    throw new Error("useMapFocus() requires <MapFocusProvider> in the tree");
  }
  return ctx;
}

/**
 * Safe variant for components that might render outside the provider
 * (e.g. POIPin is reused by /stories demo pages). Returns null when
 * no provider is present, so the consumer can no-op cleanly.
 */
export function useMapFocusOptional(): MapFocusContextValue | null {
  return useContext(MapFocusContext);
}
