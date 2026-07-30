/**
 * 从用户「回应这一刻」生成命运标记草稿。
 *
 * 规则（产品口径）：
 *   15s 冷却后 → 随机注定 / 潜在 → 位置随机 →
 *   故事由大模型根据发送内容生成（无 Key 时本地模板兜底）。
 * 标题绝不直接复用用户原文。
 */

import { buildCabDestinyImpact, isCabVoice } from "@/lib/tilia/cab-carriage";
import { TILIA_CAST, type CastMember } from "@/lib/tilia/cast";
import { groupSceneSrcForLocation } from "@/lib/tilia/chat-backgrounds";
import type {
  DestinyKind,
  DestinyMarkerDef,
} from "@/lib/tilia/destiny-markers";
import {
  buildConcertDestinyImpact,
  concertDestinySpeakers,
  isConcertRespondVoice,
  MUSIC_HALL_CONCERT_LOCATION,
} from "@/lib/tilia/music-hall-concert";
import { roomChatLocation } from "@/lib/tilia/room-group-chat";
import { isRoomGated, ROOMS, type Room } from "@/lib/tilia/train";
import { resolveSegmentPoint } from "@/lib/tilia/train-segments";

export type DestinyImpactDraft = {
  kind: DestinyKind;
  /** 地图胶囊短标题（不复用用户原文）。 */
  title: string;
  /** 半层大标题。 */
  storyTitle: string;
  /** 半层开场白。 */
  prologue: string;
  memberId: string;
  roomId: string;
  /** 地图落点（归一化，随机）。 */
  xPct: number;
  yPct: number;
  /** 可选：覆盖进聊 location（脚本命运用）。 */
  chatLocation?: string;
  /** 可选：脚本 id，供 API / UI 识别。 */
  scriptId?: string;
};

type ImpactTemplate = {
  keys: readonly string[];
  title: string;
  /** `${cast}` `${room}` `${voice}` `${kindLabel}` 可替换。 */
  prologue: string;
};

/**
 * 随机落点只用已经存在的车厢。被 gate 的车厢（如驾驶车厢）要留给
 * 脚本命运显式指定 —— 否则随机命运会落进一节还没被说出来的车厢里。
 */
const PUBLIC_ROOMS = ROOMS.filter((r) => r.tier === "public" && !isRoomGated(r));
const LEAD_IDS = TILIA_CAST.filter((c) => c.role === "lead").map((c) => c.id);

/** 车厢内可用落点范围（段内比例），避开贴边。 */
const MAP_X_MIN = 0.14;
const MAP_X_MAX = 0.86;
const MAP_Y_MIN = 0.16;
const MAP_Y_MAX = 0.82;

const IMPACT_TEMPLATES: readonly ImpactTemplate[] = [
  {
    keys: ["口琴", "一曲", "听"],
    title: "半拍未尽",
    prologue:
      "你「${voice}」之后，${cast}的口琴忽然多停了半拍。铜面上的雾气散开——那半拍若接上，曲调会往另一个方向走。这是一段${kindLabel}命运。",
  },
  {
    keys: ["剧场", "脚步", "放慢", "看戏"],
    title: "未完的一页",
    prologue:
      "你「${voice}」。${cast}把稿纸按得更紧。墨迹未干的那一页微微翘起——若你再走近一步，故事就会被递到你手里。${kindLabel}的轨迹正在成形。",
  },
  {
    keys: ["丝巾", "散庭", "系"],
    title: "系了又散",
    prologue:
      "你「${voice}」。${cast}的丝巾散开又系上，停在一个说不清的结。他抬眼看你，像在等一句不必说出口的话。",
  },
  {
    keys: ["任轻义", "口信", "酒", "斟"],
    title: "多摆的杯盏",
    prologue:
      "你「${voice}」。${cast}把本已收起的杯盏又摆了回去。座位空着，杯口却对着你常坐的那边。",
  },
  {
    keys: ["窗", "雪", "拍"],
    title: "霜上的指痕",
    prologue:
      "你「${voice}」。霜花上多出一行歪歪的指痕，像有人刚写完又后悔。${cast}在${room}附近停了一下，又像什么都没看见。",
  },
  {
    keys: ["试剂", "公式", "XK", "安全", "内衬"],
    title: "内衬的温度",
    prologue:
      "你「${voice}」。${cast}似乎察觉到你大衣内衬的异样——不是盘问，只是多看了一眼。和平号的廊道里，空气紧了一寸。",
  },
  {
    keys: ["乘务", "点头", "盘问"],
    title: "名单上的改动",
    prologue:
      "你「${voice}」。护送名单又被改了一处，墨水未干。${cast}把那一页折了角——折角朝向你。",
  },
  {
    keys: ["音乐厅", "余音", "琴"],
    title: "琴盖留缝",
    prologue:
      "你「${voice}」。三角钢琴自己响了半句。${cast}后来把琴盖合上，却留了一指宽的缝。",
  },
  {
    keys: ["透气", "廊道", "站了很久", "外套"],
    title: "廊灯多亮一档",
    prologue:
      "你「${voice}」。廊道的灯比平时亮了一档。${cast}的脚步停了停，又继续走了。",
  },
  {
    keys: ["万晁", "望", "回家"],
    title: "雪线退半寸",
    prologue:
      "你「${voice}」。窗外雪线仿佛退了半寸。${cast}很轻地说：到万晁时，会是百花开的季节吗。",
  },
  {
    keys: ["咖啡", "茶", "会客厅", "坐"],
    title: "多停的一盏",
    prologue:
      "你「${voice}」。蒸汽在杯沿绕了一圈，迟迟不散。${cast}把书合上，像在等你先开口。",
  },
];

const FALLBACK_POOL: readonly Omit<ImpactTemplate, "keys">[] = [
  {
    title: "未写定的站",
    prologue:
      "你「${voice}」。和平号像被这句话轻轻扳了一度轨——${cast}在${room}附近停下脚步，一段${kindLabel}命运正慢慢成形。",
  },
  {
    title: "余温未散",
    prologue:
      "你「${voice}」。那句话没有落地，却在车厢里留了余温。${cast}回头看了一眼，像听见了不该听见的动静。",
  },
  {
    title: "星轨偏了寸",
    prologue:
      "你「${voice}」。夜里的星轨仿佛偏了半寸。${cast}把话咽回去，又重新组织——下一次开口，会是另一段命运。",
  },
  {
    title: "灯下的空位",
    prologue:
      "你「${voice}」。${room}的灯下多出一个空位。${cast}没有坐上去，只是站在旁边，像在等你先决定。",
  },
  {
    title: "折起的名片",
    prologue:
      "你「${voice}」。矮几上多了一张折起的名片，没有署名——是有人趁没人时放下的。${cast}的指尖在边角停了一下，又收回去。",
  },
];

function rand(): number {
  return Math.random();
}

function pickRandomKind(): DestinyKind {
  return rand() < 0.5 ? "destined" : "potential";
}

/**
 * 在这个房间所在的那一节车厢内随机取点。限定在段内是为了不让命运
 * 落进车厢之间的连接处，或者飘到一节完全无关的车厢上去。
 */
function pickRandomPoint(room: Room): { xPct: number; yPct: number } {
  return resolveSegmentPoint({
    segment: room.segment,
    xPct: MAP_X_MIN + rand() * (MAP_X_MAX - MAP_X_MIN),
    yPct: MAP_Y_MIN + rand() * (MAP_Y_MAX - MAP_Y_MIN),
  });
}

function pickRandomMember(occupied: ReadonlySet<string>): CastMember {
  const free = LEAD_IDS.filter((id) => !occupied.has(id));
  const pool = free.length ? free : LEAD_IDS;
  const id = pool[Math.floor(rand() * pool.length)] ?? "staen";
  return TILIA_CAST.find((c) => c.id === id) ?? TILIA_CAST[1]!;
}

function pickRandomRoom(): Room {
  return (
    PUBLIC_ROOMS[Math.floor(rand() * PUBLIC_ROOMS.length)] ?? ROOMS[0]!
  );
}

function kindLabel(kind: DestinyKind): string {
  return kind === "destined" ? "注定" : "潜在";
}

function storyTitleFor(kind: DestinyKind, title: string): string {
  const prefix = kind === "destined" ? "注定" : "潜在";
  return `${prefix}·${title}`;
}

function fillPrologue(
  tpl: string,
  voice: string,
  castName: string,
  roomName: string,
  kind: DestinyKind,
): string {
  const clipped =
    voice.trim().length > 24 ? `${voice.trim().slice(0, 24)}…` : voice.trim();
  return tpl
    .replaceAll("${voice}", clipped)
    .replaceAll("${cast}", castName)
    .replaceAll("${room}", roomName)
    .replaceAll("${kindLabel}", kindLabel(kind));
}

function hashText(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 本地兜底：随机 kind + 随机落点 + 随机角色/房间；
 * 文案用模板推演（标题不复用原文）。
 */
export function generateDestinyImpactLocal(
  voiceText: string,
  occupiedMemberIds: ReadonlySet<string>,
): DestinyImpactDraft {
  const voice = voiceText.trim();

  // 预置「听音乐会」桥段：固定音乐厅注定命运 + 专属群聊脚本。
  if (isConcertRespondVoice(voice)) {
    return buildConcertDestinyImpact();
  }

  // 预置「车头」桥段：那道锁着的折棚门为你开了，地图补上驾驶车厢。
  if (isCabVoice(voice)) {
    return buildCabDestinyImpact();
  }

  const kind = pickRandomKind();
  const cast = pickRandomMember(occupiedMemberIds);
  const room = pickRandomRoom();
  const point = pickRandomPoint(room);

  const matched = IMPACT_TEMPLATES.find((t) =>
    t.keys.some((k) => voice.includes(k)),
  );
  const fb =
    FALLBACK_POOL[hashText(voice + kind) % FALLBACK_POOL.length] ??
    FALLBACK_POOL[0]!;
  const tpl = matched ?? fb;

  return {
    kind,
    title: tpl.title,
    storyTitle: storyTitleFor(kind, tpl.title),
    prologue: fillPrologue(tpl.prologue, voice, cast.name, room.name, kind),
    memberId: cast.id,
    roomId: room.id,
    xPct: point.xPct,
    yPct: point.yPct,
  };
}

/** 把影响草稿落成地图命运标记（位置用草稿里的随机坐标）。 */
export function impactToDestinyMarker(
  impact: DestinyImpactDraft,
): DestinyMarkerDef {
  const room = ROOMS.find((r) => r.id === impact.roomId) ?? ROOMS[0]!;
  const stamp = Date.now().toString(36);
  const isConcert = impact.scriptId === "music-hall-concert";

  return {
    id: `destiny-voice-${stamp}`,
    kind: impact.kind,
    title: impact.title,
    storyTitle: impact.storyTitle,
    prologue: impact.prologue,
    xPct: impact.xPct,
    yPct: impact.yPct,
    speakers: isConcert
      ? concertDestinySpeakers()
      : [{ kind: "you" }, { kind: "cast", memberId: impact.memberId }],
    roomId: room.id,
    sceneSrc: isConcert
      ? groupSceneSrcForLocation(MUSIC_HALL_CONCERT_LOCATION)
      : undefined,
    chatLocation:
      impact.chatLocation ?? roomChatLocation(room),
  };
}

export function buildPotentialDestinyFromVoice(
  voiceText: string,
  occupiedMemberIds: ReadonlySet<string>,
): DestinyMarkerDef {
  return impactToDestinyMarker(
    generateDestinyImpactLocal(voiceText, occupiedMemberIds),
  );
}
