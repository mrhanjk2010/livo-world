"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  useActivitySheet,
  type ActivitySubject,
} from "@/components/map/activity-sheet-context";
import {
  useFriendsStatus,
  type FriendStatus,
} from "@/components/map/friends-status-context";
import { useTrajectory } from "@/components/map/trajectory-context";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";

// ─── Data ────────────────────────────────────────────────────────────────

/**
 * Mock historical activity per friend. The top "现在" row is merged in
 * live from `FriendsStatus`, so this table only needs past items.
 */
const CHARACTER_HISTORY: Record<
  string,
  readonly { time: string; location: string; body: string }[]
> = {
  周往: [
    { time: "18:00", location: "食堂", body: "吃完晚饭准备绕路回宿舍" },
    {
      time: "17:00",
      location: "学校大门",
      body: "在门口的小摊买水，顺便买了一包猫粮",
    },
    { time: "16:00", location: "体育馆", body: "约了人打篮球，玩了整整一小时" },
    {
      time: "15:00",
      location: "后山",
      body: "给流浪猫喂粮，它又带来了一只小奶猫",
    },
  ],
  钟辰时: [
    {
      time: "18:00",
      location: "图书馆",
      body: "终于把那道困扰一天的数学题解出来了",
    },
    { time: "17:00", location: "教室", body: "跟几个同学讨论明天的模拟考" },
    { time: "16:00", location: "食堂", body: "随便扒了两口饭，怕错过开放时间" },
    { time: "15:00", location: "图书馆", body: "借了一本新的参考书" },
  ],
  叶恒: [
    { time: "18:00", location: "操场", body: "在操场散步，思考下节课的习题" },
    { time: "17:00", location: "图书馆", body: "帮同学讲解了一道函数题" },
    { time: "16:00", location: "教室", body: "收拾书包准备去图书馆" },
    { time: "15:00", location: "食堂", body: "慢条斯理地喝了一杯冰美式" },
  ],
  夏季: [
    { time: "18:00", location: "教室", body: "正在教室打扫卫生，擦得特别干净" },
    { time: "17:00", location: "操场", body: "陪朋友跑了五圈，气喘吁吁" },
    { time: "16:00", location: "学校大门", body: "在门口等晚归的同学" },
    { time: "15:00", location: "食堂", body: "帮朋友占了个靠窗的好位置" },
  ],
};

/** World-level (non-character) events — shown when subject = 全世界. */
const WORLD_EVENTS: readonly {
  time: string;
  location: string;
  body: string;
}[] = [
  {
    time: "18:30",
    location: "河边",
    body: "台风第二天，降水越来越大，河边的一棵老树刚刚被水冲倒了",
  },
  {
    time: "17:30",
    location: "广播站",
    body: "校园广播站开始播报晚间新闻，提醒同学注意防风",
  },
  {
    time: "15:30",
    location: "世界动态",
    body: "台风预警升级为橙色，全城中小学提前放学",
  },
];

const FRIEND_ORDER: readonly string[] = ["周往", "钟辰时", "叶恒", "夏季"];

/** Static "now" label — matches the Figma mock. */
const NOW_LABEL = "现在 18:45";

type FeedItem = {
  id: string;
  timeLabel: string;
  isNow: boolean;
  owner: "world" | string;
  displayName: string;
  avatarSrc: string | null;
  /** Human-readable location displayed in the 📌 pill (may be "路上"). */
  location: string;
  /**
   * Real POI label used when the user taps the card to open its
   * free-chat. For walking characters the on-screen `location` is
   * "路上" — we still route to their target POI (`chatLocation`) so
   * taps always land in a real place chat.
   */
  chatLocation: string;
  body: string;
};

function avatarFor(name: string, live: readonly FriendStatus[]): string {
  return live.find((f) => f.name === name)?.avatarSrc ?? "";
}

/**
 * Build the timeline for the current subject. Top entries ("现在") come
 * from the live `FriendsStatus` snapshot so the sheet always mirrors what
 * the map is showing right now.
 */
function buildFeed(
  subject: ActivitySubject,
  live: readonly FriendStatus[],
): FeedItem[] {
  if (subject === null) {
    // 全世界: live snapshot of every friend pinned on top, followed by a
    // merged history of world events + per-friend past activities, sorted
    // by time descending.
    const nowRows: FeedItem[] = FRIEND_ORDER.flatMap((name) => {
      const s = live.find((x) => x.name === name);
      return s
        ? [
            {
              id: `now-${name}`,
              timeLabel: NOW_LABEL,
              isNow: true,
              owner: name,
              displayName: name,
              avatarSrc: s.avatarSrc,
              location: s.location,
              chatLocation: s.chatLocation,
              // The 动态 sheet is a *log* of activities, so the
              // "now" row reads as a full action description (e.g.
              // "在喂流浪猫") to match the historical entries
              // beneath it and the world-broadcast pills on the
              // map. The single-emoji mood lives only on the
              // tighter surfaces (avatar bubble + roster row).
              body: s.action || "—",
            } satisfies FeedItem,
          ]
        : [];
    });

    const past: FeedItem[] = [];
    for (const w of WORLD_EVENTS) {
      past.push({
        id: `world-${w.time}`,
        timeLabel: w.time,
        isNow: false,
        owner: "world",
        displayName: "世界动态",
        avatarSrc: null,
        location: w.location,
        chatLocation: w.location,
        body: w.body,
      });
    }
    for (const name of FRIEND_ORDER) {
      for (const e of CHARACTER_HISTORY[name] ?? []) {
        past.push({
          id: `${name}-${e.time}`,
          timeLabel: e.time,
          isNow: false,
          owner: name,
          displayName: name,
          avatarSrc: avatarFor(name, live),
          location: e.location,
          chatLocation: e.location,
          body: e.body,
        });
      }
    }
    past.sort((a, b) => b.timeLabel.localeCompare(a.timeLabel));
    return [...nowRows, ...past];
  }

  // Single-character view.
  const live1 = live.find((x) => x.name === subject);
  const hist = CHARACTER_HISTORY[subject] ?? [];
  const feed: FeedItem[] = [];
  if (live1) {
    feed.push({
      id: `now-${subject}`,
      timeLabel: NOW_LABEL,
      isNow: true,
      owner: subject,
      displayName: subject,
      avatarSrc: live1.avatarSrc,
      location: live1.location,
      chatLocation: live1.chatLocation,
      body: live1.action || "—",
    });
  }
  for (const e of hist) {
    feed.push({
      id: `${subject}-${e.time}`,
      timeLabel: e.time,
      isNow: false,
      owner: subject,
      displayName: subject,
      avatarSrc: live1?.avatarSrc ?? "",
      location: e.location,
      chatLocation: e.location,
      body: e.body,
    });
  }
  return feed;
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Bottom half-sheet that shows "动态" for either a single friend or the
 * whole world. Controlled by `ActivitySheetContext`; portaled into the
 * phone-frame overlay root so it sits above every in-page layer
 * (including the friends panel and action bubble).
 */
export function ActivitySheet() {
  const { subject, open, close } = useActivitySheet();
  const live = useFriendsStatus();

  // Two-phase mount to keep exit animation: `visible` drives the CSS
  // enter/leave state; we only unmount ~280ms after `subject` clears.
  const [mountedSubject, setMountedSubject] = useState<
    ActivitySubject | undefined
  >(undefined);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (subject !== undefined) {
      setMountedSubject(subject);
      // Double rAF: frame 1 lets the browser paint the initial
      // `translate-y-full / opacity-0` state, frame 2 flips `visible`
      // so the CSS transition actually runs. A single rAF fires
      // before the first paint and gets skipped.
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (mountedSubject === undefined) return;
    setVisible(false);
    const t = setTimeout(() => setMountedSubject(undefined), 320);
    return () => clearTimeout(t);
  }, [subject, mountedSubject]);

  const overlayRoot = usePhoneOverlayRoot();

  const feed = useMemo(
    () =>
      mountedSubject === undefined ? [] : buildFeed(mountedSubject, live),
    [mountedSubject, live],
  );

  if (mountedSubject === undefined || !overlayRoot) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[60]"
      onClick={close}
      role="presentation"
    >
      {/* Dim backdrop */}
      <div
        className={`absolute inset-0 bg-black/35 transition-opacity duration-[280ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <SheetBody
        live={live}
        mountedSubject={mountedSubject}
        visible={visible}
        setVisible={setVisible}
        open={open}
        close={close}
        feed={feed}
        stop={stop}
      />
    </div>,
    overlayRoot,
  );
}

// ─── Sheet body (drag-to-dismiss) ───────────────────────────────────────

/**
 * The draggable card itself. Split out from `ActivitySheet` so the
 * pointer-gesture state (`dragY` / `dragging`) and its handlers stay
 * close to the JSX they drive.
 *
 * Gesture: press anywhere on the top strip (grab handle + subject header,
 * excluding actual buttons) and drag down. If the release crossed
 * ~120px of travel or ~0.6 px/ms of flick velocity we dismiss; otherwise
 * we spring back to rest.
 */
function SheetBody({
  live,
  mountedSubject,
  visible,
  setVisible,
  open,
  close,
  feed,
  stop,
}: {
  live: readonly FriendStatus[];
  mountedSubject: ActivitySubject;
  visible: boolean;
  setVisible: (v: boolean) => void;
  open: (s: ActivitySubject) => void;
  close: () => void;
  feed: FeedItem[];
  stop: (e: MouseEvent) => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startY: number;
    pointerId: number;
    lastY: number;
    lastTime: number;
    velocity: number;
  } | null>(null);

  // Reset any leftover drag offset whenever the sheet re-enters (new
  // subject). Without this, reopening right after a partial drag would
  // mount the card already pushed down a few pixels.
  useEffect(() => {
    if (visible) {
      setDragY(0);
      setDragging(false);
    }
  }, [visible, mountedSubject]);

  const ignoreDragStart = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, [role='menu'], [role='menuitem'], [role='menuitemradio']",
      ),
    );
  };

  const onGripPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ignoreDragStart(e.target)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      pointerId: e.pointerId,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
    setDragging(true);
  };

  const onGripPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = now - d.lastTime;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastTime = now;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const endGrip = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = Math.max(0, e.clientY - d.startY);
    const vy = d.velocity;
    try {
      e.currentTarget.releasePointerCapture(d.pointerId);
    } catch {
      // releasePointerCapture throws if the pointer is already gone
      // (e.g. pointercancel after drag ended) — safe to swallow.
    }
    dragRef.current = null;

    const shouldDismiss = dy > 120 || vy > 0.6;
    if (shouldDismiss) {
      // Flip to the "hidden" position in the same commit as the
      // transform-follows-class handoff, so we get exactly one
      // transition from the dragged offset straight off-screen. Do NOT
      // zero-out `dragY` — the sheet is about to unmount anyway.
      setVisible(false);
      setDragging(false);
      close();
    } else {
      // Snap back: dropping `dragging` re-enables the transition and
      // clearing `dragY` removes the inline transform, so the class-
      // driven `translate-y-0` springs the card back into place.
      setDragging(false);
      setDragY(0);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="动态"
      className={`absolute bottom-0 left-0 right-0 flex h-[66%] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.25)] transform-gpu will-change-[transform,opacity] ${
        dragging
          ? ""
          : "transition-[transform,opacity] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      } ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      style={dragging ? { transform: `translateY(${dragY}px)` } : undefined}
      onClick={stop}
      onPointerDown={stop}
    >
      {/* Drag grip: handle pill + subject header. Pressing on the two
          pill buttons skips the drag and lets them act as buttons; any
          other press inside this region starts the dismiss gesture. */}
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={endGrip}
        onPointerCancel={endGrip}
      >
        <div className="flex justify-center pt-[10px] pb-[6px]">
          <span className="h-[4px] w-[40px] rounded-full bg-black/15" />
        </div>

        <SubjectHeader
          live={live}
          current={mountedSubject}
          onPick={(next) => open(next)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[24px] pt-[6px]">
        <Timeline items={feed} onPickItem={close} />
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

/**
 * Sheet header — matches Figma 1606:7794 / 1657:3715:
 *   - Left:  dropdown trigger "🪐 全世界的动态 ▼" (or "{avatar} {name}的动态 ▼")
 *   - Right: "活动轨迹" pill button (secondary action)
 * Tapping the left pill reveals a small popover menu listing 全世界 + each
 * live character so the user can swap subjects without closing the sheet.
 */
function SubjectHeader({
  live,
  current,
  onPick,
}: {
  live: readonly FriendStatus[];
  current: ActivitySubject;
  onPick: (next: ActivitySubject) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Opens the full-screen 活动轨迹 overlay with the same subject the
  // sheet is currently showing — 全世界 maps to `null` (全部角色) so the
  // overlay renders every character's path at once. We also close the
  // sheet so the overlay owns the screen; re-opening the sheet after
  // the overlay closes is a single tap on the friends panel.
  const { open: openTrajectory } = useTrajectory();
  const { close: closeActivitySheet } = useActivitySheet();
  const handleOpenTrajectory = () => {
    openTrajectory(current);
    closeActivitySheet();
  };

  // Outside-click / outside-pointerdown dismissal for the dropdown menu.
  // Use the capture phase so we fire BEFORE the sheet's own
  // `onPointerDown={stop}` swallows the event, but still bail when the
  // press landed on the trigger/menu itself.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [menuOpen]);

  const currentLive =
    current !== null ? live.find((f) => f.name === current) : null;
  const title =
    current === null ? "全世界的动态" : `${current}的动态`;

  return (
    <div
      ref={rootRef}
      className="relative flex shrink-0 items-center gap-[10px] px-[16px] pb-[12px] pt-[2px]"
    >
      {/* Left: dropdown trigger */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex shrink-0 items-center gap-[8px] rounded-full bg-black/[0.04] py-[4px] pl-[4px] pr-[10px] transition-colors hover:bg-black/[0.06]"
      >
        <span className="relative flex size-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          {current === null ? (
            <Image
              src="/figma/map/dolo-planet.svg"
              alt=""
              width={24}
              height={24}
              draggable={false}
            />
          ) : currentLive ? (
            <Image
              src={currentLive.avatarSrc}
              alt=""
              fill
              sizes="28px"
              className="object-cover"
            />
          ) : null}
        </span>
        <span className="text-[14px] font-semibold leading-none text-black">
          {title}
        </span>
        <ChevronDownIcon
          className={`size-[14px] shrink-0 text-black/60 transition-transform duration-150 ${
            menuOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div className="flex-1" />

      {/* Right: 活动轨迹 — secondary pill, mirrors Figma header's right slot */}
      <button
        type="button"
        aria-label="活动轨迹"
        onClick={handleOpenTrajectory}
        className="flex shrink-0 items-center gap-[6px] rounded-full bg-black/[0.04] px-[12px] py-[7px] text-[13px] font-medium text-black/80 transition-colors hover:bg-black/[0.06]"
      >
        <Image
          src="/figma/activity/trajectory.svg"
          alt=""
          width={16}
          height={16}
          className="shrink-0"
        />
        <span>活动轨迹</span>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute left-[16px] top-full z-10 mt-[4px] w-[200px] overflow-hidden rounded-[12px] bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {FRIEND_ORDER.map((name) => {
            const s = live.find((x) => x.name === name);
            if (!s) return null;
            return (
              <MenuOption
                key={name}
                label={name}
                active={current === name}
                leading={
                  <span className="relative size-[24px] overflow-hidden rounded-full">
                    <Image
                      src={s.avatarSrc}
                      alt=""
                      fill
                      sizes="24px"
                      className="object-cover"
                    />
                  </span>
                }
                onClick={() => {
                  setMenuOpen(false);
                  onPick(name);
                }}
              />
            );
          })}
          <div className="mx-[8px] h-px bg-black/[0.06]" />
          <MenuOption
            label="全世界"
            active={current === null}
            leading={
              <Image
                src="/figma/map/dolo-planet.svg"
                alt=""
                width={20}
                height={20}
                draggable={false}
              />
            }
            onClick={() => {
              setMenuOpen(false);
              onPick(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuOption({
  label,
  active,
  leading,
  onClick,
}: {
  label: string;
  active: boolean;
  leading: React.ReactNode;
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
      {active && <CheckIcon className="size-[16px] shrink-0 text-black" />}
    </button>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

type TimelineGroupData = {
  key: string;
  timeLabel: string;
  isNow: boolean;
  items: FeedItem[];
};

/** Groups consecutive feed items that share the same `timeLabel` so each
 *  group renders one sticky time header + one dot at the top, with the
 *  rail line continuing straight through the rest of the cluster. */
function groupFeed(items: readonly FeedItem[]): TimelineGroupData[] {
  const groups: TimelineGroupData[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.timeLabel === item.timeLabel) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key: item.id,
      timeLabel: item.timeLabel,
      isNow: item.isNow,
      items: [item],
    });
  }
  return groups;
}

function Timeline({
  items,
  onPickItem,
}: {
  items: readonly FeedItem[];
  /** Called after a card's navigation kicks off — sheet uses this to close. */
  onPickItem: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="py-[40px] text-center text-[13px] text-black/40">
        暂无动态
      </div>
    );
  }
  const groups = groupFeed(items);
  return (
    <ol className="flex flex-col">
      {groups.map((group, gi) => (
        <TimelineGroup
          key={group.key}
          group={group}
          firstGroup={gi === 0}
          lastGroup={gi === groups.length - 1}
          onPickItem={onPickItem}
        />
      ))}
    </ol>
  );
}

function TimelineGroup({
  group,
  firstGroup,
  lastGroup,
  onPickItem,
}: {
  group: TimelineGroupData;
  firstGroup: boolean;
  lastGroup: boolean;
  onPickItem: () => void;
}) {
  // Geometry is hardcoded so the dot's vertical center is deterministic —
  // no reliance on flex-1 or grid stretching, which had left visible gaps
  // below the dot across browsers. The time column uses matching py so its
  // text center lands at `stickyH / 2`, which lines up horizontally with
  // the dot sitting at the rail column's vertical center.
  const stickyH = group.isNow ? 46 : 32;
  const dotCenter = stickyH / 2;

  // Rail split into two absolute lines:
  //
  //   • "inner" line — lives INSIDE the sticky header so it moves with the
  //     dot. It extends from y=0 (or dotCenter if firstGroup) to the bottom
  //     of the sticky, sitting behind the dot visually. Because it's inside
  //     the sticky, the sticky's `bg-white` keeps it from showing above the
  //     header when the page scrolls past this group.
  //
  //   • "outer" line — absolutely positioned in the <li>, running from the
  //     sticky's bottom (stickyH) to the li's bottom. It picks up exactly
  //     where the inner line ends so there is no visible seam.
  //
  // For firstGroup / lastGroup we simply drop the corresponding half so the
  // rail doesn't extend past the group's first or last dot.
  return (
    <li className="relative flex items-stretch gap-[10px]">
      {!lastGroup && (
        <span
          aria-hidden
          className="pointer-events-none absolute w-px -translate-x-1/2 bg-black/10"
          style={{ left: "68px", top: `${stickyH}px`, bottom: 0 }}
        />
      )}

      <div
        className="sticky top-0 z-[1] flex flex-none items-center gap-[10px] self-start bg-white"
        style={{ height: stickyH }}
      >
        {/* Inner rail line — absolute within the sticky so the geometry is
            exact pixel math instead of flex-spacer arithmetic (which had
            been rendering shorter than expected and producing the visible
            gap the user reported). Runs from the sticky top (or the dot's
            vertical center for the first group) down to the sticky bottom
            (or back up to the dot's vertical center for the last group). */}
        <span
          aria-hidden
          className="pointer-events-none absolute w-px -translate-x-1/2 bg-black/10"
          style={{
            left: "68px",
            top: firstGroup ? dotCenter : 0,
            bottom: lastGroup ? dotCenter : 0,
          }}
        />

        <div className="flex w-[52px] flex-col items-end py-[10px] leading-none">
          {group.isNow ? (
            <>
              <span className="text-[13px] font-semibold text-black">
                现在
              </span>
              <span className="pt-[2px] text-[11px] text-black/50">
                {group.timeLabel.replace("现在 ", "")}
              </span>
            </>
          ) : (
            <span className="text-[12px] text-black/50">
              {group.timeLabel}
            </span>
          )}
        </div>

        <div className="flex w-[12px] items-center justify-center">
          <span
            aria-hidden
            className={
              group.isNow
                ? "relative z-[1] size-[10px] rounded-full bg-black ring-[3px] ring-black/10"
                : "relative z-[1] size-[8px] rounded-full bg-black/20"
            }
          />
        </div>
      </div>

      {/* Cards column — scrolls normally beneath the sticky header. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {group.items.map((item) => (
          <div key={item.id} className="pb-[16px]">
            <EntryCard item={item} onPick={onPickItem} />
          </div>
        ))}
      </div>
    </li>
  );
}

/**
 * Feed row.
 *
 * Only entries flagged `isNow` represent activity that is *currently*
 * happening, so only they jump into the corresponding free-chat — routed
 * through `item.chatLocation` (the real POI label) rather than
 * `item.location`, which lets walking-friend cards ("路上") still land
 * in a valid place chat. Past entries render in a dimmed, non-interactive
 * variant: they're historical snapshots, not live destinations.
 *
 * After navigation we tell the parent to close the sheet so the
 * transition reveals the new page instead of animating beneath the
 * overlay.
 */
function EntryCard({
  item,
  onPick,
}: {
  item: FeedItem;
  onPick: () => void;
}) {
  const navigate = useTransitionNavigate();

  const inner = (
    <>
      <div className="flex items-center gap-[8px]">
        <span className="relative flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5">
          {item.avatarSrc ? (
            <Image
              src={item.avatarSrc}
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            <Image
              src="/figma/map/dolo-planet.svg"
              alt=""
              width={28}
              height={28}
              draggable={false}
            />
          )}
        </span>
        <span className="flex-1 truncate text-[14px] font-medium leading-none text-black">
          {item.displayName}
        </span>
        <span className="flex shrink-0 items-center gap-[3px] rounded-full bg-black/5 px-[8px] py-[3px] text-[11px] leading-none text-black/70">
          <span aria-hidden>📌</span>
          {item.location}
        </span>
      </div>
      <p className="mt-[8px] text-[13px] leading-[1.45] text-black/75">
        {item.body}
      </p>
    </>
  );

  if (!item.isNow) {
    // Past entries are view-only: no button role, no navigation, and a
    // reduced opacity so the timeline visually emphasises what's live.
    // We intentionally leave hover/active states off so pointer feedback
    // matches the disabled affordance.
    return (
      <div
        aria-disabled="true"
        className="block w-full cursor-default rounded-[14px] bg-black/[0.03] px-[12px] py-[10px] text-left opacity-55"
      >
        {inner}
      </div>
    );
  }

  const handleClick = () => {
    navigate(`/chat/${encodeURIComponent(item.chatLocation)}`);
    onPick();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`打开${item.chatLocation}的群聊`}
      className="block w-full rounded-[14px] bg-black/[0.03] px-[12px] py-[10px] text-left transition-colors hover:bg-black/[0.05] active:bg-black/[0.06]"
    >
      {inner}
    </button>
  );
}
