"use client";

import Image from "next/image";
import {
  BottomSheet,
} from "@/components/tilia/bottom-sheet";
import { SpeakerStack } from "@/components/tilia/tilia-avatar";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import {
  destinyChatHref,
  destinyDisplaySpeakers,
  destinyEnterLabel,
  destinyLayout,
  type DestinyMarkerDef,
} from "@/lib/tilia/destiny-markers";
import { ROOM_BY_ID } from "@/lib/tilia/train";

const DESTINED_ACCENT = "#ff7199";
const POTENTIAL_ACCENT = "#70aaff";

/**
 * 命运进入半层 —— 对齐 Figma `5668:49204`。
 *
 * 点地图命运标记打开；底部白钮「进入·注定/潜在命运」推进单聊或群聊页
 *（成员数 ≤2 为单聊氛围，>2 为群聊）。
 */
export function DestinyEnterSheet({
  marker,
  onClose,
}: {
  marker: DestinyMarkerDef | null;
  onClose: () => void;
}) {
  const navigate = useTransitionNavigate();
  const { beginDestinyVisit } = useStoryFlags();
  const open = !!marker;
  const room = marker?.roomId ? ROOM_BY_ID[marker.roomId] : null;
  const destined = marker?.kind === "destined";
  const accent = destined ? DESTINED_ACCENT : POTENTIAL_ACCENT;
  const layout = marker ? destinyLayout(marker.speakers) : "pair";

  const enter = () => {
    if (!marker) return;
    beginDestinyVisit(marker);
    const href = destinyChatHref(marker);
    onClose();
    // 等半层开始收起再推页，手感对齐校园地图「进入事件」。
    window.setTimeout(() => navigate(href), 80);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={marker?.storyTitle ?? "命运"}
      accent={accent}
    >
      {marker ? (
        <div className="flex flex-col gap-[10px] px-[4px] pb-[8px]">
          {/* 标题行：蝴蝶 + 故事名 + 地点胶囊 */}
          <div className="flex h-[28px] items-center justify-between gap-[8px]">
            <div className="flex min-w-0 flex-1 items-center gap-[6px]">
              <span className="relative size-[20px] shrink-0">
                <Image
                  src={
                    destined
                      ? "/figma/tilia/destiny/sheet-butterfly.svg"
                      : "/figma/tilia/destiny/butterfly-potential.svg"
                  }
                  alt=""
                  fill
                  className="object-contain"
                  draggable={false}
                />
              </span>
              <h2 className="truncate text-[18px] font-medium leading-[28px] text-white">
                {marker.storyTitle}
              </h2>
            </div>
            {room ? (
              <span className="inline-flex shrink-0 items-center gap-[3px] rounded-full bg-black/10 px-[7px] py-[2px] backdrop-blur-[24px]">
                <Image
                  src="/figma/tilia/destiny/pin-subtract.svg"
                  alt=""
                  width={8}
                  height={10}
                  className="opacity-90"
                  draggable={false}
                />
                <span className="text-[12px] font-medium leading-[14px] text-white">
                  {room.name}
                </span>
              </span>
            ) : null}
          </div>

          <SpeakerStack
            speakers={destinyDisplaySpeakers(marker.speakers)}
            size={20}
          />

          <p className="text-[13px] leading-[22px] text-white/70">
            {marker.prologue}
          </p>

          <p className="text-[11px] leading-[1.4] text-white/35">
            {layout === "crowd" ? "群聊 · 多人命运" : "单聊 · 双人命运"}
          </p>

          <button
            type="button"
            onClick={enter}
            className="mt-[2px] flex h-[36px] w-full items-center justify-center rounded-full bg-white px-[16px] text-[13px] font-medium text-[#070910] transition-transform active:scale-[0.98]"
          >
            {destinyEnterLabel(marker.kind)}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
