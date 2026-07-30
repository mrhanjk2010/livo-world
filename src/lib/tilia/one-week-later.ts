/**
 * 「一周后」时间节点 —— 获得小提琴后解锁。
 *
 * 跳到一周后，地图落下三枚潜在命运，其中一枚是「巡警检查」：
 * 你把 XK-101 藏进琴箱，惊险躲过开箱。
 */

import type { DestinyChatScene } from "@/lib/tilia/destiny-chat";
import type { DestinyMarkerDef } from "@/lib/tilia/destiny-markers";
import { groupSceneSrcForLocation } from "@/lib/tilia/chat-backgrounds";
import type { WorldClock } from "@/lib/tilia/world-feed";
import { nearRoom } from "@/lib/tilia/train";

export const PATROL_INSPECTION_LOCATION = "餐车·巡警检查";
export const ONE_WEEK_WHISPER_LOCATION = "观景廊·风声";
export const ONE_WEEK_LEDGER_LOCATION = "乘务室·名单";

/** 一周后落下的命运标记 id 前缀，便于地图增删。 */
export const ONE_WEEK_MARKER_ID_PREFIX = "destiny-week-";

const AVATAR = {
  you: "/figma/tilia/avatar-you-art.png",
  renqingyi: "/figma/tilia/avatar-renqingyi.png",
  staen: "/figma/tilia/avatar-char-a.png",
  santing: "/figma/tilia/avatar-santing.png",
} as const;

/** 跳到一周后的世界时钟。 */
export const ONE_WEEK_LATER_CLOCK: WorldClock = {
  time: "06:18",
  weather: "薄雾",
  day: 10,
  leg: "维萨发车后第十日 · 即将进入例行安检区段",
};

/** 一周后地图上的三枚潜在命运。 */
export function buildOneWeekLaterMarkers(): DestinyMarkerDef[] {
  return [
    {
      id: "destiny-week-patrol",
      kind: "potential",
      title: "巡警检查",
      storyTitle: "潜在·巡警检查",
      prologue:
        "餐车被临时改成检查点。巡警把名册拍在长桌上，目光扫过每一件随身物——包括你怀里那把刚得到不久的小提琴。",
      ...nearRoom("dining", -0.02, -0.06),
      speakers: [
        { kind: "you" },
        { kind: "npc", name: "巡警" },
        { kind: "cast", memberId: "renqingyi" },
      ],
      roomId: "dining",
      sceneSrc: "/figma/tilia/destiny-chat/prop-violin.png",
      chatLocation: PATROL_INSPECTION_LOCATION,
    },
    {
      id: "destiny-week-whisper",
      kind: "potential",
      title: "风声",
      storyTitle: "潜在·廊道风声",
      prologue:
        "观景廊的窗缝里灌进雪粒。有人压低声音说：安检名单上，多了一行不该出现的字。",
      ...nearRoom("promenade", 0.04, -0.02),
      speakers: [
        { kind: "you" },
        { kind: "cast", memberId: "santing" },
      ],
      roomId: "promenade",
      chatLocation: ONE_WEEK_WHISPER_LOCATION,
    },
    {
      id: "destiny-week-ledger",
      kind: "potential",
      title: "名单",
      storyTitle: "潜在·改动的名单",
      prologue:
        "乘务室灯一夜没灭。护送名单被改了两处，墨水未干——其中一处，指向你常坐的那侧。",
      ...nearRoom("crew", -0.03, -0.05),
      speakers: [
        { kind: "you" },
        { kind: "cast", memberId: "staen" },
      ],
      roomId: "crew",
      chatLocation: ONE_WEEK_LEDGER_LOCATION,
    },
  ];
}

/** 巡警检查群聊：琴箱藏试剂，惊险过关（潜在 · 可切换场景）。 */
export const PATROL_INSPECTION_SCENE: DestinyChatScene = {
  location: PATROL_INSPECTION_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "餐车",
  venue: "和平号·餐车·临时检查点",
  backgroundSrc: groupSceneSrcForLocation(PATROL_INSPECTION_LOCATION),
  inputPlaceholder: "稳住呼吸，或者说点什么",
  sequential: true,
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    {
      name: "巡警",
      tag: "(NPC)",
      avatarSrc: null,
      avatarColor: "#4a5a6a",
    },
    { name: "任轻义", avatarSrc: AVATAR.renqingyi },
    { name: "施塔恩", avatarSrc: AVATAR.staen },
  ],
  beats: [
    {
      id: "pp1",
      kind: "prologue",
      title: "巡警检查",
      body: "第十日清晨。餐车长桌被推到一侧，临时立起检查牌。你怀里的小提琴盒边缘还温着——昨夜你把 XK-101 的管壳，塞进了琴马下方那寸刚好够用的空隙。巡警已在过道尽头翻手套。",
    },
    { id: "pt1", kind: "time", text: "06:22" },
    {
      id: "ps1",
      kind: "system",
      text: "你进入了潜在的命运「巡警检查」",
    },
    {
      id: "pn1",
      kind: "narration",
      text: "队伍挪得很慢。巡警的手套沾着一点霜，每打开一件行李，空气就紧一寸。",
    },
    {
      id: "pb1",
      kind: "bubble",
      speaker: "巡警",
      avatarSrc: null,
      avatarColor: "#4a5a6a",
      lines: [
        {
          tone: "narration",
          text: "他合上一只皮箱，目光落到你手臂弯里的琴盒。",
        },
        {
          tone: "dialogue",
          text: "「琴。打开。」",
        },
      ],
    },
    {
      id: "pb2",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "narration",
          text: "他站在你侧后方半步，声音闲，像在劝一杯不必要的酒。",
        },
        {
          tone: "dialogue",
          text: "「例行就例行。别把姑娘的琴当军械库。」",
        },
      ],
    },
    {
      id: "pb3",
      kind: "bubble",
      speaker: "巡警",
      avatarSrc: null,
      avatarColor: "#4a5a6a",
      lines: [
        {
          tone: "dialogue",
          text: "「名册上写的是随身物全检。请配合。」",
        },
      ],
    },
    {
      id: "pn2",
      kind: "narration",
      text: "你把琴盒放上检查桌。锁扣轻响。琴身在灯下露出一圈淡金——试剂就在琴马阴影里，隔着薄绒，像什么都没有。",
    },
    {
      id: "pb4",
      kind: "bubble",
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "dialogue",
          text: "「弦松了半音。别硬扳琴马。」",
        },
      ],
    },
    {
      id: "pn2b",
      kind: "narration",
      text: "他的指节敲了敲琴腹。你几乎以为下一秒会听到空腔里那一点金属轻响——没有。绒布吃掉了所有声息。",
    },
    {
      id: "pb5",
      kind: "bubble",
      speaker: "巡警",
      avatarSrc: null,
      avatarColor: "#4a5a6a",
      lines: [
        {
          tone: "narration",
          text: "戴着手套的指尖在琴马阴影边沿停了一停，又移开。目光扫过弓毛、松香、空弦。",
        },
        {
          tone: "dialogue",
          text: "「……乐器。通过。」",
        },
      ],
    },
    {
      id: "pn3",
      kind: "narration",
      text: "盒盖合上的瞬间，你听见自己的脉搏。XK-101 还在原处——这次，琴替你挡了一刀。",
    },
    {
      id: "ps2",
      kind: "system",
      text: "你借助小提琴躲过了检查",
    },
    {
      id: "ptr1",
      kind: "trace",
      title: "这把琴的来处",
      items: [
        {
          when: "一周前 11:35",
          text: "你在世界里说起：想去音乐厅听一场音乐会。",
        },
        {
          when: "一周前 23:17",
          text: "音乐厅夜场。灯暗下来的时候，你提起了从前那把琴。",
        },
        {
          when: "一周前 23:41",
          text: "茶室矮柜旁，施塔恩把琴放进你怀里——他说，琴要有人抱着才不哑。",
        },
      ],
    },
    {
      id: "pn4",
      kind: "narration",
      text: "那句话是随口说的。一周后它变成了你手里唯一挡得住这场检查的东西。",
    },
    {
      id: "pb6",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "dialogue",
          text: "「走吧。下一站之前，别再让人看见你手心出汗。」",
        },
      ],
    },

    /* ── 尾声：琴不是长久之计，你把对车头的好奇说出了口 ──
     * 任轻义答应替你往车头递句话 —— 退出这段命运时那道折棚门就开了，
     * 驾驶车厢向你开放（见 story-flags-context）。
     */
    {
      id: "pn5",
      kind: "narration",
      text: "队伍散了。你抱着琴盒往车尾走，走到第三扇窗前停住——刚才那一寸空隙，靠的是绒布和运气。下一次开箱，不会再有绒布。",
    },
    {
      id: "pb7",
      kind: "bubble",
      speaker: "你",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
      lines: [
        {
          tone: "narration",
          text: "你压低声音，问得像在打听天气。",
        },
        {
          tone: "dialogue",
          text: "「这趟车的车头是什么样的？驾驶室……他们查吗？」",
        },
      ],
    },
    {
      id: "pb8",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "narration",
          text: "他把手套往上拉了半寸，像是把「车头」这两个字在嘴里过了一遍才还给你。",
        },
        {
          tone: "dialogue",
          text: "「车头？编制表上这趟车只有一节车厢——所以巡警从来不往前查。那道折棚门锁着，钥匙在列车长手里。」",
        },
      ],
    },
    {
      id: "pb9",
      kind: "bubble",
      speaker: "任轻义",
      avatarSrc: AVATAR.renqingyi,
      lines: [
        {
          tone: "narration",
          text: "他走了两步又停下，没回头。",
        },
        {
          tone: "dialogue",
          text: "「你别自己往前走。我替你递句话上去——他愿不愿意开门，是他的事。」",
        },
      ],
    },
    {
      id: "pn6",
      kind: "narration",
      text: "他说完就走了。你站在原地，把那个念头想完整：如果 XK-101 不在琴里，而在一个巡警连账面上都翻不到的地方——",
    },
    {
      id: "ps3",
      kind: "system",
      text: "你托任轻义往车头递了一句话",
    },
  ],
};

/** 观景廊「风声」简短群聊。 */
export const ONE_WEEK_WHISPER_SCENE: DestinyChatScene = {
  location: ONE_WEEK_WHISPER_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "观景廊",
  venue: "和平号·观景廊",
  backgroundSrc: groupSceneSrcForLocation(ONE_WEEK_WHISPER_LOCATION),
  inputPlaceholder: "听听风里的话",
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    { name: "散庭·姚", avatarSrc: AVATAR.santing },
  ],
  beats: [
    {
      id: "wp1",
      kind: "prologue",
      title: "廊道风声",
      body: "窗缝灌进细雪。散庭站在你惯常停靠的那扇窗边，丝巾被风掀起一角。",
    },
    { id: "wt1", kind: "time", text: "06:40" },
    {
      id: "ws1",
      kind: "system",
      text: "你进入了潜在的命运「廊道风声」",
    },
    {
      id: "wb1",
      kind: "bubble",
      speaker: "散庭·姚",
      avatarSrc: AVATAR.santing,
      lines: [
        {
          tone: "dialogue",
          text: "「他们在查的不只是行李。……你怀里那把琴，别离手。」",
        },
      ],
    },
  ],
};

/** 乘务室「名单」简短群聊。 */
export const ONE_WEEK_LEDGER_SCENE: DestinyChatScene = {
  location: ONE_WEEK_LEDGER_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "乘务室",
  venue: "和平号·乘务室",
  backgroundSrc: groupSceneSrcForLocation(ONE_WEEK_LEDGER_LOCATION),
  inputPlaceholder: "看看改过的名单",
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    { name: "施塔恩", avatarSrc: AVATAR.staen },
  ],
  beats: [
    {
      id: "lp1",
      kind: "prologue",
      title: "改动的名单",
      body: "乘务室台灯压得很低。施塔恩把名册翻到折角那一页，墨迹还新。",
    },
    { id: "lt1", kind: "time", text: "07:05" },
    {
      id: "ls1",
      kind: "system",
      text: "你进入了潜在的命运「改动的名单」",
    },
    {
      id: "lb1",
      kind: "bubble",
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "dialogue",
          text: "「两处改动。一处指向你。另一处……我抹掉了。」",
        },
      ],
    },
  ],
};
