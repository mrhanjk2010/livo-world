"use client";

import Image from "next/image";
import { type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useActivitySheet } from "@/components/map/activity-sheet-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";

/**
 * One row of the "查看角色" panel — a friend plus their current POI
 * and a short activity tag (location · action).
 */
export type FriendRosterItem = {
  name: string;
  avatarSrc: string;
  /**
   * Human-readable current location. POI label ("后山") when idle,
   * literal "路上" while walking between places.
   */
  location: string;
  /**
   * Real POI label suitable for opening a place-based chat. Same as
   * `location` when idle; when walking, the destination POI (not
   * "路上") so "去TA这里" always lands in a real scene.
   */
  chatLocation: string;
  /** Short activity tag, e.g. "喂猫". */
  action: string;
  /**
   * Single emoji mirroring the friend's *current* mood — same value
   * shown in the bubble above the avatar on the map. The roster row
   * displays this in place of the long action text so all three
   * surfaces (map bubble, panel row, "现在" sheet row) read the same
   * emotional state at a glance.
   */
  mood: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  roster: readonly FriendRosterItem[];
};

/**
 * Friends panel — triggered by the top-right friends button.
 *
 * Portals into `#phone-overlay-root` so it layers above everything else
 * in the phone frame (top nav, world broadcast, bottom nav). A dim
 * backdrop intercepts the first tap anywhere outside the panel and
 * closes it.
 *
 * Figma ref: 1698:7636 / 1698:7816 — 2x coords halved to 1x display
 * units (panel at left 39px / top 101px, rounded-[20px], white bg).
 */
export function FriendsPanel({ open, onClose, roster }: Props) {
  const overlayEl = usePhoneOverlayRoot();
  const { open: openSheet } = useActivitySheet();
  const navigate = useTransitionNavigate();

  if (!open || !overlayEl) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  const showActivity = (subject: string | null) => {
    onClose();
    openSheet(subject);
  };

  /**
   * Tapping a friend's nav-arrow jumps straight to their place-based
   * free-chat. We route to `chatLocation` (not `location`) so that when
   * a friend is walking the chat opens at their destination POI
   * instead of the literal "路上" — every group chat in the product is
   * anchored to a real place.
   */
  const goToFriend = (item: FriendRosterItem) => {
    onClose();
    navigate(`/chat/${encodeURIComponent(item.chatLocation)}`);
  };

  return createPortal(
    <>
      {/* Dim backdrop — tapping anywhere closes. */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/25 animate-in fade-in duration-150"
        // Block pan/drag from reaching PannableMap; the click handler
        // below is what actually dismisses the panel.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      />

      {/* Panel card. Sits just below the top-nav row, aligned with the
          friends button on the right and extending leftward. */}
      <div
        role="dialog"
        aria-label="好友动态"
        className="pointer-events-auto absolute left-[20px] right-[16px] top-[101px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.04] animate-in fade-in slide-in-from-top-2 duration-200"
        onClick={stop}
        onPointerDown={stop}
      >
        <div className="flex flex-col gap-[2px] p-[8px]">
          {roster.map((item) => (
            <FriendRow
              key={item.name}
              item={item}
              onShowActivity={() => showActivity(item.name)}
              onGoToFriend={() => goToFriend(item)}
            />
          ))}
        </div>
      </div>
    </>,
    overlayEl,
  );
}

/** Individual friend row: avatar · name + 📌 location · action · [go] [calendar] */
function FriendRow({
  item,
  onShowActivity,
  onGoToFriend,
}: {
  item: FriendRosterItem;
  onShowActivity: () => void;
  onGoToFriend: () => void;
}) {
  return (
    <div className="flex items-center gap-[10px] p-[8px]">
      <div className="relative size-[40px] shrink-0 overflow-hidden rounded-[20px]">
        <Image
          src={item.avatarSrc}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          draggable={false}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-[15px] font-medium leading-none text-black">
          {item.name}
        </span>
        <span className="truncate text-[11px] leading-tight text-black/60">
          📌 {item.location} · <span className="text-[12px]">{item.mood}</span>
        </span>
      </div>

      <ActionIconButton
        src="/figma/map/nav-arrow.svg"
        alt={`去 ${item.name} 的位置`}
        onClick={onGoToFriend}
      />
      <ActionIconButton
        src="/figma/map/calendar.svg"
        alt={`${item.name} 的动态`}
        onClick={onShowActivity}
      />
    </div>
  );
}

function ActionIconButton({
  src,
  alt,
  onClick,
}: {
  src: string;
  alt: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={alt}
      onClick={onClick}
      className="inline-flex size-[40px] shrink-0 items-center justify-center rounded-[20px] bg-[#f5f5f5] transition-transform active:scale-95"
    >
      <Image src={src} alt="" width={24} height={24} draggable={false} />
    </button>
  );
}
