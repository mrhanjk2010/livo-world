"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { ChatScreen } from "@/components/chat/chat-screen";
import { DestinyChatScreen } from "@/components/tilia/destiny-chat-screen";
import { StatusBar } from "@/components/mobile/status-bar";
import { isDestinyChatLocation } from "@/lib/tilia/destiny-chat";
import { isRoomGroupChatLocation } from "@/lib/tilia/room-group-chat";

/**
 * 聊天路由内容分发：
 *   蒂利亚命运地点 / 车厢地点群聊 → `DestinyChatScreen`
 *   其余校园地点 → 原 `ChatScreen`
 */
export function ChatRouteBody({
  location,
  mode = "free",
  onBack,
}: {
  location: string;
  mode?: "free" | "event";
  onBack?: () => void;
}) {
  const router = useRouter();
  const isTilia =
    isDestinyChatLocation(location) || isRoomGroupChatLocation(location);

  /**
   * 从 modal 里进来时 `onBack` 由 `ChatModal` 给（router.back）。但硬加载
   * 或开发期整页刷新会落到非拦截的独立路由上，那时没人传 onBack ——
   * 不兜底的话左上角「返回」按下去毫无反应，人就被关在聊天里出不去。
   * 有历史就退回去，没有就送回对应世界的地图。
   */
  const fallbackBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(isTilia ? "/tilia/map" : "/map");
  }, [router, isTilia]);

  const handleBack = onBack ?? fallbackBack;

  if (isTilia) {
    return <DestinyChatScreen location={location} onBack={handleBack} />;
  }

  return (
    <>
      <ChatScreen location={location} mode={mode} onBack={handleBack} />
      <div className="absolute inset-x-0 top-0 z-30">
        <StatusBar tone="dark" />
      </div>
    </>
  );
}
