import { PhoneFrame } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { StoriesScreen } from "@/components/stories/stories-screen";

/**
 * /stories — 主线情景列表 (Figma 1563:49012).
 *
 * Reached by tapping the 主线 chip on the map's top nav. Lists every
 * unlocked main-line storyline; tapping a card opens the shared
 * StoryVideoOverlay so the viewer can replay the clip.
 */
export default function StoriesPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-white md:p-8">
      <PhoneFrame
        dataNodeId="1563:49012"
        dataName="主线剧情列表"
        className="!bg-black"
      >
        <StoriesScreen />

        <div className="absolute inset-x-0 top-0 z-30">
          <StatusBar />
        </div>
      </PhoneFrame>
    </main>
  );
}
