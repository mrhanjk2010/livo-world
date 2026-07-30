"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useEventSheet } from "@/components/map/event-sheet-context";
import { useMapFocusOptional } from "@/components/map/map-focus-context";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";

/**
 * Anchored POI chip on the map (e.g. 图书馆 / 食堂 / 教室).
 *
 * In the default state tapping the pill opens the free-chat page for
 * that location — every group chat in this product is tied to a
 * place, so the POI label is both a navigational landmark and the
 * "entry door" to the local group conversation.
 *
 * When `EventSheetContext` says this POI has a live event the pin
 * grows a pulsing red heart badge, and **both the pill AND the heart
 * open the event half-sheet** instead of jumping straight into chat.
 * The active set is randomised once per page load (in
 * `EventSheetProvider`) and the badge only disappears when the user
 * commits via the sheet's "进入事件" CTA — otherwise it stays
 * visible until the next refresh. No auto-expire timers anymore.
 *
 * When `MapFocusContext` fires a pulse for this label (triggered by
 * tapping a World-Broadcast pill), the chip plays a one-shot POP —
 * a scale pulse (1 → 1.28 → 0.94 → 1) applied via `transform: scale`.
 * Crucially, horizontal centering uses Tailwind's `-translate-x-1/2`
 * which in v4 compiles to the independent `translate:` CSS property,
 * so the animation's `transform` is orthogonal to centering and the
 * chip's anchor stays pixel-locked. See the `livo-poi-pop` keyframe
 * doc in globals.css for the history of why this separation matters.
 * The animation is applied directly via a ref so two rapid taps on
 * the same pill both re-trigger the pop.
 */
export function POIPin({
  xPct,
  yPct,
  label,
}: {
  /** Horizontal center of the chip as fraction of map width (0..1). */
  xPct: number;
  /** Top of the chip as fraction of map height (0..1). */
  yPct: number;
  label: string;
}) {
  const navigate = useTransitionNavigate();
  const { open: openEventSheet, has } = useEventSheet();
  const hasEvent = has(label);
  const focus = useMapFocusOptional();
  /**
   * Button ref — animation is applied directly to the button so the
   * scale pulse originates from its exact bounds. Because the chip's
   * horizontal centering uses the independent `translate:` property
   * (from Tailwind's `-translate-x-1/2` in v4), animating only
   * `transform: scale(...)` here is orthogonal to centering: the
   * chip breathes around its geometric center without shifting its
   * (left, top) anchor by a single pixel. See `livo-poi-pop` doc in
   * globals.css for why this separation is load-bearing.
   */
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Drive the pop animation imperatively. Re-depending on
   * `pulseToken` (which increments every focusOn call) means even a
   * repeat tap on the same label — when `pulsingLabel` is already
   * === label — still kicks the animation off from frame 0. The
   * reflow between the animation clear and re-apply is what gives
   * the browser a chance to restart the keyframe.
   */
  useEffect(() => {
    if (!focus) return;
    if (focus.pulsingLabel !== label) return;
    const el = buttonRef.current;
    if (!el) return;
    el.style.animation = "none";
    // force reflow so the browser treats the next assignment as a new animation
    void el.offsetWidth;
    el.style.animation = "livo-poi-pop 560ms cubic-bezier(0.22, 1, 0.36, 1)";
    const onEnd = () => {
      if (buttonRef.current) buttonRef.current.style.animation = "";
    };
    el.addEventListener("animationend", onEnd, { once: true });
    return () => el.removeEventListener("animationend", onEnd);
    // pulseToken intentionally in deps — see doc block above.
  }, [focus?.pulseToken, focus?.pulsingLabel, focus, label]);

  const handleTap = () => {
    if (hasEvent) {
      openEventSheet(label);
    } else {
      navigate(`/chat/${encodeURIComponent(label)}`);
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className="absolute inline-flex -translate-x-1/2 items-center justify-center gap-[2px] rounded-[16px] bg-white/80 px-[8px] py-[4px] backdrop-blur-[4px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-colors hover:bg-white active:bg-white"
      style={{ left: `${xPct * 100}%`, top: `${yPct * 100}%` }}
      aria-label={
        hasEvent
          ? `${label} 有日常事件，点击查看`
          : `进入 ${label} 自由聊天`
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={handleTap}
    >
      <Image
        src="/figma/map/poi-pin.svg"
        alt=""
        width={16}
        height={16}
        className="shrink-0"
      />
      <span className="whitespace-nowrap text-[10px] font-light text-black">
        {label}
      </span>

      {hasEvent ? <EventBadge /> : null}
    </button>
  );
}

/**
 * Clickable heart badge. Intentionally NOT `pointer-events-none`:
 * because this `<span>` is a DOM child of the parent `<button>`,
 * pointer events on the heart bubble up and trigger the button's
 * onClick — so "点击闪动爱心" naturally opens the event sheet just
 * like tapping the pill itself. The ripple layer IS pointer-events
 * disabled so it doesn't eat clicks that land slightly past the solid
 * badge.
 */
function EventBadge() {
  return (
    <span
      aria-hidden
      className="absolute left-full top-1/2 ml-[2px] flex size-[16px] -translate-y-1/2 items-center justify-center motion-safe:animate-[livo-pin-fade-in_320ms_ease-out]"
    >
      {/* Expanding ripple — Tailwind's built-in ping loop. */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#ff7070] opacity-70 motion-safe:animate-ping" />
      {/* Solid badge with heart glyph; gentle scale pulse for presence. */}
      <span className="relative flex size-full items-center justify-center rounded-full bg-[#ff7070] shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(255,112,112,0.4)] motion-safe:animate-[livo-pin-pulse_1.8s_ease-in-out_infinite]">
        <svg
          viewBox="0 0 24 24"
          className="size-[9px] text-white"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 21s-6.7-4.35-9.1-8.7A5.3 5.3 0 0 1 12 6.3a5.3 5.3 0 0 1 9.1 6C18.7 16.65 12 21 12 21z" />
        </svg>
      </span>
    </span>
  );
}
