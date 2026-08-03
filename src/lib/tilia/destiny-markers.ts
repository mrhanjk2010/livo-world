/**
 * 地图上的命运标记。
 *
 * 样式（设计稿 `3387:9619` + 产品口径）：
 *   注定 / 潜在  →  粉橙光晕 vs 蓝紫光晕
 *   ≤2 人（我+角色）→ 角色大头像与光环圆重合
 *   >2 人 → 底部小头像叠放 + 圆内群聊场景图
 *
 * 点标记 → 命运进入半层（Figma `5668:49204`）→ 「进入·命运」进单聊/群聊。
 *
 * 头像互斥：进了命运的角色不再在地图走动。
 */

import type { EnterTarget } from "@/lib/mobile/drill";
import { resolveOnSegment } from "@/lib/tilia/train-segments";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

export type DestinyKind = "destined" | "potential";

/** 由参与人数推导的展示形态。 */
export type DestinyLayout = "pair" | "crowd";

export type DestinyMarkerDef = {
  id: string;
  kind: DestinyKind;
  /** 短标题，落在地图底部胶囊上。 */
  title: string;
  /** 半层大标题（可与胶囊短标题不同，对齐故事名）。 */
  storyTitle: string;
  /** 半层开场白。 */
  prologue: string;
  /** 标记落在哪一节车厢，仅静态表的授权数据用；省略即主车厢。 */
  segment?: string;
  /**
   * 标记中心。静态表定义处写段内坐标，导出前统一解析；
   * 运行时生成的标记请用 `nearRoom()` 取点，拿到的已是整幅画布坐标。
   */
  xPct: number;
  yPct: number;
  /**
   * 参与者。人数决定布局与聊天形态：
   *   ≤2 → pair / 单聊
   *   >2 → crowd / 群聊
   */
  speakers: readonly FeedSpeaker[];
  /** 对应房间，点开时镜头可对过去。 */
  roomId?: string;
  /** crowd 布局圆内场景图。 */
  sceneSrc?: string;
  /**
   * 聊天页 location key（`/chat|event/<chatLocation>`）。
   * 与校园 POI 共用路由，但用蒂利亚场景数据。
   */
  chatLocation: string;
};

/**
 * Demo：两枚 pair（注定/潜在）+ 一枚 crowd，覆盖两种布局与两种光晕。
 * 角色不交叉，保证地图上同一张脸只出现一次。
 */
const DESTINY_MARKER_DEFS: readonly DestinyMarkerDef[] = [
  {
    id: "destiny-parlour-pair",
    kind: "destined",
    title: "口琴一曲",
    storyTitle: "归乡·口琴一曲",
    prologue:
      "会客厅的灯压得很低。施塔恩坐在鹿头标本下，铜面口琴在指间转了一圈——像在等你先开口。窗外的雪压着和平号的窗框，这一曲只为你而起。",
    xPct: 0.72,
    yPct: 0.34,
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    roomId: "parlour",
    chatLocation: "会客厅",
  },
  {
    id: "destiny-theater-pair",
    kind: "potential",
    title: "小说家",
    storyTitle: "未完的一页",
    prologue:
      "剧场最后一排空着。罗兰把新写的一页按在膝上，墨迹还没干。他抬眼看你——那一页若递出去，故事就会往另一个方向走。",
    xPct: 0.38,
    yPct: 0.58,
    speakers: [{ kind: "cast", memberId: "roland" }],
    roomId: "theater",
    chatLocation: "剧场",
  },
  {
    id: "destiny-parlour-crowd",
    kind: "destined",
    title: "瑰室小憩",
    storyTitle: "归乡·雪夜苍翠",
    prologue:
      "这是那场大战结束后的第271天。战火在南方边境缓缓熄灭，世界被「和平」粉饰，暗流却无声翻涌。你的父亲是歌德恩「聘请」的万晁科学家「鸿雁」，你承载着他的期望与嘱托，带着各城邦争夺觊觎的试剂 XK-101，踏上回万晁的「和平号」列车。",
    xPct: 0.62,
    yPct: 0.42,
    speakers: [
      { kind: "cast", memberId: "renqingyi" },
      { kind: "npc", name: "乘务长" },
      { kind: "npc", name: "巡警" },
    ],
    roomId: "parlour",
    sceneSrc: "/figma/tilia/destiny/scene-parlour.png",
    chatLocation: "瑰室",
  },
];

export const DESTINY_MARKERS: readonly DestinyMarkerDef[] =
  DESTINY_MARKER_DEFS.map(resolveOnSegment);

/** 说话人 → 地图站位 memberId（用于走动互斥）。 */
export function speakerMemberId(speaker: FeedSpeaker): string | null {
  if (speaker.kind === "you") return "heroine";
  if (speaker.kind === "cast") return speaker.memberId;
  return null;
}

/** 计「人」：你 / 角色 / NPC 都算，世界发声不算。 */
export function destinyParticipantCount(
  speakers: readonly FeedSpeaker[],
): number {
  return speakers.filter(
    (s) => s.kind === "you" || s.kind === "cast" || s.kind === "npc",
  ).length;
}

export function destinyLayout(
  speakers: readonly FeedSpeaker[],
): DestinyLayout {
  return destinyParticipantCount(speakers) > 2 ? "crowd" : "pair";
}

/**
 * pair 布局要放大的那颗头：只取角色。
 * 「你」永不进命运圆圈 —— 自己的头像始终在地图上走动。
 */
export function destinyFocusSpeaker(
  speakers: readonly FeedSpeaker[],
): FeedSpeaker | null {
  return speakers.find((s) => s.kind === "cast") ?? null;
}

/**
 * 地图 / 半层展示用头像列表：去掉「你」。
 */
export function destinyDisplaySpeakers(
  speakers: readonly FeedSpeaker[],
): FeedSpeaker[] {
  return speakers.filter((s) => s.kind !== "you");
}

/**
 * 命运所占角色；这些人不在地图上走动。
 * 「你」/ heroine 永不占用 —— 自己始终可在地图漫游。
 */
export function destinyOccupiedMemberIds(
  markers: readonly DestinyMarkerDef[] = DESTINY_MARKERS,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const m of markers) {
    for (const s of m.speakers) {
      if (s.kind === "you") continue;
      const id = speakerMemberId(s);
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** 从命运展示里剔掉正在走动的角色。 */
export function speakersNotOnMap(
  speakers: readonly FeedSpeaker[],
  wanderingMemberIds: ReadonlySet<string>,
): FeedSpeaker[] {
  return speakers.filter((s) => {
    const id = speakerMemberId(s);
    if (id == null) return s.kind === "npc" || s.kind === "world";
    return !wanderingMemberIds.has(id);
  });
}

/** 半层 CTA 文案。 */
export function destinyEnterLabel(kind: DestinyKind): string {
  return kind === "destined" ? "进入· 注定命运" : "进入· 潜在命运";
}

/**
 * 进入这枚命运时要开哪一种聊天：
 *   注定 → 事件聊（有开场）
 *   潜在 → 自由聊 / 红情境
 * 地点群聊（room:…）不分命运类型，一律自由聊。
 * 单聊 vs 群聊由场景成员数决定，两者形态相同。
 */
export function destinyChatTarget(marker: DestinyMarkerDef): EnterTarget {
  const location = marker.chatLocation;
  if (location.startsWith("room:")) return { location, mode: "free" };
  return { location, mode: marker.kind === "destined" ? "event" : "free" };
}
