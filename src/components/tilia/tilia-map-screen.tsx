"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CastPanel } from "@/components/tilia/cast-panel";
import { DestinyEnterSheet } from "@/components/tilia/destiny-enter-sheet";
import { DestinySheet } from "@/components/tilia/destiny-sheet";
import { EchoFieldScreen } from "@/components/tilia/echo-field-screen";
import { EchoSheet } from "@/components/tilia/echo-sheet";
import { RespondDeliverOverlay } from "@/components/tilia/respond-deliver-overlay";
import { RespondOverlay } from "@/components/tilia/respond-overlay";
import {
  TiliaBottomNav,
  type TiliaTab,
} from "@/components/tilia/tilia-bottom-nav";
import { TiliaTopBar } from "@/components/tilia/tilia-top-bar";
import { TrainMapScreen } from "@/components/tilia/train-map-screen";
import { WorldFeedCard } from "@/components/tilia/world-feed-card";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";
import { WorldSwitcherSheet } from "@/components/worlds/world-switcher-sheet";
import {
  DESTINY_MARKERS,
  destinyOccupiedMemberIds,
  type DestinyMarkerDef,
} from "@/lib/tilia/destiny-markers";
import { ECHO_ARCHIVE, LOOSE_EVENTS } from "@/lib/tilia/echo-archive";
import type { EchoMarkerDef } from "@/lib/tilia/echo-markers";
import { SEED_ECHO_STORIES, type EchoStory } from "@/lib/tilia/echo-story";
import {
  impactToDestinyMarker,
  type DestinyImpactDraft,
} from "@/lib/tilia/destiny-from-voice";
import {
  RESPOND_COOLDOWN_MS,
  voiceToFeedItem,
} from "@/lib/tilia/respond";
import { roomChatHref } from "@/lib/tilia/room-group-chat";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import {
  buildOneWeekLaterMarkers,
  ONE_WEEK_MARKER_ID_PREFIX,
} from "@/lib/tilia/one-week-later";
import {
  buildCabConductorMarker,
  CAB_MARKER_ID,
  CAB_REVEAL_FEED_TEXT,
  CAB_SCRIPT_ID,
} from "@/lib/tilia/cab-carriage";
import { ROOM_BY_ID, type Room } from "@/lib/tilia/train";
import type { FeedItem } from "@/lib/tilia/world-feed";

/**
 * 全屏星图的内容：档案里的旧回响 + 今天还挂在地图上的种子，时间正序，
 * 越新越靠下。散件（还没汇聚成回响的事件）由 `LOOSE_EVENTS` 单独给，它们
 * 不属于任何一枚回响。常量提到模块层，免得每次渲染都重排星图。
 */
const ECHO_FIELD_STORIES = [...ECHO_ARCHIVE, ...SEED_ECHO_STORIES];

/**
 * 《蒂利亚之冬》世界地图页 —— 设计稿 `3378:4318`「深色-潜在的命运」。
 *
 * 点房间坐标 → 直接进该地点群聊；命运标记仍走命运进入半层。
 */
export function TiliaMapScreen() {
  const navigate = useTransitionNavigate();
  const {
    resetConcertDestinyCycle,
    weekLaterArrived,
    worldClock,
    cabRevealed,
    revealCabCarriage,
  } = useStoryFlags();
  const [focusRoom, setFocusRoom] = useState<Room | null>(null);
  const [focusId, setFocusId] = useState(0);

  const [castOpen, setCastOpen] = useState(false);
  const [destinyOpen, setDestinyOpen] = useState(false);
  const [enterDestiny, setEnterDestiny] = useState<DestinyMarkerDef | null>(
    null,
  );
  const [activeEcho, setActiveEcho] = useState<EchoStory | null>(null);
  const [echoFieldOpen, setEchoFieldOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tab, setTab] = useState<TiliaTab>("map");

  const [respondOpen, setRespondOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState(0);
  const [spawnedDestinies, setSpawnedDestinies] = useState<DestinyMarkerDef[]>(
    [],
  );
  const [voiceItem, setVoiceItem] = useState<FeedItem | null>(null);
  /** 冷却结束后要落下的用户原话（仅作生成输入，不作标题）。 */
  const pendingVoiceRef = useRef<string | null>(null);
  /** 酝酿期间异步生成的影响事件；冷却结束时优先用它。 */
  const pendingImpactRef = useRef<DestinyImpactDraft | null>(null);

  const echoById = useMemo(() => {
    const map = new Map<string, EchoStory>();
    for (const s of SEED_ECHO_STORIES) map.set(s.id, s);
    return map;
  }, []);

  const focusOnRoom = useCallback((room: Room) => {
    setFocusRoom(room);
    setFocusId((n) => n + 1);
  }, []);

  const selectRoom = useCallback(
    (room: Room) => {
      focusOnRoom(room);
      // 点房间坐标 → 直接进该地点群聊。
      navigate(roomChatHref(room));
    },
    [focusOnRoom, navigate],
  );

  /** 命运半层里点一条命运：把地图移到它发生的房间。世界动态卡不再走这条。 */
  const pickFeedItem = useCallback(
    (item: FeedItem) => {
      const room = item.roomId ? ROOM_BY_ID[item.roomId] : null;
      if (!room) return;
      setDestinyOpen(false);
      setEnterDestiny(null);
      setActiveEcho(null);
      focusOnRoom(room);
    },
    [focusOnRoom],
  );

  const openDestinyMarker = useCallback(
    (marker: DestinyMarkerDef) => {
      const room = marker.roomId ? ROOM_BY_ID[marker.roomId] : null;
      if (room) focusOnRoom(room);
      setDestinyOpen(false);
      setActiveEcho(null);
      setEnterDestiny(marker);
    },
    [focusOnRoom],
  );

  /** Demo 系统菜单切到「一周后」时落下三枚潜在命运；切回则撤掉。 */
  useEffect(() => {
    if (weekLaterArrived) {
      const markers = buildOneWeekLaterMarkers();
      const markerIds = new Set(markers.map((m) => m.id));
      setSpawnedDestinies((prev) => [
        ...prev.filter((m) => !markerIds.has(m.id)),
        ...markers,
      ]);
      setVoiceItem({
        id: `one-week-${Date.now()}`,
        kind: "objective",
        speakers: [{ kind: "world" }],
        text: "第十日薄雾 · 列车进入例行安检区段",
        roomId: "dining",
      });
      const dining = ROOM_BY_ID.dining;
      if (dining) focusOnRoom(dining);
      return;
    }
    setSpawnedDestinies((prev) =>
      prev.filter((m) => !m.id.startsWith(ONE_WEEK_MARKER_ID_PREFIX)),
    );
  }, [weekLaterArrived, focusOnRoom]);

  /**
   * 驾驶车厢开放后：落下列车长那枚命运，播一条世界动态，镜头推到车头。
   * 收回时连带撤掉命运。
   *
   * 无论是「回应这一刻」说到车头触发，还是演示菜单直接切，都走这一条
   * 路径 —— 触发侧只负责翻 `cabRevealed`。
   */
  useEffect(() => {
    if (!cabRevealed) {
      setSpawnedDestinies((prev) => prev.filter((m) => m.id !== CAB_MARKER_ID));
      return;
    }

    const marker = buildCabConductorMarker();
    setSpawnedDestinies((prev) => [
      ...prev.filter((m) => m.id !== marker.id),
      marker,
    ]);
    setVoiceItem({
      id: `cab-reveal-${Date.now()}`,
      kind: "objective",
      speakers: [{ kind: "world" }],
      text: CAB_REVEAL_FEED_TEXT,
      roomId: "cab-driver",
    });
    // 镜头先走（车厢底图会晚 420ms 才抹开，见 TrainMapScreen）。
    // 留一帧余量：从命运聊天退回来时地图刚挂载，要等取景过渡就绪。
    const t = setTimeout(
      () =>
        focusOnRoom({
          id: `focus-${marker.id}`,
          name: marker.title,
          xPct: marker.xPct,
          yPct: marker.yPct,
          tier: "public",
          blurb: marker.prologue,
        }),
      120,
    );
    return () => clearTimeout(t);
  }, [cabRevealed, focusOnRoom]);

  const openEchoMarker = useCallback(
    (marker: EchoMarkerDef) => {
      const room = marker.roomId ? ROOM_BY_ID[marker.roomId] : null;
      if (room) focusOnRoom(room);
      setDestinyOpen(false);
      setEnterDestiny(null);
      setActiveEcho(echoById.get(marker.storyId) ?? null);
    },
    [echoById, focusOnRoom],
  );

  const handleRespondSend = useCallback((text: string) => {
    setRespondOpen(false);
    setVoiceItem(voiceToFeedItem(text));
    pendingVoiceRef.current = text;
    pendingImpactRef.current = null;
    setDeliverOpen(true);

    // 送达转场期间就开始酝酿标题，冷却结束时尽量已就绪。
    const occupied = [
      ...destinyOccupiedMemberIds(DESTINY_MARKERS),
      ...spawnedDestinies.flatMap((m) =>
        m.speakers
          .filter((s): s is { kind: "cast"; memberId: string } => s.kind === "cast")
          .map((s) => s.memberId),
      ),
    ];
    void fetch("/api/tilia/destiny-from-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceText: text,
        occupiedMemberIds: occupied,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as DestinyImpactDraft;
        if (pendingVoiceRef.current === text && data.title) {
          pendingImpactRef.current = data;
        }
      })
      .catch(() => {
        /* 冷却结束时会再走本地兜底 */
      });
  }, [spawnedDestinies]);

  const handleDeliverDone = useCallback(() => {
    setDeliverOpen(false);
    setCooldownUntil(Date.now() + RESPOND_COOLDOWN_MS);
  }, []);

  // 冷却倒计时 tick；归零后落下「推演后的」潜在命运（新标题，非原文）。
  useEffect(() => {
    if (cooldownUntil == null) {
      setCooldownRemainingSec(0);
      return;
    }

    const tick = () => {
      const leftMs = cooldownUntil - Date.now();
      if (leftMs <= 0) {
        setCooldownUntil(null);
        setCooldownRemainingSec(0);
        const voice = pendingVoiceRef.current;
        pendingVoiceRef.current = null;
        if (!voice) return;

        const spawn = (impact: DestinyImpactDraft) => {
          // 车头桥段：不落普通标记，翻旗标让地图自己长出那一节车厢，
          // 命运与镜头由 cabRevealed 的副作用统一处理。
          if (impact.scriptId === CAB_SCRIPT_ID) {
            revealCabCarriage();
            return;
          }

          const marker = impactToDestinyMarker(impact);
          // 新一轮音乐会命运：先清掉小提琴，等退出音乐会后再出现。
          if (impact.scriptId === "music-hall-concert") {
            resetConcertDestinyCycle();
          }
          setSpawnedDestinies((prev) => [...prev, marker]);
          // 镜头对准随机落点（不必回到房间中心）。
          const base = marker.roomId ? ROOM_BY_ID[marker.roomId] : null;
          requestAnimationFrame(() =>
            focusOnRoom({
              id: base?.id ?? `focus-${marker.id}`,
              name: base?.name ?? marker.title,
              xPct: marker.xPct,
              yPct: marker.yPct,
              tier: base?.tier ?? "public",
              blurb: base?.blurb ?? "",
            }),
          );
        };

        const ready = pendingImpactRef.current;
        pendingImpactRef.current = null;
        if (ready) {
          spawn(ready);
          return;
        }

        // 异步未完成：同步再请求一次 / 本地兜底。
        void fetch("/api/tilia/destiny-from-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceText: voice }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error("api");
            return (await res.json()) as DestinyImpactDraft;
          })
          .then(spawn)
          .catch(async () => {
            const { generateDestinyImpactLocal } = await import(
              "@/lib/tilia/destiny-from-voice"
            );
            const occupied = destinyOccupiedMemberIds([
              ...DESTINY_MARKERS,
              ...spawnedDestinies,
            ]);
            spawn(generateDestinyImpactLocal(voice, occupied));
          });
        return;
      }
      setCooldownRemainingSec(Math.ceil(leftMs / 1000));
    };

    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [
    cooldownUntil,
    focusOnRoom,
    spawnedDestinies,
    resetConcertDestinyCycle,
    revealCabCarriage,
  ]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <TrainMapScreen
        selectedRoomId={focusRoom?.id ?? null}
        focusRoom={focusRoom}
        focusId={focusId}
        onSelectRoom={selectRoom}
        onOpenDestinyMarker={openDestinyMarker}
        onOpenEchoMarker={openEchoMarker}
        spawnedDestinies={spawnedDestinies}
      />

      <TiliaTopBar onOpenProfile={() => setCastOpen(true)} />

      <WorldFeedCard
        onOpenDestiny={() => setDestinyOpen(true)}
        onOpenRespond={() => setRespondOpen(true)}
        onOpenEchoes={() => setEchoFieldOpen(true)}
        cooldownRemainingSec={cooldownRemainingSec}
        voiceItem={voiceItem}
        clock={worldClock}
      />

      <TiliaBottomNav
        active={tab}
        onSelect={setTab}
        onOpenWorldSwitcher={() => setSwitcherOpen(true)}
      />

      <DestinySheet
        open={destinyOpen}
        onClose={() => setDestinyOpen(false)}
        onPickItem={pickFeedItem}
      />

      <DestinyEnterSheet
        marker={enterDestiny}
        onClose={() => setEnterDestiny(null)}
      />

      <EchoSheet story={activeEcho} onClose={() => setActiveEcho(null)} />

      {/* 历史回响的全屏星图，入口是动态卡表头那枚呼吸指示 */}
      <EchoFieldScreen
        open={echoFieldOpen}
        stories={ECHO_FIELD_STORIES}
        loose={LOOSE_EVENTS}
        onClose={() => setEchoFieldOpen(false)}
      />

      <CastPanel open={castOpen} onClose={() => setCastOpen(false)} />

      <WorldSwitcherSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      <RespondOverlay
        open={respondOpen}
        onClose={() => setRespondOpen(false)}
        onSend={handleRespondSend}
      />

      <RespondDeliverOverlay open={deliverOpen} onDone={handleDeliverDone} />
    </div>
  );
}
