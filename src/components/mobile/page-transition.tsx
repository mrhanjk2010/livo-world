"use client";

import { usePathname } from "next/navigation";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Root-level page transition.
 *
 * Chat and event pages are handled separately as intercepting-route
 * modals (see `@modal/(.)chat/[location]` + `ChatModal`, and
 * `@modal/(.)event/[location]` + `EventModal`), so this wrapper only
 * needs to deal with lateral top-level navigations (e.g. `/map` ↔
 * `/worlds`). For those we run a short crossfade on the incoming
 * tree — the outgoing tree unmounts immediately.
 *
 * Overlay transitions are explicitly skipped:
 *   - Navigating into `/chat/*` or `/event/*` from, say, `/map` keeps
 *     the `children` slot at the underlying route thanks to the
 *     intercepting modal. If we still bumped a fade here, the
 *     unchanged map tree would remount and blink.
 *   - The same applies when the modal closes and the URL pops back.
 *
 * On the very first mount (initial page load / hard refresh) no
 * animation runs; the page renders directly in place.
 */

const FADE_IN_MS = 340;

function isOverlayRoute(path: string) {
  return path.startsWith("/chat/") || path.startsWith("/event/");
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  const [navCount, setNavCount] = useState(0);

  useLayoutEffect(() => {
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (prevPathnameRef.current !== pathname) {
      const from = prevPathnameRef.current;
      const to = pathname;
      prevPathnameRef.current = pathname;
      // Don't animate on chat/event push/pop — the modal owns that motion.
      if (isOverlayRoute(from) || isOverlayRoute(to)) return;
      setNavCount((c) => c + 1);
    }
  }, [pathname]);

  const animating = navCount > 0;

  return (
    <div
      key={animating ? `nav-${navCount}` : "initial"}
      style={
        animating
          ? {
              animation: `livo-fade-in ${FADE_IN_MS}ms ease-out both`,
              willChange: "opacity",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
