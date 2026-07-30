/**
 * 地图回响标记列表 —— 由种子故事派生坐标。
 * 生成中的回响由 `TiliaMapScreen` 状态追加，不写回本常量。
 */

import { SEED_ECHO_STORIES, type EchoStory } from "@/lib/tilia/echo-story";

export type EchoMarkerDef = {
  id: string;
  title: string;
  xPct: number;
  yPct: number;
  roomId: string;
  storyId: string;
};

export function echoStoryToMarker(story: EchoStory): EchoMarkerDef {
  return {
    id: story.id,
    title: story.title,
    xPct: story.xPct,
    yPct: story.yPct,
    roomId: story.roomId,
    storyId: story.id,
  };
}

export const ECHO_MARKERS: readonly EchoMarkerDef[] =
  SEED_ECHO_STORIES.map(echoStoryToMarker);
