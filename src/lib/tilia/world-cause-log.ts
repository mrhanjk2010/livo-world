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
 * 果多两层。一层是链：这一枚果落下之后，整条链到此为止长什么样 ——
 *
 *   LCC = [C0 那句音乐会 -E1-> R1=C1 茶室的琴 -E2-> R2 琴腹没被翻]
 *
 * 一层是交代：哪几件算数了（因 1、因 2、因 3……），以及是什么契机让它正好在这时候
 * 落下（状态）。上面那些因是「发生过什么」，果里这几条是「世界最后数了哪几件」，两
 * 份不总是一样，这中间的差就是推演本身。
 *
 * 链和正文说的是同一件事，只是一份给眼睛、一份给机器：正文是一整句话（「巡警敲了敲
 * 琴腹听声，签字放行」），链是它的骨架。所以每个果除了正文还带一个短名，短名进链 ——
 * 整句排进去会当场溢出，而骨架要一眼扫得完才有用。
 *
 * 中段每个果都写成 `Rj=Cj`，因为这一步的果原地就是下一步的因 —— 等号是链能长这么长
 * 的全部原因。链末收进那个全局锚 G 的，尾巴上多一截 `|-> G`。
 *
 * 每落一枚果就重画一次，所以同一条链会越写越长：一屏里看得见它在长。
 *
 * 状态说的不是这条链算到哪一步，是那个契机本身：某人此刻的心境或情绪、车外的天
 * 气、谁刚做了件什么事、说了句什么话。同样几件因摆在那儿，差这一口气就落不下来
 * —— 所以它和因并列，是最后那味，不是结论。
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
 * 名照抄，不另起一套说法。没走到头的链也留着 —— 果里自己会说漏（名字留到了第二
 * 天、那个位子还空着），世界推演过的东西不因为没成就不算数。
 */

/** 果和因咬合的三种方式。 */
export type CauseRelation = "兑现" | "呼应" | "因果";

export type CauseNote =
  /** 伏笔：早就摆在那儿的东西。 */
  | { kind: "seed"; text: string }
  /** 目标：谁想要什么。 */
  | { kind: "goal"; text: string }
  /** 因：真发生了的一件事。链里的 E。 */
  | { kind: "cause"; text: string }
  /** 果：被推出来的一件事，得交代自己怎么来的。链里的 R。 */
  | {
      kind: "effect";
      term: string;
      text: string;
      relation: CauseRelation;
      /** 世界最后数了哪几件。顺序就是它数的顺序。 */
      from: readonly string[];
      /** 让它正好在这时候落下的那个契机：心境、天气、谁做了件什么事。 */
      state: string;
    };

/** 一条链。四种字段穿插着写，不排队。 */
export type CauseChain = {
  id: string;
  /** C0：这条链的根因短名 —— 最先摆在那儿、后面全从它长出来的那一件。 */
  root: string;
  /** 末端那个果收进了全局锚 G。多数链没走到，留假。 */
  converges?: boolean;
  notes: readonly CauseNote[];
};

/**
 * 全局唯一那个终极收敛锚 G。
 *
 * 写成模块常量而不是每条链自己一个：G 只有一个，链要么收进它、要么没走到。分给每
 * 条链一份就等于说「各有各的终点」，那这一屏也就没什么可推演的了。
 */
const ANCHOR = "把 XK-101 带回万晁";

export const CAUSE_CHAINS: readonly CauseChain[] = [
  {
    id: "violin-to-cab",
    root: "那句音乐会",
    converges: true,
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
        term: "茶室的琴",
        text: "茶室矮柜旁多了一把小提琴，弦还温着——施塔恩把它托起来，连弓一并收进你够得到的距离。",
        relation: "兑现",
        from: [
          "那句没人接的音乐会",
          "夜场里你说自己拉过琴",
          "茶室是当晚唯一还开着灯的地方",
        ],
        state:
          "施塔恩那晚话比平时少。他没说琴是自己放的，只把弓也一并收进你够得到的距离——他心里早决定了，只是不肯让这件事算他的。",
      },
      {
        kind: "cause",
        text: "第十日清晨进例行安检区段，餐车长桌推到一侧，临时立起检查牌。",
      },
      {
        kind: "effect",
        term: "琴腹没被翻",
        text: "琴挡过了第一次开箱。巡警敲了敲琴腹听声，签字放行。",
        relation: "因果",
        from: [
          "琴马下方那寸刚好够用的空隙",
          "任轻义把话头引到关税单据上，替你挪开半分钟",
          "你没有抢先解释",
        ],
        state:
          "你手心全是汗，可呼吸一下没乱。巡警那早已经排到第七个人，站得腰疼，抬手前先叹了口气。",
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
        term: "折棚门开半扇",
        text: "锁了十天的折棚门开了半扇。门后是一节乘客从不被带进来的车厢，列车长在里面等着。",
        relation: "兑现",
        from: [
          "任轻义答应替你递的那句话",
          "列车长要看看是谁在打听他的车厢",
          "那扇门本来就在，只是不开放",
        ],
        state:
          "车正过雪山隘口，能见度不足十米。车头那一刻正需要多一双眼睛盯着前窗，列车长嘴上没说，手上把炉门带了一下。",
      },
    ],
  },
  {
    id: "old-ticket",
    root: "座垫的凹陷",
    notes: [
      {
        kind: "seed",
        text: "剧场最后一排的座垫上有一道凹陷，深得不像一场戏坐出来的。",
      },
      {
        kind: "cause",
        text: "罗兰在那儿坐了整场，一次没起身。",
      },
      {
        kind: "effect",
        term: "三年前的票",
        text: "凹陷里翻出一张旧车票，日期比这趟车早了三年。",
        relation: "呼应",
        from: ["那道凹陷", "他一整场没起身", "散场后没人去收拾最后一排"],
        state:
          "散场时剧场的灯只灭了一半——扫地的人被临时叫去餐车帮忙，最后一排就那么空着亮了半小时。",
      },
      {
        kind: "cause",
        text: "车票被人从门缝塞进了卧铺乙。",
      },
      {
        kind: "effect",
        term: "灯亮了一整夜",
        text: "卧铺乙那盏灯亮了一整夜，天亮才灭。谁塞的票还没人问起。",
        relation: "因果",
        from: ["门缝里那张票", "里面的人认得那个日期"],
        state:
          "里面那个人本来就没打算睡：晚饭一口酒没喝，坐在铺沿上盯着窗外那片黑，听见门缝响也没起身去看是谁。",
      },
    ],
  },
  {
    id: "harmonica",
    root: "铜面的磨痕",
    notes: [
      {
        kind: "seed",
        text: "施塔恩那把口琴的铜面磨掉了一块漆，磨的正是拇指常按的位置。",
      },
      {
        kind: "goal",
        text: "他想让你听见那半段，又不想解释自己为什么还记得。",
      },
      {
        kind: "cause",
        text: "会客厅的灯被人压到最低，鹿头标本下只剩一圈光。",
      },
      {
        kind: "effect",
        term: "那半段吹完了",
        text: "那半段曲子吹完了，比他自己预想的长。",
        relation: "呼应",
        from: ["铜面上那块磨痕", "灯压到最低", "屋里只有你们两个"],
        state:
          "他午后在雪线合影里站得最靠边，回来一路没说话。那点旧事被风雪翻起来了，正压在心口没处放。",
      },
    ],
  },
  {
    id: "greenhouse-bloom",
    root: "拧过的阀门",
    notes: [
      { kind: "seed", text: "温室的暖气阀被人往上拧过半圈，没人报修。" },
      {
        kind: "cause",
        text: "暖气一夜没停，玻璃上的霜化到了框边。",
      },
      {
        kind: "effect",
        term: "蜜兰庭花开了",
        text: "蜜兰庭花今早开了，比时令早了十来天。",
        relation: "因果",
        from: ["拧过半圈的阀门", "暖气一夜没停", "夜里没人来关窗"],
        state:
          "车外一夜零下十九度，湿气全压在玻璃内侧。温室里那点暖比外头高出二十来度——花以为春天到了。",
      },
    ],
  },
  {
    id: "scoreboard",
    root: "牌上的名字",
    notes: [
      { kind: "seed", text: "台球室记分牌上多了个陌生名字，笔迹很稳。" },
      { kind: "goal", text: "世界想看看有没有人去擦。" },
      {
        kind: "cause",
        text: "牌桌的赌注加到了第三轮，围观的人多了一圈。",
      },
      {
        kind: "effect",
        term: "他摘了手套",
        text: "有人摘了手套下那一杆——任轻义的手，一整趟车里第一次露出来。",
        relation: "兑现",
        from: ["记分牌上那个陌生名字", "赌注加到第三轮", "围观的人足够多"],
        state:
          "任轻义那晚心情不坏，笑着报了句「重利轻义的轻义」——人多的时候他很少提自己的名字。",
      },
      {
        kind: "cause",
        text: "一整天过去，名字还在，抹布就搁在牌下面。",
      },
      {
        kind: "effect",
        term: "名字留到隔天",
        text: "没人去擦。名字留到了第二天，抹布还搁在牌下面。",
        relation: "呼应",
        from: ["那个陌生名字", "一整天没人碰记分牌"],
        state:
          "台球室那天没人进去。走廊尽头一直站着个穿制服的，谁都不太想往那头凑。",
      },
    ],
  },
  {
    id: "scarf",
    root: "系了又解的结",
    notes: [
      { kind: "seed", text: "那条丝巾又系了一遍，结打在同一侧，紧得多余。" },
      {
        kind: "goal",
        text: "散庭·姚想在你身上留一处别人挪不掉的地方——他自己不会承认这句。",
      },
      {
        kind: "cause",
        text: "咖啡厅靠窗那个位子空了两天，谁都没坐。",
      },
      {
        kind: "effect",
        term: "丝巾到你手上",
        text: "丝巾最后系到了你手上，在观景廊那阵灌雪的风里。咖啡厅那个位子还空着。",
        relation: "兑现",
        from: ["他反复系了又解的那个结", "战胜城市的夜话他不能参加"],
        state:
          "风把他那只空袖子吹得贴在身上，他没去按。那一刻他最怕的不是冷，是你正看着别处。",
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
  /** 这枚果落下之后，链到此为止：`= [C0 … -E1-> R1 …]`。 */
  | { kind: "chain"; text: string }
  /** 果怎么来的：因 1、因 2、因 3…… */
  | { kind: "from"; index: number; text: string }
  /** 让它正好这时候落下的那个契机。 */
  | { kind: "state"; text: string };

/**
 * 摊平成一行行，顺手把链算出来。
 *
 * 链不是另写一份，是从这些字段本身读出来的 —— 一条链里第 j 个果就是 Rj，它的 Cj 是
 * 上一个果（第一个果的 C0 写在链上）。所以只要链是按发生顺序写的，`Ri = Ci+1` 这条
 * 不变式自动成立，不用手写、也没法写错。
 *
 * 每落一枚果就重画一次，画的是「到此为止」那一截 —— 所以同一条链会在这一屏上越写越
 * 长，看得见它在长。链末那枚果如果收进了 G，尾巴上才多一截 `|-> G`。
 */
function flatten(chains: readonly CauseChain[]): readonly CauseStreamRow[] {
  const rows: CauseStreamRow[] = [];

  for (const chain of chains) {
    /* 已经落下的那些果，按顺序攒着 —— 下一次重画链要从头写一遍。 */
    const steps: string[] = [];
    const total = chain.notes.filter((n) => n.kind === "effect").length;

    for (const note of chain.notes) {
      if (note.kind !== "effect") {
        rows.push({ kind: note.kind, text: note.text });
        continue;
      }

      steps.push(note.term);

      rows.push({
        kind: "effect",
        text: note.text,
        relation: note.relation,
      });
      /* 果后面先摆链：这枚果在整条链上站在哪儿。然后才是它凭什么成立（数了哪几件
         因）、凭什么正好此刻（状态）—— 那两样链里装不下。 */
      rows.push({
        kind: "chain",
        text: chainText(chain, steps, steps.length === total),
      });
      note.from.forEach((text, i) => {
        rows.push({ kind: "from", index: i + 1, text });
      });
      rows.push({ kind: "state", text: note.state });
    }
  }

  return rows;
}

/**
 * 链到此为止的样子：`= [C0 那句音乐会 -E1-> R1=C1 茶室的琴 -E2-> R2 琴腹没被翻]`。
 *
 * 中段每个果都写成 `Rj=Cj`：这一步的果原地就是下一步的因，等号是这条链能长这么长
 * 的全部原因。最新落下那个不写等号 —— 它后面还没有下一步。
 *
 * 符号一律用 ASCII（`-E2->`、`|-> G`）：这一屏是块通着电的板子，`-->` 比 `→` 更像
 * 它自己的语言，也免了等宽字体里那些箭头忽宽忽窄。
 */
function chainText(
  chain: CauseChain,
  steps: readonly string[],
  done: boolean,
): string {
  const parts = [`C0 ${chain.root}`];

  steps.forEach((term, i) => {
    const j = i + 1;
    const last = j === steps.length;
    parts.push(`-E${j}->`, last ? `R${j} ${term}` : `R${j}=C${j} ${term}`);
  });

  if (done && chain.converges) parts.push(`|-> G ${ANCHOR}`);

  return `= [${parts.join(" ")}]`;
}

/** 一行一行滚的那些链。 */
export const CAUSE_STREAM: readonly CauseStreamRow[] = flatten(CAUSE_CHAINS);
