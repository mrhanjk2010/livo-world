"use client";

import Image from "next/image";
import {
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
const DIM_NODE = 0.15;
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
 */
const REST_LINE = 0.16;
const REST_LINE_ASIDE = 0.07;

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
 * 缩放区间。
 *
 * 下界不是定值，是「整张图恰好装进这一屏」算出来的（`fitScale`）—— 缩得比
 * 全局更小没有意义，只会在四周添黑边。
 *
 * 上界从 1.3 收到 0.8：放到原尺寸那一档时一屏只剩三四枚，拖起来找不着自己在哪
 * 一片 —— 这张图的看头是「谁牵着谁」，凑得太近就只剩一枚孤零零的卡。0.8 这一
 * 档字还读得清（远高于 `LABEL_SCALE`），一屏又能多装四分之一。
 *
 * `READ_SCALE` 跟着等于上界：双击在「全局 ↔ 读得清」两档之间切，而「读得清」
 * 现在就是能放到的最大。两个值必须一致 —— 双击那边靠「当前倍率是不是已经到
 * READ_SCALE」判方向，要是 READ_SCALE 高于上界，放到顶之后再双击只会原地不
 * 动，回不到全局。
 */
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

/** 全局视图的留白：左右各留一点，顶部让开关闭按钮那一行。 */
const FIT_PAD_X = 14;
const FIT_PAD_Y = 28;

/** 星图整体的放大倍数，和布局共用一个数（那边管格距和小卡）。 */
const ZOOM = FIELD_ZOOM;

/** 光球的命中区。视觉核心 44、光晕铺到 82，人是照着光晕点的。 */
const ORB_HIT = Math.round(64 * ZOOM);

/**
 * 命运那枚标记的视觉尺寸：蝶形核心 + 底下那枚标题胶囊。
 *
 * 核心取和回响光球一样的 44（同样乘 ZOOM）：这一屏叫「世界背面」，命运和回响
 * 是并列的两种东西，谁小一号就成了谁的注脚。
 */
const DESTINY_CORE = Math.round(44 * ZOOM);
const DESTINY_WING = Math.round(30 * ZOOM);
const DESTINY_PILL_H = Math.round(22 * ZOOM);

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

  const field = useMemo(
    () => buildEchoField(stories, loose, destinies),
    [stories, loose, destinies],
  );

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
        seen.add(id);
        out.push({ id, from, to: p, strength: 1 });
      }
    }
    return out;
  }, [field.nodes, pointById]);

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
  const [scale, setScale] = useState(READ_SCALE);
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
   * 整张图恰好装进这一屏的倍率 —— 也就是「全局」，同时是缩放的下界。
   *
   * 按 `contentHeight` 算，不按 `height`：底下那段 `BOTTOM_RESERVE` 是留给
   * 「选中后把簇抬到半层之上」的行程，是空的，把它也算进取景只会让内容白白
   * 缩小一圈。
   */
  const fitScale = useMemo(
    () =>
      clamp(
        Math.min(
          (viewport.w - FIT_PAD_X * 2) / field.width,
          (viewport.h - SAFE_TOP - FIT_PAD_Y) / field.contentHeight,
        ),
        0.1,
        READ_SCALE,
      ),
    [viewport.w, viewport.h, field.width, field.contentHeight],
  );

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
   * 全局视图的取景：内容摆在「关闭按钮那行之下」这块可读区的正中。
   *
   * 竖向按 `contentHeight` 居中，不按画布总高 —— 底下那段留白算进来的话，内容
   * 会整体上移，第一行正好钻到状态栏底下。
   */
  const fitPan = useCallback(
    (s: number): Pan =>
      clampPanAt(
        {
          x: (viewport.w - field.width * s) / 2,
          y:
            SAFE_TOP +
            (viewport.h - SAFE_TOP - field.contentHeight * s) / 2,
        },
        s,
      ),
    [clampPanAt, viewport.w, viewport.h, field.width, field.contentHeight],
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
   * 开场：全局。整张图缩到装得下，摆在正中，什么都不选，不做动画。
   *
   * 先给全貌是有取舍的 —— 这个尺度上字是读不了的（`labels` 会把它们收掉）。
   * 但这一屏第一句要说的话是「这么多事互相牵着」，那是只有全貌才说得出来
   * 的；具体哪一件，双击或双指撑开再看。
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
    setScale(fitScale);
    setPan(fitPan(fitScale));
  }, [open, fitScale, fitPan]);

  // 屏幕尺寸变了（转屏、窗口拉动）全局那一档也跟着变，别让倍率掉到界外。
  useEffect(() => {
    setScale((s) => clamp(s, fitScale, MAX_SCALE));
  }, [fitScale]);

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
      const next = clamp(target, fitScale, MAX_SCALE);
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
    [fitScale, clampPanAt],
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
        fitScale,
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
      zoomTo(scaleRef.current < READ_SCALE - 0.02 ? READ_SCALE : fitScale, p);
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
            <RestLines
              edges={restEdges}
              field={field}
              aside={selectedId !== null || pickedId !== null}
              weight={lineWeight}
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
                opacity={glowOf(orb.story.id)}
                hit={hitScale}
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
                opacity={glowOf(d.seed.id)}
                labels={labels}
                hit={hitScale}
                onSelect={() =>
                  pickPoint(d.seed.id === selectedId ? null : d.seed.id)
                }
              />
            ))}
          </div>
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
          <p className="text-[15px] font-medium leading-[normal] text-white/90">
            世界背面
          </p>
          <p className="text-[11px] leading-[normal] text-white/40">
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

        {/*
          底部那张运转日志：星图给的是结果的形状，它给的是「还在算」。选中一枚
          时它让位 —— 半层从底部升起来，那时候人读的是具体的一枚。
        */}
        <WorldRuntimeLog hidden={selectedId !== null || pickedId !== null} />

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
 * 静息态的那张网：图上每一条因果都连着，一根很淡的细线，没有光晕也不流动。
 *
 * 刻意画得比什么都轻 —— 它的作用是让人看出「这些事本来就互相牵着」，而不是
 * 让人去读某一条。一旦有东西被选中，它再退一档（`aside`），把注意力让给被挑
 * 亮的那条链。
 *
 * 和 `FlowLines` 分成两个组件，是因为两者的目的不同、代价也不同：那边一条线
 * 三层描边加一道流光，用在七十多条上会拖垮这一屏；这边一条就是一笔，全画完也
 * 不过七十多个 path。同理这里不给每条线做渐变 —— 静息态不需要读方向，方向是
 * 选中之后才要交代的事。
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
  /** 线宽的反向补偿：缩小时按倍率加粗，屏幕上的分量才不变（见 `lineWeight`）。 */
  weight: number;
}) {
  if (edges.length === 0) return null;

  return (
    <svg
      className="absolute left-0 top-0 transition-opacity duration-500 ease-out"
      width={field.width}
      height={field.height}
      viewBox={`0 0 ${field.width} ${field.height}`}
      opacity={aside ? REST_LINE_ASIDE : REST_LINE}
      aria-hidden
    >
      <g
        fill="none"
        stroke={LINE_ACCENT}
        strokeWidth={0.8 * weight}
        strokeLinecap="round"
      >
        {edges.map((e) => (
          <path key={e.id} d={arcPath(e.from, e.to)} />
        ))}
      </g>
    </svg>
  );
}

/**
 * 汇聚线。两种上游共用一套画法 —— 事件/时机 → 回响，以及更早的回响 →
 * 后来的回响。它们在世界里是一回事（都是「因」），画成两种反而是在教术语。
 *
 * 调子取自壁上星图那种「刻进石头的光」：一根连续的细线，底下垫一层散开
 * 的柔光，线上有一道被磨圆了的亮流往回响那头淌。不用点线 —— 虚线会把
 * 「关系」画成一条示意箭头，太具体，也和这一屏其他东西的质感不搭。
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
        const d = arcPath(e.from, e.to);
        const stroke = `url(#echo-flow-${e.id})`;
        return (
          <g key={e.id} opacity={e.strength}>
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={4.5 * weight}
              strokeLinecap="round"
              opacity={0.3}
              filter="url(#echo-line-bloom)"
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={0.9 * weight}
              strokeLinecap="round"
              opacity={0.75}
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
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 从节点弯到光球的二次贝塞尔。控制点往「远离两点连线」的一侧推，鼓的
 * 方向按节点在光球的哪边定 —— 左边的往左沉、右边的往右沉，几条线于是
 * 收成一束而不是撞在一起。
 */
function arcPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const side = from.x <= to.x ? 1 : -1;
  const bow = 0.16 * len;
  const cx = (from.x + to.x) / 2 + (-dy / len) * bow * side;
  const cy = (from.y + to.y) / 2 + (dx / len) * bow * side;
  return `M ${from.x} ${from.y} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x} ${to.y}`;
}

/* ─────────────────────────── 光球 / 节点 ─────────────────────────── */

function FieldOrb({
  orb,
  selected,
  opacity,
  hit,
  onSelect,
}: {
  orb: EchoFieldOrb;
  selected: boolean;
  /** 由代际算好：选中最亮，上游依次淡，链外最暗。 */
  opacity: number;
  /** 命中区的反向补偿倍数（缩小时放大，视觉不变）。 */
  hit: number;
  onSelect: () => void;
}) {
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
        opacity,
        transform: `translate(-50%, -50%) scale(${selected ? 1.08 : 1})`,
      }}
    >
      {/*
        命中区比球大一圈，球本身仍按设计稿的 44 画，再整体缩放到 ZOOM ——
        `EchoOrb` 内部那些光晕偏移都是写死的 px（地图标记也用同一份），放在
        缩放盒子里等比放大，比给它加一路 size 参数干净。
      */}
      <span
        className="absolute left-1/2 top-1/2 block"
        style={{
          width: ECHO_ORB_CORE,
          height: ECHO_ORB_CORE,
          transform: `translate(-50%, -50%) scale(${ZOOM})`,
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
  opacity,
  labels,
  hit,
  onSelect,
}: {
  destiny: EchoFieldDestiny;
  selected: boolean;
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

      {/* 冷光垫在最底下，选中时铺开一倍 —— 命运是「牵着的」，不是在喘 */}
      <span
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height,opacity] duration-500 ease-out"
        style={{
          width: selected ? DESTINY_CORE * 2.4 : DESTINY_CORE * 1.5,
          height: selected ? DESTINY_CORE * 2.4 : DESTINY_CORE * 1.5,
          background: `radial-gradient(circle, ${accent}59 0%, ${accent}00 70%)`,
          opacity: selected ? 1 : 0.7,
        }}
      />

      <span
        className="absolute inset-0 flex items-center justify-center rounded-full border transition-colors duration-500"
        style={{
          borderColor: `${accent}${selected ? "99" : "4d"}`,
          background: `${accent}${selected ? "26" : "14"}`,
          boxShadow: selected ? `0 0 14px ${accent}66` : undefined,
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
        回响光球，而这一屏两者是并列的。选中那枚才回到接近地图的浓度。
      */}
      <span
        className={`absolute left-1/2 flex w-max -translate-x-1/2 items-center gap-[5px] rounded-full border py-[4px] pl-[6px] pr-[10px] transition-[color,background,border-color,opacity] duration-500 ${
          labels ? "" : "pointer-events-none"
        }`}
        style={{
          top: DESTINY_CORE + 7,
          borderColor: `${accent}${selected ? "80" : "33"}`,
          background: selected
            ? `linear-gradient(90deg, ${accent}cc, ${accent}80)`
            : `${accent}1f`,
          opacity: labels ? 1 : 0,
        }}
      >
        <SpeakerStack speakers={seed.speakers} size={17} overlap={6} />
        <span className="whitespace-nowrap text-[13px] font-medium leading-none text-white/90">
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
  onSelect,
}: {
  node: EchoFieldNode;
  lit: boolean;
  picked: boolean;
  /** 场上已经有选中的东西，而这张不是它 —— 散件跟着退一档。 */
  aside: boolean;
  /** 缩到全局那一档时字读不出来，只留头像/光点（见 `LABEL_SCALE`）。 */
  labels: boolean;
  /** 只有还在酝酿的散件事件给，给了就整张卡可点。 */
  onSelect?: () => void;
}) {
  const s = node.scale;
  const isMoment = node.kind === "moment";
  const anchor = (isMoment ? 12 : 16) * s;
  const active = lit || picked;

  const layout = {
    // text-left 不能省：可点的那些卡是 <button>，浏览器给按钮的
    // text-align:center 会把短的那行（参与者名字）顶到中间去。
    className: `absolute flex w-max items-center text-left transition-opacity duration-500 ease-out${
      onSelect ? " pointer-events-auto cursor-[inherit]" : ""
    }`,
    style: {
      left: node.x - anchor,
      top: node.y,
      transform: "translateY(-50%)",
      gap: (isMoment ? 2 : 6) * s,
      opacity: active
        ? 1
        : node.brewing === undefined
          ? DIM_NODE
          : aside
            ? DIM_ORB_ASIDE
            : LOOSE_NODE,
    },
  };

  const body = (
    <>
      {isMoment ? (
        <span
          className="relative block shrink-0"
          style={{ width: 24 * s, height: 24 * s }}
        >
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
            className="absolute max-w-none"
            style={{
              width: 50 * s,
              height: 50 * s,
              left: -13 * s,
              top: -13 * s,
            }}
          />
        </span>
      ) : (
        <span
          className="shrink-0"
          style={{
            filter: active ? `drop-shadow(0 0 ${5 * s}px ${ACCENT})` : undefined,
          }}
        >
          <SpeakerStack
            speakers={node.speakers}
            size={32 * s}
            overlap={8 * s}
          />
        </span>
      )}

      {/*
        字。缩到全局那一档就整块淡掉 —— 那个尺度上 11px 只剩两三个像素，
        画出来是灰糊，不如把这一片留给光点和线（`labels`）。淡出而不是直接
        不渲染：捏合是连续的，突然多出一片字会顿一下。
      */}
      {isMoment ? (
        <p
          className="whitespace-nowrap font-medium text-white/70 transition-opacity duration-300"
          style={{ fontSize: 11 * s, opacity: labels ? 1 : 0 }}
        >
          {node.text}
        </p>
      ) : (
        <span
          className="flex shrink-0 flex-col transition-opacity duration-300"
          style={{ gap: 2 * s, opacity: labels ? 1 : 0 }}
        >
          <span
            className="flex items-baseline whitespace-nowrap"
            style={{ gap: 5 * s }}
          >
            <p
              className="font-medium text-white/35"
              style={{ fontSize: 10 * s }}
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
                className={`font-medium tabular-nums ${
                  picked ? "text-white/45" : "text-white/25"
                }`}
                style={{ fontSize: 9 * s }}
              >
                {brewingPct(node.brewing)}
              </p>
            ) : null}
          </span>
          <p
            className="whitespace-nowrap font-medium text-white/70"
            style={{ fontSize: 11 * s }}
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
  "absolute bottom-0 left-0 w-full overflow-hidden rounded-t-[16px] border-t border-white/[0.08] bg-[#070912]/[0.74] pb-[16px] backdrop-blur-[10px] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

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
            <h2 className="text-[18px] font-medium leading-[normal] text-white">
              {shown.title}
            </h2>
            {room ? (
              <div className="flex shrink-0 items-center gap-[2px] py-[3px]">
                <Image
                  src="/figma/tilia/echo/icon-location.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-[16px]"
                />
                <p className="text-[12px] leading-[18px] text-white/60">
                  {room.name}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-[4px]">
            <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
            <p className="text-[12px] font-medium leading-[1.6] text-white/70 opacity-80">
              {shown.speakers.map(speakerName).join("、")}
            </p>
          </div>

          <p className="text-[13px] font-medium leading-[22px] text-white/70">
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
  const accent = destined ? DESTINED_ACCENT : DESTINY_ACCENT;

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
              <p
                className="text-[11px] leading-[normal]"
                style={{ color: `${accent}d9` }}
              >
                {destined ? "注定命运" : "潜在命运"}
              </p>
              <h2 className="text-[18px] font-medium leading-[normal] text-white">
                {shown.title}
              </h2>
            </div>
            {room ? (
              <div className="flex shrink-0 items-center gap-[2px] py-[3px]">
                <Image
                  src="/figma/tilia/echo/icon-location.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="size-[16px]"
                />
                <p className="text-[12px] leading-[18px] text-white/60">
                  {room.name}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-[4px]">
            <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
            <p className="text-[12px] font-medium leading-[1.6] text-white/70 opacity-80">
              {shown.speakers.map(speakerName).join("、")}
            </p>
          </div>

          <p className="text-[13px] font-medium leading-[22px] text-white/70">
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
    <div className="flex flex-col gap-[6px] border-t border-white/10 pt-[10px]">
      <p className="text-[11px] leading-[normal] text-white/35">{label}</p>
      <div className="flex flex-wrap gap-[6px]">
        {points.map((p) => {
          const accent = p.isDestiny ? DESTINY_ACCENT : ACCENT;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className="flex items-center gap-[4px] rounded-full border py-[5px] pl-[8px] pr-[10px] transition-transform duration-200 active:scale-95"
              style={{
                borderColor: `${accent}40`,
                background: `${accent}14`,
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
              <span className="text-[12px] font-medium leading-[normal] text-white/80">
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
            <p className="text-[11px] leading-[normal] text-white/35">
              还没结出回响
            </p>
            <h2 className="text-[18px] font-medium leading-[normal] text-white">
              {shown.text}
            </h2>
          </div>

          {shown.speakers.length > 0 ? (
            <div className="flex items-center gap-[4px]">
              <SpeakerStack speakers={shown.speakers} size={16} overlap={6} />
              <p className="text-[12px] font-medium leading-[1.6] text-white/70 opacity-80">
                {shown.speakers.map(speakerName).join("、")}
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-[10px]">
            <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.14]">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.round(clamp(brewing, 0, 1) * 100)}%`,
                  background: ACCENT,
                  opacity: 0.7,
                }}
              />
            </span>
            <p className="shrink-0 text-[11px] leading-[normal] text-white/45">
              {brewingLabel(brewing)}
              <span className="text-white/25"> · {brewingPct(brewing)}</span>
            </p>
          </div>

          {nudges.length > 0 ? (
            <div className="flex flex-col gap-[8px] border-t border-white/10 pt-[12px]">
              <p className="text-[11px] leading-[normal] text-white/35">
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
                  <span className="inline-flex h-[20px] shrink-0 items-center rounded-full border border-white/15 bg-white/[0.06] px-[7px] text-[10px] leading-none text-white/55">
                    {n.kind === "chat" ? "去聊" : "回应这一刻"}
                  </span>
                  <p className="text-[13px] font-medium leading-[20px] text-white/75">
                    {n.who ? (
                      <span className="text-white/40">{n.who} · </span>
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
