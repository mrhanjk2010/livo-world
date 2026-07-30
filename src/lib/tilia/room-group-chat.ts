/**
 * 基于车厢地点的群聊 —— 点地图房间坐标直接进入。
 *
 * location key：`room:<roomId>`，与命运专属地点（会客厅/剧场/瑰室）分开，
 * 避免和命运单聊抢同一路由。
 */

import { CAST_BY_ID } from "@/lib/tilia/cast";
import { groupSceneSrcForRoom } from "@/lib/tilia/chat-backgrounds";
import type { DestinyChatScene } from "@/lib/tilia/destiny-chat";
import {
  ROOM_BY_ID,
  STATIONS_BY_ROOM,
  type PinArt,
  type Room,
} from "@/lib/tilia/train";

const ART_SRC: Record<PinArt, string> = {
  "char-a": "/figma/tilia/avatar-char-a.png",
  "char-b": "/figma/tilia/avatar-char-b.png",
  renqingyi: "/figma/tilia/avatar-renqingyi.png",
  santing: "/figma/tilia/avatar-santing.png",
  you: "/figma/tilia/avatar-you-art.png",
};

const ROOM_PREFIX = "room:";

export function roomChatLocation(room: Room): string {
  return `${ROOM_PREFIX}${room.id}`;
}

export function roomChatHref(room: Room): string {
  return `/chat/${encodeURIComponent(roomChatLocation(room))}`;
}

export function parseRoomChatId(location: string): string | null {
  if (!location.startsWith(ROOM_PREFIX)) return null;
  return location.slice(ROOM_PREFIX.length);
}

export function isRoomGroupChatLocation(location: string): boolean {
  const id = parseRoomChatId(location);
  return !!id && !!ROOM_BY_ID[id];
}

/** 从房间站位拼一局地点群聊场景。 */
export function buildRoomGroupChatScene(location: string): DestinyChatScene | null {
  const roomId = parseRoomChatId(location);
  if (!roomId) return null;
  const room = ROOM_BY_ID[roomId];
  if (!room) return null;

  const stations = STATIONS_BY_ROOM[room.id] ?? [];
  const members: {
    name: string;
    tag?: string;
    avatarSrc: string | null;
    avatarColor?: string;
  }[] = [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: "/figma/tilia/avatar-you-art.png",
      avatarColor: "#8b7aff",
    },
  ];

  for (const s of stations) {
    if (s.memberId === "heroine") continue;
    const cast = CAST_BY_ID[s.memberId];
    members.push({
      name: cast?.name ?? s.memberId,
      avatarSrc: ART_SRC[s.art] ?? null,
      avatarColor: cast?.accent,
    });
  }

  // 无人无人时仍给群聊气氛：加一位乘务 NPC。
  if (members.length <= 1) {
    members.push({
      name: "乘务员",
      tag: "(NPC)",
      avatarSrc: null,
      avatarColor: "#5a6a7a",
    });
  }

  const presentNames = members
    .filter((m) => m.name !== "你")
    .map((m) => m.name)
    .slice(0, 3);
  const who =
    presentNames.length > 0
      ? presentNames.join("、")
      : "列车上的人";

  const firstCast = stations.find((s) => s.memberId !== "heroine");
  const behavior = firstCast?.behaviors[0];
  const castName = firstCast
    ? CAST_BY_ID[firstCast.memberId]?.name ?? "有人"
    : "乘务员";

  return {
    location,
    variant: "group",
    title: room.name,
    venue: `和平号·${room.name}`,
    backgroundSrc: groupSceneSrcForRoom(room.id),
    inputPlaceholder: `在${room.name}说点什么`,
    members,
    beats: [
      {
        id: "p1",
        kind: "prologue",
        title: room.name,
        body: room.blurb,
      },
      { id: "t1", kind: "time", text: "此刻" },
      {
        id: "s1",
        kind: "system",
        text: `你进入了${room.name}`,
      },
      {
        id: "n1",
        kind: "narration",
        text:
          room.tier === "public"
            ? `${room.name}里人声不密，却也并不空。${who}在附近。`
            : `${room.name}门一掩，外面的廊道声就远了。${who}似乎也在这里。`,
      },
      {
        id: "b1",
        kind: "bubble",
        speaker: castName,
        avatarSrc: firstCast ? ART_SRC[firstCast.art] : null,
        avatarColor: firstCast
          ? CAST_BY_ID[firstCast.memberId]?.accent
          : "#5a6a7a",
        lines: [
          {
            tone: "narration",
            text: behavior
              ? `他正${behavior}，抬眼看见你。`
              : "对方抬眼看见你，点了点头。",
          },
          {
            tone: "dialogue",
            text:
              room.tier === "public"
                ? "「也来这儿坐坐？刚好有空位。」"
                : "「门没锁。既然来了，就进来吧。」",
          },
        ],
      },
    ],
  };
}
