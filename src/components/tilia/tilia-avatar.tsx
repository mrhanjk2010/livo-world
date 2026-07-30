import Image from "next/image";
import type { CSSProperties } from "react";
import { CAST_BY_ID } from "@/lib/tilia/cast";
import { STATION_BY_MEMBER, type PinArt } from "@/lib/tilia/train";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

/**
 * 圆形头像里那张素材的裁切参数。
 *
 * 单位是「头像直径的倍数」而不是像素 —— 设计稿里同一张素材在 47px
 * 的地图头像和 20px 的动态头像里用的是同一组比例（换算过来只差
 * 0.5px 的取整误差），所以归一化一次就能两处复用。数值从设计稿
 * `3378:4318` 的 `角色头像-列车` 实例上量的。
 */
type ArtCrop = {
  src: string;
  /** 圆形底色。素材是抠图/半透明的，底色会透出来。 */
  bg: string;
  /** 素材框相对头像直径的宽 / 高 / 左偏移 / 上偏移。 */
  w: number;
  h: number;
  x: number;
  y: number;
  opacity?: number;
  /** 无障碍与调试用的素材名。 */
  label: string;
};

const ART: Record<PinArt, ArtCrop> = {
  /** 设计稿「头像 1」。半身素材，裁到脸。 */
  "char-a": {
    src: "/figma/tilia/avatar-char-a.png",
    bg: "#404447",
    w: 1.0357,
    h: 1.3143,
    x: -0.0357,
    y: 0.0715,
    label: "角色立绘",
  },
  /** 设计稿「全身 1」。整张立绘只露最上面一截，也就是头。 */
  "char-b": {
    src: "/figma/tilia/avatar-char-b.png",
    bg: "#404447",
    w: 2.0929,
    h: 7.2234,
    x: -0.3928,
    y: 0.05,
    label: "角色立绘",
  },
  /**
   * 任轻义专属头像：从全身立绘裁出的头部正方形。已经以脸+毛领为中心，
   * 圆框里只需轻微放大，把脸推到视觉中心。
   */
  renqingyi: {
    src: "/figma/tilia/avatar-renqingyi.png",
    bg: "#1a1a1c",
    w: 1.12,
    h: 1.12,
    x: -0.06,
    y: -0.04,
    label: "任轻义",
  },
  /** 散庭·姚专属头像：从全身立绘裁出的头部。 */
  santing: {
    src: "/figma/tilia/avatar-santing.png",
    bg: "#1a1418",
    w: 1.14,
    h: 1.14,
    x: -0.07,
    y: -0.05,
    label: "散庭·姚",
  },
  /**
   * 用户自己的头像。设计稿用的是一张抽象光影图压在纯白底上、再降到
   * 80% 不透明度 —— 于是「我」在一车厢的暖褐色人像里是唯一一团冷白，
   * 一眼就能认出来。
   */
  you: {
    src: "/figma/tilia/avatar-you-art.png",
    bg: "#ffffff",
    w: 2.0207,
    h: 3.5891,
    x: -0.6566,
    y: -0.8681,
    opacity: 0.8,
    label: "我",
  },
};

/**
 * 圆形头像。地图上的水滴形 pin（47px）和世界动态行里的叠加头像
 * （20px）都用它，只是尺寸不同。
 *
 * `art` 为空时退化成纯色底 + 一个字 —— 世界动态里的「世界」和路人
 * 配角没有立绘，靠它占位。
 */
export function TiliaAvatar({
  art,
  size,
  fallbackChar,
  className,
  style,
}: {
  art?: PinArt;
  size: number;
  /** 无立绘时圆里显示的那个字。 */
  fallbackChar?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const crop = art ? ART[art] : null;

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-[200px] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: crop?.bg ?? "#404447",
        ...style,
      }}
    >
      {crop ? (
        <span
          className="absolute block"
          style={{
            width: crop.w * size,
            height: crop.h * size,
            left: crop.x * size,
            top: crop.y * size,
            opacity: crop.opacity,
          }}
        >
          <Image
            src={crop.src}
            alt=""
            fill
            sizes={`${Math.round(crop.w * size)}px`}
            className="select-none object-cover"
            draggable={false}
          />
        </span>
      ) : fallbackChar ? (
        <span
          className="absolute inset-0 flex items-center justify-center font-medium text-white/70"
          style={{ fontSize: Math.round(size * 0.44), lineHeight: 1 }}
        >
          {fallbackChar}
        </span>
      ) : null}
    </span>
  );
}

/* ───────────────── 世界动态：说话人 → 头像 / 文案 ───────────────── */

/** 说话人的展示名，也就是动态行「说话人：」那段前缀。 */
export function speakerName(s: FeedSpeaker): string {
  switch (s.kind) {
    case "you":
      return "你";
    case "cast":
      return CAST_BY_ID[s.memberId]?.name ?? "某人";
    case "npc":
      return s.name;
    case "world":
      return "世界";
  }
}

/** 说话人用哪张素材。世界与路人配角没有立绘，返回 undefined。 */
function speakerArt(s: FeedSpeaker): PinArt | undefined {
  if (s.kind === "you") return "you";
  if (s.kind === "cast") return STATION_BY_MEMBER[s.memberId]?.art;
  return undefined;
}

/** 无立绘时圆里那个字：世界用「界」，配角用名字首字。 */
function speakerFallback(s: FeedSpeaker): string | undefined {
  if (s.kind === "world") return "界";
  if (s.kind === "npc") return s.name.slice(0, 1);
  return undefined;
}

/**
 * 动态行左侧的头像组。多人时前一个压住后一个（设计稿用 `mr-[-7px]`
 * 的负边距做叠加），每个头像带 0.5px 白描边把彼此分开。
 */
export function SpeakerStack({
  speakers,
  size = 20,
  /** 叠加的重叠量。设计稿：20px 头像用 7，全屏动态页的 24px 用 6。 */
  overlap = 7,
}: {
  speakers: readonly FeedSpeaker[];
  size?: number;
  overlap?: number;
}) {
  return (
    <span className="flex shrink-0 items-center">
      {speakers.map((s, i) => (
        <TiliaAvatar
          key={`${s.kind}-${i}`}
          art={speakerArt(s)}
          fallbackChar={speakerFallback(s)}
          size={size}
          className="border-[0.5px] border-white"
          // 最后一个不带负边距，否则整组右侧会缺一块。
          style={
            i < speakers.length - 1 ? { marginRight: -overlap } : undefined
          }
        />
      ))}
    </span>
  );
}
