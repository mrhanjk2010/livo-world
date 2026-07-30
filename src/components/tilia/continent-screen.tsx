"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { StatusBar } from "@/components/mobile/status-bar";
import { ContinentMapScreen } from "@/components/tilia/continent-map-screen";
import { RouteStrip } from "@/components/tilia/route-strip";
import type { City } from "@/lib/tilia/world";

/**
 * 大陆势力图整页外壳（`/tilia/continent`）。
 *
 * 顶栏只有「返回车厢」和一句定位说明 —— 这一页是从人物面板下钻进来
 * 的补充资料页，不该再长出一套和主地图页平行的导航。底部的和平号航线
 * 站点条搬到了这里：列车仍在旅途中这条信息在大陆图上才有落点（点站点
 * 就是定位那座城），压在车厢平面图上反而抢了世界动态卡片的位置。
 */
export function ContinentScreen() {
  const [selected, setSelected] = useState<City | null>(null);
  const [focusId, setFocusId] = useState(0);

  const pick = useCallback((city: City) => {
    setSelected(city);
    setFocusId((n) => n + 1);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#070910]">
      <ContinentMapScreen
        selected={selected}
        focusId={focusId}
        onPick={pick}
        onClose={() => setSelected(null)}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[130px] bg-gradient-to-b from-black/60 via-black/25 to-transparent"
      />

      <div className="absolute inset-x-0 top-0 z-40">
        <StatusBar />
        <div className="flex items-center gap-[10px] px-[12px] pb-[10px]">
          <Link
            href="/"
            aria-label="返回车厢"
            className="inline-flex items-center gap-[5px] rounded-full border-[0.25px] border-white/70 bg-white/[0.08] px-[11px] py-[6px] backdrop-blur-[20px] transition-transform active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="size-[13px] text-white"
              aria-hidden
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="text-[12px] leading-none text-white">车厢</span>
          </Link>
          <span className="text-[12px] leading-none text-white/50">
            大陆势力图
          </span>
        </div>
      </div>

      <RouteStrip selectedId={selected?.id ?? null} onPick={pick} />
    </div>
  );
}
