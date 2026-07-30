"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { PannableMap } from "@/components/map/pannable-map";
import { DestinyMarker } from "@/components/tilia/destiny-marker";
import { EchoMarker } from "@/components/tilia/echo-marker";
import { useDemoMode } from "@/components/tilia/demo-mode-context";
import { RoomPill } from "@/components/tilia/room-pill";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import { TrainFog, TrainVignette } from "@/components/tilia/train-fog";
import { WanderingCast } from "@/components/tilia/wandering-cast";
import {
  DESTINY_MARKERS,
  destinyOccupiedMemberIds,
  type DestinyMarkerDef,
} from "@/lib/tilia/destiny-markers";
import {
  ECHO_MARKERS,
  type EchoMarkerDef,
} from "@/lib/tilia/echo-markers";
import { buildTeaRoomViolinMarker, TEA_ROOM_VIOLIN_LOCATION } from "@/lib/tilia/music-hall-concert";
import {
  TRAIN_CANVAS_H,
  TRAIN_CANVAS_W,
  TRAIN_FOCUS_X,
  TRAIN_FOCUS_Y,
  TRAIN_PAN_SCALE,
  visibleRooms,
  type Room,
} from "@/lib/tilia/train";
import {
  visibleConnectors,
  visibleSegments,
  xBoundsForReveal,
} from "@/lib/tilia/train-segments";

/**
 * 驾驶车厢底图入场前的等待。略短于取景的 520ms 相机推移，
 * 让抹开动画在镜头快到位时起手。
 */
const CAB_DRAW_DELAY_MS = 420;

/**
 * 「和平号」车厢内部地图（设计稿 `3378:4319`）。
 *
 * 图层自下而上：底图 → 地标 pill →（可选）命运 / 回响 → 走动的角色 pin →
 * 四向雾 → 两道压暗渐变。
 * 回应酝酿出的潜在命运始终可见；种子命运由演示菜单控制。
 */
export function TrainMapScreen({
  selectedRoomId,
  focusRoom,
  focusId,
  onSelectRoom,
  onOpenDestinyMarker,
  onOpenEchoMarker,
  spawnedDestinies,
}: {
  selectedRoomId: string | null;
  focusRoom: Room | null;
  focusId: number;
  onSelectRoom: (room: Room) => void;
  onOpenDestinyMarker: (marker: DestinyMarkerDef) => void;
  onOpenEchoMarker: (marker: EchoMarkerDef) => void;
  /** 回应流程冷却结束后落下的潜在命运。 */
  spawnedDestinies: readonly DestinyMarkerDef[];
}) {
  const { layers } = useDemoMode();
  const { violinInTeaRoom, isPotentialDestinyCleared, cabRevealed } =
    useStoryFlags();

  /**
   * 车厢比镜头晚一步入场。
   *
   * 拖拽边界跟着 `cabRevealed` 立刻放开，镜头先滑向车头那片还空着的画布；
   * 底图等 `CAB_DRAW_DELAY_MS` 之后才挂上来抹开。顺序反过来的话，镜头
   * 到位时车厢早就画完了，「这道门是刚为你开的」就看不见了。
   */
  const [cabDrawn, setCabDrawn] = useState(false);

  useEffect(() => {
    if (!cabRevealed) {
      setCabDrawn(false);
      return;
    }
    const t = setTimeout(() => setCabDrawn(true), CAB_DRAW_DELAY_MS);
    return () => clearTimeout(t);
  }, [cabRevealed]);

  const segments = useMemo(() => visibleSegments(cabDrawn), [cabDrawn]);
  const connectors = useMemo(() => visibleConnectors(cabDrawn), [cabDrawn]);
  const rooms = useMemo(() => visibleRooms(cabDrawn), [cabDrawn]);
  const xBounds = useMemo(() => xBoundsForReveal(cabRevealed), [cabRevealed]);

  const destinyMarkers = useMemo(() => {
    const seed = layers.showDestiny ? [...DESTINY_MARKERS] : [];
    const seedIds = new Set(seed.map((m) => m.id));
    const list = [
      ...seed,
      ...spawnedDestinies.filter((m) => !seedIds.has(m.id)),
    ].filter((m) => {
      // 潜在命运退出后，地图入口消失；注定命运保留。
      if (m.kind === "potential" && isPotentialDestinyCleared(m.chatLocation)) {
        return false;
      }
      return true;
    });
    // 退出音乐会后：茶室以命运样式引出小提琴（且尚未走过该命运）。
    if (
      violinInTeaRoom &&
      !isPotentialDestinyCleared(TEA_ROOM_VIOLIN_LOCATION)
    ) {
      const violin = buildTeaRoomViolinMarker();
      if (!list.some((m) => m.id === violin.id)) list.push(violin);
    }
    return list;
  }, [
    layers.showDestiny,
    spawnedDestinies,
    violinInTeaRoom,
    isPotentialDestinyCleared,
  ]);

  const occupied = useMemo(
    () => destinyOccupiedMemberIds(destinyMarkers),
    [destinyMarkers],
  );

  return (
    <>
      <PannableMap
        imageWidth={TRAIN_CANVAS_W}
        imageHeight={TRAIN_CANVAS_H}
        initialFocusX={TRAIN_FOCUS_X}
        initialFocusY={TRAIN_FOCUS_Y}
        panScale={TRAIN_PAN_SCALE}
        focusXPct={focusRoom?.xPct ?? null}
        focusYPct={focusRoom?.yPct ?? null}
        focusRequestId={focusId}
        xBoundsPct={xBounds}
      >
        {/*
          底图按车厢分段横铺。单段时这就等于铺满整块画布，
          与分段之前的渲染完全一致；加一节只是多一个格子。
        */}
        {segments.map((seg) => (
          <div
            key={seg.id}
            className={
              seg.gated
                ? "absolute top-0 h-full motion-safe:animate-[livo-carriage-emerge_1100ms_cubic-bezier(0.22,1,0.36,1)_both]"
                : "absolute top-0 h-full"
            }
            style={{
              left: `${(seg.offsetX / TRAIN_CANVAS_W) * 100}%`,
              width: `${(seg.drawW / TRAIN_CANVAS_W) * 100}%`,
            }}
          >
            <Image
              src={seg.src}
              alt={`和平号${seg.name}内部平面图`}
              fill
              sizes="(max-width: 480px) 200vw, 1600px"
              className="select-none object-cover"
              /* 首屏落在主车厢；被 gate 的段揭开时才加载。 */
              priority={!seg.gated}
              draggable={false}
            />
          </div>
        ))}

        {/*
          车厢之间的折棚。留这道缝是为了让接缝看起来是「两节车」而不是
          「一张图没对齐」——顺便挡住两段底图边缘对不上的透视差。
        */}
        {connectors.map((c) => (
          <div
            key={c.id}
            aria-hidden
            className={`absolute top-0 h-full bg-[#0a0c0e] ${
              c.gatedSide
                ? "motion-safe:animate-[livo-carriage-emerge_1100ms_cubic-bezier(0.22,1,0.36,1)_both]"
                : ""
            }`}
            style={{
              left: `${c.leftPct * 100}%`,
              width: `${c.widthPct * 100}%`,
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,0.055) 0 1px, transparent 1px 8px)",
              boxShadow: "inset 0 0 22px 10px rgba(0,0,0,0.75)",
            }}
          />
        ))}

        {rooms.map((r) => (
          <RoomPill
            key={r.id}
            room={r}
            selected={selectedRoomId === r.id}
            onSelect={onSelectRoom}
          />
        ))}

        {layers.showEcho
          ? ECHO_MARKERS.map((m) => (
              <EchoMarker key={m.id} marker={m} onOpen={onOpenEchoMarker} />
            ))
          : null}

        {destinyMarkers.map((m) => (
          <DestinyMarker
            key={m.id}
            marker={m}
            onOpen={onOpenDestinyMarker}
          />
        ))}

        <WanderingCast occupiedMemberIds={occupied} />
      </PannableMap>

      <TrainFog />
      <TrainVignette />
    </>
  );
}
