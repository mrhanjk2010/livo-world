"use client";

import { PannableMap } from "@/components/map/pannable-map";
import { CityNode } from "@/components/tilia/city-node";
import { ContinentCanvas } from "@/components/tilia/continent-canvas";
import { FactionSheet } from "@/components/tilia/faction-sheet";
import { CANVAS_H, CANVAS_W, CITIES, type City } from "@/lib/tilia/world";

/**
 * 首屏落地视图：`xPct` 0.20 附近，正好框住极北的维萨、北境联邦几个
 * 小城和歌德恩 —— 也就是女主登上和平号的地方。
 */
const INITIAL_FOCUS_X = 0.2;

/**
 * 大陆势力图（第二层视图）。
 *
 * 还原项目文档里的「世界地图」示意图与「XK-101 势力诉求」表：城邦
 * 位置、派系归属、核心诉求与可采取的行动。主视图是车厢内部，这一层
 * 回答的是「车窗外这片大陆上，谁在盯着女主手里的试管」。
 *
 * 纵向用 `panScale = 1`（地图高度正好等于容器高度）：这张图是
 * 「南北两带 + 冷暖横轴」的读法，两条带必须同屏才看得出谁挨着谁；
 * 纵向没有被裁掉的内容，纵向拖拽也就没有意义。
 *
 * 选中状态由上层持有 —— 底部的航线站点条也要能直接定位到城邦，
 * 所以 selection 不能锁在这个组件内部。
 */
export function ContinentMapScreen({
  selected,
  focusId,
  onPick,
  onClose,
}: {
  selected: City | null;
  focusId: number;
  onPick: (city: City) => void;
  onClose: () => void;
}) {
  return (
    <>
      <PannableMap
        imageWidth={CANVAS_W}
        imageHeight={CANVAS_H}
        initialFocusX={INITIAL_FOCUS_X}
        panScale={1}
        focusXPct={selected?.xPct ?? null}
        focusRequestId={focusId}
      >
        <ContinentCanvas />

        {CITIES.map((c) => (
          <CityNode
            key={c.id}
            city={c}
            selected={selected?.id === c.id}
            onSelect={onPick}
          />
        ))}
      </PannableMap>

      <FactionSheet city={selected} onClose={onClose} />
    </>
  );
}
