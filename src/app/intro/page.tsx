import { IntroScreen } from "@/components/mobile/intro-screen";
import { PhoneFrame } from "@/components/mobile/phone-frame";

/**
 * DOLO 的开场视频流程。
 *
 * 原来挂在 `/`，2026-07-28 首页改为直接落地《蒂利亚之冬》世界地图后
 * 迁到这里，这样旧的「视频 → DOLO 地图」演示路径不会丢。播完或点
 * 「跳过」仍然进 `/map`。
 */
export default function IntroPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-neutral-50 md:p-8 dark:bg-neutral-950">
      <PhoneFrame
        dataNodeId="1576:5871"
        dataName="进入世界地图的视频物料"
      >
        <IntroScreen />
      </PhoneFrame>
    </main>
  );
}
