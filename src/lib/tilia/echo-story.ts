/**
 * 世界回响 —— 对齐 worldlive V3.3「因缘果 / deepfeeling」示意。
 *
 * 产品口径（用户不需要理解因缘果）：
 *   世界动态里的各种信息会不断产生化学反应，发生新的故事。
 *
 * 结构（对照 demo mock）：
 *   因 / 缘  = 参与汇聚的动态条目 + 用户「回应这一刻」
 *   果      = 世界回响（短剧情，无后续选项 / 自由聊）
 *   字段    = 我的行为 → 结果标题/正文 → 余波
 */

import { CAST_BY_ID } from "@/lib/tilia/cast";
import { resolveOnSegment } from "@/lib/tilia/train-segments";
import type { FeedItem, FeedSpeaker } from "@/lib/tilia/world-feed";

export type EchoCause = {
  /** 展示用短句（角色名 + 动态缩略）。 */
  label: string;
  /** 因 / 缘 标注，仅汇聚动画用，不对用户解释术语。 */
  role: "yin" | "yuan";
};

/**
 * 汇聚成一条回响的一个节点 —— 全屏回响星图（`EchoFieldScreen`）画的就是它。
 *
 * 分两类，视觉上区别很大，因为它们在世界里是两种东西：
 *   • 事件：有人做了什么，所以带头像组；
 *   • 时机：世界自己那一下（天气、时辰、车过隘口），没有参与者，
 *     画成一枚光点。
 *
 * 和 `causes` 的关系：`causes` 是给汇聚动画看的一行行文字（因/缘 术语
 * 不对用户露出），`nodes` 是给星图看的结构化版本 —— 星图要分别摆头像、
 * 连线，光靠一个拼好的 label 字符串画不出来。
 */
export type EchoNodeSeed =
  | { kind: "event"; speakers: readonly FeedSpeaker[]; text: string }
  | { kind: "moment"; text: string };

export type EchoStory = {
  id: string;
  /** 地图胶囊 / 动态缩略标题。 */
  title: string;
  /** 用户那句「我的行为」。 */
  actionText: string;
  /** 结果正文。 */
  resultText: string;
  /** 余波（echo）。 */
  echoText: string;
  speakers: readonly FeedSpeaker[];
  roomId: string;
  /** 回响落在哪一节车厢，仅静态种子的授权数据用；省略即主车厢。 */
  segment?: string;
  /** 静态种子定义处写段内坐标，导出前统一解析成整幅画布坐标。 */
  xPct: number;
  yPct: number;
  /** 汇聚时回看的因缘节点。 */
  causes: readonly EchoCause[];
  /** 汇聚成这条回响的事件与时机，全屏星图用。 */
  nodes: readonly EchoNodeSeed[];
  /**
   * 汇聚进这条回响的、更早的回响（`EchoFieldEntry.causeEchoIds` 同义）。
   * 果会变成因，链条因此能一路往回追 —— 详见那边的说明。
   */
  causeEchoIds?: readonly string[];
};

const SEED_ECHO_STORY_DEFS: readonly EchoStory[] = [
  {
    id: "echo-cafe",
    title: "那条丝巾又系了一遍",
    actionText: "你在咖啡厅看了他系丝巾的手。",
    resultText:
      "散庭·姚本来只想把丝巾系好，却在你的注视里停了太久。丝巾散开又系上，像一句没说出口的抱歉。",
    echoText: "后来路过的乘务员说，那晚咖啡厅的灯比平时亮了一档。",
    speakers: [{ kind: "cast", memberId: "santing" }],
    roomId: "cafe",
    xPct: 0.545,
    yPct: 0.545,
    // 茶室那盏没动过的茶之后，他把这份没说出口的东西带到了咖啡厅。
    causeEchoIds: ["echo-tea-room"],
    causes: [
      { label: "散庭·姚 · 用单手一遍遍系那条丝巾", role: "yin" },
      { label: "你 · 在咖啡厅多停了一会儿", role: "yuan" },
    ],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "santing" }],
        text: "系了三次都没系好",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "santing" }],
        text: "在咖啡厅多坐了一刻钟",
      },
      { kind: "moment", text: "车厢转向，光正好落在他手上" },
    ],
  },
  {
    id: "echo-music",
    title: "琴声还在地毯上颤",
    actionText: "你经过音乐厅时放慢了脚步。",
    resultText:
      "没人点名要听，三角钢琴却自己响了半句。地毯上的震动停了很久，像有人刚从琴凳上站起来。",
    echoText: "巡夜的乘务长后来把琴盖合上，却留了一指宽的缝。",
    speakers: [{ kind: "world" }],
    roomId: "music-hall",
    xPct: 0.39,
    yPct: 0.53,
    // 散场的灯只灭了一半，那一夜音乐厅的琴盖也就没人去合。
    causeEchoIds: ["echo-theater"],
    causes: [
      { label: "世界 · 音乐厅的灯一直没灭", role: "yin" },
      { label: "你 · 经过时放慢脚步", role: "yuan" },
    ],
    nodes: [
      { kind: "event", speakers: [{ kind: "world" }], text: "琴盖一直没合上" },
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "经过音乐厅时放慢了脚步",
      },
      { kind: "moment", text: "音乐厅的灯一夜没灭" },
    ],
  },
  {
    id: "echo-promenade",
    title: "窗霜上多了一行字",
    actionText: "你对着窗外说了半句没说完的话。",
    resultText:
      "你那句没说完的话被风灌进观景廊。霜花上多出一行歪歪扭扭的字迹，像有人用指腹刚写完。",
    echoText: "下一站进站时，有人把那块霜擦掉了——又像是舍不得，只擦了一半。",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "santing" }],
    roomId: "promenade",
    xPct: 0.14,
    yPct: 0.48,
    // 丝巾那次之后他一直没回头 —— 这行字接着那件事往下写。
    causeEchoIds: ["echo-cafe"],
    causes: [
      { label: "你 · 对着窗外说了半句", role: "yuan" },
      { label: "散庭·姚 · 在观景廊站了很久没回头", role: "yin" },
    ],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "you" }],
        text: "对着窗外说了半句就停了",
      },
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "santing" }],
        text: "在观景廊站了很久没回头",
      },
      { kind: "moment", text: "隘口的风从连接处灌进来" },
    ],
  },
  {
    id: "echo-dining",
    title: "餐车多摆了一副杯盏",
    actionText: "你提起了今晚谁会来。",
    resultText:
      "任轻义听见你的回应，把本来收起的酒杯又摆回长桌尽头。座位空着，杯口却对着你常坐的那边。",
    echoText: "乘务员问要不要撤，他只说：先留着。",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
    roomId: "dining",
    xPct: 0.58,
    yPct: 0.7,
    // 记分牌上那个没人擦掉的名字，就是这副空着的杯盏要留给谁。
    causeEchoIds: ["echo-billiard"],
    causes: [
      { label: "任轻义 · 把收起的酒杯又摆回长桌", role: "yin" },
      { label: "你 · 提起了今晚谁会来", role: "yuan" },
    ],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "renqingyi" }],
        text: "把收起的酒杯又摆回去",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
        text: "提起了今晚谁会来",
      },
      { kind: "moment", text: "夜话的时辰到了" },
    ],
  },
  {
    id: "echo-parlour",
    title: "口琴多停了半拍",
    actionText: "你在门外应了一声。",
    resultText:
      "施塔恩在会客厅听见你的声音，口琴声顿了一拍。铜面上的雾气散开，像有人刚从窗外看进来。",
    echoText: "那半拍之后，曲调比平时软了一点，连鹿头标本下的烟味都淡了。",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    roomId: "parlour",
    xPct: 0.68,
    yPct: 0.4,
    /*
     * 两条上游，各自还接着更早的：
     *   蜜兰庭花提前开 → 钟慢了两分 → 枕头下的铜扣 ↘
     *                                              口琴多停了半拍
     *   最后一排空了一个位置 → 琴声还在地毯上颤   ↗
     * 这是最新的一枚，也是链条最长的一枚 —— 星图默认落在它上面。
     */
    causeEchoIds: ["echo-berth-a", "echo-music"],
    causes: [
      { label: "施塔恩 · 在会客厅吹到第三遍", role: "yin" },
      { label: "你 · 在门外应了一声", role: "yuan" },
    ],
    nodes: [
      {
        kind: "event",
        speakers: [{ kind: "cast", memberId: "staen" }],
        text: "同一支曲子吹到第三遍",
      },
      {
        kind: "event",
        speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
        text: "在门外应了一声",
      },
      { kind: "moment", text: "鹿头标本下的烟散尽了" },
    ],
  },
];

/** 初始地图上已有的回响（静态种子），坐标已解析成整幅画布坐标。 */
export const SEED_ECHO_STORIES: readonly EchoStory[] =
  SEED_ECHO_STORY_DEFS.map(resolveOnSegment);

/**
 * 「回应这一刻」触发后的回响模板池。
 * 结构对齐 V3.3 mock：action → resultTitle/resultText → echoText。
 *
 * 直接拿种子当模板：那几条本来写的就是「一句回应之后世界给的回音」，
 * 再抄一份同样的文案只会两处走神。生成时覆盖 id / 我的行为 / 因缘节点。
 */
type EchoTemplate = Omit<EchoStory, "id" | "actionText" | "causes">;

const RESPONSE_ECHO_POOL: readonly EchoTemplate[] = SEED_ECHO_STORIES;

let _echoSeq = 0;

/** 星图上的一行只有一行的位置，长句要截。 */
function clipText(text: string): string {
  return text.length > 14 ? `${text.slice(0, 14)}…` : text;
}

function causeLabel(item: FeedItem): string {
  const who = item.speakers
    .map((s) => {
      if (s.kind === "you") return "你";
      if (s.kind === "cast") return CAST_BY_ID[s.memberId]?.name ?? "某人";
      if (s.kind === "npc") return s.name;
      if (s.kind === "world") return "世界";
      return "";
    })
    .filter(Boolean)
    .join("、");
  const clip =
    item.text.length > 28 ? `${item.text.slice(0, 28)}…` : item.text;
  return `${who || "世界"} · ${clip}`;
}

/**
 * 从用户回应 + 近期动态生成一条世界回响（demo 用模板，不走真 LLM）。
 * 因 = 近期动态；缘 = 用户这句话；果 = 短剧情回响。
 */
export function generateEchoFromResponse(
  actionText: string,
  recentFeed: readonly FeedItem[],
): EchoStory {
  _echoSeq += 1;
  const template =
    RESPONSE_ECHO_POOL[_echoSeq % RESPONSE_ECHO_POOL.length] ??
    RESPONSE_ECHO_POOL[0];

  const yinItems = recentFeed
    .filter((i) => i.kind !== "voice")
    .slice(-2)
    .reverse();

  const causes: EchoCause[] = [
    ...yinItems.map((item) => ({
      label: causeLabel(item),
      role: "yin" as const,
    })),
    { label: `你 · ${actionText}`, role: "yuan" as const },
  ];

  // 星图节点用真实来源：动态原文各成一个事件，用户那句话也是一个事件，
  // 时机沿用模板里那一下世界自己的变化。
  const nodes: EchoNodeSeed[] = [
    ...yinItems.map((item) => ({
      kind: "event" as const,
      speakers: item.speakers,
      text: clipText(item.text),
    })),
    {
      kind: "event" as const,
      speakers: [{ kind: "you" as const }],
      text: clipText(actionText),
    },
    ...template.nodes.filter((n) => n.kind === "moment"),
  ];

  return {
    ...template,
    id: `echo-gen-${Date.now()}-${_echoSeq}`,
    actionText,
    causes,
    nodes,
  };
}

/** 回响 → 世界动态里的缩略条目。 */
export function echoStoryToFeedItem(story: EchoStory): FeedItem {
  return {
    id: `feed-${story.id}`,
    kind: "echo",
    speakers: story.speakers,
    text: story.title,
    roomId: story.roomId,
  };
}
