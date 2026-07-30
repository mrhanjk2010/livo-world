/**
 * `/chat/<location>` 与 `/event/<location>` 的全部 location key。
 *
 * 只为 `generateStaticParams` 而存在：静态导出（GitHub Pages）里没有服务端，
 * 没被列进来的 location 就是一个 404，点开聊天页会直接掉出去。dev 下这份名单
 * 不起作用（按需渲染），所以漏了不会在本地暴露 —— 加新地点时记得回来看一眼。
 *
 * 三个来源，凑齐就是全集：
 *   1. 校园世界的 POI（旧 demo，仍在 /map 里用）
 *   2. 蒂利亚脚本命运的固定 key（音乐厅·夜场 / 餐车·巡警检查 / 驾驶室·车头风声…）
 *   3. 每个车厢房间的地点群聊 `room:<roomId>` —— 「回应这一刻」现场生成的
 *      命运也落在这里（chatLocation 缺省就是 roomChatLocation），所以随机
 *      涌现的命运同样是可枚举的。
 */

import { POIS } from "@/lib/map-pois";
import { DESTINY_CHAT_LOCATIONS } from "@/lib/tilia/destiny-chat";
import { roomChatLocation } from "@/lib/tilia/room-group-chat";
import { ROOMS } from "@/lib/tilia/train";

export const ALL_CHAT_LOCATIONS: readonly string[] = Array.from(
  new Set([
    ...POIS.map((p) => p.label),
    ...DESTINY_CHAT_LOCATIONS,
    // 未揭开的驾驶车厢也要预渲染：门开在运行时，页面必须已经在那儿。
    ...ROOMS.map(roomChatLocation),
  ]),
);

/** 聊天/事件路由共用的静态参数表。 */
export function chatLocationParams(): { location: string }[] {
  return ALL_CHAT_LOCATIONS.map((location) => ({ location }));
}
