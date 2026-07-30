/**
 * 世界动态数据模型（《蒂利亚之冬》· 和平号）。
 *
 * 按 V3.3「一、世界框架」建的：
 *
 *   世界动态 = 世界客观变化 + 角色日程 + 世界回响
 *            + 注定的命运 + 潜在的命运（长内容生成缩略版进动态）
 *
 * 定位是「世界所有信息的汇总分发，短内容」—— 所以这里每条只存一句
 * 缩略文案；长内容（命运）自己有完整体，动态里只是它的入口，靠
 * `hasFollowUp` 标出来。
 *
 * 口径注意：V3.3 明确「用户不需要理解因缘果」，对外只说「世界动态里
 * 的各种信息，会不断产生化学反应发生新的故事」。所以这套类型里没有
 * 「因 / 缘 / 果」这三个字，UI 文案里也不许出现。
 */

/**
 * 六类世界内容 + 一类用户自述。
 *
 * 前六类是 V3.3 的内容名词定义（世界事件已按 V3.3 合并进「潜在的
 * 命运」，所以这里没有它）。`voice` 是第七类：V3.3「二、照见自我」
 * 要求世界里新增「回应这一刻」让用户自由说，且「用户输出的信息会
 * 进入动态，并进而生成新的变化」—— 它既不是角色日程也不是命运，
 * 单列一类，设计稿里的第一条「你：……」就是它。
 */
export type WorldContentKind =
  /** 注定的命运：有开场剧情的选项式对话（群聊 + 单聊）。 */
  | "destined"
  /** 潜在的命运：有开场剧情的自由对话（单聊）。 */
  | "potential"
  /** 世界回响：动态之间起了化学反应后长出的短剧情，没有后续。 */
  | "echo"
  /** 世界见闻：补充世界观与人设的物品。 */
  | "sighting"
  /** 世界客观变化：天气、季节、行程。 */
  | "objective"
  /** 角色日程：角色日常行为，短内容，合理性 > 戏剧性。 */
  | "schedule"
  /** 回应这一刻：用户自己说的话，进入动态后参与后续生成。 */
  | "voice";

/** 动态行左侧的头像组由说话人决定，多人时叠加。 */
export type FeedSpeaker =
  /** 用户自己。展示为「你」，头像用抽象光影素材。 */
  | { kind: "you" }
  /** 五位主角之一，取 `cast.ts` 的 id。 */
  | { kind: "cast"; memberId: string }
  /** 世界里的路人／配角，只有名字没有立绘。 */
  | { kind: "npc"; name: string }
  /** 客观变化的发声者就是「世界」本身。 */
  | { kind: "world" };

export type FeedItem = {
  id: string;
  kind: WorldContentKind;
  speakers: readonly FeedSpeaker[];
  /** 缩略正文。设计稿里的节奏是 8–15 字，长短不一。 */
  text: string;
  /**
   * 展开版正文，按段给。卡片上只放 `text` 那一句缩略，全屏世界动态页
   * 放这几段 —— 同一条内容的两种粒度，不是两条内容。缺省时页里退化成
   * 只显示 `text`。
   */
  detail?: readonly string[];
  /**
   * 发生在世界的第几天（`WorldClock.day`）。全屏页按它分组、插「第 N 天」
   * 分隔条。流式推入时由卡片按当时的世界时钟盖章，所以跳到一周后之后
   * 落下的动态不会被算进第三日。
   */
  day?: number;
  /** 发生地点，对应 `train.ts` 的 roomId —— 动态和地图房间靠它对上。 */
  roomId?: string;
  /** 长内容（命运）才为真：动态里是缩略版，点进去还有完整的对话。 */
  hasFollowUp?: boolean;
};

/**
 * 世界客观变化的当前状态。表头那句「世界动态 · 11:35 多云」里的
 * 时间和天气就是从这里来的 —— 它不是装饰，是「世界客观变化」这一类
 * 内容在卡片表头上的常驻呈现。
 */
export type WorldClock = {
  time: string;
  weather: string;
  /** 维萨发车后的第几天。全屏世界动态页的表头与日分隔条都读它。 */
  day: number;
  /** 当前行程段，房间弹窗和大陆图共用这句。 */
  leg: string;
};

export const WORLD_CLOCK: WorldClock = {
  time: "11:35",
  weather: "多云",
  day: 3,
  leg: "维萨发车后第三日 · 正在穿越雪山隘口",
};

/**
 * 首屏种子动态。顺序即时间倒序（最新在最前）。
 * 文案对齐《蒂利亚之冬》设定：和平号、XK-101、四位男主与女主。
 *
 * 每条都带 `detail`：卡片上是那句缩略，全屏世界动态页展开成完整几段。
 */
export const WORLD_FEED: readonly FeedItem[] = [
  {
    id: "voice-1",
    kind: "voice",
    speakers: [{ kind: "you" }],
    text: "连着三夜没睡好，一闭眼就是风声",
    detail: [
      "你在茶室靠窗那张座位上说了这句。第三夜了，隘口的风整晚贴着玻璃刮，闭上眼也还在响。",
      "邻座的人没抬头，只是翻页的手停了半秒。",
    ],
    day: 3,
    roomId: "cafe",
  },
  {
    id: "potential-1",
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "roland" }],
    text: "他把新写的一页递给了你",
    detail: [
      "罗兰在剧场后台把刚写完的一页递过来，纸边还带着铅笔灰。他说这段本来是给别人写的，改到第三遍才发现更像你。",
    ],
    day: 3,
    roomId: "theater",
    hasFollowUp: true,
  },
  {
    id: "schedule-1",
    kind: "schedule",
    speakers: [
      { kind: "npc", name: "巡警" },
      { kind: "cast", memberId: "renqingyi" },
    ],
    text: "谈开箱检查的规矩",
    detail: [
      "餐车尾部，两名巡警和任轻义对着一张单子低声核对：哪几节车厢按顺序开箱，哪些行李可以只看外形。",
      "任轻义把手套往上拉了半寸，问的是流程，听的是次序。",
    ],
    day: 3,
    roomId: "dining",
  },
  {
    id: "objective-1",
    kind: "objective",
    speakers: [{ kind: "world" }],
    text: "穿过雪山隘口，能见度不足十米",
    detail: [
      "和平号进入隘口，两侧岩壁把风挤成一条直线，车窗上结的霜每隔几分钟被刮薄一次。",
      "车速降到平时的一半，广播说这一段要走四十分钟。",
    ],
    day: 3,
  },
  {
    id: "sighting-1",
    kind: "sighting",
    speakers: [{ kind: "cast", memberId: "staen" }],
    text: "口琴的铜面磨掉了漆",
    detail: [
      "施塔恩的口琴摊在客厅的矮几上，铜面被手指磨出一小块亮，漆早掉了。他没吹，只是用拇指反复擦那块亮的地方。",
    ],
    day: 3,
    roomId: "parlour",
  },
  {
    id: "echo-1",
    kind: "echo",
    speakers: [{ kind: "cast", memberId: "santing" }],
    text: "那条丝巾又系了一遍",
    detail: [
      "散庭·姚在茶室镜前把丝巾解开又系上。第一遍太紧，第二遍歪了，第三遍他索性不看镜子，凭手感打了个结。",
    ],
    day: 3,
    roomId: "cafe",
  },
  {
    id: "destined-1",
    kind: "destined",
    speakers: [
      { kind: "you" },
      { kind: "cast", memberId: "staen" },
      { kind: "cast", memberId: "renqingyi" },
    ],
    text: "今晚夜话的座次定了",
    detail: [
      "餐车的长桌摆好了三副餐具，位置是任轻义排的：他自己靠门，施塔恩靠窗，你在中间。",
      "他说这样谁进来都得先看见他。",
    ],
    day: 3,
    roomId: "dining",
    hasFollowUp: true,
  },
  {
    id: "schedule-2",
    kind: "schedule",
    speakers: [{ kind: "cast", memberId: "roland" }],
    text: "在剧场最后一排坐了整场",
    detail: [
      "罗兰整场都坐在剧场最后一排，没上台。灯亮起来的时候他还在原位，手里那份稿子一页也没翻。",
    ],
    day: 3,
    roomId: "theater",
  },
  {
    id: "sighting-2",
    kind: "sighting",
    speakers: [{ kind: "npc", name: "乘务长" }],
    text: "记分牌上多了个陌生名字",
    detail: [
      "台球室的记分牌上多了一行字，笔迹不是车上任何一位常客的。乘务长说昨夜确实有人来打过球，可名册上没登记这个人。",
    ],
    day: 3,
    roomId: "billiard",
  },
  {
    id: "objective-2",
    kind: "objective",
    speakers: [{ kind: "world" }],
    text: "温室里的蜜兰庭花今早开了",
    detail: [
      "温室的蜜兰庭在清晨开了三朵，全朝着车头的方向。园艺师说这花只在气压降下来的时候开，往年要等到过了隘口才有。",
    ],
    day: 3,
    roomId: "greenhouse",
  },
];

/**
 * 流式追加池。世界动态开着时，会按间隔从这里抽一条，以打字机效果
 * 推到列表顶部。文案都从项目介绍文档的人设 / 世界观里抽，不另编设定。
 */
export const FEED_STREAM_POOL: readonly Omit<FeedItem, "id">[] = [
  {
    kind: "schedule",
    speakers: [{ kind: "cast", memberId: "staen" }],
    text: "在昏黄灯光下试着画了一笔",
    detail: [
      "客厅的灯只开了一盏。施塔恩借着这点光在纸上落了一笔，停住看了很久，最后把那张纸压到了本子最底下。",
    ],
    roomId: "parlour",
  },
  {
    kind: "schedule",
    speakers: [{ kind: "cast", memberId: "santing" }],
    text: "单臂替你系鞋带，又停住了",
    detail: [
      "散庭·姚在茶室门口蹲下来，用那只还能用的手替你把鞋带绕了一圈，随后停住，把线头递还给你。",
      "「这个我做得慢。」他说得很平静。",
    ],
    roomId: "cafe",
  },
  {
    kind: "schedule",
    speakers: [{ kind: "cast", memberId: "renqingyi" }],
    text: "手套拉得更严实了一点",
    detail: [
      "餐车里的暖气足，任轻义却把手套又往上拉了半寸，一直拉到袖口盖住手腕，然后才去端那杯已经凉了的茶。",
    ],
    roomId: "dining",
  },
  {
    kind: "schedule",
    speakers: [{ kind: "cast", memberId: "roland" }],
    text: "按住左胸口，又笑了笑",
    detail: [
      "罗兰在剧场侧廊按住左胸口站了一会儿，等有人看过来，他松开手，笑了一下，说是刚才走得急。",
    ],
    roomId: "theater",
  },
  {
    kind: "echo",
    speakers: [
      { kind: "you" },
      { kind: "cast", memberId: "santing" },
    ],
    text: "杏子黄了，可谁也不提旧事",
    detail: [
      "长廊尽头的果盘里换了新的杏子。你和散庭·姚都看了一眼，谁也没提那年也是这个季节。",
    ],
    roomId: "promenade",
  },
  {
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "staen" }],
    text: "他说那里风雪能吃人",
    detail: [
      "施塔恩指着窗外那片白，说他小时候在更北的地方见过这种雪：站着不动，半个钟头就找不到人了。",
    ],
    roomId: "parlour",
    hasFollowUp: true,
  },
  {
    kind: "potential",
    speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
    text: "一诺千金四个字落得很轻",
    detail: [
      "任轻义把「一诺千金」四个字说得很轻，像是怕说重了就要当场兑现。说完他看了一眼车门的方向。",
    ],
    roomId: "dining",
    hasFollowUp: true,
  },
  {
    kind: "destined",
    speakers: [
      { kind: "cast", memberId: "roland" },
      { kind: "you" },
    ],
    text: "桌上多了份结婚申请",
    detail: [
      "书房的桌上多了一份结婚申请，抬头的名字空着，日期已经填好。罗兰说这不是他放的，可他知道是谁放的。",
    ],
    roomId: "study",
    hasFollowUp: true,
  },
  {
    kind: "objective",
    speakers: [{ kind: "world" }],
    text: "列车广播：前方即将进入无人之境",
    detail: [
      "广播响了两遍：前方八十公里没有停靠站，也没有信号塔，请各位在车厢内活动。",
    ],
  },
  {
    kind: "objective",
    speakers: [{ kind: "world" }],
    text: "窗外雪线退了半寸，能见度回升",
    detail: [
      "隘口的风势弱下来，窗上的雪线退了半寸，远处的山脊重新露出轮廓。车速慢慢加回去。",
    ],
  },
  {
    kind: "sighting",
    speakers: [{ kind: "npc", name: "乘务员" }],
    text: "碳黑粉末洒在走廊的地毯上",
    detail: [
      "长廊的地毯上有一小片碳黑粉末，从车头方向一路洒过来。乘务员扫了两遍才扫净，嘴里说这几天不该有人往前走。",
    ],
    roomId: "promenade",
  },
  {
    kind: "sighting",
    speakers: [{ kind: "cast", memberId: "roland" }],
    text: "稿纸角落写着别人的名字",
    detail: [
      "罗兰那叠稿纸的角落写着一个别人的名字，被划掉又描了一遍，墨色比正文深。",
    ],
    roomId: "theater",
  },
  {
    kind: "echo",
    speakers: [
      { kind: "npc", name: "巡警" },
      { kind: "cast", memberId: "staen" },
    ],
    text: "护送名单又被改了一处",
    detail: [
      "书房里，巡警把护送名单摊开，让施塔恩确认改动的那一行。改的是随行人数，从两人变成三人。",
    ],
    roomId: "study",
  },
  {
    kind: "schedule",
    speakers: [{ kind: "you" }],
    text: "大衣内衬又摸了一遍",
    detail: [
      "你在茶室坐下前，隔着大衣内衬按了一下那个位置。硬的、方的，还在。这是今天第四次。",
    ],
    roomId: "cafe",
  },
  {
    kind: "sighting",
    speakers: [{ kind: "world" }],
    text: "有人低声提了「XK-101」三个字",
    detail: [
      "台球室的角落里有人提了「XK-101」，声音压得很低，说完那桌人换了话题，谁也没再看谁。",
    ],
    roomId: "billiard",
  },
  {
    kind: "echo",
    speakers: [
      { kind: "cast", memberId: "renqingyi" },
      { kind: "cast", memberId: "roland" },
    ],
    text: "牌桌上的赌注换成了消息",
    detail: [
      "任轻义和罗兰那局牌打到最后没算钱。赢的人要的是一条消息，输的人给了，两人都没再碰牌。",
    ],
    roomId: "billiard",
  },
];

/** 内存里最多保留多少条历史，防止无限涨。 */
export const FEED_HISTORY_CAP = 40;

/** 新动态流式推入的间隔（开关打开时）。 */
export const FEED_STREAM_INTERVAL_MS = 9_500;

/** 打字机每个字的间隔。 */
export const FEED_TYPE_MS = 42;

/** 类型名，房间弹窗与命运半层里给用户看的口径。 */
export const KIND_LABEL: Record<WorldContentKind, string> = {
  destined: "注定的命运",
  potential: "潜在的命运",
  echo: "世界回响",
  sighting: "世界见闻",
  objective: "世界客观变化",
  schedule: "角色日程",
  voice: "回应这一刻",
};

/** 命运两类才在蝴蝶胶囊里出现。 */
export const DESTINY_KINDS: readonly WorldContentKind[] = [
  "destined",
  "potential",
];

/** @deprecated 保留给旧引用；现已改为流式推入，不再整窗轮播。 */
export const FEED_ROTATE_MS = 7_000;
