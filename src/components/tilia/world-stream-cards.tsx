"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { CAUSE_LOG, type CauseState } from "@/lib/tilia/world-cause-log";
import {
  DESTINY_CLOCK_START,
  DESTINY_LOG,
  type DestinyState,
} from "@/lib/tilia/world-destiny-log";
import {
  useWorldLogStream,
  useWorldLogTimeline,
  type WorldLogRow,
} from "@/lib/tilia/world-log-stream";
import { WORLD_LOG_RECORDING } from "@/lib/tilia/world-log-recording";
import { nextTickMs, SLIDE_MS } from "@/lib/tilia/world-stream-tick";

/** 一行的高度，和字号的 leading 对齐。 */
const LINE_H = 18;

/**
 * 三张卡只有一支颜色。
 *
 * 原先一张一支色（算是绿的、命运是冷的、因果是暖的），三色并置像三个模块；可这
 * 一屏说的是「世界背面」——一块还通着电的板子，板子不会分三种颜色发光。收成一
 * 支绿之后，主次全交给透明度：亮的是这一行的正文，暗的是它的出处、时刻、分数。
 */
const GREEN = "#3bff8f";

/** 那一支绿的几档深浅。够用就好，档太多等于没分档。 */
const INK = {
  /** 正文：这一行真正在说的事。 */
  bright: GREEN,
  strong: `${GREEN}d9`,
  /** 次要：op、说明的后半截。 */
  mid: `${GREEN}b0`,
  /** 辅助：时刻、出处、箭头。 */
  soft: `${GREEN}80`,
  /** 退场：散掉的命运、断掉的链、分数。 */
  faint: `${GREEN}59`,
} as const;

/**
 * 游标的起点。
 *
 * 得比「一张卡放得下的行数」大 —— 首屏是从 `cursor` 往回数填出来的，起点太小
 * 会数到负数去（世界在你打开之前就已经在算了，负数那头没有内容）。
 */
const CURSOR_START = 64;

/** 全屏展开的进出场。 */
const ANIM_MS = 240;

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
 * 三张等高、同一支绿，因为它们是并列的三层，不是一主二次。三张一起看到的是
 * 「世界在转」这件事本身；要读清某一层，点开它，同一条流水占满整屏。
 *
 * 三张的拍子都是随机的 1–5 秒，各摇各的骰子（见 `world-stream-tick.ts`）——
 * 整屏看过去此起彼伏，而不是三行一起跳。
 */
export function WorldStreamCards() {
  /*
   * 第一张卡滚的是真的世界日志。连得上网关就是此刻的（排队按拍放，理由和排法
   * 见 `useWorldLogTimeline`）；连不上（线上静态站、不在内网）就滚录下来的那
   * 一段。两头都是真话，差别只在一个是「正在」、一个是「曾经」。
   */
  const feed = useWorldLogStream();
  const line = useWorldLogTimeline(feed);

  return (
    <div className="absolute bottom-[20px] left-1/2 top-[104px] z-[8] flex w-[340px] -translate-x-1/2 flex-col gap-[10px]">
      <StreamCard
        cmd="world.tail -f"
        title="世界一直在算"
        note={
          line.live
            ? "接的是此刻那条流；后端吐得慢，这张卡就跟着它慢下来"
            : "录下来的一段真日志 —— 这一节车厢外面连不上世界的机房"
        }
        live={line.live}
        waiting={line.live && !line.flowing}
        /* 接上流的时候拍子由那条队打，卡片跟着它走，别自己再打一份。 */
        cursor={line.live ? line.start + line.rows.length - 1 : undefined}
        renderRow={(i) => (
          <CalcRow
            row={
              line.live
                ? line.rows[i - line.start]
                : pick(WORLD_LOG_RECORDING, i)
            }
          />
        )}
      />
      <StreamCard
        cmd="destiny.watch"
        title="命运一直在涌现"
        note="起、酝、定、散 —— 你不在场也照样落"
        renderRow={(i) => <DestinyRow i={i} />}
      />
      <StreamCard
        cmd="cause.trace"
        title="因果链一直在推演"
        note="一条链从因走到果，末一节是果"
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
 * 整张卡都是那个「展开」按钮，右上角那句 `[展开]` 只是它的标签 —— 卡上没有别
 * 的可点的东西，把命中区做小反而是给自己找麻烦。
 *
 * 行数不写死，按实测高度算：手机框高是 min(100dvh, 812)。
 */
function StreamCard({
  cmd,
  title,
  note,
  live = false,
  waiting = false,
  cursor: cursorFromFeed,
  renderRow,
}: {
  /** 表头左边那截命令行的样子。 */
  cmd: string;
  title: string;
  /** 展开后副标题里那半句：这一条流水到底在说什么。 */
  note: string;
  /** 滚的是真的账 —— 表头点一颗灯。 */
  live?: boolean;
  /** 真的都放完了，在等世界开口 —— 那颗灯改成喘气，别让人以为是死了。 */
  waiting?: boolean;
  /** 拍子由外面打（真数据那张卡）。给了就不再自己走表。 */
  cursor?: number;
  renderRow: (i: number) => ReactNode;
}) {
  const motion = useMotion();
  const own = useStreamCursor(cursorFromFeed === undefined);
  const cursor = cursorFromFeed ?? own;
  const [expanded, setExpanded] = useState(false);
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
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`${title}：展开看整屏`}
        className="flex min-h-0 flex-1 flex-col overflow-clip rounded-[16px] border px-[14px] pb-[10px] pt-[9px] text-left backdrop-blur-[20px] transition-transform duration-200 active:scale-[0.99]"
        style={{
          borderColor: `${GREEN}24`,
          background: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-[8px] font-mono text-[9px] leading-none">
          <span className="truncate" style={{ color: `${GREEN}66` }}>
            $ {cmd} · {title}
          </span>
          <span className="flex shrink-0 items-center gap-[5px]">
            {/* 真账在滚的时候点一颗灯：一眼分得出这张卡此刻接没接上 */}
            {live ? (
              <span
                className={`inline-block size-[5px] rounded-full ${waiting ? "animate-pulse" : ""}`}
                style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }}
              />
            ) : null}
            <span style={{ color: `${GREEN}99` }}>[展开]</span>
          </span>
        </div>

        <div ref={boxRef} className="mt-[6px] min-h-0 flex-1">
          <Stream
            rows={rows}
            cursor={cursor}
            motion={motion}
            renderRow={renderRow}
          />
        </div>
      </button>

      <StreamSheet
        open={expanded}
        cmd={cmd}
        title={title}
        note={note}
        cursor={cursor}
        motion={motion}
        renderRow={renderRow}
        onClose={() => setExpanded(false)}
      />
    </>
  );
}

/* ─────────────────────────── 全屏展开 ─────────────────────────── */

/**
 * 一条流水的整屏。
 *
 * 展开只做一件事：把窗口开大。同一条流水、同一个游标（`cursor` 从卡片传进
 * 来），所以点开的那一瞬不会跳号 —— 是同一份账摊开来看，不是另一屏。
 *
 * 不能往回翻：这是 `tail -f`，只有正在发生的那几十行。要看世界记下来的事，那
 * 是「世界动态」的活儿。
 */
function StreamSheet({
  open,
  cmd,
  title,
  note,
  cursor,
  motion,
  renderRow,
  onClose,
}: {
  open: boolean;
  cmd: string;
  title: string;
  note: string;
  cursor: number;
  motion: boolean;
  renderRow: (i: number) => ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rows, setRows] = useState(24);
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

  /* 盖在「世界背面」那一层（z-66）之上：展开的是它上面的一屏，不是它的一部分。 */
  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[72]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-0 flex flex-col bg-black/[0.96] transition-opacity duration-[240ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <StatusBar />

        <header className="flex shrink-0 items-start justify-between px-[16px] pb-[14px] pt-[9.5px]">
          <div className="flex flex-col gap-[3px]">
            <h1
              className="font-mono text-[15px] leading-none"
              style={{ color: GREEN }}
            >
              {cmd}
            </h1>
            <p
              className="font-mono text-[10px] leading-none"
              style={{ color: `${GREEN}73` }}
            >
              {title} · {note}
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
          <Stream
            rows={rows}
            cursor={cursor}
            motion={motion}
            size={12}
            wrap
            renderRow={renderRow}
          />
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/* ─────────────────────────── 流水本体 ─────────────────────────── */

/**
 * 往上顶的那叠字。
 *
 * 那一叠贴着底边排，多出来的从上沿被裁掉 —— 这样折行之后每行高矮不一也不用去
 * 算「露几行」：底下那行永远是完整的，上面裁到哪儿算哪儿。
 *
 * 顶一格的距离每拍都要量（新落下那行自己有多高），量完再重挂动画 —— 折行之后
 * 一行可能是一行，也可能是三行。量在 layout effect 里，赶在这一帧画出来之前。
 *
 * 整块不进读屏：一秒好几行的流水念出来只是噪音。
 */
function Stream({
  rows,
  cursor,
  motion,
  size = 11,
  wrap = false,
  renderRow,
}: {
  rows: number;
  cursor: number;
  motion: boolean;
  /** 字号：卡片上 11，展开后 12。行高不跟着变，两处对得上才不会跳。 */
  size?: number;
  /** 折行：一行读得全，代价是高矮不齐。卡片上不折，展开后折。 */
  wrap?: boolean;
  renderRow: (i: number) => ReactNode;
}) {
  const keep = rows + 1;
  const list = Array.from({ length: keep }, (_, k) => cursor - (keep - 1) + k);
  const stackRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el || !motion) return;
    const last = el.lastElementChild as HTMLElement | null;
    el.style.setProperty("--log-rise", `${last?.offsetHeight ?? LINE_H}px`);
    /* 先摘掉再挂上，中间读一下布局 —— 不读这一下，浏览器不认为动画换过。 */
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = `livo-log-rise ${SLIDE_MS}ms linear`;
  }, [cursor, motion]);

  return (
    <div
      aria-hidden
      className={`flex flex-col justify-end overflow-clip ${wrap ? "livo-log-wrap" : ""}`}
      style={{ height: rows * LINE_H }}
    >
      <div ref={stackRef} className="shrink-0">
        {list.map((i, k) => (
          <div
            key={i}
            /* 越旧越淡：顶上去的那几行自己就退场了。 */
            style={
              {
                [wrap ? "minHeight" : "height"]: LINE_H,
                fontSize: size,
                opacity: 0.3 + (k / (keep - 1)) * 0.7,
              } as CSSProperties
            }
            /* 折行的那一屏在外层挂 livo-log-wrap，这一行的排法由那组样式接管。 */
            className="livo-log-row flex items-center gap-[5px] overflow-hidden whitespace-nowrap font-mono leading-[18px]"
          >
            {renderRow(i)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 顶一格要不要滑过去。关了动效的人只是不滑，行照样落。 */
function useMotion(): boolean {
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    setMotion(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return motion;
}

/**
 * 游标：每张卡各走各的一份，各摇各的骰子。
 *
 * 用一串 timeout 而不是 setInterval —— 每一拍的间隔都要重摇（见
 * `world-stream-tick.ts`）。真数据那张卡的拍子在外面打，这里就不走表。
 */
function useStreamCursor(enabled: boolean): number {
  const [cursor, setCursor] = useState(CURSOR_START);

  useEffect(() => {
    if (!enabled) return;
    let t = 0;
    const beat = () => {
      t = window.setTimeout(() => {
        setCursor((n) => n + 1);
        beat();
      }, nextTickMs());
    };
    beat();
    return () => window.clearTimeout(t);
  }, [enabled]);

  return cursor;
}

/** 内容循环取。取模先兜正：JS 里 -3 % 10 是 -3，负下标取出来是 undefined。 */
function pick<T>(pool: readonly T[], i: number): T {
  return pool[((i % pool.length) + pool.length) % pool.length];
}

/* ─────────────────────────── 三种行 ─────────────────────────── */

/**
 * 世界一直在算：时刻 + op + 说人话的那半句。
 *
 * world_event 提亮一档：那是世界里真落了一件事（谁去了哪儿、谁改了日程），其
 * 余是它跑动的痕迹（调了哪个模型、花了多少毫秒）。两者混在一起滚，才像在看一
 * 台还开着的机器，而不是一份摘要。提的是亮度不是色相 —— 这一屏只有一支绿。
 *
 * 这一格还没轮到内容（刚接上流、队列还没铺到这儿）就空着 —— 不拿别的来填：这
 * 张卡说了每行都是真的，就不能掺。
 */
function CalcRow({ row }: { row?: WorldLogRow }) {
  if (!row) return null;

  const event = row.kind === "event";

  return (
    <>
      <span className="shrink-0 tabular-nums" style={{ color: INK.soft }}>
        {row.at}
      </span>
      <span
        className="shrink-0"
        style={{ color: event ? INK.strong : INK.mid }}
      >
        {row.op}
      </span>
      <span
        className="truncate"
        style={{ color: event ? INK.bright : INK.strong }}
      >
        {row.note ? `· ${row.note}` : ""}
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
 * 原先冷暖跟着命运本身走（潜在的蓝、注定的粉橙），现在同一支绿，深浅接着说同
 * 一件事：注定的最亮、潜在的次之、散掉的退到最暗 —— 一眼扫过去仍然读得出「这
 * 些正在长、那几件已经没下文了」，只是不再靠色相。
 *
 * 时刻每行往前挪两三分钟：单调、但不匀速。
 */
function DestinyRow({ i }: { i: number }) {
  const line = pick(DESTINY_LOG, i);
  const tone =
    line.state === "fade"
      ? INK.faint
      : line.kind === "destined"
        ? INK.bright
        : INK.mid;
  const at = DESTINY_CLOCK_START + i * 3 - (i % 4);

  return (
    <>
      <span style={{ color: INK.soft }}>{hhmm(at)}</span>
      <span
        className="shrink-0 rounded-[3px] px-[3px] py-[1px] text-[9px] leading-none"
        style={{ color: tone, background: `${GREEN}1f` }}
      >
        {DESTINY_TAG[line.state]}
        {line.at === undefined ? "" : ` ${Math.round(line.at * 100)}%`}
      </span>
      <span className="shrink-0" style={{ color: INK.soft }}>
        {line.room}
      </span>
      {/* 短名不许压：一行里先读得出「这是哪一枚命运」，说人话那半句截了无妨 */}
      <span className="shrink-0" style={{ color: tone }}>
        {line.title}
      </span>
      <span className="truncate" style={{ color: INK.mid }}>
        · {line.note}
      </span>
    </>
  );
}

/** 结论的四种口气，深浅从「成立」到「断了」一路暗下去。 */
const CAUSE_TAG: Record<CauseState, { label: string; tone: string }> = {
  done: { label: "成立", tone: INK.bright },
  solve: { label: "推演", tone: INK.mid },
  hold: { label: "差一件", tone: INK.soft },
  drop: { label: "断了", tone: INK.faint },
};

/**
 * 因果链一直在推演：一条链从因走到果，末一节是果。
 *
 * 箭头和星图上的线是同一支绿、同一件事，只是一个画出来、一个写出来。前面的因压
 * 暗、末一节提亮：一行字里也要看得出方向。
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
            {k > 0 ? <span style={{ color: INK.soft }}>▸</span> : null}
            <span style={{ color: k === last ? INK.bright : INK.mid }}>
              {term}
            </span>
          </span>
        ))}
      </span>
      <span className="shrink-0" style={{ color: tag.tone }}>
        {tag.label}
      </span>
      <span className="shrink-0 tabular-nums" style={{ color: INK.faint }}>
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
