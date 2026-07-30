"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useActivitySheet } from "@/components/map/activity-sheet-context";
import { useMapFocusOptional } from "@/components/map/map-focus-context";

export type BroadcastItem = {
  id: string;
  /** "world" uses the planet icon; "person" uses an avatar image. */
  kind: "world" | "person";
  /** Speaker name — rendered as the bold prefix before the colon. */
  title: string;
  /** Action/body text — rendered after the colon. */
  body: string;
  /** Required for kind === "person". */
  avatarSrc?: string;
  /**
   * The POI label this event is anchored to. Tapping the pill pans
   * the map camera to this POI and plays a one-shot bounce on its
   * pin — see `MapFocusContext`. Should match a label in the POI
   * registry, otherwise the focus call no-ops.
   */
  location: string;
};

type WorldBroadcastProps = {
  items: readonly BroadcastItem[];
  /** How long between two pushes — one new pill fades in per tick. */
  intervalMs?: number;
  /** Delay before the very first pill appears. */
  initialDelayMs?: number;
};

/**
 * Size knobs for the stacked pills. Kept in module scope so the parent
 * container height and the per-slot translateY values stay in sync.
 */
const PILL_H = 36;
const PILL_GAP = 6;
const ROW_H = PILL_H + PILL_GAP;
/**
 * How many rotating broadcast pills are visible at once. The Figma
 * iteration (2026-04-24) trimmed this from 3 → 2 so the bottom row
 * can host a FIXED "世界动态" entry instead — the entry is rendered
 * separately (see `FixedEntryPill` below) and isn't part of the
 * rotating stack.
 */
const MAX_VISIBLE = 2;
/**
 * Total rows rendered in the stage = rotating pills + the fixed
 * entry at the bottom. Only used to size the stage height so the
 * phone-frame layout above doesn't jitter when pills enter/leave.
 */
const TOTAL_ROWS = MAX_VISIBLE + 1;
/**
 * How far (px) a freshly-mounted pill starts BELOW its target slot.
 *
 * Capped at PILL_GAP so that the pill's bottom edge at mount time
 * sits at exactly the TOP edge of the fixed "世界动态" entry — i.e.
 * in the thin gutter directly above the entry. That way the pill
 * reads as "emerging from above the fixed entry" (opacity fades
 * from 0 while it slides up by one gap-height) and never visually
 * overlaps the fixed entry, even for a frame.
 *
 * Any value greater than PILL_GAP would put the pill's bottom
 * inside the fixed entry's bounds (it occupies y ∈ [-PILL_H, 0]
 * in bottom-anchored coords) and re-introduce the pre-2026-04-24
 * overlap bug where the incoming pill slid up THROUGH the fixed
 * entry.
 */
const ENTER_OFFSET_PX = PILL_GAP;
/** Duration of both enter and exit transitions (ms) — applied inline
 *  as transitionDuration since it's also reused for the cleanup timer. */
const EXIT_MS = 360;
/**
 * Hard cap on the body summary inside the pill (in user-perceived
 * characters, not UTF-16 code units — `Array.from` splits on code
 * points so a Chinese character or emoji counts as 1).
 *
 * Copy authors should aim to express each broadcast in ≤10 chars
 * with deliberate length variety ("下雨了" vs "台风掀翻了一棵老树").
 * This cap is the safety net — when it triggers, the pill shows
 * an ellipsis instead of letting CSS alone handle the overflow.
 */
const PILL_BODY_MAX = 10;

function summarizeBody(body: string, max = PILL_BODY_MAX): string {
  const chars = Array.from(body);
  if (chars.length <= max) return body;
  return chars.slice(0, max).join("") + "…";
}

type Slot = {
  /** Unique per-mount key so remounts don't get confused across pushes. */
  key: string;
  item: BroadcastItem;
};

/**
 * "世界动态" broadcast feed.
 *
 * Two rotating pills + one persistent entry at the bottom (Figma ref
 * node-id `2002:2044`, captured 2026-04-24). A new rotating pill
 * slides up from behind the bottom nav every `intervalMs`, the older
 * one drifts up one row, and the oldest fades out of the stack. The
 * bottom row is a fixed dark "世界动态 >" pill that always opens the
 * 动态 half-sheet (全世界 subject) — the rotating pills on top of it
 * instead pan the map camera to the item's POI location and play a
 * bounce animation on that chip, giving the feed two distinct CTAs:
 *
 *   - tap a specific item  → focus on its location
 *   - tap the fixed entry  → open the full dynamic list
 */
export function WorldBroadcast({
  items,
  intervalMs = 2800,
  initialDelayMs = 600,
}: WorldBroadcastProps) {
  // `slots` holds up to MAX_VISIBLE+1 entries at a time: MAX_VISIBLE
  // on-stage + 1 leaving. Oldest first, newest last. A prune timer
  // drops the leaving one once its exit transition finishes.
  const [slots, setSlots] = useState<Slot[]>([]);
  const { open: openActivitySheet } = useActivitySheet();
  const focus = useMapFocusOptional();

  useEffect(() => {
    if (items.length === 0) return;

    let cursor = 0;
    let mountId = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const push = () => {
      const item = items[cursor % items.length];
      cursor += 1;
      mountId += 1;
      const slot: Slot = { key: `${item.id}-${mountId}`, item };
      setSlots((prev) => [...prev, slot].slice(-(MAX_VISIBLE + 1)));
      // Prune the extra (leaving) slot after its exit transition ends.
      // Subsequent pushes before this fires are fine — they simply
      // re-trigger their own prune later.
      setTimeout(() => {
        setSlots((prev) =>
          prev.length > MAX_VISIBLE ? prev.slice(-MAX_VISIBLE) : prev,
        );
      }, EXIT_MS + 40);
    };

    const initialTimer = setTimeout(() => {
      push();
      intervalId = setInterval(push, intervalMs);
    }, initialDelayMs);

    return () => {
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [items, intervalMs, initialDelayMs]);

  if (items.length === 0) return null;

  /**
   * Handler for tapping a rotating (content) pill. Pans the map to
   * the broadcast's POI and triggers the bounce. If no MapFocus
   * provider is mounted (e.g. this component is rendered on a demo
   * page without a map), we fall back to opening the activity sheet
   * so the tap is never a dead-end.
   */
  const handleItemTap = (item: BroadcastItem) => {
    if (focus) {
      focus.focusOn(item.location);
    } else {
      openActivitySheet(null);
    }
  };

  return (
    // Fixed-height stage so the phone-frame layout above doesn't jitter
    // as pills enter/leave. Height covers rotating pills + fixed entry.
    <div
      className="pointer-events-none relative w-full"
      style={{ height: PILL_H * TOTAL_ROWS + PILL_GAP * (TOTAL_ROWS - 1) }}
    >
      {slots.map((slot, i) => {
        // Distance from the "bottom / newest" rotating slot: 0 =
        // newest (one row above the fixed entry), 1+ = older rows,
        // MAX_VISIBLE = exiting. `fromEnd` drives the vertical
        // translate and the fade.
        const fromEnd = slots.length - 1 - i;
        return (
          <BroadcastPill
            key={slot.key}
            item={slot.item}
            fromEnd={fromEnd}
            onTap={() => handleItemTap(slot.item)}
          />
        );
      })}

      {/* Fixed entry — sits at y=0 (bottom of stage), always visible,
          independent of the rotating feed. Dark semi-transparent
          pill matches the Figma spec. Clicking always opens the
          动态 half-sheet at the 全世界 subject. */}
      <FixedEntryPill onOpen={() => openActivitySheet(null)} />
    </div>
  );
}

/**
 * Single rotating broadcast pill — handles its own mount animation
 * so the parent doesn't need to schedule per-slot
 * requestAnimationFrame dances.
 *
 * On mount the pill starts one row BELOW its target with 0 opacity,
 * then on the next paint transitions to its target translateY/opacity.
 * As new pills push in, `fromEnd` grows and CSS transitions handle the
 * smooth shift upward. At `fromEnd === MAX_VISIBLE` the pill is past
 * the top of the rotating stack and fades out.
 *
 * Target y accounts for the fixed entry occupying the bottom row:
 * the newest rotating pill sits ONE row above the fixed entry
 * (translateY = -ROW_H), the older one two rows above
 * (translateY = -2*ROW_H), etc.
 */
function BroadcastPill({
  item,
  fromEnd,
  onTap,
}: {
  item: BroadcastItem;
  fromEnd: number;
  onTap: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Double rAF so the browser has applied the initial (off-stage)
    // style before we flip to the target — otherwise it skips the
    // transition on the very first frame.
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, []);

  const exiting = fromEnd >= MAX_VISIBLE;
  // +1 offset because the fixed entry occupies the bottom row; the
  // newest rotating pill must sit ONE row above it.
  const finalY = -(fromEnd + 1) * ROW_H;
  // Enter offset is RELATIVE to the final resting position — the pill
  // starts ENTER_OFFSET_PX below its final slot (which sits exactly
  // at the top edge of the fixed entry, see ENTER_OFFSET_PX docs) and
  // slides up one gap while fading in. It never crosses the fixed
  // entry's bounds.
  const targetY = mounted ? finalY : finalY + ENTER_OFFSET_PX;
  const opacity = !mounted ? 0 : exiting ? 0 : 1;

  const label =
    item.kind === "world"
      ? `查看地图：${item.body}`
      : `查看地图：${item.title}正在${item.body}`;
  // Short display prefix — "世界动态" collapses to "世界" so the pill
  // stays readable at one line.
  const speaker = item.kind === "world" ? "世界" : item.title;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTap}
      style={{
        transform: `translateY(${targetY}px)`,
        opacity,
        height: PILL_H,
        transitionDuration: `${EXIT_MS}ms`,
      }}
      className="pointer-events-auto absolute bottom-0 left-0 flex max-w-full items-center gap-[8px] rounded-full bg-white/95 pl-[4px] pr-[14px] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.2)] backdrop-blur-[6px] transition-[transform,opacity] ease-out active:scale-[0.98]"
    >
      {/* World-type pills use a circular "earth from above" snapshot
          (Figma node 2002:2049 / img4 — a soft green map stylization).
          Person-type pills use the speaker's portrait. Both render as
          an identical 28×28 round frame so the two variants sit flush
          in the stack. */}
      <span className="relative block size-[28px] shrink-0 overflow-hidden rounded-full">
        <Image
          src={
            item.kind === "world"
              ? "/figma/map/world-avatar.png"
              : (item.avatarSrc ?? "/figma/map/avatar-xiaji.png")
          }
          alt=""
          fill
          sizes="28px"
          className="object-cover"
        />
      </span>
      {/* Single-line text: "Name：summary" capped at PILL_BODY_MAX
          characters via `summarizeBody`. CSS `truncate` is kept as a
          safety net for unusually long names, but in practice the JS
          cap is the binding constraint. The colon uses the full-width
          Chinese form to match the surrounding copy. */}
      <span className="min-w-0 truncate text-[13px] leading-none text-black">
        <span className="font-medium">{speaker}</span>
        <span className="text-black/80">：{summarizeBody(item.body)}</span>
      </span>
    </button>
  );
}

/**
 * Persistent bottom "世界动态 >" entry. Styled per Figma node-id
 * `2002:2053` — dark translucent backdrop-blurred pill, white text,
 * a standalone `toolbar_discover` icon on the leading edge (no
 * colored circle behind it — the Figma source treats the icon as
 * the whole leading graphic), and a trailing chevron. Always fully
 * visible (no enter animation) since it never rotates; only the
 * pills above it animate in and out.
 */
function FixedEntryPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="打开世界动态列表"
      onClick={onOpen}
      style={{ height: PILL_H }}
      className="pointer-events-auto absolute bottom-0 left-0 flex max-w-full items-center gap-[8px] rounded-full bg-black/35 pl-[8px] pr-[10px] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.25)] backdrop-blur-[6px] transition-transform ease-out active:scale-[0.98]"
    >
      {/* Standalone discover glyph (Figma `toolbar_discover` → Subtract
          path). White fill matches the Figma source and reads crisply
          against the dark translucent backdrop. No pink circle. */}
      <span className="flex size-[22px] shrink-0 items-center justify-center">
        <Image
          src="/figma/map/world-discover-icon.svg"
          alt=""
          width={22}
          height={22}
          className="block size-[22px]"
        />
      </span>
      <span className="whitespace-nowrap text-[13px] font-medium leading-none text-white">
        世界动态
      </span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="ml-[2px] size-[14px] shrink-0 text-white/90"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </button>
  );
}
