"use client";

import Image from "next/image";
import { ActivitySheet } from "@/components/map/activity-sheet";
import { ActivitySheetProvider } from "@/components/map/activity-sheet-context";
import { EventSheet } from "@/components/map/event-sheet";
import { EventSheetProvider } from "@/components/map/event-sheet-context";
import {
  FriendsStatusProvider,
  type FriendStatus,
} from "@/components/map/friends-status-context";
import {
  MapFocusProvider,
  useMapFocus,
} from "@/components/map/map-focus-context";
import { MapTopNav } from "@/components/map/map-top-nav";
import { PannableMap } from "@/components/map/pannable-map";
import { POIPin } from "@/components/map/poi-pin";
import { TrajectoryOverlay } from "@/components/map/trajectory-overlay";
import { TrajectoryProvider } from "@/components/map/trajectory-context";
import {
  WanderingFriends,
  type FriendDef,
  type POIRef,
} from "@/components/map/wandering-friends";
import {
  WorldBroadcast,
  type BroadcastItem,
} from "@/components/map/world-broadcast";

const MAP_NATIVE_W = 1006;
const MAP_NATIVE_H = 1024;
/**
 * Up-scale applied to the rendered map (PannableMap.panScale). >1 makes
 * the map overflow the phone frame on BOTH axes so the drag gesture
 * works horizontally AND vertically. 1.4 keeps the artwork legible
 * (POI chips and avatars stay roughly the same on-screen size as
 * before) while exposing ~40% extra travel on each axis.
 */
const MAP_PAN_SCALE = 1.4;

/**
 * POIs and friends were authored in Figma's 750×1624 frame, with the map
 * positioned at x=-78 spanning width 906. All elements in a friend cluster
 * (speech chip · avatar · arrow · POI label) share the SAME horizontal
 * centerline in Figma, so we compute center X in map-image space and let
 * each component anchor itself via translateX(-50%).
 */
const FIGMA_MAP_OFFSET_X = -78;
const FIGMA_MAP_W = 906;
const FIGMA_MAP_H = 1624;

/**
 * When a friend is "standing at" a POI, their avatar sits this many Figma
 * units above the POI chip's top edge. With the current map render scale
 * (panScale 1.4 × ~812-tall frame ÷ FIGMA_MAP_H 1624 ≈ 0.7 device px per
 * Figma unit) the cluster is 51 device px tall (avatar 40 + arrow gap 3 +
 * arrow 8), so 90 Figma units ≈ 63 device px puts the down-arrow's bottom
 * exactly 12 device px above the POI label's top — the spec gap requested
 * on 2026-04-27.
 */
const AVATAR_STAND_OFFSET_FIGMA = 90;

const centerXPct = (figmaCenterX: number) =>
  (figmaCenterX - FIGMA_MAP_OFFSET_X) / FIGMA_MAP_W;
const topYPct = (figmaTopY: number) => figmaTopY / FIGMA_MAP_H;

/**
 * Figma coords: centerX is the horizontal center of the POI chip; topY its top edge.
 * Daily-event badges are drawn once per page load — `EventSheetProvider`
 * takes the POI label list below and randomly selects which ones get
 * a live event. Badges stay visible until the user commits via the
 * sheet's "进入事件" CTA (or until the page is refreshed).
 */
const POIS = [
  { centerX: 52 + 54, topY: 294, label: "操场" },
  { centerX: 538 + 64, topY: 494, label: "图书馆" },
  { centerX: 230 + 64, topY: 486, label: "体育馆" },
  { centerX: 556 + 54, topY: 738, label: "食堂" },
  { centerX: 158 + 54, topY: 891, label: "后山" },
  { centerX: 543 + 54, topY: 1130, label: "教室" },
  { centerX: 72 + 74, topY: 1240, label: "学校大门" },
] as const;

/** Precomputed POI refs (centerX + standing-Y) passed down to WanderingFriends. */
const POI_REFS: readonly POIRef[] = POIS.map((p) => ({
  label: p.label,
  centerXPct: centerXPct(p.centerX),
  standYPct: topYPct(p.topY - AVATAR_STAND_OFFSET_FIGMA),
}));

/** Pure label list handed to EventSheetProvider for its random draw. */
const POI_LABELS: readonly string[] = POIS.map((p) => p.label);

/**
 * label → map-image-space x percentage (0..1). Handed to
 * `MapFocusProvider` so `focusOn(label)` can resolve a broadcast
 * target to the exact column the camera should center on.
 */
const POI_X_PCT: Readonly<Record<string, number>> = Object.fromEntries(
  POIS.map((p) => [p.label, centerXPct(p.centerX)]),
);

const FRIENDS: readonly FriendDef[] = [
  {
    name: "夏季",
    avatarSrc: "/figma/map/avatar-xiaji.png",
    startPoi: "教室",
    behaviors: {
      教室: "正在教室打扫卫生",
      食堂: "在食堂帮同学占位子",
      操场: "陪朋友跑圈",
      学校大门: "在校门口等晚归的同学",
    },
    wanderings: [
      "🎵 哼着小曲儿慢慢走",
      "🤔 下午去哪里好呢",
      "路上遇到了一只流浪猫",
      "内心OS: 今天天气真舒服",
    ],
    moods: ["😊", "🌸", "🎵", "✨", "💪"],
  },
  {
    name: "周往",
    avatarSrc: "/figma/map/avatar-zhouwang.png",
    startPoi: "后山",
    behaviors: {
      后山: "正在给流浪猫投喂粮食",
      体育馆: "约了人打篮球",
      操场: "在绕着操场跑圈",
      学校大门: "在门口的小摊买水",
    },
    wanderings: [
      "在去看流浪猫的路上",
      "内心OS: 今天好像少带了猫粮",
      "🐾 脚边窜过一只橘猫",
      "🎧 听着歌慢慢走",
    ],
    moods: ["🐾", "😺", "🎧", "⚽", "🤔"],
  },
  {
    name: "钟辰时",
    avatarSrc: "/figma/map/avatar-zhongchen.jpg",
    startPoi: "图书馆",
    behaviors: {
      图书馆: "🤔终于有一道有挑战性的题了",
      教室: "在教室自习",
      食堂: "快速吃完准备回图书馆",
    },
    wanderings: [
      "去图书馆的路上还在想公式",
      "内心OS: 这题肯定能解",
      "📖 手里拿着一本新借的书",
      "路上被几个同学叫住打招呼",
    ],
    moods: ["🤔", "📖", "💡", "🧠", "✨"],
  },
  {
    name: "叶恒",
    avatarSrc: "/figma/map/avatar-yeheng.png",
    startPoi: "操场",
    behaviors: {
      图书馆: "🤔还是一如既往的学霸",
      教室: "正在讲台上给同学讲题",
      操场: "在操场上散步放松",
      学校大门: "在等朋友一起回家",
    },
    wanderings: [
      "路上回味着刚做过的题",
      "内心OS: 这道题好像还有别的解法",
      "📚 怀里抱着几本参考书",
      "🌿 走过一片绿荫",
    ],
    moods: ["😌", "📚", "🌿", "🤓", "☕"],
  },
];

/**
 * Initial roster snapshot — seeded from each friend's `startPoi` so the
 * top-nav panel renders correct data on first paint, before the rAF
 * loop has had a chance to publish a real snapshot.
 */
const INITIAL_STATUS: readonly FriendStatus[] = FRIENDS.map((f) => ({
  name: f.name,
  avatarSrc: f.avatarSrc,
  location: f.startPoi,
  chatLocation: f.startPoi,
  action: f.behaviors[f.startPoi] ?? "",
  mood: f.moods[0] ?? "🙂",
}));

/**
 * Transient world-broadcast feed. Mixes world-level and character-level
 * events; one new pill slides in every ~2.8s, up to 3 visible at once.
 * Tapping any pill opens the 动态 half-sheet at the 全世界 subject (see
 * `WorldBroadcast`).
 *
 * Each `body` is a hand-tightened summary, typically 3–9 user-perceived
 * characters with deliberate length variety so the rotation has its own
 * rhythm (a 3-char "下雨了" feels distinctly different from a 9-char
 * "台风掀翻了一棵老树"). The JS hard-cap in `world-broadcast.tsx`
 * (PILL_BODY_MAX = 10) is the safety net only — copy authors should aim
 * to express the gist in <=10 chars instead of relying on that cut.
 */
const BROADCASTS: readonly BroadcastItem[] = [
  {
    id: "world-rain",
    kind: "world",
    title: "世界动态",
    body: "下雨了",
    location: "操场",
  },
  {
    id: "zhouwang-cat",
    kind: "person",
    title: "周往",
    body: "在喂流浪猫",
    avatarSrc: "/figma/map/avatar-zhouwang.png",
    location: "后山",
  },
  {
    id: "world-broadcast",
    kind: "world",
    title: "世界动态",
    body: "广播站开播了",
    location: "学校大门",
  },
  {
    id: "zhongchen-math",
    kind: "person",
    title: "钟辰时",
    body: "🤔碰到难题了",
    avatarSrc: "/figma/map/avatar-zhongchen.jpg",
    location: "图书馆",
  },
  {
    id: "yeheng-stroll",
    kind: "person",
    title: "叶恒",
    body: "在操场上散步",
    avatarSrc: "/figma/map/avatar-yeheng.png",
    location: "操场",
  },
  {
    id: "xiaji-music",
    kind: "person",
    title: "夏季",
    body: "🎵哼着小曲走",
    avatarSrc: "/figma/map/avatar-xiaji.png",
    location: "教室",
  },
  {
    id: "world-typhoon",
    kind: "world",
    title: "世界动态",
    body: "台风掀翻了一棵老树",
    location: "后山",
  },
];

export function MapScreen() {
  return (
    <FriendsStatusProvider initial={INITIAL_STATUS}>
      <ActivitySheetProvider>
        <TrajectoryProvider>
          <EventSheetProvider locations={POI_LABELS}>
            <MapFocusProvider poiXPct={POI_X_PCT}>
              <MapScreenInner />
            </MapFocusProvider>
          </EventSheetProvider>
        </TrajectoryProvider>
      </ActivitySheetProvider>
    </FriendsStatusProvider>
  );
}

/**
 * Inner renderer split out so it can read `useMapFocus()` — the
 * `PannableMap` below needs `focusXPct` + `focusRequestId` props
 * to react to broadcast-driven camera moves, and those values come
 * from the surrounding `MapFocusProvider`.
 */
function MapScreenInner() {
  const { focusXPct, focusRequestId, commitPulse } = useMapFocus();
  return (
    <>
      {/* 1. Pannable map layer (fills phone vertically, may overflow horizontally). */}
      <PannableMap
        imageWidth={MAP_NATIVE_W}
        imageHeight={MAP_NATIVE_H}
        initialFocusX={0.5}
        initialFocusY={0.5}
        panScale={MAP_PAN_SCALE}
        focusXPct={focusXPct}
        focusRequestId={focusRequestId}
        onFocusEnd={commitPulse}
      >
        <Image
          src="/figma/map/map-bg.png"
          alt="DOLO 的世界地图"
          fill
          sizes="(min-width: 768px) 950px, 200vw"
          priority
          className="object-cover"
          draggable={false}
        />

        {/* POI labels are anchored — they never move. */}
        {POIS.map(({ centerX, topY, label }) => (
          <POIPin
            key={label}
            xPct={centerXPct(centerX)}
            yPct={topYPct(topY)}
            label={label}
          />
        ))}

        {/* Friends drift between POIs, pause 10s on arrival, and rotate speech lines. */}
        <WanderingFriends friends={FRIENDS} pois={POI_REFS} />
      </PannableMap>

      {/* 2. Fixed UI overlays — sit above the pannable map and ignore drags. */}
      <MapTopNav />

      {/* 3. World-broadcast feed — two rotating pills + one persistent
           "世界动态 >" entry at the bottom (Figma 2026-04-24 iteration).
           The stage sits flush above the nav (~88px from phone bottom)
           and aligns with the nav's outer 18px padding. Width is capped
           so long copy truncates with ellipsis instead of pushing past
           the nav icons. z-index stays BELOW the nav (z-10 vs. nav's
           z-30) so entering pills are fully concealed behind the nav
           until they slide out above its top edge.
           Tapping a rotating pill pans the map to the event's POI and
           plays a bounce on that chip; tapping the fixed entry opens
           the 动态 half-sheet at the 全世界 subject — hence this has
           to live inside both ActivitySheetProvider AND MapFocusProvider. */}
      <div className="pointer-events-none absolute bottom-[88px] left-[18px] z-10 w-[calc(100%-36px)] max-w-[224px]">
        <WorldBroadcast items={BROADCASTS} />
      </div>

      {/* 4. 角色/全世界 动态 half-sheet — opened by the friends panel's
           calendar buttons and the map action bubble's "TA的动态" row. */}
      <ActivitySheet />

      {/* 5. 日常事件 half-sheet — opened by tapping a POI pin (or its
           heart badge) while a daily event is live at that location. */}
      <EventSheet />

      {/* 6. 活动轨迹 full-screen overlay — opened from the activity
           sheet's "活动轨迹" pill. Shows the selected subject's
           last-24h path across the campus with a draggable scrubber. */}
      <TrajectoryOverlay />
    </>
  );
}
