/**
 * 「听音乐会」脚本命运 —— 回应预置短语触发。
 *
 * 流程：发送 → 15s → 音乐厅潜在命运 → 全主角群聊 →
 * 退出该命运后，茶室再落下小提琴潜在命运。
 */

import type { DestinyChatScene } from "@/lib/tilia/destiny-chat";
import type { DestinyImpactDraft } from "@/lib/tilia/destiny-from-voice";
import type { DestinyMarkerDef } from "@/lib/tilia/destiny-markers";
import { groupSceneSrcForLocation } from "@/lib/tilia/chat-backgrounds";
import { nearRoom } from "@/lib/tilia/train";

/** 命运聊天 location key（与 room:music-hall 普通地点群聊分开）。 */
export const MUSIC_HALL_CONCERT_LOCATION = "音乐厅·夜场";

/** 回应遮罩里固定出现的预置短语。 */
export const CONCERT_RESPOND_PHRASE = "想去音乐厅听一场音乐会";

const CONCERT_VOICE_KEYS = [
  "音乐会",
  "音乐厅听",
  "听一场",
  "听音乐会",
  CONCERT_RESPOND_PHRASE,
] as const;

export function isConcertRespondVoice(voiceText: string): boolean {
  const v = voiceText.trim();
  return CONCERT_VOICE_KEYS.some((k) => v.includes(k));
}

/** 输入建议：引导玩家提到小提琴。 */
export const CONCERT_SUGGESTED_REPLIES = [
  "其实我以前也拉小提琴",
  "琴声好像从茶室那边漏过来一点",
] as const;

export function mentionsViolin(text: string): boolean {
  return /小提琴|拉琴|拉过琴|练琴/.test(text);
}

export function buildConcertDestinyImpact(): DestinyImpactDraft {
  return {
    kind: "potential",
    title: "夜场余音",
    storyTitle: "潜在·夜场余音",
    prologue:
      "三角钢琴自己响了半句。音乐厅的灯没有全亮，却把四位主角都留在了地毯上。你若走进去，这场夜场就不会只是路过——它会把一条线，轻轻拽向茶室那扇没有编号的门。",
    memberId: "staen",
    roomId: "music-hall",
    ...nearRoom("music-hall"),
    chatLocation: MUSIC_HALL_CONCERT_LOCATION,
    scriptId: "music-hall-concert",
  };
}

export function concertDestinySpeakers(): DestinyMarkerDef["speakers"] {
  return [
    { kind: "you" },
    { kind: "cast", memberId: "renqingyi" },
    { kind: "cast", memberId: "staen" },
    { kind: "cast", memberId: "roland" },
    { kind: "cast", memberId: "santing" },
  ];
}

/**
 * 夜场结束后茶室落下的潜在命运：命运光环样式，内圆为小提琴。
 * 不占用男主站位，避免从地图上抽走角色。
 */
export const TEA_ROOM_VIOLIN_LOCATION = "茶室·矮柜旁的琴";

export function buildTeaRoomViolinMarker(): DestinyMarkerDef {
  return {
    id: "destiny-tea-violin",
    kind: "potential",
    title: "小提琴",
    storyTitle: "潜在·矮柜旁的琴",
    prologue:
      "茶室矮柜旁多了一把小提琴。琴弦还带着一点温热，像刚从音乐厅夜场被悄悄挪过来。门上没有编号——但这把琴，像在等一只熟悉的手。",
    // 略偏茶室名牌上方，避开底部「世界动态」卡片遮挡。
    ...nearRoom("tea-room", 0.04, -0.08),
    // 小提琴标记只展示物件，不占用男主站位（避免漫游层剧烈重建拖死页面）。
    speakers: [{ kind: "you" }],
    roomId: "tea-room",
    sceneSrc: "/figma/tilia/destiny-chat/prop-violin.png",
    chatLocation: TEA_ROOM_VIOLIN_LOCATION,
  };
}

const AVATAR = {
  you: "/figma/tilia/avatar-you-art.png",
  renqingyi: "/figma/tilia/avatar-renqingyi.png",
  staen: "/figma/tilia/avatar-char-a.png",
  roland: "/figma/tilia/avatar-char-b.png",
  santing: "/figma/tilia/avatar-santing.png",
} as const;

/** 音乐厅夜场群聊场景：全主角 + 新背景（潜在命运 · 蓝蝶）。 */
export const MUSIC_HALL_CONCERT_SCENE: DestinyChatScene = {
  location: MUSIC_HALL_CONCERT_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "音乐厅",
  venue: "和平号·音乐厅·夜场",
  backgroundSrc: groupSceneSrcForLocation(MUSIC_HALL_CONCERT_LOCATION),
  inputPlaceholder: "说点什么…也可以提起从前的琴",
  sequential: true,
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    { name: "任轻义", avatarSrc: AVATAR.renqingyi },
    { name: "施塔恩", avatarSrc: AVATAR.staen },
    { name: "罗兰", avatarSrc: AVATAR.roland },
    { name: "散庭·姚", avatarSrc: AVATAR.santing },
  ],
  beats: [
    {
      id: "p1",
      kind: "prologue",
      title: "夜场余音",
      body: "灯只开了半排。三角钢琴的盖子没合严，像留着一口气。任轻义靠在柱边，施塔恩坐在琴凳侧，罗兰把稿纸压在膝上，散庭的丝巾在暗处轻轻晃。他们都在等——等这一场不在节目单上的夜场。",
    },
    { id: "t1", kind: "time", text: "23:17" },
    {
      id: "s1",
      kind: "system",
      text: "你进入了潜在的命运「夜场余音」",
    },
    {
      id: "n1",
      kind: "narration",
      text: "你推门进来时，钢琴正好停在一个未解决的和弦上。雪光从高窗斜进来，落在红地毯上。",
    },
    {
      id: "b1",
      kind: "bubble",
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "narration",
          text: "他没有回头，指尖在琴键上空停了一拍。",
        },
        {
          tone: "dialogue",
          text: "「来得巧。再晚半分钟，这句就散了。」",
        },
      ],
    },
    {
      id: "b2",
      kind: "bubble",
      speaker: "罗兰",
      avatarSrc: AVATAR.roland,
      lines: [
        {
          tone: "dialogue",
          text: "「夜场不售票。但听众如果会乐器——故事会好听一点。」",
        },
      ],
    },
    {
      id: "b3",
      kind: "bubble",
      speaker: "散庭·姚",
      avatarSrc: AVATAR.santing,
      lines: [
        {
          tone: "narration",
          text: "他用完好的那只手把丝巾又绕紧半分。",
        },
        {
          tone: "dialogue",
          text: "「……你以前，会不会也碰过琴。」",
        },
      ],
    },
    {
      id: "b4",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "dialogue",
          text: "「别逼人家交代履历。不过——茶室矮柜旁好像多了把东西。谁放的，我不问。」",
        },
      ],
    },
    {
      id: "n2",
      kind: "narration",
      text: "空气里有一点松香味。像有人刚调过弦，又把琴悄悄挪走了。",
    },
  ],
};

/** 玩家提到小提琴后的接话。 */
export function buildViolinReplyBeats(stamp: number) {
  return [
    {
      id: `vn-${stamp}`,
      kind: "narration" as const,
      text: "四个人的目光同时偏了一寸。钢琴盖轻轻响了一声，像在应你。",
    },
    {
      id: `vb1-${stamp}`,
      kind: "bubble" as const,
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "dialogue" as const,
          text: "「小提琴。那就对上了。」",
        },
      ],
    },
    {
      id: `vb2-${stamp}`,
      kind: "bubble" as const,
      speaker: "罗兰",
      avatarSrc: AVATAR.roland,
      lines: [
        {
          tone: "dialogue" as const,
          text: "「我在茶室看见一把。弦还热着。像是专门留给会拉的人。」",
        },
      ],
    },
    {
      id: `vb3-${stamp}`,
      kind: "bubble" as const,
      speaker: "散庭·姚",
      avatarSrc: AVATAR.santing,
      lines: [
        {
          tone: "dialogue" as const,
          text: "「……你要是去，我陪你。不远。」",
        },
      ],
    },
    {
      id: `vb4-${stamp}`,
      kind: "bubble" as const,
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "dialogue" as const,
          text: "「去吧。夜场散了，真正的曲子往往在旁边那间没有编号的门后。」",
        },
      ],
    },
    {
      id: `vs-${stamp}`,
      kind: "system" as const,
      text: "茶室似乎多了一件不属于时刻表的东西",
    },
  ];
}

/** 茶室小提琴命运：把琴送到你手里的桥段（潜在 · 蓝蝶）。 */
export const TEA_ROOM_VIOLIN_SCENE: DestinyChatScene = {
  location: TEA_ROOM_VIOLIN_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "茶室",
  venue: "和平号·茶室",
  backgroundSrc: groupSceneSrcForLocation(TEA_ROOM_VIOLIN_LOCATION),
  inputPlaceholder: "接过琴，或者说点什么",
  sequential: true,
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    { name: "施塔恩", avatarSrc: AVATAR.staen },
    { name: "散庭·姚", avatarSrc: AVATAR.santing },
    { name: "任轻义", avatarSrc: AVATAR.renqingyi },
    { name: "罗兰", avatarSrc: AVATAR.roland },
  ],
  beats: [
    {
      id: "vp1",
      kind: "prologue",
      title: "矮柜旁的琴",
      body: "没有编号的门后，茶烟很淡。矮柜旁那把小提琴靠着木纹，琴弓横在盒盖上——像有人特意摆成「请你来拿」的姿势。",
    },
    { id: "vt1", kind: "time", text: "23:41" },
    {
      id: "vs1",
      kind: "system",
      text: "你进入了潜在的命运「矮柜旁的琴」",
    },
    {
      id: "vn1",
      kind: "narration",
      text: "你刚踏进来，四个人的目光就落到你身上。施塔恩已经站在矮柜前，指尖没有碰到琴弦，只是停在琴颈上方。",
    },
    {
      id: "vb1",
      kind: "bubble",
      speaker: "散庭·姚",
      avatarSrc: AVATAR.santing,
      lines: [
        {
          tone: "narration",
          text: "他用完好的那只手把丝巾又绕紧半分，声音比夜场时轻。",
        },
        {
          tone: "dialogue",
          text: "「你来了。……我就知道你会来。」",
        },
      ],
    },
    {
      id: "vb2",
      kind: "bubble",
      speaker: "罗兰",
      avatarSrc: AVATAR.roland,
      lines: [
        {
          tone: "dialogue",
          text: "「别紧张。这不是盘问，是交接。」",
        },
      ],
    },
    {
      id: "vb3",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "narration",
          text: "他靠在窗框上，像在看一场不必入账的交易。",
        },
        {
          tone: "dialogue",
          text: "「账本上没有这一笔。你收下，就当夜场的余音没散干净。」",
        },
      ],
    },
    {
      id: "vn2",
      kind: "narration",
      text: "施塔恩把小提琴从矮柜旁托起，琴身在茶室的暖灯下亮了一瞬。他没有立刻递出，先把弓也一并收进你够得到的距离。",
    },
    {
      id: "vb4",
      kind: "bubble",
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "narration",
          text: "他抬眼看你，声音压得很稳，像在下达一条不必写进军令的指令。",
        },
        {
          tone: "dialogue",
          text: "「你说以前也拉。那就别只是『以前』。」",
        },
        {
          tone: "dialogue",
          text: "「这把琴留给你会拉的人。现在——送给你。」",
        },
      ],
    },
    {
      id: "vb5",
      kind: "bubble",
      speaker: "散庭·姚",
      avatarSrc: AVATAR.santing,
      lines: [
        {
          tone: "dialogue",
          text: "「……接住。别让它再靠在没人的矮柜旁。」",
        },
      ],
    },
    {
      id: "vn3",
      kind: "narration",
      text: "琴盒的重量落到你手里时，弦上还留着一点松香的温热。门外廊道的灯亮了一档，又暗回去——像这一声交接，只发生在茶室里。",
    },
    {
      id: "vs2",
      kind: "system",
      text: "你得到了小提琴",
    },
    {
      id: "vb6",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "dialogue",
          text: "「拿到手就算数。下一站之前，随便你拉给谁听——或者谁都不听。」",
        },
      ],
    },
  ],
};
