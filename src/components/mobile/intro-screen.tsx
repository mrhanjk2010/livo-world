"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { SkipButton } from "@/components/mobile/skip-button";
import { StatusBar } from "@/components/mobile/status-bar";

const NEXT_ROUTE = "/map";

export function IntroScreen() {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);

  const goToMap = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.push(NEXT_ROUTE);
  }, [router]);

  useEffect(() => {
    router.prefetch(NEXT_ROUTE);
  }, [router]);

  return (
    <>
      <video
        src="/media/dolo-intro.mp4"
        autoPlay
        muted
        loop={false}
        playsInline
        preload="auto"
        aria-label="主线开头视频"
        onEnded={goToMap}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[160px] bg-gradient-to-b from-black/45 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px] bg-gradient-to-t from-black/35 to-transparent"
      />

      <div className="relative z-10 flex flex-col">
        <StatusBar />
        <div className="flex h-[48px] w-full shrink-0 items-center justify-end px-[16px]">
          <SkipButton onClick={goToMap} />
        </div>
      </div>

      <BottomNav defaultActive="discover" />
    </>
  );
}
