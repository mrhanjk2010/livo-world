"use client";

import { useEffect, useState } from "react";
import {
  BottomSheet,
  SectionLabel,
  SheetCloseButton,
} from "@/components/tilia/bottom-sheet";
import { TiliaAvatar } from "@/components/tilia/tilia-avatar";
import { CAST_BY_ID } from "@/lib/tilia/cast";
import { STATIONS_BY_ROOM, type Room } from "@/lib/tilia/train";
import { WORLD_CLOCK, WORLD_FEED, KIND_LABEL } from "@/lib/tilia/world-feed";

/** 车厢内部的暖木色调，用作弹窗顶部细光与标签底色。 */
const ROOM_ACCENT = "#d9a96a";

/**
 * 房间半层弹窗（车厢视图）。
 *
 * 结构：房间名 + 公共/私密标签 → 用途简介 → 此刻在场的角色 → 这间房最近的动态。
 *
 * 「此刻在场」和「最近的动态」是同一套数据的两个切面：前者读
 * `STATIONS_BY_ROOM`（谁在、在做什么），后者读世界动态里 `roomId`
 * 命中这间房的条目。地图 → 房间 → 人物 / 动态是一条连贯的下钻路径。
 */
export function RoomSheet({
  room,
  onClose,
  onOpenMember,
}: {
  /** null 表示无选中房间（关闭态）。 */
  room: Room | null;
  onClose: () => void;
  onOpenMember: (memberId: string) => void;
}) {
  // 关闭动画期间保留内容，避免先空白再滑走。
  const [shown, setShown] = useState<Room | null>(null);
  useEffect(() => {
    if (room) setShown(room);
  }, [room]);

  if (!shown) return null;

  const stations = STATIONS_BY_ROOM[shown.id] ?? [];
  const news = WORLD_FEED.filter((i) => i.roomId === shown.id);

  return (
    <BottomSheet
      open={room !== null}
      onClose={onClose}
      label={`${shown.name} 房间详情`}
      accent={ROOM_ACCENT}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <h2 className="text-[20px] font-medium leading-[1.2] text-white">
            {shown.name}
          </h2>
          <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
            <span
              className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11px] font-medium leading-none"
              style={{
                backgroundColor: `${ROOM_ACCENT}26`,
                color: ROOM_ACCENT,
                boxShadow: `inset 0 0 0 1px ${ROOM_ACCENT}59`,
              }}
            >
              <span
                aria-hidden
                className="size-[6px] rounded-full"
                style={{ backgroundColor: ROOM_ACCENT }}
              />
              {shown.tier === "public" ? "公共车厢" : "私人空间"}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/[0.07] px-[9px] py-[4px] text-[11px] leading-none text-white/55">
              {stations.length > 0 ? `在场 ${stations.length} 人` : "此刻无人"}
            </span>
          </div>
        </div>

        <SheetCloseButton onClose={onClose} />
      </div>

      <p className="mt-[14px] text-[13px] leading-[1.65] text-white/70">
        {shown.blurb}
      </p>

      <p className="mt-[10px] text-[11px] leading-[1.5] text-white/30">
        {WORLD_CLOCK.leg}
      </p>

      {stations.length > 0 ? (
        <div className="mt-[18px]">
          <SectionLabel>此刻在场</SectionLabel>
          <ul className="mt-[10px] flex flex-col gap-[10px]">
            {stations.map((s) => {
              const m = CAST_BY_ID[s.memberId];
              if (!m) return null;
              const isYou = s.art === "you";
              return (
                <li key={s.memberId}>
                  <button
                    type="button"
                    onClick={() => onOpenMember(s.memberId)}
                    className="flex w-full items-center gap-[10px] rounded-[12px] bg-white/[0.05] px-[10px] py-[9px] text-left transition-colors hover:bg-white/[0.08]"
                  >
                    <TiliaAvatar art={s.art} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-[6px]">
                        <span className="text-[13px] font-medium text-white">
                          {isYou ? "我" : m.name}
                        </span>
                        <span className="text-[11px] text-white/45">
                          {isYou ? "在这个世界里的我" : `${m.position} · ${m.age}`}
                        </span>
                      </div>
                      <p className="mt-[3px] truncate text-[11.5px] leading-[1.4] text-white/65">
                        {s.behaviors[0]}
                      </p>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      className="size-[13px] shrink-0 text-white/35"
                      aria-hidden
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {news.length > 0 ? (
        <div className="mt-[18px]">
          <SectionLabel>这间房最近</SectionLabel>
          <ul className="mt-[10px] flex flex-col gap-[7px]">
            {news.map((i) => (
              <li
                key={i.id}
                className="flex items-baseline gap-[8px] text-[12px] leading-[1.5]"
              >
                <span
                  aria-hidden
                  className="mt-[6px] size-[3px] shrink-0 rounded-full bg-white/30"
                />
                <span className="min-w-0 flex-1 text-white/70">{i.text}</span>
                <span className="shrink-0 text-[10px] text-white/30">
                  {KIND_LABEL[i.kind]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </BottomSheet>
  );
}
