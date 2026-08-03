import { MapScreen } from "@/components/map/map-screen";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { DrillLayer } from "@/components/mobile/drill-layer";
import { EnterLayer } from "@/components/mobile/enter-layer";
import { PhoneFrame } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";

export default function MapPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-white md:p-8">
      <PhoneFrame dataNodeId="1563:48750" dataName="DOLO的世界地图">
        {/*
         * 进群聊时整屏（地图 + 状态栏 + 底 nav）一起往后退，所以它们全在
         * DrillLayer 里；聊天那一层在外面，见 components/mobile/enter-layer。
         */}
        <DrillLayer className="absolute inset-0">
          {/*
           * MapScreen owns every layer that lives inside the
           * ActivitySheetProvider (pannable map, POIs, wandering
           * friends, activity/event/trajectory sheets, AND the
           * transient world-broadcast card — which now opens the
           * 动态 half-sheet on tap and therefore needs the provider
           * in scope). Only purely presentational chrome stays out here.
           */}
          <MapScreen />

          {/* Soft top darken keeps the white status bar legible over light map regions. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[110px] bg-gradient-to-b from-black/30 via-black/10 to-transparent"
          />

          <div className="absolute inset-x-0 top-0 z-30">
            <StatusBar />
          </div>

          <BottomNav defaultActive="discover" />
        </DrillLayer>

        <EnterLayer />
      </PhoneFrame>
    </main>
  );
}
