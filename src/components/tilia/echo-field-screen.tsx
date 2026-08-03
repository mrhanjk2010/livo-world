"use client";

import Image from "next/image";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { ECHO_ORB_CORE, EchoOrb } from "@/components/tilia/echo-orb";
import { SpeakerStack, speakerName } from "@/components/tilia/tilia-avatar";
import { WorldRuntimeLog } from "@/components/tilia/world-runtime-log";
import type { EchoFieldEntry } from "@/lib/tilia/echo-archive";
import type { DestinyChainSeed } from "@/lib/tilia/destiny-archive";
import {
  ARRIVE_BOOST_MAX,
  ARRIVE_FLY_MS,
  ARRIVE_HOLD_MS,
  ARRIVE_LIT_MS,
  ARRIVE_MAX_MS,
  ARRIVE_MIN_MS,
  ARRIVE_SPAWN_Y,
  LIVE_ARRIVALS,
} from "@/lib/tilia/echo-live";
import {
  buildEchoField,
  ECHO_ORB_RADIUS,
  estimateNodeWidth,
  FIELD_ZOOM,
  type EchoField,
  type EchoFieldDestiny,
  type EchoFieldNode,
  type EchoFieldOrb,
  type LooseEvent,
} from "@/lib/tilia/echo-field";
import { ROOM_BY_ID } from "@/lib/tilia/train";
import { wireCode, wireGlyph } from "@/lib/tilia/wire-code";

/**
 * 进出场是一次绕 Y 轴的翻转：顶栏右上角那枚按钮把世界页翻过去，露出
 * 背面的星图；同一枚按钮再翻回来。所以两边的图标和位置都是同一套。
 */
const ANIM_MS = 460;
/** 翻进来之前停在这个角度 —— 几乎侧着，只留一线。 */
const FLIP_FROM_DEG = -92;

/**
 * 进和出的配时是不对称的，关键在不透明度什么时候走：
 *
 * 进：先亮起来（四成时长），剩下的路让转角走完。侧到七八十度那几帧本来
 *     就只剩一线，全程陪着淡入会读成一张薄片飞进来。
 * 出：反过来 —— 得先撑住不透明，让人真看见它转走，最后一段才淡掉。淡出
 *     要是也用四成时长，六成的翻转就发生在全透明状态下，回到地图这一下
 *     看着就只是一记淡出，翻转白做了。
 */
function flipTransition(entering: boolean): string {
  const spin = `transform ${ANIM_MS}ms ${
    entering ? "cubic-bezier(0.22,1,0.36,1)" : "cubic-bezier(0.4,0,1,1)"
  }`;
  const fade = entering
    ? `opacity ${Math.round(ANIM_MS * 0.4)}ms ease-out`
    : `opacity ${Math.round(ANIM_MS * 0.45)}ms ease-in ${Math.round(ANIM_MS * 0.55)}ms`;
  return `${spin}, ${fade}`;
}

const ACCENT = "#ffa16b";
/**
 * 命运的调子，取地图上那枚标记的渐变中段（潜在的蓝紫、注定的粉橙）。
 *
 * 和回响的暖橙分开是必要的：这一屏上两种东西并排站着，颜色是唯一一眼就能
 * 分出「这是已经落下的果」还是「这是一场还牵着人的命运」的线索。
 */
const DESTINY_ACCENT = "#5aa8ee";
const DESTINED_ACCENT = "#ff8874";

/**
 * 连线的调子：终端绿（磷光屏那种）。
 *
 * 和节点分色是有用的，不只是好看：这一屏上有三种暖冷不同的节点（回响的暖橙、
 * 潜在命运的蓝、注定命运的粉橙），线要是跟着谁的颜色走，就会被读成"这条线属
 * 于那一头"。绿在这三者之外，于是线读作线本身 —— 关系，而不是某一枚的附属。
 *
 * 满图七十多条线在静息态只有一成六的不透明度，这种高饱和的绿正好还看得见；
 * 换个灰绿会直接消失在深蓝底上。
 */
const LINE_ACCENT = "#3bff8f";

/** 半层高度的兜底值（设计稿：文案区 181 + 底部留白 16）。实测到就用实测的
 *  —— 挂了上游回响的那几条会高一截，取景避让得跟着走。 */
const SHEET_H = 197;
/** 散件那张半层要列「可以做什么」，天生更高一点。 */
const LOOSE_SHEET_H = 220;
/** 命运那张要同时列因和果，更高。 */
const DESTINY_SHEET_H = 268;
/** 光球和半层之间至少留这么多，不然球贴着半层顶边像被压着。 */
const SHEET_GAP = 20;
/** 状态栏 + 关闭按钮那一行，簇不能顶到这上面去。 */
const SAFE_TOP = 96;
const SAFE_SIDE = 12;

/**
 * 弱化态的不透明度（设计稿：光球 50%，事件/时机 20%）。
 *
 * 已经汇进某枚回响的事件/时机压到 15%：它们是已成定局的部分，只需要在那儿
 * 说明「回响是由这些东西汇成的」，不必参与阅读。回响光球和散件事件抬到
 * 60%，跟那一档拉开距离 —— 通览时先看见的就是结果，和还能动的那些。
 */
const DIM_ORB = 0.6;
/**
 * 已经汇进某枚回响的事件/时机，静息态压到这一档。
 *
 * 从 15% 抬到 30% 是跟着「静息态只画光点」一起改的：15% 那档是为一枚 32px 的头
 * 像定的 —— 头像那么大一块，压到一成半刚好读作「在那儿但别看它」。换成一枚四五
 * 个屏幕像素的光点之后，同一档就直接没了，整张网变成一堆断在半空的线。
 */
const DIM_NODE = 0.3;
/**
 * 有选中时，链条之外的回响、以及别的散件事件都退到这一档 —— 不然链条挑不
 * 出来。散件跟着退是有意的：它们平时和光球一样亮，正因为如此，不退就会在
 * 「看一条链」的时候变成最吵的东西。
 */
const DIM_ORB_ASIDE = 0.3;
/**
 * 还没接上线的事件比别的节点亮几档，和回响光球的弱化态同一档。
 *
 * 不是为了好看：满图里只有它们还没定下来，也只有它们点得开。15% 那档是
 * 「已经属于某枚回响、只是现在没看它」的意思，读作已成定局；这一档要读
 * 作还在发生。仍然压在链条（100%）之下，选中那一簇照样是最亮的。
 */
const LOOSE_NODE = 0.6;
/**
 * 静息态那张网的不透明度。压得比最暗的节点还低：它要读作「底下的纹路」，一旦
 * 和节点争亮度，满屏七十多条线就成了一团毛线，谁是果就看不出来了。
 *
 * 从 0.16 提到 0.28 是给虚线和渐变找回来的：断续本身已经去掉六成笔迹，渐变又
 * 把靠因那头化掉，照原来那档整张网基本看不见了。屏幕上的实际分量和实线那版
 * 大致持平。
 */
const REST_LINE = 0.28;
const REST_LINE_ASIDE = 0.13;

/**
 * 上游链条按代际衰减：直接的因几乎和选中的果一样亮，越往回追越淡，追到
 * 第三代就停。
 *
 * 不全亮也不截断到一代 —— 全亮就没有「方向」了（分不清谁是谁的因），只
 * 亮一代又看不出这是条链。淡出本身就是「更早」这件事的画法。
 */
const MAX_CHAIN_DEPTH = 3;
const CHAIN_ORB = [1, 0.85, 0.55, 0.38] as const;
const CHAIN_LINE = [1, 1, 0.6, 0.35] as const;

/** 超过这个位移就算拖动，抬手时不再当成点选。 */
const DRAG_SLOP = 8;

/**
 * 缩放区间 0.4–0.8。
 *
 * 下界曾经是「整张图恰好装进这一屏」算出来的（约 0.235）—— 全貌是给到了，但
 * 一枚蝶形只剩十几个屏幕像素，看着像撒了一屏灰点，谁牵着谁反而看不出来。所以
 * 改成定值 0.4：整张图不再一屏装完（要拖），但每一枚都还看得出是什么东西，
 * 「这么多事互相牵着」这句话是靠密度和线说出来的，不必非得一眼看到底。
 *
 * 上界 0.8：放到原尺寸那一档时一屏只剩三四枚，拖起来找不着自己在哪一片。0.8
 * 这一档字还读得清（远高于 `LABEL_SCALE`），一屏又能多装四分之一。
 *
 * `READ_SCALE` 跟着等于上界：双击在「全局 ↔ 读得清」两档之间切，而「读得清」
 * 现在就是能放到的最大。两个值必须一致 —— 双击那边靠「当前倍率是不是已经到
 * READ_SCALE」判方向，要是 READ_SCALE 高于上界，放到顶之后再双击只会原地不
 * 动，回不到全局。
 */
const MIN_SCALE = 0.4;
const MAX_SCALE = 0.8;
const READ_SCALE = MAX_SCALE;

/**
 * 低于这个倍率就不画字了（`labels`）。
 *
 * 全局视图下 11px 的字只剩两个多像素，画出来是一片灰糊 —— 那不叫"看得见全
 * 局"，叫看不清任何东西。收掉字只留蝶形、光球、光点和线，整屏就成了一张星
 * 图：这个尺度上要回答的是"有多少事、怎么牵着"，具体是哪件事，凑近了再说。
 */
const LABEL_SCALE = 0.55;

/**
 * 缩小时命中区的补偿上限。
 *
 * 全局视图下一枚蝶形只有十来个屏幕像素宽，照着画的命中区根本点不中。命中区
 * 于是按 1/scale 反向放大（视觉不变），让它在屏幕上保持大致同一个尺寸。补偿
 * 有上限：放得太开，隔壁那枚的命中区会先把这一下接走。
 */
const HIT_MAX = 2;

/** 星图整体的放大倍数，和布局共用一个数（那边管格距和小卡）。 */
const ZOOM = FIELD_ZOOM;

/** 光球的命中区。视觉核心 44、光晕铺到 82，人是照着光晕点的。 */
const ORB_HIT = Math.round(64 * ZOOM);

/** 生成波纹荡到多大（屏幕 px；画在画布里，所以要按倍率折算回去）。 */
const SPAWN_RING = 120;

/**
 * 命运那枚标记的视觉尺寸：蝶形核心 + 底下那枚标题胶囊。
 *
 * 核心取和回响光球一样的 44（同样乘 ZOOM）：这一屏叫「世界背面」，命运和回响
 * 是并列的两种东西，谁小一号就成了谁的注脚。
 */
const DESTINY_CORE = Math.round(44 * ZOOM);
const DESTINY_WING = Math.round(30 * ZOOM);
const DESTINY_PILL_H = Math.round(22 * ZOOM);

/**
 * 静息态的光点直径（画布 px）。
 *
 * 整屏一百多个点，谁都摆出自己那张脸的时候，看到的是一百多张脸，看不到那张网。
 * 所以没被挑中的一律收成一枚光点：颜色留着（绿=事件与时机、暖橙=回响、蓝/粉=
 * 命运），形状全省掉。挑中哪一簇，那一簇才现出头像、光球、蝶形 —— 「看清」是选
 * 中换来的，不是默认给的。
 *
 * 四档大小是一层轻的次序：结果（回响、命运）比促成它的那些（事件、时机）大一
 * 圈，事件比时机大一点点。差得都很小 —— 这一屏要读的是「有多少点、怎么牵着」，
 * 不是谁更重要。
 */
const ECHO_DOT = Math.round(13 * ZOOM);
const DESTINY_DOT = Math.round(12 * ZOOM);
/** 这两个要乘节点自己的景深倍率 `node.scale`，所以不预乘 ZOOM。 */
const NODE_DOT = 9;
const MOMENT_DOT = 7;

type Pan = { x: number; y: number };
type Point = { x: number; y: number };

/** 一条汇聚线：事件/时机 → 回响/命运，或前一枚 → 后一枚。 */
type FlowEdge = {
  id: string;
  from: Point;
  to: Point;
  /** 0–1，代际越远越淡。 */
  strength: number;
};

/**
 * 链条上的一枚 —— 回响或命运，抹掉区别之后的样子。
 *
 * 往回追「谁是谁的因」时不需要知道对面是果还是命运：两者都可能是上游，也
 * 都可能是下游。所以链条只认这个结构，`isDestiny` 只用来决定画成什么样。
 */
type ChainPoint = {
  id: string;
  x: number;
  y: number;
  title: string;
  isDestiny: boolean;
  causeIds: readonly string[];
};

/**
 * 一次到场：第几批、当时在画布哪儿生成、生成时放大多少、以及这一批的主角。
 *
 * `head` 是这一批的中心 —— 一枚回响到场时连它的那几张因一起来，中心就是那颗
 * 光球，几张卡按各自和它的相对位置摆开（同样放大），所以出场时看到的是这一簇
 * 本来的形状，只是被搬到了屏幕正中。散件事件只有一张，中心就是它自己。
 */
type Arrival = {
  slot: number;
  from: Point;
  boost: number;
  head: Point;
};

/**
 * 一枚东西「出场时先在哪儿」—— 相对它自己位置的偏移，加上出场那一下的放大。
 *
 * 存偏移而不是绝对坐标：元素本来就绝对定位在自己的位置上，出场只是先把它推到
 * 别处，再把这个推力收回来。收回来那一记就是飞行动画（见 `useArrival`）。
 */
type Spawn = { dx: number; dy: number; boost: number };

/**
 * 全屏世界背面星图 —— 设计稿 `3406:9892`（默认）/ `3407:10459`（选中）。
 *
 * 从顶栏右上那枚按钮翻进来。动态页答的是「世界发生了什么」，这里答的是
 * 「那些事怎么长成了一条回响」：满图散着历史上所有回响，以及汇聚进它们的
 * 事件与时机 —— 还有一批谁都没接上的散件，世界发生的事本来就多于结出果
 * 的事。
 *
 * 最右边那条道上是命运（`DESTINY_CHAIN`）。它们和回响用同一套选中逻辑，因为
 * 在因果里是同一种东西 —— 一枚命运既由更早的事件、回响、命运促成，走完之后
 * 又成了后面那些的因。这条道自上而下就是演示主线：一句回应引出音乐厅的夜
 * 场，夜场里聊到小提琴，琴在开箱检查里替你挡了一次，检查散场才有了去车头
 * 的念头。原先这条线只写在手机框旁边的文字里，现在它在图上。
 *
 * 一屏装不下，也不该缩着装：画布比取景框大得多，四个方向都能拖（见
 * `buildEchoField`，画布尺寸跟着内容量长）。把内容压进一屏才是失真 ——
 * 小卡是文字撑开的，缩放只会让它们和弧线一起变形。
 *
 * 进来什么都不选，全图的因果线一起弱弱地连着：先给人一张网，说明这些事
 * 本来就互相牵着；具体是怎么牵的，等人自己挑一枚。点空白处或再点它一次
 * 就取消选中，整片回到这个静息态 —— 那才是通览的样子。
 *
 * 选中时拉出弧线：光点从事件那头往回响里流，越靠近越亮（连线是从事件端
 * 透明到回响端满色的渐变），一圈圈循环，能量在往那颗球里汇。
 *
 * 汇进来的不止事件与时机 —— 果会变成因，所以上游还可能是更早的回响，一枚
 * 接一枚往回追（`causeEchoIds`）。链条按代际淡出，第三代之后不再画：淡出
 * 就是「更早」的画法，全亮反而看不出方向。链条常常伸出取景框，那不是画坏
 * 了，是这条线本来就还长着 —— 半层里那几枚上游可以直接点进去接着往回走。
 *
 * 那批散件事件比别的节点亮一档、名字后面跟一个很淡的酝酿百分比，点开是
 * 另一张半层：不是「它由什么汇聚而成」，而是「想让它落下来，你能做什么」。
 * 满图里只有它们还没定下来，所以也只有它们值得点 —— 别处都是已经发生过
 * 的事，看看就好。
 *
 * 选中后整片星图平移，把那一簇（或那一张散件卡）顶到半层之上 —— 不是装
 * 饰性的镜头运动，是因为半层会吃掉底部两百来 px，而它们往往就落在那儿。
 */
export function EchoFieldScreen({
  open,
  stories,
  loose,
  destinies,
  onClose,
}: {
  open: boolean;
  /** 历史回响，时间正序 —— 越靠后越新，画布上也就越靠下。 */
  stories: readonly EchoFieldEntry[];
  /** 还没汇聚成回响的事件。 */
  loose?: readonly LooseEvent[];
  /** 已经走完的命运，时间正序（前一枚是后一枚的因）。 */
  destinies?: readonly DestinyChainSeed[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  /**
   * 翻转落定后把 transform 撤成 `none`。留着一个 `rotateY(0)` 也是 transform，
   * 会让这一层变成 backdrop root —— 底部半层那圈 `backdrop-blur` 采样的范围
   * 跟着变，静止态的观感就和翻转前不一样了。
   */
  const [settled, setSettled] = useState(false);
  /** 开了「减少动态效果」就不翻，退回原来那记淡入。 */
  const [flip, setFlip] = useState(true);
  /** 选中的那一枚 —— 可能是回响，也可能是命运。 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 点开的散件事件。和选中互斥 —— 底下只有一张半层。 */
  const [pickedId, setPickedId] = useState<string | null>(null);

  /**
   * 已经到场的那几批（`LIVE_ARRIVALS` 的下标，随机顺序），各自记着当时的生成
   * 点 —— 那是它出场的地方（取景框正中），飞过去的目的地才是它在图上的位置。
   *
   * 生成点得在到场那一刻量下来存住：飞行途中人可能接着拖图，现算就会跳。
   *
   * 关掉再打开会清空 —— 每次进来都从常驻那些看起，然后再看它长出来几枚。这
   * 比记住上次进度好：这一屏想说的是「你在看的时候世界也在动」，不是进度条。
   */
  const [arrived, setArrived] = useState<readonly Arrival[]>([]);
  /** 已经飞到位的那几批：只有落位之后才给它接上连线。 */
  const [landed, setLanded] = useState<readonly number[]>([]);
  const landTimers = useRef<number[]>([]);

  const layout = useMemo(
    () => buildEchoField(stories, loose, destinies, LIVE_ARRIVALS),
    [stories, loose, destinies],
  );

  /**
   * 眼下这一版星图 —— 常驻的全部，加上已经到场的那几批。
   *
   * 画布尺寸和 `contentTop` 一律取自完整版（`layout`）：还没到场的那些也已经
   * 占好了位置，所以取景框从头到尾不动，新东西只是在既有的空位上亮起来。
   */
  const field = useMemo((): EchoField => {
    if (arrived.length >= LIVE_ARRIVALS.length) return layout;
    const shown = new Set(arrived.map((a) => a.slot));
    const here = (live?: number) => live === undefined || shown.has(live);
    return {
      ...layout,
      orbs: layout.orbs.filter((o) => here(o.live)),
      nodes: layout.nodes.filter((n) => here(n.live)),
    };
  }, [layout, arrived]);

  /**
   * 这一枚出场时该先摆在哪 —— 常驻的那些没有出场，返回 `undefined`。
   *
   * 每一批到场存的是画布坐标下的生成点，这里换成相对它自己位置的偏移。
   */
  const spawnFor = useCallback(
    (live: number | undefined, at: Point): Spawn | undefined => {
      if (live === undefined) return undefined;
      const a = arrived.find((x) => x.slot === live);
      if (!a) return undefined;
      /*
       * 簇里的每一件按「和中心的相对位置 × 放大倍数」摆开：出场时的这一簇和它
       * 在图上的样子是同一个形状，只是整体大了一号、搬到了正中。乘上倍数不能
       * 省，不然元素放大了、间距没放大，几张卡会叠在一起。
       */
      return {
        dx: a.from.x + (at.x - a.head.x) * a.boost - at.x,
        dy: a.from.y + (at.y - a.head.y) * a.boost - at.y,
        boost: a.boost,
      };
    },
    [arrived],
  );

  /** 还在飞的那些东西的 id：这会儿不给它们画线，也点不着。 */
  const flying = useMemo((): ReadonlySet<string> => {
    const out = new Set<string>();
    const air = arrived
      .filter((a) => !landed.includes(a.slot))
      .map((a) => a.slot);
    if (air.length === 0) return out;
    for (const o of field.orbs) {
      if (o.live !== undefined && air.includes(o.live)) out.add(o.story.id);
    }
    for (const n of field.nodes) {
      if (n.live !== undefined && air.includes(n.live)) out.add(n.id);
    }
    return out;
  }, [arrived, landed, field.orbs, field.nodes]);

  const orbById = useMemo(
    () => new Map(field.orbs.map((o) => [o.story.id, o])),
    [field.orbs],
  );
  const destinyById = useMemo(
    () => new Map(field.destinies.map((d) => [d.seed.id, d])),
    [field.destinies],
  );

  /**
   * 因果图：回响和命运合成一张表，边全部整理成「我的因是谁」。
   *
   * 命运声明的是「我促成了哪几枚回响」（`effectEchoIds`），方向和这里要的
   * 反着 —— 在这儿把它翻过来挂到那枚回响的因上。让命运自己声明下游，是因为
   * 回响那边的约束是「只指向更早的条目」，而命运比它促成的回响更早，从回响
   * 往回指会和那条约束打架。
   */
  const pointById = useMemo((): ReadonlyMap<string, ChainPoint> => {
    const causedBy = new Map<string, string[]>();
    const add = (id: string, causeId: string) => {
      const list = causedBy.get(id);
      if (list) list.push(causeId);
      else causedBy.set(id, [causeId]);
    };

    for (const o of field.orbs) {
      for (const c of o.story.causeEchoIds ?? []) add(o.story.id, c);
    }
    for (const d of field.destinies) {
      for (const c of d.seed.causeIds ?? []) add(d.seed.id, c);
      for (const e of d.seed.effectEchoIds ?? []) add(e, d.seed.id);
    }

    const map = new Map<string, ChainPoint>();
    for (const o of field.orbs) {
      map.set(o.story.id, {
        id: o.story.id,
        x: o.x,
        y: o.y,
        title: o.story.title,
        isDestiny: false,
        causeIds: causedBy.get(o.story.id) ?? [],
      });
    }
    for (const d of field.destinies) {
      map.set(d.seed.id, {
        id: d.seed.id,
        x: d.x,
        y: d.y,
        title: d.seed.title,
        isDestiny: true,
        causeIds: causedBy.get(d.seed.id) ?? [],
      });
    }
    return map;
  }, [field.orbs, field.destinies]);

  const selectedOrb = selectedId ? orbById.get(selectedId) ?? null : null;
  const selectedDestiny = selectedId
    ? destinyById.get(selectedId) ?? null
    : null;
  const selectedPoint = selectedId ? pointById.get(selectedId) ?? null : null;
  const selectedNodes = useMemo(
    () => (selectedId ? field.nodes.filter((n) => n.ownerId === selectedId) : []),
    [field.nodes, selectedId],
  );
  const picked = useMemo(
    () => (pickedId ? field.nodes.find((n) => n.id === pickedId) ?? null : null),
    [field.nodes, pickedId],
  );

  const pickPoint = useCallback((id: string | null) => {
    setPickedId(null);
    setSelectedId(id);
  }, []);

  /** 选中那枚往回追出来的上游链条：每一枚的代际 + 每一段连线。 */
  const chain = useMemo(
    () => buildChain(selectedId, pointById),
    [selectedId, pointById],
  );

  /**
   * 静息态的全部连线 —— 图上每一条因果都连着，只是很淡。
   *
   * 一进来什么都没选，这张网本身就是要说的话：世界里的事早就互相牵着，不是
   * 你点了哪一枚才临时长出关系来。所以线不是选中时才出现的装饰，它一直在，
   * 选中只是把其中一条挑亮。
   *
   * 画法和高亮那套分开（见 `RestLines`）：七十多条线要是每条都套上光晕和流
   * 光，这一屏会卡；淡度也得压住，浓一点整屏就成了一团毛线。
   */
  const restEdges = useMemo((): readonly FlowEdge[] => {
    const out: FlowEdge[] = [];
    for (const n of field.nodes) {
      if (!n.ownerId) continue;
      // 还在飞的那几张先不连：线画在目的地，人却还在半路，看着像画坏了。
      if (flying.has(n.id) || flying.has(n.ownerId)) continue;
      const to = pointById.get(n.ownerId);
      if (to) out.push({ id: `rest-${n.id}`, from: n, to, strength: 1 });
    }
    // 同一段因果可能被两头各写一次（A 报了它的因，B 报了它的果），去重。
    const seen = new Set<string>();
    for (const p of pointById.values()) {
      for (const c of p.causeIds) {
        const from = pointById.get(c);
        const id = `rest-${c}-${p.id}`;
        if (!from || seen.has(id)) continue;
        if (flying.has(c) || flying.has(p.id)) continue;
        seen.add(id);
        out.push({ id, from, to: p, strength: 1 });
      }
    }
    return out;
  }, [field.nodes, pointById, flying]);

  /**
   * 事件/时机汇进选中那枚，加上链条上一段段的回响/命运。
   *
   * 只画进来的，不画出去的：选中那一枚在这一屏上就是当下这个果，能量往它那
   * 里汇。它当然也会成为后来那些事的因，但那是下一枚被选中时的事 —— 同时朝
   * 两个方向流，就分不出这一屏在讲谁了。往前走一格靠半层里那排「它促成了」
   * 点进去，链条是走出来的。
   */
  const flowEdges = useMemo((): readonly FlowEdge[] => {
    if (!selectedPoint) return [];
    return [
      ...selectedNodes.map((n) => ({
        id: n.id,
        from: n,
        to: selectedPoint,
        strength: 1,
      })),
      ...chain.edges,
    ];
  }, [selectedPoint, selectedNodes, chain.edges]);

  /**
   * 一枚回响/命运此刻该有多亮：链上按代际，其余在有选中时退到一旁，没选中
   * 时是通览的弱化态。
   */
  const glowOf = useCallback(
    (id: string): number => {
      const d = chain.depth.get(id);
      if (d !== undefined) return CHAIN_ORB[d] ?? DIM_ORB_ASIDE;
      return selectedId ? DIM_ORB_ASIDE : DIM_ORB;
    },
    [chain.depth, selectedId],
  );

  /* ── 取景：一个可拖可缩的窗口，外加选中时的自动取景 ── */

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: 375, h: 812 });
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [scale, setScale] = useState(MIN_SCALE);
  const [animatePan, setAnimatePan] = useState(true);
  const [hinted, setHinted] = useState(false);
  /**
   * 半层实测高度：挂了上游的那几条更高，避让线得跟着抬。两张半层各测各
   * 的（都常驻在 DOM 里，关着的那张也在测），取景只看当前露出来的那张。
   */
  const [echoSheetH, setEchoSheetH] = useState(SHEET_H);
  const [looseSheetH, setLooseSheetH] = useState(LOOSE_SHEET_H);
  const [destinySheetH, setDestinySheetH] = useState(DESTINY_SHEET_H);
  const sheetH = pickedId
    ? looseSheetH
    : selectedDestiny
      ? destinySheetH
      : echoSheetH;

  /**
   * 拖动边界。缩放之后画布在屏幕上占 `field.width * s`，所以边界得跟着倍率
   * 走。
   *
   * 上下两头不对称，因为画布底下那段 `BOTTOM_RESERVE` 是空的：
   *
   * - 往上能拖多远按整张画布算（含那段留白）—— 选中最下面一行时，簇要靠这段
   *   行程抬到半层之上。
   * - 往下能拖多远按有内容的那部分算 —— 否则内容比屏幕小的时候（全局视图就是
   *   这样），那段空留白会占掉行程，图连居中都摆不到。
   *
   * 内容比屏幕小时也不锁死在正中：区间仍是个区间，人挪得动，半层避让也才有地
   * 方施展。
   */
  const clampPanAt = useCallback(
    (p: Pan, s: number): Pan => {
      const slackX = viewport.w - field.width * s;
      return {
        x: clamp(p.x, Math.min(0, slackX), Math.max(0, slackX)),
        y: clamp(
          p.y,
          Math.min(0, viewport.h - field.height * s),
          Math.max(0, viewport.h - field.contentHeight * s),
        ),
      };
    },
    [viewport.w, viewport.h, field.width, field.height, field.contentHeight],
  );

  /**
   * 开场取景：横向居中，竖向让内容的上沿贴着屏顶。
   *
   * 0.4 这一档内容比一屏高（也比一屏宽），所以没有「摆到正中」这回事，只有从
   * 哪儿开始看 —— 从头开始看。按 `contentTop` 对齐而不是画布 0：画布顶上那段
   * `TOP_PAD` 是空的，按 0 对齐会先怼进来七八十像素的空白。
   */
  const homePan = useCallback(
    (s: number): Pan =>
      clampPanAt(
        {
          x: (viewport.w - field.width * s) / 2,
          y: -field.contentTop * s,
        },
        s,
      ),
    [clampPanAt, viewport.w, field.width, field.contentTop],
  );

  /*
   * 手势里要按「当下的」取景算锚点，而 state 在一次事件里可能还差一帧才提交。
   * 提交后同步一份镜像，手势的几何一律读它。
   */
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  useEffect(() => {
    panRef.current = pan;
    scaleRef.current = scale;
  }, [pan, scale]);

  // 手机框的高度是 min(100dvh, 812)，不是定值；避让和拖动边界都得按实测算。
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () =>
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  /*
   * 开场：缩到下界（0.4），从内容顶上开始看，什么都不选，不做动画。
   *
   * 这个尺度上字还是读不了的（`labels` 会把它们收掉）—— 第一句要说的话是「这么
   * 多事互相牵着」，那是靠密度和线说的；具体哪一件，双击或双指撑开再看。
   */
  const openedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setAnimatePan(false);
    setScale(MIN_SCALE);
    setPan(homePan(MIN_SCALE));
  }, [open, homePan]);

  /*
   * 到场计时：每隔 5–10 秒，从还没来的那些里随机挑一枚，在取景框正中生成，一
   * 拍之后放它飞回自己的位置。
   *
   * 依赖里带上 `arrived`，所以每来一枚就重新摇一次间隔 —— 节拍不均匀，才像世
   * 界自己在动，而不是一个定时器在跑。
   *
   * 生成点按「当下的」取景算（读 `panRef` / `scaleRef` 而不是 state）：这一发
   * 是定时器回调里跑的，state 可能还差一帧。
   */
  useEffect(() => {
    if (!open) return;
    const rest = LIVE_ARRIVALS.map((_, i) => i).filter(
      (i) => !arrived.some((a) => a.slot === i),
    );
    if (rest.length === 0) return;
    const wait = ARRIVE_MIN_MS + Math.random() * (ARRIVE_MAX_MS - ARRIVE_MIN_MS);
    const timer = window.setTimeout(() => {
      const slot = rest[Math.floor(Math.random() * rest.length)];
      const s = scaleRef.current;
      const p = panRef.current;
      const orb = layout.orbs.find((o) => o.live === slot);
      const head =
        orb ?? layout.nodes.find((n) => n.live === slot) ?? { x: 0, y: 0 };
      setArrived((prev) => [
        ...prev,
        {
          slot,
          from: {
            x: (viewport.w / 2 - p.x) / s,
            y: (viewport.h * ARRIVE_SPAWN_Y - p.y) / s,
          },
          boost: clamp(1 / s, 1, ARRIVE_BOOST_MAX),
          head: { x: head.x, y: head.y },
        },
      ]);
      landTimers.current.push(
        window.setTimeout(
          () => setLanded((prev) => [...prev, slot]),
          ARRIVE_HOLD_MS + ARRIVE_FLY_MS,
        ),
      );
    }, wait);
    return () => window.clearTimeout(timer);
  }, [open, arrived, layout, viewport.w, viewport.h]);

  useEffect(() => {
    if (!selectedPoint) return;
    setAnimatePan(true);
    setPan((prev) =>
      clampPanAt(
        panForCluster(selectedPoint, selectedNodes, viewport, prev, sheetH, scale),
        scale,
      ),
    );
  }, [selectedPoint, selectedNodes, viewport, sheetH, scale, clampPanAt]);

  // 散件同理：点开的那张卡也不能被自己的半层压住。
  useEffect(() => {
    if (!picked) return;
    setAnimatePan(true);
    setPan((prev) =>
      clampPanAt(panForNode(picked, viewport, prev, sheetH, scale), scale),
    );
  }, [picked, viewport, sheetH, scale, clampPanAt]);

  /** 屏幕坐标 → 取景框内坐标。缩放锚点要按这个算，clientX 里含着手机框的偏移。 */
  const localPoint = useCallback((cx: number, cy: number): Point => {
    const r = viewportRef.current?.getBoundingClientRect();
    return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
  }, []);

  /**
   * 定点缩放：把某个屏幕位置底下的那一处画布钉住不动，倍率绕着它变。
   *
   * 不这么做的话（比如绕画布中心缩放），人捏着的那一处会往边上跑 —— 手感上
   * 像图自己在挣脱手指。
   */
  const zoomTo = useCallback(
    (target: number, at: Point) => {
      const prev = scaleRef.current;
      const next = clamp(target, MIN_SCALE, MAX_SCALE);
      if (next === prev) return;
      const p = panRef.current;
      const canvas = { x: (at.x - p.x) / prev, y: (at.y - p.y) / prev };
      setScale(next);
      setPan(
        clampPanAt(
          { x: at.x - canvas.x * next, y: at.y - canvas.y * next },
          next,
        ),
      );
    },
    [clampPanAt],
  );

  /** 场上按着的手指（屏幕坐标）。两根就是捏合，一根才是拖。 */
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    from: Pan;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    ids: [number, number];
    startDist: number;
    startScale: number;
    /** 捏合中点底下那一处画布，整个过程钉在中点上。 */
    anchor: Point;
  } | null>(null);
  /**
   * 抬手后还留着：告诉紧随其后的 click 这一下不作数。拖动和双击的第二下都
   * 会置上 —— 双击是为了别把刚点亮的那一枚又点灭。
   */
  const swallowClickRef = useRef(false);
  /** 上一次单点抬手，用来认双击。 */
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pts = pointersRef.current;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimatePan(false);

    if (pts.size >= 2) {
      // 第二根手指落下：拖动作废，转成捏合。
      dragRef.current = null;
      swallowClickRef.current = true;
      setHinted(true);
      const [[ia, ca], [ib, cb]] = [...pts.entries()].slice(0, 2);
      const a = localPoint(ca.x, ca.y);
      const b = localPoint(cb.x, cb.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = scaleRef.current;
      const p = panRef.current;
      pinchRef.current = {
        ids: [ia, ib],
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startScale: s,
        anchor: { x: (mid.x - p.x) / s, y: (mid.y - p.y) / s },
      };
      return;
    }

    dragRef.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      from: panRef.current,
      moved: false,
    };
    swallowClickRef.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pts = pointersRef.current;
    if (pts.has(e.pointerId)) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const pinch = pinchRef.current;
    if (pinch) {
      const ca = pts.get(pinch.ids[0]);
      const cb = pts.get(pinch.ids[1]);
      if (!ca || !cb) return;
      const a = localPoint(ca.x, ca.y);
      const b = localPoint(cb.x, cb.y);
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const next = clamp(
        (pinch.startScale * dist) / pinch.startDist,
        MIN_SCALE,
        MAX_SCALE,
      );
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setScale(next);
      setPan(
        clampPanAt(
          {
            x: mid.x - pinch.anchor.x * next,
            y: mid.y - pinch.anchor.y * next,
          },
          next,
        ),
      );
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_SLOP) {
      d.moved = true;
      swallowClickRef.current = true;
      setHinted(true);
      /*
       * 到这一刻才抓指针，不是按下就抓：抓住之后浏览器会把 pointerup 连
       * 带 mouseup 一起改派到这一层，落在光球上的那一下就再也不会触发
       * 光球的 click（同 PannableMap 那个坑）。等确认是拖动了再抓，点选
       * 走的是原来的路径，拖动照样能划出取景框。
       */
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 指针已经抬起来了，那这次拖动本来也不成立。
      }
    }
    if (!d.moved) return;
    setPan(clampPanAt({ x: d.from.x + dx, y: d.from.y + dy }, scaleRef.current));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pts = pointersRef.current;
    pts.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (pinchRef.current) {
      // 松到只剩一根：接着当拖动，不然剩那根一动整片图会跳一下。
      if (pts.size < 2) {
        pinchRef.current = null;
        const rest = [...pts.entries()][0];
        dragRef.current = rest
          ? {
              id: rest[0],
              sx: rest[1].x,
              sy: rest[1].y,
              from: panRef.current,
              moved: true,
            }
          : null;
      }
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (d.moved) return;

    /*
     * 这一下是点，不是拖 —— 看看是不是双击的第二下。
     *
     * 第二下的 click 要掐掉：双击落在一枚命运上时，第一下已经把它点亮了，
     * 再让第二下过去只会把它点灭，人得到的是「放大了但灭了」。
     */
    const p = localPoint(e.clientX, e.clientY);
    const prev = lastTapRef.current;
    const t = e.timeStamp;
    if (prev && t - prev.t < 300 && Math.hypot(p.x - prev.x, p.y - prev.y) < 30) {
      lastTapRef.current = null;
      swallowClickRef.current = true;
      setHinted(true);
      setAnimatePan(true);
      zoomTo(scaleRef.current < READ_SCALE - 0.02 ? READ_SCALE : MIN_SCALE, p);
      return;
    }
    lastTapRef.current = { t, x: p.x, y: p.y };
  };

  /**
   * 拖完手之后浏览器还会补一发 click。在捕获阶段掐掉它，光球和空白处的
   * 点击处理就不必各自判断「这次到底是点还是拖」了 —— 键盘敲 Enter 触发
   * 的 click 前面没有拖动，照样能过。
   */
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!swallowClickRef.current) return;
    swallowClickRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  /*
   * 滚轮：平移；按住 ctrl/⌘ 或触控板捏合（浏览器同样报成 ctrl+wheel）：缩放。
   *
   * 用原生监听而不是 React 的 onWheel，为的是 `passive: false` —— 触控板捏合
   * 默认会去缩整个页面，只有拿得到 preventDefault 才拦得住。
   */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !mounted) return;
    const onWheel = (e: WheelEvent) => {
      setHinted(true);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setAnimatePan(false);
        const factor = Math.exp(-e.deltaY / 180);
        zoomTo(scaleRef.current * factor, localPoint(e.clientX, e.clientY));
        return;
      }
      setAnimatePan(false);
      setPan(
        clampPanAt(
          {
            x: panRef.current.x - e.deltaX,
            y: panRef.current.y - e.deltaY,
          },
          scaleRef.current,
        ),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted, zoomTo, clampPanAt, localPoint]);

  /* ── 进出场 ── */

  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (!mounted) return;
    // 关：先把 transform 装回去，再翻走 —— 两件事同一帧提交，`none` 到
    // 侧转角度之间浏览器按单位矩阵插值，不会闪。
    setSettled(false);
    setVisible(false);
    const t = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setSettled(true), ANIM_MS);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    setFlip(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /*
   * 关闭时清掉选中：半层跟着往下滑走，收场干净；下次打开由上面那段重新
   * 落到「最近一枚」，而不是留着上次读到一半的那条。
   */
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setPickedId(null);
      // 陆续到场的那批也退回去（见 `arrived`）：下次进来重新看它长。
      setArrived([]);
      setLanded([]);
      for (const t of landTimers.current) window.clearTimeout(t);
      landTimers.current = [];
    }
  }, [open]);

  /*
   * 这个尺度上画不画字、命中区补偿多少。两者都只跟倍率有关，算一次传下去，
   * 免得每个节点各自判断。
   */
  const labels = scale >= LABEL_SCALE;
  const hitScale = clamp(1 / scale, 1, HIT_MAX);
  /*
   * 线宽跟着倍率反向补偿。线是画在画布坐标里的，缩到全局那一档时 0.8px 的线
   * 只剩四分之一个屏幕像素 —— 而那一档恰恰最需要看清这张网（字都收掉了，剩下
   * 的就是点和线）。补偿有上限，不然放大时线会粗得抢戏。
   */
  const lineWeight = clamp(1 / scale, 1, 3);

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[66]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="世界背面"
        /*
         * overflow-clip 而不是 -hidden：hidden 会造出一个可被程序滚动的容
         * 器，而画布和半层都远超出这一屏 —— 点中一枚落在框外的光球/散件，
         * 浏览器会「把聚焦元素滚进视野」，整层连黑纱一起被推走，底下的地图
         * 就从边上露出来了。clip 不是滚动容器，没得可滚。
         */
        className={`absolute inset-0 overflow-clip ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transform:
            !flip || (visible && settled)
              ? undefined
              : `perspective(1400px) rotateY(${visible ? 0 : FLIP_FROM_DEG}deg)`,
          transition: flip ? flipTransition(visible) : "opacity 280ms ease-out",
        }}
      >
        {/*
          可拖可捏的取景框。手势挂在这一层而不是各个光球上：从光球上按下去
          也应该能拖，抬手时再靠位移判断这次是拖还是点（见
          `swallowClickRef`）。滚轮/触控板另挂在原生监听里（要
          `passive: false`）。
        */}
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          className="absolute inset-0 cursor-grab touch-none overflow-clip active:cursor-grabbing"
        >
          {/*
            压在活地图上的两层：黑 94% 承担压暗（模糊也挂在它上面），上面那层
            深蓝只剩 18% —— 底几乎是纯黑，蓝只用来去掉纯黑那股死气。空白处点
            一下取消选中。

            比设计稿更黑是有理由的：那张稿子上没有这么多线。绿线在深蓝底上要
            靠提亮才看得见，而底一黑，同样的绿就自己浮起来了 —— 星图该有的对
            比来自底色，不该靠把线画亮换。
          */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="取消选中"
            onClick={() => {
              setSelectedId(null);
              setPickedId(null);
            }}
            className="absolute inset-0 cursor-[inherit] bg-black/[0.94] backdrop-blur-[10px]"
          />
          <div className="pointer-events-none absolute inset-0 bg-[#080b1a]/[0.18]" />

          {/*
            星图整片平移 + 缩放：拖动和捏合跟手（不过渡），选中避让和双击
            走缓动。原点钉在左上角，屏幕位置于是就是「画布坐标 × 倍率 +
            pan」，避让那套算法按这个折算（见 `scaleBox`）。

            缩的是整片，不是各自 —— 小卡是文字撑开的，逐个缩会各缩各的、
            连线还接不上原处。
          */}
          <div
            className={`pointer-events-none absolute left-0 top-0 ${
              animatePan
                ? "transition-transform duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                : ""
            }`}
            style={{
              width: field.width,
              height: field.height,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {/*
              两层线：底下这层是整张网（一直都在，很淡），上面那层是选中之后
              被挑亮的那一条。有选中时底层再退一档，让那条链挑得出来。
            */}
            {/* 刚生成那一下的波纹，荡在生成点上（只在还没飞完的那几批上） */}
            {arrived
              .filter((a) => !landed.includes(a.slot))
              .map((a) => (
                <SpawnPulse key={a.slot} at={a.from} size={SPAWN_RING / scale} />
              ))}

            <RestLines
              edges={restEdges}
              field={field}
              aside={selectedId !== null || pickedId !== null}
              weight={lineWeight}
            />
            {/* 网上轮着跑的微光：静息态唯一在动的东西，也是这屏还在转的证据 */}
            <RestGlints
              edges={restEdges}
              weight={lineWeight}
              aside={selectedId !== null || pickedId !== null}
            />
            <FlowLines edges={flowEdges} field={field} weight={lineWeight} />

            {field.nodes.map((node) => {
              const brewable =
                node.ownerId === null && node.brewing !== undefined;
              return (
                <FieldNode
                  key={node.id}
                  node={node}
                  /* 散件的 ownerId 是 null，别让它和「谁都没选」撞上 */
                  lit={selectedId !== null && node.ownerId === selectedId}
                  picked={node.id === pickedId}
                  /*
                   * 有东西被选中时，别的散件退到和链外回响同一档：这一屏此
                   * 刻讲的是那一条链，其余「还能推」的事先别抢注意力。
                   */
                  aside={brewable && (selectedId !== null || pickedId !== null)}
                  labels={labels}
                  /* 刚冒出来的那一张：先在屏幕中央生成，再飞到这儿来 */
                  spawn={spawnFor(node.live, node)}
                  onSelect={
                    brewable
                      ? () => {
                          setSelectedId(null);
                          setPickedId((prev) =>
                            prev === node.id ? null : node.id,
                          );
                        }
                      : undefined
                  }
                />
              );
            })}

            {field.orbs.map((orb) => (
              <FieldOrb
                key={orb.story.id}
                orb={orb}
                selected={orb.story.id === selectedId}
                /*
                 * 整条链一起现形，不只是被点的那一枚：这一刻要看的是「它由什么
                 * 汇聚而成」，那几枚上游本来就是答案的一部分。
                 */
                revealed={chain.depth.has(orb.story.id)}
                opacity={glowOf(orb.story.id)}
                hit={hitScale}
                spawn={spawnFor(orb.live, orb)}
                onSelect={() =>
                  pickPoint(orb.story.id === selectedId ? null : orb.story.id)
                }
              />
            ))}

            {field.destinies.map((d) => (
              <FieldDestiny
                key={d.seed.id}
                destiny={d}
                selected={d.seed.id === selectedId}
                revealed={chain.depth.has(d.seed.id)}
                opacity={glowOf(d.seed.id)}
                labels={labels}
                hit={hitScale}
                onSelect={() =>
                  pickPoint(d.seed.id === selectedId ? null : d.seed.id)
                }
              />
            ))}
          </div>

          {/*
            底部那张运转日志：星图给的是结果的形状，它给的是「还在算」。选中一枚
            时它让位 —— 半层从底部升起来，那时候人读的是具体的一枚。

            放在取景框里面（而不是和它并排）是为了手势：卡片自己要能点开全屏，
            但从卡片上按下去往下一拖，拖的应该还是星图。挂在这一层，指针事件冒
            泡到取景框的拖动处理，抬手时那发 click 也归它判 —— 拖过就不算点
            （见 `swallowClickRef`）。
          */}
          <WorldRuntimeLog hidden={selectedId !== null || pickedId !== null} />
        </div>

        {/*
          顶部压一层黑：星图能拖到任意位置，总会有小卡正好停在状态栏和
          关闭按钮底下，不压暗的话两层字会糊在一起。
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[104px] bg-gradient-to-b from-black/70 via-black/35 to-transparent" />

        <StatusBar />

        {/*
          两件事都看不出来：这一屏是可以放大细看的（开场是全局，字都没画），
          以及这些点是可以挑一枚看的。动过一次就不再提 —— 那时候人已经在自
          己看了。
        */}
        <div
          className={`pointer-events-none absolute left-[20px] top-[62px] flex flex-col gap-[2px] transition-opacity duration-500 ${
            hinted ? "opacity-0" : "opacity-100"
          }`}
        >
          {/*
            标题也收进这一屏的绿：背面这一层从线到字是同一种东西（世界正在算的
            那些），白字会读成「界面盖在上面」，绿字读成「界面也是这一层的一部
            分」。主副之分只交给透明度，和半层里那套一致。
          */}
          <p
            className="text-[15px] font-medium leading-[normal]"
            style={{ color: INK_TITLE, textShadow: FIELD_TEXT_GLOW }}
          >
            世界背面
          </p>
          <p
            className="text-[11px] leading-[normal]"
            style={{ color: INK_META }}
          >
            {selectedId || pickedId
              ? "拖动查看 · 点空白处放下这一枚"
              : "双击或双指放大 · 点一枚看它由什么汇聚而成"}
          </p>
        </div>

        {/*
          和顶栏那枚入口是同一枚：同图标、同尺寸、同坐标（状态栏 53 + 顶栏
          那行居中的 10 = 63，右 12）。翻转过程中它停在原处不动，读起来就是
          「按着这一枚把世界页翻过来又翻回去」。
        */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="翻回世界页"
          className="absolute right-[12px] top-[63px] flex size-[28px] items-center justify-center rounded-full bg-black/20 backdrop-blur-[23.2px] transition-[transform,filter] duration-200 hover:brightness-125 active:scale-90 active:brightness-150"
        >
          <Image
            src="/figma/tilia/nav-echo-field.svg"
            alt=""
            width={20}
            height={20}
            className="size-[20px] max-w-none"
          />
        </button>

        <EchoDetailSheet
          story={selectedOrb?.story ?? null}
          pointById={pointById}
          onPickPoint={pickPoint}
          onMeasure={setEchoSheetH}
        />

        <DestinyDetailSheet
          destiny={selectedDestiny?.seed ?? null}
          pointById={pointById}
          onPickPoint={pickPoint}
          onMeasure={setDestinySheetH}
        />

        <LooseEventSheet node={picked} onMeasure={setLooseSheetH} />
      </section>
    </div>,
    overlayRoot,
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/* ─────────────────────────── 上游链条 ─────────────────────────── */

/**
 * 从选中那枚往回追上游，逐层展开到 `MAX_CHAIN_DEPTH`。
 *
 * 回响和命运在这里不分家（见 `ChainPoint`）：一条链可以是「事件 → 命运 →
 * 命运 → 回响」，往回追的时候只问「谁是我的因」。
 *
 * 返回每一枚的代际（选中的是 0）和每一段连线。同一枚可能被两条支线同时
 * 指到（会客厅那枚就是），代际按先到的那层算 —— 取最近的一条路径，它是
 * 「离当前这个果最近的因」，画得亮一点是对的。
 *
 * `depth` 里记过就不再展开，顺手也就防住了环。
 */
function buildChain(
  selectedId: string | null,
  pointById: ReadonlyMap<string, ChainPoint>,
): { depth: ReadonlyMap<string, number>; edges: readonly FlowEdge[] } {
  const depth = new Map<string, number>();
  const edges: FlowEdge[] = [];
  if (!selectedId || !pointById.has(selectedId)) return { depth, edges };

  depth.set(selectedId, 0);
  let frontier = [selectedId];

  for (let d = 1; d <= MAX_CHAIN_DEPTH && frontier.length > 0; d += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const to = pointById.get(id);
      if (!to) continue;
      for (const causeId of to.causeIds) {
        const from = pointById.get(causeId);
        if (!from) continue;
        edges.push({
          id: `${causeId}--${id}`,
          from,
          to,
          strength: CHAIN_LINE[d] ?? 0.3,
        });
        if (!depth.has(causeId)) {
          depth.set(causeId, d);
          next.push(causeId);
        }
      }
    }
    frontier = next;
  }

  return { depth, edges };
}

/* ─────────────────────────── 取景避让 ─────────────────────────── */

/**
 * 让选中的一簇整体落进「关闭按钮之下、半层之上」那块可读区。
 *
 * 只在需要时才动：簇已经在可读区里就保持当前取景不变 —— 点一枚旁边的
 * 回响不该把整片图甩走，那样人会丢掉自己看到哪了。
 *
 * 约束冲突时（簇比可读区还高）光球优先 —— 半层讲的是它的内容，被半层
 * 压住的话这一屏就自相矛盾了；顶上少露一个事件反而无所谓。
 *
 * 只按「这一簇」算，不管上游回响在哪 —— 链条可以伸出取景框：把整条链都
 * 塞进一屏就得缩，缩了小卡就变形，而且那样也不再是「还长着」的样子了。
 */
function panForCluster(
  head: ChainPoint,
  nodes: readonly EchoFieldNode[],
  viewport: { w: number; h: number },
  current: Pan,
  sheetH: number,
  scale: number,
): Pan {
  let box = headBox(head);
  for (const n of nodes) box = union(box, nodeBox(n));
  return panForBox(scaleBox(box, scale), viewport, current, sheetH);
}

/**
 * 选中那一枚自己占多少地方。命运是「蝶形 + 底下一枚标题胶囊」，横向由标题
 * 撑开、重心偏下，和光球那种正圆不是一回事，避让得按各自的形状算。
 */
function headBox(p: ChainPoint): Box {
  if (!p.isDestiny) {
    return {
      left: p.x - ECHO_ORB_RADIUS,
      right: p.x + ECHO_ORB_RADIUS,
      top: p.y - ECHO_ORB_RADIUS,
      bottom: p.y + ECHO_ORB_RADIUS,
    };
  }
  const halfW = Math.max(DESTINY_CORE, p.title.length * 14 + 42) / 2;
  return {
    left: p.x - halfW,
    right: p.x + halfW,
    top: p.y - DESTINY_CORE / 2 - 6,
    bottom: p.y + DESTINY_CORE / 2 + DESTINY_PILL_H,
  };
}

/** 点开一枚散件事件时，只需要让那一张小卡自己露在半层之上。 */
function panForNode(
  node: EchoFieldNode,
  viewport: { w: number; h: number },
  current: Pan,
  sheetH: number,
  scale: number,
): Pan {
  return panForBox(scaleBox(nodeBox(node), scale), viewport, current, sheetH);
}

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * 画布坐标的占位 → 屏幕上的占位。
 *
 * 避让算的是「这块地方在屏幕上落在哪」，而画布是缩放着画的（`transform` 里
 * translate 之后还有 scale），所以得先把盒子按倍率折算过来，之后那套加减
 * `pan` 的算法才成立。
 */
function scaleBox(b: Box, s: number): Box {
  return { left: b.left * s, right: b.right * s, top: b.top * s, bottom: b.bottom * s };
}

/** 小卡的占位。 */
function nodeBox(n: EchoFieldNode): Box {
  const half = 16 * n.scale;
  return {
    left: n.x - half,
    right: n.x - half + estimateNodeWidth(n),
    top: n.y - half,
    bottom: n.y + half,
  };
}

function union(a: Box, b: Box): Box {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

function panForBox(
  box: Box,
  viewport: { w: number; h: number },
  current: Pan,
  sheetH: number,
): Pan {
  const maxBottom = viewport.h - sheetH - SHEET_GAP;
  let { x, y } = current;
  if (box.top + y < SAFE_TOP) y = SAFE_TOP - box.top;
  if (box.bottom + y > maxBottom) y = maxBottom - box.bottom;

  if (box.right + x > viewport.w - SAFE_SIDE) {
    x = viewport.w - SAFE_SIDE - box.right;
  }
  if (box.left + x < SAFE_SIDE) x = SAFE_SIDE - box.left;

  return { x, y };
}

/* ─────────────────────────── 连线 ─────────────────────────── */

/**
 * 字号（画布 px，再按 `weight` 反向补偿）。字得小到远看是一根线，又大到凑近能
 * 认出 `echo.brew` —— 七上下是这两件事的交界。
 */
const WIRE_FONT = 7.2;
/**
 * 字距，按字号折算。留出这一档，一串字远看才是「一条由字连成的线」而不是一条
 * 涂满的黑带；再宽就散成一颗颗，线断了。
 */
const WIRE_TRACKING = 0.26;
/** 等宽字的字身宽度大致是字号的六成，用来估一条线能装几个字。 */
const WIRE_ADVANCE = 0.6;
/**
 * 字外面那层绿光的半径（屏幕 px，内部按 `weight` 折算）。
 *
 * 挂在整层上做一次 `drop-shadow`，不是逐字加光晕：一层就是一次光栅化，实测满
 * 帧；逐字要么得画两遍（字形翻倍），要么得走 SVG 滤镜（每个字一次）。
 *
 * 有这层光，字才像是荧光屏上发出来的，而不是印在黑纸上的。半径压得很小 ——
 * 大了字会糊成一条绿带，那就白写这些字了。
 */
const WIRE_GLOW = 0.7;

/**
 * 星图上那些字外面的一点光。
 *
 * 线已经是发着光的代码了（`WIRE_GLOW`），字要是干干净净地印在上面，两者就不像
 * 长在同一层。给字也垫一点同色的晕，整屏才是一块荧光屏，而不是荧光屏上贴了张
 * 标签。压得很浅 —— 再多一点，11px 的字就糊了。
 */
const FIELD_TEXT_GLOW = `0 0 6px ${LINE_ACCENT}55`;

/**
 * 静息态的那张网：图上每一条因果都连着 —— 只不过线不是画出来的，是写出来的。
 *
 * 每条线上串的是一段代码：多数是 0/1 和运算符，偶尔嵌一个 `echo.brew`、`+0.03`
 * 这样看得懂的词（词表见 `wire-code.ts`，和底下那张运转日志同一门语言）。远看
 * 是一条淡绿的虚线，凑近才发现它一直是字。
 *
 * 这么写不是为了炫技：这一屏讲的是世界的背面，而背面的意思就是「这些关系是被
 * 算出来的」。一根笔画只能说「它们连着」，一串代码还能说「它们正被算着」。底下
 * 那张卡说世界在算，这张网就是它算的东西本身。
 *
 * 刻意压得很淡 —— 它的作用是让人看出「这些事本来就互相牵着」，而不是让人去读某
 * 一条。一旦有东西被选中，它再退一档（`aside`），把注意力让给被挑亮的那条链。
 *
 * 渐变照旧：因那头几乎透明、果那头满色。所以就算没选中，顺着字往哪头变亮，也读
 * 得出这段因果朝哪儿走。
 *
 * 这张网一帧都不能重画（满图一百多条，一次重排上万个字形）。所以：字是静态的，
 * 运转感交给 `RestGlints`；每条线各自 memo（见 `CodeWire`），新事件到场时只有新
 * 那条要排版；字号按 `weight` 量化过（见 `wireFont`），捏合缩放时不会每一帧都重
 * 排一次。
 */
function RestLines({
  edges,
  field,
  aside,
  weight,
}: {
  edges: readonly FlowEdge[];
  field: EchoField;
  aside: boolean;
  /** 字号的反向补偿：缩小时按倍率放大，屏幕上的分量才不变（见 `lineWeight`）。 */
  weight: number;
}) {
  const font = wireFont(weight);
  if (edges.length === 0) return null;

  return (
    <svg
      className="absolute left-0 top-0 transition-opacity duration-500 ease-out"
      width={field.width}
      height={field.height}
      viewBox={`0 0 ${field.width} ${field.height}`}
      opacity={aside ? REST_LINE_ASIDE : REST_LINE}
      style={{ filter: `drop-shadow(0 0 ${WIRE_GLOW * weight}px ${LINE_ACCENT}88)` }}
      aria-hidden
    >
      <defs>
        {edges.map((e) => (
          <linearGradient
            key={e.id}
            id={`echo-rest-${e.id}`}
            gradientUnits="userSpaceOnUse"
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
          >
            <stop stopColor={LINE_ACCENT} stopOpacity="0.05" />
            <stop offset="0.5" stopColor={LINE_ACCENT} stopOpacity="0.62" />
            <stop offset="1" stopColor={LINE_ACCENT} stopOpacity="1" />
          </linearGradient>
        ))}
      </defs>

      {edges.map((e) => (
        <CodeWire
          key={e.id}
          id={e.id}
          from={e.from}
          to={e.to}
          font={font}
          fill={`url(#echo-rest-${e.id})`}
        />
      ))}
    </svg>
  );
}

/**
 * 一条写成代码的线。
 *
 * `<textPath>` 让字顺着路径走，连拐角都跟着拐 —— 竖着那截字就立起来，横着那截
 * 躺平，满屏看下去像一块板子上的走线。
 *
 * memo 是必需的而不是优化：这一屏每隔几秒就有新事件到场，到场时 `restEdges` 整
 * 个重算，没有 memo 的话一百多条线上的上万个字形会跟着重排一遍，屏幕会硬卡一
 * 下。几何和字号不变就不重排，于是到场只花新那一条的钱。
 */
const CodeWire = memo(function CodeWire({
  id,
  from,
  to,
  font,
  fill,
  weight = 400,
}: {
  id: string;
  from: Point;
  to: Point;
  /** 画布坐标下的字号。 */
  font: number;
  /** 纯色或 `url(#gradient)`。 */
  fill: string;
  weight?: number;
}) {
  const tracking = font * WIRE_TRACKING;
  const chars = Math.max(
    2,
    Math.round(linkLength(from, to) / (font * WIRE_ADVANCE + tracking)),
  );
  /*
   * 种子取几何而不是线的 id：同一段因果在静息层和高亮层各画一次（id 不同），
   * 种子若跟着 id 走，两层就会是两串不同的字，叠在一起成了重影。取几何，两层
   * 逐字对齐，选中时只是同一串代码被点亮。
   */
  const seed = `${Math.round(from.x)}:${Math.round(from.y)}>${Math.round(
    to.x,
  )}:${Math.round(to.y)}`;

  return (
    <>
      {/*
        路径本身不描边，只作为字的轨道 —— 线的实体就是那串字。留着 <path> 是因为
        `<textPath>` 只能引用文档里的路径。
      */}
      <path id={`echo-wire-${id}`} d={linkPath(from, to)} fill="none" />
      <text
        className="font-mono"
        fontSize={font}
        letterSpacing={tracking}
        fontWeight={weight}
        fill={fill}
        dominantBaseline="central"
      >
        {/*
          `href` 而不是 `xlinkHref`：SVG2 的写法，现代浏览器都认，也不用给 svg
          元素挂 xlink 命名空间。
        */}
        <textPath href={`#echo-wire-${id}`}>{wireCode(seed, chars)}</textPath>
      </text>
    </>
  );
});

/**
 * 字号按倍率补偿，再量化到半档。
 *
 * 量化是为了捏合：字号一变，整张网上万个字形就得重新沿路径排一次（几十毫秒）。
 * 连续跟手的缩放会让这件事每帧发生一次。量化之后，从最小缩到最大只跨过两三档，
 * 中间的每一帧都是纯合成。
 */
function wireFont(weight: number): number {
  return WIRE_FONT * (Math.round(weight * 2) / 2);
}

/**
 * 同时在路上的光点数。够让取景框里随时有三四处在动，又不至于变成一场灯光秀 ——
 * 画布比这一屏大，任一时刻有小半数的光点跑在框外，所以数目得比「想看见几个」多。
 */
const GLINT_COUNT = 18;
/** 走完一条线的基准用时，实际每颗在这上下浮动（见 `GLINT_SPREAD`）。 */
const GLINT_TRAVEL_MS = 3600;
const GLINT_SPREAD = 0.45;
/** 走完之后歇多久再挑下一条：歇一会儿，动静才有疏密。 */
const GLINT_REST_MS = 900;
const GLINT_REST_JITTER_MS = 3600;
/** 跑动那个字的字号（屏幕 px，内部按 `weight` 折算成画布 px）。 */
const GLINT_SIZE = 11;
/** 跑的时候多久换一个字。换得比读得快一点，看着是在闪，不是在拼词。 */
const GLINT_FLICKER_MS = 150;
/** 弧线的取样段数。曲率很浅，二十段的折线已经看不出棱。 */
const GLINT_STEPS = 20;
/** 光点自身的亮度。跟静息线一个道理：有东西被选中时退到几乎看不见。 */
const GLINT_OPACITY = 0.5;
const GLINT_OPACITY_ASIDE = 0.12;

/**
 * 静息态那张网上跑的微光：每次挑十几条线，各放一个字，顺着「因 → 果」的方向淌
 * 过去，到头就熄，歇一会儿再换一条。
 *
 * 线本身既然是代码（见 `CodeWire`），跑在上面的就不该还是一颗光点 —— 那是两套
 * 语言。所以跑的也是字：比线上的字亮一档、大一点，一边走一边换字，像一个正在
 * 执行的游标扫过这段代码。
 *
 * 为什么不是让虚线自己漂 —— 那才是这个需求的第一直觉。实测过：动
 * `stroke-dashoffset` 会让整张网每帧重新光栅化一次，满图一百来条描边虚线，帧
 * 间隔从 16ms 掉到 150ms（七帧）；只让十条漂也还是 75ms。一个「氛围」级别的效果
 * 不配吃掉整屏的流畅度。
 *
 * 光点这条路只动 transform 和 opacity，浏览器能纯粹在合成器上做（每颗自己一
 * 层，`will-change`），那张网一帧都不用重画 —— 实测二十八颗仍然满帧。
 *
 * 换来的是「不是每条线同时都在流」，而是每条线轮着被点亮。恰好也更像世界该有
 * 的样子：不是所有因果都在同一刻起作用，是这儿一处那儿一处地在动。
 *
 * 轨迹用 `sampleLink` 现算，和线本身同一条折线、连磨圆的拐角都算进去，所以光点
 * 是贴着线走的，不是在旁边飘 —— 拐角处尤其看得出来：抄近路的话，光点会从弯的外
 * 侧切过去。取样按弧长等分，三段长短差得再多，跑起来也是匀速。
 *
 * 动画用 WAAPI 而不是 CSS：每颗的轨迹各不相同，keyframes 得现生成。
 */
function RestGlints({
  edges,
  weight,
  aside,
}: {
  edges: readonly FlowEdge[];
  /** 同 `RestLines`：光点大小按倍率反向补偿，缩到哪一档屏幕上都一样大。 */
  weight: number;
  aside: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  /*
   * 线的集合会随着新事件到场变（`restEdges` 每次到场都重算），但光点不该跟着
   * 重来一遍 —— 那会让满屏的光点在同一刻一起跳。所以走 ref：效果只在「有没有线
   * 可跑」和倍率变化时重建，跑的时候读的始终是最新那份。
   */
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const ready = edges.length > 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const beads = Array.from(host.children) as HTMLElement[];
    const timers: number[] = [];
    const flickers: number[] = [];
    let alive = true;

    const ride = (bead: HTMLElement) => {
      if (!alive) return;
      const pool = edgesRef.current;
      const edge = pool[Math.floor(Math.random() * pool.length)];
      if (!edge) return;

      const path = sampleLink(edge.from, edge.to, GLINT_STEPS).map((p) => ({
        transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`,
      }));
      const duration =
        GLINT_TRAVEL_MS * (1 + (Math.random() * 2 - 1) * GLINT_SPREAD);

      /*
       * 换字只动这一个字符节点，字宽固定（等宽字 + 定死的盒子），所以既不会牵
       * 动别的东西重排，也不影响这颗自己那层的合成。
       */
      bead.textContent = wireGlyph();
      const flick = window.setInterval(() => {
        bead.textContent = wireGlyph();
      }, GLINT_FLICKER_MS);
      flickers.push(flick);

      bead.animate(path, { duration, easing: "linear", fill: "forwards" });
      /*
       * 两头都淡进淡出：光点不该在因那头凭空亮起、在果那头一刀切掉。尾段留得
       * 比头段长，读起来是「淌到了」而不是「跑没了」。
       */
      const glow = bead.animate(
        [
          { opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.72 },
          { opacity: 0 },
        ],
        { duration },
      );
      glow.finished
        .then(() => {
          window.clearInterval(flick);
          if (!alive) return;
          timers.push(
            window.setTimeout(
              () => ride(bead),
              GLINT_REST_MS + Math.random() * GLINT_REST_JITTER_MS,
            ),
          );
        })
        .catch(() => window.clearInterval(flick));
    };

    // 开场就错开：不然十几颗会齐步从各自的起点出发，一眼看出是同一个发令枪。
    beads.forEach((bead) => {
      timers.push(
        window.setTimeout(
          () => ride(bead),
          Math.random() * (GLINT_TRAVEL_MS + GLINT_REST_JITTER_MS),
        ),
      );
    });

    return () => {
      alive = false;
      for (const t of timers) window.clearTimeout(t);
      for (const f of flickers) window.clearInterval(f);
      for (const bead of beads) for (const a of bead.getAnimations()) a.cancel();
    };
  }, [ready, weight]);

  const size = GLINT_SIZE * weight;

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 transition-opacity duration-500 ease-out"
      style={{ opacity: aside ? GLINT_OPACITY_ASIDE : GLINT_OPACITY }}
    >
      {Array.from({ length: GLINT_COUNT }, (_, i) => (
        <span
          key={i}
          className="absolute left-0 top-0 block text-center font-mono opacity-0"
          style={{
            /* 盒子定死：换字时不重排，也让 translate(-50%,-50%) 稳稳落在字心上 */
            width: size * 1.2,
            fontSize: size,
            lineHeight: `${size}px`,
            color: "#d9ffe9",
            textShadow: `0 0 ${size * 0.5}px ${LINE_ACCENT}, 0 0 ${size * 1.4}px ${LINE_ACCENT}99`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}

/**
 * 汇聚线。两种上游共用一套画法 —— 事件/时机 → 回响，以及更早的回响 →
 * 后来的回响。它们在世界里是一回事（都是「因」），画成两种反而是在教术语。
 *
 * 和静息那张网写的是同一串代码（见 `CodeWire`：种子取的是几何，所以同一段因
 * 果在两层里逐字对齐），只是这一条被点亮了：字满色、加粗，底下垫一层散开的柔
 * 光，另有一道亮流顺着字往果那头淌 —— 这段代码此刻正在被执行。
 *
 * 三层渐变都是上游端透明、下游端满色：线本身在靠近光球时才显形，那道亮
 * 流也是跑到终点时最亮。汇聚感来自这个明暗差，不是来自线在动。方向感也
 * 是这么来的 —— 哪头亮，哪头就是果。
 */
function FlowLines({
  edges,
  field,
  weight,
}: {
  edges: readonly FlowEdge[];
  field: EchoField;
  /** 同 `RestLines`：线宽和那两层模糊都按倍率补偿，缩小时才不糊成一根发丝。 */
  weight: number;
}) {
  if (edges.length === 0) return null;

  return (
    <svg
      className="absolute left-0 top-0"
      width={field.width}
      height={field.height}
      viewBox={`0 0 ${field.width} ${field.height}`}
      /* 同静息层：字自己也要发光，不然亮起来的只是底下那层柔光 */
      style={{
        filter: `drop-shadow(0 0 ${WIRE_GLOW * 1.4 * weight}px ${LINE_ACCENT}aa)`,
      }}
      aria-hidden
    >
      <defs>
        {/* 铺开的底光：模糊得比线宽得多，线才像发着光而不是描出来的 */}
        <filter
          id="echo-line-bloom"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={3.6 * weight} />
        </filter>
        {/* 亮流的两头要化掉，不然又成了一段一段的虚线 */}
        <filter
          id="echo-line-comet"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={1.9 * weight} />
        </filter>

        {edges.map((e) => (
          <linearGradient
            key={e.id}
            id={`echo-flow-${e.id}`}
            gradientUnits="userSpaceOnUse"
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
          >
            <stop stopColor={LINE_ACCENT} stopOpacity="0" />
            <stop offset="0.55" stopColor={LINE_ACCENT} stopOpacity="0.55" />
            <stop offset="1" stopColor={LINE_ACCENT} />
          </linearGradient>
        ))}
      </defs>

      {edges.map((e, i) => {
        const d = linkPath(e.from, e.to);
        const stroke = `url(#echo-flow-${e.id})`;
        return (
          <g key={e.id} opacity={e.strength}>
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={4.5 * weight}
              strokeLinecap="round"
              opacity={0.26}
              filter="url(#echo-line-bloom)"
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={2.6 * weight}
              strokeLinecap="round"
              pathLength={100}
              /*
               * 一次只有一段在路上（虚线周期正好等于 pathLength），靠模糊
               * 化掉两头，读起来是流光不是虚线。必须匀速：这段跑到光球那
               * 头时，它的头已经从事件那头重新探出来了，衔接得上；一旦加
               * 缓动，循环接缝处就会顿一下。
               */
              strokeDasharray="20 80"
              filter="url(#echo-line-comet)"
              className="motion-safe:animate-[livo-echo-flow_2.6s_linear_infinite]"
              style={{ animationDelay: `${i * 260}ms` }}
            />
            {/* 线的实体：和静息态同一串代码，这里满色加粗 */}
            <CodeWire
              id={`flow-${e.id}`}
              from={e.from}
              to={e.to}
              font={wireFont(weight)}
              fill={stroke}
              weight={600}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ───────────────────── 连线的走法：圆角折线 ───────────────────── */

/**
 * 拐角的圆角半径（画布 px）。给得比较大 —— 小圆角在缩到全局那一档时看不出来，
 * 折线就成了硬转角，那是流程图的味道，不是这一屏要的。实际用多少还会被两侧线
 * 段的长度掐住（见 `linkPath`）：短段上拐大弯会把线拐到段外面去。
 */
const LINK_RADIUS = Math.round(16 * ZOOM);
/** 圆角摊成几段折线来算长度和取样（给光点用，见 `sampleLink`）。 */
const CORNER_STEPS = 6;

/**
 * 一条连线怎么走：正交两折，中途换一次方向。
 *
 * 原先是一条鼓向一侧的二次贝塞尔（「刻进石头的光」那个调子）。改成折线是为了配
 * 这一屏后来长成的样子 —— 底下滚着终端日志、字收成一种绿、节点收成光点，曲线在
 * 这堆东西里是唯一还带手感的笔迹。折线加圆角读起来是「布线」：世界背面是接线
 * 的地方，不是画画的地方。
 *
 * 拐点取在中途而不是贴着某一端：贴着端点拐，满图的线会在光球周围挤成一把梳子；
 * 取中途，每条线的横段各在自己的高度上，一百多条也不会叠成一根。
 *
 * 长边优先定方向 —— 竖着走得多的先竖后横再竖，横着走得多的反过来。这样中间那段
 * 短、两头那段长，转折落在视线扫过去的中段，而不是折在端点上。
 */
function linkRoute(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // 几乎共线就别折了：一个像素的落差折出来的是一记抖动，不是一次转折。
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return [from, to];
  if (Math.abs(dy) >= Math.abs(dx)) {
    const my = from.y + dy / 2;
    return [from, { x: from.x, y: my }, { x: to.x, y: my }, to];
  }
  const mx = from.x + dx / 2;
  return [from, { x: mx, y: from.y }, { x: mx, y: to.y }, to];
}

/**
 * 折线的 SVG 路径，拐角磨圆。
 *
 * 圆角用二次贝塞尔画：拐点本身当控制点，两条腿各退 r 作起终点 —— 这是画圆角最
 * 省的写法，出来的弧和四分之一圆几乎重合，而且不用管转的是哪个方向。
 *
 * r 按两侧腿长各掐一半：中间那段常常很短（两点横向只差一点时），照标称半径拐会
 * 直接拐出段外，线看着就断了。
 */
function linkPath(from: Point, to: Point): string {
  const pts = linkRoute(from, to);
  const at = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  let d = `M ${at(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const r = Math.min(
      LINK_RADIUS,
      dist(prev, cur) / 2,
      dist(cur, next) / 2,
    );
    d += ` L ${at(along(cur, prev, r))} Q ${at(cur)} ${at(along(cur, next, r))}`;
  }
  return `${d} L ${at(pts[pts.length - 1])}`;
}

/** 从 `at` 朝 `toward` 走 `d` 的那个点。 */
function along(at: Point, toward: Point, d: number): Point {
  const len = dist(at, toward) || 1;
  return {
    x: at.x + ((toward.x - at.x) / len) * d,
    y: at.y + ((toward.y - at.y) / len) * d,
  };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * 沿一条连线等距取 `count` 个点 —— 光点就照这串点飞（见 `RestGlints`）。
 *
 * 按弧长等分，不按参数等分：折线三段长短悬殊，按段数平均分会让光点在短段上慢
 * 得像卡住、在长段上一闪而过。圆角先摊成折线再一起量，所以取出来的点落在磨圆
 * 之后的那条线上，而不是原来的硬角上。
 */
function sampleLink(from: Point, to: Point, count: number): Point[] {
  const flat = flattenLink(from, to);
  const acc: number[] = [0];
  for (let i = 1; i < flat.length; i += 1) {
    acc.push(acc[i - 1] + dist(flat[i - 1], flat[i]));
  }
  const total = acc[acc.length - 1] || 1;

  const out: Point[] = [];
  let seg = 1;
  for (let k = 0; k <= count; k += 1) {
    const want = (total * k) / count;
    while (seg < flat.length - 1 && acc[seg] < want) seg += 1;
    const segLen = acc[seg] - acc[seg - 1] || 1;
    const t = clamp((want - acc[seg - 1]) / segLen, 0, 1);
    out.push({
      x: flat[seg - 1].x + (flat[seg].x - flat[seg - 1].x) * t,
      y: flat[seg - 1].y + (flat[seg].y - flat[seg - 1].y) * t,
    });
  }
  return out;
}

/** 一条连线摊平之后有多长 —— 算这条线上能串下几个字（见 `CodeWire`）。 */
function linkLength(from: Point, to: Point): number {
  const flat = flattenLink(from, to);
  let len = 0;
  for (let i = 1; i < flat.length; i += 1) len += dist(flat[i - 1], flat[i]);
  return len;
}

/** 把连线摊成一串首尾相接的点：直段照抄，圆角切成 `CORNER_STEPS` 小段。 */
function flattenLink(from: Point, to: Point): Point[] {
  const pts = linkRoute(from, to);
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const r = Math.min(LINK_RADIUS, dist(prev, cur) / 2, dist(cur, next) / 2);
    const a = along(cur, prev, r);
    const b = along(cur, next, r);
    out.push(a);
    for (let k = 1; k <= CORNER_STEPS; k += 1) {
      const t = k / CORNER_STEPS;
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * cur.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cur.y + t * t * b.y,
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* ─────────────────────────── 光球 / 节点 ─────────────────────────── */

/**
 * 生成那一下荡出去的波纹。
 *
 * 两圈错开着荡，荡完就没了 —— 它标的是「这里刚有东西出来」这个瞬间。尺寸由外
 * 面按倍率折算好传进来（画布 px），所以缩到哪一档，屏上看到的圈都是一样大。
 */
function SpawnPulse({ at, size }: { at: Point; size: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: at.x, top: at.y }}
    >
      {[0, 220].map((delay) => (
        <span
          key={delay}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            border: `${Math.max(1, size / 48)}px solid ${LINE_ACCENT}`,
            boxShadow: `0 0 ${size / 5}px ${LINE_ACCENT}66`,
            animation: `livo-spawn-ring ${ARRIVE_LIT_MS + ARRIVE_HOLD_MS}ms ease-out ${delay}ms both`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * 出场的三拍：屏幕中央生成 → 亮住一拍 → 飞回自己的位置。
 *
 * 只管时序，几何交给调用方拼 —— 因为这几个元素的 transform 是内联算出来的
 * （`translate(-50%,-50%)` 加选中态缩放），出场的偏移得拼在它前面。也正因如
 * 此走 transition 而不是 keyframes：keyframes 会在动画期间整条盖掉 transform，
 * 位置会跳。
 *
 * 飞完还要回到默认那套 500ms 过渡（`done`），不然之后每次明暗变化都拖着一秒。
 */
type ArrivalStyle = {
  /** 还没落位时的偏移；已落位是 `null`，位置就是它自己的位置。 */
  at: Spawn | null;
  /** 出场那两拍自己说不透明度；落位之后交回常态（`null`）。 */
  opacity: number | null;
  transition?: string;
  /**
   * 落位了没有。常驻的那些一直是 `true`。
   *
   * 管两件事：出场途中点不着（半路截下来选中它，取景会跟它抢着动），以及字要等
   * 落位才显。
   */
  settled: boolean;
};

function useArrival(spawn?: Spawn): ArrivalStyle {
  const [phase, setPhase] = useState<"seed" | "lit" | "fly" | "done">(
    spawn ? "seed" : "done",
  );

  useEffect(() => {
    if (phase === "done") return;
    if (phase === "seed") {
      // 第一帧先把它按在生成点上（不透明度 0），下一帧才开始亮。
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setPhase("lit"));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    const t = window.setTimeout(
      () => setPhase(phase === "lit" ? "fly" : "done"),
      phase === "lit" ? ARRIVE_HOLD_MS : ARRIVE_FLY_MS,
    );
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "seed" && spawn) {
    return { at: spawn, opacity: 0, transition: "none", settled: false };
  }
  if (phase === "lit" && spawn) {
    return {
      at: spawn,
      opacity: 1,
      transition: `opacity ${ARRIVE_LIT_MS}ms ease-out`,
      settled: false,
    };
  }
  if (phase === "fly") {
    return {
      at: null,
      opacity: null,
      transition: `opacity ${ARRIVE_FLY_MS}ms ease-out, transform ${ARRIVE_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      settled: false,
    };
  }
  return { at: null, opacity: null, settled: true };
}

/**
 * 静息态里的一枚光点 —— 回响、命运、事件、时机在没被挑中时都是这个样子，只差
 * 颜色和大小（见 `ECHO_DOT` 一段）。
 *
 * 实心圆加两层 box-shadow 就够：外面那层散得开，是「亮」；里面那层紧贴着圆，是
 * 「实」。没用 SVG 也没用滤镜 —— 满图一百多枚，这两样都要按倍率补偿，而 box-
 * shadow 只在铺一次的时候画，之后一帧都不重算。
 *
 * `on` 是渐显渐隐而不是拆掉重建：选中是一次「现形」，光点淡出、原形淡入，两边
 * 用同一段时长错着走，读起来才是同一个东西换了个说法。
 */
function FieldDot({
  core,
  color,
  on,
  cx,
}: {
  core: number;
  color: string;
  on: boolean;
  /** 圆心在父容器里的横向位置；不给就落在正中（连线接的也是这个点）。 */
  cx?: number;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 block rounded-full transition-opacity duration-500 ease-out"
      style={{
        left: cx ?? "50%",
        width: core,
        height: core,
        marginLeft: -core / 2,
        marginTop: -core / 2,
        background: color,
        boxShadow: `0 0 ${core * 1.8}px ${color}80, 0 0 ${core * 0.7}px ${color}cc`,
        opacity: on ? 1 : 0,
      }}
    />
  );
}

function FieldOrb({
  orb,
  selected,
  revealed,
  opacity,
  hit,
  spawn,
  onSelect,
}: {
  orb: EchoFieldOrb;
  selected: boolean;
  /** 在被挑亮的那条链上 —— 现出光球本体，其余时候只是一枚暖橙光点。 */
  revealed: boolean;
  /** 由代际算好：选中最亮，上游依次淡，链外最暗。 */
  opacity: number;
  /** 命中区的反向补偿倍数（缩小时放大，视觉不变）。 */
  hit: number;
  /** 是打开之后才冒出来的那一枚：先在屏幕中央生成，再飞到这儿来。 */
  spawn?: Spawn;
  onSelect: () => void;
}) {
  const arrival = useArrival(spawn);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`世界回响：${orb.story.title}`}
      className="pointer-events-auto absolute cursor-[inherit] transition-[opacity,transform,filter] duration-500 ease-out"
      style={{
        left: orb.x,
        top: orb.y,
        width: ORB_HIT * hit,
        height: ORB_HIT * hit,
        opacity: arrival.opacity ?? opacity,
        transform: `${
          arrival.at ? `translate(${arrival.at.dx}px, ${arrival.at.dy}px) ` : ""
        }translate(-50%, -50%) scale(${
          arrival.at ? arrival.at.boost : selected ? 1.08 : 1
        })`,
        transition: arrival.transition,
        pointerEvents: arrival.settled ? undefined : "none",
      }}
    >
      {/* 没挑中它的时候，它只是一枚暖橙的点 */}
      <FieldDot core={ECHO_DOT} color={ACCENT} on={!revealed} />

      {/*
        命中区比球大一圈，球本身仍按设计稿的 44 画，再整体缩放到 ZOOM ——
        `EchoOrb` 内部那些光晕偏移都是写死的 px（地图标记也用同一份），放在
        缩放盒子里等比放大，比给它加一路 size 参数干净。
      */}
      <span
        className="absolute left-1/2 top-1/2 block transition-opacity duration-500 ease-out"
        style={{
          width: ECHO_ORB_CORE,
          height: ECHO_ORB_CORE,
          transform: `translate(-50%, -50%) scale(${ZOOM})`,
          opacity: revealed ? 1 : 0,
        }}
      >
        {/* 只有选中那颗在喘：上游也喘的话，就分不出谁是当下这个果了 */}
        <EchoOrb breathe={selected} />
      </span>
    </button>
  );
}

/**
 * 星图上的一枚命运。
 *
 * 借地图上那枚标记的两样东西 —— 蝶形和标题胶囊，以及潜在／注定那两种配色。
 * 借是有理由的：人在地图上就是靠这两样认出「这是一场命运」的，换一套画法只
 * 会让人以为这是第三种东西。缩到星图的尺度：漩涡和雾气去掉（满图十几枚会糊
 * 成一片），只留蝶形、一圈冷光和那枚胶囊。
 *
 * 胶囊是绝对定位、探出按钮盒子之外的 —— 它仍然属于这个 <button>，所以点标题
 * 和点蝶形是同一个动作。命中判定按核心那圈走，连线也接在核心圆心上。
 *
 * 选中时那圈冷光铺开一倍，但线只往它这儿汇、不往外走（见 `flowEdges`）：这
 * 一枚此刻是被看的那个果，能量流向它，不从它流出去。
 */
function FieldDestiny({
  destiny,
  selected,
  revealed,
  opacity,
  labels,
  hit,
  onSelect,
}: {
  destiny: EchoFieldDestiny;
  selected: boolean;
  /** 在被挑亮的那条链上 —— 现出蝶形，其余时候只是一枚同色的光点。 */
  revealed: boolean;
  opacity: number;
  /** 这个尺度上标题读得出来吗 —— 读不出来就别画（见 `LABEL_SCALE`）。 */
  labels: boolean;
  hit: number;
  onSelect: () => void;
}) {
  const { seed } = destiny;
  const destined = seed.kind === "destined";
  const accent = destined ? DESTINED_ACCENT : DESTINY_ACCENT;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${destined ? "注定" : "潜在"}命运：${seed.title}`}
      className="pointer-events-auto absolute cursor-[inherit] transition-[opacity,transform] duration-500 ease-out"
      style={{
        left: destiny.x,
        top: destiny.y,
        width: DESTINY_CORE,
        height: DESTINY_CORE,
        opacity,
        transform: `translate(-50%, -50%) scale(${selected ? 1.06 : 1})`,
      }}
    >
      {/*
        命中区补偿。按钮盒子只能是蝶形核心那么大（那圈冷光和描边都按
        `inset-0` 画，放大按钮等于放大视觉），所以另铺一张看不见的垫子把可点
        范围撑开 —— 它在按钮里，点它就是点这枚命运。
      */}
      {hit > 1 ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: DESTINY_CORE * hit, height: DESTINY_CORE * hit }}
        />
      ) : null}

      {/* 没挑中它的时候，它只是一枚同色的点 */}
      <FieldDot core={DESTINY_DOT} color={accent} on={!revealed} />

      {/*
        冷光垫在最底下，选中时铺开一倍 —— 命运是「牵着的」，不是在喘。
        没现形时收到光点那个量级：这一圈是给蝶形垫的，蝶形没出来它就该跟着收。
      */}
      <span
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height,opacity] duration-500 ease-out"
        style={{
          width: selected
            ? DESTINY_CORE * 2.4
            : revealed
              ? DESTINY_CORE * 1.5
              : DESTINY_DOT * 2.2,
          height: selected
            ? DESTINY_CORE * 2.4
            : revealed
              ? DESTINY_CORE * 1.5
              : DESTINY_DOT * 2.2,
          background: `radial-gradient(circle, ${accent}59 0%, ${accent}00 70%)`,
          opacity: selected ? 1 : 0.7,
        }}
      />

      <span
        className="absolute inset-0 flex items-center justify-center rounded-full border transition-[color,background-color,border-color,box-shadow,opacity] duration-500"
        style={{
          borderColor: `${accent}${selected ? "99" : "4d"}`,
          background: `${accent}${selected ? "26" : "14"}`,
          boxShadow: selected ? `0 0 14px ${accent}66` : undefined,
          opacity: revealed ? 1 : 0,
        }}
      >
        <Image
          src={
            destined
              ? "/figma/tilia/destiny/butterfly-destined.svg"
              : "/figma/tilia/destiny/butterfly-potential.svg"
          }
          alt=""
          width={DESTINY_WING}
          height={DESTINY_WING}
          draggable={false}
          className="max-w-none -rotate-[18deg]"
          style={{ width: DESTINY_WING, height: DESTINY_WING }}
        />
      </span>

      {/*
        胶囊。地图上是满色渐变，这里压到半透明 —— 满图十几枚满色胶囊会盖过
        回响光球，而这一屏两者是并列的。选中那枚也只是把这层色加浓一档，不像
        地图那样填满：填满了字就得跟着变白，而这一屏的字统一是绿的（见下面那
        行）。命运的红蓝仍然认得出来，它现在由描边、光晕和底色的那层薄色扛。
      */}
      <span
        className={`absolute left-1/2 flex w-max -translate-x-1/2 items-center gap-[5px] rounded-full border py-[4px] pl-[6px] pr-[10px] transition-[color,background,border-color,opacity,top] duration-500 ${
          labels ? "" : "pointer-events-none"
        }`}
        style={{
          // 跟着上面那枚图标走：现形时挂在蝶形下面，收成光点时也跟着收上去。
          top: revealed
            ? DESTINY_CORE + 7
            : (DESTINY_CORE + DESTINY_DOT) / 2 + 8,
          borderColor: `${accent}${selected ? "99" : "33"}`,
          background: selected ? `${accent}3d` : `${accent}1f`,
          boxShadow: selected ? `0 0 12px ${accent}4d` : undefined,
          opacity: labels ? 1 : 0,
        }}
      >
        {/*
          胶囊里那几张脸也跟着现形收放：静息态整屏不出人脸，这是「收成光点」这条
          规矩里的一处，漏了它，命运就成了唯一还挂着头像的东西。宽度从 0 撑开，
          标题于是往右让 —— 和节点那边头像挤进来是同一个动作。
        */}
        <span
          className="relative block shrink-0 overflow-hidden transition-[width,opacity] duration-500 ease-out"
          style={{
            width: revealed ? 17 + (seed.speakers.length - 1) * 11 : 0,
            height: 17,
            opacity: revealed ? 1 : 0,
          }}
        >
          <SpeakerStack speakers={seed.speakers} size={17} overlap={6} />
        </span>
        <span
          className="whitespace-nowrap text-[13px] font-medium leading-none"
          style={{ color: INK_TITLE, textShadow: FIELD_TEXT_GLOW }}
        >
          {seed.title}
        </span>
      </span>
    </button>
  );
}

/**
 * 星图上的一个事件或时机。
 *
 * 事件是头像组 + 参与者 + 那句话；时机没有参与者，只有一枚光点 + 一句
 * 世界自己的变化。三级 scale 是景深，不是层级 —— 远一点的小一点。
 *
 * 带 `onSelect` 的是还在酝酿的散件事件：整张卡（头像连着文字）都是点击
 * 区，而不是只有头像 —— 卡本身就是一句话，读它和点它该是同一个动作。
 *
 * `w-max` 不能省：绝对定位的 flex 默认按「到画布右边界还剩多少」收缩，
 * 靠右的卡会被压得头像挤成一团、文字互相叠上去。
 */
function FieldNode({
  node,
  lit,
  picked,
  aside,
  labels,
  spawn,
  onSelect,
}: {
  node: EchoFieldNode;
  lit: boolean;
  picked: boolean;
  /** 场上已经有选中的东西，而这张不是它 —— 散件跟着退一档。 */
  aside: boolean;
  /** 缩到全局那一档时字读不出来，只留头像/光点（见 `LABEL_SCALE`）。 */
  labels: boolean;
  /** 是打开之后才冒出来的那一张（见 `useArrival`）。 */
  spawn?: Spawn;
  /** 只有还在酝酿的散件事件给，给了就整张卡可点。 */
  onSelect?: () => void;
}) {
  const s = node.scale;
  const isMoment = node.kind === "moment";
  const anchor = (isMoment ? 12 : 16) * s;
  const active = lit || picked;
  const arrival = useArrival(spawn);
  /*
   * 出场时只出头像/光点，字等落位再显。
   *
   * 一张卡的字比它的头像宽好几倍，在屏幕正中亮出一整句，读到的是「一条通知」，
   * 而这一下要说的是「有个东西出来了」。字留到落位之后，那时它已经在因果网里有
   * 位置了，读起来才是「这是什么」。字本来就带一记 300ms 淡入（`labels`），落
   * 位后接着用同一记。
   */
  const showText = labels && arrival.settled;
  /*
   * 出场那一下的放大是绕盒子中心做的，而这张卡的坐标是它左端那个点（头像/光点
   * 的圆心，连线接在那儿）—— 放大会把这个点朝盒子中心拽走十几像素。把这段拽走
   * 的距离补回去，锚点才真的落在生成点上，簇里几张卡的相对位置也才对得上。
   */
  const spawnDx = arrival.at
    ? arrival.at.dx +
      (estimateNodeWidth(node) / 2 - anchor) * (arrival.at.boost - 1)
    : 0;

  const rest = active
    ? 1
    : node.brewing === undefined
      ? DIM_NODE
      : aside
        ? DIM_ORB_ASIDE
        : LOOSE_NODE;

  const layout = {
    // text-left 不能省：可点的那些卡是 <button>，浏览器给按钮的
    // text-align:center 会把短的那行（参与者名字）顶到中间去。
    className: `absolute flex w-max items-center text-left transition-[opacity,transform] duration-500 ease-out${
      onSelect ? " pointer-events-auto cursor-[inherit]" : ""
    }`,
    style: {
      left: node.x - anchor,
      top: node.y,
      transform: `${
        arrival.at ? `translate(${spawnDx}px, ${arrival.at.dy}px) ` : ""
      }translateY(-50%)${arrival.at ? ` scale(${arrival.at.boost})` : ""}`,
      gap: (isMoment ? 2 : 6) * s,
      opacity: arrival.opacity ?? rest,
      transition: arrival.transition,
      pointerEvents: arrival.settled ? undefined : ("none" as const),
    },
  };

  const body = (
    <>
      {isMoment ? (
        <span
          className="relative block shrink-0"
          style={{ width: 24 * s, height: 24 * s }}
        >
          <FieldDot core={MOMENT_DOT * s} color={LINE_ACCENT} on={!active} />
          <Image
            src="/figma/tilia/echo/moment-dot.svg"
            alt=""
            width={50}
            height={50}
            draggable={false}
            /*
             * max-w-none 不能省：这张图要比父容器宽（光晕溢出在外），
             * preflight 的 img{max-width:100%} 会把宽掐到父元素、高却
             * 留在原值，而这张 SVG 是 preserveAspectRatio="none" ——
             * 结果那枚圆点被拉成竖椭圆。
             */
            className="absolute max-w-none transition-opacity duration-500 ease-out"
            style={{
              width: 50 * s,
              height: 50 * s,
              left: -13 * s,
              top: -13 * s,
              opacity: active ? 1 : 0,
            }}
          />
        </span>
      ) : (
        /*
         * 头像那一格。静息态只留一枚绿点，挑中这一簇才现出头像组。
         *
         * 盒子宽度跟着现形一起变（一个头像那么宽 → 整组那么宽），而不是一直按整
         * 组预留：三个人的事件预留出来是一大片空，光点孤零零挂在左端，右边的字
         * 像掉在了后面。宽度进 transition，现形时字往右让开那一下和头像淡入是同
         * 一段时间，读起来是「头像挤进来了」。
         *
         * 光点的圆心固定落在第一个头像的圆心上（= `anchor`，也就是线接的那个
         * 点）—— 无论现不现形，这个点都不动，线才不会跟着抖。
         */
        <span
          className="relative block shrink-0 transition-[width] duration-500 ease-out"
          style={{
            width: active ? stackWidth(node.speakers.length, s) : 32 * s,
            height: 32 * s,
            filter: active ? `drop-shadow(0 0 ${5 * s}px ${ACCENT})` : undefined,
          }}
        >
          <FieldDot core={NODE_DOT * s} color={LINE_ACCENT} on={!active} cx={anchor} />
          <span
            className="absolute left-0 top-1/2 block -translate-y-1/2 transition-opacity duration-500 ease-out"
            style={{ opacity: active ? 1 : 0 }}
          >
            <SpeakerStack
              speakers={node.speakers}
              size={32 * s}
              overlap={8 * s}
            />
          </span>
        </span>
      )}

      {/*
        字。缩到全局那一档就整块淡掉 —— 那个尺度上 11px 只剩两三个像素，
        画出来是灰糊，不如把这一片留给光点和线（`labels`）。淡出而不是直接
        不渲染：捏合是连续的，突然多出一片字会顿一下。
      */}
      {isMoment ? (
        <p
          className="whitespace-nowrap font-medium transition-opacity duration-300"
          style={{
            fontSize: 11 * s,
            opacity: showText ? 1 : 0,
            color: INK_TITLE,
            textShadow: FIELD_TEXT_GLOW,
          }}
        >
          {node.text}
        </p>
      ) : (
        <span
          className="flex shrink-0 flex-col transition-opacity duration-300"
          style={{ gap: 2 * s, opacity: showText ? 1 : 0 }}
        >
          <span
            className="flex items-baseline whitespace-nowrap"
            style={{ gap: 5 * s }}
          >
            <p
              className="font-medium"
              style={{ fontSize: 10 * s, color: INK_META }}
            >
              {node.speakers.map(speakerName).join("、")}
            </p>
            {/*
              酝酿进度接在名字后面，一个很淡的数字。之前是一条进度线，
              太重了 —— 满图十几条橙线读起来像任务面板，而这件事本来只
              需要一句旁注。
            */}
            {node.brewing !== undefined ? (
              <p
                className="font-medium tabular-nums"
                style={{
                  fontSize: 9 * s,
                  color: picked ? INK_META : INK_FAINT,
                }}
              >
                {brewingPct(node.brewing)}
              </p>
            ) : null}
          </span>
          <p
            className="whitespace-nowrap font-medium"
            style={{
              fontSize: 11 * s,
              color: INK_TITLE,
              textShadow: FIELD_TEXT_GLOW,
            }}
          >
            {node.text}
          </p>
        </span>
      )}
    </>
  );

  if (!onSelect) return <div {...layout}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={picked}
      aria-label={`还在酝酿：${node.text}`}
      {...layout}
    >
      {body}
    </button>
  );
}

/** 头像组摊开有多宽：一个头像，加上后面每个各露出 size - overlap 那一截。 */
function stackWidth(count: number, s: number): number {
  return 32 * s + Math.max(0, count - 1) * 24 * s;
}

/** 酝酿进度的数字写法。星图上只留这一个数，条子留给半层。 */
function brewingPct(v: number): string {
  return `${Math.round(clamp(v, 0, 1) * 100)}%`;
}

/* ─────────────────────────── 半层 ─────────────────────────── */

/**
 * 三张半层共用的外壳：贴底、圆角、上滑进场，加上那层玻璃。
 *
 * 颜色跟着整屏走。原先是「黑 20% + 深蓝 50%」两层叠出来的深蓝玻璃 —— 那是配
 * 深蓝底的；底压到近黑之后，同一片深蓝就成了一块浮在黑上的蓝斑。现在合成一层
 * 近黑（叠两层本来也只是在算同一个合成色，没必要摆两个 div）。
 *
 * 留 26% 的透明和那层模糊：半层要读作「压在星图上的一张卡」，不是一块换了内容
 * 的黑板 —— 底下的线隐约透上来，人才知道图还在那儿。顶边那道白线也是为这个：
 * 底和半层都近黑，不描一下边界就分不出哪儿是卡的上沿。
 */
const SHEET_SHELL =
  "absolute bottom-0 left-0 w-full overflow-hidden rounded-t-[16px] border-t border-[#3bff8f]/15 bg-[#070912]/[0.74] pb-[16px] backdrop-blur-[10px] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * 半层里的字只有一种颜色 —— 和线、和事件光点同一种绿；主次全靠透明度。
 *
 * 这一屏是「世界背面」：看的是世界在拿什么算什么，不是一张读物。字一旦分成白
 * 标题、灰正文、蓝分类，读到的就是一个排版精良的详情页；收成单色之后，它读起来
 * 是一块终端输出 —— 该有的层次仍在（标题最亮、正文次之、分节名几乎沉进背景），
 * 只是全部由「亮多少」承担，不再借颜色。
 *
 * 用带 alpha 的色值而不是 CSS opacity：opacity 会把整个元素连子节点一起压暗，
 * 而这几行字里还夹着头像和图标 —— 那些不该跟着字一起淡。
 */
function ink(alpha: number): string {
  return `${LINE_ACCENT}${Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/** 标题：这一枚叫什么。整张半层最亮的一行。 */
const INK_TITLE = ink(0.96);
/** 正文：它是怎么发生的。 */
const INK_BODY = ink(0.72);
/** 附注：说话人、地点、分类、进度 —— 读完标题顺手扫到的那些。 */
const INK_META = ink(0.5);
/** 分节名（「被这些牵出来」之类）：只用来分段，几乎沉进背景。 */
const INK_LABEL = ink(0.34);
/** 最弱的一档：数字、次要的前缀。 */
const INK_FAINT = ink(0.24);

/**
 * 半层右上角那行「在哪儿」。
 *
 * 那枚定位图标是一张灰色单色 SVG，直接摆上去会成为整张半层里唯一一块非绿的东
 * 西。所以不当图片用，当形状用 —— mask 挖出形状，底色填同一种绿。改颜色因此
 * 不用另出一版素材，和字用的是同一个色阶。
 */
function SheetPlace({ name }: { name: string }) {
  return (
    <div className="flex shrink-0 items-center gap-[3px] py-[3px]">
      <span
        aria-hidden
        className="block size-[14px] shrink-0"
        style={{
          background: INK_META,
          maskImage: "url(/figma/tilia/echo/icon-location.svg)",
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }}
      />
      <p className="text-[12px] leading-[18px]" style={{ color: INK_META }}>
        {name}
      </p>
    </div>
  );
}

/**
 * 选中回响的内容（设计稿 `3407:10727`）。
 *
 * 只读一段：这里是星图的注解，不是回响详情页 —— 完整的「我的行为 →
 * 因此发生 → 余波」在地图上点那枚标记时的 `EchoSheet` 里。
 *
 * 末尾挂上游回响的入口。星图上那几条线只说明「这枚是被更早的回响推出来
 * 的」，说不出是哪几枚（线常常伸出取景框）；这里点一下就顺着链条往回走
 * 一格，长链路是走出来的，不是一眼看完的。
 */
function EchoDetailSheet({
  story,
  pointById,
  onPickPoint,
  onMeasure,
}: {
  story: EchoFieldEntry | null;
  pointById: ReadonlyMap<string, ChainPoint>;
  onPickPoint: (id: string) => void;
  /** 半层高度随内容变（有没有上游、标题多长），取景避让要按实测的算。 */
  onMeasure: (h: number) => void;
}) {
  // 关闭时留着上一条内容，让半层往下滑走时还有东西可看。
  const [shown, setShown] = useState<EchoFieldEntry | null>(story);
  useEffect(() => {
    if (story) setShown(story);
  }, [story]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => onMeasure(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  const room = shown ? ROOM_BY_ID[shown.roomId] : null;
  const upstream = shown ? pointById.get(shown.id)?.causeIds ?? [] : [];

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${SHEET_SHELL} ${
        story ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!story}
    >
      {shown ? (
        <div className="relative flex flex-col gap-[12px] px-[20px] pb-[24px] pt-[20px]">
          <div className="flex items-start justify-between gap-[12px]">
            <h2
              className="text-[18px] font-medium leading-[normal]"
              style={{ color: INK_TITLE }}
            >
              {shown.title}
            </h2>
            {room ? <SheetPlace name={room.name} /> : null}
          </div>

          <div className="flex items-center gap-[4px]">
            <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
            <p
              className="text-[12px] font-medium leading-[1.6]"
              style={{ color: INK_META }}
            >
              {shown.speakers.map(speakerName).join("、")}
            </p>
          </div>

          <p
            className="text-[13px] font-medium leading-[22px]"
            style={{ color: INK_BODY }}
          >
            {shown.resultText}
          </p>

          <CausePills
            label="也汇进了更早的因"
            ids={upstream}
            pointById={pointById}
            onPick={onPickPoint}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 选中命运之后的半层。
 *
 * 回响那张只挂上游，因为回响是链条的末端 —— 它已经落下了，没有下文。命运
 * 两头都有：它由更早的事件、回响、命运促成，走完之后又在别处沉下了一枚回
 * 响。所以这张半层同时列「由此而来」和「它促成了」，两排都点得进去 —— 长
 * 链路是这么一格一格走出来的。
 *
 * 主线最后那枚（藏进车头）没有「它促成了」：它是最新的一枚，还没结出东西。
 * 那一栏就不出现，不写「暂无」—— 空栏位是在替世界许诺一个结果。
 */
function DestinyDetailSheet({
  destiny,
  pointById,
  onPickPoint,
  onMeasure,
}: {
  destiny: DestinyChainSeed | null;
  pointById: ReadonlyMap<string, ChainPoint>;
  onPickPoint: (id: string) => void;
  onMeasure: (h: number) => void;
}) {
  // 同 EchoDetailSheet：关掉时留着上一条，往下滑走的过程里还有内容可看。
  const [shown, setShown] = useState<DestinyChainSeed | null>(destiny);
  useEffect(() => {
    if (destiny) setShown(destiny);
  }, [destiny]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => onMeasure(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  const room = shown ? ROOM_BY_ID[shown.roomId] : null;
  const destined = shown?.kind === "destined";

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${SHEET_SHELL} ${
        destiny ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!destiny}
    >
      {shown ? (
        <div className="relative flex flex-col gap-[12px] px-[20px] pb-[24px] pt-[20px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="flex flex-col gap-[6px]">
              {/*
                潜在／注定原先是靠这行字的颜色分的（蓝 / 粉橙）。收成单色之后这个
                区别由字面本身说 —— 「潜在命运」和「注定命运」四个字已经说清了，
                颜色那一层是冗余的；图上那枚蝶形仍然按两色画，认色的地方在那儿。
              */}
              <p className="text-[11px] leading-[normal]" style={{ color: INK_META }}>
                {destined ? "注定命运" : "潜在命运"}
              </p>
              <h2
                className="text-[18px] font-medium leading-[normal]"
                style={{ color: INK_TITLE }}
              >
                {shown.title}
              </h2>
            </div>
            {room ? <SheetPlace name={room.name} /> : null}
          </div>

          <div className="flex items-center gap-[4px]">
            <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
            <p
              className="text-[12px] font-medium leading-[1.6]"
              style={{ color: INK_META }}
            >
              {shown.speakers.map(speakerName).join("、")}
            </p>
          </div>

          <p
            className="text-[13px] font-medium leading-[22px]"
            style={{ color: INK_BODY }}
          >
            {shown.outcomeText}
          </p>

          <CausePills
            label="被这些牵出来"
            ids={pointById.get(shown.id)?.causeIds ?? []}
            pointById={pointById}
            onPick={onPickPoint}
          />
          <CausePills
            label="它促成了"
            ids={shown.effectEchoIds ?? []}
            pointById={pointById}
            onPick={onPickPoint}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 半层末尾那排可点的上下游。
 *
 * 星图上的线只说明「这枚是被别的东西推出来的」，说不出是哪几枚 —— 线常常
 * 伸出取景框。这里点一下就顺着链条走一格。回响是暖橙的圆点，命运是冷色的
 * 蝶形，和图上一致：认色不认字。
 */
function CausePills({
  label,
  ids,
  pointById,
  onPick,
}: {
  label: string;
  ids: readonly string[];
  pointById: ReadonlyMap<string, ChainPoint>;
  onPick: (id: string) => void;
}) {
  const points = ids
    .map((id) => pointById.get(id))
    .filter((p): p is ChainPoint => !!p);
  if (points.length === 0) return null;

  return (
    <div className="flex flex-col gap-[6px] border-t border-[#3bff8f]/[0.12] pt-[10px]">
      <p className="text-[11px] leading-[normal]" style={{ color: INK_LABEL }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-[6px]">
        {points.map((p) => {
          const accent = p.isDestiny ? DESTINY_ACCENT : ACCENT;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className="flex items-center gap-[4px] rounded-full border py-[5px] pl-[8px] pr-[10px] transition-transform duration-200 active:scale-95"
              /*
               * 胶囊的边和底跟着字走同一种绿；只有里面那枚小标记还按类型上色
               * （回响暖橙、命运冷蓝），和图上一致 —— 它说的是「这是哪一类」，
               * 不是「这条更重要」，所以不在「主次只靠透明度」这条规矩里。
               */
              style={{
                borderColor: ink(0.22),
                background: ink(0.07),
              }}
            >
              {p.isDestiny ? (
                <Image
                  src="/figma/tilia/destiny/butterfly-potential.svg"
                  alt=""
                  width={10}
                  height={10}
                  className="size-[10px] max-w-none shrink-0"
                />
              ) : (
                <span
                  className="block size-[6px] shrink-0 rounded-full"
                  style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                />
              )}
              <span
                className="text-[12px] font-medium leading-[normal]"
                style={{ color: INK_BODY }}
              >
                {p.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 点开一件还在酝酿的事之后的半层。
 *
 * 回响那张半层讲的是「已经发生了什么」，这张讲的是「还差什么」：酝酿到
 * 了几分，以及想让它结出结果，你手上有哪两种做法 —— 去找人聊那件事，或
 * 者在「回应这一刻」里说出来。都是产品里本来就有的动作，这里只是把它们
 * 摆到具体这一件事的旁边。
 *
 * 不写成任务：只说「可以做什么」，不承诺做了就成。世界不欠人一个结果，这
 * 是这套「因缘果」成立的前提 —— 每件事都必然结果，回响就不值钱了。
 */
function LooseEventSheet({
  node,
  onMeasure,
}: {
  node: EchoFieldNode | null;
  onMeasure: (h: number) => void;
}) {
  // 同 EchoDetailSheet：关掉时留着上一条，半层往下滑走的过程里还有内容。
  const [shown, setShown] = useState<EchoFieldNode | null>(node);
  useEffect(() => {
    if (node) setShown(node);
  }, [node]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => onMeasure(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  const brewing = shown?.brewing ?? 0;
  const nudges = shown?.nudges ?? [];

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${SHEET_SHELL} ${
        node ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!node}
    >
      {shown ? (
        <div className="relative flex flex-col gap-[12px] px-[20px] pb-[24px] pt-[20px]">
          <div className="flex flex-col gap-[6px]">
            <p className="text-[11px] leading-[normal]" style={{ color: INK_LABEL }}>
              还没结出回响
            </p>
            <h2
              className="text-[18px] font-medium leading-[normal]"
              style={{ color: INK_TITLE }}
            >
              {shown.text}
            </h2>
          </div>

          {shown.speakers.length > 0 ? (
            <div className="flex items-center gap-[4px]">
              <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
              <p
                className="text-[12px] font-medium leading-[1.6]"
                style={{ color: INK_META }}
              >
                {shown.speakers.map(speakerName).join("、")}
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-[10px]">
            {/* 进度条也收进这套绿：整张半层只剩一种颜色，它是唯一的例外就太显眼 */}
            <span
              className="relative h-[3px] flex-1 overflow-hidden rounded-full"
              style={{ background: ink(0.12) }}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.round(clamp(brewing, 0, 1) * 100)}%`,
                  background: ink(0.55),
                }}
              />
            </span>
            <p
              className="shrink-0 text-[11px] leading-[normal]"
              style={{ color: INK_META }}
            >
              {brewingLabel(brewing)}
              <span style={{ color: INK_FAINT }}> · {brewingPct(brewing)}</span>
            </p>
          </div>

          {nudges.length > 0 ? (
            <div className="flex flex-col gap-[8px] border-t border-[#3bff8f]/[0.12] pt-[12px]">
              <p
                className="text-[11px] leading-[normal]"
                style={{ color: INK_LABEL }}
              >
                想让它落下来，可以
              </p>
              {nudges.map((n) => (
                <div
                  key={`${n.kind}-${n.text}`}
                  className="flex items-start gap-[8px]"
                >
                  {/*
                    胶囊高度对齐正文的行高（20px），而不是靠 margin 去凑：
                    这样它和右边第一行文字是同一个行盒，文字换行也不会跟着
                    往下掉。宽度由文字撑开，不定死。
                  */}
                  <span
                    className="inline-flex h-[20px] shrink-0 items-center rounded-full border px-[7px] text-[10px] leading-none"
                    style={{
                      borderColor: ink(0.22),
                      background: ink(0.07),
                      color: INK_META,
                    }}
                  >
                    {n.kind === "chat" ? "去聊" : "回应这一刻"}
                  </span>
                  <p
                    className="text-[13px] font-medium leading-[20px]"
                    style={{ color: INK_BODY }}
                  >
                    {n.who ? (
                      <span style={{ color: INK_META }}>{n.who} · </span>
                    ) : null}
                    {n.text}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 进度的说法。数字不给 —— 酝酿不是可量化的东西，说到「差多少」就够了。 */
function brewingLabel(v: number): string {
  if (v < 0.35) return "刚起了个头";
  if (v < 0.6) return "还在酝酿";
  if (v < 0.8) return "就差一件事";
  return "快落下来了";
}
