/**
 * 世界运转日志 —— 「世界背面」第一张卡（世界一直在算）里滚过去的那些行。
 *
 * 这一屏讲的是世界的背面：事件怎么汇成回响、回响怎么又成了下一枚命运的因。
 * 退到背景里的星图给的是结果的形状，这张卡给的是它还在跑这件事 —— 世界不是等
 * 你来了才开始算，你翻到背面只是看见了它一直在算。
 *
 * 另外两张卡（命运涌现、因果推演）各有自己的词库，见 `world-destiny-log.ts`
 * 和 `world-cause-log.ts`；三张共用 `WorldStreamCards` 那套滚法。
 *
 * 所以每行都是两截：
 *
 *   op    像代码，看不懂也没关系，它负责「这是机器在跑」
 *   note  说人话的那半句，落在具体的人和物上
 *
 * 只有 note 是给人读的，op 是节奏。全是手写、不是拼出来的：拼出来的日志读两
 * 行就露馅（句式一样、词表有限），而这张卡会一直滚。
 *
 * 行数固定滚，内容循环 —— 前面那个自增的 tick 把循环盖住了，眼睛跟不上第
 * 四十几行之后又从头开始。
 */

export type RuntimeLine = {
  /** 冒号前那截：像代码。 */
  op: string;
  /** 冒号后那截：说人话。 */
  note: string;
};

/**
 * 滚动节奏：快到读不完一整行，只读得清一两个词 —— 那正是「在跑」的样子。
 *
 * 从 220 放到 275（速度的八成）：220 那一档一行还没扫完就被顶上去了，快过了
 * 「来不及细读」这个度，就只剩晃眼。
 */
export const RUNTIME_INTERVAL_MS = 275;
/** 关了动效的人换成这一档：还在动，但能一行一行读完。 */
export const RUNTIME_SLOW_INTERVAL_MS = 900;
/** tick 起始值，随便一个「已经跑了很久」的数。 */
export const RUNTIME_TICK_START = 84_120;

export const RUNTIME_LOG: readonly RuntimeLine[] = [
  { op: "world.step ok Δ1.2s", note: "车轮又转过一千四百圈" },
  { op: "cause.resolve chain=3", note: "因还在往果那边走" },
  { op: "echo.brew +0.03", note: "那条丝巾快系成一件事了" },
  { op: "mood santing +0.14", note: "他解开又系上，第三遍才正" },
  { op: "room.tea-room fire=0", note: "茶凉了也没人来收" },
  { op: "clock.drift +2m01s", note: "那口钟没人去校" },
  { op: "destiny.scan p=3 d=1", note: "三件事在等你开口" },
  { op: "xk101.cavity ok", note: "琴腹是空的，敲不出别的" },
  { op: "feed.push +1", note: "餐车又空了两个位子" },
  { op: "weather 薄雾→雪", note: "窗上开始结第二层霜" },
  { op: "link staen×you +0.04", note: "他讲了隘口那一晚" },
  { op: "gc.forget 3", note: "没被看见的事也算发生过" },
  { op: "respond.cool 15s", note: "世界正在酝酿回响" },
  { op: "graph.edges 36 ok", note: "每根线都朝着后来走" },
  { op: "roster.rehash 3rd", note: "名单又重排了一遍" },
  { op: "heat greenhouse .82↑", note: "花期往前挪了一天" },
  { op: "patrol.window 00:40", note: "开箱检查还有四十分钟" },
  { op: "cab.lock open", note: "折棚门在那之后开了" },
  { op: "watch.swap 1", note: "后半夜那班换了个人" },
  { op: "bell.seq legacy×2", note: "他按旧序敲了两遍" },
  { op: "pitch harmonica -.5", note: "铜面在冷里缩了半音" },
  { op: "glove.off 1 frame", note: "只在那一杆的时间里" },
  { op: "board.keep name", note: "那个名字还没人去擦" },
  { op: "ticket.stamp 3y", note: "起点站磨得只剩半个字" },
  { op: "page.fold 2", note: "他把写满的那页折了两折" },
  { op: "dent.hold 12h", note: "绒布上的凹陷还没弹回" },
  { op: "coal.feed .6", note: "有人整夜在添煤" },
  { op: "sleep.you 3d fail", note: "你连着三夜没睡好" },
  { op: "wind.press > rail", note: "风声压过了轮轨声" },
  { op: "stop.unnamed 7min", note: "在无名站停了七分钟" },
  { op: "frost.write 1 line", note: "霜上多出一行字" },
  { op: "lamp.berth-b on", note: "那盏灯亮到天光" },
  { op: "count.voice low", note: "隔着门有人在数数" },
  { op: "hall.lid gap=1", note: "琴盖留了一指宽的缝" },
  { op: "violin.place tea-room", note: "矮柜旁多了一把琴" },
  { op: "bow.loose .5turn", note: "松法是给人用的那种" },
  { op: "chain.depth max=2", note: "果又成了下一件事的因" },
  { op: "tick 无人之境", note: "外面没有站台要对" },
  { op: "trust renqingyi .62", note: "一诺千金落得很轻" },
  { op: "apricot.ripe +1", note: "今年的杏子该熟了" },
  { op: "sleeve.empty ack", note: "他单手替你系了鞋带" },
  { op: "heart.left ping", note: "他按住左胸口，又笑了笑" },
  { op: "draft.line 1", note: "在昏黄灯光下画了一笔" },
  { op: "case.unknown rack=2", note: "行李架上那只箱子没人认" },
  { op: "seat.plan tonight", note: "今晚夜话的座次定了" },
  { op: "queue.pending 22", note: "还有二十二件事没结出果" },
];
