/**
 * 世界回响星图的落位（设计稿 `3406:9892` / `3407:10459`）。
 *
 * 设计稿给的是一屏的取景：回响光球散在整屏，事件/时机小卡更弱地铺在它们
 * 之间，选中一枚才拉出弧线。但世界记的事比一屏多得多 —— 所以这里不再把
 * 内容塞进 375×812，而是反过来：画布跟着内容长，一屏只是取景框，星图靠拖
 * 动看完。设计稿的密度与景深关系保留，画板尺寸不保留。
 *
 * 归纳出来的单位是「簇」：
 *
 *   一枚回响光球 + 汇聚进它的若干事件/时机，节点一律摆在光球的上方。
 *
 * 「一律在上方」不是审美偏好，是被底部半层逼出来的：选中后半层从底部升
 * 起、光球要避让到半层之上（见 `EchoFieldScreen` 的取景），节点跟着光球
 * 一起往上走才不会被半层吃掉。同理画布底部留 `BOTTOM_RESERVE` 一段空 ——
 * 最后一行的簇也得抬得起来。
 *
 * 簇按 3 列 × N 行分区摆，区内偏移由 id 哈希决定：确定性的（每次打开同一
 * 枚回响都在同一处，截图和记忆才对得上），但不整齐（不然一眼就是网格）。
 * 坐标是画布 px，不是百分比 —— 星图不跟着地图缩放，没有换算的必要。
 */

import type {
  EchoFieldEntry,
  LooseEventSeed,
  LooseNudge,
} from "@/lib/tilia/echo-archive";
import type { EchoNodeSeed } from "@/lib/tilia/echo-story";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

/** 光晕溢出后的视觉半径（命中区 44，光晕铺到 82），取景留白按它算。 */
export const ECHO_ORB_RADIUS = 41;

const COLS = 3;
const CELL_W = 258;
const CELL_H = 268;
/** 画布底部留白：给「选中后抬到半层之上」留出行程。 */
const BOTTOM_RESERVE = 260;
/** 顶部留白：第一行的簇也得有地方摆它上方的节点。 */
const TOP_PAD = 150;
/** 任何东西都不贴边。 */
const EDGE_X = 26;
const EDGE_Y = 44;

/**
 * 节点的三级景深。设计稿里同一种小卡有 32 / 28.8 / 24 三种头像，文字
 * 11 / 9.9 / 8.25 —— 就是同一个卡按 1 / 0.9 / 0.75 缩，远近关系而已。
 */
type NodeScale = 1 | 0.9 | 0.75;

/** 节点相对光球圆心的落点。三套模板轮换，免得每簇长得一模一样。 */
type NodeOffset = { dx: number; dy: number; scale: NodeScale };

const NODE_TEMPLATES: readonly (readonly NodeOffset[])[] = [
  [
    { dx: -70, dy: -188, scale: 1 },
    { dx: -82, dy: -82, scale: 0.9 },
    { dx: 4, dy: -118, scale: 0.75 },
  ],
  [
    { dx: -19, dy: -216, scale: 0.75 },
    { dx: -12, dy: -80, scale: 1 },
    { dx: -62, dy: -176, scale: 0.9 },
  ],
  [
    { dx: -64, dy: -174, scale: 1 },
    { dx: -76, dy: -64, scale: 0.9 },
    { dx: 12, dy: -128, scale: 0.75 },
  ],
];

/**
 * id → [0,1) 的确定性抖动源（FNV-1a）。同一枚回响每次算出同一个位置。
 */
function hash01(seed: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 4096) / 4096;
}

/** 以 0 为中心的抖动，幅度 ±span/2。 */
function jitter(seed: string, salt: number, span: number): number {
  return (hash01(seed, salt) - 0.5) * span;
}

export type EchoFieldNode = {
  id: string;
  /** 属于哪枚回响；`null` 是还没接上任何线的散件。 */
  echoId: string | null;
  kind: EchoNodeSeed["kind"];
  /** 时机没有参与者，是空数组。 */
  speakers: readonly FeedSpeaker[];
  text: string;
  x: number;
  y: number;
  scale: NodeScale;
  /** 只有还没接上线的事件有：酝酿进度 0–1，以及能推它一把的做法。 */
  brewing?: number;
  nudges?: readonly LooseNudge[];
};

export type EchoFieldOrb = {
  story: EchoFieldEntry;
  x: number;
  y: number;
};

export type EchoField = {
  /** 画布尺寸，由内容量决定。 */
  width: number;
  height: number;
  /** 有内容的那部分高度（`height` 减去底部给半层留的行程）。 */
  contentHeight: number;
  orbs: readonly EchoFieldOrb[];
  nodes: readonly EchoFieldNode[];
};

export type LooseEvent = LooseEventSeed;

/**
 * 把回响铺成星图。
 *
 * `loose` 是还没汇聚成回响的事件 —— 它们没有 `echoId`，选中任何回响都不会
 * 点亮。星图里留着它们不是凑数：世界发生的事本来就多于长出结果的事，全屏
 * 里每个光点都能接上线反而假。它们带着 `brewing` / `nudges` 走到节点上，
 * 是这张图里唯一还没定下来、因此还能被推一把的部分。
 *
 * 散件只收事件，不收时机 —— 时机推不动，孤零零摆着读不出下一步。
 */
export function buildEchoField(
  stories: readonly EchoFieldEntry[],
  loose: readonly LooseEvent[] = [],
): EchoField {
  const rows = Math.max(1, Math.ceil(stories.length / COLS));
  const width = COLS * CELL_W;
  const clusterH = TOP_PAD + rows * CELL_H;
  const height = clusterH + BOTTOM_RESERVE;

  const clampX = (x: number) => Math.min(width - EDGE_X, Math.max(EDGE_X, x));
  const clampY = (y: number) => Math.min(height - EDGE_Y, Math.max(EDGE_Y, y));

  const orbs: EchoFieldOrb[] = [];
  const nodes: EchoFieldNode[] = [];

  stories.forEach((story, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const ox = clampX(
      col * CELL_W + CELL_W / 2 + jitter(story.id, 1, CELL_W * 0.34),
    );
    // 光球压在格子偏下，上方那一格半留给汇聚进它的节点（会探进上一行的
    // 地盘，正是设计稿那种交织感）。
    const oy = clampY(
      TOP_PAD + row * CELL_H + CELL_H * 0.72 + jitter(story.id, 2, CELL_H * 0.2),
    );
    orbs.push({ story, x: ox, y: oy });

    const template = NODE_TEMPLATES[i % NODE_TEMPLATES.length];
    story.nodes.slice(0, template.length).forEach((seed, ni) => {
      const slot = template[ni];
      nodes.push({
        id: `${story.id}-n${ni}`,
        echoId: story.id,
        kind: seed.kind,
        speakers: seed.kind === "event" ? seed.speakers : [],
        text: seed.text,
        x: clampX(ox + slot.dx + jitter(story.id, 10 + ni, 34)),
        y: clampY(oy + slot.dy + jitter(story.id, 20 + ni, 26)),
        scale: slot.scale,
      });
    });
  });

  // 散件铺在簇与簇的缝里：列错开半格，行错开到格子上沿。
  const looseCols = COLS + 1;
  const looseRows = Math.max(1, Math.ceil(loose.length / looseCols));
  const looseScales: readonly NodeScale[] = [0.9, 0.75, 0.75, 0.9, 1, 0.75];

  loose.forEach((seed, i) => {
    const key = `loose-${i}-${seed.text}`;
    const col = i % looseCols;
    const row = Math.floor(i / looseCols);
    nodes.push({
      id: key,
      echoId: null,
      kind: "event",
      speakers: seed.speakers,
      text: seed.text,
      brewing: seed.brewing,
      nudges: seed.nudges,
      x: clampX(col * (width / looseCols) + jitter(key, 3, 90)),
      y: clampY(
        EDGE_Y +
          ((row + 0.4) / looseRows) * (clusterH - EDGE_Y) +
          jitter(key, 4, CELL_H * 0.45),
      ),
      scale: looseScales[i % looseScales.length],
    });
  });

  return { width, height, contentHeight: clusterH, orbs, nodes };
}

/**
 * 小卡估宽（px）。取景避让要知道选中簇占多少地方，而卡片是文字撑开的，
 * 布局阶段量不到真实宽度，只能按字号估：中文一字约等于一个字号宽。
 *
 * 头像按叠放算（32 宽、压 8）—— 三个人的卡比一个人的宽出快五十，估窄了
 * 就会被推到取景框外切掉一截。文字取两行里长的那行：参与者那行字号小，
 * 但人多的时候反而比正文长。
 */
export function estimateNodeWidth(node: EchoFieldNode): number {
  if (node.kind === "moment") return (24 + 2 + node.text.length * 11) * node.scale;
  const head = 32 + Math.max(0, node.speakers.length - 1) * 24;
  // 名字按人均三字加一个顿号估，够用了 —— 差一两个字不影响避让。后面还
  // 可能跟一个酝酿百分比（散件事件才有）。
  const names =
    node.speakers.length * 4 * 10 + (node.brewing !== undefined ? 27 : 0);
  const text = Math.max(node.text.length * 11, names);
  return (head + 6 + text) * node.scale;
}
