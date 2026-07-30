"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Subject currently focused by the trajectory overlay.
 *   - `null`   → 全部角色 (all friends, paths differentiated by color)
 *   - string   → a single friend's name
 *   - `undefined` → overlay is closed
 */
export type TrajectorySubject = string | null;

type Ctx = {
  /** `undefined` means the overlay is closed. */
  subject: TrajectorySubject | undefined;
  /** Open the overlay focused on a particular subject. */
  open: (subject: TrajectorySubject) => void;
  /** Swap the focused subject without closing the overlay. */
  setSubject: (next: TrajectorySubject) => void;
  close: () => void;
};

const TrajectoryContext = createContext<Ctx | null>(null);

export function TrajectoryProvider({ children }: { children: ReactNode }) {
  const [subject, setSubjectState] = useState<TrajectorySubject | undefined>(
    undefined,
  );

  const open = useCallback((s: TrajectorySubject) => setSubjectState(s), []);
  const setSubject = useCallback(
    (s: TrajectorySubject) => setSubjectState(s),
    [],
  );
  const close = useCallback(() => setSubjectState(undefined), []);

  const value = useMemo<Ctx>(
    () => ({ subject, open, setSubject, close }),
    [subject, open, setSubject, close],
  );

  return (
    <TrajectoryContext.Provider value={value}>
      {children}
    </TrajectoryContext.Provider>
  );
}

export function useTrajectory() {
  const ctx = useContext(TrajectoryContext);
  if (!ctx) {
    throw new Error(
      "useTrajectory() requires <TrajectoryProvider> in the tree",
    );
  }
  return ctx;
}
