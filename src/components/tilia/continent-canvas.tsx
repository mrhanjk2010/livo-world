"use client";

import { useEffect, useRef } from "react";
import {
  CANVAS_H,
  CANVAS_W,
  CITIES,
  FACTIONS,
  ROUTE_PATH,
  SNOW_RANGE,
} from "@/lib/tilia/world";

/**
 * 和平号跑完整条航线的时长。故事里这是一趟跨越极北到南方花季的长途
 * 列车，所以刻意放得很慢 —— 它是氛围元素，不是进度指示器。
 */
const TRAVERSE_MS = 46_000;

/**
 * 大陆底图：渐变海面、经纬网格、势力territory光晕、雪山隘口、
 * 和平号航线与列车标记。
 *
 * 全部用 SVG 绘制而不是位图，原因有三：
 *   1. 城邦坐标改动后航线会自动重算（见 world.ts 的 smoothPath），
 *      位图底图做不到；
 *   2. 地图要在 `PannableMap` 里被任意缩放，矢量不会糊；
 *   3. 势力配色直接取自 FACTIONS，改派系色地图立刻同步。
 *
 * 视觉方向沿用项目文档示意图的读法：左端极北苦寒（冷蓝＋霜光），
 * 右端万晁花季（暖金＋日光），中间横亘雪山隘口。
 */
export function ContinentCanvas() {
  const pathRef = useRef<SVGPathElement | null>(null);
  const trainRef = useRef<SVGGElement | null>(null);
  const traveledRef = useRef<SVGPathElement | null>(null);

  /**
   * 沿航线推进列车。用 `getPointAtLength` 而不是 CSS `offset-path`，
   * 因为列车是 SVG 内的 `<g>`：它跟着 viewBox 一起缩放，坐标系与
   * 航线严格一致；而 `offset-path` 的 path() 坐标是元素本地 CSS 像素，
   * 在被缩放的容器里会和航线错位。
   */
  useEffect(() => {
    const path = pathRef.current;
    const train = trainRef.current;
    if (!path || !train) return;

    const total = path.getTotalLength();
    const traveled = traveledRef.current;
    if (traveled) traveled.style.strokeDasharray = `0 ${total}`;

    /** 把列车摆到航线 `t`（0..1）处，并让车头朝向前进方向。 */
    const place = (t: number) => {
      const at = total * t;
      const p = path.getPointAtLength(at);
      // 取前方一小段求切线角，让车身贴合弯道。
      const ahead = path.getPointAtLength(Math.min(total, at + 6));
      const angle =
        (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
      train.setAttribute(
        "transform",
        `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`,
      );
      if (traveled) {
        traveled.style.strokeDasharray = `${at.toFixed(1)} ${total.toFixed(1)}`;
      }
    };

    // 尊重「减少动态效果」：直接停在蜜兰庭一带的中段，不做循环动画。
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      place(0.45);
      return;
    }

    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      // 走到终点后回到起点重新出发 —— 循环比来回折返更符合
      // 「单向开往万晁」的设定。
      const t = ((now - start) % TRAVERSE_MS) / TRAVERSE_MS;
      place(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="absolute inset-0 size-full"
      // 底图纯装饰；所有可交互内容（城邦节点）是 SVG 之上的 DOM 层。
      aria-hidden
    >
      <defs>
        {/* 海面：左冷右暖的横向渐变，叠一层自上而下的加深。 */}
        <linearGradient id="tilia-sea" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="#0A1A2B" />
          <stop offset="42%" stopColor="#0C1826" />
          <stop offset="78%" stopColor="#141A22" />
          <stop offset="100%" stopColor="#1E1B18" />
        </linearGradient>

        {/* 极北霜光（左上）与万晁日光（右侧）。 */}
        <radialGradient id="tilia-frost" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#9FD8FF" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#9FD8FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tilia-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFC978" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#FFC978" stopOpacity="0" />
        </radialGradient>

        {/*
         * 势力光晕的软化。之前直接画实心圆，结果是一圈圈硬边色块，
         * 读起来像散景光斑而不是「谁的势力覆盖到哪」；统一过一层
         * 大半径高斯模糊后才成为真正的 territory 底色。
         */}
        <filter
          id="tilia-aura-blur"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur stdDeviation="30" />
        </filter>

        {/* 航线的暖金外发光。 */}
        <filter id="tilia-route-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="tilia-snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DCEBF7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#5E7C99" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <rect width={CANVAS_W} height={CANVAS_H} fill="url(#tilia-sea)" />

      {/* 经纬网格 —— 极低对比度，只为让拖动时有参照感。 */}
      <g stroke="#7FA8CC" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 13 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(CANVAS_W / 12) * i}
            y1={0}
            x2={(CANVAS_W / 12) * i}
            y2={CANVAS_H}
          />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(CANVAS_H / 8) * i}
            x2={CANVAS_W}
            y2={(CANVAS_H / 8) * i}
          />
        ))}
      </g>

      {/* 冷暖两端的环境光。 */}
      <ellipse
        cx={40}
        cy={CANVAS_H * 0.42}
        rx={330}
        ry={340}
        fill="url(#tilia-frost)"
      />
      <ellipse
        cx={CANVAS_W - 20}
        cy={CANVAS_H * 0.5}
        rx={330}
        ry={360}
        fill="url(#tilia-sun)"
      />

      {/* 势力territory：每个城邦一团派系色光晕，主要城邦更大更亮。
          叠在一起就形成了「谁挨着谁、谁的势力压过谁」的读图效果。
          半径刻意压得比城邦间距小，让相邻势力只在边缘互相渗透 ——
          半径一大就糊成一片，反而看不出归属。 */}
      <g filter="url(#tilia-aura-blur)" style={{ mixBlendMode: "screen" }}>
        {CITIES.map((c) => {
          const capital = c.tier === "capital";
          return (
            <circle
              key={c.id}
              cx={c.xPct * CANVAS_W}
              cy={c.yPct * CANVAS_H}
              r={capital ? 62 : 30}
              fill={FACTIONS[c.factionId].accent}
              opacity={capital ? 0.5 : 0.34}
            />
          );
        })}
      </g>

      {/* 海峡水纹 —— 两带之间那段海面上的几道细弧，让中段不至于是
          一片纯色。振幅很小，只在拖动时提供一点视差参照。 */}
      <g stroke="#9FD8FF" strokeOpacity="0.08" strokeWidth="1.4" fill="none">
        {[0.4, 0.455, 0.51].map((t, i) => (
          <path
            key={i}
            d={`M ${60 + i * 40} ${CANVAS_H * t} Q ${CANVAS_W * 0.3} ${
              CANVAS_H * t - 16
            }, ${CANVAS_W * 0.52} ${CANVAS_H * t} T ${CANVAS_W - 60} ${
              CANVAS_H * t - 8
            }`}
          />
        ))}
      </g>

      {/* 雪山隘口 —— 列车从维萨南下必须穿过的地形。 */}
      <g>
        {SNOW_RANGE.map((m, i) => (
          <polygon
            key={i}
            points={`${m.x},${m.y + m.h} ${m.x + m.w / 2},${m.y} ${m.x + m.w},${m.y + m.h}`}
            fill="url(#tilia-snow)"
          />
        ))}
      </g>

      {/*
       * 航线分四层叠出来：
       *   1. 深色外壳 —— 保证线在明亮的势力光晕上也能读出边界；
       *   2. 未行驶段 —— 半透明暖金，一眼看清整条线通向哪里
       *      （之前只有 0.18 透明度，列车前方的路等于没画）；
       *   3. 已行驶段 —— 高亮 + 外发光，随列车推进被 JS 拉长；
       *   4. 虚线枕木 —— 铁路质感。
       */}
      <path
        d={ROUTE_PATH}
        fill="none"
        stroke="#04090F"
        strokeOpacity="0.55"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        ref={pathRef}
        d={ROUTE_PATH}
        fill="none"
        stroke="#F2C078"
        strokeOpacity="0.45"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        ref={traveledRef}
        d={ROUTE_PATH}
        fill="none"
        stroke="#FFD79A"
        strokeOpacity="0.95"
        strokeWidth="4.5"
        strokeLinecap="round"
        filter="url(#tilia-route-glow)"
      />
      <path
        d={ROUTE_PATH}
        fill="none"
        stroke="#FFF6E6"
        strokeOpacity="0.7"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />

      {/* 和平号。车身沿切线旋转，所以这里按「朝右行驶」画即可。 */}
      <g ref={trainRef}>
        <ellipse rx="17" ry="9" fill="#FFE6BC" opacity="0.22" />
        <rect
          x="-11"
          y="-4.6"
          width="22"
          height="9.2"
          rx="4"
          fill="#FFF6E6"
          stroke="#C98A3C"
          strokeWidth="1"
        />
        {/* 车窗 */}
        <rect x="-6.5" y="-2" width="3.4" height="3.4" rx="0.8" fill="#2C4A66" />
        <rect x="-1.7" y="-2" width="3.4" height="3.4" rx="0.8" fill="#2C4A66" />
        <rect x="3.1" y="-2" width="3.4" height="3.4" rx="0.8" fill="#2C4A66" />
        {/* 车头灯 */}
        <circle cx="12.5" cy="0" r="2.1" fill="#FFD79A" />
      </g>
    </svg>
  );
}
