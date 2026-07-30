"use client";

import { useEffect, useRef, useState } from "react";
import type { EchoCause, EchoStory } from "@/lib/tilia/echo-story";

type Phase = "gather" | "forming" | "done";

/**
 * 因缘汇聚浮层 —— 对齐 worldlive V3.3「变化汇聚 / 因缘汇聚卡片」示意。
 *
 * 不向用户解释「因缘果」术语，只呈现：
 *   若干条动态碎片聚拢 → 「世界回响正在生成…」 → 结果标题
 */
export function EchoConvergeOverlay({
  story,
  onDone,
}: {
  story: EchoStory;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("gather");
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    finished.current = false;
    const t1 = setTimeout(() => setPhase("forming"), 1_100);
    const t2 = setTimeout(() => setPhase("done"), 2_400);
    const t3 = setTimeout(finish, 3_600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 px-[24px] backdrop-blur-[8px]"
      role="dialog"
      aria-label="世界回响正在生成"
    >
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-[20px] border border-white/10 bg-[#12141a]/92 p-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] font-medium tracking-[0.08em] text-[#f0a35a]/80">
          {phase === "done" ? "留下了世界回响" : "世界回响正在生成…"}
        </p>

        {/* 因缘节点：聚拢感用缩放 + 间距变化暗示，不画复杂星图 */}
        <ul className="mt-[16px] flex flex-col gap-[8px]">
          {story.causes.map((c, i) => (
            <CauseChip key={`${c.label}-${i}`} cause={c} phase={phase} index={i} />
          ))}
        </ul>

        <div
          className={`mt-[18px] overflow-hidden rounded-[14px] border border-[#f0a35a]/25 bg-gradient-to-br from-[#3a2418]/80 to-[#1a1210]/90 px-[14px] py-[12px] transition-all duration-500 ${
            phase === "done"
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-40"
          }`}
        >
          <p className="text-[15px] font-medium leading-[1.35] text-white">
            {story.title}
          </p>
          {phase === "done" ? (
            <p className="mt-[8px] text-[12px] leading-[1.55] text-white/65">
              {story.resultText}
            </p>
          ) : (
            <p className="mt-[8px] text-[12px] leading-[1.55] text-white/35">
              动态里的信息正在发生化学反应…
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={finish}
          className="mt-[14px] w-full rounded-full bg-white/10 py-[10px] text-[13px] font-medium text-white/80 transition-colors hover:bg-white/15"
        >
          {phase === "done" ? "看地图上的回响" : "跳过"}
        </button>
      </div>
    </div>
  );
}

function CauseChip({
  cause,
  phase,
  index,
}: {
  cause: EchoCause;
  phase: Phase;
  index: number;
}) {
  const gathered = phase !== "gather";
  return (
    <li
      className={`rounded-[10px] border px-[10px] py-[8px] text-[12px] leading-[1.4] transition-all duration-500 ${
        gathered
          ? "translate-y-0 border-[#f0a35a]/35 bg-[#f0a35a]/10 text-white/85"
          : "translate-y-1 border-white/10 bg-white/[0.04] text-white/55"
      }`}
      style={{ transitionDelay: `${index * 90}ms` }}
    >
      <span className="mr-[6px] text-[10px] text-[#f0a35a]/70">
        {cause.role === "yin" ? "动态" : "回应"}
      </span>
      {cause.label}
    </li>
  );
}
