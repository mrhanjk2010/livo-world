"use client";

import { FACTIONS, ROUTE_STOPS, type City } from "@/lib/tilia/world";

/**
 * 和平号航线进度条 —— 贴在底导航上方的一条横向站点带。
 *
 * 既是「这趟车从哪到哪」的一眼说明，也是地图的快捷导航：点任意站
 * 会把镜头推到该城邦并弹出势力卡（由父级 `onPick` 串起来）。
 */
export function RouteStrip({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (city: City) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[86px] z-30 px-[14px]">
      <div className="pointer-events-auto rounded-[16px] border border-white/10 bg-black/45 px-[12px] py-[10px] backdrop-blur-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-medium tracking-[0.08em] text-[#FFD79A]/85">
            和平号 · 维萨 → 万晁
          </span>
          <span className="text-[10px] text-white/40">
            到达时会是百花盛开的季节
          </span>
        </div>

        {/* 站点带。轨道线用绝对定位垫在圆点之下，圆点靠 flex 均分，
            这样增删停靠站不用手工调间距。 */}
        <div className="relative mt-[11px] flex items-start justify-between">
          <span
            aria-hidden
            className="absolute left-[6px] right-[6px] top-[5px] h-[1.5px] rounded-full bg-gradient-to-r from-[#8FC7F0]/50 via-white/25 to-[#FFC978]/60"
          />
          {ROUTE_STOPS.map((c) => {
            const accent = FACTIONS[c.factionId].accent;
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c)}
                aria-label={`第 ${c.stop} 站 ${c.name}`}
                aria-pressed={active}
                className="group relative flex flex-1 flex-col items-center gap-[6px]"
              >
                <span
                  className="relative z-10 rounded-full transition-transform duration-200 group-active:scale-90"
                  style={{
                    width: active ? 12 : 9,
                    height: active ? 12 : 9,
                    backgroundColor: active ? accent : "#E8EDF2",
                    boxShadow: active
                      ? `0 0 0 3px ${accent}59`
                      : "0 0 0 2px rgba(0,0,0,0.45)",
                  }}
                />
                <span
                  className={`whitespace-nowrap text-[10px] leading-none transition-colors ${
                    active ? "text-white" : "text-white/55"
                  }`}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
