/**
 * 因果推演流 —— 「世界背面」最下面那张卡里滚过去的那些行。
 *
 * 三张卡从上往下是同一件事的三层：世界在算（`world-log-recording.ts`）→ 算出来的
 * 命运长什么样（`world-destiny-log.ts`）→ 落下的这些又互相咬成链。这一张说的是
 * 最后那层：谁牵出了谁。
 *
 * 一条链由四种字段写成，穿插着出现 —— 世界不是先埋完伏笔才开始算的，它一边算一
 * 边补：
 *
 *   伏笔  早就摆在那儿的东西。当时没人当回事，后来才发现是为这一步留的
 *   目标  谁想要什么。可能是人的，也可能是世界自己的
 *   因    真发生了的一件事
 *   果    被前面这些推出来的一件事
 *
 * 果多一层：它得交代自己是怎么来的 —— 哪几件算数了（因 1、因 2、因 3……），以及
 * 这一咬此刻算到哪一步（状态）。上面那些因是「发生过什么」，果里这几条是「世界最
 * 后数了哪几件」，两份不总是一样，这中间的差就是推演本身。
 *
 * 果和因怎么咬上的，分三种：
 *
 *   兑现  先埋的伏笔应在了这里，说过的话、留下的东西都算了数
 *   呼应  不是它促成的，可两件事对上了 —— 世界记下这个巧合
 *   因果  前面那几件直接把它推出来，中间不隔别的
 *
 * 显示上果最亮，别的字段压暗：一屏滚过去，眼睛先接住那几行果，再往上找它是怎么
 * 来的。这一张仍是那一支绿，主次全交给透明度 —— 中间那张卡才靠换色分段。
 *
 * 链上的东西都咬着 `destiny-archive.ts` / `echo-archive.ts` 与主线那几场真戏，短
 * 名照抄，不另起一套说法。断了的链也留着：世界推演过的东西，不会因为没成就不算数。
 */

/** 果和因咬合的三种方式。 */
export type CauseRelation = "兑现" | "呼应" | "因果";

export type CauseNote =
  /** 伏笔：早就摆在那儿的东西。 */
  | { kind: "seed"; text: string }
  /** 目标：谁想要什么。 */
  | { kind: "goal"; text: string }
  /** 因：真发生了的一件事。 */
  | { kind: "cause"; text: string }
  /** 果：被推出来的一件事，得交代自己怎么来的。 */
  | {
      kind: "effect";
      text: string;
      relation: CauseRelation;
      /** 世界最后数了哪几件。顺序就是它数的顺序。 */
      from: readonly string[];
      /** 这一咬此刻算到哪一步。 */
      state: string;
    };

/** 一条链。四种字段穿插着写，不排队。 */
export type CauseChain = {
  id: string;
  notes: readonly CauseNote[];
};

export const CAUSE_CHAINS: readonly CauseChain[] = [
  {
    id: "violin-to-cab",
    notes: [
      {
        kind: "seed",
        text: "你在「回应这一刻」提过一句音乐会。那句话当时没人接，世界把它记在了当天的账上。",
      },
      {
        kind: "goal",
        text: "你要把 XK-101 带回万晁，而且一路上不能被任何人开箱看见。",
      },
      {
        kind: "cause",
        text: "音乐厅夜场的灯亮了，三角钢琴自己响了半句，四个人都留在了地毯上。",
      },
      {
        kind: "cause",
        text: "夜场里你说起自己以前也拉琴。这句话被在场的人听见了，不止一个。",
      },
      {
        kind: "effect",
        text: "茶室矮柜旁多了一把小提琴，弦还温着——施塔恩把它托起来，连弓一并收进你够得到的距离。",
        relation: "兑现",
        from: [
          "那句没人接的音乐会",
          "夜场里你说自己拉过琴",
          "茶室是当晚唯一还开着灯的地方",
        ],
        state: "闭合了。琴盒的重量落到你手里，世界记下你多了一件带硬壳的行李。",
      },
      {
        kind: "cause",
        text: "第十日清晨进例行安检区段，餐车长桌推到一侧，临时立起检查牌。",
      },
      {
        kind: "effect",
        text: "琴挡过了第一次开箱。巡警敲了敲琴腹听声，签字放行。",
        relation: "因果",
        from: [
          "琴马下方那寸刚好够用的空隙",
          "任轻义把话头引到关税单据上，替你挪开半分钟",
          "你没有抢先解释",
        ],
        state: "成立。但你自己明白：琴挡得住这一次，挡不住第二次开箱。",
      },
      {
        kind: "goal",
        text: "得给它找一个不属于「乘客随身物」的地方——名册上点不到的那种。",
      },
      {
        kind: "cause",
        text: "检查散场后，你向任轻义问起了车头。他没答应也没拒绝，只说这话他能替你递。",
      },
      {
        kind: "effect",
        text: "锁了十天的折棚门开了半扇。门后是一节乘客从不被带进来的车厢，列车长在里面等着。",
        relation: "兑现",
        from: [
          "任轻义答应替你递的那句话",
          "列车长要看看是谁在打听他的车厢",
          "那扇门本来就在，只是不开放",
        ],
        state: "还在往下算。门开了、脸记住了，藏匿这件事一次也还没发生。",
      },
    ],
  },
  {
    id: "old-ticket",
    notes: [
      {
        kind: "seed",
        text: "剧场最后一排的座垫上有一道凹陷，深得不像一场戏坐出来的。",
      },
      { kind: "cause", text: "罗兰在那儿坐了整场，一次没起身。" },
      {
        kind: "effect",
        text: "凹陷里翻出一张旧车票，日期比这趟车早了三年。",
        relation: "呼应",
        from: ["那道凹陷", "他一整场没起身", "散场后没人去收拾最后一排"],
        state: "票是谁的还没算出来。世界先把它记着，不急着结。",
      },
      { kind: "cause", text: "车票被人从门缝塞进了卧铺乙。" },
      {
        kind: "effect",
        text: "卧铺乙那盏灯亮了一整夜，天亮才灭。",
        relation: "因果",
        from: ["门缝里那张票", "里面的人认得那个日期"],
        state: "成立。谁塞的还悬着——这一节又成了下一条的因。",
      },
    ],
  },
  {
    id: "harmonica",
    notes: [
      {
        kind: "seed",
        text: "施塔恩那把口琴的铜面磨掉了一块漆，磨的正是拇指常按的位置。",
      },
      {
        kind: "goal",
        text: "他想让你听见那半段，又不想解释自己为什么还记得。",
      },
      { kind: "cause", text: "会客厅的灯被人压到最低，鹿头标本下只剩一圈光。" },
      {
        kind: "effect",
        text: "那半段曲子吹完了，比他自己预想的长。",
        relation: "呼应",
        from: ["铜面上那块磨痕", "灯压到最低", "屋里只有你们两个"],
        state: "他没说曲名，你也没问。这一咬留着尾巴，世界不催。",
      },
    ],
  },
  {
    id: "greenhouse-bloom",
    notes: [
      { kind: "seed", text: "温室的暖气阀被人往上拧过半圈，没人报修。" },
      { kind: "cause", text: "暖气一夜没停，玻璃上的霜化到了框边。" },
      {
        kind: "effect",
        text: "蜜兰庭花今早开了，比时令早了十来天。",
        relation: "因果",
        from: ["拧过半圈的阀门", "暖气一夜没停", "夜里没人来关窗"],
        state: "成立。世界把它写进了今天的世界动态，说得像件小事。",
      },
    ],
  },
  {
    id: "scoreboard",
    notes: [
      { kind: "seed", text: "台球室记分牌上多了个陌生名字，笔迹很稳。" },
      { kind: "goal", text: "世界想看看有没有人去擦。" },
      { kind: "cause", text: "牌桌的赌注加到了第三轮，围观的人多了一圈。" },
      {
        kind: "effect",
        text: "有人摘了手套下那一杆——任轻义的手，一整趟车里第一次露出来。",
        relation: "兑现",
        from: ["记分牌上那个陌生名字", "赌注加到第三轮", "围观的人足够多"],
        state: "成立。碳黑下面那层没人看清，但摘手套这件事被记住了。",
      },
      { kind: "cause", text: "一整天过去，名字还在，抹布就搁在牌下面。" },
      {
        kind: "effect",
        text: "没人去擦。",
        relation: "呼应",
        from: ["那个陌生名字", "一整天没人碰记分牌"],
        state: "断了。这条不再往下走——推演过的东西留着，不因为没成就不算数。",
      },
    ],
  },
  {
    id: "scarf",
    notes: [
      { kind: "seed", text: "那条丝巾又系了一遍，结打在同一侧，紧得多余。" },
      {
        kind: "goal",
        text: "散庭·姚想在你身上留一处别人挪不掉的地方——他自己不会承认这句。",
      },
      { kind: "cause", text: "咖啡厅靠窗那个位子空了两天，谁都没坐。" },
      {
        kind: "effect",
        text: "丝巾最后系到了你手上，在观景廊那阵灌雪的风里。",
        relation: "兑现",
        from: ["他反复系了又解的那个结", "战胜城市的夜话他不能参加"],
        state: "差一件。你还没坐进咖啡厅那个空位——坐了，这条才算真闭合。",
      },
    ],
  },
];

/* ─────────────────────────── 摊平成一行行 ─────────────────────────── */

export type CauseStreamRow =
  /** 伏笔 / 目标 / 因 各占一行。 */
  | { kind: "seed" | "goal" | "cause"; text: string }
  /** 果：这一行提亮，尾巴上挂着咬合方式。 */
  | { kind: "effect"; text: string; relation: CauseRelation }
  /** 果怎么来的：因 1、因 2、因 3…… */
  | { kind: "from"; index: number; text: string }
  /** 这一咬算到哪一步。 */
  | { kind: "state"; text: string };

function flatten(chains: readonly CauseChain[]): readonly CauseStreamRow[] {
  const rows: CauseStreamRow[] = [];

  for (const chain of chains) {
    for (const note of chain.notes) {
      if (note.kind !== "effect") {
        rows.push({ kind: note.kind, text: note.text });
        continue;
      }

      rows.push({
        kind: "effect",
        text: note.text,
        relation: note.relation,
      });
      /* 果后面紧跟它的交代：先数因，再说算到哪一步。顺序不能反 —— 一屏里眼睛
         接住果那一行，往下就该看见它凭什么成立。 */
      note.from.forEach((text, i) => {
        rows.push({ kind: "from", index: i + 1, text });
      });
      rows.push({ kind: "state", text: note.state });
    }
  }

  return rows;
}

/** 一行一行滚的那些链。 */
export const CAUSE_STREAM: readonly CauseStreamRow[] = flatten(CAUSE_CHAINS);
