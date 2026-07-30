/**
 * 命运聊天背景规则：
 *   单聊 → 对应角色立绘
 *   群聊 → 对应地点场景图
 */

const BASE = "/figma/tilia/destiny-chat";

/** 男主立绘（单聊全屏背景）。 */
export const CAST_PORTRAIT_SRC: Record<string, string> = {
  staen: `${BASE}/portrait-staen.png`,
  roland: `${BASE}/portrait-roland.png`,
  renqingyi: `${BASE}/portrait-renqingyi.png`,
  santing: `${BASE}/portrait-santing.png`,
};

/** 车厢 roomId → 地点场景图（群聊全屏背景）。 */
export const ROOM_SCENE_SRC: Record<string, string> = {
  dining: `${BASE}/scene-dining.png`,
  "tea-room": `${BASE}/scene-tea-room.png`,
  promenade: `${BASE}/scene-promenade.png`,
  crew: `${BASE}/scene-crew.png`,
  parlour: `${BASE}/scene-parlour.png`,
  theater: `${BASE}/scene-theater.png`,
  cafe: `${BASE}/scene-cafe.png`,
  study: `${BASE}/scene-study.png`,
  greenhouse: `${BASE}/scene-greenhouse.png`,
  billiard: `${BASE}/scene-billiard.png`,
  "music-hall": `${BASE}/scene-music-hall.jpg`,
  "suite-1": `${BASE}/scene-cabin.png`,
  "suite-2": `${BASE}/scene-cabin.png`,
  "suite-3": `${BASE}/scene-cabin.png`,
  "suite-4": `${BASE}/scene-cabin.png`,
  "berth-a": `${BASE}/scene-cabin.png`,
  "berth-b": `${BASE}/scene-cabin.png`,

  // 驾驶车厢。三张图覆盖七个房间：车头、炉膛、办公三种氛围。
  "cab-driver": `${BASE}/scene-cab-driver.png`,
  "cab-boiler": `${BASE}/scene-cab-boiler.png`,
  "cab-coal": `${BASE}/scene-cab-boiler.png`,
  "cab-workshop": `${BASE}/scene-cab-boiler.png`,
  "cab-captain": `${BASE}/scene-cab-captain.png`,
  "cab-telegraph": `${BASE}/scene-cab-captain.png`,
  "cab-crew-berth": `${BASE}/scene-cab-captain.png`,
};

/** 命运 chatLocation / 中文地点名 → 场景图（群聊专用 key）。 */
const LOCATION_SCENE_SRC: Record<string, string> = {
  瑰室: ROOM_SCENE_SRC.greenhouse!,
  会客厅: ROOM_SCENE_SRC.parlour!,
  剧场: ROOM_SCENE_SRC.theater!,
  "音乐厅·夜场": ROOM_SCENE_SRC["music-hall"]!,
  "茶室·矮柜旁的琴": ROOM_SCENE_SRC["tea-room"]!,
  "餐车·巡警检查": ROOM_SCENE_SRC.dining!,
  "观景廊·风声": ROOM_SCENE_SRC.promenade!,
  "乘务室·名单": ROOM_SCENE_SRC.crew!,
  // 字面量而非 import：`cab-carriage` 要读本模块，不能反向依赖。
  "驾驶室·车头风声": ROOM_SCENE_SRC["cab-driver"]!,
};

const FALLBACK_PORTRAIT = `${BASE}/portrait-staen.png`;
const FALLBACK_SCENE = `${BASE}/scene-parlour.png`;

/** 单聊：按角色 id 取立绘。 */
export function soloPortraitSrc(memberId: string): string {
  return CAST_PORTRAIT_SRC[memberId] ?? FALLBACK_PORTRAIT;
}

/** 群聊：按车厢 roomId 取场景图。 */
export function groupSceneSrcForRoom(roomId: string): string {
  return ROOM_SCENE_SRC[roomId] ?? FALLBACK_SCENE;
}

/**
 * 群聊：按命运 location key / 中文地点名取场景图。
 * 也兼容 `room:<roomId>`。
 */
export function groupSceneSrcForLocation(location: string): string {
  if (location.startsWith("room:")) {
    return groupSceneSrcForRoom(location.slice("room:".length));
  }
  return LOCATION_SCENE_SRC[location] ?? FALLBACK_SCENE;
}
