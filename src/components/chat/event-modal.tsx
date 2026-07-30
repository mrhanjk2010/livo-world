"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatRouteBody } from "@/components/chat/chat-route-body";
import { PhoneFrame } from "@/components/mobile/phone-frame";

/**
 * EventModal — iOS-style push overlay for `/event/[location]`.
 *
 * Mirrors `ChatModal` beat-for-beat so the entry/exit animation feels
 * identical between free-chat and event-chat. Destiny locations render
 * `DestinyChatScreen` via `ChatRouteBody`.
 */
const ENTER_MS = 520;
const EXIT_MS = 420;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Phase = "enter" | "open" | "exit";

export function EventModal({ location }: { location: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("enter");

  useEffect(() => {
    if (phase !== "enter") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [phase]);

  const handleBack = () => {
    if (phase === "exit") return;
    setPhase("exit");
    window.setTimeout(() => {
      router.back();
    }, EXIT_MS);
  };

  const transform =
    phase === "open"
      ? "translate3d(0, 0, 0)"
      : "translate3d(100%, 0, 0)";

  const transition =
    phase === "enter"
      ? "none"
      : `transform ${phase === "exit" ? EXIT_MS : ENTER_MS}ms ${EASE}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh w-full items-center justify-center md:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[375px] overflow-hidden md:rounded-[40px]"
        style={{ height: "min(100dvh, 812px)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            transform,
            transition,
            willChange: "transform",
          }}
        >
          <PhoneFrame dataNodeId="1571:5101" dataName="日常事件 (modal)">
            <ChatRouteBody
              location={location}
              mode="event"
              onBack={handleBack}
            />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}
