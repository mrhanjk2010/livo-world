"use client";

import {
  BottomSheet,
  SectionLabel,
  SheetCloseButton,
} from "@/components/tilia/bottom-sheet";
import { SpeakerStack } from "@/components/tilia/tilia-avatar";
import { ROOM_BY_ID } from "@/lib/tilia/train";
import type { EchoStory } from "@/lib/tilia/echo-story";

const ECHO_ACCENT = "#f0a35a";

/**
 * 世界回响详情半层。
 *
 * V3.3：回响是短剧情，没有后续选项或自由聊 —— 所以这里只有阅读，
 * 没有「进入聊天」CTA。结构对齐 demo：我的行为 → 结果 → 余波。
 */
export function EchoSheet({
  story,
  onClose,
}: {
  story: EchoStory | null;
  onClose: () => void;
}) {
  const open = !!story;
  const room = story ? ROOM_BY_ID[story.roomId] : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="世界回响"
      accent={ECHO_ACCENT}
    >
      {story ? (
        <>
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-[#f0a35a]/85">
                世界回响
                {room ? ` · ${room.name}` : ""}
              </p>
              <h2 className="mt-[6px] text-[20px] font-medium leading-[1.25] text-white">
                {story.title}
              </h2>
            </div>
            <SheetCloseButton onClose={onClose} />
          </div>

          <div className="mt-[14px] flex items-center gap-[8px]">
            <SpeakerStack speakers={story.speakers} size={28} />
            <p className="text-[12px] leading-[1.4] text-white/40">
              短剧情 · 无后续对话
            </p>
          </div>

          <div className="mt-[18px]">
            <SectionLabel>我的行为</SectionLabel>
            <p className="mt-[8px] text-[13px] leading-[1.6] text-white/70">
              {story.actionText}
            </p>
          </div>

          <div className="mt-[16px]">
            <SectionLabel>因此发生</SectionLabel>
            <p className="mt-[8px] text-[14px] leading-[1.65] text-white/85">
              {story.resultText}
            </p>
          </div>

          <div className="mt-[16px] rounded-[12px] border border-[#f0a35a]/20 bg-[#f0a35a]/08 px-[12px] py-[10px]">
            <p className="text-[11px] font-medium text-[#f0a35a]/75">余波</p>
            <p className="mt-[6px] text-[13px] leading-[1.55] text-white/75">
              {story.echoText}
            </p>
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}
