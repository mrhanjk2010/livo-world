"use client";

import Image from "next/image";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { WorldStreamCards } from "@/components/tilia/world-stream-cards";
import type { EchoFieldEntry } from "@/lib/tilia/echo-archive";
import type { DestinyChainSeed } from "@/lib/tilia/destiny-archive";
import {
  buildEchoField,
  FIELD_ZOOM,
  type EchoField,
  type LooseEvent,
} from "@/lib/tilia/echo-field";
import { wireCode, wireGlyph } from "@/lib/tilia/wire-code";

/**
 * 进出场是一次绕 Y 轴的翻转：世界动态卡右上那枚呼吸指示把世界页翻过去，露出
 * 背面；这一屏右上那枚按钮再翻回来。
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
 * 和回响的暖橙分开是必要的：这一片上两种东西并排站着，颜色是唯一一眼就能分出
 * 「这是已经落下的果」还是「这是一场还牵着人的命运」的线索。
 */
const DESTINY_ACCENT = "#5aa8ee";
const DESTINED_ACCENT = "#ff8874";

/**
 * 连线的调子：终端绿（磷光屏那种）。
 *
 * 和节点分色是有用的，不只是好看：这一片上有三种暖冷不同的节点（回响的暖橙、
 * 潜在命运的蓝、注定命运的粉橙），线要是跟着谁的颜色走，就会被读成「这条线属
 * 于那一头」。绿在这三者之外，于是线读作线本身 —— 关系，而不是某一枚的附属。
 */
const LINE_ACCENT = "#3bff8f";

/**
 * 背景那一档倍率。
 *
 * 星图从「可拖可捏的正文」退成背景之后，倍率就不再是人调的东西，只剩一个问
 * 题：铺多密。0.4 这一档，一屏里横竖各看得见画布的六成半 —— 密到像一块还通着
 * 电的板子，又不至于糊成一片绿雾。四边都溢出屏外，所以慢漂过去也不会露边。
 */
const BG_SCALE = 0.4;

/**
 * 线宽/字号的反向补偿：线画在画布坐标里，缩到 0.4 的话 0.8px 的线只剩三分之
 * 一个屏幕像素。补偿之后屏幕上的分量和原尺度一致。
 */
const LINE_WEIGHT = Math.min(3, 1 / BG_SCALE);

/**
 * 静息线的不透明度。
 *
 * 和原来（0.28）差不多，没跟着「退成背景」一起压暗 —— 挡住它的是三张卡自己的
 * 底色和那层模糊，那已经够了。线要是再压一档，从卡与卡之间的缝里就什么都看不
 * 见，背景等于没有。
 */
const REST_LINE = 0.26;

/** 星图整体的放大倍数，和布局共用一个数（那边管格距和小卡）。 */
const ZOOM = FIELD_ZOOM;

/**
 * 光点的大小。
 *
 * 静息态里所有东西都是光点 —— 回响、命运、事件、时机，只差颜色和这几个数。
 * 回响和命运比事件/时机大一圈：它们是「结出来的东西」，事件是汇进去的料。
 */
const ECHO_DOT = Math.round(13 * ZOOM);
const DESTINY_DOT = Math.round(12 * ZOOM);
/** 这两个要乘节点自己的景深倍率 `node.scale`，所以不预乘 ZOOM。 */
const NODE_DOT = 9;
const MOMENT_DOT = 7;

type Point = { x: number; y: number };

/** 一条汇聚线：事件/时机 → 回响/命运，或前一枚 → 后一枚。 */
type FlowEdge = {
  id: string;
  from: Point;
  to: Point;
};

/**
 * 全屏「世界背面」。
 *
 * 从世界动态卡右上那枚呼吸指示翻进来。动态页答的是「世界发生了什么」，这里答
 * 的是「它背地里在怎么算」。
 *
 * 这一屏原先是一张可拖、可缩、点得动的星图：点一枚回响就拉出它的上游，底下升
 * 起一张半层讲它由什么汇聚而成。那套东西是「查」——你带着问题来，一枚枚点开。
 * 现在换成「看」：星图退到背后当底噪，只剩光点、代码连线和线上跑的游标；正面
 * 交给三张流水卡（见 `WorldStreamCards`），世界在算什么、涌出了哪些命运、哪几
 * 条因果正咬在一起，自己滚给你看。
 *
 * 所以这一屏不再有缩放、不再有点选，也不再有「新事件飞进来」那一下 —— 背景不
 * 该有需要你去够的东西。星图仍然是活的，只是它的活法从「等你点」变成了「一直
 * 在那儿转」：连线上的游标一趟趟跑过去，整片图很慢地漂，慢到你不会注意它在
 * 动，只会觉得它没停。
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
   * 会让这一层变成 backdrop root —— 卡片那圈 `backdrop-blur` 采样的范围跟着
   * 变，静止态的观感就和翻转前不一样了。
   */
  const [settled, setSettled] = useState(false);
  /** 开了「减少动态效果」就不翻，退回原来那记淡入。 */
  const [flip, setFlip] = useState(true);

  const field = useMemo(
    () => buildEchoField(stories, loose, destinies),
    [stories, loose, destinies],
  );

  /**
   * 图上每一条因果都连着。
   *
   * 这张网本身就是要说的话：世界里的事早就互相牵着。三种边一起进 —— 事件/时机
   * 汇进它的回响或命运、回响咬着更早的回响、命运结出后来的回响。
   */
  const edges = useMemo((): readonly FlowEdge[] => {
    const at = new Map<string, Point>();
    for (const o of field.orbs) at.set(o.story.id, { x: o.x, y: o.y });
    for (const d of field.destinies) at.set(d.seed.id, { x: d.x, y: d.y });

    const out: FlowEdge[] = [];
    for (const n of field.nodes) {
      if (!n.ownerId) continue;
      const to = at.get(n.ownerId);
      if (to) out.push({ id: `rest-${n.id}`, from: { x: n.x, y: n.y }, to });
    }

    // 同一段因果可能被两头各写一次（A 报了它的因，B 报了它的果），去重。
    const seen = new Set<string>();
    const link = (fromId: string, toId: string) => {
      const from = at.get(fromId);
      const to = at.get(toId);
      const id = `rest-${fromId}-${toId}`;
      if (!from || !to || seen.has(id)) return;
      seen.add(id);
      out.push({ id, from, to });
    };
    for (const o of field.orbs) {
      for (const c of o.story.causeEchoIds ?? []) link(c, o.story.id);
    }
    for (const d of field.destinies) {
      for (const c of d.seed.causeIds ?? []) link(c, d.seed.id);
      for (const e of d.seed.effectEchoIds ?? []) link(d.seed.id, e);
    }
    return out;
  }, [field]);

  /*
   * 取景不再是人能动的东西，只剩一个问题：从哪儿看。横向居中，竖向把有内容的
   * 那一段（`contentTop` 到画布底）摆在正中 —— 画布顶上那截 `TOP_PAD` 是空的，
   * 照画布中心对齐会先怼进来一片空白。
   */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: 375, h: 812 });
  const pan = useMemo(
    () => ({
      x: (viewport.w - field.width * BG_SCALE) / 2,
      y: viewport.h / 2 - ((field.contentTop + field.height) / 2) * BG_SCALE,
    }),
    [viewport.w, viewport.h, field.width, field.height, field.contentTop],
  );

  // 手机框的高度是 min(100dvh, 812)，不是定值。
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

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[66]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="世界背面"
        /*
         * overflow-clip 而不是 -hidden：hidden 会造出一个可被程序滚动的容器，
         * 而画布远超出这一屏 —— 浏览器一旦要「把聚焦元素滚进视野」，整层连黑
         * 纱一起被推走，底下的地图就从边上露出来了。clip 不是滚动容器。
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
          背景那一层：整片不接手势 —— 星图这会儿是底噪，没有一处需要你去够。
        */}
        <div
          ref={viewportRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-clip"
        >
          {/*
            压在活地图上的两层：黑 94% 承担压暗（模糊也挂在它上面），上面那层深
            蓝只剩 18% —— 底几乎是纯黑，蓝只用来去掉纯黑那股死气。

            比设计稿更黑是有理由的：那张稿子上没有这么多线。绿线在深蓝底上要靠
            提亮才看得见，而底一黑，同样的绿就自己浮起来了。
          */}
          <div className="absolute inset-0 bg-black/[0.94] backdrop-blur-[10px]" />
          <div className="absolute inset-0 bg-[#080b1a]/[0.18]" />

          {/*
            慢漂。九十多秒走一个来回，一秒挪不到半个像素 —— 盯着看不出它在动，
            移开视线再回来才发现图不在原处了。这是这一层唯一的「呼吸」：星图既
            然退成背景，就不该有任何一处在抢眼睛，但也不能真的定住 —— 定住的背
            景是一张图，动着的才是一个还在转的世界。

            漂挂在外层、缩放挂在里层：两个 transform 各归各的，不然动画会把定位
            覆盖掉。
          */}
          <div className="absolute inset-0 motion-safe:animate-[livo-field-drift_96s_ease-in-out_infinite_alternate]">
            <div
              className="absolute left-0 top-0"
              style={{
                width: field.width,
                height: field.height,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${BG_SCALE})`,
                transformOrigin: "0 0",
              }}
            >
              <RestLines edges={edges} field={field} weight={LINE_WEIGHT} />
              {/* 线上一趟趟跑过去的游标：这一层唯一在动的东西 */}
              <RestGlints edges={edges} weight={LINE_WEIGHT} />
              <FieldDots field={field} />
            </div>
          </div>
        </div>

        {/* 顶部压一层黑：状态栏和标题底下总会横着几条线，不压暗就糊在一起 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[104px] bg-gradient-to-b from-black/70 via-black/35 to-transparent" />

        <StatusBar />

        {/*
          标题也收进这一屏的绿：背面这一层从线到字是同一种东西（世界正在算的那
          些），白字会读成「界面盖在上面」，绿字读成「界面也是这一层的一部分」。
        */}
        <div className="pointer-events-none absolute left-[20px] top-[62px] flex flex-col gap-[2px]">
          <p
            className="text-[15px] font-medium leading-[normal]"
            style={{ color: INK_TITLE, textShadow: FIELD_TEXT_GLOW }}
          >
            世界背面
          </p>
          <p className="text-[11px] leading-[normal]" style={{ color: INK_META }}>
            三条流水一直在跑 · 点开任一条看整屏
          </p>
        </div>

        {/*
          关闭用叉，不用来时那枚翻转图标：图标的意思是「翻到另一面」，可这一层
          已经是另一面了，同一枚图标摆在这儿读起来像还能再翻一次。回去的动作还
          是翻的（`flipTransition`），只是按钮不再替它做说明。
        */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-[16px] top-[62px] flex size-[29px] items-center justify-center rounded-full bg-black/30 backdrop-blur-[23px] transition-transform duration-200 active:scale-90"
        >
          <Image
            src="/figma/tilia/feed/icon-close.svg"
            alt=""
            width={29}
            height={29}
            className="size-full"
          />
        </button>

        {/* 正文：三张流水卡，从标题那一行以下一直铺到底 */}
        <WorldStreamCards />
      </section>
    </div>,
    overlayRoot,
  );
}

/* ─────────────────────────── 字的调子 ─────────────────────────── */

/**
 * 这一屏的字统一是绿的，主次只靠透明度分。
 *
 * 用 hex + alpha 而不是给容器套 `opacity`：套在容器上会连着背景和边框一起淡，
 * 而这里要淡的只有字。
 */
function ink(alpha: number): string {
  return `${LINE_ACCENT}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

const INK_TITLE = ink(0.96);
const INK_META = ink(0.5);

/**
 * 星图上那些字外面的一点光。
 *
 * 线已经是发着光的代码了（`WIRE_GLOW`），字要是干干净净地印在上面，两者就不像
 * 长在同一层。给字也垫一点同色的晕，整屏才是一块荧光屏。
 */
const FIELD_TEXT_GLOW = `0 0 6px ${LINE_ACCENT}55`;

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
 */
const WIRE_GLOW = 0.7;

/**
 * 那张网：图上每一条因果都连着 —— 只不过线不是画出来的，是写出来的。
 *
 * 每条线上串的是一段代码：多数是 0/1 和运算符，偶尔嵌一个 `echo.brew`、`+0.03`
 * 这样看得懂的词（词表见 `wire-code.ts`，和上面那张运转日志同一门语言）。远看
 * 是一条淡绿的虚线，凑近才发现它一直是字。
 *
 * 这么写不是为了炫技：这一屏讲的是世界的背面，而背面的意思就是「这些关系是被
 * 算出来的」。一根笔画只能说「它们连着」，一串代码还能说「它们正被算着」。
 *
 * 渐变照旧：因那头几乎透明、果那头满色。所以顺着字往哪头变亮，就读得出这段因
 * 果朝哪儿走。
 *
 * 这张网一帧都不重画（满图一百多条，一次重排上万个字形）—— 字是静态的，运转感
 * 交给 `RestGlints`。
 */
function RestLines({
  edges,
  field,
  weight,
}: {
  edges: readonly FlowEdge[];
  field: EchoField;
  /** 字号的反向补偿：缩小时按倍率放大，屏幕上的分量才不变。 */
  weight: number;
}) {
  const font = wireFont(weight);
  if (edges.length === 0) return null;

  return (
    <svg
      className="absolute left-0 top-0"
      width={field.width}
      height={field.height}
      viewBox={`0 0 ${field.width} ${field.height}`}
      opacity={REST_LINE}
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
 * memo 不是锦上添花：一条线上百来个字形，一百多条一起重排是几十毫秒。几何和字
 * 号不变就不重排。
 */
const CodeWire = memo(function CodeWire({
  id,
  from,
  to,
  font,
  fill,
}: {
  id: string;
  from: Point;
  to: Point;
  /** 画布坐标下的字号。 */
  font: number;
  /** 纯色或 `url(#gradient)`。 */
  fill: string;
}) {
  const tracking = font * WIRE_TRACKING;
  const chars = Math.max(
    2,
    Math.round(linkLength(from, to) / (font * WIRE_ADVANCE + tracking)),
  );
  /* 种子取几何：位置一样的线每次算出同一串字，重挂也不会换一副面孔。 */
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

/** 字号按倍率补偿，再量化到半档 —— 量化过的字号不会因为一点点抖动就重排。 */
function wireFont(weight: number): number {
  return WIRE_FONT * (Math.round(weight * 2) / 2);
}

/**
 * 同时在路上的光点数。够让屏幕里随时有三四处在动，又不至于变成一场灯光秀 ——
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
/** 光点自身的亮度。 */
const GLINT_OPACITY = 0.5;

/**
 * 那张网上跑的微光：每次挑十几条线，各放一个字，顺着「因 → 果」的方向淌过去，
 * 到头就熄，歇一会儿再换一条。
 *
 * 线本身既然是代码（见 `CodeWire`），跑在上面的就不该还是一颗光点 —— 那是两套
 * 语言。所以跑的也是字：比线上的字亮一档、大一点，一边走一边换字，像一个正在
 * 执行的游标扫过这段代码。
 *
 * 为什么不是让虚线自己漂 —— 那才是这个需求的第一直觉。实测过：动
 * `stroke-dashoffset` 会让整张网每帧重新光栅化一次，满图一百来条描边虚线，帧
 * 间隔从 16ms 掉到 150ms（七帧）。一个「氛围」级别的效果不配吃掉整屏的流畅度。
 *
 * 光点这条路只动 transform 和 opacity，浏览器能纯粹在合成器上做，那张网一帧都
 * 不用重画。换来的是「不是每条线同时都在流」，而是轮着被点亮 —— 恰好也更像世界
 * 该有的样子：不是所有因果都在同一刻起作用。
 *
 * 轨迹用 `sampleLink` 现算，和线本身同一条折线、连磨圆的拐角都算进去，取样按弧
 * 长等分，所以三段长短差得再多，跑起来也是匀速。
 */
function RestGlints({
  edges,
  weight,
}: {
  edges: readonly FlowEdge[];
  /** 同 `RestLines`：光点大小按倍率反向补偿。 */
  weight: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
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
      className="pointer-events-none absolute left-0 top-0"
      style={{ opacity: GLINT_OPACITY }}
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

/* ─────────────────────── 连线的几何 ─────────────────────── */

/**
 * 拐角的圆角半径（画布 px）。给得比较大 —— 小圆角在这个尺度上看不出来，折线就
 * 成了硬转角，那是流程图的味道，不是这一屏要的。实际用多少还会被两侧线段的长
 * 度掐住（见 `linkPath`）：短段上拐大弯会把线拐到段外面去。
 */
const LINK_RADIUS = Math.round(16 * ZOOM);
/** 圆角摊成几段折线来算长度和取样（给光点用，见 `sampleLink`）。 */
const CORNER_STEPS = 6;

/**
 * 一条连线怎么走：正交两折，中途换一次方向。
 *
 * 折线加圆角读起来是「布线」：世界背面是接线的地方，不是画画的地方。
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
    const r = Math.min(LINK_RADIUS, dist(prev, cur) / 2, dist(cur, next) / 2);
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
    const t = Math.min(1, Math.max(0, (want - acc[seg - 1]) / segLen));
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

/* ─────────────────────────── 光点 ─────────────────────────── */

/**
 * 满图的光点：回响、命运、事件、时机各一色。
 *
 * 从前这些点是能挑亮的 —— 挑中一枚，它就现出头像、光球或蝶形。现在不再挑，于
 * 是它们只剩最简的那一档：一枚实心圆加两层 box-shadow（外面那层散得开，是
 * 「亮」；里面那层紧贴着圆，是「实」）。颜色仍然分四种，因为「这是果、那是命
 * 运、那些是汇进去的料」这件事，就算不点也该看得出来。
 *
 * 没用 SVG 也没用滤镜 —— 满图一百多枚，两样都要按倍率补偿，而 box-shadow 只在
 * 铺一次的时候画，之后一帧都不重算。整块 memo：这一层从挂上去到关掉都不会变。
 */
const FieldDots = memo(function FieldDots({ field }: { field: EchoField }) {
  return (
    <>
      {field.orbs.map((o) => (
        <Dot key={o.story.id} x={o.x} y={o.y} core={ECHO_DOT} color={ACCENT} />
      ))}
      {field.destinies.map((d) => (
        <Dot
          key={d.seed.id}
          x={d.x}
          y={d.y}
          core={DESTINY_DOT}
          color={d.seed.kind === "destined" ? DESTINED_ACCENT : DESTINY_ACCENT}
        />
      ))}
      {field.nodes.map((n) => (
        <Dot
          key={n.id}
          x={n.x}
          y={n.y}
          core={(n.kind === "moment" ? MOMENT_DOT : NODE_DOT) * n.scale}
          color={LINE_ACCENT}
          /* 已经汇进某枚回响的压暗一档：它们是料，不是结果。 */
          dim={n.ownerId ? 0.55 : 1}
        />
      ))}
    </>
  );
});

function Dot({
  x,
  y,
  core,
  color,
  dim = 1,
}: {
  x: number;
  y: number;
  core: number;
  color: string;
  dim?: number;
}) {
  return (
    <span
      aria-hidden
      className="absolute block rounded-full"
      style={{
        left: x,
        top: y,
        width: core,
        height: core,
        marginLeft: -core / 2,
        marginTop: -core / 2,
        background: color,
        boxShadow: `0 0 ${core * 1.8}px ${color}80, 0 0 ${core * 0.7}px ${color}cc`,
        opacity: dim,
      }}
    />
  );
}
