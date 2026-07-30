"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  InviteCharacterSheet,
  INVITE_CANDIDATES,
  type InviteStatus,
} from "@/components/chat/invite-character-sheet";
import {
  getChatScene,
  sceneBackgroundStyle,
  type ChatMessage,
  type SceneMember,
} from "@/lib/chat-scenes";
import {
  appendMessages,
  endEvent,
  startEvent,
  useLocationChatState,
} from "@/lib/chat-store";
import { getMapEvent } from "@/lib/map-events";

/**
 * Unified chat surface that handles both 自由聊天 and 事件聊天.
 *
 * Per the 2026-04-28 spec, free chat and event chat now share a single
 * window. Differences boil down to two mode flags:
 *
 *   • Header subtitle pill — "自由聊天" vs "事件：{title}".
 *   • Right-side 邀请角色 button — only visible in free mode.
 *   • A pinned event-info card surfaces above the message list when
 *     mode === "event" so the situation context stays in view.
 *
 * Persistence rules (see `chat-store.ts`):
 *   • Messages are stored module-globally per location, so leaving and
 *     re-entering the chat preserves history. Seed messages and the
 *     "你来到X" arrival notice only emit on first init.
 *   • Entering event mode calls startEvent(); the back-button path
 *     fires endEvent() which appends "事件{title}已结束" so the next
 *     visit (in either mode) reads the closure as part of history.
 */
export function ChatScreen({
  location,
  mode = "free",
  onBack,
}: {
  location: string;
  /** "free" = 自由聊天 (default). "event" = 事件聊天. */
  mode?: "free" | "event";
  /**
   * Override for the header back button. When rendered as an
   * intercepted modal we want the back tap to trigger the modal's
   * outgoing slide first, then navigate — `ChatModal`/`EventModal`
   * pass a handler that does exactly that. Falls back to
   * `router.back()` for the standalone route.
   */
  onBack?: () => void;
}) {
  const router = useRouter();
  const scene = getChatScene(location);
  // Memoize so the object identity is stable across renders. Without
  // this `getMapEvent` returns a fresh object every render, which
  // makes any effect that depends on `event` re-run on every render
  // — and the lifecycle effect below is exactly that shape, so an
  // unstable `event` would cause an endEvent → startEvent → endEvent
  // loop and crash the page with infinite system-message appends.
  const event = useMemo(
    () => (mode === "event" ? getMapEvent(location) : null),
    [mode, location],
  );
  const handleBack = onBack ?? (() => router.back());

  const { messages } = useLocationChatState(location);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // ── Event session lifecycle ────────────────────────────────────────
  // Entering an event opens a session; closing the chat (modal back,
  // route exit, or natural unmount) fires the matching endEvent which
  // writes the "事件{title}已结束" system row into history. Deps are
  // a stable primitive (`eventTitle`) — depending on `event` itself
  // would re-run the effect every render and infinite-loop the store.
  const eventTitle = event?.title ?? null;
  useEffect(() => {
    if (mode !== "event" || !eventTitle) return;
    startEvent(location, eventTitle);
    return () => {
      endEvent(location);
    };
  }, [mode, location, eventTitle]);

  // ── Invite-character flow (free chat only) ─────────────────────────
  // Local-only state — invite/decline statuses, joined-this-session
  // members rail extras, decline cool-downs. The system messages
  // these flows generate are written through appendMessages() so
  // they persist into the shared chat-store.
  const [inviteOpen, setInviteOpen] = useState(false);
  const sceneMemberNames = useMemo(
    () => new Set(scene.members.map((m) => m.name)),
    [scene.members],
  );
  const [inviteStatuses, setInviteStatuses] = useState<
    Record<string, InviteStatus>
  >(() =>
    INVITE_CANDIDATES.reduce<Record<string, InviteStatus>>((acc, c) => {
      acc[c.name] = sceneMemberNames.has(c.name) ? "present" : "invite";
      return acc;
    }, {}),
  );
  const [extraMembers, setExtraMembers] = useState<SceneMember[]>([]);
  const [declineCooldown, setDeclineCooldown] = useState<
    Record<string, number>
  >({});

  const handleInvite = (name: string) => {
    setInviteStatuses((prev) => ({ ...prev, [name]: "inviting" }));
    const accepted = Math.random() < 0.6;
    window.setTimeout(() => {
      setInviteStatuses((prev) => ({
        ...prev,
        [name]: accepted ? "present" : "declined",
      }));
      if (!accepted) {
        // 30s decline cool-down, then flip back to 邀请 unless the
        // status has been changed externally in the meantime.
        const COOLDOWN_MS = 30_000;
        const unlockAt = Date.now() + COOLDOWN_MS;
        setDeclineCooldown((prev) => ({ ...prev, [name]: unlockAt }));
        window.setTimeout(() => {
          setInviteStatuses((prev) =>
            prev[name] === "declined" ? { ...prev, [name]: "invite" } : prev,
          );
          setDeclineCooldown((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
        }, COOLDOWN_MS);
        return;
      }

      const c = INVITE_CANDIDATES.find((x) => x.name === name);
      if (!c) return;
      setExtraMembers((prev) =>
        prev.some((m) => m.name === name)
          ? prev
          : [...prev, { name, avatarSrc: c.avatarSrc }],
      );
      appendMessages(location, {
        id: `sys-arrive-${name}-${Date.now()}`,
        isSystem: true,
        text: `${name}来到${scene.location}`,
      });

      const leaveAfter = 25_000 + Math.random() * 20_000;
      window.setTimeout(() => {
        setExtraMembers((prev) => prev.filter((m) => m.name !== name));
        setInviteStatuses((prev) => ({ ...prev, [name]: "invite" }));
        appendMessages(location, {
          id: `sys-leave-${name}-${Date.now()}`,
          isSystem: true,
          text: `${name}已离开${scene.location}`,
        });
      }, leaveAfter);
    }, 2400);
  };

  // Members rail content. Free chat merges in friends who joined via
  // invite this session; event chat is fixed to the scene roster.
  const allMembers = useMemo(
    () =>
      mode === "free" ? [...scene.members, ...extraMembers] : scene.members,
    [mode, scene.members, extraMembers],
  );

  // Auto-scroll to the latest message — runs on every change, not
  // just sends, so persisted system rows from end-event also land at
  // the bottom on remount.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    appendMessages(location, {
      id: `me-${messages.length}-${Date.now()}`,
      speaker: "陈昔",
      avatarSrc: null,
      avatarColor: "#8b7aff",
      tag: "(你)",
      text,
      isSelf: true,
    });
    setDraft("");
  };

  const subtitle = event ? `事件：${event.title}` : "自由聊天";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Scene backdrop. The location-driven gradient + soft dim layer
       *  read identically in both modes — only the top header bar
       *  differs visually between free and event. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={sceneBackgroundStyle(scene.scene)}
      />
      <div aria-hidden className="absolute inset-0 bg-black/20" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Frosted top — covers the status bar AND header so the iOS-y
       *  white blur reads as one continuous bar (Figma 1571:4331 /
       *  1571:5684). The actual interactive header content sits at
       *  top-44 inside this band; the status bar overlay is rendered
       *  by the modal/page wrapper at z-30 with `tone="dark"`. */}
      <div className="absolute inset-x-0 top-0 z-10 h-[92px] bg-white/80 backdrop-blur-[8px]" />

      {/* Header (Figma 1571:5698 / 1571:5699): main title = location,
       *  subtitle pill = "自由聊天" or "事件：{title}", invite icon on
       *  the right (free only). Black on the white frosted band. */}
      <div className="absolute inset-x-0 top-[44px] z-20 flex h-[48px] items-center justify-between gap-[8px] px-[16px]">
        <div className="flex min-w-0 flex-1 items-center gap-[10px]">
          <button
            type="button"
            aria-label="返回"
            onClick={handleBack}
            className="-ml-[6px] inline-flex size-[32px] shrink-0 items-center justify-center rounded-full text-black transition-transform active:scale-95"
          >
            <BackIcon />
          </button>

          <h1
            className="truncate text-[17px] font-medium leading-[1.2] text-black"
            style={{
              fontFamily:
                '"Heiti SC", "PingFang SC", system-ui, sans-serif',
            }}
          >
            {scene.location}
          </h1>
          <span
            className="inline-flex shrink-0 items-center gap-[4px] rounded-full bg-black/[0.05] px-[10px] py-[4px] text-[11px] font-light leading-none text-black backdrop-blur-[4px]"
            style={{
              fontFamily:
                '"Heiti SC", "PingFang SC", system-ui, sans-serif',
            }}
          >
            {subtitle}
          </span>
        </div>

        {mode === "free" ? (
          <button
            type="button"
            aria-label="邀请角色"
            aria-haspopup="dialog"
            aria-expanded={inviteOpen}
            onClick={() => setInviteOpen(true)}
            className="-mr-[4px] inline-flex size-[32px] shrink-0 items-center justify-center rounded-full text-black transition-transform active:scale-95"
          >
            <AddPersonIcon />
          </button>
        ) : null}
      </div>

      {/* Members rail. Translucent dark band so it visually separates
       *  from the white frosted header above. */}
      <div className="absolute inset-x-0 top-[92px] z-10 overflow-x-auto border-b border-white/10 bg-black/15 backdrop-blur-[6px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-[16px] py-[10px] pl-[16px]">
          {allMembers.map((m) => (
            <MemberChip key={m.name} member={m} />
          ))}
          <span aria-hidden className="block h-px w-[16px] shrink-0" />
        </div>
      </div>

      {/* Messages list. Event mode shows the EventInfoCard pinned to
       *  the top of the scroll area for situation context; the card
       *  scrolls with the rest of the feed (not sticky) so a busy
       *  conversation can scroll past it. */}
      <div
        ref={listRef}
        className="absolute inset-x-0 bottom-[68px] top-[148px] overflow-y-auto px-[16px] pb-[12px] pt-[16px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {event ? (
          <div className="mb-[16px]">
            <EventInfoCard
              venue={event.venue}
              description={event.description}
              participants={event.participants}
            />
          </div>
        ) : null}

        <ul className="flex flex-col gap-[16px]">
          {messages.map((m) => (
            <MessageRow key={m.id} m={m} />
          ))}
        </ul>
      </div>

      {/* Composer. Single pill; send button only appears once draft
       *  is non-empty so the empty state stays clean. */}
      <div className="absolute inset-x-[12px] bottom-[12px] z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex h-[44px] items-center gap-[8px] rounded-[22px] bg-white/95 px-[16px] shadow-[0_6px_16px_-4px_rgba(0,0,0,0.25)] backdrop-blur-[10px]"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="说点什么..."
            className="h-full flex-1 bg-transparent text-[14px] font-light text-black placeholder:text-black/40 focus:outline-none"
          />
          {draft.trim() ? (
            <button
              type="submit"
              className="inline-flex h-[30px] shrink-0 items-center rounded-[15px] bg-[#ff7070] px-[12px] text-[13px] font-medium text-white transition-transform active:scale-95"
            >
              发送
            </button>
          ) : null}
        </form>
      </div>

      {mode === "free" ? (
        <InviteCharacterSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          statuses={inviteStatuses}
          declineCooldown={declineCooldown}
          onInvite={handleInvite}
        />
      ) : null}
    </div>
  );
}

// ─── Members rail chip ───────────────────────────────────────────────

function MemberChip({ member }: { member: SceneMember }) {
  return (
    <div className="flex shrink-0 items-center gap-[8px]">
      <MemberAvatar member={member} size={34} />
      <span className="whitespace-nowrap text-[13px] font-light text-white">
        {member.name}
        {member.tag ? (
          <span className="text-white/60">{member.tag}</span>
        ) : null}
      </span>
    </div>
  );
}

function MemberAvatar({
  member,
  size,
}: {
  member: SceneMember;
  size: number;
}) {
  if (member.avatarSrc) {
    return (
      <div
        className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-white/80"
        style={{ width: size, height: size }}
      >
        <Image
          src={member.avatarSrc}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: member.avatarColor ?? "#8b7aff",
      }}
    />
  );
}

// ─── Pinned event info card (event mode only) ────────────────────────

function EventInfoCard({
  venue,
  description,
  participants,
}: {
  venue: string;
  description: string;
  participants: ReturnType<typeof getMapEvent>["participants"];
}) {
  return (
    <div className="rounded-[16px] bg-white px-[14px] py-[12px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="inline-flex items-center gap-[4px] rounded-full bg-[#0ba43c] px-[10px] py-[4px] text-[11px] font-medium leading-none text-white">
          <span aria-hidden>☀️</span>
          <span>日常事件</span>
        </span>
        <span className="inline-flex items-center gap-[4px] rounded-full bg-black/[0.05] px-[10px] py-[4px] text-[11px] leading-none text-black/75">
          <Image
            src="/figma/map/poi-pin.svg"
            alt=""
            width={12}
            height={12}
          />
          <span>{venue}</span>
        </span>
      </div>

      <p className="mt-[10px] text-[13px] leading-[1.55] text-black/80">
        {description}
      </p>

      <div className="mt-[12px] flex flex-wrap items-center gap-x-[14px] gap-y-[8px]">
        {participants.map((p) => (
          <div key={p.name} className="flex items-center gap-[6px]">
            <span
              className="relative flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
              style={
                p.avatarSrc
                  ? undefined
                  : { backgroundColor: p.fallbackColor ?? "#8b7aff" }
              }
            >
              {p.avatarSrc ? (
                <Image
                  src={p.avatarSrc}
                  alt=""
                  fill
                  sizes="26px"
                  className="object-cover"
                />
              ) : (
                <span className="text-[11px] font-medium text-white">
                  {p.name.slice(0, 1)}
                </span>
              )}
            </span>
            <span className="text-[12px] leading-none text-black/80">
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Message row ─────────────────────────────────────────────────────

function MessageRow({ m }: { m: ChatMessage }) {
  if (m.isSystem) {
    return (
      <li className="list-none">
        <div className="flex items-center justify-center gap-[10px] text-[12px] font-light leading-[1.5] text-white/80">
          <span aria-hidden>——</span>
          <span className="whitespace-nowrap">{m.text}</span>
          <span aria-hidden>——</span>
        </div>
      </li>
    );
  }

  const avatar = (
    <MemberAvatar
      member={{
        name: m.speaker ?? "",
        avatarSrc: m.avatarSrc ?? null,
        avatarColor: m.avatarColor,
        tag: m.tag,
      }}
      size={36}
    />
  );

  const nameLabel = (
    <span
      className="text-[12px] font-light leading-none text-white"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {m.speaker}
      {m.tag ? <span className="text-white/70">{m.tag}</span> : null}
    </span>
  );

  if (m.isSelf) {
    return (
      <li className="flex items-start justify-end gap-[10px]">
        <div className="flex min-w-0 max-w-[72%] flex-col items-end gap-[4px]">
          {nameLabel}
          <div className="rounded-[16px] rounded-tr-[6px] bg-[#ff7070] px-[14px] py-[10px] text-[13px] leading-[1.4] text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.25)]">
            {m.text}
          </div>
        </div>
        {avatar}
      </li>
    );
  }

  return (
    <li className="flex items-start gap-[10px]">
      {avatar}
      <div className="flex min-w-0 max-w-[72%] flex-col items-start gap-[4px]">
        {nameLabel}
        <div className="rounded-[16px] rounded-tl-[6px] bg-white px-[14px] py-[10px] text-[13px] leading-[1.4] text-[#222] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.2)]">
          {m.text}
        </div>
      </div>
    </li>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[22px]"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function AddPersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[22px]"
    >
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}
