"use client";

import Image from "next/image";
import { TiliaAvatar } from "@/components/tilia/tilia-avatar";
import { CAST_BY_ID } from "@/lib/tilia/cast";
import type { Station } from "@/lib/tilia/train";

/** 设计稿的 pin 尺寸：外层 55×63，水滴框 54×62.5 落在 (0.5, 0.5)。 */
const PIN_W = 55;
const PIN_H = 63;
const FRAME_W = 54;
const FRAME_H = 62.5;
/** 圆形头像 47×47 落在 (4, 4)。 */
const FACE = 47;
const FACE_OFFSET = 4;

/**
 * 地图上的角色头像 pin。
 *
 * 水滴形外框是设计稿给的两张 SVG：`pin-frame-you.svg` 用于「我」，
 * `pin-frame-char.svg` 用于其他角色。两者尺寸一致、描边配色不同，
 * 所以「我」在一车厢人像里一眼可辨 —— 这是 V3.3「世界有『我』的
 * 头像（我存在）」的落地。
 *
 * 设计稿里 pin 上没有行为气泡，这里也不加：角色此刻在做什么由世界
 * 动态里的「角色日程」和房间弹窗的「此刻在场」两处承担，地图上再挂
 * 一圈气泡会把本来就密的车厢平面图彻底盖住。
 *
 * pin 不可点：地图上的角色是氛围，不是入口。人物设定统一走右上角头像
 * 进「人物与世界观」。因此这里用 `pointer-events-none` —— 既不给假的
 * 可点暗示，手指落在头像上也照样能拖地图。
 *
 * `xPct/yPct` 指的是圆形头像的圆心，不是外框左上角 —— 水滴框下方那
 * 个尖角是「站在这里」的指向，圆心才是视觉重心。
 */
export function CharacterPin({
  station,
  xPct,
  yPct,
  moving = false,
}: {
  station: Station;
  /** 覆盖站位坐标；漫游时由 `WanderingCast` 实时传入。 */
  xPct?: number;
  yPct?: number;
  /** 正在走动时关闭位移过渡，交给 rAF 帧驱动。 */
  moving?: boolean;
}) {
  const member = CAST_BY_ID[station.memberId];
  if (!member) return null;

  const isYou = station.art === "you";
  const label = isYou ? "我" : member.name;
  const cx = xPct ?? station.xPct;
  const cy = yPct ?? station.yPct;

  return (
    <div
      role="img"
      aria-label={`${label}：${station.behaviors[0]}`}
      className={`pointer-events-none absolute z-30 ${
        moving ? "" : "transition-transform duration-200"
      }`}
      style={{
        width: PIN_W,
        height: PIN_H,
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        /*
         * 横向按圆心居中；纵向把圆心对到 yPct —— 圆心在外框内的
         * 偏移是 4 + 47/2 = 27.5px，所以整个 pin 要上移这么多。
         */
        marginLeft: -PIN_W / 2,
        marginTop: -(FACE_OFFSET + FACE / 2),
      }}
    >
      <Image
        src={
          isYou
            ? "/figma/tilia/pin-frame-you.svg"
            : "/figma/tilia/pin-frame-char.svg"
        }
        alt=""
        width={FRAME_W}
        height={FRAME_H}
        className="pointer-events-none absolute left-[0.5px] top-[0.5px] select-none"
        style={{ width: FRAME_W, height: FRAME_H }}
        draggable={false}
        priority
      />

      {/* 圆形头像压在水滴框内部，(4, 4) 是设计稿定死的位置。 */}
      <span
        className="absolute"
        style={{ left: FACE_OFFSET, top: FACE_OFFSET }}
      >
        <TiliaAvatar art={station.art} size={FACE} />
      </span>
    </div>
  );
}
