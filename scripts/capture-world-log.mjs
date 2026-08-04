#!/usr/bin/env node
/**
 * 从世界日志网关录一段真的下来，写成一份可以随产物一起发出去的静态数据。
 *
 * 为什么要录：那条流在内网、走明文 http，线上（GitHub Pages 静态站、https）
 * 够不着。录一段下来当底本，「世界一直在算」那张卡在任何地方都滚真的东西 ——
 * 只是不在内网时滚的是某一段过去，不是此刻。
 *
 * 用法（要在连得上内网的机器上跑）：
 *
 *   node scripts/capture-world-log.mjs                 # 连 5 分钟再写
 *   node scripts/capture-world-log.mjs --seconds 120
 *   node scripts/capture-world-log.mjs --from dump.sse # 拿现成的原始流来解
 *
 * 解析用的是 `src/lib/tilia/world-log-line.ts` 里那一份 —— 和运行时同一套，
 * 不另写一遍：两份解析迟早会各走各的。
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseWorldLogLine } from "../src/lib/tilia/world-log-line.ts";

const GATEWAY =
  process.env.WORLD_LOG_GATEWAY ?? "http://os-agent-gateway-stag-bj3.srv:8000";
const USER = process.env.WORLD_LOG_USER ?? "100450";
const WORLD = process.env.WORLD_LOG_WORLD ?? "69f1f741ad190384902f38b6";

const OUT = "src/lib/tilia/world-log-recording.ts";

/**
 * 最多留多少行。
 *
 * 这份要随产物发出去，是实打实的体积；而一拍 2.5 秒，500 行已经够滚二十分钟
 * ——没人会盯着一张背景卡看二十分钟。
 */
const MAX_ROWS = 500;

const args = process.argv.slice(2);
const seconds = Number(flag("--seconds") ?? 300);
const from = flag("--from");

const raw = from ? await readFile(from, "utf8") : await record(seconds);
const rows = parse(raw).slice(-MAX_ROWS);

if (rows.length === 0) {
  console.error("一行都没解出来，先看看原始流长什么样");
  process.exit(1);
}

await writeFile(OUT, render(rows), "utf8");
console.log(`${rows.length} 行 → ${OUT}`);

/* ─────────────────────────── 录 ─────────────────────────── */

async function record(secs) {
  const url = new URL("/api/worlds/logs/stream", GATEWAY);
  url.searchParams.set("user_id", USER);
  url.searchParams.set("world_id", WORLD);
  url.searchParams.set("backfill", "true");

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), secs * 1000);
  console.log(`连上 ${url.host}，录 ${secs} 秒…`);

  let text = "";
  try {
    const res = await fetch(url, {
      headers: { accept: "text/event-stream" },
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`网关返回 ${res.status}`);
    for await (const chunk of res.body) {
      text += Buffer.from(chunk).toString("utf8");
    }
  } catch (e) {
    /* 到点自己掐断的，不算错。 */
    if (e?.name !== "AbortError" && abort.signal.reason === undefined) throw e;
  } finally {
    clearTimeout(timer);
  }
  return text;
}

/* ─────────────────────────── 解 ─────────────────────────── */

function parse(text) {
  const out = [];
  for (const block of text.split("\n\n")) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    const row = parseWorldLogLine(data);
    if (row) out.push(row);
  }
  return out;
}

/* ─────────────────────────── 写 ─────────────────────────── */

function render(rows) {
  const span = `${rows[0].at || "?"} – ${rows[rows.length - 1].at || "?"}`;
  const day = new Date().toISOString().slice(0, 10);

  const q = JSON.stringify;
  const body = rows
    .map(
      (r) =>
        `  { at: ${q(r.at)}, op: ${q(r.op)}, note: ${q(r.note)}, kind: ${q(r.kind)} },`,
    )
    .join("\n");

  return `/**
 * 一段真的世界日志 —— 录于 ${day}，覆盖 ${span} 这一段。
 *
 * 「世界一直在算」那张卡的底本。卡上优先滚此刻的流（见 \`world-log-stream.ts\`），
 * 连不上网关时滚这一段：网关在内网、走明文 http，线上那份 demo 够不着它。所以
 * 这张卡在哪儿都滚真的东西，只是不在内网时滚的是过去的某一段。
 *
 * 这个文件是生成的，别手改。要换一段：
 *
 *   node scripts/capture-world-log.mjs --seconds 300
 */

import type { WorldLogRow } from "@/lib/tilia/world-log-line";

export const WORLD_LOG_RECORDING: readonly WorldLogRow[] = [
${body}
];
`;
}

function flag(name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}
