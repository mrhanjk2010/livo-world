"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CAUSE_INTERVAL_MS,
  CAUSE_LOG,
  CAUSE_SLOW_INTERVAL_MS,
  type CauseState,
} from "@/lib/tilia/world-cause-log";
import {
  DESTINY_CLOCK_START,
  DESTINY_INTERVAL_MS,
  DESTINY_LOG,
  DESTINY_SLOW_INTERVAL_MS,
  type DestinyState,
} from "@/lib/tilia/world-destiny-log";
import {
  RUNTIME_INTERVAL_MS,
  RUNTIME_LOG,
  RUNTIME_SLOW_INTERVAL_MS,
  RUNTIME_TICK_START,
} from "@/lib/tilia/world-runtime";

/** 一行的高度，和字号的 leading 对齐。 */
const LINE_H = 18;

/** 三种流水各自的调子：算是绿的，命运是冷的，因果是暖的。 */
const GREEN = "#3bff8f";
const BLUE = "#5aa8ee";
const PINK = "#ff8874";
const AMBER = "#ffa16b";
/** 散掉的命运、断掉的链：退成没有温度的灰蓝。 */
const GONE = "#7f8ba0";

/**
 * 游标的起点。
 *
 * 得比「一张卡放得下的行数」大 —— 首屏是从 `cursor` 往回数填出来的，起点太小
 * 会数到负数去（世界在你打开之前就已经在算了，负数那头没有内容）。
 */
const CURSOR_START = 64;

type StreamId = "calc" | "destiny" | "cause";

/**
 * 「世界背面」上那三张流水卡。
 *
 * 这一屏原来是一张可拖可点的星图加底下一张日志卡。现在反过来：星图退到背后当
 * 底噪，正面交给三张卡，从上往下是同一件事的三层 ——
 *
 *   世界一直在算      每一拍都在跑的账，快到只读得清一两个词
 *   命运一直在涌现    算出来的东西一枚枚落地，你不在场也照样落
 *   因果链一直在推演  落下的这些又互相咬成链，谁牵出了谁
 *
 * 三张等高，因为它们是并列的三层，不是一主二次。各自能收起来 —— 收起的只剩一
 * 行表头，剩下展开的那些把空间平分：想细看某一层，就把另外两层收掉，那一层自
 * 己就长到接近整屏。所以「展开到全屏」不必再单做一套，它是收起的副产物。
 *
 * 三张卡的滚动快慢是不一样的（275ms / 1.5s / 2s），这不是随手调的：算的那层是
 * 机器节拍，命运是一件件落下来的，链要顺着读完才知道在说什么。快慢本身就在说
 * 它们各自是什么东西。
 */
export function WorldStreamCards() {
  const [open, setOpen] = useState<Record<StreamId, boolean>>({
    calc: true,
    destiny: true,
    cause: true,
  });
  const toggle = (id: StreamId) =>
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="absolute bottom-[20px] left-1/2 top-[104px] z-[8] flex w-[340px] -translate-x-1/2 flex-col gap-[10px]">
      <StreamCard
        cmd="world.tail -f"
        title="世界一直在算"
        accent={GREEN}
        open={open.calc}
        onToggle={() => toggle("calc")}
        interval={RUNTIME_INTERVAL_MS}
        slowInterval={RUNTIME_SLOW_INTERVAL_MS}
        renderRow={(i) => <CalcRow i={i} />}
      />
      <StreamCard
        cmd="destiny.watch"
        title="命运一直在涌现"
        accent={BLUE}
        open={open.destiny}
        onToggle={() => toggle("destiny")}
        interval={DESTINY_INTERVAL_MS}
        slowInterval={DESTINY_SLOW_INTERVAL_MS}
        renderRow={(i) => <DestinyRow i={i} />}
      />
      <StreamCard
        cmd="cause.trace"
        title="因果链一直在推演"
        accent={AMBER}
        open={open.cause}
        onToggle={() => toggle("cause")}
        interval={CAUSE_INTERVAL_MS}
        slowInterval={CAUSE_SLOW_INTERVAL_MS}
        renderRow={(i) => <CauseRow i={i} />}
      />
    </div>
  );
}

/* ─────────────────────────── 卡壳 ─────────────────────────── */

/**
 * 一张流水卡。
 *
 * 卡形沿用世界动态那张（16 圆角、背景模糊），底子换成近乎纯黑、字换成等宽 ——
 * 那张是世界讲给你听的话，这三张是世界自己在算的账。
 *
 * 底只有六成黑，剩下的交给那层 20px 模糊：星图就在后面，得透出来才叫「背景在
 * 转」。模糊是关键的一环 —— 它把后面那些代码线揉成一片绿雾，于是卡上 11px 的字
 * 仍然读得清，而底下确实有东西在动。填满黑当然更好读，代价是这一屏只剩三张浮
 * 在虚空里的卡，星图白转了。
 *
 * 展开的卡 `flex-1`，收起的只留表头 —— 剩下的空间由展开的那几张平分，这是「三
 * 张等高」和「各自可收」同一条规则的两个面。
 *
 * 行数不写死，按实测高度算：手机框高是 min(100dvh, 812)，收起一张之后别的卡也
 * 会长高，两处都得跟着变。
 */
function StreamCard({
  cmd,
  title,
  accent,
  open,
  onToggle,
  interval,
  slowInterval,
  renderRow,
}: {
  /** 表头左边那截命令行的样子。 */
  cmd: string;
  title: string;
  accent: string;
  open: boolean;
  onToggle: () => void;
  interval: number;
  slowInterval: number;
  renderRow: (i: number) => ReactNode;
}) {
  const { cursor, motion } = useStreamCursor(interval, slowInterval);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(6);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () =>
      setRows(Math.max(2, Math.floor(el.clientHeight / LINE_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  return (
    <section
      className={`flex min-h-0 flex-col overflow-clip rounded-[16px] border px-[14px] pb-[10px] pt-[9px] backdrop-blur-[20px] ${
        open ? "flex-1" : "shrink-0"
      }`}
      style={{
        borderColor: `${accent}24`,
        background: "rgba(0, 0, 0, 0.6)",
      }}
      aria-label={title}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex shrink-0 items-center justify-between gap-[8px] font-mono text-[9px] leading-none transition-opacity duration-200 hover:opacity-80 active:opacity-60"
      >
        <span className="truncate" style={{ color: `${accent}66` }}>
          $ {cmd} · {title}
        </span>
        <span className="shrink-0" style={{ color: `${accent}99` }}>
          {open ? "[收起]" : "[展开]"}
        </span>
      </button>

      {open ? (
        <div ref={boxRef} className="mt-[6px] min-h-0 flex-1">
          <Stream
            rows={rows}
            cursor={cursor}
            motion={motion}
            /* 顶一格的时长跟着节奏走，但不超过一记轻推：慢的那两张要是滑
               上一秒，读起来就成了在飘，而不是又落下一行。 */
            slide={Math.min(220, Math.round(interval * 0.5))}
            renderRow={renderRow}
          />
        </div>
      ) : null}
    </section>
  );
}

/* ─────────────────────────── 流水本体 ─────────────────────────── */

/**
 * 往上顶的那叠字。露 `rows` 行，多留一行让它从上沿被裁掉。
 *
 * 动画靠 `key` 换值重挂来触发 —— 用状态去回弹 transform 反而容易丢帧。
 *
 * 整块不进读屏：一秒好几行的流水念出来只是噪音。
 */
function Stream({
  rows,
  cursor,
  motion,
  slide,
  renderRow,
}: {
  rows: number;
  cursor: number;
  motion: boolean;
  slide: number;
  renderRow: (i: number) => ReactNode;
}) {
  const keep = rows + 1;
  const list = Array.from({ length: keep }, (_, k) => cursor - (keep - 1) + k);

  return (
    <div aria-hidden className="overflow-clip" style={{ height: rows * LINE_H }}>
      <div
        key={cursor}
        style={
          {
            "--log-line": `${LINE_H}px`,
            animation: motion
              ? `livo-log-scroll ${slide}ms linear forwards`
              : undefined,
            transform: motion ? undefined : `translateY(-${LINE_H}px)`,
          } as CSSProperties
        }
      >
        {list.map((i, k) => (
          <div
            key={i}
            /* 越旧越淡：顶上去的那几行自己就退场了。 */
            style={{ height: LINE_H, opacity: 0.3 + (k / (keep - 1)) * 0.7 }}
            className="flex items-center gap-[5px] overflow-hidden whitespace-nowrap font-mono text-[11px] leading-[18px]"
          >
            {renderRow(i)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 游标：每张卡各走各的一份。 */
function useStreamCursor(
  interval: number,
  slowInterval: number,
): { cursor: number; motion: boolean } {
  const [cursor, setCursor] = useState(CURSOR_START);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    setMotion(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setCursor((n) => n + 1),
      motion ? interval : slowInterval,
    );
    return () => clearInterval(t);
  }, [motion, interval, slowInterval]);

  return { cursor, motion };
}

/** 内容循环取。取模先兜正：JS 里 -3 % 10 是 -3，负下标取出来是 undefined。 */
function pick<T>(pool: readonly T[], i: number): T {
  return pool[((i % pool.length) + pool.length) % pool.length];
}

/* ─────────────────────────── 三种行 ─────────────────────────── */

/**
 * 世界一直在算：tick + op + 说人话的那半句。
 *
 * 步长不是定值（3 或 8，看 `i % 5` 那一项怎么落）—— 匀速自增看着像个计数器，
 * 忽快忽慢才像「这一拍世界干的事多一点」。减而不是加，是为了保证单调。
 */
function CalcRow({ i }: { i: number }) {
  const line = pick(RUNTIME_LOG, i);
  const tick = RUNTIME_TICK_START + i * 4 - (i % 5);

  return (
    <>
      <span style={{ color: `${GREEN}70` }}>{tick}</span>
      <span style={{ color: `${GREEN}b0` }}>{line.op}</span>
      <span className="truncate" style={{ color: GREEN }}>
        · {line.note}
      </span>
    </>
  );
}

/** 四种动静各自的写法。 */
const DESTINY_TAG: Record<DestinyState, string> = {
  spawn: "起",
  brew: "酝",
  lock: "定",
  fade: "散",
};

/**
 * 命运一直在涌现：时刻 + 动静 + 车厢 + 短名 + 说人话。
 *
 * 冷暖跟着命运本身走（潜在的蓝、注定的粉橙，和地图上那两种标记同一套色），散
 * 掉的退成灰 —— 一眼扫过去，这张卡在说「这些正在长、那几件已经没下文了」。
 *
 * 时刻每行往前挪两三分钟，走的是和上面那张 tick 一样的把戏：单调、但不匀速。
 */
function DestinyRow({ i }: { i: number }) {
  const line = pick(DESTINY_LOG, i);
  const tone =
    line.state === "fade" ? GONE : line.kind === "destined" ? PINK : BLUE;
  const at = DESTINY_CLOCK_START + i * 3 - (i % 4);

  return (
    <>
      <span style={{ color: `${GONE}80` }}>{hhmm(at)}</span>
      <span
        className="shrink-0 rounded-[3px] px-[3px] py-[1px] text-[9px] leading-none"
        style={{ color: tone, background: `${tone}1f` }}
      >
        {DESTINY_TAG[line.state]}
        {line.at === undefined ? "" : ` ${Math.round(line.at * 100)}%`}
      </span>
      <span className="shrink-0" style={{ color: `${tone}80` }}>
        {line.room}
      </span>
      {/* 短名不许压：一行里先读得出「这是哪一枚命运」，说人话那半句截了无妨 */}
      <span className="shrink-0" style={{ color: tone }}>
        {line.title}
      </span>
      <span className="truncate" style={{ color: `${GONE}c0` }}>
        · {line.note}
      </span>
    </>
  );
}

const CAUSE_TAG: Record<CauseState, { label: string; tone: string }> = {
  done: { label: "成立", tone: GREEN },
  solve: { label: "推演", tone: AMBER },
  hold: { label: "差一件", tone: `${AMBER}99` },
  drop: { label: "断了", tone: GONE },
};

/**
 * 因果链一直在推演：一条链从因走到果，末一节是果。
 *
 * 箭头用星图上那支绿 —— 图里的线和这里的箭头是同一件事，只是一个画出来、一个
 * 写出来。前面的因压暗、末一节提亮：一行字里也要看得出方向。
 */
function CauseRow({ i }: { i: number }) {
  const line = pick(CAUSE_LOG, i);
  const tag = CAUSE_TAG[line.state];
  const last = line.chain.length - 1;

  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-[4px] truncate">
        {line.chain.map((term, k) => (
          <span key={`${term}-${k}`} className="flex items-center gap-[4px]">
            {k > 0 ? <span style={{ color: `${GREEN}80` }}>▸</span> : null}
            <span
              style={{
                color: k === last ? AMBER : `${AMBER}80`,
              }}
            >
              {term}
            </span>
          </span>
        ))}
      </span>
      <span className="shrink-0" style={{ color: tag.tone }}>
        {tag.label}
      </span>
      <span className="shrink-0 tabular-nums" style={{ color: `${GONE}99` }}>
        {line.score.toFixed(2)}
      </span>
    </>
  );
}

/** 当天的分钟数写成 06:18；跨过一天就绕回来。 */
function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
