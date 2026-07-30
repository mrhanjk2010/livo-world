import type { FeedItem } from "@/lib/tilia/world-feed";

export type { DestinyImpactDraft } from "@/lib/tilia/destiny-from-voice";
export {
  buildPotentialDestinyFromVoice,
  generateDestinyImpactLocal,
  impactToDestinyMarker,
} from "@/lib/tilia/destiny-from-voice";

/**
 * 「回应这一刻」—— 用户以角色身份对世界说话 / 做事。
 *
 * 流程：点输入 → 全屏毛玻璃 + 推荐短语 + 键盘 → 发送 →
 * 星轨送达转场 → 15s 酝酿 → 地图落下潜在命运（新事件标题，非原文）。
 */

/** 发送后冷却（酝酿回响 / 潜在命运）。演示用 15s。 */
export const RESPOND_COOLDOWN_MS = 15_000;

/** 送达转场展示时长（需盖住流行动画）。 */
export const RESPOND_DELIVER_MS = 2_800;

import { CONCERT_RESPOND_PHRASE } from "@/lib/tilia/music-hall-concert";

/**
 * 按世界设定写的推荐短语池。每次打开遮罩随机抽五句飘在空中。
 * 「听音乐会」为固定预置，始终占第一飘浮位。
 */
export const RESPOND_PHRASE_POOL: readonly string[] = [
  CONCERT_RESPOND_PHRASE,
  "我想再听一遍那支口琴",
  "去会客厅坐一会儿",
  "把窗缝里的雪拍掉",
  "问问试剂还安不安全",
  "路过剧场时放慢脚步",
  "给任轻义留一句口信",
  "在咖啡厅多停一盏茶",
  "看看散庭有没有系好丝巾",
  "对乘务长点一点头",
  "把公式又默念了一遍",
  "假装只是出来透气",
  "听一听音乐厅的余音",
  "朝万晁的方向望了一眼",
  "把外套领口又翻高一点",
  "在廊道里站了很久",
];

/** 打开回应遮罩时必出现的预置短语。 */
export const RESPOND_PINNED_PHRASES: readonly string[] = [
  CONCERT_RESPOND_PHRASE,
];

const PHRASE_FLOAT: readonly {
  top: string;
  left?: string;
  right?: string;
  rotate: string;
  delay: string;
}[] = [
  { top: "4%", left: "6%", rotate: "-7deg", delay: "0s" },
  { top: "18%", right: "4%", rotate: "5deg", delay: "0.25s" },
  { top: "34%", left: "10%", rotate: "-3deg", delay: "0.5s" },
  { top: "48%", right: "8%", rotate: "6deg", delay: "0.75s" },
  { top: "62%", left: "14%", rotate: "-5deg", delay: "1s" },
];

export type FloatingPhrase = {
  text: string;
  top: string;
  left?: string;
  right?: string;
  rotate: string;
  delay: string;
};

/**
 * 从池里无放回抽 n 句，并配上漂浮位姿（预置短语固定占位）。
 *
 * `extraPinned` 给剧情节点用：某一段备好之后，把那段的触发句钉到第一位，
 * 演示时点一下就能发出去，不用当场敲字。
 */
export function pickFloatingPhrases(
  n = 5,
  extraPinned: readonly string[] = [],
): FloatingPhrase[] {
  const pinned = [...extraPinned, ...RESPOND_PINNED_PHRASES].filter(
    (p, i, all) => all.indexOf(p) === i,
  );
  const pool = RESPOND_PHRASE_POOL.filter((p) => !pinned.includes(p));
  const picked: string[] = [...pinned];
  while (picked.length < n && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]!);
  }
  return picked.slice(0, n).map((text, i) => ({
    text,
    ...PHRASE_FLOAT[i % PHRASE_FLOAT.length],
  }));
}

/** 用户回应写入世界动态。 */
export function voiceToFeedItem(text: string, roomId?: string): FeedItem {
  return {
    id: `voice-${Date.now()}`,
    kind: "voice",
    speakers: [{ kind: "you" }],
    text: text.trim(),
    roomId,
  };
}
