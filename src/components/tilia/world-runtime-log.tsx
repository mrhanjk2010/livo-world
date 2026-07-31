"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  RUNTIME_INTERVAL_MS,
  RUNTIME_LOG,
  RUNTIME_SLOW_INTERVAL_MS,
  RUNTIME_TICK_START,
  RUNTIME_WINDOW,
} from "@/lib/tilia/world-runtime";

/** 一行的高度，和字号的 leading 对齐。 */
const LINE_H = 18;
/** 多留一行：滚动时它从上沿被裁掉，所以看起来是「顶出去」而不是「消失」。 */
const KEEP = RUNTIME_WINDOW + 1;
/** 星图那些线用的同一支绿。 */
const GREEN = "#3bff8f";
/** 上顶一格的时长，跟着 `RUNTIME_INTERVAL_MS` 走（约它的一半）。 */
const SLIDE_MS = 175;

/**
 * 世界运转日志卡 —— 「世界背面」底部那张卡。
 *
 * 卡形照世界动态那张（340 宽、16 圆角、20 模糊），但底子换成近乎纯黑、字换成
 * 绿色等宽：那张卡是世界讲给你听的话，这张是世界自己在算的账，两种东西不该长
 * 得一样。内容见 `world-runtime.ts`。
 *
 * 滚法：留 `KEEP` 行、只露 `RUNTIME_WINDOW` 行，每来一行整叠上顶一格
 * （`livo-log-scroll`）。动画靠 `key` 换值重挂来触发 —— 两百毫秒一行，用状态
 * 去回弹 transform 反而容易丢帧。
 *
 * 整张卡 `pointer-events-none` 且 `aria-hidden`：它不接手势（从它上面按下去
 * 照样能拖星图），也不该被读屏念 —— 一秒五行的流水念出来只是噪音。它是氛围，
 * 不是内容。
 */
export function WorldRuntimeLog({
  /** 底部半层升起来时让位：那时候人在读具体的一枚。 */
  hidden,
}: {
  hidden: boolean;
}) {
  const [cursor, setCursor] = useState(KEEP - 1);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    setMotion(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setCursor((n) => n + 1),
      motion ? RUNTIME_INTERVAL_MS : RUNTIME_SLOW_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, [motion]);

  const rows = Array.from({ length: KEEP }, (_, k) =>
    rowAt(cursor - (KEEP - 1) + k),
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute bottom-[26px] left-1/2 z-[8] w-[340px] -translate-x-1/2 transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="rounded-[16px] border border-[#3bff8f]/[0.12] bg-black/[0.86] px-[16px] pb-[11px] pt-[10px] backdrop-blur-[20px]">
        <p className="mb-[6px] font-mono text-[9px] leading-none text-[#3bff8f]/40">
          $ world.tail -f · 世界一直在算
        </p>

        <div className="overflow-clip" style={{ height: RUNTIME_WINDOW * LINE_H }}>
          <div
            key={cursor}
            style={
              {
                "--log-line": `${LINE_H}px`,
                animation: motion
                  ? `livo-log-scroll ${SLIDE_MS}ms linear forwards`
                  : undefined,
                transform: motion ? undefined : `translateY(-${LINE_H}px)`,
              } as CSSProperties
            }
          >
            {rows.map((row, i) => (
              <p
                key={row.key}
                /* 越旧越淡：滚上去的那几行自己就退场了。 */
                style={{ height: LINE_H, opacity: 0.3 + (i / (KEEP - 1)) * 0.7 }}
                className="overflow-hidden whitespace-nowrap font-mono text-[11px] leading-[18px]"
              >
                <span style={{ color: `${GREEN}70` }}>{row.tick}</span>{" "}
                <span style={{ color: `${GREEN}b0` }}>{row.op}</span>{" "}
                <span style={{ color: GREEN }}>· {row.note}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 第 i 行：内容循环取，tick 一直往上走。
 *
 * 步长不是定值（3 或 8，看 `i % 5` 那一项怎么落）—— 匀速自增看着像个计数器，
 * 忽快忽慢才像「这一拍世界干的事多一点」。减而不是加，是为了保证单调：加上去
 * 的话每五行会回落一次，日志里的计数往回走就成了 bug。
 */
function rowAt(i: number): {
  key: number;
  tick: number;
  op: string;
  note: string;
} {
  const line = RUNTIME_LOG[i % RUNTIME_LOG.length];
  return {
    key: i,
    tick: RUNTIME_TICK_START + i * 4 - (i % 5),
    op: line.op,
    note: line.note,
  };
}
