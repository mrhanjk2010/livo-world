/**
 * 命运聊天（单聊 / 群聊）—— 对齐 Figma
 *   单聊 `5668:70557`「注定的命运-单条」
 *   群聊 `5668:70165`「世界-群聊」
 *
 * 与校园 `ChatScreen` 视觉体系不同：全屏背景 + 磨砂叙事卡，
 * 由命运进入半层跳进本页。
 */

import {
  CAB_CONDUCTOR_LOCATION,
  CAB_CONDUCTOR_SCENE,
} from "@/lib/tilia/cab-carriage";
import {
  MUSIC_HALL_CONCERT_LOCATION,
  MUSIC_HALL_CONCERT_SCENE,
  TEA_ROOM_VIOLIN_LOCATION,
  TEA_ROOM_VIOLIN_SCENE,
} from "@/lib/tilia/music-hall-concert";
import {
  PATROL_INSPECTION_LOCATION,
  PATROL_INSPECTION_SCENE,
  ONE_WEEK_LEDGER_LOCATION,
  ONE_WEEK_LEDGER_SCENE,
  ONE_WEEK_WHISPER_LOCATION,
  ONE_WEEK_WHISPER_SCENE,
} from "@/lib/tilia/one-week-later";
import {
  groupSceneSrcForLocation,
  soloPortraitSrc,
} from "@/lib/tilia/chat-backgrounds";

export type DestinyChatVariant = "solo" | "group";

export type DestinyChatLine = {
  tone: "narration" | "dialogue";
  text: string;
};

export type DestinyChatBeat =
  | {
      id: string;
      kind: "prologue";
      title: string;
      body: string;
    }
  | {
      id: string;
      kind: "narration";
      text: string;
    }
  | {
      id: string;
      kind: "system";
      text: string;
    }
  | {
      id: string;
      kind: "time";
      text: string;
    }
  /**
   * 事后回指：命运落地后，回望它是从哪几步长出来的。
   * 只在果已经产生时出现，绝不提前预告（否则命运降级成任务链）。
   */
  | {
      id: string;
      kind: "trace";
      title: string;
      items: readonly { when: string; text: string }[];
    }
  | {
      id: string;
      kind: "bubble";
      speaker: string;
      avatarSrc: string | null;
      avatarColor?: string;
      lines: readonly DestinyChatLine[];
    };

export type DestinyChatScene = {
  location: string;
  variant: DestinyChatVariant;
  /** 命运类型：影响群聊蝴蝶色等。默认 destined。 */
  destinyKind?: "destined" | "potential";
  /** 顶栏主名：单聊=角色名，群聊=地点名。 */
  title: string;
  /** 单聊副标，如「灵魂图谱」。 */
  subtitle?: string;
  /** 地点胶囊文案。 */
  venue: string;
  /**
   * 全屏背景。
   * 单聊：角色立绘；群聊：地点场景图（见 `chat-backgrounds`）。
   */
  backgroundSrc: string;
  /** 单聊头像（顶栏）。 */
  leadAvatarSrc?: string | null;
  /** 群聊在场成员 pill。 */
  members?: readonly {
    name: string;
    tag?: string;
    avatarSrc: string | null;
    avatarColor?: string;
  }[];
  /** 输入框占位。 */
  inputPlaceholder: string;
  /** 情绪胶囊（单聊）。 */
  moodLabel?: string;
  /**
   * 脚本逐条揭开（一条一条出，像正在发生），而不是进来就铺满一屏。
   * 揭开期间输入框上锁。有剧情的桥段都该开；地点闲聊不需要。
   */
  sequential?: boolean;
  beats: readonly DestinyChatBeat[];
};

const TILIA_CHAT: Record<string, DestinyChatScene> = {
  会客厅: {
    location: "会客厅",
    variant: "solo",
    title: "施塔恩",
    subtitle: "灵魂图谱",
    venue: "和平号·会客厅",
    backgroundSrc: soloPortraitSrc("staen"),
    leadAvatarSrc: "/figma/tilia/avatar-char-a.png",
    inputPlaceholder: "和施塔恩继续这一曲",
    moodLabel: "平静",
    beats: [
      {
        id: "p1",
        kind: "prologue",
        title: "口琴一曲",
        body: "会客厅的灯压得很低。鹿头标本下，铜面口琴在他指间转了一圈。窗外的雪压着窗框，这一曲像只为你而起。",
      },
      {
        id: "b1",
        kind: "bubble",
        speaker: "施塔恩",
        avatarSrc: "/figma/tilia/avatar-char-a.png",
        lines: [
          {
            tone: "narration",
            text: "他抬眼看你，把口琴搁在膝上，声音比曲调更轻。",
          },
          {
            tone: "dialogue",
            text: "「先听半首。剩下的，看你还坐不坐得住。」",
          },
          {
            tone: "narration",
            text: "他微微侧头，嘴角挂着一丝若有若无的笑，像在等你应一声。",
          },
        ],
      },
    ],
  },

  剧场: {
    location: "剧场",
    variant: "solo",
    title: "罗兰",
    subtitle: "灵魂图谱",
    venue: "和平号·剧场",
    backgroundSrc: soloPortraitSrc("roland"),
    leadAvatarSrc: "/figma/tilia/avatar-char-b.png",
    inputPlaceholder: "和罗兰继续这一页",
    moodLabel: "平静",
    beats: [
      {
        id: "p1",
        kind: "prologue",
        title: "未完的一页",
        body: "剧场最后一排空着。罗兰把新写的一页按在膝上，墨迹还没干。若这一页递出去，故事就会往另一个方向走。",
      },
      {
        id: "b1",
        kind: "bubble",
        speaker: "罗兰",
        avatarSrc: "/figma/tilia/avatar-char-b.png",
        lines: [
          {
            tone: "narration",
            text: "走廊外的灯光从上方倾斜洒下，地面上投射出两道影子。他将手臂弯曲，另一只手随意理了理被风吹乱的头发。",
          },
          {
            tone: "dialogue",
            text: "「你收着这个。下次想来，不用等我失眠才能碰上。」",
          },
          {
            tone: "narration",
            text: "他微微侧头，嘴角挂着一丝神秘的微笑，似乎在期待着你的确认。",
          },
        ],
      },
    ],
  },

  瑰室: {
    location: "瑰室",
    variant: "group",
    title: "瑰室",
    venue: "和平号·瑰室",
    backgroundSrc: groupSceneSrcForLocation("瑰室"),
    inputPlaceholder: "在瑰室继续命运",
    members: [
      {
        name: "你",
        tag: "(你)",
        avatarSrc: "/figma/tilia/avatar-you-art.png",
        avatarColor: "#8b7aff",
      },
      {
        name: "任轻义",
        avatarSrc: "/figma/tilia/avatar-renqingyi.png",
      },
      {
        name: "乘务长",
        tag: "(NPC)",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
      },
      {
        name: "巡警",
        tag: "(NPC)",
        avatarSrc: null,
        avatarColor: "#4a5a6a",
      },
    ],
    beats: [
      {
        id: "p1",
        kind: "prologue",
        title: "归乡·雪夜苍翠",
        body: "这是那场大战结束后的第271天。战火在南方边境缓缓熄灭，世界被「和平」粉饰，暗流却无声翻涌。你带着各城邦觊觎的试剂 XK-101，踏上回万晁的「和平号」列车。",
      },
      { id: "t1", kind: "time", text: "23:59" },
      { id: "s1", kind: "system", text: "你进入了注定的命运「归乡·雪夜苍翠」" },
      {
        id: "n1",
        kind: "narration",
        text: "包厢的门被推开，室外的凉意跟着进来。乘务长收起名册，目光在屋里缓缓转了一圈。",
      },
      {
        id: "b1",
        kind: "bubble",
        speaker: "乘务长",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
        lines: [
          { tone: "narration", text: "他慢慢转过身，把名册合上。" },
          {
            tone: "dialogue",
            text: "「包厢已清过一遍。试剂箱请放在视线内。」",
          },
        ],
      },
      {
        id: "b2",
        kind: "bubble",
        speaker: "巡警",
        avatarSrc: null,
        avatarColor: "#4a5a6a",
        lines: [
          {
            tone: "dialogue",
            text: "「开箱检查是例行。请配合。」",
          },
        ],
      },
      {
        id: "b3",
        kind: "bubble",
        speaker: "任轻义",
        avatarSrc: "/figma/tilia/avatar-renqingyi.png",
        lines: [
          {
            tone: "narration",
            text: "他重新靠回椅背，声音不重，却把空气压住了一寸。",
          },
          {
            tone: "dialogue",
            text: "「她刚上车。规矩可以讲，不必这么硬。」",
          },
        ],
      },
    ],
  },

  [MUSIC_HALL_CONCERT_LOCATION]: MUSIC_HALL_CONCERT_SCENE,
  [TEA_ROOM_VIOLIN_LOCATION]: TEA_ROOM_VIOLIN_SCENE,
  [PATROL_INSPECTION_LOCATION]: PATROL_INSPECTION_SCENE,
  [ONE_WEEK_WHISPER_LOCATION]: ONE_WEEK_WHISPER_SCENE,
  [ONE_WEEK_LEDGER_LOCATION]: ONE_WEEK_LEDGER_SCENE,
  [CAB_CONDUCTOR_LOCATION]: CAB_CONDUCTOR_SCENE,
};

/** 全部脚本命运的 location key。静态导出要靠它枚举聊天页。 */
export const DESTINY_CHAT_LOCATIONS: readonly string[] = Object.keys(TILIA_CHAT);

export function isDestinyChatLocation(location: string): boolean {
  return location in TILIA_CHAT;
}

export function getDestinyChatScene(location: string): DestinyChatScene | null {
  return TILIA_CHAT[location] ?? null;
}
