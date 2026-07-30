/**
 * Daily-event metadata per POI.
 *
 * When a POI pin is pulsing (see `useDailyEventSchedule` in poi-pin.tsx)
 * tapping either the pill or the heart badge opens the event half-sheet
 * — this module is the single source of truth for what that sheet
 * shows: cover title, one-line tagline, hero paragraph, participants,
 * and the venue label rendered under the "☀️日常事件" tag.
 *
 * Scene visuals (gradient, members) are reused from `chat-scenes.ts`
 * so a POI's event card looks and feels like the chat it funnels into.
 */

export type MapEventParticipant = {
  /** Display name shown under the avatar. */
  name: string;
  /** Bitmap avatar. `null` renders a colored circle with `fallbackColor`. */
  avatarSrc: string | null;
  /** Fallback color when `avatarSrc` is null (mirrors chat-scenes pattern). */
  fallbackColor?: string;
};

export type MapEvent = {
  /** POI label — matches `location` in chat-scenes. */
  location: string;
  /** Big title, e.g. "食堂的傍晚". */
  title: string;
  /** School-qualified location shown inside the 📍 pill under the title. */
  venue: string;
  /** Hero paragraph, ~1–2 lines long. */
  description: string;
  /** Participants shown as an avatar row above the CTA. */
  participants: readonly MapEventParticipant[];
};

const SELF_PARTICIPANT: MapEventParticipant = {
  name: "陈昔(你)",
  avatarSrc: null,
  fallbackColor: "#8b7aff",
};

const AVATARS = {
  zhouwang: "/figma/map/avatar-zhouwang.png",
  zhongchen: "/figma/map/avatar-zhongchen.jpg",
  yeheng: "/figma/map/avatar-yeheng.png",
  xiaji: "/figma/map/avatar-xiaji.png",
} as const;

/**
 * Canonical school name used across every venue pill — keeps the
 * "南一高中 · {POI}" branding consistent without repeating it per row.
 * 蒂利亚命运地点用「和平号」前缀，避免串成校园。
 */
const SCHOOL = "南一高中";
const TILIA_TRAIN = "和平号";

const TILIA_LOCATIONS = new Set(["会客厅", "剧场", "瑰室"]);

const EVENTS: Record<string, Omit<MapEvent, "venue">> = {
  会客厅: {
    location: "会客厅",
    title: "归乡·口琴一曲",
    description:
      "会客厅的灯压得很低。施塔恩坐在鹿头标本下，铜面口琴在指间转了一圈——像在等你先开口。",
    participants: [
      { name: "施塔恩", avatarSrc: "/figma/tilia/avatar-char-a.png" },
      SELF_PARTICIPANT,
    ],
  },
  瑰室: {
    location: "瑰室",
    title: "归乡·雪夜苍翠",
    description:
      "大战结束后的第271天。你带着试剂 XK-101 踏上和平号，任轻义、乘务长与巡警都在这间暖厢里。",
    participants: [
      { name: "任轻义", avatarSrc: "/figma/tilia/avatar-renqingyi.png" },
      { name: "乘务长", avatarSrc: null, fallbackColor: "#5a6a7a" },
      { name: "巡警", avatarSrc: null, fallbackColor: "#4a5a6a" },
      SELF_PARTICIPANT,
    ],
  },
  食堂: {
    location: "食堂",
    title: "食堂的傍晚",
    description:
      "晚饭时间到了，食堂里弥漫着饭菜的香气。钟辰时和夏季恰好坐在同一张桌上。",
    participants: [
      { name: "钟辰时", avatarSrc: AVATARS.zhongchen },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF_PARTICIPANT,
    ],
  },
  图书馆: {
    location: "图书馆",
    title: "自习室的并排",
    description:
      "傍晚的自习室安静得能听见翻书声，叶恒刚好坐在你常坐的那个靠窗位置旁边。",
    participants: [
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      { name: "钟辰时", avatarSrc: AVATARS.zhongchen },
      SELF_PARTICIPANT,
    ],
  },
  后山: {
    location: "后山",
    title: "山道上的小橘猫",
    description:
      "周往正蹲在石阶边喂一只小橘猫，风把树叶吹得沙沙响——正好是拐弯就能遇见的那种时刻。",
    participants: [
      { name: "周往", avatarSrc: AVATARS.zhouwang },
      SELF_PARTICIPANT,
    ],
  },
  操场: {
    location: "操场",
    title: "夕阳下的慢跑",
    description:
      "夕阳把操场染成橘红色，叶恒一边散步一边思考题目，跑圈的同学从你身边掠过。",
    participants: [
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF_PARTICIPANT,
    ],
  },
  体育馆: {
    location: "体育馆",
    title: "半场上的约球",
    description:
      "体育馆里还回响着刚才投进的那个三分球，周往喊你下来凑个三打三。",
    participants: [
      { name: "周往", avatarSrc: AVATARS.zhouwang },
      SELF_PARTICIPANT,
    ],
  },
  教室: {
    location: "教室",
    title: "放学后的教室",
    description:
      "夏季正在擦黑板，窗外是橙色的天空——一个安静到能听见粉笔声的放学时刻。",
    participants: [
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF_PARTICIPANT,
    ],
  },
  学校大门: {
    location: "学校大门",
    title: "校门口的相遇",
    description:
      "夏季在门口的小摊前等晚归的同学，门外是刚亮起的路灯和一串卖烤肠的吆喝声。",
    participants: [
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF_PARTICIPANT,
    ],
  },
};

/**
 * Fallback for any POI we forgot to author. Keeps the sheet usable
 * even if someone adds a new pin and the data table lags behind.
 */
function fallbackEvent(location: string): Omit<MapEvent, "venue"> {
  return {
    location,
    title: `${location}的片刻`,
    description: `此刻的${location}正好有点热闹，不知道你要不要进来看看。`,
    participants: [SELF_PARTICIPANT],
  };
}

export function getMapEvent(location: string): MapEvent {
  const base = EVENTS[location] ?? fallbackEvent(location);
  const venuePrefix = TILIA_LOCATIONS.has(location) ? TILIA_TRAIN : SCHOOL;
  return { ...base, venue: `${venuePrefix} · ${location}` };
}
