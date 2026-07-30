"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { SpeakerStack, TiliaAvatar } from "@/components/tilia/tilia-avatar";
import {
  DESTINY_MARKERS,
  destinyDisplaySpeakers,
  destinyFocusSpeaker,
  destinyLayout,
  destinyOccupiedMemberIds,
  speakersNotOnMap,
  type DestinyKind,
  type DestinyLayout,
  type DestinyMarkerDef,
} from "@/lib/tilia/destiny-markers";
import { STATION_BY_MEMBER, STATIONS, type PinArt } from "@/lib/tilia/train";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

const SIZE = 116;
/** 光环内圆直径，大头像 / 场景图共用这一格。 */
const CORE = 60;

/**
 * 地图上的命运演式标记（设计稿 `3387:9619`）。
 *
 * 布局由参与人数决定：
 *   ≤2（我+角色）→ 角色大头像与内圆重合（自己的头像不进圆）
 *   >2 → 底部小头像叠放（不含自己）+ 内圆群聊场景图
 *
 * 头像互斥：进命运的角色不进漫游；自己始终在地图上走动。
 */
export function DestinyMarker({
  marker,
  onOpen,
}: {
  marker: DestinyMarkerDef;
  onOpen: (marker: DestinyMarkerDef) => void;
}) {
  const swallow = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  const { layout, visibleSpeakers, focus } = useMemo(() => {
    const occupied = destinyOccupiedMemberIds(DESTINY_MARKERS);
    const wandering = new Set(
      STATIONS.map((s) => s.memberId).filter((id) => !occupied.has(id)),
    );
    const visible = destinyDisplaySpeakers(
      speakersNotOnMap(marker.speakers, wandering),
    );
    const layoutMode = destinyLayout(marker.speakers);
    return {
      layout: layoutMode,
      visibleSpeakers: visible,
      focus: destinyFocusSpeaker(visible.length ? visible : marker.speakers),
    };
  }, [marker.speakers]);

  return (
    <button
      type="button"
      onPointerDown={swallow}
      onClick={() => onOpen(marker)}
      aria-label={`${kindLabel(marker.kind)}·${layoutLabel(layout)}：${marker.title}`}
      className="absolute z-[25] -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 active:scale-95"
      style={{
        width: SIZE,
        height: SIZE,
        left: `${marker.xPct * 100}%`,
        top: `${marker.yPct * 100}%`,
      }}
    >
      <Aura
        kind={marker.kind}
        layout={layout}
        focus={focus}
        sceneSrc={marker.sceneSrc}
      />
      <TitlePill kind={marker.kind} title={marker.title} />
      {layout === "crowd" && visibleSpeakers.length > 0 ? (
        <span className="absolute left-1/2 top-[71px] flex h-[20px] w-[54px] -translate-x-1/2">
          <SpeakerStack speakers={visibleSpeakers.slice(0, 3)} size={20} />
        </span>
      ) : null}
    </button>
  );
}

function Aura({
  kind,
  layout,
  focus,
  sceneSrc,
}: {
  kind: DestinyKind;
  layout: DestinyLayout;
  focus: FeedSpeaker | null;
  sceneSrc?: string;
}) {
  const destined = kind === "destined";
  const coreLeft = destined ? 26 : 28;
  const coreTop = destined ? 27 : 28;
  const crowdScene = sceneSrc ?? "/figma/tilia/destiny/scene-parlour.png";

  return (
    <span className="pointer-events-none absolute inset-0 block">
      {destined ? (
        <>
          <span
            className="absolute left-0 top-[1px] size-[112.5px] motion-safe:animate-[livo-destiny-swirl_28s_linear_infinite]"
          >
            <Image
              src="/figma/tilia/destiny/swirl-destined-outer.svg"
              alt=""
              fill
              className="object-contain"
              draggable={false}
            />
          </span>
          <span
            className="absolute left-[12px] top-[13px] size-[88px] motion-safe:animate-[livo-destiny-swirl_18s_linear_infinite]"
          >
            <Image
              src="/figma/tilia/destiny/swirl-destined-mid.svg"
              alt=""
              fill
              className="object-contain"
              draggable={false}
            />
          </span>
        </>
      ) : (
        <span
          className="absolute left-[13px] top-[13px] size-[90px] motion-safe:animate-[livo-destiny-swirl_24s_linear_infinite]"
        >
          <Image
            src="/figma/tilia/destiny/swirl-potential-outer.svg"
            alt=""
            fill
            className="object-contain"
            draggable={false}
          />
        </span>
      )}

      <span
        className={`absolute opacity-70 motion-safe:animate-[livo-destiny-swirl_36s_linear_infinite] ${
          destined
            ? "left-[2px] top-[3px] size-[106px]"
            : "left-[5px] top-[4px] size-[106px]"
        }`}
      >
        <Image
          src={
            destined
              ? "/figma/tilia/destiny/mist-destined.png"
              : "/figma/tilia/destiny/mist-potential.png"
          }
          alt=""
          fill
          className="object-contain"
          draggable={false}
        />
      </span>

      {/* 内圆 / 蝴蝶 / 标题不转，锚在标记中心 */}
      <span
        className="absolute overflow-hidden rounded-full border border-white/55"
        style={{
          left: coreLeft,
          top: coreTop,
          width: CORE,
          height: CORE,
        }}
      >
        {sceneSrc ? (
          <Image
            src={sceneSrc}
            alt=""
            fill
            className="object-cover"
            draggable={false}
          />
        ) : layout === "crowd" ? (
          <Image
            src={crowdScene}
            alt=""
            fill
            className="object-cover"
            draggable={false}
          />
        ) : focus ? (
          <FocusAvatar speaker={focus} />
        ) : (
          <Image
            src={
              destined
                ? "/figma/tilia/destiny/swirl-destined-inner.svg"
                : "/figma/tilia/destiny/swirl-potential-inner.svg"
            }
            alt=""
            fill
            className="object-contain"
            draggable={false}
          />
        )}
      </span>

      <Butterfly
        src={
          destined
            ? "/figma/tilia/destiny/butterfly-destined.svg"
            : "/figma/tilia/destiny/butterfly-potential.svg"
        }
        className={
          destined
            ? "left-[88px] top-[31px] size-[12px] -rotate-[30deg]"
            : "left-[89px] top-[32px] size-[12px] -rotate-[30deg]"
        }
      />
      <Butterfly
        src={
          destined
            ? "/figma/tilia/destiny/butterfly-destined-sm.svg"
            : "/figma/tilia/destiny/butterfly-potential-sm.svg"
        }
        className={
          destined
            ? "left-[14px] top-[68px] size-[7px] -scale-y-100 -rotate-[49deg]"
            : "left-[16px] top-[70px] size-[7px] -scale-y-100 -rotate-[49deg]"
        }
      />
    </span>
  );
}

function FocusAvatar({ speaker }: { speaker: FeedSpeaker }) {
  const art: PinArt | undefined =
    speaker.kind === "you"
      ? "you"
      : speaker.kind === "cast"
        ? STATION_BY_MEMBER[speaker.memberId]?.art
        : undefined;
  const fallback =
    speaker.kind === "npc"
      ? speaker.name.slice(0, 1)
      : speaker.kind === "world"
        ? "界"
        : undefined;

  return (
    <TiliaAvatar
      art={art}
      size={CORE}
      fallbackChar={fallback}
      className="border-0"
    />
  );
}

function Butterfly({ src, className }: { src: string; className: string }) {
  return (
    <span className={`absolute block ${className}`}>
      <Image src={src} alt="" fill className="object-contain" draggable={false} />
    </span>
  );
}

function TitlePill({ kind, title }: { kind: DestinyKind; title: string }) {
  const destined = kind === "destined";
  return (
    <span
      className={`absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-[2px] rounded-[100px] py-[2px] pl-[8px] pr-[6px] ${
        destined ? "border border-white" : ""
      }`}
      style={{
        backgroundImage: destined
          ? "linear-gradient(93deg, #ff7199 1.5%, #ff8874 98.5%)"
          : "linear-gradient(90deg, rgba(0,170,212,0.8), rgba(112,143,255,0.8))",
      }}
    >
      <span className="whitespace-nowrap text-[12px] font-medium leading-[18px] text-white">
        {title}
      </span>
      <span className="relative size-[12px] shrink-0 overflow-hidden">
        <Image
          src="/figma/tilia/destiny/chevron-a.svg"
          alt=""
          width={4}
          height={6}
          className="absolute left-[7px] top-[3px]"
          draggable={false}
        />
        <Image
          src="/figma/tilia/destiny/chevron-b.svg"
          alt=""
          width={4}
          height={6}
          className="absolute left-[3px] top-[3px]"
          draggable={false}
        />
      </span>
    </span>
  );
}

function kindLabel(kind: DestinyKind) {
  return kind === "destined" ? "注定的命运" : "潜在的命运";
}

function layoutLabel(layout: DestinyLayout) {
  return layout === "crowd" ? "多人" : "双人";
}
