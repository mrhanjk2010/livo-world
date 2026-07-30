"use client";

import { useStoryFlags } from "@/components/tilia/story-flags-context";

type Step = {
  /** 步骤序号，与演示脚本一致。 */
  no: number;
  text: string;
};

const TODAY_STEPS: readonly Step[] = [
  { no: 1, text: "今天，我在「回应这一刻」发了一条音乐会相关的话" },
  { no: 2, text: "触发了一个音乐会的潜在命运" },
  { no: 3, text: "在音乐会的潜在命运中聊到小提琴" },
  { no: 4, text: "回到茶室，多了一把小提琴，潜在命运" },
  { no: 5, text: "小提琴送给了我，我得到小提琴" },
];

const LATER_STEPS: readonly Step[] = [
  { no: 6, text: "一周后回访" },
  { no: 7, text: "触发新的巡警检查命运" },
  { no: 8, text: "我把 XK-101 藏在小提琴内" },
  { no: 9, text: "小提琴帮我躲过了这次检查" },
];

/** 因果链往下长的一段：一句好奇换来一节车厢的通行权。 */
const CAB_STEPS: readonly Step[] = [
  { no: 10, text: "检查散场，琴挡不住第二次开箱" },
  { no: 11, text: "我向任轻义问起车头，他答应替我递话" },
  { no: 12, text: "关掉命运，锁了十天的折棚门开了" },
  { no: 13, text: "地图补上驾驶车厢 · 它一直在，只是不开放" },
  { no: 14, text: "驾驶室落下新命运：列车长在等我" },
];

/**
 * Demo 演示脚本 —— 挂在手机框左侧，交代这条命运链路的因果。
 * 不进入产品 UI；仅用于讲故事 / 验收对照。
 */
export function DemoStoryNotes() {
  const { weekLaterArrived, hasViolin, cabRevealed } = useStoryFlags();

  return (
    <aside
      className="flex w-[240px] flex-col gap-[12px]"
      aria-label="演示脚本说明"
    >
      <header className="px-[2px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/35">
          Demo · 演示脚本
        </p>
        <h2 className="mt-[4px] text-[15px] font-medium text-white/90">
          小提琴与那次检查
        </h2>
        <p className="mt-[4px] text-[12px] leading-[1.45] text-white/40">
          一句回应在一周后救了你一次，又换来一节车厢的通行权。
        </p>
      </header>

      <StepGroup
        label="今天"
        steps={TODAY_STEPS}
        active={!weekLaterArrived}
        done={hasViolin}
      />
      <StepGroup
        label="一周后"
        steps={LATER_STEPS}
        active={weekLaterArrived && !cabRevealed}
        done={cabRevealed}
      />
      <StepGroup
        label="地图扩展"
        steps={CAB_STEPS}
        active={cabRevealed}
        done={false}
      />

      <p className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-[12px] py-[10px] text-[11px] leading-[1.5] text-white/45">
        {"10–14 也能单独演：右侧切到「地图扩展」，再去「回应这一刻」把那句话说出去。琴和车头都不是世界替你变出来的——是你说的话被人听见了，才有人递琴、开门。"}
      </p>
    </aside>
  );
}

function StepGroup({
  label,
  steps,
  active,
  done,
}: {
  label: string;
  steps: readonly Step[];
  /** 当前时间节点所在的那一组高亮。 */
  active: boolean;
  /** 该组已走完，标题旁给一枚完成点。 */
  done: boolean;
}) {
  return (
    <section className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between gap-[8px] px-[2px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/35">
          {label}
        </p>
        {active ? (
          <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] text-white/80">
            当前
          </span>
        ) : done ? (
          <span className="size-[7px] rounded-full bg-[#6dffa8]" />
        ) : null}
      </div>

      <ol
        className={`flex flex-col gap-[8px] rounded-[12px] border px-[12px] py-[11px] transition-colors ${
          active
            ? "border-white/20 bg-white/[0.08]"
            : "border-white/[0.06] bg-white/[0.03]"
        }`}
      >
        {steps.map((s) => (
          <li key={s.no} className="flex gap-[8px]">
            <span
              className={`mt-[1px] inline-flex size-[16px] shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                active
                  ? "bg-white/20 text-white/90"
                  : "bg-white/[0.08] text-white/50"
              }`}
            >
              {s.no}
            </span>
            <span
              className={`text-[12px] leading-[1.5] ${
                active ? "text-white/80" : "text-white/50"
              }`}
            >
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
