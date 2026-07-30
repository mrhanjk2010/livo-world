"use client";

import { FACTIONS, type City } from "@/lib/tilia/world";

/**
 * 地图上的城邦节点。
 *
 * 分两档：
 *   • capital —— 主要城邦，显示派系色圆点 + 全称 + 资源图标；
 *   • satellite —— 附庸小城，只有小圆点 + 名字，避免密集区糊成一片。
 *
 * 定位用 `left/top` 百分比 + Tailwind 的 `-translate-x-1/2`
 * `-translate-y-1/2`。注意 Tailwind v4 把 translate 编译成独立的
 * `translate:` 属性，所以选中态的放大动画只写 `transform: scale()`
 * 就不会和居中位移相互覆盖 —— 这是 DOLO 地图上踩过的那个
 * 「A→B→A 位移」坑，这里沿用同一套写法规避。
 */
export function CityNode({
  city,
  selected,
  onSelect,
}: {
  city: City;
  selected: boolean;
  onSelect: (city: City) => void;
}) {
  const faction = FACTIONS[city.factionId];
  const isCapital = city.tier === "capital";

  return (
    <button
      type="button"
      onClick={() => onSelect(city)}
      // 阻止 pointerdown 冒到 PannableMap —— 它会在容器上
      // setPointerCapture，把后续 pointerup 抢走导致 click 永不触发。
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`${city.name} · ${faction.label}`}
      aria-pressed={selected}
      className="absolute -translate-x-1/2 -translate-y-1/2 origin-center transition-transform duration-200 ease-out active:scale-95"
      style={{
        left: `${city.xPct * 100}%`,
        top: `${city.yPct * 100}%`,
        // 主要城邦压在小城之上，选中的再提一层，避免标签互相遮挡。
        zIndex: selected ? 30 : isCapital ? 20 : 10,
        transform: selected ? "scale(1.06)" : undefined,
      }}
    >
      <span className="flex flex-col items-center gap-[5px]">
        {/* 派系色标记。停靠站画成双环（外环＝站台），非停靠站是实心点。 */}
        <span className="relative flex items-center justify-center">
          {selected ? (
            <span
              aria-hidden
              className="absolute size-[26px] rounded-full motion-safe:animate-ping"
              style={{ backgroundColor: faction.accent, opacity: 0.35 }}
            />
          ) : null}
          <span
            className="relative rounded-full"
            style={{
              width: isCapital ? 14 : 8,
              height: isCapital ? 14 : 8,
              backgroundColor: faction.accent,
              boxShadow: `0 0 0 ${isCapital ? 3 : 2}px rgba(255,255,255,0.14), 0 2px 10px ${faction.accent}66`,
            }}
          />
          {city.stop !== undefined ? (
            <span
              aria-hidden
              className="absolute rounded-full border border-[#FFE6BC]/70"
              style={{ width: 24, height: 24 }}
            />
          ) : null}
        </span>

        {/*
         * 名牌。这里只放名字：资源图标在 9px 尺寸下退化成几个小圆点，
         * 在密集区反而变成噪点，所以资源留给势力卡展示。
         */}
        <span
          className={`inline-flex max-w-[112px] items-center whitespace-nowrap rounded-[8px] px-[7px] py-[3px] backdrop-blur-[6px] transition-colors ${
            selected ? "bg-white text-[#111]" : "bg-black/50 text-white/90"
          }`}
          style={{
            fontSize: isCapital ? 11 : 9.5,
            fontWeight: isCapital ? 500 : 400,
            lineHeight: 1.25,
            boxShadow: selected
              ? `0 4px 14px -4px ${faction.accent}aa`
              : "0 2px 8px -3px rgba(0,0,0,0.6)",
          }}
        >
          {city.name}
        </span>
      </span>
    </button>
  );
}
