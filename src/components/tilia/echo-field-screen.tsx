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
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { ECHO_ORB_CORE, EchoOrb } from "@/components/tilia/echo-orb";
import { SpeakerStack, speakerName } from "@/components/tilia/tilia-avatar";
import type { EchoFieldEntry } from "@/lib/tilia/echo-archive";
import {
  buildEchoField,
  ECHO_ORB_RADIUS,
  estimateNodeWidth,
  type EchoField,
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
const ACCENT = "#ffa16b";

/** 半层高度的兜底值（设计稿：文案区 181 + 底部留白 16）。实测到就用实测的
 *  —— 挂了上游回响的那几条会高一截，取景避让得跟着走。 */
const SHEET_H = 197;
/** 散件那张半层要列「可以做什么」，天生更高一点。 */
const LOOSE_SHEET_H = 220;
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
/** 光球的命中区。视觉核心 44，光晕铺到 82 —— 人是照着光晕点的。 */
const ORB_HIT = 64;

type Pan = { x: number; y: number };
type Point = { x: number; y: number };

/** 一条汇聚线：事件/时机 → 回响，或更早的回响 → 后来的回响。 */
type FlowEdge = {
  id: string;
  from: Point;
  to: Point;
  /** 0–1，代际越远越淡。 */
  strength: number;
};

/**
 * 全屏世界回响星图 —— 设计稿 `3406:9892`（默认）/ `3407:10459`（选中）。
 *
 * 从动态卡右上那枚呼吸指示进来。动态页答的是「世界发生了什么」，这里答的
 * 是「那些事怎么长成了一条回响」：满图散着历史上所有回响，以及汇聚进它们
 * 的事件与时机 —— 还有一批谁都没接上的散件，世界发生的事本来就多于结出果
 * 的事。
 *
 * 一屏装不下，也不该缩着装：画布比取景框大得多，四个方向都能拖（见
 * `buildEchoField`，画布尺寸跟着内容量长）。把内容压进一屏才是失真 ——
 * 小卡是文字撑开的，缩放只会让它们和弧线一起变形。
 *
 * 进来先落在最近那枚回响上：满图弱化时「有关系」这件事只是隐约的，得先
 * 亮一簇给人看清「一条回响是由什么汇聚成的」，其余的自然就懂了。点空白
 * 处或再点它一次就取消选中，整片回到弱化态 —— 那才是通览的样子。
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
  onClose,
}: {
  open: boolean;
  /** 历史回响，时间正序 —— 越靠后越新，画布上也就越靠下。 */
  stories: readonly EchoFieldEntry[];
  /** 还没汇聚成回响的事件。 */
  loose?: readonly LooseEvent[];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 点开的散件事件。和选中回响互斥 —— 底下只有一张半层。 */
  const [pickedId, setPickedId] = useState<string | null>(null);

  const field = useMemo(() => buildEchoField(stories, loose), [stories, loose]);

  const orbById = useMemo(
    () => new Map(field.orbs.map((o) => [o.story.id, o])),
    [field.orbs],
  );
  const storyById = useMemo(
    () => new Map(field.orbs.map((o) => [o.story.id, o.story])),
    [field.orbs],
  );

  const selected = selectedId ? orbById.get(selectedId) ?? null : null;
  const selectedNodes = useMemo(
    () => (selectedId ? field.nodes.filter((n) => n.echoId === selectedId) : []),
    [field.nodes, selectedId],
  );
  const picked = useMemo(
    () => (pickedId ? field.nodes.find((n) => n.id === pickedId) ?? null : null),
    [field.nodes, pickedId],
  );

  const pickEcho = useCallback((id: string | null) => {
    setPickedId(null);
    setSelectedId(id);
  }, []);

  /** 选中那枚往回追出来的上游链条：每枚回响的代际 + 每一段连线。 */
  const chain = useMemo(
    () => buildChain(selectedId, orbById),
    [selectedId, orbById],
  );

  /** 事件/时机汇进选中那枚，加上链条上一段段的回响→回响。 */
  const flowEdges = useMemo((): readonly FlowEdge[] => {
    if (!selected) return [];
    return [
      ...selectedNodes.map((n) => ({
        id: n.id,
        from: n,
        to: selected,
        strength: 1,
      })),
      ...chain.edges,
    ];
  }, [selected, selectedNodes, chain.edges]);

  // 默认选中的那枚：stories 是时间正序，最后一枚就是最近结出的那条回响。
  const latest = useMemo(
    () => field.orbs[field.orbs.length - 1] ?? null,
    [field.orbs],
  );
  const latestNodes = useMemo(
    () =>
      latest
        ? field.nodes.filter((n) => n.echoId === latest.story.id)
        : [],
    [field.nodes, latest],
  );

  /* ── 取景：一个可拖的窗口，外加选中时的自动取景 ── */

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: 375, h: 812 });
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [animatePan, setAnimatePan] = useState(true);
  const [hinted, setHinted] = useState(false);
  /**
   * 半层实测高度：挂了上游的那几条更高，避让线得跟着抬。两张半层各测各
   * 的（都常驻在 DOM 里，关着的那张也在测），取景只看当前露出来的那张。
   */
  const [echoSheetH, setEchoSheetH] = useState(SHEET_H);
  const [looseSheetH, setLooseSheetH] = useState(LOOSE_SHEET_H);
  const sheetH = pickedId ? looseSheetH : echoSheetH;

  const clampPan = useCallback(
    (p: Pan): Pan => ({
      x: clamp(p.x, Math.min(0, viewport.w - field.width), 0),
      y: clamp(p.y, Math.min(0, viewport.h - field.height), 0),
    }),
    [viewport.w, viewport.h, field.width, field.height],
  );

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
   * 开场：选中最近那枚回响，取景直接落在它那一簇上（不做动画 —— 一进来
   * 就镜头飞一段像在演，而且人还没看清就被移走了）。它两侧、上下都还留
   * 着别的簇，「图比这一屏大」这件事照样说得出来。
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
    setSelectedId(latest?.story.id ?? null);
    setPan(
      clampPan(
        latest
          ? panForOpen(latest, latestNodes, viewport, sheetH)
          : {
              x: (viewport.w - field.width) / 2,
              y: (viewport.h - field.contentHeight) / 2,
            },
      ),
    );
  }, [
    open,
    clampPan,
    latest,
    latestNodes,
    viewport,
    sheetH,
    field.width,
    field.contentHeight,
  ]);

  useEffect(() => {
    if (!selected) return;
    setAnimatePan(true);
    setPan((prev) =>
      clampPan(panForCluster(selected, selectedNodes, viewport, prev, sheetH)),
    );
  }, [selected, selectedNodes, viewport, sheetH, clampPan]);

  // 散件同理：点开的那张卡也不能被自己的半层压住。
  useEffect(() => {
    if (!picked) return;
    setAnimatePan(true);
    setPan((prev) => clampPan(panForNode(picked, viewport, prev, sheetH)));
  }, [picked, viewport, sheetH, clampPan]);

  const dragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    from: Pan;
    moved: boolean;
  } | null>(null);
  /** 抬手后还留着，供紧随其后的 click 判断这次到底是点还是拖。 */
  const movedRef = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragRef.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      from: pan,
      moved: false,
    };
    movedRef.current = false;
    setAnimatePan(false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_SLOP) {
      d.moved = true;
      movedRef.current = true;
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
    setPan(clampPan({ x: d.from.x + dx, y: d.from.y + dy }));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /**
   * 拖完手之后浏览器还会补一发 click。在捕获阶段掐掉它，光球和空白处的
   * 点击处理就不必各自判断「这次到底是点还是拖」了 —— 键盘敲 Enter 触发
   * 的 click 前面没有拖动，照样能过。
   */
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!movedRef.current) return;
    movedRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    setAnimatePan(false);
    setHinted(true);
    setPan((prev) => clampPan({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
  };

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

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[66]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="世界回响"
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
          /*
            不透明度收得比翻转快得多：侧到七八十度那几帧本来就只剩一线，
            让它先亮起来，省掉「一张薄片飞进来」的廉价感。
          */
          transition: flip
            ? `transform ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${Math.round(ANIM_MS * 0.4)}ms ease-out`
            : "opacity 280ms ease-out",
        }}
      >
        {/*
          可拖的取景框。手势挂在这一层而不是各个光球上：从光球上按下去也
          应该能拖，抬手时再靠位移判断这次是拖还是点（见 movedRef）。
        */}
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          onWheel={onWheel}
          className="absolute inset-0 cursor-grab touch-none overflow-clip active:cursor-grabbing"
        >
          {/*
            设计稿把地图压到 20% 再盖一层深蓝纱，算下来地图只剩 8% 左右。
            这里是压在活地图上，所以用等效的两层：黑 87% 承担压暗（模糊也
            挂在它上面），深蓝 40% 给整片定调。空白处点一下取消选中。
          */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="取消选中"
            onClick={() => {
              setSelectedId(null);
              setPickedId(null);
            }}
            className="absolute inset-0 cursor-[inherit] bg-black/[0.87] backdrop-blur-[10px]"
          />
          <div className="pointer-events-none absolute inset-0 bg-[#0c1135]/40" />

          {/*
            星图整片平移：拖动跟手（不过渡），选中避让走缓动。宽高来自
            布局本身，不跟着容器缩放 —— 小卡是文字撑开的，缩放会变形。
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
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            }}
          >
            <FlowLines edges={flowEdges} field={field} />

            {field.nodes.map((node) => {
              const brewable = node.echoId === null && node.brewing !== undefined;
              return (
                <FieldNode
                  key={node.id}
                  node={node}
                  /* 散件的 echoId 是 null，别让它和「谁都没选」撞上 */
                  lit={selectedId !== null && node.echoId === selectedId}
                  picked={node.id === pickedId}
                  /*
                   * 有东西被选中时，别的散件退到和链外回响同一档：这一屏此
                   * 刻讲的是那一条链，其余「还能推」的事先别抢注意力。
                   */
                  aside={brewable && (selectedId !== null || pickedId !== null)}
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

            {field.orbs.map((orb) => {
              const depth = chain.depth.get(orb.story.id);
              return (
                <FieldOrb
                  key={orb.story.id}
                  orb={orb}
                  selected={orb.story.id === selectedId}
                  opacity={
                    depth !== undefined
                      ? CHAIN_ORB[depth] ?? DIM_ORB_ASIDE
                      : selectedId
                        ? DIM_ORB_ASIDE
                        : DIM_ORB
                  }
                  onSelect={() =>
                    pickEcho(orb.story.id === selectedId ? null : orb.story.id)
                  }
                />
              );
            })}
          </div>
        </div>

        {/*
          顶部压一层黑：星图能拖到任意位置，总会有小卡正好停在状态栏和
          关闭按钮底下，不压暗的话两层字会糊在一起。
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[104px] bg-gradient-to-b from-black/70 via-black/35 to-transparent" />

        <StatusBar />

        {/*
          两件事都看不出来：画布比屏幕大得多，以及默认亮着的这一簇是可以
          放下的。拖过一次就不再提 —— 那时候人已经在自己看了。
        */}
        <div
          className={`pointer-events-none absolute left-[20px] top-[62px] flex flex-col gap-[2px] transition-opacity duration-500 ${
            hinted ? "opacity-0" : "opacity-100"
          }`}
        >
          <p className="text-[15px] font-medium leading-[normal] text-white/90">
            世界回响
          </p>
          <p className="text-[11px] leading-[normal] text-white/40">
            {selectedId || pickedId
              ? "拖动查看 · 点空白处放下这一枚"
              : "拖动查看 · 点一枚看它由什么汇聚而成"}
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
          story={selected?.story ?? null}
          storyById={storyById}
          onPickStory={pickEcho}
          onMeasure={setEchoSheetH}
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
 * 从选中那枚往回追上游回响，逐层展开到 `MAX_CHAIN_DEPTH`。
 *
 * 返回每枚回响的代际（选中的是 0）和每一段连线。同一枚可能被两条支线同
 * 时指到（会客厅那枚就是），代际按先到的那层算 —— 取最近的一条路径，它
 * 是「离当前这个果最近的因」，画得亮一点是对的。
 *
 * `depth` 里记过就不再展开，顺手也就防住了环。
 */
function buildChain(
  selectedId: string | null,
  orbById: ReadonlyMap<string, EchoFieldOrb>,
): { depth: ReadonlyMap<string, number>; edges: readonly FlowEdge[] } {
  const depth = new Map<string, number>();
  const edges: FlowEdge[] = [];
  if (!selectedId || !orbById.has(selectedId)) return { depth, edges };

  depth.set(selectedId, 0);
  let frontier = [selectedId];

  for (let d = 1; d <= MAX_CHAIN_DEPTH && frontier.length > 0; d += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const to = orbById.get(id);
      if (!to) continue;
      for (const causeId of to.story.causeEchoIds ?? []) {
        const from = orbById.get(causeId);
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
  orb: EchoFieldOrb,
  nodes: readonly EchoFieldNode[],
  viewport: { w: number; h: number },
  current: Pan,
  sheetH: number,
): Pan {
  let box: Box = {
    left: orb.x - ECHO_ORB_RADIUS,
    right: orb.x + ECHO_ORB_RADIUS,
    top: orb.y - ECHO_ORB_RADIUS,
    bottom: orb.y + ECHO_ORB_RADIUS,
  };
  for (const n of nodes) box = union(box, nodeBox(n));
  return panForBox(box, viewport, current, sheetH);
}

/** 点开一枚散件事件时，只需要让那一张小卡自己露在半层之上。 */
function panForNode(
  node: EchoFieldNode,
  viewport: { w: number; h: number },
  current: Pan,
  sheetH: number,
): Pan {
  return panForBox(nodeBox(node), viewport, current, sheetH);
}

type Box = { left: number; right: number; top: number; bottom: number };

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

/**
 * 开场取景：把默认选中那枚光球摆到可读区正中，再交给 `panForCluster` 兜
 * 一遍边界。
 *
 * 和后续点选不一样 —— 那时候要尽量不动镜头（人正看着某处），这里还没有
 * 「正看着某处」可言，居中最省解释。
 */
function panForOpen(
  orb: EchoFieldOrb,
  nodes: readonly EchoFieldNode[],
  viewport: { w: number; h: number },
  sheetH: number,
): Pan {
  const midY = (SAFE_TOP + viewport.h - sheetH - SHEET_GAP) / 2;
  return panForCluster(
    orb,
    nodes,
    viewport,
    { x: viewport.w / 2 - orb.x, y: midY - orb.y },
    sheetH,
  );
}

/* ─────────────────────────── 连线 ─────────────────────────── */

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
}: {
  edges: readonly FlowEdge[];
  field: EchoField;
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
          <feGaussianBlur stdDeviation="3.6" />
        </filter>
        {/* 亮流的两头要化掉，不然又成了一段一段的虚线 */}
        <filter
          id="echo-line-comet"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="1.9" />
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
            <stop stopColor={ACCENT} stopOpacity="0" />
            <stop offset="0.55" stopColor={ACCENT} stopOpacity="0.55" />
            <stop offset="1" stopColor={ACCENT} />
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
              strokeWidth={4.5}
              strokeLinecap="round"
              opacity={0.3}
              filter="url(#echo-line-bloom)"
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={0.9}
              strokeLinecap="round"
              opacity={0.75}
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={2.6}
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
  onSelect,
}: {
  orb: EchoFieldOrb;
  selected: boolean;
  /** 由代际算好：选中最亮，上游依次淡，链外最暗。 */
  opacity: number;
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
        width: ORB_HIT,
        height: ORB_HIT,
        opacity,
        transform: `translate(-50%, -50%) scale(${selected ? 1.08 : 1})`,
      }}
    >
      {/* 命中区比球大一圈，球本身仍按设计稿的 44 居中放 */}
      <span
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
        style={{ width: ECHO_ORB_CORE, height: ECHO_ORB_CORE }}
      >
        {/* 只有选中那颗在喘：上游也喘的话，就分不出谁是当下这个果了 */}
        <EchoOrb breathe={selected} />
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
  onSelect,
}: {
  node: EchoFieldNode;
  lit: boolean;
  picked: boolean;
  /** 场上已经有选中的东西，而这张不是它 —— 散件跟着退一档。 */
  aside: boolean;
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

      {isMoment ? (
        <p
          className="whitespace-nowrap font-medium text-white/70"
          style={{ fontSize: 11 * s }}
        >
          {node.text}
        </p>
      ) : (
        <span className="flex shrink-0 flex-col" style={{ gap: 2 * s }}>
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
  storyById,
  onPickStory,
  onMeasure,
}: {
  story: EchoFieldEntry | null;
  storyById: ReadonlyMap<string, EchoFieldEntry>;
  onPickStory: (id: string) => void;
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
  const upstream = (shown?.causeEchoIds ?? [])
    .map((id) => storyById.get(id))
    .filter((s): s is EchoFieldEntry => !!s);

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => e.stopPropagation()}
      className={`absolute bottom-0 left-0 w-full overflow-hidden rounded-t-[16px] bg-black/20 pb-[16px] backdrop-blur-[10px] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        story ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!story}
    >
      <div className="absolute inset-0 bg-[#0c1135]/50" />

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

          {upstream.length > 0 ? (
            <div className="flex flex-col gap-[6px] border-t border-white/10 pt-[10px]">
              <p className="text-[11px] leading-[normal] text-white/35">
                也汇进了更早的回响
              </p>
              <div className="flex flex-wrap gap-[6px]">
                {upstream.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onPickStory(u.id)}
                    className="flex items-center gap-[4px] rounded-full border border-[#ffa16b]/25 bg-[#ffa16b]/[0.08] py-[5px] pl-[8px] pr-[10px] transition-transform duration-200 active:scale-95"
                  >
                    <span
                      className="block size-[6px] shrink-0 rounded-full"
                      style={{
                        background: ACCENT,
                        boxShadow: `0 0 6px ${ACCENT}`,
                      }}
                    />
                    <span className="text-[12px] font-medium leading-[normal] text-white/80">
                      {u.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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
      className={`absolute bottom-0 left-0 w-full overflow-hidden rounded-t-[16px] bg-black/20 pb-[16px] backdrop-blur-[10px] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        node ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!node}
    >
      <div className="absolute inset-0 bg-[#0c1135]/50" />

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
