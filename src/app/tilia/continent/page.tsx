import { ContinentScreen } from "@/components/tilia/continent-screen";
import { PhoneFrame } from "@/components/mobile/phone-frame";

/**
 * 《蒂利亚之冬》大陆势力图 —— 第二层视图。
 *
 * 还原项目文档里的「世界地图」示意与「XK-101 势力诉求」表：城邦位置、
 * 派系归属、核心诉求与可采取的行动，加上底部那条和平号航线站点条。
 *
 * 它不在设计稿的主地图页里 —— 设计稿 `3378:4318` 那一屏是车厢内部，
 * 底部空间已经给了世界动态卡片和新底导航。所以这块内容独立成页，从
 * 人物面板的「故事核心」里进来。
 */
export default function TiliaContinentPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-neutral-950 md:p-8">
      <PhoneFrame dataName="蒂利亚之冬 · 大陆势力图">
        <ContinentScreen />
      </PhoneFrame>
    </main>
  );
}
