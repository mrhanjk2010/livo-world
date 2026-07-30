"use client";

import { useEffect, useMemo, useState } from "react";
import { CharacterPin } from "@/components/tilia/character-pin";
import {
  ROOMS,
  STATIONS,
  type Station,
} from "@/lib/tilia/train";

/**
 * 角色在车厢里走动。
 *
 * 起点取自设计稿站位 `STATIONS`；可去的落点是公开房间名牌坐标。
 * 女主走动范围更窄（咖啡厅附近），四位男主在公共车厢之间漫游。
 * 路径用二次贝塞尔，速度按弧长归一，读感是「慢慢踱步」而不是瞬移。
 *
 * 停靠时头像圆心落在名牌**上方**，水滴尖朝下指到名牌 —— 避免圆脸
 * 直接盖住房间名。
 *
 * 互斥：已叠在命运标记里的角色不进漫游池（同一张脸只出现一次）。
 */

const WALK_SPEED = 0.028;
const IDLE_MIN_MS = 5_500;
const IDLE_MAX_MS = 12_000;
const MIN_STEP_MS = 50;

/**
 * 停靠点相对名牌中心的上移量（地图高度归一化）。
 * pin 圆心到水滴尖约半个框高；再留出一点空隙，名牌就不会被挡住。
 */
const STAND_ABOVE_LABEL_Y = 0.058;

type Waypoint = { roomId: string; xPct: number; yPct: number };

type Mode =
  | { kind: "idle"; untilMs: number; at: Waypoint }
  | {
      kind: "moving";
      ax: number;
      ay: number;
      cx: number;
      cy: number;
      bx: number;
      by: number;
      length: number;
      progress: number;
      to: Waypoint;
    };

type Runtime = {
  station: Station;
  x: number;
  y: number;
  mode: Mode;
  /** 允许去的房间 id 列表。 */
  roamIds: readonly string[];
};

const now = () => performance.now();
const randBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

function bezierAt(
  t: number,
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
) {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

function planTrip(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lineDist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / lineDist;
  const perpY = dx / lineDist;
  const tMid = randBetween(0.35, 0.65);
  const midX = ax + dx * tMid;
  const midY = ay + dy * tMid;
  const sign = Math.random() < 0.5 ? -1 : 1;
  const curvature = randBetween(0.1, 0.28) * lineDist * sign;
  const cx = midX + perpX * curvature;
  const cy = midY + perpY * curvature;

  let length = 0;
  let prevX = ax;
  let prevY = ay;
  for (let i = 1; i <= 12; i++) {
    const { x, y } = bezierAt(i / 12, ax, ay, cx, cy, bx, by);
    length += Math.hypot(x - prevX, y - prevY);
    prevX = x;
    prevY = y;
  }
  return { cx, cy, length: length || lineDist };
}

/** 每位角色可漫游的公开房间。女主范围更小，贴近「还在找位置」的感觉。 */
function roamRoomsFor(memberId: string): readonly string[] {
  switch (memberId) {
    case "heroine":
      return ["cafe", "dining", "music-hall", "promenade"];
    case "santing":
      return ["cafe", "dining", "music-hall", "promenade", "greenhouse"];
    case "staen":
      return ["parlour", "dining", "study", "music-hall", "billiard"];
    case "renqingyi":
      return ["dining", "billiard", "cafe", "parlour", "tea-room"];
    case "roland":
      return ["theater", "music-hall", "parlour", "cafe", "billiard"];
    default:
      return ["cafe", "dining", "music-hall"];
  }
}

function pickWaypoint(
  roamIds: readonly string[],
  waypoints: readonly Waypoint[],
  excludeId?: string,
): Waypoint {
  const pool = waypoints.filter(
    (w) => roamIds.includes(w.roomId) && w.roomId !== excludeId,
  );
  const from = pool.length > 0 ? pool : waypoints.filter((w) =>
    roamIds.includes(w.roomId),
  );
  const safe = from.length > 0 ? from : waypoints;
  return safe[Math.floor(Math.random() * safe.length)];
}

function advance(
  r: Runtime,
  dt: number,
  waypoints: readonly Waypoint[],
): Runtime {
  const t = now();

  if (r.mode.kind === "idle") {
    if (t < r.mode.untilMs) return r;
    const to = pickWaypoint(r.roamIds, waypoints, r.mode.at.roomId);
    const trip = planTrip(r.x, r.y, to.xPct, to.yPct);
    return {
      ...r,
      mode: {
        kind: "moving",
        ax: r.x,
        ay: r.y,
        cx: trip.cx,
        cy: trip.cy,
        bx: to.xPct,
        by: to.yPct,
        length: trip.length,
        progress: 0,
        to,
      },
    };
  }

  const step = (WALK_SPEED * dt) / Math.max(r.mode.length, 0.001);
  const progress = Math.min(1, r.mode.progress + step);
  const { x, y } = bezierAt(
    progress,
    r.mode.ax,
    r.mode.ay,
    r.mode.cx,
    r.mode.cy,
    r.mode.bx,
    r.mode.by,
  );

  if (progress >= 1) {
    return {
      ...r,
      x: r.mode.bx,
      y: r.mode.by,
      mode: {
        kind: "idle",
        untilMs: t + randBetween(IDLE_MIN_MS, IDLE_MAX_MS),
        at: r.mode.to,
      },
    };
  }

  return { ...r, x, y, mode: { ...r.mode, progress } };
}

export function WanderingCast({
  occupiedMemberIds,
}: {
  /** 命运叠放占用的角色，渲染时隐去。 */
  occupiedMemberIds: ReadonlySet<string>;
}) {
  const waypoints = useMemo<Waypoint[]>(
    () =>
      ROOMS.filter((r) => r.tier === "public").map((r) => ({
        roomId: r.id,
        xPct: r.xPct,
        // 停在名牌上方，不盖住房间名。
        yPct: Math.max(0.04, r.yPct - STAND_ABOVE_LABEL_Y),
      })),
    [],
  );

  const [runtime, setRuntime] = useState<Runtime[]>(() =>
    STATIONS.map((station) => {
      const roamIds = roamRoomsFor(station.memberId);
      const home: Waypoint = {
        roomId: station.roomId,
        xPct: station.xPct,
        yPct: station.yPct,
      };
      return {
        station,
        x: station.xPct,
        y: station.yPct,
        roamIds,
        mode: {
          kind: "idle" as const,
          // 错开首批启程，避免多人同时起步。
          untilMs: now() + randBetween(1_200, 6_000),
          at: home,
        },
      };
    }),
  );

  useEffect(() => {
    let raf = 0;
    let last = now();
    let pendingSince = last;

    const tick = (t: number) => {
      if (t - pendingSince >= MIN_STEP_MS) {
        const dt = Math.min(0.2, (t - last) / 1000);
        last = t;
        pendingSince = t;
        setRuntime((prev) => prev.map((r) => advance(r, dt, waypoints)));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [waypoints]);

  const visible = runtime.filter(
    (r) => !occupiedMemberIds.has(r.station.memberId),
  );

  return (
    <>
      {visible.map((r) => {
        // 同坐标时横向错开一点，避免头像完全叠死。
        const twins = visible.filter(
          (o) =>
            Math.abs(o.x - r.x) < 0.012 && Math.abs(o.y - r.y) < 0.012,
        );
        const twinIdx = twins.findIndex(
          (o) => o.station.memberId === r.station.memberId,
        );
        const xOffset =
          twins.length > 1
            ? (twinIdx - (twins.length - 1) / 2) * 0.028
            : 0;

        return (
          <CharacterPin
            key={r.station.memberId}
            station={r.station}
            xPct={r.x + xOffset}
            yPct={r.y}
            moving={r.mode.kind === "moving"}
          />
        );
      })}
    </>
  );
}
