"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StoryVideoOverlay } from "@/components/chat/story-video-overlay";
import { STORIES, type Story } from "@/lib/stories";

/**
 * StoriesScreen — the 主线情景列表 page (Figma 1563:49012).
 *
 * Reached from the map's 主线 chip in MapTopNav. Presents every
 * unlocked main-line storyline as a tall portrait card; tapping a
 * card plays its MP4 in the same shared StoryVideoOverlay the event
 * chat uses, so the "main-line moment" feels consistent no matter
 * where it's triggered.
 *
 * Layout mirrors the Figma spec at 1× scale (design canvas is 2×):
 *   • Dark charcoal backdrop; status bar + header float on top.
 *   • Header: `<` back + "主线情景" title, backdrop-blurred over the
 *     content beneath as the user scrolls.
 *   • Scrollable list of cards (gap-12) with a dimmed footer hint
 *     ("···更多主线情景可通过日常事件聊天触发···") at the bottom.
 */
export function StoriesScreen({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  const [activeStory, setActiveStory] = useState<Story | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Header — sits above the scrolling list, same top offset as
          chat-screen so the status bar + header align across routes. */}
      <div className="absolute inset-x-0 top-[44px] z-20 flex h-[48px] items-center gap-[8px] px-[16px]">
        <button
          type="button"
          aria-label="返回"
          onClick={handleBack}
          className="inline-flex size-[32px] shrink-0 items-center justify-center rounded-full text-white/90 transition-transform active:scale-95"
        >
          <BackIcon />
        </button>
        <h1 className="text-[16px] font-medium leading-none text-white">
          主线情景
        </h1>
      </div>

      {/* Scrollable list. Starts below the header (44 + 48 = 92px) and
          reserves bottom breathing room so the footer line isn't flush
          against the home indicator. */}
      <div className="absolute inset-x-0 bottom-0 top-[92px] overflow-y-auto px-[16px] pb-[24px] pt-[8px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex flex-col gap-[12px]">
          {STORIES.map((story) => (
            <li key={story.id}>
              <StoryCard
                story={story}
                onPlay={() => setActiveStory(story)}
              />
            </li>
          ))}
        </ul>

        <p className="mt-[20px] text-center text-[12px] font-light leading-[1.5] text-white/60">
          ··· 更多主线情景可通过日常事件聊天触发 ···
        </p>
      </div>

      {/* Replay overlay — shared with event-chat-screen. The player
          mutes by default and auto-dismisses when the clip ends; we
          swap `activeStory` in/out to control open-state so each card
          tap "reopens" with that card's source + cover. */}
      <StoryVideoOverlay
        open={activeStory !== null}
        onClose={() => setActiveStory(null)}
        videoSrc={activeStory?.videoSrc ?? "/figma/story/seaside-trip-opening.mp4"}
      />
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────

/**
 * One 主线情景 card (Figma 1657:4041). White rounded body with a
 * masked cover image occupying the upper ~45% of the card, a large
 * title, two tag pills (主线情景 + venue), and a description.
 *
 * The cover uses a `<video>` seeked to `posterAt` as its static frame
 * — same trick as the in-chat replay card — so we don't need a
 * separate poster PNG per story.
 */
function StoryCard({
  story,
  onPlay,
}: {
  story: Story;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`播放主线情景：${story.title}`}
      className="group relative block w-full overflow-hidden rounded-[16px] bg-white text-left shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)] ring-[0.5px] ring-white/60 transition-transform active:scale-[0.995]"
    >
      {/* Cover — masked with a vertical gradient so the bottom edge
          fades into the white body instead of cutting hard. Matches
          the soft mask group in Figma (1657:4054). */}
      <div
        className="relative aspect-[320/176] w-full overflow-hidden"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
        }}
      >
        <div aria-hidden className="absolute inset-0 bg-black" />
        <video
          key={story.id}
          src={`${story.videoSrc}#t=${story.posterAt}`}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/figma/story/play-icon.svg"
            alt=""
            width={48}
            height={48}
            className="size-[48px] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-[1.04]"
          />
        </div>
      </div>

      <div className="px-[16px] pb-[16px] pt-[8px]">
        <h2 className="text-[22px] font-semibold leading-[1.2] text-black">
          {story.title}
        </h2>

        <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
          <span className="inline-flex items-center gap-[2px] rounded-full bg-[#ff7070] py-[4px] pl-[6px] pr-[10px] text-[12px] font-medium leading-none text-white backdrop-blur-[2px]">
            <Image
              src="/figma/story/story-tag-icon.svg"
              alt=""
              width={16}
              height={16}
              className="shrink-0"
            />
            <span>{story.tagline}</span>
          </span>
          <span className="inline-flex items-center gap-[2px] rounded-full bg-black/[0.05] py-[4px] pl-[6px] pr-[10px] text-[12px] leading-none text-black/80">
            <Image
              src="/figma/map/poi-pin.svg"
              alt=""
              width={14}
              height={14}
              className="shrink-0"
            />
            <span>{story.venue}</span>
          </span>
        </div>

        <p className="mt-[10px] text-[13px] leading-[1.55] text-black/80">
          {story.description}
        </p>
      </div>
    </button>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

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
