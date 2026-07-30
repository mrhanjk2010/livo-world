"use client";

import { useDemoMode } from "@/components/tilia/demo-mode-context";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import { DEMO_PRESETS } from "@/lib/tilia/demo-mode";

/**
 * Demo 系统菜单 —— 放在手机框右侧，演示时一键切图层 / 剧情节点。
 * 不进入产品 UI；仅方便讲故事 / 验收。
 */
export function DemoSystemMenu() {
  const { preset, layers, setPreset } = useDemoMode();
  const {
    weekLaterArrived,
    jumpToOneWeekLater,
    resetToCurrentDay,
    cabExpansionArmed,
    cabRevealed,
    armCabExpansion,
    resetCabExpansion,
  } = useStoryFlags();

  const cabStaged = cabExpansionArmed || cabRevealed;

  return (
    <aside
      className="flex w-[220px] flex-col gap-[12px]"
      aria-label="演示系统菜单"
    >
      <header className="px-[2px]">
        <p className="text-[11px] font-medium tracking-[0.08em] text-white/35 uppercase">
          Demo · 系统菜单
        </p>
        <h2 className="mt-[4px] text-[15px] font-medium text-white/90">
          演示控制
        </h2>
        <p className="mt-[4px] text-[12px] leading-[1.45] text-white/40">
          在手机框外切换图层与剧情时间节点，不影响产品内 UI。
        </p>
      </header>

      <section className="flex flex-col gap-[6px]">
        <p className="px-[2px] text-[11px] font-medium tracking-[0.06em] text-white/35 uppercase">
          剧情节点
        </p>
        <button
          type="button"
          onClick={resetToCurrentDay}
          className={`rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
            !weekLaterArrived
              ? "border-white/25 bg-white/[0.1] text-white"
              : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
          }`}
        >
          <span className="flex items-center justify-between gap-[8px]">
            <span className="text-[13px] font-medium leading-none">今天</span>
            {!weekLaterArrived ? (
              <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] text-white/80">
                当前
              </span>
            ) : null}
          </span>
          <span className="mt-[6px] block text-[11px] leading-[1.4] text-white/40">
            11:35 · 雪山隘口
          </span>
        </button>
        <button
          type="button"
          onClick={jumpToOneWeekLater}
          className={`rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
            weekLaterArrived
              ? "border-white/25 bg-white/[0.1] text-white"
              : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
          }`}
        >
          <span className="flex items-center justify-between gap-[8px]">
            <span className="text-[13px] font-medium leading-none">一周后</span>
            {weekLaterArrived ? (
              <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] text-white/80">
                当前
              </span>
            ) : null}
          </span>
          <span className="mt-[6px] block text-[11px] leading-[1.4] text-white/40">
            06:18 薄雾 · 巡警检查等三枚命运
          </span>
        </button>
        {/*
          这个节点只备料，不扩图：切过来之后那句话会出现在「回应这一刻」的
          推荐短语里，地图要等话发出去才长出车头。
        */}
        <button
          type="button"
          onClick={cabStaged ? resetCabExpansion : armCabExpansion}
          className={`rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
            cabStaged
              ? "border-white/25 bg-white/[0.1] text-white"
              : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
          }`}
        >
          <span className="flex items-center justify-between gap-[8px]">
            <span className="text-[13px] leading-none font-medium">
              地图扩展
            </span>
            <span
              className={`rounded-full px-[6px] py-[2px] text-[10px] ${
                cabRevealed
                  ? "bg-[#6dffa8]/20 text-[#6dffa8]"
                  : cabExpansionArmed
                    ? "bg-white/15 text-white/80"
                    : "bg-white/[0.06] text-white/45"
              }`}
            >
              {cabRevealed ? "已开放" : cabExpansionArmed ? "待触发" : "未就绪"}
            </span>
          </span>
          <span className="mt-[6px] block text-[11px] leading-[1.4] text-white/40">
            {cabRevealed
              ? "驾驶车厢已并入地图 · 点此收回"
              : cabExpansionArmed
                ? "去「回应这一刻」发出那句话，那道门才会开"
                : "驾驶车厢 · 说到把 XK-101 藏进驾驶室时开放"}
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-[6px]">
        <p className="px-[2px] text-[11px] font-medium tracking-[0.06em] text-white/35 uppercase">
          地图图层
        </p>
        {DEMO_PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
                active
                  ? "border-white/25 bg-white/[0.1] text-white"
                  : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
              }`}
            >
              <span className="flex items-center justify-between gap-[8px]">
                <span className="text-[13px] font-medium leading-none">
                  {p.label}
                </span>
                {active ? (
                  <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] text-white/80">
                    当前
                  </span>
                ) : null}
              </span>
              <span className="mt-[6px] block text-[11px] leading-[1.4] text-white/40">
                {p.hint}
              </span>
            </button>
          );
        })}
      </section>

      <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-[12px] py-[10px]">
        <p className="text-[11px] text-white/35">图层状态</p>
        <ul className="mt-[8px] space-y-[6px] text-[12px] text-white/65">
          <LayerRow label="命运演式" on={layers.showDestiny} />
          <LayerRow label="世界回响" on={layers.showEcho} />
          <LayerRow label="角色漫游" on />
        </ul>
      </div>
    </aside>
  );
}

function LayerRow({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex items-center justify-between gap-[8px]">
      <span>{label}</span>
      <span
        className={`size-[7px] rounded-full ${
          on ? "bg-[#6dffa8]" : "bg-white/20"
        }`}
        aria-label={on ? "开" : "关"}
      />
    </li>
  );
}
