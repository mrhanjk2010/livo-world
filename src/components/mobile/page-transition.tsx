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
 * 只管平级跳转（`/map` ↔ `/worlds` 这种）：进来的那棵树淡入，出去的那棵立刻
 * 卸载。进群聊不走这里 —— 那是页内浮层，从被点的地标长开来，两层的动作由
 * `components/mobile/enter-layer` 和 `DrillLayer` 各自负责。
 *
 * 首次挂载（直接打开 / 整页刷新）不动画，页面直接就位。
 */

const FADE_IN_MS = 340;

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
      prevPathnameRef.current = pathname;
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
