import { parseWorldLogLine } from "@/lib/tilia/world-log-line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 世界日志网关。内网、明文 http —— 只有在那张网里的机器连得上。 */
const GATEWAY =
  process.env.WORLD_LOG_GATEWAY ?? "http://os-agent-gateway-stag-bj3.srv:8000";

/** 上游连不上要认得快：卡在这儿的话前端只会一直干等。 */
const CONNECT_TIMEOUT_MS = 6000;

/**
 * GET /api/world-logs?user_id=…&world_id=…
 *
 * 「世界背面」第一张卡（世界一直在算）的数据源：把上游那条世界日志 SSE 转成
 * 这一屏能直接显示的行。
 *
 * 为什么要转一手，而不是让浏览器直连上游：
 *
 *   1. 上游没有 CORS 响应头 —— 浏览器连得上、读不了。同源绕过去。
 *   2. 上游一行 world_event 带一两 KB 的 JSON（日程、场景、角色全在里面），
 *      而卡上只显示得下「谁、在哪、干了什么」。就地拆出那三样，剩下的不必
 *      过网、也不必在浏览器里再解一遍。
 *
 * 这个接口在静态导出里不存在（`src/app/api` 整个会被搬走，见
 * scripts/deploy-pages.sh）—— 那时前端拿不到流，第一张卡退回手写的词库接着
 * 滚，见 `lib/tilia/world-log-stream.ts`。
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const upstream = new URL("/api/worlds/logs/stream", GATEWAY);
  upstream.searchParams.set("user_id", q.get("user_id") ?? "");
  upstream.searchParams.set("world_id", q.get("world_id") ?? "");
  /* 一上来先要历史：卡不能开着是空的，世界在你打开之前就已经在算了。 */
  upstream.searchParams.set("backfill", "true");

  /* 客户端走了要连着把上游那条流也掐掉，别在服务端挂着一条没人看的流。 */
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const connectTimer = setTimeout(() => abort.abort(), CONNECT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { accept: "text/event-stream" },
      cache: "no-store",
      signal: abort.signal,
    });
  } catch {
    clearTimeout(connectTimer);
    /* 不在内网 / 网关没起。502 让前端一次认清，退回手写那套。 */
    return new Response("world log gateway unreachable", { status: 502 });
  }
  /* 连上了就撤掉超时：SSE 本来就是要一直开着的。 */
  clearTimeout(connectTimer);

  if (!res.ok || !res.body) {
    return new Response("world log gateway error", { status: 502 });
  }

  return new Response(res.body.pipeThrough(toRows()), {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      /* nginx 之流会缓冲 SSE，缓冲了就不叫流了。 */
      "x-accel-buffering": "no",
    },
  });
}

/**
 * 上游的 SSE 字节流 → 我们这边的一行行 JSON。
 *
 * 按空行切事件（SSE 的分隔就是空行），一个事件里的多条 `data:` 拼回一整行 ——
 * 日志里带换行的（堆栈）就是这么过来的。
 */
function toRows(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";

  return new TransformStream({
    transform(chunk, controller) {
      buf += decoder.decode(chunk, { stream: true });
      let cut: number;
      while ((cut = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const row = parseWorldLogLine(dataOf(block));
        if (row) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(row)}\n\n`));
        }
      }
    },
  });
}

/** 一个 SSE 事件里所有 `data:` 行拼起来。 */
function dataOf(block: string): string {
  const out: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("data:")) out.push(line.slice(5).trimStart());
  }
  return out.join("\n");
}
