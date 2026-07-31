"use client";

import Image from "next/image";
import { StatusBar } from "@/components/mobile/status-bar";

/**
 * 车厢地图顶栏（设计稿 `3378:4330`「顶部」）。
 *
 * 三层叠出来：
 *   1. 自上而下的黑色渐变（0.5 → 0.25 → 透明），保证状态栏白字可读；
 *   2. 「模糊层-顶部」—— 一层带 alpha 遮罩的背景模糊，只在最上面
 *      一截生效，让顶栏下方的底图糊掉一点而不是整块压黑；
 *   3. 状态栏 + Top Navigation（左 logo，右回响星图入口）。
 *
 * 遮罩用 CSS 渐变而不是 `blur-mask-top.svg`：那张 mask 本身就是一条
 * 竖直线性渐变（86.4% 处透明 → 94.1% 处不透明，再整体垂直翻转），
 * 用 `mask-image: linear-gradient(...)` 表达完全等价，还省掉一次
 * 请求和静态导出时的路径重写。
 */
export function TiliaTopBar({ onOpenEchoes }: { onOpenEchoes: () => void }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center pb-[56px]"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 51.923%, rgba(0,0,0,0) 100%)",
      }}
    >
      {/*
        模糊层。高度取满一屏、靠 mask 只让顶部约 110px 生效 —— 和
        设计稿一样，模糊的收尾是渐变的，不会在顶栏下沿留一条硬边。
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[812px] bg-white/10 backdrop-blur-[5px]"
        style={{
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 5.86%, rgba(0,0,0,0.8) 8.93%, rgba(0,0,0,0) 13.64%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 5.86%, rgba(0,0,0,0.8) 8.93%, rgba(0,0,0,0) 13.64%)",
        }}
      />

      <StatusBar />

      <div className="relative flex h-[48px] w-full items-center px-[12px] py-[10px]">
        <div className="flex min-w-0 flex-1 items-center">
          <Image
            src="/figma/tilia/logo-tilia.png"
            alt="蒂利亚之冬"
            width={111}
            height={36}
            className="select-none"
            style={{ width: 111, height: 36 }}
            draggable={false}
            priority
          />
        </div>

        {/* 世界背面星图入口（设计稿 `3471:13751`）：28 圆底玻璃 + 20 图标。 */}
        <button
          type="button"
          onClick={onOpenEchoes}
          aria-label="世界背面：看这些事汇聚成了什么"
          className="pointer-events-auto flex size-[28px] shrink-0 items-center justify-center rounded-full bg-black/20 backdrop-blur-[23.2px] transition-[transform,filter] duration-200 hover:brightness-125 active:scale-90 active:brightness-150"
        >
          <Image
            src="/figma/tilia/nav-echo-field.svg"
            alt=""
            width={20}
            height={20}
            className="size-[20px] max-w-none select-none"
            draggable={false}
          />
        </button>
      </div>
    </div>
  );
}
