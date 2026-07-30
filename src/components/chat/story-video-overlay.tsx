"use client";

import { useEffect, useRef, useState } from "react";

/**
 * StoryVideoOverlay — a full-screen "main-line plot" player that the
 * event chat can trigger mid-conversation (Figma 1563:48932 —
 * "触发视频物料"). Plays the opening scene of 去海边游学 (钟辰时) as a
 * muted autoplaying MP4; the user can close it at any time via the ×
 * button or ESC, and when the clip reaches its natural end we auto
 * dismiss so the viewer lands back on the chat without a black screen.
 *
 * Mount semantics:
 *   • Parent decides *when* to trigger (a timer inside the event chat)
 *     by flipping `open` to true.
 *   • Entry/exit animate via CSS opacity; the component stays mounted
 *     for `EXIT_MS` after `open` flips back so the fade-out reads
 *     cleanly instead of cutting.
 *   • `muted` is required for unprompted `autoPlay` in every modern
 *     browser — the UI below exposes a small unmute toggle beside the
 *     close button for viewers who want sound.
 *
 * The overlay renders INSIDE the phone frame (not a portal) so it
 * cleanly covers only the chat surface — matches the Figma mock where
 * the story plays inside the device area, not the full browser.
 */
const ENTER_MS = 420;
const EXIT_MS = 360;

export function StoryVideoOverlay({
  open,
  onClose,
  videoSrc = "/figma/story/seaside-trip-opening.mp4",
}: {
  /** Controlled visibility flag. Parent flips this to trigger playback. */
  open: boolean;
  /** Called when the user taps the close button, presses ESC, or the video ends. */
  onClose: () => void;
  /** Video source. Defaults to the 去海边游学 opening asset in public/. */
  videoSrc?: string;
}) {
  // Two-phase mount: keeps the overlay in the DOM for `EXIT_MS` after
  // `open` flips to false, so the fade-out actually runs. Enter is
  // driven by a double-rAF so the initial `opacity-0` frame paints
  // before we flip to `opacity-100`.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
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
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  // Reset playhead + mute state whenever the overlay unmounts, so the
  // next trigger starts from the beginning. Safari sometimes keeps
  // stale decoded frames around when a video element is re-used, so
  // a hard `load()` is safer than just rewinding.
  useEffect(() => {
    if (mounted) return;
    setMuted(true);
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        // Some browsers throw on pause()/currentTime reassignment if
        // the element was already detached — safe to ignore.
      }
    }
  }, [mounted]);

  // ESC to close — respects the same contract as a modal / lightbox.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="主线剧情"
      // z-[29] sits above the chat header (z-20) but *below* the
      // status bar (z-30 in PhoneFrame), matching the Figma mock
      // where `9:41` and the carrier glyphs remain visible on top
      // of the playing video.
      className={`absolute inset-0 z-[29] bg-black transition-opacity ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        transitionDuration: `${visible ? ENTER_MS : EXIT_MS}ms`,
      }}
    >
      {/* Video — object-cover so the clip fills the phone frame
          regardless of its native aspect ratio. `playsInline` keeps
          iOS Safari from fullscreen-ing it; `preload="auto"` lets the
          browser start buffering as soon as the overlay paints so
          autoplay kicks in without a visible stutter. */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        onEnded={onClose}
        className="absolute inset-0 size-full object-cover"
      />

      {/* Subtle vignette keeps the close button and ticker readable
          against busy scenes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Top-right controls: [unmute] [close]. Sit below the status
          bar so they don't collide with notch / carrier icons. */}
      <div className="absolute right-[14px] top-[52px] z-10 flex items-center gap-[8px]">
        <button
          type="button"
          aria-label={muted ? "开启声音" : "静音"}
          aria-pressed={!muted}
          onClick={() => setMuted((v) => !v)}
          className="inline-flex size-[36px] items-center justify-center rounded-full bg-white/85 text-black/80 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] backdrop-blur-[6px] transition active:scale-95 active:bg-white"
        >
          {muted ? <MutedIcon /> : <UnmutedIcon />}
        </button>
        <button
          type="button"
          aria-label="关闭主线剧情"
          onClick={onClose}
          className="inline-flex size-[36px] items-center justify-center rounded-full bg-white/85 text-black/80 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] backdrop-blur-[6px] transition active:scale-95 active:bg-white"
        >
          <CloseIcon />
        </button>
      </div>

    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function MutedIcon() {
  // Speaker with a slash — matches iOS "muted" glyph vocabulary.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M22 9l-6 6M16 9l6 6" />
    </svg>
  );
}

function UnmutedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
