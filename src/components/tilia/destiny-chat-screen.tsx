"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "@/components/mobile/status-bar";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import {
  getDestinyChatScene,
  type DestinyChatBeat,
  type DestinyChatLine,
  type DestinyChatScene,
} from "@/lib/tilia/destiny-chat";
import {
  buildViolinReplyBeats,
  CONCERT_SUGGESTED_REPLIES,
  mentionsViolin,
  MUSIC_HALL_CONCERT_LOCATION,
} from "@/lib/tilia/music-hall-concert";
import { buildRoomGroupChatScene } from "@/lib/tilia/room-group-chat";

/** 下一条出现前的间隔（按刚出现的上一条类型）。 */
function beatRevealDelayMs(beat: DestinyChatBeat | undefined): number {
  if (!beat) return 560;
  switch (beat.kind) {
    case "prologue":
      return 1100;
    case "time":
    case "system":
      return 650;
    case "narration":
      return 950;
    case "bubble":
      return 1300;
    // 回指卡要留出读三行的时间。
    case "trace":
      return 2200;
    default:
      return 800;
  }
}

/**
 * 命运聊天页 —— Figma 单聊 `5668:70557` / 群聊 `5668:70165`。
 *
 * 带 `scene.sequential` 的桥段（音乐厅夜场 / 茶室赠琴 / 巡警检查 /
 * 驾驶室）：脚本与接话均逐条出现，不一次铺开。
 */
export function DestinyChatScreen({
  location,
  onBack,
}: {
  location: string;
  onBack?: () => void;
}) {
  const { finishDestinyVisit } = useStoryFlags();
  // 静态命运场景是模块常量；地点群聊才临时 build，必须 memo。
  const scene = useMemo(
    () => getDestinyChatScene(location) ?? buildRoomGroupChatScene(location),
    [location],
  );

  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<DestinyChatBeat[]>([]);
  const [pendingExtra, setPendingExtra] = useState<DestinyChatBeat[]>([]);
  const [violinMentioned, setViolinMentioned] = useState(false);
  const [scriptRevealed, setScriptRevealed] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isConcert = location === MUSIC_HALL_CONCERT_LOCATION;
  // 由场景自己声明（`sequential`），新桥段不用再回来登记一遍地点。
  const sequential = scene?.sequential === true;
  const beatCount = scene?.beats.length ?? 0;

  // 只跟 location / 是否逐条走，避免 scene 引用变化引发无限 reset。
  useEffect(() => {
    setExtra([]);
    setPendingExtra([]);
    setViolinMentioned(false);
    setDraft("");
    setScriptRevealed(sequential ? 0 : beatCount);
  }, [location, sequential, beatCount]);

  useEffect(() => {
    if (!scene || !sequential) return;
    if (scriptRevealed >= beatCount) return;

    const wait =
      scriptRevealed === 0
        ? 420
        : beatRevealDelayMs(scene.beats[scriptRevealed - 1]);
    const t = setTimeout(() => {
      setScriptRevealed((n) => n + 1);
    }, wait);
    return () => clearTimeout(t);
  }, [scene, sequential, scriptRevealed, beatCount]);

  // 接话队列逐条揭开（只跟队头走，避免因 extra 更新重置计时）。
  useEffect(() => {
    if (!sequential || pendingExtra.length === 0) return;
    const head = pendingExtra[0]!;
    const t = setTimeout(() => {
      setExtra((prev) => [...prev, head]);
      setPendingExtra((prev) => prev.slice(1));
    }, beatRevealDelayMs(head));
    return () => clearTimeout(t);
  }, [sequential, pendingExtra]);

  const scriptDone =
    !scene || !sequential || scriptRevealed >= scene.beats.length;
  const revealing = sequential && (!scriptDone || pendingExtra.length > 0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scriptRevealed, extra.length, pendingExtra.length]);

  if (!scene) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white/70">
        未找到命运场景
      </div>
    );
  }

  const appendPlayerLine = (text: string) => {
    if (sequential && (!scriptDone || pendingExtra.length > 0)) return;

    const stamp = Date.now();
    const me: DestinyChatBeat = {
      id: `me-${stamp}`,
      kind: "bubble",
      speaker: "你",
      avatarSrc: "/figma/tilia/avatar-you-art.png",
      avatarColor: "#8b7aff",
      lines: [{ tone: "dialogue", text }],
    };

    setExtra((prev) => [...prev, me]);

    if (isConcert && mentionsViolin(text) && !violinMentioned) {
      setViolinMentioned(true);
      setPendingExtra([...buildViolinReplyBeats(stamp)]);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    appendPlayerLine(text);
    setDraft("");
  };

  const handleBack = () => {
    // 潜在命运退出后清除地图入口；音乐会另落下小提琴。
    finishDestinyVisit();
    onBack?.();
  };

  const visibleScript = sequential
    ? scene.beats.slice(0, scriptRevealed)
    : scene.beats;
  const beats = [...visibleScript, ...extra];
  const solo = scene.variant === "solo";
  const prologue = scene.beats.find(
    (b): b is Extract<DestinyChatBeat, { kind: "prologue" }> =>
      b.kind === "prologue",
  );
  const soloTitle = prologue?.title;
  const showConcertHints =
    isConcert &&
    scriptDone &&
    !violinMentioned &&
    pendingExtra.length === 0 &&
    CONCERT_SUGGESTED_REPLIES.length > 0;
  const inputLocked = sequential && (!scriptDone || pendingExtra.length > 0);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Image
        src={scene.backgroundSrc}
        alt=""
        fill
        priority
        sizes="375px"
        className={
          solo
            ? "object-cover object-[center_12%]"
            : "object-cover object-center"
        }
      />
      <div
        className={`absolute inset-0 ${
          solo
            ? "bg-gradient-to-b from-black/25 via-black/35 to-black/55"
            : "bg-black/40"
        }`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[192px] bg-gradient-to-b from-[rgba(16,21,25,0.5)] via-[rgba(16,21,25,0.25)] to-transparent" />

      <div className="absolute inset-x-0 top-0 z-30">
        <StatusBar tone="light" />
      </div>

      <Header scene={scene} onBack={handleBack} />

      <div
        ref={listRef}
        className={`absolute inset-x-0 z-10 overflow-y-auto overscroll-contain px-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          solo
            ? "bottom-[148px] top-[108px] flex flex-col justify-end"
            : showConcertHints
              ? "bottom-[168px] top-[140px]"
              : "bottom-[120px] top-[140px]"
        }`}
      >
        <div
          className={`flex w-full flex-col ${
            solo ? "items-stretch justify-end gap-[12px]" : "gap-[16px] pb-[8px]"
          }`}
        >
          {beats.map((b, i) => {
            const firstBubble =
              solo &&
              b.kind === "bubble" &&
              beats.findIndex((x) => x.kind === "bubble") === i;
            return (
              <div
                key={b.id}
                className={
                  sequential
                    ? "motion-safe:animate-[livo-chat-beat-in_380ms_ease-out]"
                    : undefined
                }
              >
                <BeatView
                  beat={b}
                  variant={scene.variant}
                  destinyKind={scene.destinyKind ?? "destined"}
                  soloTitle={firstBubble ? soloTitle : undefined}
                  prologueBody={firstBubble ? prologue?.body : undefined}
                />
              </div>
            );
          })}
          {!solo && revealing ? (
            <div className="flex justify-start motion-safe:animate-[livo-chat-beat-in_280ms_ease-out]">
              <span className="inline-flex h-[40px] items-center rounded-tl-[16px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[6px] bg-white/10 px-[22px] backdrop-blur-[20px]">
                <Image
                  src="/figma/tilia/destiny-chat/typing-dots.svg"
                  alt=""
                  width={26}
                  height={6}
                  className="opacity-80"
                />
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {solo ? (
        <div className="absolute bottom-[118px] right-[12px] z-20 flex flex-col items-center gap-[28px] rounded-[24px] bg-[rgba(16,21,25,0.1)] px-[10px] py-[14px] backdrop-blur-[20px]">
          <Image
            src="/figma/tilia/destiny-chat/icon-continue.svg"
            alt=""
            width={15}
            height={15}
          />
          <Image
            src="/figma/tilia/destiny-chat/icon-lamp.svg"
            alt=""
            width={15}
            height={15}
          />
        </div>
      ) : null}

      {solo ? (
        <div className="absolute bottom-[72px] left-1/2 z-20 flex -translate-x-1/2 items-start gap-[12px]">
          <span className="relative flex h-[38px] w-[86px] items-center gap-[4px] rounded-full border-[0.25px] border-white bg-white/10 pl-[6px] pr-[10px] backdrop-blur-[50px]">
            <span className="relative size-[25px] overflow-hidden rounded-full">
              <Image
                src="/figma/tilia/destiny-chat/mood-ring.svg"
                alt=""
                fill
                className="object-cover"
              />
            </span>
            <span className="text-[13px] font-medium text-[#8be4ff]">
              {scene.moodLabel ?? "平静"}
            </span>
          </span>
          <span className="flex size-[38px] items-center justify-center rounded-full border-[0.25px] border-white bg-white/10 backdrop-blur-[50px]">
            <Image
              src="/figma/tilia/destiny-chat/butterfly-white.svg"
              alt=""
              width={20}
              height={20}
            />
          </span>
        </div>
      ) : null}

      {showConcertHints ? (
        <div className="absolute inset-x-0 bottom-[84px] z-20 flex gap-[8px] overflow-x-auto px-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CONCERT_SUGGESTED_REPLIES.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => appendPlayerLine(hint)}
              className="shrink-0 rounded-full border border-white/25 bg-white/15 px-[12px] py-[7px] text-[12px] font-medium text-white backdrop-blur-[16px]"
            >
              {hint}
            </button>
          ))}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-[24px] z-20 flex justify-center px-[12px]">
        <div className="relative flex h-[48px] w-full max-w-[351px] items-center rounded-[32px] bg-white/30 px-[14px] backdrop-blur-[20px]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={inputLocked}
            placeholder={
              inputLocked ? "命运线正在展开…" : scene.inputPlaceholder
            }
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/60 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

function Header({
  scene,
  onBack,
}: {
  scene: DestinyChatScene;
  onBack?: () => void;
}) {
  const solo = scene.variant === "solo";

  return (
    <div className="absolute inset-x-0 top-[53px] z-30 px-[12px]">
      <div className="flex h-[48px] items-center justify-between gap-[8px]">
        <div className="flex min-w-0 items-center gap-[6px]">
          <button
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="relative size-[24px] shrink-0"
          >
            <Image
              src="/figma/tilia/destiny-chat/icon-back-a.svg"
              alt=""
              width={8}
              height={8}
              className="absolute left-[8px] top-[5px]"
            />
            <Image
              src="/figma/tilia/destiny-chat/icon-back-b.svg"
              alt=""
              width={8}
              height={8}
              className="absolute left-[8px] top-[12px]"
            />
          </button>

          {solo ? (
            <div className="flex min-w-0 items-center gap-[3px]">
              {scene.leadAvatarSrc ? (
                <span className="relative size-[32px] shrink-0 overflow-hidden rounded-full border border-white/30">
                  <Image
                    src={scene.leadAvatarSrc}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover object-top"
                  />
                </span>
              ) : null}
              <p className="truncate text-[14px] font-semibold leading-[1.2] text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
                {scene.title}
              </p>
              {scene.subtitle ? (
                <>
                  <span className="size-[2px] rounded-full bg-white/70" />
                  <p className="truncate text-[12px] text-white/85">
                    {scene.subtitle}
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-[17px] font-medium text-white">{scene.title}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-[8px]">
          {solo ? (
            <span className="inline-flex items-center gap-px rounded-full bg-[rgba(7,9,16,0.1)] py-[2px] pl-[4px] pr-[6px] backdrop-blur-[20px]">
              <Image
                src="/figma/tilia/destiny-chat/icon-location.svg"
                alt=""
                width={12}
                height={12}
              />
              <span className="text-[10px] text-white">{scene.venue}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-[2px] rounded-full bg-[rgba(7,9,16,0.1)] py-[2px] pl-[4px] pr-[6px] backdrop-blur-[20px]">
              <Image
                src="/figma/tilia/destiny-chat/icon-location.svg"
                alt=""
                width={12}
                height={12}
              />
              <span className="text-[10px] text-white">{scene.venue}</span>
            </span>
          )}
          <Image
            src="/figma/tilia/destiny-chat/icon-sound.svg"
            alt=""
            width={28}
            height={28}
          />
        </div>
      </div>

      {!solo && scene.members ? (
        <div className="mt-[4px] flex gap-[4px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {scene.members.map((m) => (
            <span
              key={m.name}
              className="inline-flex h-[29px] shrink-0 items-center gap-[6px] rounded-full bg-black/20 py-0 pl-[2.5px] pr-[12px] backdrop-blur-[20px]"
            >
              <span
                className="relative size-[23px] overflow-hidden rounded-full"
                style={
                  m.avatarSrc
                    ? undefined
                    : { backgroundColor: m.avatarColor ?? "#666" }
                }
              >
                {m.avatarSrc ? (
                  <Image
                    src={m.avatarSrc}
                    alt=""
                    fill
                    sizes="23px"
                    className="object-cover object-top"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-[10px] text-white">
                    {m.name.slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold text-white">
                {m.name}
                {m.tag ? (
                  <span className="font-normal text-white/50"> {m.tag}</span>
                ) : null}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BeatView({
  beat,
  variant,
  destinyKind = "destined",
  soloTitle,
  prologueBody,
}: {
  beat: DestinyChatBeat;
  variant: DestinyChatScene["variant"];
  destinyKind?: DestinyChatScene["destinyKind"];
  soloTitle?: string;
  prologueBody?: string;
}) {
  const potential = destinyKind === "potential";

  if (beat.kind === "prologue") {
    if (variant === "solo") return null;
    return (
      <div className="w-full rounded-[16px] bg-white/70 px-[12px] py-[10px] backdrop-blur-[20px]">
        <div className="mb-[2px] flex items-center gap-[6px]">
          <Image
            src={
              potential
                ? "/figma/tilia/destiny/butterfly-potential.svg"
                : "/figma/tilia/destiny-chat/group-butterfly.svg"
            }
            alt=""
            width={18}
            height={18}
          />
          <p className="text-[13px] font-semibold leading-[1.5] text-[#070910]">
            {beat.title}
          </p>
        </div>
        <p className="text-[13px] leading-[1.5] text-[rgba(16,21,25,0.6)]">
          {beat.body}
        </p>
      </div>
    );
  }

  if (beat.kind === "time" || beat.kind === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-white/10 px-[8px] py-px text-[11px] text-[#f5f5f5] backdrop-blur-[20px]">
          {beat.text}
        </span>
      </div>
    );
  }

  if (beat.kind === "narration") {
    return (
      <p className="w-full text-[12px] leading-[1.5] text-white/80">{beat.text}</p>
    );
  }

  if (beat.kind === "trace") {
    const last = beat.items.length - 1;
    return (
      <div className="w-full rounded-[16px] border border-white/15 bg-black/35 px-[12px] py-[11px] backdrop-blur-[20px]">
        <div className="mb-[9px] flex items-center gap-[6px]">
          <Image
            src="/figma/tilia/destiny/butterfly-potential.svg"
            alt=""
            width={16}
            height={16}
          />
          <p className="text-[12px] font-medium leading-none text-white/85">
            {beat.title}
          </p>
        </div>
        <ol className="flex flex-col gap-[9px]">
          {beat.items.map((item, i) => (
            <li key={item.when} className="flex items-stretch gap-[8px]">
              <span className="flex w-[5px] flex-col items-center pt-[5px]">
                <span className="size-[5px] shrink-0 rounded-full bg-[#8ec2ff]" />
                {i < last ? (
                  <span className="mt-[3px] w-px flex-1 bg-white/15" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 pb-px">
                <span className="block text-[10px] leading-[1.4] text-white/40">
                  {item.when}
                </span>
                <span className="block text-[12px] leading-[1.5] text-white/75">
                  {item.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (variant === "solo") {
    const lines =
      soloTitle && prologueBody
        ? ([{ tone: "narration" as const, text: prologueBody }, ...beat.lines] as const)
        : beat.lines;
    return (
      <div className="relative mr-[52px] w-full max-w-[315px] rounded-tl-[16px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[6px] bg-white/80 px-[12px] py-[10px] backdrop-blur-[20px]">
        {soloTitle ? (
          <div className="mb-[2px] flex items-center gap-[6px]">
            <Image
              src={
                potential
                  ? "/figma/tilia/destiny/butterfly-potential.svg"
                  : "/figma/tilia/destiny-chat/butterfly-pink.svg"
              }
              alt=""
              width={18}
              height={18}
            />
            <p className="text-[13px] leading-[1.5] text-[rgba(16,21,25,0.6)]">
              {soloTitle}
            </p>
          </div>
        ) : null}
        <Lines lines={lines} />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-[8px]">
      <span
        className="relative size-[40px] shrink-0 overflow-hidden rounded-full"
        style={
          beat.avatarSrc
            ? undefined
            : { backgroundColor: beat.avatarColor ?? "#5a6a7a" }
        }
      >
        {beat.avatarSrc ? (
          <Image
            src={beat.avatarSrc}
            alt=""
            fill
            sizes="40px"
            className="object-cover object-top"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-[14px] text-white">
            {beat.speaker.slice(0, 1)}
          </span>
        )}
      </span>
      <div className="max-w-[260px] rounded-tl-[6px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] bg-white/70 p-[12px] backdrop-blur-[20px]">
        <Lines lines={beat.lines} />
      </div>
    </div>
  );
}

function Lines({ lines }: { lines: readonly DestinyChatLine[] }) {
  return (
    <div className="flex flex-col gap-[5px]">
      {lines.map((l, i) => (
        <p
          key={`${i}-${l.text.slice(0, 8)}`}
          className={`text-[13px] leading-[1.5] ${
            l.tone === "dialogue"
              ? "font-medium text-[#222]"
              : "font-normal text-[rgba(16,21,25,0.6)]"
          }`}
        >
          {l.text}
        </p>
      ))}
    </div>
  );
}
