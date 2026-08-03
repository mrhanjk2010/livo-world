"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatRouteBody } from "@/components/chat/chat-route-body";
import { PhoneOverlayScope } from "@/components/mobile/phone-frame";
import {
  clearEnterTarget,
  DRILL_EASE_IN,
  DRILL_EASE_OUT,
  DRILL_IN_MS,
  DRILL_OUT_MS,
  setDrillDeep,
  useDrill,
  type EnterTarget,
} from "@/lib/mobile/drill";

/**
 * 进某个地方的那一屏 —— 群聊 / 日常事件，从被点的那枚地标长开来占满手机屏。
 *
 * 挂在地图页里，和 `DrillLayer`（地图内容那层）并排：一个长开来，一个往后退，
 * 合起来才是「钻进下一层空间」。为什么不走路由见 `lib/mobile/drill`。
 *
 * 地址栏不动。这一层是页内的，没有对应的路由跳转，所以按浏览器后退键本来会
 * 直接离开地图页 —— 太狠了，人只是想退出聊天。所以开场时压一条同地址的历史
 * 记录：后退键弹掉它，我们收到 popstate 就把这一层收起来，地图还在原处。返回
 * 按钮走的也是同一条路（`history.back()`），省得两套收尾各收各的。
 *
 * 代价是聊天时地址栏仍停在地图上。换来的是刷新回到地图而不是一个没有上下文
 * 的独立聊天页 —— 演示里这个更要紧。`/chat/[location]` 那两条真路由留着，直
 * 接打开地址仍然看得到聊天。
 */
const FROM_SCALE = 0.62;
/** 认自己压的那条历史记录，别把别人的 popstate 也当成退出。 */
const HISTORY_MARK = "livoEnter";

type Phase = "enter" | "open" | "exit";

export function EnterLayer() {
  const { target, origin } = useDrill();
  /** 正在渲染的那一屏。退出动画还在跑时它比 store 里的 target 多活一会儿。 */
  const [shown, setShown] = useState<EnterTarget | null>(null);
  const [phase, setPhase] = useState<Phase>("enter");
  const pushed = useRef(false);

  useEffect(() => {
    if (!target) return;
    setShown(target);
    setPhase("enter");
    if (!pushed.current) {
      window.history.pushState({ [HISTORY_MARK]: true }, "", window.location.href);
      pushed.current = true;
    }
  }, [target]);

  useEffect(() => {
    if (!shown || phase !== "enter") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase("open");
        // 同一帧告诉地图：人进来了，你往后退。
        setDrillDeep(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [shown, phase]);

  const beginExit = useCallback(() => {
    setPhase("exit");
    clearEnterTarget();
    setDrillDeep(false);
  }, []);

  useEffect(() => {
    if (phase !== "exit") return;
    const t = window.setTimeout(() => setShown(null), DRILL_OUT_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!shown) return;
    const onPop = (e: PopStateEvent) => {
      // 还落在我们压的那条记录上（比如前进回来）就不管。
      if ((e.state as Record<string, unknown> | null)?.[HISTORY_MARK]) return;
      pushed.current = false;
      beginExit();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [shown, beginExit]);

  /* 这一层被拆掉时（换页、热更新）也得把地图放回来。 */
  useEffect(() => () => setDrillDeep(false), []);

  const close = useCallback(() => {
    if (phase === "exit") return;
    if (pushed.current) {
      // 弹掉自己压的那条记录，收尾统一交给 popstate。
      window.history.back();
      return;
    }
    beginExit();
  }, [phase, beginExit]);

  if (!shown) return null;

  const open = phase === "open";
  const transition =
    phase === "enter"
      ? "none"
      : open
        ? `transform ${DRILL_IN_MS}ms ${DRILL_EASE_IN}, opacity ${Math.round(DRILL_IN_MS * 0.55)}ms ease-out`
        : /* 出：先撑住不透明地缩回去，最后一段才淡掉 —— 淡得太早，缩的那一
             程就发生在看不见的地方，等于没缩。 */
          `transform ${DRILL_OUT_MS}ms ${DRILL_EASE_OUT}, opacity ${Math.round(DRILL_OUT_MS * 0.6)}ms ease-in ${Math.round(DRILL_OUT_MS * 0.4)}ms`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="livo-drill absolute inset-0 z-[80]"
      style={{
        transform: open ? "scale(1)" : `scale(${FROM_SCALE})`,
        transformOrigin: origin,
        opacity: open ? 1 : 0,
        transition,
        willChange: "transform, opacity",
        // 正在长开或正在退场时不接点击：那会儿看到的还不是能用的界面。
        pointerEvents: open ? undefined : "none",
      }}
    >
      <PhoneOverlayScope>
        <div className="absolute inset-0 overflow-hidden bg-[#101519] md:rounded-[40px]">
          <ChatRouteBody
            location={shown.location}
            mode={shown.mode}
            onBack={close}
          />
        </div>
      </PhoneOverlayScope>
    </div>
  );
}
