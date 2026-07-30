"use client";

import Image from "next/image";

/** 设计稿核心命中区约 44×44；外圈光晕溢出到约 82。 */
export const ECHO_ORB_CORE = 44;

/**
 * 世界回响的光球（设计稿 `3387:9620`）。
 *
 * 图层自内而外：星芒 → 内环 → 外环 → 粒子晕 → 更远一圈尘雾。
 * 颜色固定为金橙，没有命运演式那套粉/蓝变体。
 *
 * 地图标记（`EchoMarker`）和全屏星图（`EchoFieldScreen`）共用这一份图层，
 * 两处的光球必须是同一颗 —— 从地图点进星图时对得上。
 */
export function EchoOrb({
  /** 关掉呼吸：星图里未选中的球静止，只有选中那颗在喘。 */
  breathe = true,
}: {
  breathe?: boolean;
}) {
  return (
    <span
      className="pointer-events-none absolute inset-0 block"
      style={{ width: ECHO_ORB_CORE, height: ECHO_ORB_CORE }}
    >
      {/* 最外圈柔光 */}
      <span
        className="absolute left-[-19.25px] top-[-19.25px] size-[82.5px] opacity-90"
        style={
          breathe
            ? { animation: "livo-echo-breathe 3.2s ease-in-out infinite" }
            : undefined
        }
      >
        <Image
          src="/figma/tilia/echo/halo-outer.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>

      {/* 66 粒子晕 ×2 */}
      <span className="absolute left-[-11px] top-[-11px] size-[66px]">
        <Image
          src="/figma/tilia/echo/halo-a.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>
      <span className="absolute left-[-11px] top-[-11px] size-[66px]">
        <Image
          src="/figma/tilia/echo/halo-b.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>

      {/* 偏右下的尘雾贴图 */}
      <span className="absolute left-[11px] top-[11px] size-[66px] opacity-80">
        <Image
          src="/figma/tilia/echo/particles.png"
          alt=""
          fill
          className="object-cover"
          draggable={false}
        />
      </span>

      {/* 外环 */}
      <span className="absolute left-[-1.38px] top-[-1.38px] size-[46.75px]">
        <Image
          src="/figma/tilia/echo/ring-outer.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>

      {/* 中环 */}
      <span className="absolute left-[2.75px] top-[2.75px] size-[38.5px]">
        <Image
          src="/figma/tilia/echo/ring-mid-a.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>
      <span className="absolute left-[2.75px] top-[2.75px] size-[38.5px]">
        <Image
          src="/figma/tilia/echo/ring-mid-b.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>

      {/* 中心星芒 */}
      <span className="absolute left-[12.8px] top-[11.96px] h-[20.7px] w-[20.7px]">
        <Image
          src="/figma/tilia/echo/sparkle.svg"
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>
    </span>
  );
}
