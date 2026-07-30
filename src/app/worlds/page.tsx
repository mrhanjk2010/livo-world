import { PhoneFrame } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { WorldSwitcher } from "@/components/worlds/world-switcher";

/**
 * /worlds — the Livo 世界 world picker. Reached by tapping the DOLO chip
 * on the map page. Magnetic horizontal carousel of world cards, with an
 * "进入世界" CTA that routes into the selected world's map.
 */
export default function WorldsPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-white md:p-8">
      <PhoneFrame
        dataNodeId="1745:22997"
        dataName="切换世界"
        className="!bg-black md:!shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
      >
        <WorldSwitcher />

        {/* Status bar sits above the switcher, same pattern as the map page. */}
        <div className="absolute inset-x-0 top-0 z-30">
          <StatusBar />
        </div>
      </PhoneFrame>
    </main>
  );
}
