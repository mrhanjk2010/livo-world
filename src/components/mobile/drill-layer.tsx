"use client";

import type { ReactNode } from "react";
import {
  DRILL_EASE_IN,
  DRILL_EASE_OUT,
  DRILL_IN_MS,
  DRILL_OUT_MS,
  useDrill,
} from "@/lib/mobile/drill";

/**
 * 被钻进去的那一层 —— 把地图页整屏内容包起来。
 *
 * 有人从某枚地标进了群聊，这一层就往前压一档、暗下去；退出来时原路复位。
 * 压得不多（一成出头）：这是余光里的东西，幅度一大就成了地图在往你脸上扑。
 * 暗到三成五是为了让上面那层立住 —— 聊天从一枚地标长开来的头几帧还很小，
 * 底下要是照常亮着，两层就分不出前后。
 */
const DEEP_SCALE = 1.12;
const DEEP_DIM = 0.35;

export function DrillLayer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const drill = useDrill();

  return (
    <div
      className={`livo-drill ${className ?? ""}`}
      style={{
        /*
          退回来时要落回 `none` 而不是 `scale(1)`：留着一个恒等 transform，这
          一层就一直是 backdrop root，卡片那圈 `backdrop-blur` 采样的范围跟着
          变，静止态的观感和进去之前对不上。
        */
        transform: drill.deep ? `scale(${DEEP_SCALE})` : undefined,
        transformOrigin: drill.origin,
        opacity: drill.deep ? DEEP_DIM : 1,
        transition: drill.deep
          ? `transform ${DRILL_IN_MS}ms ${DRILL_EASE_IN}, opacity ${DRILL_IN_MS}ms ${DRILL_EASE_IN}`
          : `transform ${DRILL_OUT_MS}ms ${DRILL_EASE_OUT}, opacity ${DRILL_OUT_MS}ms ${DRILL_EASE_OUT}`,
      }}
    >
      {children}
    </div>
  );
}
