"use client";

import Image from "next/image";
import { useEffect, type CSSProperties } from "react";
import {
  RESPOND_COOLDOWN_MS,
  RESPOND_DELIVER_MS,
} from "@/lib/tilia/respond";

type MeteorSpec = {
  /** 起点 / 终点（相对本层，可用 % 或 px） */
  mx0: string;
  my0: string;
  mx1: string;
  my1: string;
  ang: string;
  length: number;
  thickness: number;
  delay: string;
  duration: string;
  /** 主流行更亮更粗 */
  primary?: boolean;
};

/** 多道流行：主划一道从左下→右上，其余错开掠过。 */
const METEORS: readonly MeteorSpec[] = [
  {
    mx0: "-40%",
    my0: "78%",
    mx1: "118%",
    my1: "8%",
    ang: "-32deg",
    length: 220,
    thickness: 2.5,
    delay: "0.05s",
    duration: "1.15s",
    primary: true,
  },
  {
    mx0: "-20%",
    my0: "18%",
    mx1: "110%",
    my1: "72%",
    ang: "28deg",
    length: 140,
    thickness: 1.5,
    delay: "0.22s",
    duration: "0.95s",
  },
  {
    mx0: "8%",
    my0: "-8%",
    mx1: "92%",
    my1: "108%",
    ang: "48deg",
    length: 110,
    thickness: 1.2,
    delay: "0.38s",
    duration: "0.85s",
  },
  {
    mx0: "105%",
    my0: "22%",
    mx1: "-15%",
    my1: "88%",
    ang: "148deg",
    length: 160,
    thickness: 1.8,
    delay: "0.48s",
    duration: "1.05s",
  },
  {
    mx0: "-30%",
    my0: "42%",
    mx1: "125%",
    my1: "28%",
    ang: "-8deg",
    length: 100,
    thickness: 1.2,
    delay: "0.62s",
    duration: "0.8s",
  },
  {
    mx0: "20%",
    my0: "110%",
    mx1: "78%",
    my1: "-12%",
    ang: "-55deg",
    length: 90,
    thickness: 1,
    delay: "0.75s",
    duration: "0.75s",
  },
];

const SPARKS: readonly { left: string; top: string; delay: string; size: number }[] =
  [
    { left: "18%", top: "22%", delay: "0s", size: 3 },
    { left: "28%", top: "58%", delay: "0.2s", size: 2 },
    { left: "72%", top: "30%", delay: "0.35s", size: 3 },
    { left: "82%", top: "62%", delay: "0.1s", size: 2 },
    { left: "48%", top: "70%", delay: "0.45s", size: 2 },
    { left: "38%", top: "36%", delay: "0.55s", size: 2 },
    { left: "62%", top: "48%", delay: "0.15s", size: 3 },
    { left: "12%", top: "48%", delay: "0.65s", size: 2 },
  ];

/**
 * 发送后的星轨送达转场（设计稿 `4329:77283`）。
 * 多道流行斜向高速划过 + 中心星核，读感是「流星掠过」。
 */
export function RespondDeliverOverlay({
  open,
  onDone,
}: {
  open: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDone, RESPOND_DELIVER_MS);
    return () => clearTimeout(t);
  }, [open, onDone]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[72] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="回应已送达世界"
    >
      <div className="absolute inset-0 bg-[rgba(12,17,53,0.58)] backdrop-blur-[14px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b from-[#ffc46b]/22 to-transparent"
      />

      {/* 全屏流行层 —— 在文案/星核之下掠过 */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {METEORS.map((m, i) => (
          <Meteor key={i} {...m} />
        ))}
        {SPARKS.map((s, i) => (
          <span
            key={`spark-${i}`}
            className="absolute rounded-full bg-[#ffc46b] motion-safe:animate-[livo-spark-twinkle_1.6s_ease-in-out_infinite]"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
              boxShadow: `0 0 ${s.size * 3}px rgba(255,196,107,0.9)`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center px-[24px] pb-[36px]">
        <div className="relative w-full max-w-[240px] text-center">
          <p className="bg-gradient-to-b from-[#ffc46b]/45 from-[21%] to-transparent to-[81%] bg-clip-text text-[18px] font-normal tracking-[0.06em] text-transparent">
            VOICE DELIVERED
          </p>
          <p className="-mt-[2px] text-[22px] font-semibold leading-[1.3] text-white">
            回应已送达世界
          </p>
          <p className="mt-[10px] text-[14px] font-medium text-white/42">
            延星轨航行 · {Math.round(RESPOND_COOLDOWN_MS / 1000)}秒后回响
          </p>
        </div>

        {/* 中心星核 + 轨道 */}
        <div className="relative mt-[36px] h-[220px] w-[300px] shrink-0">
          <span className="pointer-events-none absolute left-1/2 top-1/2 size-[140px] -translate-x-1/2 -translate-y-1/2 opacity-90 motion-safe:animate-[livo-destiny-swirl_16s_linear_infinite]">
            <Image
              src="/figma/tilia/respond/glow-ring.svg"
              alt=""
              width={140}
              height={140}
              className="size-full"
              draggable={false}
            />
          </span>

          <span className="pointer-events-none absolute left-[158px] top-[24px] h-[150px] w-[110px] opacity-90">
            <Image
              src="/figma/tilia/respond/orbit-curve.svg"
              alt=""
              width={110}
              height={150}
              className="size-full object-contain"
              draggable={false}
            />
          </span>

          <span className="pointer-events-none absolute left-1/2 top-1/2 h-[80px] w-[120px] motion-safe:animate-[livo-star-pulse_2.2s_ease-in-out_infinite]">
            <Image
              src="/figma/tilia/respond/avatar-glow.svg"
              alt=""
              width={120}
              height={80}
              className="size-full object-contain drop-shadow-[0_0_28px_rgba(255,196,107,0.85)]"
              draggable={false}
              priority
            />
          </span>

          {/* 贴近星核的短尾光，增强「掠过」瞬时感 */}
          <Meteor
            mx0="-8%"
            my0="62%"
            mx1="78%"
            my1="28%"
            ang="-28deg"
            length={70}
            thickness={1.5}
            delay="0.15s"
            duration="0.7s"
          />
          <Meteor
            mx0="88%"
            my0="18%"
            mx1="18%"
            my1="78%"
            ang="130deg"
            length={55}
            thickness={1.2}
            delay="0.4s"
            duration="0.65s"
          />
        </div>
      </div>
    </div>
  );
}

function Meteor({
  mx0,
  my0,
  mx1,
  my1,
  ang,
  length,
  thickness,
  delay,
  duration,
  primary,
}: MeteorSpec) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 block origin-left"
      style={
        {
          "--mx0": mx0,
          "--my0": my0,
          "--mx1": mx1,
          "--my1": my1,
          "--ang": ang,
          width: length,
          height: thickness,
          borderRadius: 999,
          background: primary
            ? "linear-gradient(90deg, transparent 0%, rgba(255,196,107,0.05) 18%, rgba(255,196,107,0.45) 55%, #ffc46b 82%, #fff 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,196,107,0.08) 25%, rgba(255,196,107,0.55) 70%, #ffe4b0 100%)",
          boxShadow: primary
            ? "0 0 10px rgba(255,196,107,0.85), 0 0 22px rgba(255,161,107,0.45)"
            : "0 0 6px rgba(255,196,107,0.55)",
          animation: `livo-meteor-pass ${duration} cubic-bezier(0.22, 0.8, 0.35, 1) ${delay} both`,
        } as CSSProperties
      }
    />
  );
}
