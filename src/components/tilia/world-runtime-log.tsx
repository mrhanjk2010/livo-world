"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import {
  RUNTIME_INTERVAL_MS,
  RUNTIME_LOG,
  RUNTIME_SLOW_INTERVAL_MS,
  RUNTIME_TICK_START,
  RUNTIME_WINDOW,
} from "@/lib/tilia/world-runtime";

/** 一行的高度，和字号的 leading 对齐。 */
const LINE_H = 18;
/** 星图那些线用的同一支绿。 */
const GREEN = "#3bff8f";
/** 上顶一格的时长，跟着 `RUNTIME_INTERVAL_MS` 走（约它的一半）。 */
const SLIDE_MS = 175;
/** 展开态的进出场。 */
const ANIM_MS = 240;
/**
 * 游标的起点。
 *
 * 得比「一屏放得下的行数」大 —— 首屏是从 `cursor` 往回数 window 行填出来的，起
 * 点太小就会数到负数去（世界在你打开之前就已经在算了，负数那头没有内容）。一屏
 * 最多四十几行（812 / 18），64 留够余量。
 */
const CURSOR_START = 64;

/**
 * 世界运转日志卡 —— 「世界背面」底部那张卡，点开是全屏。
 *
 * 卡形照世界动态那张（340 宽、16 圆角、20 模糊），但底子换成近乎纯黑、字换成
 * 绿色等宽：那张卡是世界讲给你听的话，这张是世界自己在算的账，两种东西不该长
 * 得一样。内容见 `world-runtime.ts`。
 *
 * 滚法：留一行余量、只露 `window` 行，每来一行整叠上顶一格（`livo-log-scroll`）。
 * 动画靠 `key` 换值重挂来触发 —— 两百多毫秒一行，用状态去回弹 transform 反而
 * 容易丢帧。
 *
 * 卡上的字不接手势也不进读屏：一秒四行的流水念出来只是噪音，从字上按下去照样
 * 能拖星图。可点的只有整张卡这一个动作 —— 点开全屏，同一条流水占满一屏。
 */
export function WorldRuntimeLog({
  /** 底部半层升起来时让位：那时候人在读具体的一枚。 */
  hidden,
}: {
  hidden: boolean;
}) {
  const { cursor, motion } = useRuntimeStream();
  const [expanded, setExpanded] = useState(false);
  /* 让位或已经展开时连命中区一起收掉，别在半层上方留一块看不见的可点区域。 */
  const off = hidden || expanded;

  return (
    <>
      <div
        className={`pointer-events-none absolute bottom-[26px] left-1/2 z-[8] w-[340px] -translate-x-1/2 transition-opacity duration-300 ${
          off ? "opacity-0" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="世界运转日志：展开看整屏"
          className={`block w-full rounded-[16px] border border-[#3bff8f]/[0.12] bg-black/[0.86] px-[16px] pb-[11px] pt-[10px] text-left backdrop-blur-[20px] transition-transform duration-200 active:scale-[0.99] ${
            off ? "pointer-events-none" : "pointer-events-auto"
          }`}
        >
          <div className="mb-[6px] flex items-center justify-between font-mono text-[9px] leading-none text-[#3bff8f]/40">
            <span>$ world.tail -f · 世界一直在算</span>
            <span className="text-[#3bff8f]/55">[展开]</span>
          </div>

          <LogStream
            window={RUNTIME_WINDOW}
            cursor={cursor}
            motion={motion}
            size={11}
          />
        </button>
      </div>

      <WorldRuntimeSheet
        open={expanded}
        cursor={cursor}
        motion={motion}
        onClose={() => setExpanded(false)}
      />
    </>
  );
}

/* ─────────────────────────── 全屏展开 ─────────────────────────── */

/**
 * 全屏的世界运转日志。
 *
 * 展开只做一件事：把窗口开大。同一条流水、同一个游标（`cursor` 从卡片传进
 * 来），所以点开的那一瞬不会跳号 —— 是同一份账摊开来看，不是另一屏。
 *
 * 不能往回翻：这是 `tail -f`，只有正在发生的那几十行。要看世界记下来的事，
 * 那是「世界动态」的活儿。
 */
function WorldRuntimeSheet({
  open,
  cursor,
  motion,
  onClose,
}: {
  open: boolean;
  cursor: number;
  motion: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  /** 一屏放得下几行 —— 手机框高是 min(100dvh, 812)，按实测算。 */
  const [rows, setRows] = useState(RUNTIME_WINDOW * 2);
  const boxRef = useRef<HTMLDivElement | null>(null);

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
    setVisible(false);
    const t = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () =>
      setRows(Math.max(8, Math.floor(el.clientHeight / LINE_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[70]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="世界运转日志"
        className={`absolute inset-0 flex flex-col bg-black/[0.96] transition-opacity duration-[240ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <StatusBar />

        <header className="flex shrink-0 items-start justify-between px-[16px] pb-[14px] pt-[9.5px]">
          <div className="flex flex-col gap-[3px]">
            <h1 className="font-mono text-[15px] leading-none text-[#3bff8f]">
              world.tail -f
            </h1>
            <p className="font-mono text-[10px] leading-none text-[#3bff8f]/45">
              世界一直在算 · 这里只有正在发生的那几十行
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex size-[29px] shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-[23px] transition-transform duration-200 active:scale-90"
          >
            <Image
              src="/figma/tilia/feed/icon-close.svg"
              alt=""
              width={29}
              height={29}
              className="size-full"
            />
          </button>
        </header>

        {/* 流水占满剩下的一屏；行数由这块的实测高度决定。 */}
        <div ref={boxRef} className="min-h-0 flex-1 px-[16px] pb-[18px]">
          <LogStream window={rows} cursor={cursor} motion={motion} size={12} />
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/* ─────────────────────────── 流水本体 ─────────────────────────── */

/** 一秒四行往上顶的那叠字。露 `window` 行，多留一行让它从上沿被裁掉。 */
function LogStream({
  window: win,
  cursor,
  motion,
  size,
}: {
  window: number;
  cursor: number;
  motion: boolean;
  /** 字号：卡片上 11，展开后 12。 */
  size: number;
}) {
  const keep = win + 1;
  const rows = Array.from({ length: keep }, (_, k) =>
    rowAt(cursor - (keep - 1) + k),
  );

  return (
    <div aria-hidden className="overflow-clip" style={{ height: win * LINE_H }}>
      <div
        key={cursor}
        style={
          {
            "--log-line": `${LINE_H}px`,
            animation: motion
              ? `livo-log-scroll ${SLIDE_MS}ms linear forwards`
              : undefined,
            transform: motion ? undefined : `translateY(-${LINE_H}px)`,
          } as CSSProperties
        }
      >
        {rows.map((row, i) => (
          <p
            key={row.key}
            /* 越旧越淡：滚上去的那几行自己就退场了。 */
            style={{
              height: LINE_H,
              fontSize: size,
              opacity: 0.3 + (i / (keep - 1)) * 0.7,
            }}
            className="overflow-hidden whitespace-nowrap font-mono leading-[18px]"
          >
            <span style={{ color: `${GREEN}70` }}>{row.tick}</span>{" "}
            <span style={{ color: `${GREEN}b0` }}>{row.op}</span>{" "}
            <span style={{ color: GREEN }}>· {row.note}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** 游标只走一份：卡片和展开态共用，点开时不跳号。 */
function useRuntimeStream(): { cursor: number; motion: boolean } {
  const [cursor, setCursor] = useState(CURSOR_START);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    setMotion(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setCursor((n) => n + 1),
      motion ? RUNTIME_INTERVAL_MS : RUNTIME_SLOW_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, [motion]);

  return { cursor, motion };
}

/**
 * 第 i 行：内容循环取，tick 一直往上走。
 *
 * 步长不是定值（3 或 8，看 `i % 5` 那一项怎么落）—— 匀速自增看着像个计数器，
 * 忽快忽慢才像「这一拍世界干的事多一点」。减而不是加，是为了保证单调：加上去
 * 的话每五行会回落一次，日志里的计数往回走就成了 bug。
 */
function rowAt(i: number): {
  key: number;
  tick: number;
  op: string;
  note: string;
} {
  /* 取模要先兜正：JS 里 -3 % 10 是 -3，负下标取出来是 undefined。 */
  const len = RUNTIME_LOG.length;
  const line = RUNTIME_LOG[((i % len) + len) % len];
  return {
    key: i,
    tick: RUNTIME_TICK_START + i * 4 - (i % 5),
    op: line.op,
    note: line.note,
  };
}
