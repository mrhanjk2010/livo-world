"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  FriendsPanel,
  type FriendRosterItem,
} from "@/components/map/friends-panel";
import { useFriendsStatus } from "@/components/map/friends-status-context";
import { WorldSwitcherSheet } from "@/components/worlds/world-switcher-sheet";

/**
 * Stable display order for the "查看角色" panel (matches Figma 1698:7636:
 * 周往 → 钟辰时 → 叶恒 → 夏季). We key the live status snapshot by name
 * into this order so rows never reshuffle when someone changes POI or
 * starts moving.
 */
const ROSTER_ORDER: readonly string[] = ["周往", "钟辰时", "叶恒", "夏季"];

/** Fixed top-of-phone overlay row of action chips (sits above the pannable map). */
export function MapTopNav() {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [worldSwitcherOpen, setWorldSwitcherOpen] = useState(false);

  /**
   * Build the panel roster from the live status snapshot published by
   * `WanderingFriends` (via `FriendsStatusProvider`). Rendered in the
   * canonical ROSTER_ORDER so the list never reshuffles. Rows with no
   * live data fall through — this can only happen if the provider isn't
   * mounted, so it's a pure safety net.
   */
  const liveStatus = useFriendsStatus();
  const roster = useMemo<readonly FriendRosterItem[]>(() => {
    const byName = new Map(liveStatus.map((s) => [s.name, s]));
    return ROSTER_ORDER.flatMap((name) => {
      const s = byName.get(name);
      return s
        ? [
            {
              name: s.name,
              avatarSrc: s.avatarSrc,
              location: s.location,
              chatLocation: s.chatLocation,
              action: s.action,
              mood: s.mood,
            },
          ]
        : [];
    });
  }, [liveStatus]);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[53px] z-20 flex h-[48px] items-center justify-between px-[16px]">
        <div className="pointer-events-auto flex items-center gap-[8px]">
          <button
            type="button"
            aria-label="切换世界"
            aria-expanded={worldSwitcherOpen}
            onClick={() => setWorldSwitcherOpen(true)}
            className="inline-flex items-center justify-center gap-[5px] rounded-[16px] bg-white/85 px-[10px] py-[4px] backdrop-blur-[6px] shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-transform active:scale-95"
          >
            <Image
              src="/figma/map/dolo-planet.svg"
              alt=""
              width={24}
              height={24}
            />
            <span className="text-[14px] font-medium text-black">DOLO</span>
            <Image
              src="/figma/map/dolo-swap.svg"
              alt=""
              width={14}
              height={14}
            />
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-[8px]">
          <button
            type="button"
            aria-label="好友"
            aria-expanded={rosterOpen}
            onClick={() => setRosterOpen((v) => !v)}
            className={`inline-flex items-center justify-center rounded-[16px] px-[10px] py-[4px] backdrop-blur-[6px] shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-[background-color,transform] active:scale-95 ${
              rosterOpen ? "bg-white" : "bg-white/85"
            }`}
          >
            <Image
              src="/figma/map/friends-icon.svg"
              alt=""
              width={24}
              height={24}
            />
          </button>
        </div>
      </div>

      <FriendsPanel
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        roster={roster}
      />

      <WorldSwitcherSheet
        open={worldSwitcherOpen}
        onClose={() => setWorldSwitcherOpen(false)}
      />
    </>
  );
}
