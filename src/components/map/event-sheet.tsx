"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useEventSheet } from "@/components/map/event-sheet-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { enterPlace, markDrillOrigin } from "@/lib/mobile/drill";
import { getMapEvent } from "@/lib/map-events";
import { getChatScene } from "@/lib/chat-scenes";

/**
 * Bottom half-sheet that previews a POI's active daily event.
 *
 * Mounted once inside `MapScreen`; controlled via `EventSheetContext`.
 * Renders a scene-gradient cover (shared with the chat page so the
 * handoff feels continuous), title + tags + blurb, a small row of
 * participant avatars, and a primary "进入事件" CTA that navigates
 * into the location's free-chat overlay.
 */
export function EventSheet() {
  const { location, close, consume } = useEventSheet();

  // Two-phase mount keeps the exit animation. `visible` drives the
  // CSS enter/leave state; we only unmount ~300ms after `location`
  // clears.
  const [mountedLocation, setMountedLocation] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (location !== null) {
      setMountedLocation(location);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (mountedLocation === null) return;
    setVisible(false);
    const t = setTimeout(() => setMountedLocation(null), 320);
    return () => clearTimeout(t);
  }, [location, mountedLocation]);

  const overlayRoot = usePhoneOverlayRoot();

  if (mountedLocation === null || !overlayRoot) return null;

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[60]"
      onClick={close}
      role="presentation"
    >
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity duration-[280ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <SheetBody
        location={mountedLocation}
        visible={visible}
        setVisible={setVisible}
        close={close}
        consume={consume}
      />
    </div>,
    overlayRoot,
  );
}

// ─── Sheet body (drag-to-dismiss) ───────────────────────────────────────

function SheetBody({
  location,
  visible,
  setVisible,
  close,
  consume,
}: {
  location: string;
  visible: boolean;
  setVisible: (v: boolean) => void;
  close: () => void;
  /** Removes this POI from the active-events set once the user commits. */
  consume: (location: string) => void;
}) {
  const event = getMapEvent(location);
  const scene = getChatScene(location).scene;

  // Drag-to-dismiss: same pattern as ActivitySheet — grip region on
  // the top strip (handle pill + title area) starts a pointer drag;
  // release past 120px or 0.6 px/ms triggers `close()`.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    pointerId: number;
    lastY: number;
    lastTime: number;
    velocity: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setDragY(0);
      setDragging(false);
    }
  }, [visible, location]);

  const ignoreDragStart = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("button"));
  };

  const onGripPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ignoreDragStart(e.target)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      pointerId: e.pointerId,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
    setDragging(true);
  };

  const onGripPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = now - d.lastTime;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastTime = now;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const endGrip = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = Math.max(0, e.clientY - d.startY);
    const vy = d.velocity;
    try {
      e.currentTarget.releasePointerCapture(d.pointerId);
    } catch {
      // releasePointerCapture throws if the pointer is already gone
      // (e.g. pointercancel after drag ended) — safe to swallow.
    }
    dragRef.current = null;

    if (dy > 120 || vy > 0.6) {
      setVisible(false);
      setDragging(false);
      close();
    } else {
      setDragging(false);
      setDragY(0);
    }
  };

  const stop = (e: MouseEvent) => e.stopPropagation();

  const enterEvent = (e: MouseEvent) => {
    // "进入事件" is the commit action — this is where we consume the
    // badge. After the user confirms, the heart at this POI goes away
    // for the rest of the session; refreshing the page draws a fresh
    // random set (see EventSheetProvider).
    consume(location);
    // The event chat grows out of this button (see lib/mobile/drill);
    // measure it before the sheet starts collapsing.
    markDrillOrigin(e.currentTarget);
    // Close the sheet first so the map is visible for a split second
    // as the event chat grows over it — mirrors the handoff you'd get
    // tapping a POI directly into free chat.
    close();
    enterPlace({ location, mode: "event" });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${event.title} — 日常事件预告`}
      className={`absolute bottom-0 left-0 right-0 flex max-h-[82%] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.25)] transform-gpu will-change-[transform,opacity] ${
        dragging
          ? ""
          : "transition-[transform,opacity] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
      style={dragging ? { transform: `translateY(${dragY}px)` } : undefined}
      onClick={stop}
      onPointerDown={stop}
    >
      {/* Drag grip: handle pill + cover region. */}
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={endGrip}
        onPointerCancel={endGrip}
      >
        <Cover sceneBase={scene.base} sceneGradient={scene.gradient} label={location} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[20px] pb-[20px] pt-[16px]">
        {/* Title */}
        <h2 className="text-[20px] font-semibold leading-[1.25] text-black">
          {event.title}
        </h2>

        {/* Tags row: 日常事件 pill + venue pill */}
        <div className="mt-[10px] flex flex-wrap items-center gap-[8px]">
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
            <span>{event.venue}</span>
          </span>
        </div>

        {/* Description */}
        <p className="mt-[12px] text-[13px] leading-[1.55] text-black/80">
          {event.description}
        </p>

        {/* Participants */}
        <div className="mt-[16px] flex flex-wrap items-center gap-x-[16px] gap-y-[10px]">
          {event.participants.map((p) => (
            <ParticipantRow key={p.name} participant={p} />
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={enterEvent}
          className="mt-[18px] flex h-[48px] w-full items-center justify-center rounded-full bg-[#ff7070] text-[15px] font-semibold tracking-[2px] text-white shadow-[0_8px_20px_-8px_rgba(255,112,112,0.55)] transition-[filter] active:brightness-95"
        >
          进入事件
        </button>
      </div>
    </div>
  );
}

/**
 * Cover strip at the top of the sheet. Reuses the chat scene gradient
 * so the visual handoff from sheet → chat page feels continuous. A
 * soft vignette at the bottom fades the cover into the sheet body,
 * and the drag-handle pill sits centered at the top.
 */
function Cover({
  sceneBase,
  sceneGradient,
  label,
}: {
  sceneBase: string;
  sceneGradient: string;
  label: string;
}) {
  return (
    <div
      className="relative h-[160px] w-full"
      style={{
        backgroundColor: sceneBase,
        backgroundImage: sceneGradient,
      }}
    >
      {/* Drag handle pill */}
      <div className="flex justify-center pt-[10px]">
        <span className="h-[4px] w-[44px] rounded-full bg-white/60" />
      </div>

      {/* Large stylized place name — low-alpha white so the gradient
          still reads but the cover has a clear anchor. */}
      <p className="pointer-events-none absolute bottom-[20px] left-[24px] text-[36px] font-medium leading-none text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
        {label}
      </p>

      {/* Bottom fade to white so the body picks up cleanly. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[40px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)",
        }}
      />
    </div>
  );
}

function ParticipantRow({
  participant,
}: {
  participant: {
    name: string;
    avatarSrc: string | null;
    fallbackColor?: string;
  };
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <span
        className="relative flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={
          participant.avatarSrc
            ? undefined
            : { backgroundColor: participant.fallbackColor ?? "#8b7aff" }
        }
      >
        {participant.avatarSrc ? (
          <Image
            src={participant.avatarSrc}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : (
          <span className="text-[13px] font-medium text-white">
            {participant.name.slice(0, 1)}
          </span>
        )}
      </span>
      <span className="text-[13px] leading-none text-black/80">
        {participant.name}
      </span>
    </div>
  );
}
