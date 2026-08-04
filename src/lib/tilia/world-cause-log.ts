/**
 * 因果推演流 —— 「世界背面」最下面那张卡里滚过去的那些行。
 *
 * 三张卡从上往下是同一件事的三层：世界在算（`world-log-recording.ts`）→ 算出来的命运
 * 一枚枚落地（`world-destiny-log.ts`）→ 落下的这些又互相咬成链。这一张说的是最
 * 后那层：谁牵出了谁。
 *
 * 一行就是一条链，从因走到果：
 *
 *   夜场余音 ▸ 小提琴 ▸ 巡警检查        成立 0.92
 *
 * 末一节是果，前面都是因。链常常不止两节 —— 果又成了下一件事的因，这一屏从头
 * 到尾都在说这句话，星图用线画，这张卡用字写。
 *
 * `score` 不是概率，是这条链此刻咬得有多紧：`solve` 的还在长，`hold` 的差着一
 * 件事，`drop` 的断了 —— 断了的也留着，世界推演过的东西不会因为没成就不算数。
 *
 * 链上的名字都咬着 `destiny-archive.ts` / `echo-archive.ts` 里那些真事，短名照
 * 抄，不另起一套说法。
 */

/** 一条链此刻的状态。 */
export type CauseState =
  /** 成立：因果都齐了。 */
  | "done"
  /** 推演中：还在往下算。 */
  | "solve"
  /** 差一件：只等一个还没发生的事件。 */
  | "hold"
  /** 断了：中间那节没落下来，这条不走了。 */
  | "drop";

export type CauseLine = {
  /** 至少两节，最后一节是果。 */
  chain: readonly string[];
  state: CauseState;
  /** 咬得有多紧，0–1。 */
  score: number;
};

/**
 * 滚动节奏。三张卡里最慢的一档 —— 一条链是要顺着读完的，读到末一节才知道这句
 * 话在说什么，比上面两张都需要停留。
 */
export const CAUSE_INTERVAL_MS = 2_000;
/** 关了动效的人换成这一档。 */
export const CAUSE_SLOW_INTERVAL_MS = 4_800;

export const CAUSE_LOG: readonly CauseLine[] = [
  { chain: ["一句回应", "夜场余音", "小提琴"], state: "done", score: 0.92 },
  { chain: ["小提琴", "巡警检查"], state: "done", score: 0.88 },
  { chain: ["巡警检查", "藏进车头"], state: "solve", score: 0.74 },
  { chain: ["最后一排的凹陷", "旧车票"], state: "done", score: 0.81 },
  { chain: ["牌桌的赌注", "摘手套的那一杆"], state: "done", score: 0.86 },
  { chain: ["钟慢了两分", "护送名单", "换上来的那个人"], state: "done", score: 0.79 },
  { chain: ["那条丝巾", "咖啡厅的空位"], state: "hold", score: 0.52 },
  { chain: ["口琴的铜面", "那半段曲子"], state: "solve", score: 0.61 },
  { chain: ["暖气一夜没停", "花开那一夜"], state: "done", score: 0.9 },
  { chain: ["三夜没睡好", "隘口那一晚", "?"], state: "solve", score: 0.44 },
  { chain: ["记分牌上的名字", "没人去擦"], state: "done", score: 0.83 },
  { chain: ["名单划了两遍", "换班的铃"], state: "hold", score: 0.48 },
  { chain: ["旧车票", "卧铺乙那盏灯"], state: "done", score: 0.77 },
  { chain: ["雪线合影", "×"], state: "drop", score: 0.12 },
  { chain: ["夜话的座次", "窗那边的位子"], state: "solve", score: 0.58 },
  { chain: ["单臂系鞋带", "空着的那只袖子"], state: "hold", score: 0.66 },
  { chain: ["琴盖的那道缝", "还想再弹一次"], state: "solve", score: 0.53 },
  { chain: ["折了两折的那页", "书房的稿纸"], state: "done", score: 0.8 },
  { chain: ["行李架上的箱子", "没人认领", "巡警的目光"], state: "solve", score: 0.4 },
  { chain: ["整夜添煤", "炉膛压得很低"], state: "done", score: 0.71 },
  { chain: ["连接处站着的人", "开箱的规矩"], state: "hold", score: 0.5 },
  { chain: ["一诺千金", "替谁说的那句"], state: "solve", score: 0.62 },
  { chain: ["左胸口那一下", "?"], state: "hold", score: 0.7 },
  { chain: ["杏子熟了", "老家那件旧事"], state: "solve", score: 0.55 },
  { chain: ["茶炉边的空杯", "留给谁"], state: "hold", score: 0.52 },
  { chain: ["无名站七分钟", "×"], state: "drop", score: 0.09 },
  { chain: ["窗霜上的字", "没让你看完"], state: "done", score: 0.75 },
  { chain: ["递过来的那一页", "你还没答"], state: "solve", score: 0.68 },
  { chain: ["半夜那声响", "温室没人去看"], state: "drop", score: 0.18 },
  { chain: ["藏进车头", "下一次开箱", "?"], state: "solve", score: 0.31 },
];
