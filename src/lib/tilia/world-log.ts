/**
 * 世界日志 —— 全屏「世界动态」页的数据。
 *
 * 卡片和这一页是同一批内容的两种粒度：卡片只放 `FeedItem.text` 那句
 * 缩略，这一页放 `FeedItem.detail` 的完整几段，并按「第 N 天」分组。
 * 所以这里不另造内容，只做两件事：
 *
 *   1. 提供发车后前几日的存档（用户进 demo 之前世界已经走过的部分）；
 *   2. 把卡片里那份活的动态按天切好，接在存档后面。
 *
 * 存档为什么要有：动态卡是一次会话的缓冲，最多留 40 条，翻上去就到头
 * 了。世界不该只有你打开 demo 之后的这几分钟 —— 全屏页要能翻到发车
 * 那天，「第 1 天」这条分隔线才有意义。
 */

import type { FeedItem } from "@/lib/tilia/world-feed";

export type WorldLogDay = {
  day: number;
  items: readonly FeedItem[];
};

/**
 * 发车后第一、二日的存档。第三日（也就是 demo 的「今天」）不在这里 ——
 * 那一天的内容在动态卡的活列表里，由 `buildWorldLog` 接上。
 */
export const WORLD_LOG_ARCHIVE: readonly WorldLogDay[] = [
  {
    day: 1,
    items: [
      {
        id: "log-d1-1",
        kind: "objective",
        speakers: [{ kind: "world" }],
        text: "和平号从维萨发车",
        detail: [
          "和平号在维萨站台停了四十分钟，比时刻表长了一刻钟——最后一批行李是从站台北侧单独装上来的，没有过磅。",
          "开车时雪刚起，站台上送行的人不多，多数人是来看这趟车的。",
        ],
        day: 1,
      },
      {
        id: "log-d1-2",
        kind: "schedule",
        speakers: [{ kind: "cast", memberId: "renqingyi" }],
        text: "把每节车厢走了一遍",
        detail: [
          "任轻义在发车后的第一个钟头把车厢从头走到尾，走得不快，在每一处折棚门前都停了一下。回到餐车时他只说了一句：这趟车比图纸上短。",
        ],
        day: 1,
        roomId: "dining",
      },
      {
        id: "log-d1-3",
        kind: "voice",
        speakers: [{ kind: "you" }],
        text: "把大衣内衬缝紧了两针",
        detail: [
          "上车第一晚，你把大衣内衬缝紧了两针。缝完试着按了按，隔着布只摸得出一个方角。",
        ],
        day: 1,
        roomId: "cafe",
      },
    ],
  },
  {
    day: 2,
    items: [
      {
        id: "log-d2-1",
        kind: "objective",
        speakers: [{ kind: "world" }],
        text: "整日沿雪原行驶，气温降到零下十九度",
        detail: [
          "第二日全天没有停靠。窗外是没有起伏的雪原，气温从早上的零下九度一路降到十九度，暖气开到最大也只能焐热贴着过道的那一侧。",
        ],
        day: 2,
      },
      {
        id: "log-d2-2",
        kind: "sighting",
        speakers: [{ kind: "cast", memberId: "staen" }],
        text: "画本里夹着一张旧车票",
        detail: [
          "施塔恩的画本里夹着一张旧车票，日期是七年前，起点也是维萨。他发现你看见了，把本子合上，说这是别人留下的。",
        ],
        day: 2,
        roomId: "parlour",
      },
      {
        id: "log-d2-3",
        kind: "echo",
        speakers: [
          { kind: "cast", memberId: "roland" },
          { kind: "cast", memberId: "santing" },
        ],
        text: "为一句台词在剧场里争了半小时",
        detail: [
          "罗兰坚持那句台词要留在原处，散庭·姚说这样念出来太重。两人在剧场里争了半个钟头，最后谁也没改。",
          "散场后罗兰一个人把那页重抄了一遍。",
        ],
        day: 2,
        roomId: "theater",
      },
      {
        id: "log-d2-4",
        kind: "schedule",
        speakers: [{ kind: "npc", name: "乘务长" }],
        text: "贴出了下一段行程的告示",
        detail: [
          "乘务长在长廊贴了告示：第三日清晨进雪山隘口，穿越期间车速减半，请勿在连接处停留。",
        ],
        day: 2,
        roomId: "promenade",
      },
    ],
  },
];

/**
 * 存档 + 活列表，一起按天切好，日期升序。
 *
 * `feed` 是动态卡里那份实时列表（时间正序）。没盖过天数的条目算在
 * `currentDay` 上：种子数据自带 `day`，流式推入的由卡片按当时的世界
 * 时钟盖章，所以跳到一周后之后落下的动态不会被算回第三日。
 */
export function buildWorldLog(
  feed: readonly FeedItem[],
  currentDay: number,
): readonly WorldLogDay[] {
  const byDay = new Map<number, FeedItem[]>();
  for (const item of feed) {
    const day = item.day ?? currentDay;
    const bucket = byDay.get(day);
    if (bucket) bucket.push(item);
    else byDay.set(day, [item]);
  }

  const archivedDays = new Set(WORLD_LOG_ARCHIVE.map((d) => d.day));
  const live: WorldLogDay[] = [...byDay.entries()]
    // 存档已经写过的日子不再从活列表里重复出一组。
    .filter(([day]) => !archivedDays.has(day))
    .map(([day, items]) => ({ day, items }));

  return [...WORLD_LOG_ARCHIVE, ...live].sort((a, b) => a.day - b.day);
}
