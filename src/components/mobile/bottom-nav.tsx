"use client";

import Image from "next/image";
import { useState } from "react";

type TabKey = "home" | "discover" | "message" | "mine";

type Tab = {
  key: TabKey;
  label: string;
  icons: { src: string; width: number; height: number; className?: string }[];
  badge?: number;
};

const TABS: Tab[] = [
  {
    key: "home",
    label: "首页",
    icons: [
      { src: "/figma/home-body.svg", width: 21, height: 23 },
      { src: "/figma/home-door.svg", width: 7, height: 10 },
    ],
  },
  {
    key: "discover",
    label: "发现",
    icons: [
      { src: "/figma/discover.svg", width: 22, height: 21 },
    ],
  },
  {
    key: "message",
    label: "消息",
    icons: [
      { src: "/figma/message.svg", width: 22, height: 22 },
    ],
    badge: 88,
  },
  {
    key: "mine",
    label: "我的",
    icons: [
      { src: "/figma/union.svg", width: 17, height: 19 },
    ],
  },
];

export function BottomNav({ defaultActive = "discover" }: { defaultActive?: TabKey }) {
  const [active, setActive] = useState<TabKey>(defaultActive);

  return (
    <nav
      // z-30 keeps the nav above lower-layered overlays such as the
      // world-broadcast pill stage, so pills that enter from under
      // the nav stay concealed until they slide out from behind it.
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-[18px] pb-[19px]"
      aria-label="主导航"
    >
      <div className="pointer-events-auto flex h-[58px] w-full items-center gap-[2px] rounded-[30px] border border-white bg-[rgba(250,250,250,0.9)] p-[4px] shadow-[0_5px_42px_0_rgba(0,0,0,0.12)] backdrop-blur-[8px]">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-full flex-1 items-center justify-center rounded-[24px] transition-colors ${
                isActive ? "bg-[rgba(217,217,217,0.6)]" : "hover:bg-black/5"
              }`}
            >
              <span className="relative block size-[28px]">
                {tab.icons.map((icon, i) => (
                  <Image
                    key={i}
                    src={icon.src}
                    alt=""
                    width={icon.width}
                    height={icon.height}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  />
                ))}
              </span>
              {tab.badge !== undefined && (
                <span className="absolute left-[calc(50%+16px)] top-[8px] flex h-[12px] min-w-[12px] items-center justify-center rounded-full bg-[#FF5058] px-[4px] text-[10px] font-medium leading-none text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
