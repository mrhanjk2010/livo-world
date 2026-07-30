"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** 右侧胶囊里的三个页签。 */
export type TiliaTab = "map" | "message" | "mirror";

const TABS: readonly {
  key: TiliaTab;
  label: string;
  icon: string;
}[] = [
  { key: "map", label: "地图", icon: "/figma/tilia/tab-map.svg" },
  { key: "message", label: "消息", icon: "/figma/tilia/tab-message.svg" },
  { key: "mirror", label: "照见", icon: "/figma/tilia/tab-mirror.svg" },
];

/**
 * 《蒂利亚之冬》底导航（设计稿 `3175:14922`「底导航 / TAB2.0」）。
 *
 * 和 DOLO 的 `BottomNav` 是两套东西，互不影响：DOLO 的 `/map` 继续用
 * 原来那条实心底栏，这条只服务蒂利亚的页面。
 *
 * 结构是「一钮 + 一胶囊」并排：
 *   左  52×52 独立圆钮 —— 切换世界，把「换一个世界」从页签里拿出来
 *       单独成钮，因为它不是同级导航而是换语境。
 *   右  52px 高的玻璃胶囊 —— 地图 / 消息 / 照见 三个页签，选中态靠
 *       一块极淡的浅底表示。
 */
export function TiliaBottomNav({
  active,
  onSelect,
  onOpenWorldSwitcher,
}: {
  active: TiliaTab;
  onSelect: (tab: TiliaTab) => void;
  onOpenWorldSwitcher: () => void;
}) {
  /** 未接入的页签点了之后给一句说明，避免点下去毫无反馈。 */
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 1_800);
    return () => clearTimeout(t);
  }, [hint]);

  const pick = (tab: TiliaTab, label: string) => {
    if (tab === "map") {
      onSelect(tab);
      return;
    }
    setHint(`${label}还没接进这一版`);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center gap-[12px] pb-[19px]">
      {hint ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-[80px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-[12px] py-[6px] text-[12px] text-white/80 backdrop-blur-[12px]"
        >
          {hint}
        </div>
      ) : null}

      {/* 左：切换世界 */}
      <button
        type="button"
        onClick={onOpenWorldSwitcher}
        aria-label="切换世界"
        className="relative size-[52px] shrink-0 transition-transform duration-200 active:scale-95"
      >
        <span className="absolute inset-0 rounded-[35px] border-[0.25px] border-white bg-white/[0.08] backdrop-blur-[50px]" />
        <span className="absolute left-1/2 top-1/2 flex size-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <Image
            src="/figma/tilia/tab-world-switch.svg"
            alt=""
            width={21}
            height={20}
            className="select-none"
            draggable={false}
          />
        </span>
      </button>

      {/* 右：三页签玻璃胶囊 */}
      <div className="flex h-[52px] shrink-0 items-center rounded-[30px] border-[0.25px] border-white bg-white/[0.05] p-[4px] backdrop-blur-[25px]">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-label={t.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => pick(t.key, t.label)}
              className={`relative flex h-[44px] w-[62px] items-center justify-center rounded-[28.5px] transition-colors ${
                isActive ? "bg-[rgba(217,217,217,0.1)]" : ""
              }`}
            >
              <span className="flex size-[28px] items-center justify-center">
                <Image
                  src={t.icon}
                  alt=""
                  width={20}
                  height={20}
                  className={`select-none transition-opacity ${
                    isActive ? "opacity-100" : "opacity-70"
                  }`}
                  draggable={false}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
