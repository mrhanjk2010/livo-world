/**
 * A single playable 主线情景 (main-line storyline) card, shown in the
 * 主线情景列表 page (Figma 1563:49012). Tapping the card plays the
 * associated MP4 in the shared StoryVideoOverlay.
 *
 * Fields mirror the pill/title/description pattern from the Figma
 * mock so the list view and the in-chat replay card (Figma 1603:7273)
 * can share the same tagline + venue language.
 */
export type Story = {
  id: string;
  title: string;
  /** Left red pill — always "主线情景" on the list but kept as a field
   * so future cards can surface variants (比如 支线情景 / 隐藏情景). */
  tagline: string;
  /** Right gray pill — e.g. "南一高中·海边". */
  venue: string;
  /** Two-line blurb shown beneath the tags. */
  description: string;
  /** Video source for the replay overlay. */
  videoSrc: string;
  /**
   * Seek point (seconds) used to pick which frame of the video renders
   * as the static cover poster. Pulled through to the `<video>` tag
   * via `src#t=X` so different cards can expose different "stills" of
   * the same clip without shipping separate image files.
   */
  posterAt: number;
};

/**
 * Demo catalogue. The seaside clip is the only real video in the repo
 * today (`public/figma/story/seaside-trip-opening.mp4`), so both cards
 * point at it — card 2 just seeks to a later frame so its cover looks
 * visually distinct from card 1. New assets can drop in here later
 * without touching any UI code.
 */
export const STORIES: readonly Story[] = [
  {
    id: "seaside-trip",
    title: "去海边游学",
    tagline: "主线情景",
    venue: "南一高中 · 海边",
    description:
      "钟辰时突然来约你一起去海边游学 —— 远离学校的那种旅行，已经有段时间没有过了。",
    videoSrc: "/figma/story/seaside-trip-opening.mp4",
    // Matches the in-chat replay card (event-chat-screen uses `#t=0.5`)
    // so viewers see the same opening frame on both surfaces.
    posterAt: 0.5,
  },
  {
    id: "hall-collapse",
    title: "礼堂坍塌的秘密",
    tagline: "主线情景",
    venue: "南一高中 · 旧礼堂废墟",
    description:
      "晚饭时间到了，食堂里弥漫着饭菜的香气。钟辰时和夏季恰好坐在同一张桌上。",
    videoSrc: "/figma/story/seaside-trip-opening.mp4",
    // Mid-clip seek → different cover frame even though the asset is
    // the same placeholder video.
    posterAt: 6,
  },
];
