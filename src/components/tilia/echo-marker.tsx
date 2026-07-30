"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { ECHO_ORB_CORE, EchoOrb } from "@/components/tilia/echo-orb";
import type { EchoMarkerDef } from "@/lib/tilia/echo-markers";

/** 地图上的世界回响标记（设计稿 `3387:9620`）。图层见 `EchoOrb`。 */
export function EchoMarker({
  marker,
  onOpen,
}: {
  marker: EchoMarkerDef;
  onOpen: (marker: EchoMarkerDef) => void;
}) {
  const swallow = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <button
      type="button"
      onPointerDown={swallow}
      onClick={() => onOpen(marker)}
      aria-label={`世界回响：${marker.title}`}
      className="absolute z-[24] -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 active:scale-95"
      style={{
        width: ECHO_ORB_CORE,
        height: ECHO_ORB_CORE,
        left: `${marker.xPct * 100}%`,
        top: `${marker.yPct * 100}%`,
      }}
    >
      <EchoOrb />
    </button>
  );
}
