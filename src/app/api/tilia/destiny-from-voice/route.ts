import { NextResponse } from "next/server";
import {
  generateDestinyImpactLocal,
  type DestinyImpactDraft,
} from "@/lib/tilia/destiny-from-voice";
import { TILIA_CAST } from "@/lib/tilia/cast";
import { isConcertRespondVoice } from "@/lib/tilia/music-hall-concert";
import { isRoomGated, ROOMS } from "@/lib/tilia/train";

export const runtime = "nodejs";

type Body = {
  voiceText?: string;
  occupiedMemberIds?: string[];
};

const LEAD_IDS = TILIA_CAST.filter((c) => c.role === "lead").map((c) => c.id);
/** 只给模型已经存在的车厢，别让它把命运挪进还没被说出来的那一节。 */
const ROOM_IDS = ROOMS.filter((r) => !isRoomGated(r)).map((r) => r.id);

/**
 * POST /api/tilia/destiny-from-voice
 *
 * 冷却酝酿用：根据用户发送内容生成命运故事。
 * 「听音乐会」走固定脚本；其余类型与落点随机，故事优先大模型。
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const voiceText = body.voiceText?.trim() ?? "";
  if (!voiceText) {
    return NextResponse.json({ error: "voiceText required" }, { status: 400 });
  }

  const occupied = new Set(body.occupiedMemberIds ?? []);
  const seed = generateDestinyImpactLocal(voiceText, occupied);

  // 脚本桥段不走 LLM，避免改掉房间 / 进聊 key。
  if (isConcertRespondVoice(voiceText) || seed.scriptId) {
    return NextResponse.json({
      ...seed,
      source: "script" as const,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ...seed,
      source: "local" as const,
    });
  }

  try {
    const llm = await generateWithOpenAI(voiceText, seed, apiKey);
    return NextResponse.json({ ...llm, source: "llm" as const });
  } catch {
    return NextResponse.json({
      ...seed,
      source: "local-fallback" as const,
    });
  }
}

async function generateWithOpenAI(
  voiceText: string,
  seed: DestinyImpactDraft,
  apiKey: string,
): Promise<DestinyImpactDraft> {
  const base =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ??
    "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const kindLabel = seed.kind === "destined" ? "注定命运" : "潜在命运";

  const system = `你是《蒂利亚之冬》「和平号」列车世界的叙事助手。
用户以角色身份对世界说了一句话或做了一件事。请根据这句话，写一段因此产生的「${kindLabel}」短故事。

硬性要求：
1. title：地图胶囊短标题，4–8 个汉字，是新事件名，绝不能照搬或截取用户原话。
2. storyTitle：半层大标题，格式必须是「${seed.kind === "destined" ? "注定" : "潜在"}·短名」。
3. prologue：2–4 句中文。可点出用户那句话，但重点写世界/角色因此发生的变化与命运感。
   - 注定命运：更有不可回避、轨道已定的压迫感。
   - 潜在命运：更有分叉、尚未写定、轻轻一碰就会偏轨的感觉。
4. memberId 必须是以下之一：${LEAD_IDS.join(" | ")}（可改，但必须合法）。
5. roomId 必须是以下之一：${ROOM_IDS.join(" | ")}（可改，但必须合法）。
6. kind、xPct、yPct 必须与种子完全一致，不要改。
7. 真实感底线：不要写成世界凭空造出了人、物或地方（「话音一落就多出一间房」
   「它一个钟头前还不在那里」这类都不行，很假）。新出现的东西必须本来就在这
   趟车上，只是先前没人提、没开放、或你没有理由去；变的是谁开了口、谁动了
   手、谁替你开了门 —— 因果留住，别把世界写成随口变出东西的魔术。
只输出 JSON，不要 markdown。字段：title, storyTitle, prologue, memberId, roomId, kind, xPct, yPct。`;

  const user = `用户原话：${voiceText}

已随机确定的类型与落点（勿改）：
kind=${seed.kind}, xPct=${seed.xPct.toFixed(4)}, yPct=${seed.yPct.toFixed(4)}

种子参考（标题与正文请按用户原话重新创作，不必沿用）：
${JSON.stringify({
    memberId: seed.memberId,
    roomId: seed.roomId,
    title: seed.title,
  })}`;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`openai ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw) as Partial<DestinyImpactDraft>;

  const memberId =
    parsed.memberId && LEAD_IDS.includes(parsed.memberId)
      ? parsed.memberId
      : seed.memberId;
  const roomId =
    parsed.roomId && ROOM_IDS.includes(parsed.roomId)
      ? parsed.roomId
      : seed.roomId;

  const title = (parsed.title ?? seed.title).slice(0, 12);
  const prefix = seed.kind === "destined" ? "注定" : "潜在";
  let storyTitle = parsed.storyTitle ?? `${prefix}·${title}`;
  if (!storyTitle.startsWith(`${prefix}·`)) {
    storyTitle = `${prefix}·${title}`;
  }

  return {
    kind: seed.kind,
    title,
    storyTitle,
    prologue: parsed.prologue ?? seed.prologue,
    memberId,
    roomId,
    xPct: seed.xPct,
    yPct: seed.yPct,
  };
}
