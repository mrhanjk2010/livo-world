"use client";

/**
 * 真的世界在算什么 —— 接后端的世界日志流，喂给「世界背面」第一张卡。
 *
 * 那张卡（世界一直在算）本来滚的是手写的词库：它要表达的是「世界不是等你来了
 * 才开始算」，词是假的、意思是真的。现在有了真的账可看，就让它滚真的 —— 同一
 * 张卡、同一种滚法，只是内容换成后端此刻正在跑的行。
 *
 * ## 为什么要绕一道自己的接口
 *
 * 网关那条流没有 CORS 响应头，浏览器直接连读不到（连接得上，读不了）。所以走
 * 同源的 `/api/world-logs`（见 `src/app/api/world-logs/route.ts`）：那边把上游
 * 的整行日志拆成 `WorldLogRow` 再转发，浏览器只拿要显示的那点东西 —— 上游一行
 * world_event 能有一两 KB 的 JSON，全推到前端再解一遍没道理。
 *
 * ## 连不上是常态，不是故障
 *
 * 网关在内网、走明文 http，而线上那份 demo 是 GitHub Pages 的静态站：没有服务
 * 端可以代理，https 页面也不许去连 http。所以线上这条流一定是连不上的，静态导
 * 出时 `src/app/api` 整个会被搬走（见 `scripts/deploy-pages.sh`）。
 *
 * 连不上就滚录下来的那一段（`world-log-recording.ts`，从这条流上录的真日志）
 * —— 那张卡在哪儿都在滚真的东西，差别只在一个是「正在」、一个是「曾经」。
 */

import { useEffect, useRef, useState } from "react";
import type { WorldLogRow } from "@/lib/tilia/world-log-line";
import { nextTickMs, type TickRange } from "@/lib/tilia/world-stream-tick";

export type { WorldLogRow };

/** 看哪个世界。给了默认值：demo 就盯这一个。 */
export const WORLD_LOG_USER =
  process.env.NEXT_PUBLIC_WORLD_LOG_USER ?? "100450";
export const WORLD_LOG_WORLD =
  process.env.NEXT_PUBLIC_WORLD_LOG_WORLD ?? "69f1f741ad190384902f38b6";

/**
 * 手里最多攒多少行。
 *
 * 这个数不是「显示得下多少」，是「够滚多久」：卡上一次看得见五六行，但队列一
 * 拍只放一行（平均 0.3 秒），所以攒下的行数直接决定真数据能连着滚多长时间 ——
 * 攒满这 800 行能放上四分钟，之后就跟着后端的产出走走停停。
 *
 * 一上来 backfill 会灌几百行，这个数太小的话，多出来的那些还没轮到显示就被挤
 * 掉了，于是刚打开这一屏没多久就没有真的可放。留够装下整段 backfill。
 */
const KEEP = 800;

/** 收到就 setState 的话，backfill 那几百条会连着重渲染几百次。攒一下再交。 */
const FLUSH_MS = 150;

/** 一直连不上就别再敲了：静态站上这条流永远不会通。 */
const MAX_TRIES = 3;

export type WorldLogFeed = {
  /** 攒着的行，旧的在前。 */
  rows: readonly WorldLogRow[];
  /** `rows[0]` 是从连上算起的第几行 —— 丢掉旧行之后下标不能乱。 */
  start: number;
  /** 收到过东西没有。没有就用手写那套。 */
  live: boolean;
};

const EMPTY: WorldLogFeed = { rows: [], start: 0, live: false };

export function useWorldLogStream(): WorldLogFeed {
  const [feed, setFeed] = useState<WorldLogFeed>(EMPTY);
  /* 收到的先堆这儿，定时交给 React —— 见 FLUSH_MS。 */
  const pending = useRef<WorldLogRow[]>([]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let tries = 0;
    let got = false;
    let stopped = false;

    const flush = () => {
      const batch = pending.current;
      if (batch.length === 0) return;
      pending.current = [];
      setFeed((f) => {
        const rows = [...f.rows, ...batch];
        const drop = Math.max(0, rows.length - KEEP);
        return {
          rows: drop ? rows.slice(drop) : rows,
          start: f.start + drop,
          live: true,
        };
      });
    };
    const timer = setInterval(flush, FLUSH_MS);

    const open = () => {
      if (stopped) return;
      tries += 1;
      const url = `/api/world-logs?user_id=${encodeURIComponent(WORLD_LOG_USER)}&world_id=${encodeURIComponent(WORLD_LOG_WORLD)}`;
      es = new EventSource(url);

      es.onmessage = (e) => {
        got = true;
        const row = safeParse(e.data);
        if (row) pending.current.push(row);
      };

      es.onerror = () => {
        /* 连上过就交给 EventSource 自己重连 —— 网关重启、流断一下是常事。 */
        if (got) return;
        es?.close();
        es = null;
        if (tries >= MAX_TRIES) return; // 这儿根本没有那条流，别再敲了
        window.setTimeout(open, 1200 * tries);
      };
    };

    open();

    return () => {
      stopped = true;
      clearInterval(timer);
      es?.close();
    };
  }, []);

  return feed;
}

/* ─────────────────────────── 按拍放出去 ─────────────────────────── */

/**
 * 攒下来的行排成一条队，一拍放一行。
 *
 * 为什么要排队，而不是收到就显示：后端是按拍算的，一阵一阵地吐 —— 一上来
 * backfill 灌几百行，然后可能一分钟里一行都没有（那条流上只剩每秒一个 ping）。
 * 收到就显示的话，几百行会在一瞬间刷完，然后卡在那儿不动，看着像是坏了。
 *
 * 排队之后，滚的每一行都是真的，快慢却可以自己定：这张卡走机器那一档（0.1–0.5
 * 秒，见 `world-stream-tick.ts`），远比后端吐得快 —— 于是一上来那几百行 backfill
 * 会连着快滚四分钟左右，把攒下的历史一行行放完。
 *
 * 放完之后不停：回头接着放攒下的那些，从头绕一圈再来。世界背面是一屏一直在转的东
 * 西，卡住不动看着就像坏了。绕圈放的仍然是真日志，只是这一段读过了 —— 表头那颗灯
 * 会改成喘气，说清此刻没有新的进来。宁可重放读过的，也不掺一行假的。
 */
export type WorldLogTimeline = {
  /** 一拍一格。 */
  rows: readonly WorldLogRow[];
  /** `rows[0]` 是第几拍。 */
  start: number;
  /** 排上队了没有 —— 没有的话卡片走录下来那一段。 */
  live: boolean;
  /** 放的是新到的行，还是绕回去重放攒下的那些。 */
  flowing: boolean;
};

/** 队列里留多少拍。够展开那一屏取满就行，往回翻是「世界动态」的活儿。 */
const TIMELINE_KEEP = 120;

/**
 * 头一拍先铺满一屏。
 *
 * 一行行长出来要等：这一屏五六行、展开后二十几行，就算按最快那一档也得盯着一张
 * 半空的卡等上十几秒。先把这一屏铺上，再一行行往下走。
 */
const SEED = 48;

const NO_TIMELINE: WorldLogTimeline = {
  rows: [],
  start: 0,
  live: false,
  flowing: false,
};

export function useWorldLogTimeline(
  feed: WorldLogFeed,
  tick: TickRange,
): WorldLogTimeline {
  const [line, setLine] = useState<WorldLogTimeline>(NO_TIMELINE);
  /* 拍子由定时器打，读的是最新的 feed —— 所以用 ref，别让 feed 一变就重开表。 */
  const latest = useRef(feed);
  latest.current = feed;
  /* 下一行该放 feed 里的第几行（绝对下标）。 */
  const taken = useRef(0);
  const seeded = useRef(false);
  /* 新的放完之后，从攒下的这些里接着往下绕。这个游标不跟着新行重置。 */
  const again = useRef(0);

  useEffect(() => {
    if (!feed.live) return;

    const push = (batch: readonly WorldLogRow[], fresh: boolean) => {
      if (batch.length === 0) return;
      setLine((prev) => {
        const rows = [...prev.rows, ...batch];
        const drop = Math.max(0, rows.length - TIMELINE_KEEP);
        return {
          rows: drop ? rows.slice(drop) : rows,
          start: prev.start + drop,
          live: true,
          flowing: fresh,
        };
      });
    };

    const step = () => {
      const f = latest.current;
      const end = f.start + f.rows.length;
      /* 攒得太多时缓冲会从头丢，丢掉的那些就别等了。 */
      const next = Math.max(taken.current, f.start);

      if (next < end) {
        const take = seeded.current ? 1 : Math.min(SEED, end - next);
        seeded.current = true;
        const from = next - f.start;
        push(f.rows.slice(from, from + take), true);
        taken.current = next + take;
        return;
      }

      /* 新的放完了，回头再放一遍攒下的 —— 这一屏不许停，但也不掺假行。 */
      if (f.rows.length === 0) return;
      push([f.rows[again.current % f.rows.length]], false);
      again.current += 1;
    };

    /* 一串 timeout 而不是 setInterval：每一拍的间隔都要重摇。 */
    let t = 0;
    const beat = () => {
      t = window.setTimeout(() => {
        step();
        beat();
      }, nextTickMs(tick));
    };
    beat();

    return () => window.clearTimeout(t);
  }, [feed.live, tick]);

  return line;
}

function safeParse(data: string): WorldLogRow | null {
  try {
    const v = JSON.parse(data) as Partial<WorldLogRow>;
    if (typeof v.at !== "string" || typeof v.op !== "string") return null;
    return {
      at: v.at,
      op: v.op,
      note: typeof v.note === "string" ? v.note : "",
      kind: v.kind === "event" ? "event" : "log",
    };
  } catch {
    return null;
  }
}
