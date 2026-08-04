/**
 * 上游那条世界日志，一行长什么样、怎么拆。
 *
 * 单独一个文件是因为两头都要用它：服务端的 `/api/world-logs` 拿它拆行（见
 * `src/app/api/world-logs/route.ts`），前端拿它的类型显示（见
 * `world-log-stream.ts`）。那个 hook 文件带 React，route 里 import 不得。
 */

/** 一行能显示的东西。和卡上那三截对齐：时刻、像代码的、说人话的。 */
export type WorldLogRow = {
  /** HH:MM:SS。 */
  at: string;
  /** 像代码那截。 */
  op: string;
  /** 说人话那半句；机器行就是消息本身。 */
  note: string;
  /** 世界事件比普通日志亮一档 —— 那是真落地的事，不是跑动的痕迹。 */
  kind: "log" | "event";
};

/**
 * 上游一行长这样：
 *
 *   2026-08-04 06:41:46.149 [INFO] [<trace>] [u=… w=…] llm:op_start:14 - llm.call start model=deepseek-v4-pro
 *
 * 拆成时刻、出处（`llm:op_start`）、消息。trace 和 `[u=… w=…]` 不要：一张卡就
 * 那么宽，而这两截每行都一样，占满了眼睛也读不出信息。行号也不要，同理。
 */
const LINE_RE =
  /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2}:\d{2})\.\d+\s+\[\w+\]\s+\[[^\]]*\]\s+\[[^\]]*\]\s+([\w.]+):([\w.]+):\d+\s+-\s+([\s\S]*)$/;

/**
 * 消息开头那种带点的 op（`llm.call`、`soulchat.get_vad`）。
 *
 * 有的话就用它当前面那截：它比出处更贴这一行在干什么（出处是「谁打的日志」，
 * 它是「这一行在说哪件事」）。没有的话别硬拿第一个词充数 —— 「Applied partial
 * replan …」取出来的 `Applied` 不是 op，是半句话被切断了。
 */
const OP_RE = /^([a-z][\w]*(?:\.[\w]+)+)\s*/i;

/**
 * 说人话那半句留多长。
 *
 * 卡片上一行就那么宽，截多少都看不出来；但展开后是折行读全的，留短了就是真的
 * 把话切断。所以按「展开后读得完」定这个数，不按卡宽。
 */
const NOTE_MAX = 240;

export function parseWorldLogLine(raw: string): WorldLogRow | null {
  const line = raw.trim();
  if (line === "") return null;

  const m = LINE_RE.exec(line);
  if (!m) {
    /* 对不上格式的（多行堆栈之类）也别丢：给个空时刻当普通日志过。 */
    return { at: "", op: "log", note: clip(line), kind: "log" };
  }
  const [, at, mod, fn, message] = m;

  const event = parseWorldEvent(message);
  if (event) return { at, ...event, kind: "event" };

  const op = OP_RE.exec(message);
  if (op) {
    return {
      at,
      op: clipOp(op[1]),
      note: clip(message.slice(op[0].length)),
      kind: "log",
    };
  }
  /* 消息里没有 op 的样子，就拿出处顶上，整句留给后面那截。 */
  return { at, op: clipOp(`${mod}.${fn}`), note: clip(message), kind: "log" };
}

/**
 * `[bridge] world_event: {…}` —— 世界里真落了一件事。
 *
 * 那坨 JSON 一两 KB，整行推给前端只会把流水撑爆。这里就地读出「谁、在哪、干了
 * 什么」：那正是这张卡想让人瞥见的东西，其余的字段留在服务端。
 */
function parseWorldEvent(message: string): { op: string; note: string } | null {
  const at = message.indexOf("world_event:");
  if (at === -1) return null;
  const brace = message.indexOf("{", at);
  if (brace === -1) return null;

  try {
    const e = JSON.parse(message.slice(brace)) as {
      event_type?: unknown;
      content?: unknown;
      extra?: { character?: { name?: unknown }; scene?: { name?: unknown } };
    };
    const type = typeof e.event_type === "string" ? e.event_type : "event";
    const who =
      typeof e.extra?.character?.name === "string"
        ? e.extra.character.name
        : "";
    const where =
      typeof e.extra?.scene?.name === "string" ? e.extra.scene.name : "";
    const what = typeof e.content === "string" ? e.content : "";
    /* content 里常常已经带着名字（「绮美郁的日程发生了变更」），别再报一遍。 */
    const name = who && !what.includes(who) ? who : "";
    const note = [where && `@${where}`, name, what].filter(Boolean).join(" ");
    return { op: `world_event.${type}`, note: clip(note) };
  } catch {
    return { op: "world_event", note: clip(message.slice(at)) };
  }
}

/** op 太长就不是 op 了，是一整句。 */
function clipOp(s: string): string {
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
}

function clip(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > NOTE_MAX ? `${one.slice(0, NOTE_MAX - 1)}…` : one;
}
