/**
 * 世界回响档案 —— 已经沉下去的那些回响，以及还没汇聚成任何东西的散件。
 *
 * 和 `SEED_ECHO_STORIES` 的分工：种子是「今天还挂在地图上」的回响，档案是
 * 前几日的，地图上早就不亮了，只在全屏星图里能翻到。同 `world-log.ts` 里
 * 动态档案的思路 —— 世界的记录比这次会话长。
 *
 * 散件（`LOOSE_EVENTS`）是刻意留的：星图里不是每个事件都已经汇聚成回响，
 * 也不该是。世界里发生的事本来就比长出结果的事多，那些还没接上任何一条线
 * 的光点，正是「还没发生化学反应」的部分。它们大多能在世界动态里找到同一
 * 句话 —— 同一件事的两种看法，不是两件事。
 *
 * 只留散件事件，不留散件时机：时机是世界自己的节拍，你推不动它，摆在图上
 * 只是一句读不出下一步的旁白。落进某枚回响的时机照旧留着 —— 那时它说明的
 * 是「那件事赶上了这个时候」。
 */

import type { EchoNodeSeed } from "@/lib/tilia/echo-story";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

/**
 * 星图只需要这些字段。种子 `EchoStory` 结构上就满足它，所以两边能混在
 * 一起喂给 `buildEchoField`；档案条目不必编造地图坐标（它们不在地图上）。
 */
export type EchoFieldEntry = {
  id: string;
  title: string;
  /** 半层里读的那一段。 */
  resultText: string;
  speakers: readonly FeedSpeaker[];
  roomId: string;
  nodes: readonly EchoNodeSeed[];
  /**
   * 汇聚进这条回响的、更早的回响。
   *
   * 果会变成因：一条回响沉下去之后，它本身也成了后来那些事的前提 ——
   * 钟慢了两分，名单才被重排；名单被重排，才有人整夜没睡。所以一枚回响
   * 的上游除了事件与时机，还可能是别的回响，链条能一路往回追。
   *
   * 只许指向更早的条目（在拼好的 stories 里排在自己前面），否则「谁是谁
   * 的因」就成了循环。
   */
  causeEchoIds?: readonly string[];
};

export const ECHO_ARCHIVE: readonly EchoFieldEntry[] = [
  {
    id: "echo-greenhouse",
    title: "蜜兰庭花提前开了",
    resultText:
      "花期本该在下一站之后。暖气管一夜没停，花在天亮前开了满架，香气顺着通风口漫到了隔壁车厢。",
    speakers: [{ kind: "world" }],
    roomId: "greenhouse",
    nodes: [
      { kind: "event", speakers: [{ kind: "world" }], text: "暖气管一夜没停" },
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "问过花什么时候开",
      },
      { kind: "moment", text: "进隘口前最后一个晴夜" },
    ],
  },
  {
    id: "echo-theater",
    title: "最后一排空了一个位置",
    resultText:
      "散场后清场的乘务员数了两遍座位。最后一排的绒布上留着一个人形的凹陷，久久没有弹回来。",
    speakers: [{ kind: "cast", memberId: "roland" }],
    roomId: "theater",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "roland" }],
        text: "在最后一排坐了整场",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "散场时回头看了一眼",
      },
      { kind: "moment", text: "散场的灯只灭了一半" },
    ],
  },
  {
    id: "echo-billiard",
    title: "记分牌没人去擦",
    resultText:
      "那个陌生名字在记分牌上留了三天。任轻义每次经过都会看一眼，又把球杆架回原处，谁也没提要擦掉。",
    speakers: [
      { kind: "npc", name: "乘务长" },
      { kind: "cast", memberId: "renqingyi" },
    ],
    roomId: "billiard",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "npc", name: "乘务长" }],
        text: "记分牌上多了个陌生名字",
      },
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "renqingyi" }],
        text: "把球杆架回了原处",
      },
      { kind: "moment", text: "过隘口时车身晃了一下" },
    ],
  },
  {
    id: "echo-study",
    title: "书页里夹着一张旧车票",
    resultText:
      "你把书按原样放回架上，票根却从中间滑了出来。日期是三年前，起点站的名字被指腹磨得只剩半个。",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
    roomId: "study",
    // 剧场那个久久没弹回来的凹陷，是这张票根被翻出来的前提。
    causeEchoIds: ["echo-theater"],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "把书按原样放回去",
      },
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "roland" }],
        text: "稿纸角落写着别人的名字",
      },
      { kind: "moment", text: "书房的窗霜结了一整夜" },
    ],
  },
  {
    id: "echo-crew",
    title: "乘务室的钟慢了两分",
    resultText:
      "广播比时刻表晚了两分钟响。乘务员把钟拨回来又拨回去，最后干脆让它慢着——反正无人之境没有站台要对。",
    speakers: [{ kind: "npc", name: "乘务员" }, { kind: "world" }],
    roomId: "crew",
    // 暖气管一夜没停 → 有人整夜在添煤 → 碳黑、以及那两分钟的偏差。
    causeEchoIds: ["echo-greenhouse"],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "npc", name: "乘务员" }],
        text: "碳黑粉末洒在地毯上",
      },
      {
        kind: "event",
        speakers: [{ kind: "world" }],
        text: "广播比时刻表晚了两分",
      },
      { kind: "moment", text: "进入无人之境的第一夜" },
    ],
  },
  {
    id: "echo-berth-a",
    title: "枕头下多了一枚铜扣",
    resultText:
      "不是你大衣上的那种。铜面被摩得很亮，边缘有一道新划痕，像是有人替你确认过什么之后忘了拿走。",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    roomId: "berth-a",
    // 时刻表对不上了，护送名单才跟着重排；铜扣是重排时留下的。
    causeEchoIds: ["echo-crew"],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "大衣内衬又摸了一遍",
      },
      {
        kind: "event",
        speakers: [
          { kind: "npc", name: "巡警" },
          { kind: "cast", memberId: "staen" },
        ],
        text: "护送名单又被改了一处",
      },
      { kind: "moment", text: "后半夜风声压过了轮轨声" },
    ],
  },
  {
    id: "echo-tea-room",
    title: "茶凉了也没人来收",
    resultText:
      "散庭·姚一个人在茶室待到很晚，那盏茶从头到尾没动。茶炉的火自己熄了，杯壁上留下一圈干掉的痕。",
    speakers: [{ kind: "cast", memberId: "santing" }],
    roomId: "tea-room",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "santing" }],
        text: "一个人在茶室待到深夜",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "只在门口站了站没进去",
      },
      { kind: "moment", text: "茶炉的火自己熄了" },
    ],
  },
  {
    id: "echo-berth-b",
    title: "卧铺乙的灯亮到天光",
    resultText:
      "半夜换过一次床单，之后灯就没再关。隔着门能听见有人在低声数数，数到某个数字停一下，又从头开始。",
    speakers: [{ kind: "npc", name: "乘务员" }, { kind: "you" }],
    roomId: "berth-b",
    // 有人替你确认过什么之后就没再睡 —— 那盏灯是铜扣的下一步。
    causeEchoIds: ["echo-berth-a"],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "npc", name: "乘务员" }],
        text: "半夜换过一次床单",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "隔着门听见有人数数",
      },
      { kind: "moment", text: "在无名站停了七分钟" },
    ],
  },
];

/**
 * 想让一件还在酝酿的事结出结果，你能做的一件具体的事。
 *
 * 只提「做什么」，不承诺「做了就成」—— 世界不是任务列表，说了那句话也
 * 可能什么都没发生。两种入口对应产品里真实存在的两个动作：
 *   • chat   → 去找那个人聊这件事
 *   • respond → 在「回应这一刻」里说出来
 */
export type LooseNudge = {
  kind: "chat" | "respond";
  /** 去聊的话，找谁；「回应这一刻」不需要。 */
  who?: string;
  text: string;
};

/**
 * 还没汇聚成回响的事件。
 *
 * 比别的节点亮一点、还能点开 —— 它们是这张星图上唯一「还没定下来」的部
 * 分，也就是唯一还能被你推一把的部分。`brewing` 是酝酿到了几分（0–1），
 * 演示数据，手写而非算出来的：有的刚起个头，有的就差一件事。
 */
export type LooseEventSeed = {
  speakers: readonly FeedSpeaker[];
  text: string;
  /** 酝酿进度 0–1。 */
  brewing: number;
  nudges: readonly LooseNudge[];
};

export const LOOSE_EVENTS: readonly LooseEventSeed[] = [
  {
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "santing" }],
    text: "杏子黄了，谁也不提旧事",
    brewing: 0.55,
    nudges: [
      { kind: "chat", who: "散庭·姚", text: "问他老家的杏子几月熟" },
      { kind: "respond", text: "说一句：今年的杏子该熟了" },
    ],
  },
  {
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    text: "他说那里风雪能吃人",
    brewing: 0.4,
    nudges: [
      { kind: "chat", who: "施塔恩", text: "让他讲讲当年是怎么走出来的" },
      { kind: "respond", text: "说一句：过隘口那晚我睡不着" },
    ],
  },
  {
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
    text: "一诺千金四个字落得很轻",
    brewing: 0.62,
    nudges: [
      { kind: "chat", who: "任轻义", text: "问他这四个字是替谁说的" },
      { kind: "respond", text: "说一句：我记着他那句承诺" },
    ],
  },
  {
    speakers: [{ kind: "cast", memberId: "roland" }, { kind: "you" }],
    text: "桌上多了份结婚申请",
    brewing: 0.3,
    nudges: [{ kind: "chat", who: "罗兰", text: "问他那份申请为什么还没交" }],
  },
  {
    speakers: [{ kind: "cast", memberId: "renqingyi" }],
    text: "手套拉得更严实了一点",
    brewing: 0.25,
    nudges: [{ kind: "chat", who: "任轻义", text: "问一句他手上的旧伤" }],
  },
  {
    speakers: [{ kind: "cast", memberId: "roland" }],
    text: "按住左胸口，又笑了笑",
    brewing: 0.7,
    nudges: [
      { kind: "chat", who: "罗兰", text: "问他是不是又疼了" },
      { kind: "respond", text: "说一句：他脸色不太对" },
    ],
  },
  {
    speakers: [{ kind: "cast", memberId: "staen" }],
    text: "在昏黄灯光下试着画了一笔",
    brewing: 0.35,
    nudges: [{ kind: "chat", who: "施塔恩", text: "请他把那张画完" }],
  },
  {
    speakers: [{ kind: "cast", memberId: "santing" }],
    text: "单臂替你系鞋带，又停住了",
    brewing: 0.8,
    nudges: [
      { kind: "chat", who: "散庭·姚", text: "谢他，也问那条空着的袖子" },
      { kind: "respond", text: "说一句：有人替我系了鞋带" },
    ],
  },
  {
    speakers: [{ kind: "npc", name: "乘务长" }],
    text: "琴盖合上，留了一指宽的缝",
    brewing: 0.45,
    nudges: [{ kind: "respond", text: "说一句：音乐厅的琴盖没合严" }],
  },
  {
    speakers: [{ kind: "you" }],
    text: "连着三夜没睡好",
    brewing: 0.5,
    nudges: [
      { kind: "chat", who: "施塔恩", text: "跟他说你睡不着" },
      { kind: "respond", text: "说一句：这三夜我总听见风" },
    ],
  },
  {
    speakers: [{ kind: "cast", memberId: "renqingyi" }, { kind: "cast", memberId: "roland" }],
    text: "牌桌上的赌注换成了消息",
    brewing: 0.6,
    nudges: [{ kind: "chat", who: "任轻义", text: "问他牌桌上换到了什么" }],
  },
  {
    speakers: [{ kind: "npc", name: "巡警" }],
    text: "在连接处站了一整夜",
    brewing: 0.28,
    nudges: [{ kind: "respond", text: "说一句：连接处那个人一夜没走" }],
  },
  {
    speakers: [{ kind: "cast", memberId: "santing" }, { kind: "world" }],
    text: "那条丝巾又系了一遍",
    brewing: 0.75,
    nudges: [{ kind: "chat", who: "散庭·姚", text: "问那条丝巾的来处" }],
  },
  {
    speakers: [{ kind: "cast", memberId: "staen" }],
    text: "口琴的铜面磨掉了漆",
    brewing: 0.42,
    nudges: [{ kind: "chat", who: "施塔恩", text: "问这把口琴跟了他多久" }],
  },
  {
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
    text: "他把新写的一页递给了你",
    brewing: 0.68,
    nudges: [
      { kind: "chat", who: "罗兰", text: "读完那页，告诉他你想到了谁" },
      { kind: "respond", text: "说一句：那一页我读完了" },
    ],
  },
  {
    speakers: [
      { kind: "you" },
      { kind: "cast", memberId: "staen" },
      { kind: "cast", memberId: "renqingyi" },
    ],
    text: "今晚夜话的座次定了",
    brewing: 0.58,
    nudges: [{ kind: "respond", text: "说一句：今晚我想坐在窗那边" }],
  },
  {
    speakers: [{ kind: "npc", name: "乘务员" }],
    text: "把煤铲靠回了炉边",
    brewing: 0.22,
    nudges: [{ kind: "respond", text: "说一句：炉膛的火压得很低" }],
  },
  {
    speakers: [{ kind: "world" }],
    text: "餐车的空位比昨天多两个",
    brewing: 0.33,
    nudges: [{ kind: "respond", text: "说一句：餐车又空了两个位子" }],
  },
];
