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
import { CAUSE_STREAM } from "@/lib/tilia/world-cause-log";
import { DESTINY_STREAM } from "@/lib/tilia/world-destiny-log";
import {
  useWorldLogStream,
  useWorldLogTimeline,
  type WorldLogRow,
} from "@/lib/tilia/world-log-stream";
import { WORLD_LOG_RECORDING } from "@/lib/tilia/world-log-recording";
import {
  CALC_TICK,
  nextTickMs,
  READ_TICK,
  slideMs,
  type TickRange,
} from "@/lib/tilia/world-stream-tick";

/** 一行的高度，和字号的 leading 对齐。 */
const LINE_H = 18;

/**
 * 三张卡的底色。
 *
 * 原先一张一支色（算是绿的、命运是冷的、因果是暖的），三色并置像三个模块；可这
 * 一屏说的是「世界背面」——一块还通着电的板子，板子不会分三种颜色发光。收成一
 * 支绿之后，主次全交给透明度：亮的是这一行的正文，暗的是它的出处、时刻、分数。
 *
 * 两处例外都不是给卡分身份的，是在一张卡内部标东西：中间那张的分段色标接缝，因果那
 * 张的橘胶囊标判决（见 `AMBER`）。
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
 * 判决那一支橘。
 *
 * 只给因果卡上那颗胶囊用（兑现 / 呼应 / 因果），别处一律走绿。之前整个果都试过走
 * 橘，一整组连着交代全换色，等于把这张卡劈成两半；收回绿之后，判决这一颗反而没了
 * 落点 —— 它和正文一样大一样亮，扫过去只是又一个词。
 *
 * 留一颗橘：一屏绿里就这一处是暖的，眼睛先落在「这一咬算不算数」上，而这一咬本身
 * 又只有三种取值 —— 换色标定值域，比再加一档亮度稳。
 */
const AMBER = "#ffa63b";

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
 *   命运一直在涌现    它给还没发生的戏写好的稿子：动机、发展、边界
 *   因果链一直在推演  落下的这些又互相咬成链：伏笔、目标、因，最后咬出一个果
 *
 * 三张等高，因为它们是并列的三层，不是一主二次。三张一起看到的是「世界在转」这
 * 件事本身；要读清某一层，点开它，同一条流水占满整屏。
 *
 * 颜色上第一、三张走同一支绿，中间那张一枚命运一个颜色 —— 那张卡上一段接一段
 * 都是成篇的稿子，得靠换色才看得出接缝在哪儿（见 `DestinyRow`）。
 *
 * 拍子都是随机的、各摇各的骰子，但快慢分两档（见 `world-stream-tick.ts`）：算的
 * 那张 0.1–0.5 秒，快到只读得清一两个词；命运和因果那两张 1–5 秒，慢到每行读得
 * 完。快慢本身就在说它们各自是什么东西。
 */
export function WorldStreamCards() {
  /*
   * 第一张卡滚的是真的世界日志。连得上网关就是此刻的（排队按拍放，理由和排法
   * 见 `useWorldLogTimeline`）；连不上（线上静态站、不在内网）就滚录下来的那
   * 一段。两头都是真话，差别只在一个是「正在」、一个是「曾经」。
   */
  const feed = useWorldLogStream();
  const line = useWorldLogTimeline(feed, CALC_TICK);

  return (
    <div className="absolute bottom-[20px] left-1/2 top-[104px] z-[8] flex w-[340px] -translate-x-1/2 flex-col gap-[10px]">
      <StreamCard
        cmd="world.tail -f"
        title="世界一直在算"
        tick={CALC_TICK}
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
        renderRow={(i) => <DestinyRow i={i} />}
      />
      <StreamCard
        cmd="cause.trace"
        title="因果链一直在推演"
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
  tick = READ_TICK,
  live = false,
  waiting = false,
  cursor: cursorFromFeed,
  renderRow,
}: {
  /** 表头左边那截命令行的样子。 */
  cmd: string;
  title: string;
  /** 这张卡多快落一行。默认是读得完的那一档。 */
  tick?: TickRange;
  /** 滚的是真的账 —— 表头点一颗灯。 */
  live?: boolean;
  /** 新的都放完了、正绕着重放 —— 那颗灯改成喘气，说清此刻没有新的进来。 */
  waiting?: boolean;
  /** 拍子由外面打（真数据那张卡）。给了就不再自己走表。 */
  cursor?: number;
  renderRow: (i: number) => ReactNode;
}) {
  const motion = useMotion();
  const own = useStreamCursor(cursorFromFeed === undefined, tick);
  const cursor = cursorFromFeed ?? own;
  const [expanded, setExpanded] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(6);
  const slide = slideMs(tick);

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
        {/*
          表头比正文大一号。这三张卡是并列的三层，得先认出「这一张在说什么」再去读
          它滚的东西；表头跟正文一样小（原先 9px、还压到四成）就成了流水的一部分，
          一屏扫过去只看见字在动，不知道分了几摊。

          命令行那截仍压着：它是这张卡的门牌，中文标题才是名字。右边 [展开] 留在
          小字里 —— 它是个开关，不参与「这一张在说什么」。
        */}
        <div className="flex shrink-0 items-center justify-between gap-[8px] font-mono leading-none">
          <span className="truncate text-[13px]">
            <span style={{ color: `${GREEN}59` }}>$ {cmd} · </span>
            <span style={{ color: `${GREEN}b3` }}>{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-[5px] text-[9px]">
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
            slide={slide}
            renderRow={renderRow}
          />
        </div>
      </button>

      <StreamSheet
        open={expanded}
        cmd={cmd}
        title={title}
        cursor={cursor}
        motion={motion}
        slide={slide}
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
  cursor,
  motion,
  slide,
  renderRow,
  onClose,
}: {
  open: boolean;
  cmd: string;
  title: string;
  cursor: number;
  motion: boolean;
  slide: number;
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
              {title}
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
            slide={slide}
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
  slide,
  size = 11,
  wrap = false,
  renderRow,
}: {
  rows: number;
  cursor: number;
  motion: boolean;
  /** 顶一格滑多久。跟着这张卡的拍子来，见 `slideMs`。 */
  slide: number;
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
    el.style.animation = `livo-log-rise ${slide}ms linear`;
  }, [cursor, motion, slide]);

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
function useStreamCursor(enabled: boolean, tick: TickRange): number {
  const [cursor, setCursor] = useState(CURSOR_START);

  useEffect(() => {
    if (!enabled) return;
    let t = 0;
    const beat = () => {
      t = window.setTimeout(() => {
        setCursor((n) => n + 1);
        beat();
      }, nextTickMs(tick));
    };
    beat();
    return () => window.clearTimeout(t);
  }, [enabled, tick]);

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

/**
 * 命运一直在涌现：世界给一场还没发生的戏写的稿子。
 *
 * 一枚命运摊开是三段 —— 行为动机、剧情发展、行为边界 —— 一行一行滚过去（数据与
 * 分行见 `world-destiny-log.ts`）。这一张卡因此比另外两张密：它是稿子，不是账。
 *
 * 这里是整屏唯一不走那一支绿的地方：每一枚命运一个颜色，主导者是谁就用谁的色。
 * 稿子一段接一段滚，中间没有分隔线也没有空行 —— 光靠透明度分不出「这一段结束
 * 了、换了一枚」，颜色一换才看得见接缝。段内的主次仍旧交给透明度：标签最亮，正
 * 文次之，时刻最淡。
 */
function DestinyRow({ i }: { i: number }) {
  const row = pick(DESTINY_STREAM, i);
  const hue = row.hue;

  if (row.kind === "head") {
    return (
      <>
        <span className="shrink-0 tabular-nums" style={{ color: `${hue}80` }}>
          {hhmm(row.at ?? 0)}
        </span>
        <span
          className="livo-log-chip shrink-0 rounded-[3px] px-[3px] py-[1px] text-[9px] leading-none"
          style={{ color: hue, background: `${hue}24` }}
        >
          {row.label}
        </span>
        <span className="truncate" style={{ color: hue }}>
          {row.text}
        </span>
      </>
    );
  }

  if (row.kind === "field") {
    return (
      <>
        {/* 段名不许压：一行里先读得出这是动机、发展还是边界 */}
        <span className="shrink-0" style={{ color: hue }}>
          【{row.label}】
        </span>
        <span className="truncate" style={{ color: `${hue}c4` }}>
          {row.text}
        </span>
      </>
    );
  }

  return (
    <>
      <span className="shrink-0" style={{ color: `${hue}73` }}>
        ·
      </span>
      <span className="truncate" style={{ color: `${hue}a8` }}>
        {row.text}
      </span>
    </>
  );
}

/**
 * 因果链一直在推演：伏笔、目标、因、果，穿插着滚过去。
 *
 * 分行与字段见 `world-cause-log.ts`。这里只管一件事 —— 让眼睛先接住果。
 *
 * 深浅只分两层，分的不是「哪个字段更重要」，是「这是铺垫，还是结出来的那一下」：
 *
 *   亮  果，连它底下整组交代 —— LCC、因 1、因 2……、状态
 *   暗  伏笔、目标、因 —— 铺垫，一屏里退到背面去
 *
 * 果那一整组一起亮，不在组内再分层：一个果凭什么成立，是「哪几件算数了」加「凭什么
 * 正好此刻」一起说完的，把交代压成小字等于让人只读得到结论。这一组连着读，才是推演
 * 本身。
 *
 * 铺垫那三行压暗不是因为不重要，是因为它们在这一屏里已经各自当过一次果 —— 世界一
 * 边算一边补，同一件事这会儿是果、下一段就成了因。压暗只是让眼睛先接住此刻新结出来
 * 的那一组。
 *
 * 果多带一点辉光。胶囊（兑现 / 呼应 / 因果）跟在【果】后头，是这一行的判决，不是注
 * 脚 —— 也是这张卡上唯一一处不走绿的东西，见 `AMBER`。
 *
 * LCC 那行跟因、状态一样缩进一格：它是这枚果在链上站在哪儿，归这枚果，不是另起一
 * 件事。链怎么算出来的见 `world-cause-log.ts`。
 */
const CAUSE_LABEL = {
  seed: "伏笔",
  goal: "目标",
  cause: "因",
  effect: "果",
} as const;

function CauseRow({ i }: { i: number }) {
  const row = pick(CAUSE_STREAM, i);

  if (row.kind === "effect") {
    return (
      <>
        <span
          className="shrink-0"
          style={{ color: INK.bright, textShadow: `0 0 9px ${GREEN}40` }}
        >
          【{CAUSE_LABEL.effect}】
        </span>
        {/*
          兑现 / 呼应 / 因果 这三个词是这一行的判决 —— 果和前面那些咬合的方式。原
          先按注脚做（9px、压到七成、钉在行尾），可它说的事比注脚重：同样几件因摆
          在那儿，是兑现还是呼应，差的是这条链算不算数。所以跟正文一样大（1em，卡
          片上 11、展开后 12 都跟着走）、跟正文一样亮，只留背景那点方块说明它是标注。

          位置紧跟在【果】后面，不钉行尾：展开后整行退回文字流好折行，钉在尾巴上的
          标签一旦碰上刚好折满的句子就会被挤到下一行开头、单独站着，读起来像跟「因
          1」「状态」平级的新字段，而它是上面那句的判决。跟着标签走就没这问题 ——
          两种状态位置一样，也顺过来了：这是一枚果，咬合方式是兑现。

          颜色是这张卡唯一一处不走绿的（见 `AMBER`）：一屏绿里就它是暖的。
        */}
        <span
          className="livo-log-chip shrink-0 self-center rounded-[3px] px-[4px] py-[1px] align-middle leading-none"
          style={{
            fontSize: "1em",
            color: AMBER,
            background: `${AMBER}26`,
            textShadow: `0 0 9px ${AMBER}4d`,
          }}
        >
          {row.relation}
        </span>
        <span
          className="truncate"
          style={{ color: INK.bright, textShadow: `0 0 9px ${GREEN}40` }}
        >
          {row.text}
        </span>
      </>
    );
  }

  if (row.kind === "chain") {
    return (
      <>
        <span className="livo-log-indent w-[12px] shrink-0" aria-hidden />
        <span className="shrink-0" style={{ color: INK.mid }}>
          LCC
        </span>
        {/* 链整句一格色：符号和短名分色只会让这行看着更碎，等宽本身已经在分栏了 */}
        <span className="truncate" style={{ color: INK.strong }}>
          {row.text}
        </span>
      </>
    );
  }

  if (row.kind === "from") {
    return (
      <>
        {/* 缩进那一格是给眼睛的：这几行是上面那个果的交代，不是新起一件事 */}
        <span className="livo-log-indent w-[12px] shrink-0" aria-hidden />
        <span className="shrink-0 tabular-nums" style={{ color: INK.mid }}>
          因{row.index}
        </span>
        <span className="truncate" style={{ color: INK.bright }}>
          {row.text}
        </span>
      </>
    );
  }

  if (row.kind === "state") {
    return (
      <>
        <span className="livo-log-indent w-[12px] shrink-0" aria-hidden />
        <span className="shrink-0" style={{ color: INK.mid }}>
          状态
        </span>
        <span className="truncate" style={{ color: INK.bright }}>
          {row.text}
        </span>
      </>
    );
  }

  /* 铺垫压暗：它们各自都当过一次果，这一屏先让位给刚结出来的那一组。 */
  return (
    <>
      <span className="shrink-0" style={{ color: INK.faint }}>
        【{CAUSE_LABEL[row.kind]}】
      </span>
      <span className="truncate" style={{ color: INK.soft }}>
        {row.text}
      </span>
    </>
  );
}

/** 当天的分钟数写成 06:18；跨过一天就绕回来。 */
function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
