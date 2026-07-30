/**
 * 24-hour activity trajectories per character, used by
 * `TrajectoryOverlay` (Figma 1576:6500, "角色动态轨迹").
 *
 * Each point represents an arrival at a POI. The path the overlay
 * draws interpolates linearly between consecutive points, and the
 * tooltip logic picks the current action based on scrubber time:
 *
 *   • if `|t - point.t| <= SNAP` → use that point's `action`
 *   • otherwise → auto-narrate "正在去{next.location}的路上"
 *
 * Coordinate system: `t ∈ [0, 1440]` minutes, where `0` maps to
 * "昨天 18:45" and `1440` to "现在 18:45" (the app-wide "now"
 * label, mirroring `activity-sheet.tsx`).
 */

export type TrajectoryPoint = {
  /** Minutes since T-24h (0..1440). */
  t: number;
  /** POI label — must match an entry in `map-pois.ts`. */
  location: string;
  /** What the character is doing on arrival. */
  action: string;
};

export type FriendTrajectory = {
  name: string;
  avatarSrc: string;
  /** Stroke + marker color for this character's path. */
  color: string;
  points: readonly TrajectoryPoint[];
};

export const TRAJECTORY_SPAN_MINUTES = 1440;

/**
 * The ends of the timeline as rendered by the scrubber.
 * `现在` matches the activity-sheet's static "NOW_LABEL", so the
 * two surfaces stay in sync for the demo.
 */
export const TRAJECTORY_TIME_LABELS = {
  start: "昨天 18:45",
  end: "现在 18:45",
} as const;

export const TRAJECTORIES: readonly FriendTrajectory[] = [
  {
    name: "周往",
    avatarSrc: "/figma/map/avatar-zhouwang.png",
    color: "#ff6b7e",
    points: [
      { t: 0, location: "食堂", action: "晚饭时段扒了两口就走" },
      { t: 120, location: "图书馆", action: "晚自习做数学题" },
      { t: 240, location: "学校大门", action: "放学离校" },
      { t: 780, location: "教室", action: "早自习迟到了两分钟" },
      { t: 960, location: "操场", action: "体育课绕操场跑了几圈" },
      { t: 1140, location: "体育馆", action: "约了人打篮球" },
      { t: 1320, location: "学校大门", action: "在小摊买了水和一包猫粮" },
      { t: 1395, location: "后山", action: "给流浪猫投喂粮食" },
      { t: 1440, location: "后山", action: "又有一只小奶猫凑了过来" },
    ],
  },
  {
    name: "钟辰时",
    avatarSrc: "/figma/map/avatar-zhongchen.jpg",
    color: "#5b9bff",
    points: [
      { t: 0, location: "教室", action: "晚自习结束前最后一题" },
      { t: 80, location: "图书馆", action: "借了一本新的参考书" },
      { t: 220, location: "学校大门", action: "独自走回宿舍" },
      { t: 800, location: "教室", action: "早自习拿起新借的书" },
      { t: 1000, location: "教室", action: "上午连着两节课都专心听讲" },
      { t: 1180, location: "食堂", action: "随便扒了两口就回去" },
      { t: 1300, location: "图书馆", action: "一直卡在同一道几何题上" },
      { t: 1420, location: "图书馆", action: "终于把那道困扰一天的题解出来了" },
      { t: 1440, location: "图书馆", action: "🤔 还有下一题" },
    ],
  },
  {
    name: "夏季",
    avatarSrc: "/figma/map/avatar-xiaji.png",
    color: "#ffaa3d",
    points: [
      { t: 0, location: "操场", action: "傍晚陪朋友散步" },
      { t: 90, location: "食堂", action: "帮朋友占了个靠窗位置" },
      { t: 210, location: "学校大门", action: "一起走出校门" },
      { t: 820, location: "学校大门", action: "早到了，等大家一起进校" },
      { t: 900, location: "教室", action: "上午第一节语文课" },
      { t: 1020, location: "食堂", action: "午饭时间人太多，排了半天队" },
      { t: 1220, location: "操场", action: "陪朋友跑了五圈" },
      { t: 1360, location: "学校大门", action: "在门口等晚归的同学" },
      { t: 1440, location: "教室", action: "正在教室打扫卫生" },
    ],
  },
  {
    name: "叶恒",
    avatarSrc: "/figma/map/avatar-yeheng.png",
    color: "#8b7aff",
    points: [
      { t: 0, location: "操场", action: "散步思考一道函数题" },
      { t: 60, location: "图书馆", action: "帮同学讲解一道函数题" },
      { t: 180, location: "学校大门", action: "慢悠悠走出校门" },
      { t: 790, location: "教室", action: "早到布置今天的讲解" },
      { t: 970, location: "图书馆", action: "学霸时间：连做十道题" },
      { t: 1140, location: "食堂", action: "慢条斯理地喝了一杯冰美式" },
      { t: 1300, location: "教室", action: "收拾书包准备去图书馆" },
      { t: 1400, location: "图书馆", action: "又开始帮同学讲解函数题" },
      { t: 1440, location: "操场", action: "去操场散步放松一下" },
    ],
  },
];

/** `name -> trajectory` convenience lookup. */
export const TRAJECTORY_BY_NAME: Readonly<Record<string, FriendTrajectory>> =
  Object.fromEntries(TRAJECTORIES.map((t) => [t.name, t]));

/**
 * Format minutes-since-start as an `HH:MM` string, wrapping day
 * boundaries — `t=0` returns "18:45", `t=1440` also returns "18:45"
 * (one day later but the clock face is the same).
 */
export function formatMinutes(t: number): string {
  // T=0 corresponds to 18:45 the day before.
  const baseH = 18;
  const baseM = 45;
  const total = baseH * 60 + baseM + t;
  const h = Math.floor((total / 60) % 24);
  const m = Math.floor(total % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Snap window (minutes) around a waypoint where we show the
 * waypoint's action verbatim rather than "正在去…的路上".
 */
export const ACTION_SNAP_MINUTES = 8;
