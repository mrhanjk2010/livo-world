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
 * Controls the shared 日常事件 state on the map — both the half-sheet
 * UI and the set of POIs that currently have a live event badge.
 *
 * Lifecycle (demo-scoped):
 *   1. On first client mount, the provider randomly picks a subset of
 *      the POI list to "have" an event. SSR renders with an empty set
 *      so the server markup matches (no hydration drift); the random
 *      draw happens in `useEffect` and badges fade in right after.
 *   2. Tapping a pulsing POI (or its heart badge) opens the sheet via
 *      `open(label)`. The set is NOT mutated here — backing out of the
 *      sheet should leave the badge intact.
 *   3. Hitting "进入事件" calls `consume(label)`, removing that POI
 *      from the active set and navigating to the event chat. The
 *      badge will not reappear for that location until the page is
 *      refreshed — at which point step 1 runs again with a fresh draw.
 *
 * There are intentionally no timers — badges don't auto-expire. This
 * matches the demo spec: “去掉20秒自动消失逻辑 · 进入事件后消失 ·
 * 刷新页面后重新随机”.
 */
type Ctx = {
  /** Location label of the event currently shown in the sheet, or null. */
  location: string | null;
  /** True if this POI has a live event badge right now. */
  has: (location: string) => boolean;
  /** Open the half-sheet for a location (does not mutate the active set). */
  open: (location: string) => void;
  close: () => void;
  /**
   * Remove a location from the active set — called after the user
   * commits to entering the event via the sheet's CTA. No-op if the
   * location wasn't active.
   */
  consume: (location: string) => void;
};

const EventSheetContext = createContext<Ctx | null>(null);

/**
 * Probability each POI independently rolls an event on initial mount.
 * 0.5 gives a natural spread of 0–7 out of 7 POIs on any given
 * refresh, usually 3–4. Tuned to keep the demo visually lively without
 * plastering every pin with a heart.
 */
const EVENT_PROBABILITY = 0.5;

export function EventSheetProvider({
  children,
  locations,
}: {
  children: ReactNode;
  /**
   * All POI labels that can host an event. Usually derived from the
   * same POI list that renders the pins (see `map-screen.tsx`). The
   * provider reads this on mount and picks a random subset.
   */
  locations: readonly string[];
}) {
  const [sheetLocation, setSheetLocation] = useState<string | null>(null);
  // Empty on SSR + first client render to keep hydration stable; the
  // `useEffect` below seeds it after mount.
  const [activeSet, setActiveSet] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Stable ref so the one-shot seeding effect doesn't care about
  // identity churn in the `locations` array between re-renders.
  const locationsRef = useRef(locations);
  locationsRef.current = locations;

  useEffect(() => {
    const next = new Set<string>();
    for (const loc of locationsRef.current) {
      if (Math.random() < EVENT_PROBABILITY) next.add(loc);
    }
    setActiveSet(next);
    // Intentionally `[]` — we only seed once per page load. Refresh
    // is the documented way to draw a fresh set.
  }, []);

  const open = useCallback((loc: string) => setSheetLocation(loc), []);
  const close = useCallback(() => setSheetLocation(null), []);

  const has = useCallback(
    (loc: string) => activeSet.has(loc),
    [activeSet],
  );

  const consume = useCallback((loc: string) => {
    setActiveSet((prev) => {
      if (!prev.has(loc)) return prev;
      const next = new Set(prev);
      next.delete(loc);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ location: sheetLocation, has, open, close, consume }),
    [sheetLocation, has, open, close, consume],
  );

  return (
    <EventSheetContext.Provider value={value}>
      {children}
    </EventSheetContext.Provider>
  );
}

export function useEventSheet() {
  const ctx = useContext(EventSheetContext);
  if (!ctx) {
    throw new Error(
      "useEventSheet() requires <EventSheetProvider> in the tree",
    );
  }
  return ctx;
}
