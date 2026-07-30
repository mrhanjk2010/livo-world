"use client";

import {
  BottomSheet,
  SectionLabel,
  SheetCloseButton,
} from "@/components/tilia/bottom-sheet";
import { SpeakerStack, speakerName } from "@/components/tilia/tilia-avatar";
import { ROOM_BY_ID } from "@/lib/tilia/train";
import {
  KIND_LABEL,
  WORLD_FEED,
  type FeedItem,
  type WorldContentKind,
} from "@/lib/tilia/world-feed";

/** 蝴蝶胶囊的绿，和世界动态表头那个开关同一支色。 */
const DESTINY_ACCENT = "#02c262";

/**
 * 「我们的命运」半层 —— 蝴蝶胶囊的落点。
 *
 * 按产品口径只讲两件事：哪些命运已经可以触碰（注定的 / 潜在的），
 * 以及世界里最近起了哪些变化（回响 / 见闻）。刻意不解释这些东西是
 * 怎么长出来的 —— V3.3 明确「用户不需要理解因缘果」，对外的说法只
 * 有一句：世界动态里的各种信息，会不断产生化学反应发生新的故事。
 */
export function DestinySheet({
  open,
  onClose,
  onPickItem,
}: {
  open: boolean;
  onClose: () => void;
  /** 点某条：收起半层并把地图移到它发生的房间。 */
  onPickItem: (item: FeedItem) => void;
}) {
  const groups: readonly { kinds: readonly WorldContentKind[]; title: string }[] =
    [
      { kinds: ["destined", "potential"], title: "可以触碰的命运" },
      { kinds: ["echo", "sighting"], title: "世界最近的变化" },
    ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="我们的命运"
      accent={DESTINY_ACCENT}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium leading-[1.2] text-white">
            我们的命运
          </h2>
          <p className="mt-[8px] text-[12px] leading-[1.6] text-white/45">
            世界动态里的各种信息，会不断产生化学反应，发生新的故事。
          </p>
        </div>
        <SheetCloseButton onClose={onClose} />
      </div>

      {groups.map((g) => {
        const items = WORLD_FEED.filter((i) => g.kinds.includes(i.kind));
        if (items.length === 0) return null;
        return (
          <div key={g.title} className="mt-[18px]">
            <SectionLabel>{g.title}</SectionLabel>
            <ul className="mt-[10px] flex flex-col gap-[8px]">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPickItem(item)}
                    className="flex w-full items-center gap-[10px] rounded-[12px] bg-white/[0.05] px-[10px] py-[10px] text-left transition-colors hover:bg-white/[0.08]"
                  >
                    <SpeakerStack speakers={item.speakers} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] leading-[1.4] text-white/85">
                        {item.text}
                      </p>
                      <p className="mt-[3px] text-[11px] leading-[1.3] text-white/40">
                        {KIND_LABEL[item.kind]}
                        {item.roomId
                          ? ` · ${ROOM_BY_ID[item.roomId]?.name ?? ""}`
                          : ""}
                        {" · "}
                        {item.speakers.map(speakerName).join("、")}
                      </p>
                    </div>
                    {item.hasFollowUp ? (
                      <span
                        className="shrink-0 rounded-full px-[8px] py-[3px] text-[10px] leading-none"
                        style={{
                          backgroundColor: `${DESTINY_ACCENT}26`,
                          color: DESTINY_ACCENT,
                        }}
                      >
                        可继续
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </BottomSheet>
  );
}
