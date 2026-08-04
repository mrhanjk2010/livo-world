/**
 * 命运涌现流 —— 「世界背面」中间那张卡里滚过去的那些行。
 *
 * 和上面那张（`world-log-recording.ts`）的分工：那张说世界在算，这张说算出来的东西
 * 正一枚枚落地。命运不是等你走到某个房间才生成的，它一直在别处发生 —— 你没在
 * 场的时候，灯照样亮、名单照样重排、有人照样把手套摘了。这张卡就是那些「你不
 * 在场的命运」的账。
 *
 * 一行四截：
 *
 *   state  起 / 酝 / 定 / 散 —— 一枚命运的四种动静
 *   room   落在哪节车厢，写成 id 的样子（给机器看的那半截）
 *   title  命运的短名，和地图胶囊上那个一致
 *   note   说人话的那半句
 *
 * 内容手写，不是拼的：拼出来的行读两遍就露馅，而这张卡会一直滚。名字和地点都
 * 咬着 `destiny-archive.ts` 与 `echo-archive.ts` 里那些真事 —— 同一个世界的两
 * 种看法，不是两个世界。
 */

/** 一枚命运此刻的动静。 */
export type DestinyState =
  /** 起：世界刚把它摆上来。 */
  | "spawn"
  /** 酝：还在长，带一个进度。 */
  | "brew"
  /** 定：条件齐了，它一定会发生。 */
  | "lock"
  /** 散：窗口过去了，这一枚不会再有下文。 */
  | "fade";

export type DestinyLine = {
  state: DestinyState;
  /** 潜在还是注定 —— 决定这一行的冷暖。`fade` 两种都退成灰。 */
  kind: "potential" | "destined";
  /** 车厢 id，照 `train.ts` 那套写法。 */
  room: string;
  title: string;
  note: string;
  /** 只有 `brew` 有：酝酿到了几分（0–1）。 */
  at?: number;
};

/** 每行前面那个时刻的起点（当天的分钟数）。 */
export const DESTINY_CLOCK_START = 6 * 60 + 18;

export const DESTINY_LOG: readonly DestinyLine[] = [
  {
    state: "spawn",
    kind: "potential",
    room: "music-hall",
    title: "夜场余音",
    note: "灯在第二晚亮了",
  },
  {
    state: "brew",
    kind: "potential",
    room: "tea-room",
    title: "小提琴",
    note: "弓松了半圈，是给人用的松法",
    at: 0.68,
  },
  {
    state: "lock",
    kind: "potential",
    room: "dining",
    title: "巡警检查",
    note: "第十日进安检区段",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "cab-driver",
    title: "藏进车头",
    note: "锁了十天的折棚门开了",
  },
  {
    state: "fade",
    kind: "potential",
    room: "promenade",
    title: "雪线合影",
    note: "隘口过完了，谁也没举相机",
  },
  {
    state: "brew",
    kind: "potential",
    room: "promenade",
    title: "那半段曲子",
    note: "后半段留给活着回去的人",
    at: 0.41,
  },
  {
    state: "lock",
    kind: "destined",
    room: "crew",
    title: "护送名单",
    note: "排到第三遍才对上",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "crew",
    title: "换上来的那个人",
    note: "后半夜那班换了人",
  },
  {
    state: "brew",
    kind: "potential",
    room: "study",
    title: "旧车票",
    note: "起点站磨得只剩半个字",
    at: 0.55,
  },
  {
    state: "spawn",
    kind: "potential",
    room: "promenade",
    title: "窗霜上的字",
    note: "写完又用袖口按住了",
  },
  {
    state: "brew",
    kind: "potential",
    room: "cafe",
    title: "那条丝巾",
    note: "第三遍才算系正",
    at: 0.74,
  },
  {
    state: "lock",
    kind: "destined",
    room: "billiard",
    title: "牌桌的赌注",
    note: "记分牌上留了个不在车上的名字",
  },
  {
    state: "spawn",
    kind: "destined",
    room: "billiard",
    title: "摘手套的那一杆",
    note: "皮头连滑三次之后",
  },
  {
    state: "brew",
    kind: "potential",
    room: "theater",
    title: "小说家",
    note: "那一页折了两折",
    at: 0.63,
  },
  {
    state: "fade",
    kind: "potential",
    room: "greenhouse",
    title: "花开那一夜",
    note: "花提前开了，没人在场",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "tea-room",
    title: "空着的那只杯",
    note: "茶炉边多备了一只",
  },
  {
    state: "brew",
    kind: "potential",
    room: "crew",
    title: "认领那只箱子",
    note: "行李架上放了三天没人认",
    at: 0.37,
  },
  {
    state: "lock",
    kind: "potential",
    room: "parlour",
    title: "夜话的座次",
    note: "今晚谁坐窗那边定了",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "cab-driver",
    title: "整夜添煤的人",
    note: "他没离开过炉边",
  },
  {
    state: "brew",
    kind: "potential",
    room: "crew",
    title: "划掉的那一行",
    note: "名单上被划了两遍",
    at: 0.46,
  },
  {
    state: "fade",
    kind: "potential",
    room: "promenade",
    title: "无名站的七分钟",
    note: "停够了，谁也没下车",
  },
  {
    state: "spawn",
    kind: "destined",
    room: "billiard",
    title: "一诺千金",
    note: "那四个字落得很轻",
  },
  {
    state: "brew",
    kind: "potential",
    room: "theater",
    title: "左胸口那一下",
    note: "他按住，又笑了笑",
    at: 0.7,
  },
  {
    state: "lock",
    kind: "destined",
    room: "cafe",
    title: "单臂系鞋带",
    note: "系完才起身，没让你谢",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "promenade",
    title: "口琴的铜面",
    note: "漆磨掉了一块",
  },
  {
    state: "brew",
    kind: "potential",
    room: "cafe",
    title: "今年的杏子",
    note: "熟了，谁也不提旧事",
    at: 0.55,
  },
  {
    state: "fade",
    kind: "potential",
    room: "berth-b",
    title: "那盏没关的灯",
    note: "天光之前它自己灭了",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "dining",
    title: "连接处站着的人",
    note: "他一夜没走",
  },
  {
    state: "brew",
    kind: "potential",
    room: "study",
    title: "递过来的那一页",
    note: "你读完了，还没答他",
    at: 0.68,
  },
  {
    state: "lock",
    kind: "destined",
    room: "berth-a",
    title: "隘口那一晚",
    note: "风声压过了轮轨声",
  },
  {
    state: "spawn",
    kind: "potential",
    room: "greenhouse",
    title: "半夜响的那声",
    note: "暖气管响过之后没人去看",
  },
  {
    state: "brew",
    kind: "potential",
    room: "music-hall",
    title: "留了一指宽的缝",
    note: "琴盖没合严，不是谁忘了",
    at: 0.45,
  },
];
