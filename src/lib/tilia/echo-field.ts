/**
 * 世界命运星图的落位（设计稿 `3406:9892` / `3407:10459`）。
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
 *
 * 画布最右边另开一条道给命运（`LANE_W`）：它们是一条首尾相接的主线，混进
 * 簇阵里就读不出先后了。
 */

import type {
  EchoFieldEntry,
  LooseEventSeed,
  LooseNudge,
} from "@/lib/tilia/echo-archive";
import type { DestinyChainSeed } from "@/lib/tilia/destiny-archive";
import type { EchoNodeSeed } from "@/lib/tilia/echo-story";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

/**
 * 整片星图的放大倍数。
 *
 * 设计稿那套字号（11 / 9.9 / 8.25）是按「一屏取景」画的，铺到可拖的大画布上
 * 就偏小了 —— 人是拖着看的，一次只读眼前这几张卡，没必要挤。放大只动这一个
 * 数：这边管格距和小卡，`EchoFieldScreen` 拿它管光球和命运的尺寸。
 */
export const FIELD_ZOOM = 1.25;
const ZOOM = FIELD_ZOOM;

/** 光晕溢出后的视觉半径（核心 44、光晕铺到 82，都按 ZOOM 放大）。 */
export const ECHO_ORB_RADIUS = Math.round(41 * ZOOM);

const COLS = 3;
const CELL_W = Math.round(248 * ZOOM);
const CELL_H = Math.round(256 * ZOOM);

/**
 * 命运走最右边那片地方，一条因果链占一列。
 *
 * 混在回响簇里摆试过：命运和回响的连线会横穿三四簇，谁指谁全看不出来。分出
 * 来之后，一条链自上而下读得一气贯通，跨回左边指向回响的那几段反而因为长而
 * 更明显 —— 那正是这张图要说的「命运的果落在了别处」。
 *
 * 一列一条链，是因为「链」才是这边的阅读单位。列不够就并到同一列里接着排，
 * 两条链之间空出整整一行（`LANE_CHAIN_GAP`）—— 挨着摆会被读成一条长链。
 */
const LANE_COL_W = Math.round(214 * ZOOM);
const LANE_COLS = 3;
/** 一枚命运（上方两张小卡 + 蝶形 + 标题胶囊）占的行高。 */
const LANE_ROW_H = Math.round(240 * ZOOM);
const LANE_CHAIN_GAP = 1;
/** 促成命运的小卡摆在它左上方 —— 命运已经靠右，往右摆会顶出画布。 */
const LANE_NODE_DX = Math.round(-88 * ZOOM);
const LANE_NODE_DY = [Math.round(-88 * ZOOM), Math.round(-51 * ZOOM)] as const;
/** 画布底部留白：给「选中后抬到半层之上」留出行程。 */
const BOTTOM_RESERVE = 280;
/** 顶部留白：第一行的簇也得有地方摆它上方的节点。 */
const TOP_PAD = Math.round(150 * ZOOM);
/** 任何东西都不贴边。 */
const EDGE_X = 26;
const EDGE_Y = 44;

/**
 * 节点的三级景深。设计稿里同一种小卡有 32 / 28.8 / 24 三种头像，文字
 * 11 / 9.9 / 8.25 —— 就是同一个卡按 1 / 0.9 / 0.75 缩，远近关系而已。
 * 三档整体再乘 `ZOOM`，档与档的比例不变。
 */
type NodeScale = number;

const SCALE_NEAR = 1 * ZOOM;
const SCALE_MID = 0.9 * ZOOM;
const SCALE_FAR = 0.75 * ZOOM;

/** 节点相对光球圆心的落点。三套模板轮换，免得每簇长得一模一样。 */
type NodeOffset = { dx: number; dy: number; scale: NodeScale };

/** 模板按设计稿的相对关系写，落位时乘 `ZOOM` —— 卡变大了，间距得跟着开。 */
const NODE_TEMPLATES: readonly (readonly NodeOffset[])[] = [
  [
    { dx: -70, dy: -188, scale: SCALE_NEAR },
    { dx: -82, dy: -82, scale: SCALE_MID },
    { dx: 4, dy: -118, scale: SCALE_FAR },
  ],
  [
    { dx: -19, dy: -216, scale: SCALE_FAR },
    { dx: -12, dy: -80, scale: SCALE_NEAR },
    { dx: -62, dy: -176, scale: SCALE_MID },
  ],
  [
    { dx: -64, dy: -174, scale: SCALE_NEAR },
    { dx: -76, dy: -64, scale: SCALE_MID },
    { dx: 12, dy: -128, scale: SCALE_FAR },
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
  /**
   * 汇进了哪一枚 —— 回响或命运，取它们的 id；`null` 是还没接上任何线的
   * 散件。两种归属共用一个字段：小卡自己不区分「我汇进的是果还是命运」，
   * 选中谁就亮谁的那几张，逻辑是一样的。
   */
  ownerId: string | null;
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

export type EchoFieldDestiny = {
  seed: DestinyChainSeed;
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
  destinies: readonly EchoFieldDestiny[];
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
 *
 * `destinies` 走右边那条道，每枚也带自己的小卡（促成它的事件与时机）。它们
 * 和回响共享一套小卡渲染，只是归属指向命运而不是回响。
 */
export function buildEchoField(
  stories: readonly EchoFieldEntry[],
  loose: readonly LooseEvent[] = [],
  destinies: readonly DestinyChainSeed[] = [],
): EchoField {
  const rows = Math.max(1, Math.ceil(stories.length / COLS));
  const clusterW = COLS * CELL_W;
  const clusterH = TOP_PAD + rows * CELL_H;

  const lane = layoutLane(destinies);
  const width = clusterW + lane.cols * LANE_COL_W;
  const contentHeight = Math.max(clusterH, lane.height);
  const height = contentHeight + BOTTOM_RESERVE;

  const clampX = (x: number) => Math.min(width - EDGE_X, Math.max(EDGE_X, x));
  const clampY = (y: number) => Math.min(height - EDGE_Y, Math.max(EDGE_Y, y));

  const orbs: EchoFieldOrb[] = [];
  const destinyPoints: EchoFieldDestiny[] = [];
  const nodes: EchoFieldNode[] = [];

  /*
   * 先把两种「有固定位置的东西」全部落位（光球、命运），再排小卡。
   *
   * 顺序是有讲究的：小卡要让位，而它得躲开所有光球和命运，不只是排在它前面
   * 那几个。让位见 `nudgeClear`。
   */
  stories.forEach((story, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    orbs.push({
      story,
      x: clampX(col * CELL_W + CELL_W / 2 + jitter(story.id, 1, CELL_W * 0.34)),
      // 光球压在格子偏下，上方那一格半留给汇聚进它的节点（会探进上一行的
      // 地盘，正是设计稿那种交织感）。
      y: clampY(
        TOP_PAD +
          row * CELL_H +
          CELL_H * 0.72 +
          jitter(story.id, 2, CELL_H * 0.2),
      ),
    });
  });

  // 命运按 `layoutLane` 算好的列/行落位：同一条链在同一列里自上而下，越靠下
  // 越新 —— 和回响簇同一个约定（画布向下就是时间向前）。
  lane.slots.forEach(({ seed, col, row }) => {
    destinyPoints.push({
      seed,
      x: clampX(
        clusterW + col * LANE_COL_W + LANE_COL_W / 2 + jitter(seed.id, 5, 54),
      ),
      y: clampY(
        LANE_TOP + row * LANE_ROW_H + LANE_ROW_H / 2 + jitter(seed.id, 6, 40),
      ),
    });
  });

  const taken: Rect[] = [
    ...orbs.map((o) => ({
      l: o.x - ECHO_ORB_RADIUS,
      r: o.x + ECHO_ORB_RADIUS,
      t: o.y - ECHO_ORB_RADIUS,
      b: o.y + ECHO_ORB_RADIUS,
    })),
    ...destinyPoints.map(destinyRect),
  ];

  const place = (node: EchoFieldNode, maxR: number) => {
    const placed = nudgeClear(node, taken, clampX, clampY, maxR);
    taken.push(nodeRect(placed));
    nodes.push(placed);
  };

  // 汇进回响的小卡。让位幅度压在两格以内 —— 它得看着还是这一簇的。
  stories.forEach((story, i) => {
    const orb = orbs[i];
    const template = NODE_TEMPLATES[i % NODE_TEMPLATES.length];
    story.nodes.slice(0, template.length).forEach((seed, ni) => {
      const slot = template[ni];
      place(
        {
          id: `${story.id}-n${ni}`,
          ownerId: story.id,
          kind: seed.kind,
          speakers: seed.kind === "event" ? seed.speakers : [],
          text: seed.text,
          x: clampX(
            orb.x + slot.dx * ZOOM + jitter(story.id, 10 + ni, 34 * ZOOM),
          ),
          y: clampY(
            orb.y + slot.dy * ZOOM + jitter(story.id, 20 + ni, 26 * ZOOM),
          ),
          scale: slot.scale,
        },
        2,
      );
    });
  });

  // 促成命运的小卡，同理。
  destinyPoints.forEach(({ seed, x, y }) => {
    seed.nodes.slice(0, 2).forEach((n, ni) => {
      place(
        {
          id: `${seed.id}-n${ni}`,
          ownerId: seed.id,
          kind: n.kind,
          speakers: n.kind === "event" ? n.speakers : [],
          text: n.text,
          x: clampX(x + LANE_NODE_DX + jitter(seed.id, 30 + ni, 34)),
          y: clampY(y + LANE_NODE_DY[ni] + jitter(seed.id, 40 + ni, 22)),
          scale: ni === 0 ? SCALE_MID : SCALE_FAR,
        },
        2,
      );
    });
  });

  /*
   * 散件最后铺，铺在簇与簇的缝里：列错开半格，行错开到格子上沿，只占簇那
   * 片地方（`clusterW`），右边命运那几列不掺进来。
   *
   * 放最后、也给最大的让位幅度：它们是这张图里唯一没有归属的一批（不属于
   * 任何一枚回响或命运），挪远一点不损失任何意思，谁该让谁很清楚。
   */
  const looseCols = COLS + 1;
  const looseRows = Math.max(1, Math.ceil(loose.length / looseCols));
  const looseScales: readonly NodeScale[] = [
    SCALE_MID,
    SCALE_FAR,
    SCALE_FAR,
    SCALE_MID,
    SCALE_NEAR,
    SCALE_FAR,
  ];

  loose.forEach((seed, i) => {
    const key = `loose-${i}-${seed.text}`;
    const col = i % looseCols;
    const row = Math.floor(i / looseCols);
    place(
      {
        id: key,
        ownerId: null,
        kind: "event",
        speakers: seed.speakers,
        text: seed.text,
        brewing: seed.brewing,
        nudges: seed.nudges,
        x: clampX(col * (clusterW / looseCols) + jitter(key, 3, 90 * ZOOM)),
        y: clampY(
          EDGE_Y +
            ((row + 0.4) / looseRows) * (clusterH - EDGE_Y) +
            jitter(key, 4, CELL_H * 0.45),
        ),
        scale: looseScales[i % looseScales.length],
      },
      8,
    );
  });

  return {
    width,
    height,
    contentHeight,
    orbs,
    destinies: destinyPoints,
    nodes,
  };
}

/** 命运那片区域的顶部留白，和簇那边错开半格，免得两边横成一排。 */
const LANE_TOP = Math.round(TOP_PAD * 0.55);

/* ─────────────────────── 让位（散件躲开已落好的东西） ─────────────────────── */

type Rect = { l: number; r: number; t: number; b: number };

/**
 * 小卡的占位。锚点在左侧那枚头像/光点上，卡朝右被文字撑开（估宽见
 * `estimateNodeWidth`），所以盒子不是以 x 居中的。
 */
function nodeRect(n: EchoFieldNode): Rect {
  const half = (n.kind === "moment" ? 12 : 16) * n.scale;
  return {
    l: n.x - half,
    r: n.x - half + estimateNodeWidth(n),
    t: n.y - half,
    b: n.y + half,
  };
}

/** 命运标记的占位：蝶形核心居中，标题胶囊挂在下面，横向由标题撑开。 */
function destinyRect(d: EchoFieldDestiny): Rect {
  const core = 44 * ZOOM;
  const halfW = Math.max(core, d.seed.title.length * 14 + 42) / 2;
  return {
    l: d.x - halfW,
    r: d.x + halfW,
    t: d.y - core / 2 - 6,
    b: d.y + core / 2 + 28 * ZOOM,
  };
}

/** 留一点余量再判重叠 —— 两张卡的文字擦着边也读不舒服。 */
function hits(a: Rect, b: Rect, pad = 10): boolean {
  return (
    a.l - pad < b.r && b.l - pad < a.r && a.t - pad < b.b && b.t - pad < a.b
  );
}

/**
 * 把一张小卡挪到不压别人的地方。
 *
 * 从原位开始一圈圈往外找（`maxR` 是最远几格），每圈里先试正上、正下，再试
 * 斜的，最后才是左右。上下优先是因为文字是横着长的：往旁边挪一点常常还压
 * 着，往上下挪一格就干净了。
 *
 * 候选顺序写死，所以结果是确定性的 —— 星图每次打开长得一样，截图和记忆才对
 * 得上，这一点比「挪得最少」重要。
 *
 * 找遍了还撞就留在原位：宁可叠一次，也不要把卡甩到画布另一头 —— 那时候它和
 * 它该在的那片区域就没关系了。
 */
function nudgeClear(
  node: EchoFieldNode,
  taken: readonly Rect[],
  clampX: (x: number) => number,
  clampY: (y: number) => number,
  maxR: number,
): EchoFieldNode {
  const step = 34 * ZOOM;

  for (let r = 0; r <= maxR; r += 1) {
    for (const [mx, my] of ring(r)) {
      const cand = {
        ...node,
        x: clampX(node.x + mx * step),
        y: clampY(node.y + my * step),
      };
      if (!taken.some((t) => hits(nodeRect(cand), t))) return cand;
    }
  }
  return node;
}

/** 第 r 圈的候选位移，上下优先、左右垫底。 */
function ring(r: number): readonly (readonly [number, number])[] {
  if (r === 0) return [[0, 0]];
  const out: [number, number][] = [
    [0, -r],
    [0, r],
  ];
  for (let d = 1; d <= r; d += 1) {
    out.push([-d, -r], [d, -r], [-d, r], [d, r]);
  }
  for (let d = r - 1; d >= 0; d -= 1) {
    out.push([-r, -d], [r, -d], [-r, d], [r, d]);
  }
  return out;
}

/**
 * 把命运分链、分列。
 *
 * 链是顺着 `causeIds` 里指向另一枚命运的那条边串出来的：没有命运上游的是链
 * 头（它的因可能是事件或回响，那不影响它在这边是一条链的开头）。
 *
 * 分列用「谁短谁先补」：列数封顶在 `LANE_COLS`，长链先占列，剩下的短链补到
 * 当前最空的那一列去。这样最长的那条主线一定独占一列从头排到尾，短链不会把
 * 它挤断。同列的两条链之间空出一整行 —— 挨着摆会被读成一条链。
 */
function layoutLane(destinies: readonly DestinyChainSeed[]): {
  cols: number;
  height: number;
  slots: readonly { seed: DestinyChainSeed; col: number; row: number }[];
} {
  if (destinies.length === 0) return { cols: 0, height: 0, slots: [] };

  const byId = new Map(destinies.map((d) => [d.id, d]));
  const parentOf = new Map<string, string>();
  for (const d of destinies) {
    const parent = (d.causeIds ?? []).find((id) => byId.has(id));
    if (parent) parentOf.set(d.id, parent);
  }

  // 每枚只进一条链：多出来的分支自己当链头，免得同一枚被排两次。
  const used = new Set<string>();
  const chains: DestinyChainSeed[][] = [];
  for (const d of destinies) {
    if (parentOf.has(d.id) || used.has(d.id)) continue;
    const chain: DestinyChainSeed[] = [];
    let cur: DestinyChainSeed | undefined = d;
    while (cur && !used.has(cur.id)) {
      used.add(cur.id);
      chain.push(cur);
      cur = destinies.find(
        (n) => parentOf.get(n.id) === cur!.id && !used.has(n.id),
      );
    }
    chains.push(chain);
  }
  // 分支链（父在别的链上）也得排：按原顺序补在后面。
  for (const d of destinies) {
    if (!used.has(d.id)) {
      used.add(d.id);
      chains.push([d]);
    }
  }

  chains.sort((a, b) => b.length - a.length);

  const cols = Math.min(LANE_COLS, chains.length);
  const filled = new Array<number>(cols).fill(0);
  const slots: { seed: DestinyChainSeed; col: number; row: number }[] = [];

  for (const chain of chains) {
    let col = 0;
    for (let i = 1; i < cols; i += 1) if (filled[i] < filled[col]) col = i;
    chain.forEach((seed, i) => {
      slots.push({ seed, col, row: filled[col] + i });
    });
    filled[col] += chain.length + LANE_CHAIN_GAP;
  }

  const rows = Math.max(...filled) - LANE_CHAIN_GAP;
  return { cols, height: LANE_TOP + rows * LANE_ROW_H, slots };
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
