"use client";

import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useFriendsStatus } from "@/components/map/friends-status-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";

/**
 * Per-friend invite state (Figma 1571:5559).
 *   • present   — already in the chat. Green pill, not interactive.
 *   • invite    — not yet invited. Solid red CTA, the only tappable state.
 *   • inviting  — outgoing invite is in flight. Faded red pill, awaits resolve.
 *   • declined  — friend turned the invite down. Light red pill, terminal.
 */
export type InviteStatus = "present" | "invite" | "inviting" | "declined";

/**
 * The four canonical friends shown in the invite sheet. Order + default
 * locations mirror the Figma spec; live POIs from `useFriendsStatus`
 * override the defaults whenever the map runtime is mounted (i.e. when
 * the chat is reached as an intercepted modal). On a direct page load
 * the FriendsStatusProvider isn't present, so we fall back to these
 * "home POI" labels — same place each friend starts the day at on the
 * map's `WanderingFriends` runtime.
 */
export const INVITE_CANDIDATES: readonly {
  name: string;
  avatarSrc: string;
  defaultLocation: string;
}[] = [
  { name: "周往", avatarSrc: "/figma/map/avatar-zhouwang.png", defaultLocation: "后山" },
  { name: "钟辰时", avatarSrc: "/figma/map/avatar-zhongchen.jpg", defaultLocation: "图书馆" },
  { name: "叶恒", avatarSrc: "/figma/map/avatar-yeheng.png", defaultLocation: "食堂" },
  { name: "夏季", avatarSrc: "/figma/map/avatar-xiaji.png", defaultLocation: "操场" },
];

/**
 * Centered popup that lists every invitable friend with a per-row
 * status pill (Figma 1571:5559 — "邀请角色"). Mounted as a portal
 * inside `#phone-overlay-root` so it sits above every other in-frame
 * layer (members rail, composer, etc.) without leaking out of the
 * phone frame.
 *
 * State is owned by the parent (`ChatScreen`) so closing & reopening
 * the sheet preserves whichever invitations are still in flight; this
 * component is purely presentational + handles enter/leave animation.
 */
export function InviteCharacterSheet({
  open,
  onClose,
  statuses,
  declineCooldown,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  /** Per-name invite state. Anything missing is treated as "invite". */
  statuses: Readonly<Record<string, InviteStatus>>;
  /**
   * Per-name wall-clock ms timestamp at which a 已拒绝 row will flip
   * back to 邀请. Drives the live "29 已拒绝" countdown chip the
   * sheet renders next to declined rows. Anything missing means
   * "no cool-down in flight" (so no countdown shown).
   */
  declineCooldown?: Readonly<Record<string, number>>;
  /** Called when the user taps the red 邀请 CTA on a row. */
  onInvite: (name: string) => void;
}) {
  const live = useFriendsStatus();

  // Two-phase mount keeps the exit animation: `visible` drives the
  // CSS enter/leave; we only unmount ~240ms after `open` flips false.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double-rAF: first frame paints the initial `opacity-0 / scale-95`
      // state, second flips `visible` so the CSS transition actually runs.
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 240);
    return () => clearTimeout(t);
  }, [open]);

  // ESC closes the sheet — matches the standard modal contract and
  // mirrors how the story video overlay handles dismissal.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  // Portal target is the enclosing PhoneFrame's overlay node — when the
  // chat opens as an intercepted modal, that's the chat's own root
  // (not the map's underneath), so the sheet stacks above the chat.
  const overlayRoot = usePhoneOverlayRoot();

  // Tick once per second while the sheet is mounted so countdown chips
  // refresh smoothly. The state value is intentionally unused — only
  // its identity change drives the re-render; the row math reads a
  // fresh `Date.now()` so the very first frame after a 30s deadline
  // is set still shows 30, not 31 (a stale cached `now` would round
  // ceil(30.4s) up). Hook must sit above the early return so hook
  // order stays stable across renders.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [mounted]);

  if (!mounted || !overlayRoot) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  const liveByName = new Map(live.map((s) => [s.name, s]));

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center px-[16px]"
      onClick={onClose}
      role="presentation"
    >
      {/* Dim backdrop */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-black/45 transition-opacity duration-[220ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="邀请角色"
        onClick={stop}
        className={`relative w-full max-w-[343px] origin-center rounded-[18px] bg-white p-[12px] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible
            ? "opacity-100 scale-100"
            : "opacity-0 scale-[0.96]"
        }`}
      >
        {/* Header — bold person-plus icon + title + close button */}
        <div className="flex items-center gap-[10px] px-[10px] py-[8px]">
          <PersonPlusIcon className="size-[24px] shrink-0 text-black" />
          <h2 className="flex-1 text-[17px] font-semibold leading-none text-black">
            邀请角色
          </h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="inline-flex size-[28px] shrink-0 items-center justify-center rounded-full text-black/70 transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]"
          >
            <CloseIcon className="size-[18px]" />
          </button>
        </div>

        {/* Candidate rows */}
        <ul className="flex flex-col">
          {INVITE_CANDIDATES.map((c) => {
            const status = statuses[c.name] ?? "invite";
            const liveLoc = liveByName.get(c.name)?.location;
            // "路上" is a transient walking state — show it verbatim so
            // viewers see where the friend actually is right now; for
            // every other case the live POI (or the default) is fine.
            const location = liveLoc ?? c.defaultLocation;
            // Remaining cool-down seconds (only meaningful for declined
            // rows). Round (not ceil) against a fresh `Date.now()` so
            // the first frame after a 30 000ms deadline is set displays
            // 30, not 31 — even with sub-millisecond clock drift between
            // the timestamp being stamped and this render running.
            const unlockAt = declineCooldown?.[c.name];
            const cooldownLeft =
              status === "declined" && unlockAt
                ? Math.max(0, Math.round((unlockAt - Date.now()) / 1000))
                : 0;
            return (
              <li key={c.name}>
                <CandidateRow
                  name={c.name}
                  avatarSrc={c.avatarSrc}
                  location={location}
                  status={status}
                  cooldownLeft={cooldownLeft}
                  onInvite={() => onInvite(c.name)}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    overlayRoot,
  );
}

// ─── Candidate row ───────────────────────────────────────────────────────

function CandidateRow({
  name,
  avatarSrc,
  location,
  status,
  cooldownLeft,
  onInvite,
}: {
  name: string;
  avatarSrc: string;
  location: string;
  status: InviteStatus;
  /** Remaining re-invite cool-down seconds for declined rows; 0 = none. */
  cooldownLeft: number;
  onInvite: () => void;
}) {
  return (
    <div className="flex items-center gap-[12px] px-[10px] py-[10px]">
      <div className="relative size-[44px] shrink-0 overflow-hidden rounded-full bg-black/5">
        <Image src={avatarSrc} alt="" fill sizes="44px" className="object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p className="truncate text-[15px] font-medium leading-none text-black">
          {name}
        </p>
        <p className="flex items-center gap-[3px] text-[11.5px] leading-none text-black/55">
          <span aria-hidden>📌</span>
          <span className="truncate">{location}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-[8px]">
        {status === "declined" && cooldownLeft > 0 ? (
          <span
            aria-label={`${cooldownLeft}秒后可重新邀请`}
            className="tabular-nums text-[13px] font-light leading-none text-black/45"
          >
            {cooldownLeft}
          </span>
        ) : null}
        <StatusPill status={status} onInvite={onInvite} />
      </div>
    </div>
  );
}

/**
 * Right-edge pill. Per the spec only the `invite` variant is tappable
 * (renders as a real `<button>`); the other three are ambient status
 * indicators rendered as a non-interactive `<span>` so accessibility
 * tree readers don't surface them as actions.
 */
function StatusPill({
  status,
  onInvite,
}: {
  status: InviteStatus;
  onInvite: () => void;
}) {
  // Common pill geometry. Width is min'd via `min-w` so the four
  // labels visually align even though their text widths differ
  // (邀请 = 2 chars, 邀请中... = 5 chars).
  const base =
    "inline-flex h-[30px] min-w-[68px] shrink-0 items-center justify-center rounded-full px-[14px] text-[13px] leading-none backdrop-blur-[4px]";

  if (status === "invite") {
    return (
      <button
        type="button"
        onClick={onInvite}
        aria-label="邀请进入聊天"
        className={`${base} bg-[#ff7070] font-medium text-white shadow-[0_4px_12px_-4px_rgba(255,112,112,0.5)] transition-transform active:scale-95 hover:bg-[#ff5c5c]`}
      >
        邀请
      </button>
    );
  }

  if (status === "inviting") {
    return (
      <span
        aria-label="邀请中"
        className={`${base} bg-[rgba(255,112,112,0.1)] font-light text-[rgba(255,112,112,0.6)]`}
      >
        邀请中...
      </span>
    );
  }

  if (status === "declined") {
    return (
      <span
        aria-label="已拒绝"
        className={`${base} bg-[rgba(255,112,112,0.1)] font-light text-[#ff7070]`}
      >
        已拒绝
      </span>
    );
  }

  // present
  return (
    <span
      aria-label="已在场"
      className={`${base} bg-[rgba(11,164,60,0.1)] font-light text-[#0ba43c]`}
    >
      已在场
    </span>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

/** Bold person-plus glyph used in the sheet header (Figma 1571:5577). */
function PersonPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
