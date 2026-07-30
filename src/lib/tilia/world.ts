/**
 * 《蒂利亚之冬》世界地图数据 — 大陆城邦、势力派系、和平号航线。
 *
 * 数据来源：《蒂利亚之冬项目介绍及830版本规划.xlsx》
 *   • 城邦简介 / 资源图标 ← 表格内嵌「世界地图」示意图
 *   • 派系倾向 / 核心诉求 / 可采取的行动 ← 表格内嵌「XK-101 势力诉求」表
 *
 * 坐标系：地图画布为 `CANVAS_W × CANVAS_H` 的抽象大陆，城邦位置用
 * 0..1 归一化百分比表达（`xPct` / `yPct`），由 `PannableMap` 按渲染
 * 尺寸等比缩放。原示意图是「北带 + 南带」双横带布局、冷（左/极北）
 * → 暖（右/百花）的轴向，这里保留了同样的读图方向。
 */

/** 抽象大陆画布尺寸。宽高比决定地图在手机框里的横向可拖拽余量。 */
export const CANVAS_W = 1240;
export const CANVAS_H = 760;

/* ─────────────────────────── 资源 ─────────────────────────── */

/** 示意图图例里的五类城邦资源。 */
export type ResourceKey =
  | "military"
  | "economy"
  | "culture"
  | "mineral"
  | "nature";

export const RESOURCE_LABEL: Record<ResourceKey, string> = {
  military: "军事",
  economy: "经济",
  culture: "文化",
  mineral: "矿藏/石油",
  nature: "天然资源",
};

/* ─────────────────────────── 派系 ─────────────────────────── */

export type FactionId =
  | "private-dev"
  | "private-panic"
  | "private-despair"
  | "private-revenge"
  | "public-eager"
  | "public-neighbor"
  | "neutral-watch"
  | "vassal";

export type Faction = {
  id: FactionId;
  /** 完整派系标签，如「私有派（研发方）」。 */
  label: string;
  /** 两字归类，用于地图上的极简徽标。 */
  camp: "私有" | "公有" | "观望" | "依附";
  /** 节点与卡片的主色。 */
  accent: string;
  /** 对 XK-101 的核心诉求。 */
  demand: string;
  /** 在列车上/针对女主可采取的行动。 */
  actions: string;
};

export const FACTIONS: Record<FactionId, Faction> = {
  "private-dev": {
    id: "private-dev",
    label: "私有派（研发方）",
    camp: "私有",
    accent: "#E3B341",
    demand:
      "确保独占。完成研究，成为终极威慑者，维持北境联邦甚至是整片大陆的领导地位。",
    actions:
      "监视、控制、调包。确保试剂无法运抵万晁并控制在自己手中，罗兰是最终执行者。",
  },
  "private-panic": {
    id: "private-panic",
    label: "私有派（恐慌方）",
    camp: "私有",
    accent: "#C1435B",
    demand:
      "得到或毁掉，绝不能容忍被一方独占。自身经济科技落后，无法承受新一轮失衡。",
    actions:
      "拦截、抢夺，万不得已会选择摧毁。总之不能让试剂成为歌德恩和万晁的独有（哪怕交好）。",
  },
  "private-despair": {
    id: "private-despair",
    label: "私有派（绝望方）",
    camp: "私有",
    accent: "#8E2438",
    demand:
      "必须得到。这是打破政治封锁、实现绝地翻盘、重回牌桌的唯一一筹码。行动会更加不择手段。",
    actions:
      "潜伏、窃取、或者公有。他们会动用一切隐藏力量得知 XK-101 的一切消息。",
  },
  "private-revenge": {
    id: "private-revenge",
    label: "私有派（复仇方）",
    camp: "私有",
    accent: "#B4622C",
    demand:
      "得到或毁掉，渴望重塑军事辉煌，或至少让大家都别好过。行动会非常隐秘和危险。",
    actions:
      "破坏、抢夺。他们可能是列车上最不可预测的一部分。对战胜城市的憎恨、对自己无能的憎恨、对于屈居人下的憎恨，很可能导致做出很疯狂的举动。",
  },
  "public-eager": {
    id: "public-eager",
    label: "公有派（渴望方）",
    camp: "公有",
    accent: "#2E9E6B",
    demand:
      "这是摆脱技术制裁、防止被瓜分、重新与北方巨头平起平坐的唯一希望。势在必行，能私有还是优先私有。",
    actions:
      "接应、保护。这是女主的家，但如果女主要做出一些有损城邦利益的事情，也会出手干预。",
  },
  "public-neighbor": {
    id: "public-neighbor",
    label: "公有派（自救方）",
    camp: "公有",
    accent: "#2C8C8C",
    demand: "最好毁掉。总之绝不能让这玩意在自己家门口被制造出来。",
    actions: "为了自救，会暗中帮助破坏者。",
  },
  "neutral-watch": {
    id: "neutral-watch",
    label: "观望派",
    camp: "观望",
    accent: "#8A6BC1",
    demand:
      "不关心武器，只关心合作，谁能帮我解决海盗问题，我就跟谁关系好一点。化学试剂别在我的地盘用就行。",
    actions: "事不关己。",
  },
  vassal: {
    id: "vassal",
    label: "依附派（实际都是公有）",
    camp: "依附",
    accent: "#4C7FB8",
    demand:
      "信息共享，等待老大哥（维萨／歌德恩）的消息，分一杯羹，但暗暗都希望它公有。",
    actions:
      "协助监视、传递情报。车上可能有他们的外交官或情报人员，为各自的大哥提供辅助，但看到试剂公开的机会时，也可能会暗暗帮助。",
  },
};

/* ─────────────────────────── 城邦 ─────────────────────────── */

export type CityTier =
  /** 大国／主要城邦，地图上显示全称与资源。 */
  | "capital"
  /** 附庸小城，地图上只显示名字。 */
  | "satellite";

export type City = {
  id: string;
  name: string;
  /** 别称／官方名，仅少数城邦有。 */
  aka?: string;
  xPct: number;
  yPct: number;
  tier: CityTier;
  factionId: FactionId;
  /** 示意图卡片上的城邦简介。 */
  blurb: string;
  resources: readonly ResourceKey[];
  /**
   * 和平号停靠顺序（1 起）。未设置表示列车不停靠，只是途经或相邻
   * 势力 —— 但依然可点开看势力诉求，因为他们的人可能就在车上。
   */
  stop?: number;
};

/**
 * 城邦坐标沿用示意图的双横带读法：
 *   北带（yPct ≈ 0.13–0.32）＝ 极北与中部，冷；
 *   南带（yPct ≈ 0.56–0.76）＝ 南方大陆，越往右越暖。
 * 左端是极北维萨（❄️），右端是百花盛开的万晁（☀️）。
 *
 * 每条带内部刻意做了 y 的错落（不是一条直线排开），一是更像真实
 * 海岸线，二是让密集区的名牌不会横向撞在一起。两带之间留出的
 * yPct 0.36–0.52 是海峡，雪山隘口横在其中 —— 也就是列车南下必须
 * 穿过的那道地形。
 */
export const CITIES: readonly City[] = [
  // ── 北带 ──
  {
    id: "weisa",
    name: "维萨",
    xPct: 0.095,
    yPct: 0.235,
    tier: "capital",
    factionId: "private-panic",
    blurb:
      "北境联国，非北境联邦成员，靠近极地的地方，背后是风雪平原和一望无际的大海，所有内陆进出口都需要通过歌德恩。",
    resources: ["military", "culture", "mineral"],
    stop: 1,
  },
  {
    id: "north-c",
    name: "北境联邦小弟C",
    xPct: 0.235,
    yPct: 0.135,
    tier: "satellite",
    factionId: "vassal",
    blurb: "穷，但听大哥的话，喜欢搞事情，只希望北境联邦能倾斜更多资源。",
    resources: ["economy", "nature"],
  },
  {
    id: "goden",
    name: "歌德恩",
    xPct: 0.355,
    yPct: 0.315,
    tier: "capital",
    factionId: "private-dev",
    blurb:
      "北境联邦 No.1。经济及军事强盛，利益至上，小弟众多，与维萨彼此提防，互相牵制。",
    resources: ["military", "economy"],
    stop: 2,
  },
  {
    id: "milanting",
    name: "蜜兰庭",
    xPct: 0.6,
    yPct: 0.185,
    tier: "capital",
    factionId: "neutral-watch",
    blurb:
      "大陆最美的鲜花之地，国境狭长。文化经济无出其右，是整片大陆闻名的花城、旅行胜地，立场中立。",
    resources: ["culture", "economy", "nature"],
    stop: 3,
  },
  {
    id: "neutral-a",
    name: "中立小伙伴A",
    xPct: 0.775,
    yPct: 0.135,
    tier: "satellite",
    factionId: "neutral-watch",
    blurb: "遗世独立的旅游胜地，惹不起附近的穷地方。",
    resources: [],
  },
  {
    id: "neutral-b",
    name: "中立小伙伴B",
    xPct: 0.795,
    yPct: 0.315,
    tier: "satellite",
    factionId: "neutral-watch",
    blurb: "虽然很穷，但是很有文化底蕴，和万晁交好。",
    resources: ["culture"],
  },

  // ── 南带 ──
  {
    id: "weisa-a",
    name: "维萨小伙伴A",
    xPct: 0.075,
    yPct: 0.575,
    tier: "satellite",
    factionId: "vassal",
    blurb: "环境经济都非常恶劣，但石油丰富，依附维萨。",
    resources: ["mineral"],
  },
  {
    id: "weisa-b",
    name: "维萨小伙伴B",
    xPct: 0.08,
    yPct: 0.735,
    tier: "satellite",
    factionId: "vassal",
    blurb: "环境经济都非常恶劣，但天然资源丰富，依附维萨。",
    resources: ["nature"],
  },
  {
    id: "north-b",
    name: "北境联邦小弟B",
    xPct: 0.195,
    yPct: 0.6,
    tier: "satellite",
    factionId: "vassal",
    blurb:
      "祖上和维萨交好，虽然加入北境联邦，但始终想和维萨保持良好关系。",
    resources: ["mineral", "nature"],
  },
  {
    id: "north-a",
    name: "北境联邦小弟A",
    xPct: 0.19,
    yPct: 0.76,
    tier: "satellite",
    factionId: "vassal",
    blurb: "穷，但听大哥的话，总体来说民风很淳朴。",
    resources: ["mineral", "nature"],
  },
  {
    id: "dcheng",
    name: "D 城",
    aka: "赫斯曼",
    xPct: 0.335,
    yPct: 0.665,
    tier: "capital",
    factionId: "private-despair",
    blurb:
      "曾经很强大，战败后经济萎靡，但文化和军事科技底蕴丰厚，静待时机。目前很需要经济支持，向歌德恩出让石油开采权，近期或将加入北境联邦。",
    resources: ["military", "culture", "economy", "mineral"],
  },
  {
    id: "d-vassal",
    name: "D 的小弟",
    xPct: 0.445,
    yPct: 0.565,
    tier: "satellite",
    factionId: "private-despair",
    blurb: "几个世纪前和 D 城是一家。",
    resources: [],
  },
  {
    id: "yating-colony",
    name: "鸦汀曾经的殖民地",
    xPct: 0.5,
    yPct: 0.76,
    tier: "satellite",
    factionId: "private-revenge",
    blurb: "鸦汀昔日的殖民地，至今仍在旧宗主的阴影里。",
    resources: [],
  },
  {
    id: "wanchao-a",
    name: "万晁的小伙伴A",
    xPct: 0.565,
    yPct: 0.6,
    tier: "satellite",
    factionId: "public-neighbor",
    blurb: "曾经被鸦汀侵略，被万晁所救。",
    resources: [],
  },
  {
    id: "yating",
    name: "鸦汀",
    xPct: 0.665,
    yPct: 0.75,
    tier: "capital",
    factionId: "private-revenge",
    blurb:
      "资源匮乏，常年依靠掠夺周边小城养活自己。战败后收敛较为老实，暂时没有什么能拿得出手的东西。",
    resources: [],
    stop: 4,
  },
  {
    id: "wanchao",
    name: "万晁",
    xPct: 0.795,
    yPct: 0.645,
    tier: "capital",
    factionId: "public-eager",
    blurb:
      "地大物博，历史悠久。以和为贵，各类资源丰富，但开采科技尚不成熟。战后虽然亟需休养生息，却也被各方虎视眈眈，不可放松。",
    resources: ["military", "culture", "nature"],
    stop: 5,
  },
  {
    id: "wanchao-b",
    name: "万晁的小伙伴B",
    xPct: 0.905,
    yPct: 0.575,
    tier: "satellite",
    factionId: "public-eager",
    blurb:
      "因地理原因，一直被大哥很好地保护着，文化底蕴不错，天然资源也不错。",
    resources: ["nature", "culture"],
  },
];

export const CITY_BY_ID: Record<string, City> = CITIES.reduce<
  Record<string, City>
>((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

/* ─────────────────────── 和平号航线 ─────────────────────── */

/** 停靠站按顺序排列，供底部航线进度条与站点徽标使用。 */
export const ROUTE_STOPS: readonly City[] = CITIES.filter(
  (c) => c.stop !== undefined,
).sort((a, b) => (a.stop ?? 0) - (b.stop ?? 0));

/**
 * 站点徽标文案 —— 始发/终点单独命名，中间站用序号。
 */
export function stopLabel(city: City): string | null {
  if (city.stop === undefined) return null;
  if (city.stop === 1) return "和平号 · 始发站";
  if (city.stop === ROUTE_STOPS.length) return "和平号 · 终点站";
  return `和平号 · 第 ${city.stop} 站`;
}

type Point = { x: number; y: number };

/**
 * 航线控制点。停靠站写成 `{ stop: id }` 由城邦坐标解析，纯造型点写
 * 成画布像素 —— 这样调整城邦位置时航线自动跟随，不会出现「线画在
 * 这、站点在那」的漂移；造型点只负责让线路绕开名牌、并在中段贴着
 * 雪山隘口下行，读起来像一条真实铁路而不是几段直连。
 */
type RouteNode = { stop: string } | Point;

const ROUTE_NODES: readonly RouteNode[] = [
  { stop: "weisa" }, // 始发
  { x: 272, y: 232 },
  { stop: "goden" },
  { x: 560, y: 236 }, // 绕过雪山隘口西侧
  { stop: "milanting" },
  { x: 888, y: 258 },
  { x: 890, y: 452 },
  { stop: "yating" },
  { x: 930, y: 592 },
  { stop: "wanchao" }, // 终点
];

function resolveNode(n: RouteNode): Point {
  if ("stop" in n) {
    const c = CITY_BY_ID[n.stop];
    return { x: c.xPct * CANVAS_W, y: c.yPct * CANVAS_H };
  }
  return n;
}

const ROUTE_POINTS: readonly Point[] = ROUTE_NODES.map(resolveNode);

/**
 * Catmull-Rom → 三次贝塞尔。保证曲线严格穿过每个控制点，所以改动
 * 城邦坐标后航线会自动跟随，不用手工重调 path 字符串。
 */
function smoothPath(pts: readonly Point[]): string {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // 1/6 是标准 Catmull-Rom 张力，视觉上圆润但不过冲。
    const t = 1 / 6;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(
        1,
      )}, ${p2.x} ${p2.y}`,
    );
  }
  return d.join(" ");
}

/** 和平号航线的 SVG path（画布坐标系，viewBox 0 0 CANVAS_W CANVAS_H）。 */
export const ROUTE_PATH = smoothPath(ROUTE_POINTS);

/* ─────────────────────── 雪山隘口 ─────────────────────── */

/**
 * 示意图中部那座雪山 —— 列车从维萨往南必须穿过的隘口，也是
 * 「风雪覆盖来路」这句人物注解的地理来源。
 *
 * 刻意摆在南北两带之间的海峡里（画布 y 约 300–400），一是符合示意
 * 图里山脉横亘中部的位置，二是把两带之间那段空白填上，避免地图中段
 * 看起来像没画完。
 */
export const SNOW_RANGE: readonly { x: number; y: number; w: number; h: number }[] =
  [
    { x: 556, y: 336, w: 74, h: 58 },
    { x: 604, y: 312, w: 98, h: 82 },
    { x: 676, y: 344, w: 66, h: 50 },
    { x: 726, y: 356, w: 48, h: 38 },
  ];
