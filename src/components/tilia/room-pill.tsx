"use client";

import Image from "next/image";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Room } from "@/lib/tilia/train";

/**
 * 房间地标 pill。
 *
 * 严格照设计稿 `3378:4321`：半透明黑底 + 20px 背景模糊 + 1px 纯白描边
 * + 白色外发光。红点提醒已去掉，命运入口改由命运演式标记承担。
 */
export function RoomPill({
  room,
  selected,
  onSelect,
}: {
  room: Room;
  selected: boolean;
  onSelect: (room: Room) => void;
}) {
  const swallowPointer = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <button
      type="button"
      onPointerDown={swallowPointer}
      onClick={() => onSelect(room)}
      aria-label={`${room.name}`}
      className={`absolute z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-[3px] rounded-[100px] border border-[#fffdfc] bg-black/20 px-[6px] py-[2px] backdrop-blur-[20px] transition-transform duration-150 active:scale-95 ${
        selected ? "scale-[1.08]" : ""
      } ${room.tier === "public" ? "" : "opacity-85"}`}
      style={{
        left: `${room.xPct * 100}%`,
        top: `${room.yPct * 100}%`,
        boxShadow: selected
          ? "0 0 12px 0 rgba(255,255,255,0.95)"
          : "0 0 5px 0 #ffffff",
      }}
    >
      <Image
        src="/figma/tilia/pin-icon.svg"
        alt=""
        width={7}
        height={8}
        className="shrink-0"
        style={{ width: 6.771, height: 8.125 }}
        draggable={false}
      />
      <span className="whitespace-nowrap text-[10px] font-medium leading-[12px] text-white">
        {room.name}
      </span>
    </button>
  );
}
