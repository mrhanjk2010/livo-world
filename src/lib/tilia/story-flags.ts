/**
 * 轻量剧情 flag（Demo）。
 *
 * - 潜在命运：退出对应群聊/单聊后，地图入口按 chatLocation 清除。
 * - 音乐会 → 小提琴 →（一周后）巡警检查等三枚命运。
 */

export const STORY_FLAG_STORAGE_KEY = "tilia-story-flags-v1";

export type ActiveDestinyVisit = {
  id: string;
  kind: "destined" | "potential";
  chatLocation: string;
};

export type StoryWorldClock = {
  time: string;
  weather: string;
  /** 维萨发车后的第几天，和 `WorldClock.day` 同义。 */
  day: number;
  leg: string;
};

export type StoryFlags = {
  /** 茶室小提琴潜在命运是否可出现。 */
  violinInTeaRoom: boolean;
  /** 已获得小提琴（赠琴命运结束后）。 */
  hasViolin: boolean;
  /** 已可跳到「一周后」（拿到琴之后）。 */
  weekLaterReady: boolean;
  /** 已跳到一周后（三枚命运已落下）。 */
  weekLaterArrived: boolean;
  /**
   * 「地图扩展」这一段已备好：那句话进回应推荐短语，地图还没有变。
   * 演示时先切到这一段，再当场把话说出去。
   */
  cabExpansionArmed: boolean;
  /**
   * 驾驶车厢已向你开放（那道折棚门开了）。车厢一直都在，翻的是通行范围。
   * 只由「回应这一刻」说到车头/驾驶室、或巡警检查那段尾声触发 ——
   * 扩图必须发生在话音之后，演示菜单不直接翻它。
   */
  cabRevealed: boolean;
  /** 覆盖世界动态表头时钟；null 用默认 WORLD_CLOCK。 */
  worldClock: StoryWorldClock | null;
  /** 已退出、应从地图移除的潜在命运 chatLocation。 */
  clearedPotentialLocations: readonly string[];
  /** 当前从半层进入的命运（用于退出时判定是否清除入口）。 */
  activeDestinyVisit: ActiveDestinyVisit | null;
};

export const DEFAULT_STORY_FLAGS: StoryFlags = {
  violinInTeaRoom: false,
  hasViolin: false,
  weekLaterReady: false,
  weekLaterArrived: false,
  cabExpansionArmed: false,
  cabRevealed: false,
  worldClock: null,
  clearedPotentialLocations: [],
  activeDestinyVisit: null,
};

/** 清掉旧版 session 残留。 */
export function purgePersistedStoryFlags(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORY_FLAG_STORAGE_KEY);
  } catch {
    // ignore
  }
}
