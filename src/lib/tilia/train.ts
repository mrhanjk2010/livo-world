/**
 * 「和平号」车厢内部地图数据。
 *
 * 坐标系分两层，别混：
 *   • 本文件里**写下**的 `xPct` / `yPct` 是「段内坐标」—— 0..1 相对
 *     该房间所在那一节车厢的底图（`segment`，省略即主车厢）。
 *     加一节新车厢不会影响这些数值，这是分段的全部意义。
 *   • 本文件**导出**的 `ROOMS` / `STATIONS` 里的坐标已经解析成整幅
 *     画布坐标，消费方直接用，不要再解析第二次。
 * 段的定义与解析规则见 `train-segments.ts`。
 *
 * 主车厢底图是设计稿那张俯视平面图（`/figma/tilia/train-map.jpg`，
 * 原始 1600×1440）。其中三个房间（餐车 / 会客厅 / 音乐厅）和三个头像位
 * 是从设计稿 `3378:4318`「深色-潜在的命运」里反算出来的：设计稿把底图
 * 渲染成 984.5×1001（object-cover，实际图宽 1112）放在 375×812 的画布上，
 * 左上角落在 (-431.75, -189)。所以
 *     u = (屏幕x + 431.75) / 1112
 *     v = (屏幕y + 189)    / 1001
 * 这几个位置是「设计稿说了算」的锚点，其余房间是照着底图自己量的，
 * 命名风格对齐设计稿里那三个（两三个字、不带分隔符）。
 */

import {
  CAB_SEGMENT_ID,
  isSegmentGated,
  resolveOnSegment,
  resolveSegmentPoint,
  scaleSegmentDx,
  TRAIN_CANVAS_H,
  TRAIN_CANVAS_W,
  type SegmentPoint,
} from "@/lib/tilia/train-segments";

/** 整幅画布尺寸，交给 `PannableMap` 定宽高比。随车厢数增长。 */
export { TRAIN_CANVAS_H, TRAIN_CANVAS_W };

/**
 * 底图渲染倍率。设计稿的等效倍率是 1.233（渲染高 1001 / 画布高 812）；
 * 这里取 1.32，比设计稿再放大约 7%。
 *
 * 往上调是因为 V3.3 明确要求「增加地图面积」：1.233 时纵向只有 189px
 * 可拖，几乎等于锁死纵轴；1.32 给到 260px，二维拖拽才真的成立。往上
 * 调得太多也不行 —— 首屏是按设计稿的取景中心定的，倍率每大一点，
 * 离中心越远的地标就越往外推，1.42 时最左边的「音乐厅」名牌会被屏幕
 * 左沿切掉一截（设计稿里它的左边缘正好落在 x=8）。1.32 是两个约束
 * 的交点。
 *
 * 接新车厢不用重调：分段只让画布变宽，画布高度恒定，纵向取景不变。
 */
export const TRAIN_PAN_SCALE = 1.32;

/**
 * 首屏落地点。取自设计稿的取景中心（屏幕中心 187.5 / 406 反算），
 * X 再左移一点点补偿放大后的外推。于是首屏构图和设计稿基本重合：
 * 咖啡厅的「我」与散庭在画面中下，会客厅的施塔恩在右上，餐车名牌
 * 在正下方，音乐厅名牌贴着左沿但完整。
 *
 * 写成主车厢的段内锚点，所以无论后面接几节车，首屏都还是落在这里。
 */
const TRAIN_FOCUS_ANCHOR: SegmentPoint = {
  segment: "main",
  xPct: 0.552,
  yPct: 0.594,
};

const TRAIN_FOCUS = resolveSegmentPoint(TRAIN_FOCUS_ANCHOR);

export const TRAIN_FOCUS_X = TRAIN_FOCUS.xPct;
export const TRAIN_FOCUS_Y = TRAIN_FOCUS.yPct;

/* ────────────────────── pin 上的提醒角标 ────────────────────── */

/**
 * V3.3：「把之前在固定位置通过提醒气泡的提醒都放到了地图头像或者
 * 地标上，包括：出现了新角色、发生了新的命运/回响/见闻」。
 * 所以提醒不是一个全局浮层，而是挂在具体的 pin 上。
 */
export type PinAlert = "newcast" | "destiny" | "echo" | "sighting";

/** 角标的口径说明。注意不向用户暴露「因缘果」这套术语。 */
export const PIN_ALERT_LABEL: Record<PinAlert, string> = {
  newcast: "有新面孔上车了",
  destiny: "有一段命运可以触碰",
  echo: "这里起了新的回响",
  sighting: "这里有没见过的东西",
};

/* ─────────────────────────── 房间 ─────────────────────────── */

export type Room = {
  id: string;
  /** 两三个字的短名，对齐设计稿里的 餐车 / 会客厅 / 音乐厅。 */
  name: string;
  /** 房间所在车厢段，省略即主车厢。 */
  segment?: string;
  /**
   * 名牌落点。定义处写的是段内坐标；`ROOMS` 导出的是整幅画布坐标。
   */
  xPct: number;
  yPct: number;
  /** 公共车厢会一直亮着名牌；私人空间的名牌淡一档。 */
  tier: "public" | "private";
  /** 房间用途／场景说明，房间半层弹窗读它。 */
  blurb: string;
  /** 该房间当前是否挂着提醒角标。 */
  alert?: PinAlert;
};

/**
 * 房间的**授权数据**：坐标是段内坐标。加车厢时只在这里追加，
 * 已有条目一律不动。
 */
const ROOM_DEFS: readonly Room[] = [
  // ── 最上一排：四间头等包厢 ──
  {
    id: "suite-1",
    name: "一号包厢",
    xPct: 0.205,
    yPct: 0.165,
    tier: "private",
    blurb:
      "临着车头的第一间头等包厢，卧室连着一间小书房。窗外是维萨方向退去的风雪平原，写字台上的墨水会在夜里结出薄冰。",
  },
  {
    id: "suite-2",
    name: "二号包厢",
    xPct: 0.436,
    yPct: 0.165,
    tier: "private",
    blurb:
      "带独立起居室的包厢，绿绒长沙发和一张矮几。列车员说这间的暖气管道最粗，是全车最不怕冷的地方。",
  },
  {
    id: "suite-3",
    name: "三号包厢",
    xPct: 0.604,
    yPct: 0.165,
    tier: "private",
    blurb:
      "墨绿床品的包厢。门锁是全车唯一换过一次的——上一位住客在始发站前一夜临时退了票。",
  },
  {
    id: "suite-4",
    name: "四号包厢",
    xPct: 0.8,
    yPct: 0.165,
    tier: "private",
    blurb:
      "最靠车尾的头等包厢，圆桌配三把椅子，却只有一位住客。桌上摊着一叠反复写废的信纸，和一条叠得很整齐的丝巾。",
  },

  // ── 中部 ──
  {
    id: "promenade",
    name: "观景廊",
    xPct: 0.105,
    yPct: 0.44,
    tier: "public",
    blurb:
      "贴着车厢左壁的一排单人靠窗座。整趟旅程里风景变化最完整的地方：风雪、隘口、花季，都从这排窗子里依次经过。",
  },
  {
    /** 设计稿锚点：屏幕 (34, 304)。也就是钢琴、大提琴、弧形楼梯那一带。 */
    id: "music-hall",
    name: "音乐厅",
    xPct: 0.4188,
    yPct: 0.4925,
    tier: "public",
    blurb:
      "全车最大的公共空间。三角钢琴、地毯、大提琴，还有一段通往上层的弧形楼梯。夜话、演奏、以及所有不方便在包厢里说的话，都发生在这里。",
  },
  {
    /** 设计稿锚点：屏幕 (306, 247)。墙上挂鹿头标本的那间深色客厅。 */
    id: "parlour",
    name: "会客厅",
    xPct: 0.6634,
    yPct: 0.4356,
    tier: "public",
    blurb:
      "墙上挂着鹿头标本的深色客厅。皮沙发围成一圈，谈话声压得很低——这里的每一次「偶遇」大多都是安排好的。",
  },
  {
    id: "greenhouse",
    name: "温室",
    xPct: 0.863,
    yPct: 0.447,
    tier: "public",
    blurb:
      "两排绿植夹着一列靠窗座位的玻璃车厢。蜜兰庭送上车的花在这里越冬，是全车唯一闻不到煤烟味的地方。",
  },
  {
    id: "cafe",
    name: "咖啡厅",
    xPct: 0.575,
    yPct: 0.506,
    tier: "public",
    blurb:
      "四张小方桌的散座区，供应咖啡和热酒。白天没人，深夜坐满——大多是睡不着、又不想回包厢的人。",
  },
  {
    id: "study",
    name: "书房",
    xPct: 0.733,
    yPct: 0.549,
    tier: "private",
    blurb:
      "一间只放得下写字台和两把椅子的办公室。列车上所有正式文书都在这张台面上签发，包括各城随车官员之间的往来函件。",
  },
  {
    id: "tea-room",
    name: "茶室",
    xPct: 0.204,
    yPct: 0.664,
    tier: "private",
    blurb:
      "音乐厅旁边的小间，两张牌桌大小。用来接待不适合出现在大厅里的客人，门上没有编号。",
  },
  {
    id: "theater",
    name: "剧场",
    xPct: 0.361,
    yPct: 0.664,
    tier: "public",
    blurb:
      "成排红绒座椅对着一方小舞台，幕布是唯一没被战争征用过的丝绒。开演时全车最暗，也最方便看清别人的脸。",
  },
  {
    /** 设计稿锚点：屏幕 (185, 446)。长餐桌加几张方桌那一间。 */
    id: "dining",
    name: "餐车",
    xPct: 0.5547,
    yPct: 0.6344,
    tier: "public",
    blurb:
      "一张长餐桌加几张方桌。停靠每一座城之后都会开一次晚宴，座次表就是这趟列车上最直白的势力图。",
  },
  {
    id: "billiard",
    name: "台球室",
    xPct: 0.794,
    yPct: 0.667,
    tier: "public",
    blurb:
      "绿呢台球桌、一张牌桌、一排酒柜。赌注很少是钱——多半是消息、人情，或者某个人下一站会不会下车。",
  },

  // ── 最下一排：普通卧铺与乘务 ──
  {
    id: "berth-a",
    name: "卧铺甲",
    xPct: 0.2,
    yPct: 0.822,
    tier: "private",
    blurb:
      "成排上下铺的普通车厢。随行的记者、商队伙计、各城派来的低阶随员都睡在这里，帘子一拉就是全部隐私。",
  },
  {
    id: "berth-b",
    name: "卧铺乙",
    xPct: 0.5,
    yPct: 0.822,
    tier: "private",
    blurb:
      "第二节卧铺车厢，墨绿床品。靠车尾的几个铺位昨夜还空着，今早登记簿上多了名字。",
  },
  {
    id: "crew",
    name: "乘务室",
    xPct: 0.824,
    yPct: 0.822,
    tier: "private",
    blurb:
      "乘务长的值班间，兼作全车钥匙与行李清单的存放处。所有开箱检查的记录都从这张桌子上发出去。",
  },

  /* ─────────── 驾驶车厢（gated：说到车头、门开了才画） ───────────
   * 坐标是从 `train-map-cab.jpg`（1024×1024）上量的三行三列网格，
   * 名牌落在各室视觉中心稍下，避开控制台/炉口这些焦点。
   * 右下两间（水舱、灯具备件）是纯功能空间，不给名字。
   */
  {
    id: "cab-driver",
    name: "驾驶室",
    segment: CAB_SEGMENT_ID,
    xPct: 0.229,
    yPct: 0.245,
    tier: "public",
    blurb:
      "弧形控制台对着一整面前窗，风雪是正面扑上来的。黄铜手柄、压力表、两只转椅——整趟列车往哪儿去，是在这张台面上决定的。",
  },
  {
    id: "cab-boiler",
    name: "锅炉间",
    segment: CAB_SEGMENT_ID,
    xPct: 0.519,
    yPct: 0.245,
    tier: "private",
    blurb:
      "炉口一直是开的，橙光把地板烤出一圈焦痕。全车最热的地方，也是唯一听不清人说话的地方。",
  },
  {
    id: "cab-coal",
    name: "煤水舱",
    segment: CAB_SEGMENT_ID,
    xPct: 0.789,
    yPct: 0.235,
    tier: "private",
    blurb:
      "煤堆和一排麻袋。按里程算，撑得到万晁；按这几天的烧法，撑不到。司炉没往上报。",
  },
  {
    id: "cab-captain",
    name: "列车长室",
    segment: CAB_SEGMENT_ID,
    xPct: 0.229,
    yPct: 0.47,
    tier: "public",
    blurb:
      "一张写字台、一本摊开的行车日志、一整墙挂钥匙的木板。列车长在这里睡，也在这里决定哪一节车厢今晚不开灯。",
  },
  {
    id: "cab-telegraph",
    name: "电报室",
    segment: CAB_SEGMENT_ID,
    xPct: 0.519,
    yPct: 0.47,
    tier: "private",
    blurb:
      "报机、成卷的纸带、一墙贴了标签的档案。各城邦发来的电文先到这里，再决定谁看得到。",
  },
  {
    id: "cab-workshop",
    name: "机械间",
    segment: CAB_SEGMENT_ID,
    xPct: 0.789,
    yPct: 0.47,
    tier: "private",
    blurb:
      "工作台上摊着拆到一半的联轴器。备件架空了三格，登记簿上没写去哪儿了。",
  },
  {
    id: "cab-crew-berth",
    name: "乘务卧铺",
    segment: CAB_SEGMENT_ID,
    xPct: 0.226,
    yPct: 0.755,
    tier: "private",
    blurb:
      "两排窄铺，红毯子。司炉、副司机、检修工轮班睡在这里，被褥一直是温的——因为没人能连着睡满四个钟头。",
  },
];

/** 对外的房间表：坐标已是整幅画布坐标。 */
export const ROOMS: readonly Room[] = ROOM_DEFS.map(resolveOnSegment);

/** 这个房间是否还锁在未揭开的车厢里（未揭开时不该出现在地图/随机池）。 */
export function isRoomGated(room: Room): boolean {
  return isSegmentGated(room.segment);
}

/** 当前该出现在地图上的房间。 */
export function visibleRooms(includeGated: boolean): readonly Room[] {
  return includeGated ? ROOMS : ROOMS.filter((r) => !isRoomGated(r));
}

export const ROOM_BY_ID: Record<string, Room> = ROOMS.reduce<
  Record<string, Room>
>((acc, r) => {
  acc[r.id] = r;
  return acc;
}, {});

const ROOM_DEF_BY_ID: Record<string, Room> = ROOM_DEFS.reduce<
  Record<string, Room>
>((acc, r) => {
  acc[r.id] = r;
  return acc;
}, {});

/**
 * 在某个房间名牌附近取一个落点，偏移量按**段内**尺度给。
 *
 * 派生落点（命运标记「压在餐车左上方一点」之类）必须走它，别自己拿
 * `ROOM_BY_ID[id].xPct - 0.02` 去减：那个 0.02 是整幅画布的比例，车
 * 越接越长时视觉偏移就越缩越小。这里换算过，接几节车都是同样的手感。
 */
export function nearRoom(
  roomId: string,
  dxPct = 0,
  dyPct = 0,
): { xPct: number; yPct: number } {
  const def = ROOM_DEF_BY_ID[roomId];
  if (!def) return { xPct: 0.5, yPct: 0.5 };
  const resolved = ROOM_BY_ID[roomId]!;
  return {
    xPct: resolved.xPct + scaleSegmentDx(dxPct, def.segment),
    yPct: resolved.yPct + dyPct,
  };
}

/* ─────────────────────── 角色站位 ─────────────────────── */

/**
 * 头像里用哪张素材。设计稿只给了两张角色素材（「头像 1」的半身和
 * 「全身 1」的立绘）加一张用户的抽象光影图，四位男主只能两两复用 ——
 * 等美术补齐立绘后把这里换成各自的图即可，展示层不用改。
 */
export type PinArt = "char-a" | "char-b" | "you" | "renqingyi" | "santing";

export type Station = {
  /** 对应 `cast.ts` 里的 CastMember.id。 */
  memberId: string;
  roomId: string;
  /** 站位所在车厢段，省略即主车厢。 */
  segment?: string;
  /**
   * 头像圆心。定义处写的是段内坐标；`STATIONS` 导出的是整幅画布坐标。
   */
  xPct: number;
  yPct: number;
  art: PinArt;
  /**
   * 当前行为文案池，按 `BEHAVIOR_ROTATE_MS` 轮播。全部取自项目文档
   * 里该角色的人设与台词，不额外编造设定。
   */
  behaviors: readonly string[];
  /** 挂在头像上的提醒角标。 */
  alert?: PinAlert;
};

/** 行为文案轮播间隔。 */
export const BEHAVIOR_ROTATE_MS = 5_200;

/** 站位的授权数据：坐标是段内坐标。 */
const STATION_DEFS: readonly Station[] = [
  {
    /** 设计稿的「用户头像」位：屏幕 (242.5, 389.5)。 */
    memberId: "heroine",
    roomId: "cafe",
    xPct: 0.6063,
    yPct: 0.5779,
    art: "you",
    behaviors: [
      "隔着窗数还有几站",
      "把大衣内衬按了按",
      "又把父亲的信读了一遍",
      "默写那串记不牢的公式",
    ],
  },
  {
    /**
     * 设计稿的第一个「角色头像」位：屏幕 (191.5, 380.5)，紧挨着用户。
     * 放青梅竹马散庭·姚 —— 全车离她最近、也最不肯离开的那个人。
     */
    memberId: "santing",
    roomId: "cafe",
    xPct: 0.5605,
    yPct: 0.5689,
    art: "santing",
    behaviors: [
      "用单手一遍遍系那条丝巾",
      "把没写完的道歉信折起来",
      "看着你，又移开视线",
      "想起庭前那棵杏树",
    ],
  },
  {
    /** 设计稿的第二个「角色头像」位：屏幕 (300.5, 196.5)，会客厅。 */
    memberId: "staen",
    roomId: "parlour",
    xPct: 0.6585,
    yPct: 0.3851,
    art: "char-a",
    behaviors: [
      "核对下一站的护送名单",
      "把口琴收回上衣口袋",
      "在纸角画了只眼睛又划掉",
      "站在鹿头标本底下抽烟",
    ],
  },
  {
    memberId: "renqingyi",
    roomId: "dining",
    xPct: 0.48,
    yPct: 0.69,
    art: "renqingyi",
    behaviors: [
      "在长桌尽头替人斟酒",
      "用手套遮住手背的纹身",
      "谈一笔不亏的生意",
      "记着这趟车上谁欠他人情",
    ],
  },
  {
    memberId: "roland",
    roomId: "theater",
    xPct: 0.315,
    yPct: 0.7,
    art: "char-b",
    behaviors: [
      "坐在最后一排看戏",
      "在稿纸上写别人的名字",
      "数着散场时谁走得最急",
      "按了一下左胸口",
    ],
  },
];

/** 对外的站位表：坐标已是整幅画布坐标。 */
export const STATIONS: readonly Station[] = STATION_DEFS.map(resolveOnSegment);

/** roomId → 驻场角色，供房间弹窗的「此刻在场」区块使用。 */
export const STATIONS_BY_ROOM: Record<string, Station[]> = STATIONS.reduce<
  Record<string, Station[]>
>((acc, s) => {
  (acc[s.roomId] ??= []).push(s);
  return acc;
}, {});

/** memberId → 站位，世界动态里的头像要按它取素材。 */
export const STATION_BY_MEMBER: Record<string, Station> = STATIONS.reduce<
  Record<string, Station>
>((acc, s) => {
  acc[s.memberId] = s;
  return acc;
}, {});
