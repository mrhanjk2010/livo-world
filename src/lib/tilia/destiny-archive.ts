/**
 * 命运档案 —— 已经走完的那几枚命运，只在全屏「世界背面」星图里能翻到。
 *
 * 和 `DESTINY_MARKERS` 的分工：那张表是「此刻还挂在地图上、点进去能聊」的
 * 命运；这里是走完之后沉下来的记录。同 `echo-archive.ts` 对回响的分工。
 *
 * 最长那条是演示主线本身（手机框左侧那段脚本的第 1–14 步）：一句回应引出音
 * 乐厅的夜场，夜场里聊到小提琴，琴在一周后的开箱检查里替你挡了一次，检查散
 * 场才有了去车头的念头。原来这条线只在旁边的文字里讲，星图里看不见 —— 现在
 * 把它摆进去，因果就不只是一句说明。
 *
 * 另外几条是早几日的：牌桌、名单、小说家的那页稿纸、丝巾、值夜、口琴。它们
 * 都咬在既有的回响上 —— 有的是某枚回响的因，有的反过来由回响牵出来，还有几
 * 条自己就是两节的链。主线一条孤零零挂在那儿的话，「命运会互相牵」这件事就
 * 只是特例；几条并排着，才看得出这是世界的常态。
 *
 * 三种边同时存在，这是这张图想说的全部：
 *
 *   事件 → 命运     促成它的那些具体动作（挂在它旁边的小卡）
 *   命运 → 命运     前一枚的果成了后一枚的因
 *   命运 → 回响     它走完之后，世界里沉下来的那点余响
 *
 * 最后一枚（藏进车头）刻意不给果：它是最新的一枚，还没结出东西来。链条留在
 * 敞开的状态，比补一个圆满的结尾更像真的。
 */

import type { DestinyKind } from "@/lib/tilia/destiny-markers";
import type { EchoNodeSeed } from "@/lib/tilia/echo-story";
import type { FeedSpeaker } from "@/lib/tilia/world-feed";

export type DestinyChainSeed = {
  id: string;
  /** 短名，和地图胶囊上那个一致。 */
  title: string;
  kind: DestinyKind;
  speakers: readonly FeedSpeaker[];
  roomId: string;
  /** 半层里读的那一段：这枚命运走完之后留下了什么。 */
  outcomeText: string;
  /** 促成它的事件与时机，摆在它旁边。 */
  nodes: readonly EchoNodeSeed[];
  /**
   * 上游：更早的命运，或更早的回响。
   *
   * 只许指向比自己更早的东西 —— 回响档案排在命运之前，命运之间按数组顺序
   * 排，所以往前指天然不会成环。
   */
  causeIds?: readonly string[];
  /**
   * 下游：它促成的回响。
   *
   * 方向反过来由命运这一侧声明，而不是去改回响的 `causeEchoIds` —— 回响那边
   * 的约束是「只指向更早的条目」，而命运在时间上比它促成的回响更早，从回响
   * 往回指就会和那条约束打架。
   */
  effectEchoIds?: readonly string[];
};

export const DESTINY_CHAIN: readonly DestinyChainSeed[] = [
  {
    id: "destiny-billiard",
    title: "牌桌的赌注",
    kind: "destined",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
    roomId: "billiard",
    outcomeText:
      "那一局到最后谁也没报分。任轻义在记分牌上写下一个不在车上的名字，说这局是替人打的——之后谁经过都只看一眼。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
        text: "在牌桌边坐到散场",
      },
      { kind: "moment", text: "进隘口前那一局没打完" },
    ],
    effectEchoIds: ["echo-billiard"],
  },
  {
    id: "destiny-gloves",
    title: "摘手套的那一杆",
    kind: "destined",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
    roomId: "billiard",
    outcomeText:
      "皮头连滑三次，第四次他把左手手套摘了。你什么也没问，他也没解释——那一杆进了，之后他再没摘过。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "陪他把那一局打完",
      },
      { kind: "moment", text: "皮头连滑三次之后" },
    ],
    causeIds: ["destiny-billiard"],
    effectEchoIds: ["echo-gloves"],
  },
  {
    id: "destiny-harmonica",
    title: "那半段曲子",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    roomId: "promenade",
    outcomeText:
      "你说想听他吹完，他说后半段是给活着回去的人吹的。第二天后半夜，观景廊真的响了半段——他没说会是什么时候。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
        text: "在观景廊等他吹完",
      },
      { kind: "moment", text: "灯只留了尽头那一盏" },
    ],
    causeIds: ["echo-berth-b"],
    effectEchoIds: ["echo-harmonica"],
  },
  {
    id: "destiny-roster",
    title: "护送名单",
    kind: "destined",
    speakers: [
      { kind: "you" },
      { kind: "cast", memberId: "staen" },
      { kind: "npc", name: "乘务长" },
    ],
    roomId: "crew",
    outcomeText:
      "时刻表对不上，名单就得重排。排到第三遍时施塔恩替你确认了名字在第几行，一枚铜扣从纸页间掉出来，他忘了拿走。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "staen" }],
        text: "把名单从内袋里取出来",
      },
      { kind: "moment", text: "广播响过之后那两分钟" },
    ],
    causeIds: ["echo-crew"],
    effectEchoIds: ["echo-berth-a"],
  },
  {
    id: "destiny-night-watch",
    title: "换上来的那个人",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "npc", name: "乘务员" }],
    roomId: "crew",
    outcomeText:
      "名单重排到第三遍，后半夜那班就换了人。他接班时把铃敲了两遍，说旧序是这么敲的——从那以后没人纠他。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "在乘务室等到交班",
      },
      { kind: "moment", text: "交班前那趟广播" },
    ],
    causeIds: ["destiny-roster"],
    effectEchoIds: ["echo-night-watch"],
  },
  {
    id: "destiny-novelist",
    title: "小说家",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
    roomId: "theater",
    outcomeText:
      "他把写满的那页折了两折，说这段还不能给你看。折痕正压在「某人」两个字上——那两个字后来出现在书房的稿纸角落。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "roland" }],
        text: "散场后没有起身",
      },
      { kind: "moment", text: "清场的乘务员数第二遍座位时" },
    ],
    causeIds: ["echo-theater"],
    effectEchoIds: ["echo-study"],
  },
  {
    id: "destiny-ticket",
    title: "旧车票",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
    roomId: "study",
    outcomeText:
      "票根上的起点站只剩半个字。他说三年前从那儿上车的人不是他，说完就再没关灯——隔着门能听见他在数什么。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
        text: "一起看那半个站名",
      },
    ],
    causeIds: ["destiny-novelist"],
    effectEchoIds: ["echo-berth-b"],
  },
  {
    id: "destiny-scarf",
    title: "那条丝巾",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "santing" }],
    roomId: "cafe",
    outcomeText:
      "他没让你帮。丝巾散开又系上，第三遍才算系正。从那天起这条丝巾每天都要重系一遍，谁也没问为什么。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "santing" }],
        text: "单手把丝巾解开又系上",
      },
      { kind: "moment", text: "午后最空的那一班" },
    ],
    causeIds: ["echo-tea-room"],
    effectEchoIds: ["echo-cafe"],
  },
  {
    id: "destiny-frost",
    title: "窗霜上的字",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "santing" }],
    roomId: "promenade",
    outcomeText:
      "风把你那半句灌进观景廊。他背对着你，指腹在霜上写了什么，写完又用袖口按住，没让你看完。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "对着窗外把那半句说了出来",
      },
    ],
    causeIds: ["destiny-scarf"],
    effectEchoIds: ["echo-promenade"],
  },
  {
    id: "destiny-concert",
    title: "夜场余音",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    roomId: "music-hall",
    outcomeText:
      "你说想听一场音乐会，第二晚音乐厅就亮了灯。散场后琴盖没有合严，留了一指宽的缝——那不是谁忘了，是有人还想再弹一次。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "在回应这一刻说想听一场音乐会",
      },
      { kind: "moment", text: "夜场开演前那半小时" },
    ],
    effectEchoIds: ["echo-music"],
  },
  {
    id: "destiny-violin",
    title: "小提琴",
    kind: "potential",
    speakers: [{ kind: "you" }],
    roomId: "tea-room",
    outcomeText:
      "夜场里聊到小提琴，第二天茶室的矮柜旁就多了一把。琴主人没留话，只把弓松了半圈——那是给人用的松法，不是收起来的松法。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
        text: "散场后聊起小提琴",
      },
    ],
    causeIds: ["destiny-concert"],
    effectEchoIds: ["echo-parlour"],
  },
  {
    id: "destiny-patrol",
    title: "巡警检查",
    kind: "potential",
    speakers: [
      { kind: "you" },
      { kind: "npc", name: "巡警" },
      { kind: "cast", memberId: "renqingyi" },
    ],
    roomId: "dining",
    outcomeText:
      "第十日进安检区段，餐车逐个开箱。XK-101 那时躺在琴腹里，巡警敲了两下面板就过去了——他要听的是空腔，琴腹本来就是空的。",
    nodes: [
      { kind: "moment", text: "第十日薄雾 · 列车进入例行安检区段" },
      {
        kind: "event",
        speakers: [
          { kind: "npc", name: "巡警" },
          { kind: "cast", memberId: "renqingyi" },
        ],
        text: "谈开箱检查的规矩",
      },
    ],
    causeIds: ["destiny-violin"],
    effectEchoIds: ["echo-dining"],
  },
  {
    id: "destiny-cab",
    title: "藏进车头",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "npc", name: "列车长" }],
    roomId: "cab-driver",
    outcomeText:
      "检查散场，你想的是下一次。琴挡得住敲面板，挡不住第二遍开箱——于是你向任轻义问起了车头。锁了十天的折棚门在那之后开了。",
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
        text: "问起车头能不能上去",
      },
    ],
    causeIds: ["destiny-patrol"],
  },
];
