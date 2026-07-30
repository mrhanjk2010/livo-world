"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { PannableMap } from "@/components/map/pannable-map";
import {
  useTrajectory,
  type TrajectorySubject,
} from "@/components/map/trajectory-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import {
  FIGMA_MAP_H,
  FIGMA_MAP_W,
  POIS,
  POI_BY_LABEL,
  poiMapPct,
} from "@/lib/map-pois";
import {
  ACTION_SNAP_MINUTES,
  formatMinutes,
  TRAJECTORIES,
  TRAJECTORY_BY_NAME,
  TRAJECTORY_SPAN_MINUTES,
  TRAJECTORY_TIME_LABELS,
  type FriendTrajectory,
  type TrajectoryPoint,
} from "@/lib/trajectories";

/**
 * Full-screen "活动轨迹" overlay — Figma 1576:6500.
 *
 * Unlike a typical static trajectory chart, this overlay reuses the
 * home map (same background, same POI chips) with a black tint on
 * top, and replays each character's last 24 hours as a live
 * walk-around:
 *
 *   • Characters slide along their trajectory path in real time
 *     (autoplay loops the 24h span in ~18s so they "keep moving").
 *   • The path each character has WALKED so far is drawn as a
 *     trailing ribbon behind them — scrubbing back shortens the
 *     trail, scrubbing forward extends it.
 *   • Each character keeps a tiny black speech chip above their head
 *     that narrates the current action, mirroring the home page's
 *     FriendCluster visual language.
 *
 * Lifecycle is driven by `TrajectoryContext`: `open(subject)` from
 * the activity-sheet's 活动轨迹 pill mounts this overlay (subject
 * can be a friend name, or `null` for 全部角色); `close()` fades
 * it out. Users can swap subjects in-overlay via the top-left pill.
 */

// ── Geometry: map-image layout mirrored from the home page ──────────────

/**
 * The overlay wraps the home map in a `PannableMap` whose inner div
 * represents the map image in its native 1024×877 aspect (same as
 * `MapScreen`). POIs, trails, and characters are all positioned
 * inside that inner div via percentages of `FIGMA_MAP_W × FIGMA_MAP_H`
 * (906×1624), i.e. the Figma map-layer frame — which is what
 * `poiMapPct` returns and what the home page uses for `POIPin`.
 * This keeps every pixel aligned with the home page as the user
 * pans left/right.
 */
const MAP_NATIVE_W = 1006;
const MAP_NATIVE_H = 1024;

// ── Trajectory → polyline sampling ───────────────────────────────────────

type Sample = {
  /** Frame-space X in Figma units (0..750). */
  x: number;
  /** Frame-space Y in Figma units (0..1624). */
  y: number;
  /** Minutes since T-24h (0..1440). */
  t: number;
};

/**
 * Convert one waypoint into map-image-space coordinates (0..906
 * horizontally, 0..1624 vertically) — the anchor sits on top of the
 * POI chip so MovingFriend's arrow-tip and the SVG trail both meet
 * the POI label exactly. Coordinates are shifted by +78 to move
 * from Figma frame space into the map image's own space.
 */
function waypointXY(label: string): { x: number; y: number } {
  const p = POI_BY_LABEL[label];
  if (!p) return { x: FIGMA_MAP_W / 2, y: FIGMA_MAP_H / 2 };
  return { x: p.figmaCenterX + 78, y: p.figmaTopY };
}

/**
 * Sample each trajectory segment as a gentle quadratic-bezier curve
 * (same curve family as the home page's `WanderingFriends.planTrip`
 * — perpendicular offset, alternating sides, curvature ∝ length).
 * The returned polyline is timestamped so both the trail path and
 * the character position are derivable from one lookup.
 */
function buildPolyline(points: readonly TrajectoryPoint[]): Sample[] {
  if (points.length === 0) return [];
  const samples: Sample[] = [];
  const first = waypointXY(points[0].location);
  samples.push({ x: first.x, y: first.y, t: points[0].t });

  const SAMPLES_PER_SEG = 24;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ap = waypointXY(a.location);
    const bp = waypointXY(b.location);
    const dx = bp.x - ap.x;
    const dy = bp.y - ap.y;
    const len = Math.hypot(dx, dy);

    // Straight-line segment when both waypoints are the same POI
    // (character is loitering). No curve, no wiggles — just extend
    // the timeline so `positionAt` can interpolate duration.
    let cx = (ap.x + bp.x) / 2;
    let cy = (ap.y + bp.y) / 2;
    if (len > 1) {
      const sign = i % 2 === 0 ? 1 : -1;
      const curve = Math.min(len * 0.18, 70) * sign;
      cx += (-dy / len) * curve;
      cy += (dx / len) * curve;
    }

    for (let j = 1; j <= SAMPLES_PER_SEG; j++) {
      const u = j / SAMPLES_PER_SEG;
      const inv = 1 - u;
      const x = inv * inv * ap.x + 2 * inv * u * cx + u * u * bp.x;
      const y = inv * inv * ap.y + 2 * inv * u * cy + u * u * bp.y;
      const t = a.t + (b.t - a.t) * u;
      samples.push({ x, y, t });
    }
  }
  return samples;
}

/** Interpolate (linearly between adjacent samples) the position at time t. */
function positionAt(samples: readonly Sample[], t: number): { x: number; y: number } {
  if (samples.length === 0) return { x: 0, y: 0 };
  if (t <= samples[0].t) return { x: samples[0].x, y: samples[0].y };
  const last = samples[samples.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  // Polyline is short (<200 samples per friend); linear scan is fine.
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].t >= t) {
      const a = samples[i - 1];
      const b = samples[i];
      const ratio = (t - a.t) / Math.max(0.001, b.t - a.t);
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
      };
    }
  }
  return { x: last.x, y: last.y };
}

/**
 * Build an SVG `d` string tracing all samples with `t <= current`,
 * plus an interpolated endpoint exactly AT `current`. The endpoint
 * interpolation is what gives the trail its "growing behind the
 * avatar" feel — otherwise the trail would snap forward one full
 * sample step at a time.
 */
function trailPath(samples: readonly Sample[], current: number): string {
  if (samples.length === 0 || current <= samples[0].t) return "";
  let d = `M ${samples[0].x.toFixed(1)} ${samples[0].y.toFixed(1)}`;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    if (s.t <= current) {
      d += ` L ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    } else {
      const prev = samples[i - 1];
      const ratio = (current - prev.t) / Math.max(0.001, s.t - prev.t);
      const x = prev.x + (s.x - prev.x) * ratio;
      const y = prev.y + (s.y - prev.y) * ratio;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      break;
    }
  }
  return d;
}

/**
 * Compute the character's "doing right now" narration at time t.
 * Snaps to a waypoint's own action if within SNAP minutes of it;
 * otherwise synthesizes "去{next}的路上". If the current and next
 * waypoint are the SAME POI, it means the character is loitering
 * — keep showing the earlier action rather than inventing a walk.
 */
function currentAction(points: readonly TrajectoryPoint[], t: number): string {
  if (points.length === 0) return "";
  if (t <= points[0].t) return points[0].action;
  const last = points[points.length - 1];
  if (t >= last.t) return last.action;

  let segIdx = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (t >= points[i].t) {
      segIdx = i;
      break;
    }
  }
  const a = points[segIdx];
  const b = points[Math.min(segIdx + 1, points.length - 1)];
  if (Math.abs(t - a.t) <= ACTION_SNAP_MINUTES) return a.action;
  if (Math.abs(t - b.t) <= ACTION_SNAP_MINUTES) return b.action;
  if (a.location === b.location) return a.action;
  return `去${b.location}的路上`;
}

// ── Playback parameters ─────────────────────────────────────────────────

/** Minutes of trajectory time per real-world second during playback. */
const PLAY_SPEED_MIN_PER_SEC = 90;
/** Brief pause at the end of the loop before resetting — reads as a beat. */
const END_PAUSE_MS = 1500;

// ── Component ───────────────────────────────────────────────────────────

export function TrajectoryOverlay() {
  const { subject, setSubject, close } = useTrajectory();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mountedSubject, setMountedSubject] = useState<TrajectorySubject>(null);
  const overlayRoot = usePhoneOverlayRoot();

  // Scrubber state — autoplay from 0 when opened so characters are
  // already moving the moment the overlay becomes visible.
  const [currentT, setCurrentT] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (subject === undefined) {
      if (mounted) {
        setVisible(false);
        const t = setTimeout(() => setMounted(false), 280);
        return () => clearTimeout(t);
      }
      return;
    }
    setMountedSubject(subject);
    setMounted(true);
    setCurrentT(0);
    setPlaying(true);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [subject, mounted]);

  // rAF-driven playback loop: time advances at PLAY_SPEED, wraps at
  // the end with a short beat so the loop transition doesn't feel
  // jarring. Characters stay "always moving" without user input.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastTs: number | null = null;
    let endHoldUntil: number | null = null;
    const step = (ts: number) => {
      if (lastTs == null) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      setCurrentT((prev) => {
        if (endHoldUntil != null) {
          if (ts >= endHoldUntil) {
            endHoldUntil = null;
            return 0;
          }
          return prev;
        }
        const next = prev + dt * PLAY_SPEED_MIN_PER_SEC;
        if (next >= TRAJECTORY_SPAN_MINUTES) {
          endHoldUntil = ts + END_PAUSE_MS;
          return TRAJECTORY_SPAN_MINUTES;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, close]);

  const active: readonly FriendTrajectory[] = useMemo(
    () =>
      mountedSubject === null
        ? TRAJECTORIES
        : TRAJECTORIES.filter((t) => t.name === mountedSubject),
    [mountedSubject],
  );

  // Precompute polylines — stable per subject so `useMemo` keyed by
  // the active roster is enough. Rebuilt only when the roster changes,
  // which is very rarely (subject swap).
  const polylines = useMemo(() => {
    const map = new Map<string, Sample[]>();
    for (const friend of active) {
      map.set(friend.name, buildPolyline(friend.points));
    }
    return map;
  }, [active]);

  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div
      className={`pointer-events-auto absolute inset-0 z-[70] transition-opacity duration-[260ms] ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Map layer — reuses the home page's PannableMap so users can
          drag horizontally. POIs / trails / characters live INSIDE
          the panned div so they follow the map; the black tint sits
          on top of the map image but UNDER the trail layer so it
          uniformly darkens the background without muting content. */}
      <PannableMap
        imageWidth={MAP_NATIVE_W}
        imageHeight={MAP_NATIVE_H}
        initialFocusX={0.55}
        className="bg-black"
      >
        <Image
          src="/figma/map/map-bg.png"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 950px, 200vw"
          className="object-cover"
          draggable={false}
        />

        {/* Black tint — darkens the landscape so the replay layer
            (trails, characters) pops. Pans with the map. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black/55"
        />

        {/* Static POI chips — same look as the home page, no event
            badge or click handler (this view is read-only). */}
        {POIS.map((poi) => {
          const pct = poiMapPct(poi.label);
          return (
            <StaticPOIChip
              key={poi.label}
              xPct={pct.xPct}
              yPct={pct.yPct}
              label={poi.label}
            />
          );
        })}

        {/* Trails: drawn in map-image coords so they pass exactly
            through each POI chip's top edge. viewBox matches the
            906×1624 Figma map frame; `preserveAspectRatio="none"`
            lets SVG coords map linearly to container percentages. */}
        <svg
          aria-hidden
          viewBox={`0 0 ${FIGMA_MAP_W} ${FIGMA_MAP_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
        >
          {active.map((friend) => {
            const samples = polylines.get(friend.name) ?? [];
            const d = trailPath(samples, currentT);
            if (!d) return null;
            return (
              <g key={friend.name}>
                <path
                  d={d}
                  fill="none"
                  stroke={friend.color}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.22}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={friend.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
                {friend.points.map((p, i) => {
                  if (p.t > currentT) return null;
                  const xy = waypointXY(p.location);
                  return (
                    <circle
                      key={i}
                      cx={xy.x}
                      cy={xy.y}
                      r={6}
                      fill={friend.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      opacity={0.95}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Moving characters — avatar + speech chip above each one,
            positioned at the trail's current endpoint. */}
        {active.map((friend) => {
          const samples = polylines.get(friend.name) ?? [];
          const pos = positionAt(samples, currentT);
          const action = currentAction(friend.points, currentT);
          return (
            <MovingFriend
              key={friend.name}
              name={friend.name}
              avatarSrc={friend.avatarSrc}
              color={friend.color}
              speech={action}
              xPct={pos.x / FIGMA_MAP_W}
              yPct={pos.y / FIGMA_MAP_H}
              onSelect={
                active.length > 1 ? () => setSubject(friend.name) : undefined
              }
            />
          );
        })}
      </PannableMap>

      {/* Header: subject picker · live clock · close button.
          The clock is intentionally text-only (no pill / no backdrop)
          per spec — it rides quietly next to the close button. */}
      <div className="absolute inset-x-[14px] top-[54px] z-10 flex items-center gap-[10px]">
        <SubjectPicker
          subject={mountedSubject}
          onPick={(next) => setSubject(next)}
        />
        <div className="flex-1" />
        <span
          aria-label="当前回放时间"
          className="shrink-0 text-[14px] font-light leading-none text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
        >
          {formatMinutes(currentT)}
        </span>
        <button
          type="button"
          aria-label="关闭活动轨迹"
          onClick={close}
          className="flex size-[40px] shrink-0 items-center justify-center rounded-full bg-white/80 text-black shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] backdrop-blur-[4px] transition-transform active:scale-95"
        >
          <CloseIcon />
        </button>
      </div>

      <Scrubber
        t={currentT}
        onChangeT={setCurrentT}
        onDragStart={() => setPlaying(false)}
        onDragEnd={() => {
          // If user scrubbed to the end, rewind so autoplay keeps
          // the characters moving instead of sitting at 1440.
          setCurrentT((prev) =>
            prev >= TRAJECTORY_SPAN_MINUTES ? 0 : prev,
          );
          setPlaying(true);
        }}
      />
    </div>,
    overlayRoot,
  );
}

// ── Static POI chip (non-interactive clone of POIPin) ───────────────────

/**
 * POI pill rendered in frame-space coordinates. Matches POIPin's
 * look (white translucent bg, pin icon + label) but drops the event
 * badge and click handler — trajectory overlay is a replay, not a
 * navigation surface.
 */
function StaticPOIChip({
  xPct,
  yPct,
  label,
}: {
  xPct: number;
  yPct: number;
  label: string;
}) {
  return (
    <div
      className="pointer-events-none absolute inline-flex -translate-x-1/2 items-center justify-center gap-[2px] rounded-[16px] bg-white/85 px-[8px] py-[4px] shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-[4px]"
      style={{ left: `${xPct * 100}%`, top: `${yPct * 100}%` }}
    >
      <Image
        src="/figma/map/poi-pin.svg"
        alt=""
        width={14}
        height={14}
        draggable={false}
      />
      <span className="whitespace-nowrap text-[10px] font-light text-black">
        {label}
      </span>
    </div>
  );
}

// ── Moving friend cluster ────────────────────────────────────────────────

/**
 * Avatar + speech chip + down-arrow, same vocabulary as the home
 * page's FriendCluster. Positioned with absolute percentages in the
 * map-image space (0..1 of FIGMA_MAP_W × FIGMA_MAP_H), so it pans
 * with the underlying PannableMap in lockstep with the POI chips.
 * The anchor point is the arrow tip — so as the character walks,
 * the tip follows the trail endpoint exactly.
 */
function MovingFriend({
  name,
  avatarSrc,
  color,
  speech,
  xPct,
  yPct,
  onSelect,
}: {
  name: string;
  avatarSrc: string;
  color: string;
  speech: string;
  /** Map-image-space X as fraction of FIGMA_MAP_W. */
  xPct: number;
  /** Map-image-space Y as fraction of FIGMA_MAP_H (anchor = arrow tip). */
  yPct: number;
  onSelect?: () => void;
}) {
  const interactive = onSelect != null;
  return (
    <div
      className="absolute z-[6] flex flex-col items-center"
      style={{
        left: `${xPct * 100}%`,
        top: `${yPct * 100}%`,
        transform: "translate(-50%, -100%)",
      }}
    >
      {/* Speech chip above the avatar. Semi-transparent black bg
          matches the home page's FriendCluster exactly — users see
          the same visual language on both surfaces. */}
      <div className="mb-[4px] inline-flex items-center justify-center rounded-[16px] bg-black/55 px-[8px] py-[2px] backdrop-blur-[4px]">
        <span className="whitespace-nowrap text-[10px] font-light leading-[1.4] text-white">
          {name}：{speech}
        </span>
      </div>

      {/* Avatar. In multi-subject mode tapping the avatar swaps the
          overlay's focus to that friend — lets viewers zoom into a
          single path without closing and re-opening. */}
      <button
        type="button"
        disabled={!interactive}
        onClick={interactive ? onSelect : undefined}
        aria-label={`${name}的活动轨迹`}
        className={`relative size-[40px] shrink-0 overflow-hidden rounded-full border-2 bg-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.55)] ${
          interactive
            ? "cursor-pointer transition-transform active:scale-95"
            : "pointer-events-none"
        }`}
        style={{ borderColor: color }}
      >
        <Image
          src={avatarSrc}
          alt=""
          fill
          sizes="40px"
          className="object-cover"
          draggable={false}
        />
      </button>

      {/* Down-arrow tipped with the friend's color so the arrow
          visually threads into the trail beneath. */}
      <span
        aria-hidden
        className="-mt-[1px] block size-0"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `10px solid ${color}`,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
        }}
      />
    </div>
  );
}

// ── Subject picker ──────────────────────────────────────────────────────

function SubjectPicker({
  subject,
  onPick,
}: {
  subject: TrajectorySubject;
  onPick: (next: TrajectorySubject) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const current = subject === null ? null : TRAJECTORY_BY_NAME[subject] ?? null;
  const title =
    subject === null ? "全部角色的活动轨迹" : `${subject}的活动轨迹`;

  return (
    <div ref={rootRef} className="relative flex min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-[8px] rounded-full bg-white/85 py-[5px] pl-[5px] pr-[12px] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] backdrop-blur-[4px] transition-colors hover:bg-white/95"
      >
        <span className="relative flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          {current ? (
            <Image
              src={current.avatarSrc}
              alt=""
              fill
              sizes="30px"
              className="object-cover"
              draggable={false}
            />
          ) : (
            <Image
              src="/figma/map/dolo-planet.svg"
              alt=""
              width={22}
              height={22}
              draggable={false}
            />
          )}
        </span>
        <span className="truncate text-[13px] font-semibold leading-none text-black">
          {title}
        </span>
        <ChevronDownIcon
          className={`size-[14px] shrink-0 text-black/60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-[6px] w-[200px] overflow-hidden rounded-[12px] bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.06]"
        >
          {TRAJECTORIES.map((t) => (
            <SubjectOption
              key={t.name}
              active={subject === t.name}
              onClick={() => {
                setOpen(false);
                onPick(t.name);
              }}
              leading={
                <span className="relative size-[24px] overflow-hidden rounded-full">
                  <Image
                    src={t.avatarSrc}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                </span>
              }
              label={t.name}
              swatchColor={t.color}
            />
          ))}
          <div className="mx-[8px] h-px bg-black/[0.06]" />
          <SubjectOption
            active={subject === null}
            onClick={() => {
              setOpen(false);
              onPick(null);
            }}
            leading={
              <Image
                src="/figma/map/dolo-planet.svg"
                alt=""
                width={20}
                height={20}
              />
            }
            label="全部角色"
          />
        </div>
      )}
    </div>
  );
}

function SubjectOption({
  active,
  leading,
  label,
  swatchColor,
  onClick,
}: {
  active: boolean;
  leading: React.ReactNode;
  label: string;
  swatchColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-center gap-[10px] px-[12px] py-[10px] text-left transition-colors hover:bg-black/[0.04] ${
        active ? "bg-black/[0.03]" : ""
      }`}
    >
      <span className="flex size-[24px] shrink-0 items-center justify-center">
        {leading}
      </span>
      <span className="flex-1 truncate text-[14px] font-medium leading-none text-black">
        {label}
      </span>
      {swatchColor ? (
        <span
          className="size-[10px] shrink-0 rounded-full"
          style={{ backgroundColor: swatchColor }}
        />
      ) : null}
    </button>
  );
}

// ── Scrubber ────────────────────────────────────────────────────────────

function Scrubber({
  t,
  onChangeT,
  onDragStart,
  onDragEnd,
}: {
  t: number;
  onChangeT: (next: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const ratio = Math.max(0, Math.min(1, t / TRAJECTORY_SPAN_MINUTES));

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChangeT(x * TRAJECTORY_SPAN_MINUTES);
  };

  const beginDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      onDragStart();
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    onDragEnd();
  };

  // Strict Figma mapping (frame 1698:8727, design at 2× → code at 1×):
  //   • Track:   h=10 →  5,   w=654 → 327 (inset 48 → 24 both sides),
  //              rounded-[5] → rounded-full, bg=#fff@0.8, blur 4.
  //   • Thumb:   48×96 → 24×48, rounded-[24] → rounded-full,
  //              bg=#fff@0.9, blur 4. No shadow.
  //   • Grip:    24×4 → 12×2, radius 2 → 1, color #999, gap 8 → 4.
  //              The two vertical bars are a *drag-handle indicator*
  //              (not a play/pause icon) — playback runs on its own.
  //   • Labels:  font-size 20 → 10, color #fff, no drop-shadow.
  //   • Layout:  track bottom ≈ 28px from frame bottom; label→track
  //              gap ≈ 14px (same as before).
  //
  // The Figma frame does NOT show a progress-fill sub-bar or any
  // drop-shadow on track/thumb, so both are intentionally dropped
  // here to match the spec exactly.
  return (
    <div className="pointer-events-auto absolute inset-x-[24px] bottom-[28px] z-10">
      <div className="mb-[14px] flex items-center justify-between text-[10px] font-light leading-none text-white">
        <span>{TRAJECTORY_TIME_LABELS.start}</span>
        <span>{TRAJECTORY_TIME_LABELS.end}</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="拖动查看时间轴"
        aria-valuemin={0}
        aria-valuemax={TRAJECTORY_SPAN_MINUTES}
        aria-valuenow={Math.round(t)}
        className="relative h-[5px] w-full touch-none rounded-full bg-white/80 backdrop-blur-[4px]"
        onPointerDown={beginDrag}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 flex h-[24px] w-[48px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 backdrop-blur-[4px]"
          // Inset the thumb's travel by half its width on each end so
          // the pill never hangs off the track: at t=0 its left edge
          // aligns with the track's left edge, at t=1 its right edge
          // aligns with the track's right edge.
          style={{ left: `calc(24px + (100% - 48px) * ${ratio})` }}
        >
          <span className="flex items-center gap-[4px]">
            <span className="block h-[12px] w-[2px] rounded-[1px] bg-[#999]" />
            <span className="block h-[12px] w-[2px] rounded-[1px] bg-[#999]" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[20px]"
    >
      <path d="M6 6l12 12M6 18 18 6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
