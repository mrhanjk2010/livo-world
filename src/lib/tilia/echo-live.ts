/**
 * 看着它冒出来的那一批 —— 星图打开之后陆续到场的事件与回响。
 *
 * 为什么要有这一批：星图画的是「世界一直在转」，可它本身是一张静止的图。底部
 * 那条运转日志已经在说「还在算」，但那是文字；真正让人相信的是眼前多出来一枚
 * 光点 —— 你什么也没做，世界自己往前走了一步。
 *
 * 位置不是运行时算的：这一批和常驻的那些一起进 `buildEchoField`，占好各自的
 * 格子、和所有人避完位，只是先不显示（`live` 标着它属于第几次到场，见
 * `EchoFieldScreen` 的到场计时）。所以「冒出来」这件事只关乎显不显示，不会把
 * 已经摆好的图挤动一下 —— 图被挤动比不动更假。
 *
 * 到场顺序在运行时打乱、间隔 5–10 秒随机，两次看不会一样。
 *
 * 内容分两种，各有各的说法：
 *
 * - 事件（`event`）：世界里刚发生的一件小事，还没接上任何线，带酝酿进度，可
 *   以被你推一把。多数到场都是这种 —— 世界大部分时候只是在积累。
 * - 回响（`echo`）：一件事终于结出了果，连着促成它的那几张小卡一起亮。少数
 *   到场是这种，偶尔还接在更早的回响后面（`causeEchoIds`），那时冒出来的不是
 *   一枚点，是一整条链又长了一节。
 */

import type { EchoFieldEntry, LooseEventSeed } from "@/lib/tilia/echo-archive";

export type LiveArrival =
  | { kind: "event"; event: LooseEventSeed }
  | { kind: "echo"; echo: EchoFieldEntry };

/** 到场间隔：随机落在这两个数之间。 */
export const ARRIVE_MIN_MS = 5000;
export const ARRIVE_MAX_MS = 10000;

/*
 * 到场是三拍：屏幕中央生成 → 停一下 → 飞回自己的位置。
 *
 * 直接在目的地淡入是不行的 —— 满屏一百多个光点，多出来的那一枚落在哪，人根本
 * 不在看那块。所以先在取景框正中生成（不管这会儿拖到了哪、缩到了几倍），亮足
 * 一拍让人看见「有东西出来了」，再飞回它在因果网里的位置。
 *
 * 落位那一刻它的连线才接上（见 `EchoFieldScreen` 的 `flying`）：飞的过程中不
 * 画线，否则会有几根线连在空位上，像画坏了。
 */
export const ARRIVE_LIT_MS = 320;
export const ARRIVE_HOLD_MS = 620;
export const ARRIVE_FLY_MS = 1000;
/** 生成点在取景框里的竖向位置（0 顶 1 底）—— 略高于正中，让开底部那张日志卡。 */
export const ARRIVE_SPAWN_Y = 0.46;
/**
 * 生成时的放大倍数上限。
 *
 * 缩到全局那一档（0.4）时一张小卡在屏上只有十几像素，「生成」这一下就看不见
 * 了；按 1/倍率 反向补偿回来，让它无论缩到多少都以差不多的大小出场，落位时再
 * 收回图上该有的尺寸。
 */
export const ARRIVE_BOOST_MAX = 1.8;

export const LIVE_ARRIVALS: readonly LiveArrival[] = [
  {
    kind: "event",
    event: {
      speakers: [{ kind: "npc", name: "乘务长" }],
      text: "餐车的挂钟又对了一次",
      brewing: 0.18,
      nudges: [
        { kind: "chat", who: "乘务长", text: "问他这趟车的钟差了多少" },
        { kind: "respond", text: "说一句：这趟车的时间好像不太准" },
      ],
    },
  },
  {
    kind: "event",
    event: {
      speakers: [{ kind: "cast", memberId: "santing" }],
      text: "他把窗缝里的雪捻成了水",
      brewing: 0.32,
      nudges: [{ kind: "chat", who: "散庭·姚", text: "问他在看窗外的什么" }],
    },
  },
  {
    kind: "echo",
    echo: {
      id: "echo-live-lamp",
      title: "过道的灯自己亮回来了",
      resultText:
        "第三盏灯昨夜灭了一次，谁也没去修。今晚它自己亮回来，比原先还亮些——乘务长说这趟车上的东西，你多看几眼它就精神。",
      speakers: [{ kind: "npc", name: "乘务长" }, { kind: "world" }],
      roomId: "promenade",
      nodes: [
        {
          kind: "event",
          speakers: [{ kind: "npc", name: "乘务长" }],
          text: "他把灯罩擦了一遍",
        },
        {
          kind: "event",
          speakers: [{ kind: "you" }],
          text: "在那盏灯下站了一会儿",
        },
        { kind: "moment", text: "熄灯前那半个钟头" },
      ],
    },
  },
  {
    kind: "event",
    event: {
      speakers: [{ kind: "you" }, { kind: "cast", memberId: "renqingyi" }],
      text: "他数牌的手停了一下",
      brewing: 0.44,
      nudges: [
        { kind: "chat", who: "任轻义", text: "问他刚才想起了什么" },
        { kind: "respond", text: "说一句：牌桌上他好像在等谁" },
      ],
    },
  },
  {
    kind: "event",
    event: {
      speakers: [{ kind: "world" }],
      text: "行李架第三格空出来了",
      brewing: 0.21,
      nudges: [{ kind: "respond", text: "说一句：那只箱子好像换了地方" }],
    },
  },
  {
    kind: "echo",
    echo: {
      id: "echo-live-tea",
      title: "茶盏底下压了张纸条",
      resultText:
        "收茶具的时候盏底翻出一张纸条，只写了一个时刻，没写日子。茶室的人当天没提这件事，第二天却都记得那个时刻。",
      speakers: [{ kind: "cast", memberId: "staen" }, { kind: "you" }],
      roomId: "tea-room",
      /*
       * 接在更早那条回响后面（钟慢了两分）：纸条上只有时刻没有日子，读它的人
       * 对的是哪个钟，本来就是上一条回响留下来的问题。冒出来的不是一枚点，是
       * 链又长了一节。
       */
      causeEchoIds: ["echo-crew"],
      nodes: [
        {
          kind: "event",
          speakers: [{ kind: "cast", memberId: "staen" }],
          text: "他多要了一杯，没喝",
        },
        { kind: "moment", text: "茶凉到刚好能一口喝完" },
      ],
    },
  },
  {
    kind: "event",
    event: {
      speakers: [{ kind: "cast", memberId: "roland" }],
      text: "他撕下的那页没扔掉",
      brewing: 0.5,
      nudges: [
        { kind: "chat", who: "罗兰", text: "问他撕掉的那页写了什么" },
        { kind: "respond", text: "说一句：他写的东西我想读完" },
      ],
    },
  },
  {
    kind: "echo",
    echo: {
      id: "echo-live-snow",
      title: "雪在同一处停了三次",
      resultText:
        "隘口的风把雪往车窗上按，同一块玻璃上的雪停住又滑落，三次都停在一样的地方。看久了像是有人在外面画同一个记号。",
      speakers: [{ kind: "world" }],
      roomId: "berth-a",
      nodes: [
        {
          kind: "event",
          speakers: [{ kind: "you" }],
          text: "把额头贴在玻璃上",
        },
        { kind: "moment", text: "车速慢下来的那几分钟" },
      ],
    },
  },
  {
    kind: "event",
    event: {
      speakers: [{ kind: "you" }, { kind: "npc", name: "乘务长" }],
      text: "名单上多了一个空行",
      brewing: 0.27,
      nudges: [{ kind: "chat", who: "乘务长", text: "问他那一行是留给谁的" }],
    },
  },
];
