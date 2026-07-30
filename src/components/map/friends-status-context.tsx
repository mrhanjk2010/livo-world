"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared "where is everyone right now" snapshot. Published by
 * `WanderingFriends` (the rAF-driven runtime on the map) and consumed
 * by the top-nav friends panel so the panel's 📌 `location · action`
 * rows always reflect live state.
 *
 * Only publishes when the derived string changes, so consumers
 * (the panel) don't re-render on every animation tick.
 */
export type FriendStatus = {
  name: string;
  avatarSrc: string;
  /** Either a POI label ("后山") or the literal `"路上"` when moving. */
  location: string;
  /**
   * The real POI label suitable for opening a place-based chat with
   * this friend. When the friend is idle, this equals `location`; when
   * they're walking, it's the POI they're heading to so "去TA这里"
   * still lands in a real scene instead of the `路上` fallback.
   */
  chatLocation: string;
  /** Current speech line — behavior when idle, wandering when moving. */
  action: string;
  /**
   * Single emoji representing the friend's *current* mood. Drives the
   * bubble above their avatar on the map plus every other live-state
   * surface (friends panel, "现在" row in the activity sheet) so the
   * three views never disagree about how the character is feeling
   * right now. Rotates in lockstep with `action` so the mood reads as
   * an emotional reaction to whatever the friend is doing.
   */
  mood: string;
};

type Ctx = {
  snapshot: readonly FriendStatus[];
  setSnapshot: (s: readonly FriendStatus[]) => void;
};

const FriendsStatusContext = createContext<Ctx | null>(null);

export function FriendsStatusProvider({
  initial,
  children,
}: {
  initial: readonly FriendStatus[];
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<readonly FriendStatus[]>(initial);
  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot]);
  return (
    <FriendsStatusContext.Provider value={value}>
      {children}
    </FriendsStatusContext.Provider>
  );
}

/** Read current snapshot. Returns [] if used outside the provider. */
export function useFriendsStatus(): readonly FriendStatus[] {
  return useContext(FriendsStatusContext)?.snapshot ?? [];
}

/**
 * Writer handle for the roster snapshot. Producers should diff against
 * the previous payload themselves; calling `setSnapshot` with an equal
 * value still triggers a React render.
 */
export function useFriendsStatusWriter() {
  const ctx = useContext(FriendsStatusContext);
  return ctx?.setSnapshot ?? noopWriter;
}

function noopWriter() {
  /* no provider mounted */
}
