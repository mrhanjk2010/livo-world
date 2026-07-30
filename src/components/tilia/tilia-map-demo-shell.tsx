"use client";

import { DemoModeProvider } from "@/components/tilia/demo-mode-context";
import { DemoStoryNotes } from "@/components/tilia/demo-story-notes";
import { DemoSystemMenu } from "@/components/tilia/demo-system-menu";
import { PhoneFrame } from "@/components/mobile/phone-frame";
import { TiliaMapScreen } from "@/components/tilia/tilia-map-screen";

/**
 * 地图页手机框壳。
 * 手机框保持视口居中（与 ChatModal / EventModal 对齐）；
 * Demo 说明与菜单绝对挂在框两侧，不挤占居中布局。
 */
export function TiliaMapDemoShell() {
  return (
    <DemoModeProvider>
      <main className="relative flex min-h-dvh w-full items-center justify-center bg-neutral-950 md:p-8">
        <div className="relative w-full max-w-[375px]">
          <PhoneFrame dataName="蒂利亚之冬 · 世界地图" dataNodeId="3378:4318">
            <TiliaMapScreen />
          </PhoneFrame>
          <div className="absolute right-[calc(100%+28px)] top-1/2 hidden -translate-y-1/2 lg:block">
            <DemoStoryNotes />
          </div>
          <div className="absolute left-[calc(100%+28px)] top-1/2 hidden -translate-y-1/2 sm:block">
            <DemoSystemMenu />
          </div>
        </div>
      </main>
    </DemoModeProvider>
  );
}
