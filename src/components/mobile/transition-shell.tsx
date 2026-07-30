"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Navigates via `router.push` after prefetching the target.
 *
 * The actual visual transition between pages is handled globally by
 * `<PageTransition>` in the root layout (it crossfades the outgoing tree
 * over the incoming one), so call-sites don't need to sequence anything
 * locally — they just navigate.
 *
 * Kept as a hook rather than a direct `router.push` call so existing
 * imports (MapTopNav, WorldSwitcher) don't need to change, and so we
 * have a single seam if we ever want to reintroduce pre-navigate logic.
 */
export function useTransitionNavigate() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      router.prefetch(href);
      router.push(href);
    },
    [router],
  );
}
