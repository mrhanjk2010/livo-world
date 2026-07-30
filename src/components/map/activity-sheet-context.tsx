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
 * Subject currently shown in the activity sheet.
 *   - `null`  → 全世界
 *   - string  → a friend's name (must match the roster)
 */
export type ActivitySubject = string | null;

type Ctx = {
  /** `undefined` means the sheet is closed. */
  subject: ActivitySubject | undefined;
  open: (subject: ActivitySubject) => void;
  close: () => void;
};

const ActivitySheetContext = createContext<Ctx | null>(null);

/**
 * Controls a single shared "角色日程 / 全世界动态" half-sheet. Providers
 * live in `MapScreen`; both the friends panel (calendar buttons) and
 * the map action bubble ("TA的动态") call `open()` through this.
 */
export function ActivitySheetProvider({ children }: { children: ReactNode }) {
  const [subject, setSubject] = useState<ActivitySubject | undefined>(
    undefined,
  );

  const open = useCallback((s: ActivitySubject) => setSubject(s), []);
  const close = useCallback(() => setSubject(undefined), []);

  const value = useMemo<Ctx>(
    () => ({ subject, open, close }),
    [subject, open, close],
  );

  return (
    <ActivitySheetContext.Provider value={value}>
      {children}
    </ActivitySheetContext.Provider>
  );
}

export function useActivitySheet() {
  const ctx = useContext(ActivitySheetContext);
  if (!ctx) {
    throw new Error(
      "useActivitySheet() requires <ActivitySheetProvider> in the tree",
    );
  }
  return ctx;
}
