/**
 * 星图连线上的那串字 —— 「世界背面」里，因果的连线不是画出来的，是写出来的。
 *
 * 这一屏正面那三张卡（`world-runtime.ts` 起头）已经说了：世界一直在算。既然在算，那
 * 两枚之间的那根线本来就该是一段正在跑的代码，而不是一根示意的笔画。所以线上
 * 那串字用的是同一套机器语言：`echo.brew`、`chain=3`、`Δ1.2s` —— 和日志里滚过
 * 去的 op 是一个词表，只是被摊到了线上。
 *
 * 字的配比是「远看是一根线，近看是代码」：
 *
 *   多数是 0 和 1 加运算符，负责密度和质感 —— 一整屏一百多条，谁也不会去读，
 *   它们只要连成线；
 *   偶尔嵌一个看得懂的词，负责「这真的是代码」—— 凑近某一条时能认出
 *   `echo.brew`、`+0.03`，那一下才成立。
 *
 * 同一条线每次渲染必须是同一串字：重排一次整张网就要重算一遍，字要是跟着重
 * 掷，满屏的线会一起抖一下。所以取字走的是按线的 id 播种的伪随机（`hash` +
 * `mulberry32`），而不是 `Math.random`。
 */

/**
 * 底噪字符。0 和 1 各占一大截 —— 这是「代码」这件事最短的说法，也让这串字远看
 * 匀，不会有哪个字形突然重一块。剩下的是运算符和括号：它们的笔画细、朝向杂，
 * 混进去像电路上的杂讯。
 *
 * 没有字母 —— 单个字母混在 0/1 里读起来像错别字；成词的字母都放进 `TOKENS`，
 * 整块出现才认得出是词。
 */
const GLYPHS = "0101010110<>/\\|:;=+-*.^~[]{}!?#%&$";

/**
 * 偶尔嵌进去的词。全部来自这个世界自己的日志（见 `world-runtime.ts` 的 op），
 * 所以线上跑的和卡里滚的是同一门语言。
 *
 * 都很短：线是弯的，长词绕过拐角会散架。
 */
const TOKENS: readonly string[] = [
  "echo.brew",
  "cause+",
  "chain=3",
  "+0.03",
  "Δ1.2s",
  "ok",
  "emit",
  "bind",
  "0x1f",
  "::",
  "=>",
  "->",
  "null",
  "gc.keep",
  "tick",
  "p=3",
  "d=1",
  "world.step",
  "link+",
  "hold",
  "fold",
  "seed",
  "&&",
  "true",
  "sync",
  "resolve",
];

/** 嵌词的概率。太密就成了一句话，太疏又只剩 0/1 的噪声，八分之一上下正好。 */
const TOKEN_RATE = 0.12;

/**
 * 给一条线生成 `len` 个字符。
 *
 * `seed` 用线的 id：同一条线永远是同一串字，网重算也不会跟着抖。
 */
export function wireCode(seed: string, len: number): string {
  if (len <= 0) return "";
  const rand = mulberry32(hash(seed));
  let out = "";
  while (out.length < len) {
    if (rand() < TOKEN_RATE) {
      out += TOKENS[Math.floor(rand() * TOKENS.length)];
      // 词后面垫一格，不然它会和后面的 0/1 粘成一坨读不出来。
      out += " ";
    } else {
      out += GLYPHS[Math.floor(rand() * GLYPHS.length)];
    }
  }
  return out.slice(0, len);
}

/** 随便一个底噪字符 —— 线上跑的那些光点用（每跑一段换一个，像在闪）。 */
export function wireGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

/** 字符串 → 32 位种子。 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 小到可以抄进来的伪随机：同一个种子永远同一串。 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
