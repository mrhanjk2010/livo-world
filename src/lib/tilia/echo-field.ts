/**
 * 世界背面星图的落位（设计稿 `3406:9892` / `3407:10459`）。
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
 * 簇按 `COLS` 列 × N 行分区摆，区内偏移由 id 哈希决定：确定性的（每次打开同
 * 一枚回响都在同一处，截图和记忆才对得上），但不整齐（不然一眼就是网格）。
 * 坐标是画布 px，不是百分比 —— 星图不跟着地图缩放，没有换算的必要。
 *
 * 命运和回响共用这套格子、交替落位（见 `layoutHeads`），不再各占半张画布。
 */

import type {
  EchoFieldEntry,
  LooseEventSeed,
  LooseNudge,
} from "@/lib/tilia/echo-archive";
import type { DestinyChainSeed } from "@/lib/tilia/destiny-archive";
import type { LiveArrival } from "@/lib/tilia/echo-live";
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

/**
 * 回响和命运摆进同一套格子，四列。
 *
 * 原先命运独占右边两列：一条链自上而下确实读得顺，代价是整张图被读成两张 ——
 * 左边一片回响，右边一条命运，中间那道缝比任何一根连线都显眼。而这张图想说
 * 的恰恰是两者是一回事：命运结出回响，回响又成了下一枚命运的前提。所以现在
 * 两种按比例交替填进同一串格子（见 `layoutHeads`）：一列里回响和命运上下相
 * 邻，链条仍然自上而下（画布向下就是时间向前），只是每两枚之间夹着别的东
 * 西 —— 连线因此非得穿过邻居，穿插是排出来的，不是画出来的。
 *
 * 列数和格宽还受「默认展示全局」约束：全局那一档的倍率就是「画布装进这一
 * 屏」，画布长宽比一旦离手机的 0.46 太远，短的那一维就空出一大片。二十九枚
 * 头节点按四列排是八行，内容高两千九百上下，格宽取 340（四列 1360）时长宽比
 * 0.465，正对着屏幕的 0.46 —— 全局那一档两头都不空。
 */
const COLS = 4;
const CELL_W = Math.round(272 * ZOOM);
const CELL_H = Math.round(256 * ZOOM);

/**
 * 每列整体上下错开 0–0.55 格，错多少由列号哈希定。
 *
 * 不错开的话二十多枚横着连成整齐的几排，一眼就是网格；固定错半格是另一种规
 * 律（一高一低的锯齿）。按列取一个确定性的偏移，既不成排也不成齿。
 */
const COL_STAGGER = 0.55;

/**
 * 头节点在格子里的游移幅度，按格宽/格高的比例算（`jitter` 收的是全幅，所以
 * 0.9 是 ±0.45 格）。
 *
 * 横向几乎游满一整格：相邻两列的落点区间因此重叠，看不出是四列 —— 代价是两
 * 枚可能撞上，落位之后过一遍 `relaxHeads` 推开。先放开摆、再推开，比一开始就
 * 把幅度压小好：压小了就又成列了。
 */
const HEAD_SPREAD_X = 0.9;
const HEAD_SPREAD_Y = 0.4;

/** 促成命运的小卡摆在它左上方 —— 蝶形下面挂着标题胶囊，正下方摆不开。 */
const DESTINY_NODE_DX = Math.round(-88 * ZOOM);
const DESTINY_NODE_DY = [Math.round(-88 * ZOOM), Math.round(-51 * ZOOM)] as const;
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
  /** 陆续到场的那一批：第几次到场之前先不显示（见 `LIVE_ARRIVALS`）。 */
  live?: number;
};

export type EchoFieldOrb = {
  story: EchoFieldEntry;
  x: number;
  y: number;
  /** 同 `EchoFieldNode.live`：这枚回响是看着它冒出来的。 */
  live?: number;
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
  /**
   * 最靠上那个东西的上沿（含它的光晕/胶囊）。
   *
   * 画布顶上有 `TOP_PAD` 一段空 —— 那是给第一行的簇摆它上方小卡用的，摆不满
   * 就是纯空白。开场取景要「内容贴着屏顶」，按画布 0 对齐会先怼进来七八十个
   * 像素的空，所以量一个真实的上沿出来（见 `EchoFieldScreen` 的 `homePan`）。
   */
  contentTop: number;
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
 * `destinies` 和回响交替占同一套格子，每枚也带自己的小卡（促成它的事件与时
 * 机）。它们和回响共享一套小卡渲染，只是归属指向命运而不是回响。
 *
 * `live` 是打开之后才陆续到场的那一批（见 `echo-live.ts`）。它们和常驻的一起
 * 参与排布、一起避位，只是每个都带上「属于第几次到场」的编号 —— 位置在这里就
 * 定死了，运行时只决定显不显示。反过来做（到场时再找位置）会把已经摆好的图挤
 * 动，那比不动更假。
 */
export function buildEchoField(
  stories: readonly EchoFieldEntry[],
  loose: readonly LooseEvent[] = [],
  destinies: readonly DestinyChainSeed[] = [],
  live: readonly LiveArrival[] = [],
): EchoField {
  /*
   * 把到场的那批混进常驻的两个列表里，同时记下谁是第几次到场：回响按 id 记，
   * 散件事件按它在合并后列表里的下标记（小卡 id 就是按这个下标拼的）。
   */
  const liveOrbSlot = new Map<string, number>();
  const liveLooseSlot = new Map<number, number>();
  const liveStories: EchoFieldEntry[] = [];
  const liveLoose: LooseEvent[] = [];
  live.forEach((arrival, slot) => {
    if (arrival.kind === "echo") {
      liveOrbSlot.set(arrival.echo.id, slot);
      liveStories.push(arrival.echo);
    } else {
      liveLooseSlot.set(loose.length + liveLoose.length, slot);
      liveLoose.push(arrival.event);
    }
  });
  const allStories = liveStories.length ? [...stories, ...liveStories] : stories;
  const allLoose = liveLoose.length ? [...loose, ...liveLoose] : loose;

  const { rows, heads } = layoutHeads(allStories, destinies);
  const width = COLS * CELL_W;
  /* 一列里的枚数不一定填满 `rows`，短的那列把间距摊开占满同样的高度。 */
  const span = rows * CELL_H;
  const contentHeight = TOP_PAD + span + Math.round(CELL_H * COL_STAGGER);
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
  const placedHeads = heads.map(({ ref, col, t }) => {
    const id = ref.kind === "echo" ? ref.story.id : ref.seed.id;
    return {
      ref,
      x: clampX(
        col * CELL_W + CELL_W / 2 + jitter(id, 1, CELL_W * HEAD_SPREAD_X),
      ),
      // 落点压在格距偏下，上方那一格半留给汇聚进来的小卡（会探进上一枚的地
      // 盘，正是设计稿那种交织感）。
      y: clampY(
        TOP_PAD +
          hash01(`col-${col}`, 7) * CELL_H * COL_STAGGER +
          t * span +
          jitter(id, 2, CELL_H * HEAD_SPREAD_Y),
      ),
    };
  });
  relaxHeads(placedHeads, clampX, clampY);

  for (const { ref, x, y } of placedHeads) {
    if (ref.kind === "echo")
      orbs.push({ story: ref.story, x, y, live: liveOrbSlot.get(ref.story.id) });
    else destinyPoints.push({ seed: ref.seed, x, y });
  }

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

  /*
   * 汇进回响的小卡。让位幅度压在四格以内 —— 它得看着还是这一簇的。
   *
   * 原先是两格。回响和命运混排之后，一枚回响的上方常常就是另一枚的小卡或那
   * 枚命运的标题胶囊，两格找不开的情形多了几处；四格约 170px，还在「同一
   * 簇」读得出来的范围内。
   */
  orbs.forEach(({ story, x: ox, y: oy, live: liveSlot }, i) => {
    const orb = { x: ox, y: oy };
    const template = NODE_TEMPLATES[i % NODE_TEMPLATES.length];
    story.nodes.slice(0, template.length).forEach((seed, ni) => {
      const slot = template[ni];
      place(
        {
          id: `${story.id}-n${ni}`,
          ownerId: story.id,
          // 促成它的那几张跟着这枚回响一起到场：果和因不该分两次出现。
          live: liveSlot,
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
        4,
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
          x: clampX(x + DESTINY_NODE_DX + jitter(seed.id, 30 + ni, 34)),
          y: clampY(y + DESTINY_NODE_DY[ni] + jitter(seed.id, 40 + ni, 22)),
          scale: ni === 0 ? SCALE_MID : SCALE_FAR,
        },
        3,
      );
    });
  });

  /*
   * 散件最后铺，铺在簇与簇的缝里：列比头节点多一列，于是每一列都落在两列头
   * 节点中间，横向铺满整张画布。
   *
   * 放最后、也给最大的让位幅度：它们是这张图里唯一没有归属的一批（不属于
   * 任何一枚回响或命运），挪远一点不损失任何意思，谁该让谁很清楚。
   */
  const looseCols = COLS + 1;
  const looseRows = Math.max(1, Math.ceil(allLoose.length / looseCols));
  const looseScales: readonly NodeScale[] = [
    SCALE_MID,
    SCALE_FAR,
    SCALE_FAR,
    SCALE_MID,
    SCALE_NEAR,
    SCALE_FAR,
  ];

  allLoose.forEach((seed, i) => {
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
        live: liveLooseSlot.get(i),
        x: clampX(
          (col + 0.5) * (width / looseCols) + jitter(key, 3, 90 * ZOOM),
        ),
        y: clampY(
          EDGE_Y +
            ((row + 0.4) / looseRows) * (contentHeight - EDGE_Y) +
            jitter(key, 4, CELL_H * 0.45),
        ),
        scale: looseScales[i % looseScales.length],
      },
      8,
    );
  });

  /* 真实上沿：`TOP_PAD` 那段空不算内容（见 `contentTop` 的说明）。 */
  const contentTop = Math.min(
    ...orbs.map((o) => o.y - ECHO_ORB_RADIUS),
    ...destinyPoints.map((d) => destinyRect(d).t),
    ...nodes.map((n) => nodeRect(n).t),
  );

  return {
    width,
    height,
    contentHeight,
    contentTop,
    orbs,
    destinies: destinyPoints,
    nodes,
  };
}

/**
 * 把挨太近的头节点互相推开。
 *
 * 判距用椭圆而不是圆：光球带光晕、命运下面还挂着标题胶囊，横向占的地方比竖
 * 向多得多，按圆算会把竖着叠在一起的两枚判成「够远」。
 *
 * 跑固定四遍，每遍两两互推一半的差额 —— 不追求收敛到绝对不重叠（那会把边上
 * 的几枚一路挤到画布外），只要把明显撞上的那几处松开。遍数和顺序都写死，所以
 * 结果是确定性的：星图每次打开长得一样。
 */
function relaxHeads(
  pts: { x: number; y: number }[],
  clampX: (x: number) => number,
  clampY: (y: number) => number,
): void {
  const RX = 152;
  const RY = 98;
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const a = pts[i];
        const b = pts[j];
        const dx = (b.x - a.x) / RX;
        const dy = (b.y - a.y) / RY;
        const d = Math.hypot(dx, dy);
        if (d === 0 || d >= 1) continue;
        const push = (1 - d) / 2;
        const ux = (dx / d) * push * RX;
        const uy = (dy / d) * push * RY;
        a.x = clampX(a.x - ux);
        a.y = clampY(a.y - uy);
        b.x = clampX(b.x + ux);
        b.y = clampY(b.y + uy);
      }
    }
  }
}

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

/** 格子里放的东西：一枚回响，或一枚命运。 */
type HeadRef =
  | { kind: "echo"; story: EchoFieldEntry }
  | { kind: "destiny"; seed: DestinyChainSeed };

/**
 * 把回响和命运排进同一套格子。
 *
 * 顺序由因果定（`orderByCause`）：谁的因排在谁前面。落位按列优先（先填满一列
 * 再换下一列），于是「因在前」在画布上就等于「因在上、或在左边那一列」—— 向
 * 下、向右就是时间向前，整张图共用这一个约定。按行优先就得反过来读，而链是竖
 * 着长的。
 *
 * 每列的枚数尽量匀（`base` / `extra`），短的那列把间距摊开占满同样的高度：不
 * 然最后一列到半截就没了，右下角空一大片。
 */
function layoutHeads(
  stories: readonly EchoFieldEntry[],
  destinies: readonly DestinyChainSeed[],
): {
  rows: number;
  heads: readonly { ref: HeadRef; col: number; t: number }[];
} {
  const seq = orderByCause(stories, destinies);
  const rows = Math.max(1, Math.ceil(seq.length / COLS));

  const base = Math.floor(seq.length / COLS);
  const extra = seq.length % COLS;
  const heads: { ref: HeadRef; col: number; t: number }[] = [];
  let i = 0;
  for (let col = 0; col < COLS; col += 1) {
    const count = base + (col < extra ? 1 : 0);
    for (let k = 0; k < count && i < seq.length; k += 1, i += 1) {
      heads.push({ ref: seq[i], col, t: (k + 0.62) / Math.max(1, count) });
    }
  }
  return { rows, heads };
}

/**
 * 把回响和命运排成一串：因在前，果在后，两种交替出现。
 *
 * 三种因果边一起进图（回响→回响、回响/命运→命运、命运→回响），拓扑排一遍。这
 * 一步同时解决两件原本打架的事：
 *
 *   • 混排。命运不再独占半张画布，而拓扑序天然把两种搅在一起 —— 一枚命运的因
 *     常常是回响，果又是另一枚回响，排出来就是交替的。
 *   • 因果方向。落位按列优先，「排在前」= 在上方或左边一列，所以每根连线都是
 *     从上往下、从左往右走，一眼看得出谁牵出了谁。
 *
 * 同时就绪的挑谁：按配额，回响和命运哪种落后取哪种（`wantEcho`），同种里保持
 * 原顺序。配额是让两种真的隔着出现 —— 光按就绪顺序取，十几枚回响会先扎堆。
 *
 * 万一数据出现环（约定上不该有：两边都只许往更早的条目指），就退化成「剩下的
 * 按原顺序排」，不死循环。
 */
function orderByCause(
  stories: readonly EchoFieldEntry[],
  destinies: readonly DestinyChainSeed[],
): readonly HeadRef[] {
  const refs = new Map<string, HeadRef>();
  for (const story of stories) refs.set(story.id, { kind: "echo", story });
  for (const seed of destinies) refs.set(seed.id, { kind: "destiny", seed });

  const causesOf = new Map<string, string[]>();
  const known = (id: string) => refs.has(id);
  const causes = (id: string) => {
    const list = causesOf.get(id);
    if (list) return list;
    const fresh: string[] = [];
    causesOf.set(id, fresh);
    return fresh;
  };
  for (const story of stories) {
    causes(story.id).push(...(story.causeEchoIds ?? []).filter(known));
  }
  for (const seed of destinies) {
    causes(seed.id).push(...(seed.causeIds ?? []).filter(known));
    // 命运声明的是「我促成了哪些回响」，方向反过来记一次。
    for (const echoId of seed.effectEchoIds ?? []) {
      if (known(echoId)) causes(echoId).push(seed.id);
    }
  }

  const left = new Set(refs.keys());
  const out: HeadRef[] = [];
  let echoes = 0;
  let taken = 0;
  while (left.size > 0) {
    const ready = [...left].filter((id) =>
      causes(id).every((c) => !left.has(c)),
    );
    const pool = ready.length > 0 ? ready : [...left];
    const wantEcho =
      (echoes + 0.5) / stories.length <=
      (taken - echoes + 0.5) / Math.max(1, destinies.length);
    const pick =
      pool.find((id) => (refs.get(id)!.kind === "echo") === wantEcho) ?? pool[0];

    const ref = refs.get(pick)!;
    out.push(ref);
    if (ref.kind === "echo") echoes += 1;
    taken += 1;
    left.delete(pick);
  }
  return out;
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
