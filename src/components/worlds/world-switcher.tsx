"use client";

import Image from "next/image";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";

/* ---------- Types & data ---------- */

type WorldPhoto = {
  src: string;
  status: string;
  /** Rotation in degrees — used for the scattered polaroid look. */
  rotate: number;
  /** Absolute placement inside the photo collage area (px). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Stacking order — higher sits on top of overlapping photos. */
  z: number;
};

export type WorldDef = {
  id: string;
  title: string;
  subtitle: string;
  /** Two lines of poetic description shown above the pagination dots. */
  description: [string, string];
  /** Up to ~3 genre tags; rendered as rotated chips near the title. */
  genres: string[];
  /** Route to navigate to when the user commits to this world. */
  mapHref: string;
  /** Whether entering this world is enabled (false → disabled CTA + muted card). */
  enterable: boolean;
  photos: WorldPhoto[];
};

/**
 * Hand-tuned polaroid layout — four character photos scattered inside the
 * card's 240px × ~360px photo area. Mirrors the spirit of the Figma design
 * (overlapping tilted frames) without slavishly copying the exact Figma
 * transforms, which would require the original vector mask layers.
 */
const DOLO_PHOTOS_LAYOUT: Omit<WorldPhoto, "src" | "status">[] = [
  { rotate: 6, left: 2, top: 8, width: 128, height: 160, z: 1 },
  { rotate: -14, left: 108, top: 0, width: 128, height: 150, z: 2 },
  { rotate: -9, left: -4, top: 160, width: 136, height: 158, z: 3 },
  { rotate: -3, left: 110, top: 152, width: 128, height: 166, z: 4 },
];

export const WORLDS: readonly WorldDef[] = [
  {
    id: "tilia",
    title: "蒂利亚之冬",
    subtitle: "和平号",
    description: ["从极北的维萨开往万晁", "到达时会是百花盛开的季节"],
    genres: ["悬疑", "群像", "列车"],
    mapHref: "/",
    enterable: true,
    // 项目文档暂未提供角色立绘，所以没有拍立得照片墙 —— 卡片会
    // 退化成题记版式（见 WorldCard 的 photos.length === 0 分支）。
    photos: [],
  },
  {
    id: "dolo",
    title: "DOLO",
    subtitle: "最后的夏天",
    description: ["南一中学的最后一个暑假", "五个少年的秘密与羁绊"],
    genres: ["青春", "悬疑", "群像"],
    mapHref: "/map",
    enterable: true,
    photos: [
      { ...DOLO_PHOTOS_LAYOUT[0], src: "/figma/worlds/dolo-p2.png", status: "周往：正在给流浪猫投喂粮食" },
      { ...DOLO_PHOTOS_LAYOUT[1], src: "/figma/worlds/dolo-p4.png", status: "叶恒：正在吃冰淇淋" },
      { ...DOLO_PHOTOS_LAYOUT[2], src: "/figma/worlds/dolo-p1.png", status: "夏季：正在教室里耍帅" },
      { ...DOLO_PHOTOS_LAYOUT[3], src: "/figma/worlds/dolo-p3.png", status: "钟辰时：正在图书馆看书" },
    ],
  },
  {
    id: "bloody",
    title: "BLOODY",
    subtitle: "心跳回溯",
    description: ["午夜的医院走廊", "每次一次心跳都是一条线索"],
    genres: ["悬疑", "吸血鬼", "恐惧"],
    mapHref: "#",
    enterable: false,
    photos: [
      { ...DOLO_PHOTOS_LAYOUT[0], src: "/figma/worlds/bloody-p2.png", status: "夜班护士：走廊尽头又有脚步声" },
      { ...DOLO_PHOTOS_LAYOUT[1], src: "/figma/worlds/bloody-p4.png", status: "陆时：正在整理病例" },
      { ...DOLO_PHOTOS_LAYOUT[2], src: "/figma/worlds/bloody-p1.png", status: "江阙：在值班室发呆" },
      { ...DOLO_PHOTOS_LAYOUT[3], src: "/figma/worlds/bloody-p3.png", status: "顾清河：去了地下档案室" },
    ],
  },
  {
    id: "placeholder-1",
    title: "NOVA",
    subtitle: "无人之城",
    description: ["灯火熄灭后的城市", "他们是最后亮起的灯"],
    genres: ["科幻", "末日", "悬疑"],
    mapHref: "#",
    enterable: false,
    photos: [],
  },
];

/* ---------- Tunables ---------- */

/** Card outer width as a fraction of phone width. 0.7 leaves ~15% peek on each side. */
const CARD_WIDTH_RATIO = 0.7;
/** Horizontal gap between adjacent cards (px). */
const CARD_GAP = 12;
/** Min drag distance (px) to register a swipe vs tap. */
const TAP_MAX_MOVEMENT = 6;
/** Ratio of step size past which we commit to the next/prev card on release. */
const SNAP_COMMIT_RATIO = 0.22;
/** Rubber-band resistance factor when dragging past the first/last card. */
const OVERDRAG_RESIST = 0.35;

/* ---------- Main component ---------- */

export function WorldSwitcher() {
  const navigate = useTransitionNavigate();
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  /**
   * Gates the CSS transition on the track. The initial trackX depends on
   * `containerWidth`, which is 0 until the first `ResizeObserver` callback
   * runs — if transitions were enabled then, the carousel would visibly
   * "scroll into place" from x=0 on every page load. Stays `false` until
   * one frame after the first non-zero width is committed.
   */
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  /**
   * Pointer bookkeeping lives in refs so that pointer callbacks can read
   * the latest values without forcing a re-render on every pointermove.
   */
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startDragXRef = useRef(0);
  const didDragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track container width so card sizing adapts to the PhoneFrame width
  // (which can be anywhere between iPhone mini ~320 and desktop 375).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure();
    // Enable transitions one frame after the first width has been applied,
    // so the carousel paints at its centered position without animating in.
    const raf = requestAnimationFrame(() => setTransitionsEnabled(true));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const cardWidth = Math.round(containerWidth * CARD_WIDTH_RATIO);
  const step = cardWidth + CARD_GAP;
  // Offset that centers card #0 in the container.
  const baseOffset = Math.round((containerWidth - cardWidth) / 2);

  /** Translate the track so the N-th card is centered, optionally dragged. */
  const trackX = baseOffset - index * step + dragX;

  /* --- pointer handlers --- */

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startDragXRef.current = 0;
    didDragRef.current = false;
    setDragging(true);
    // Capture so subsequent moves/ups land on the container even if the
    // cursor strays outside it (or over a child element).
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    const raw = e.clientX - startXRef.current;

    // Rubber-band if dragging beyond the first or last card: halve-plus
    // resistance so the user feels a "wall" without hard-stopping.
    let x = raw;
    const atFirst = index === 0;
    const atLast = index === WORLDS.length - 1;
    if (atFirst && raw > 0) x = raw * OVERDRAG_RESIST;
    if (atLast && raw < 0) x = raw * OVERDRAG_RESIST;

    if (Math.abs(raw) > TAP_MAX_MOVEMENT) didDragRef.current = true;
    setDragX(x);
  };

  const endDrag = useCallback(
    (pointerId: number) => {
      if (pointerIdRef.current !== pointerId) return;
      pointerIdRef.current = null;
      setDragging(false);

      // Commit / revert based on how far we dragged relative to the step.
      const committed = Math.abs(dragX) > step * SNAP_COMMIT_RATIO;
      if (committed) {
        const dir = dragX < 0 ? 1 : -1;
        const next = Math.max(0, Math.min(WORLDS.length - 1, index + dir));
        setIndex(next);
      }
      setDragX(0);
    },
    [dragX, index, step],
  );

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId);
  };

  /** Click on a card commits only if it wasn't a drag; non-centered cards
   *  first recenter themselves (common magnetic-carousel affordance). */
  const onCardClick = (i: number) => {
    if (didDragRef.current) return;
    if (i !== index) {
      setIndex(i);
      return;
    }
    const world = WORLDS[i];
    if (world.enterable) navigate(world.mapHref);
  };

  const current = WORLDS[index];

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      {/* Top title — sits below the status bar at a fixed y matching Figma (71px at 1x). */}
      <div className="shrink-0 pt-[66px] text-center">
        <h1
          className="text-[24px] leading-[1.5] text-white"
          style={{ fontFamily: '"YouSheShaYuFeiTeJianKangTi", "PingFang SC", system-ui, sans-serif' }}
        >
          Livo 世界
        </h1>
      </div>

      {/* Scroll area with carousel + description + pagination. Fills remaining space. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Carousel viewport — capture pointer events here. */}
        <div
          ref={containerRef}
          className="relative mt-[16px] flex-1 overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "pan-y" }}
        >
          <div
            className="flex h-full items-start"
            style={{
              gap: `${CARD_GAP}px`,
              transform: `translate3d(${trackX}px, 0, 0)`,
              transition:
                dragging || !transitionsEnabled
                  ? "none"
                  : "transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              willChange: "transform",
            }}
          >
            {WORLDS.map((world, i) => (
              <WorldCard
                key={world.id}
                world={world}
                isActive={i === index}
                width={cardWidth}
                onCardClick={() => onCardClick(i)}
              />
            ))}
          </div>
        </div>

        {/* Pagination dots — the card itself owns the poetic description, so
         *  the outer layout jumps straight to the dots + CTA below. */}
        <div className="mt-[16px] flex items-center justify-center gap-[8px]">
          {WORLDS.map((w, i) => (
            <button
              key={w.id}
              type="button"
              aria-label={`切换到 ${w.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={`h-[8px] rounded-full transition-all duration-300 ${
                i === index
                  ? "w-[18px] bg-white"
                  : "w-[8px] bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>

        {/* Enter button — fixed to the bottom of the phone frame. */}
        <div className="mt-[20px] flex shrink-0 justify-center pb-[40px]">
          <button
            type="button"
            disabled={!current.enterable}
            onClick={() => current.enterable && navigate(current.mapHref)}
            className={`inline-flex items-center gap-[6px] rounded-[32px] px-[32px] py-[12px] text-[18px] backdrop-blur-[10px] transition-opacity ${
              current.enterable
                ? "bg-white/15 text-white hover:bg-white/25"
                : "cursor-not-allowed bg-white/5 text-white/40"
            }`}
            style={{ fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif' }}
          >
            <EnterArrowIcon />
            <span>{current.enterable ? "进入世界" : "敬请期待"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Card ---------- */

function WorldCard({
  world,
  isActive,
  width,
  onCardClick,
}: {
  world: WorldDef;
  isActive: boolean;
  width: number;
  onCardClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCardClick}
      className="group relative shrink-0 overflow-hidden rounded-[40px] bg-neutral-900 text-left transition-[transform,opacity] duration-300 ease-out"
      style={{
        width: width > 0 ? `${width}px` : "70%",
        /** Card should fill the viewport vertically minus a bit of breathing
         *  room. Aspect ratio from Figma: 524:1140 ≈ 1:2.176. */
        aspectRatio: "524 / 1140",
        // Side cards dim slightly and scale down — classic carousel focus cue.
        transform: isActive ? "scale(1)" : "scale(0.94)",
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Ambient backdrop — same image across cards intentionally for a cohesive
       *  "book-cover" feel; future worlds can swap this out by world.id. */}
      <div className="absolute inset-0">
        <Image
          src="/figma/worlds/world-bg.png"
          alt=""
          fill
          sizes="262px"
          className="object-cover object-center"
          draggable={false}
          priority
        />
        {/* Dark top→bottom gradient overlay for legibility. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black" />
      </div>

      {/* Title block — top-left. */}
      <div className="absolute left-[16px] right-[16px] top-[28px] flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <div
            className="text-[26px] leading-[1.1] text-white"
            style={{ fontFamily: '"YouSheShaYuFeiTeJianKangTi", "PingFang SC", system-ui, sans-serif' }}
          >
            {world.title}
          </div>
          <div
            className="mt-[2px] text-[24px] leading-[1.15] text-white"
            style={{ fontFamily: '"YouSheShaYuFeiTeJianKangTi", "PingFang SC", system-ui, sans-serif' }}
          >
            {world.subtitle}
          </div>
        </div>

        {/* Genre chips scattered with slight rotations. */}
        <div className="relative h-[56px] w-[90px] shrink-0">
          {world.genres.slice(0, 3).map((g, i) => (
            <span
              key={g}
              className="absolute rounded-[3px] bg-white/10 px-[8px] py-[3px] text-[13px] leading-[normal] text-white backdrop-blur-[2px]"
              style={{
                fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif',
                transform: GENRE_TRANSFORMS[i],
              }}
            >
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* Photo collage area — roughly the mid-section of the card. */}
      <div className="absolute left-[12px] right-[12px] top-[112px] bottom-[110px]">
        {world.photos.length === 0 ? (
          /* 没有照片墙时的退化版式。可进入的世界（立绘还没到位）显示
             题记，未开放的世界才显示「敬请期待」—— 两者都无图，但
             含义完全不同，不能共用同一句文案。 */
          <div className="flex h-full items-center justify-center px-[18px]">
            <div
              className="whitespace-pre-line text-center text-[14px] leading-[1.9] text-white/55"
              style={{ fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif' }}
            >
              {world.enterable ? "风雪覆盖来路\n列车仍在向南" : "敬请期待"}
            </div>
          </div>
        ) : (
          world.photos.map((p, i) => (
            <PhotoCell key={i} photo={p} />
          ))
        )}
      </div>

      {/* Bottom description — a single couplet centered above the card's edge. */}
      <div className="absolute bottom-[28px] left-[16px] right-[16px] text-center">
        <p
          className="text-[12px] leading-[1.6] text-white/85"
          style={{ fontFamily: '"YouSheShaYuFeiTeJianKangTi", "PingFang SC", system-ui, sans-serif' }}
        >
          {world.description[0]}
          <br />
          {world.description[1]}
        </p>
      </div>
    </button>
  );
}

const GENRE_TRANSFORMS = [
  "rotate(-28deg) translate(6px, 16px)",
  "rotate(22deg) translate(36px, 0)",
  "rotate(-9deg) translate(18px, 38px)",
];

function PhotoCell({ photo }: { photo: WorldPhoto }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${photo.left}px`,
        top: `${photo.top}px`,
        width: `${photo.width}px`,
        height: `${photo.height}px`,
        transform: `rotate(${photo.rotate}deg)`,
        zIndex: photo.z,
      }}
    >
      <div className="relative size-full overflow-hidden rounded-[6px] shadow-[0_6px_20px_-6px_rgba(0,0,0,0.8)] ring-[1.5px] ring-white/30">
        <Image
          src={photo.src}
          alt=""
          fill
          sizes="130px"
          className="object-cover"
          draggable={false}
        />
      </div>
      {/* Status chip anchored to the photo's bottom-left. */}
      <div className="pointer-events-none absolute bottom-[4px] left-[4px] inline-flex max-w-[calc(100%-8px)] items-center gap-[4px] rounded-[10px] bg-black/55 px-[6px] py-[2px] backdrop-blur-[4px]">
        <span className="size-[5px] shrink-0 rounded-full bg-[#34D399]" />
        <span
          className="truncate text-[9px] font-light leading-[normal] text-white"
          style={{ fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif' }}
        >
          {photo.status}
        </span>
      </div>
    </div>
  );
}

/* ---------- Icon ---------- */

function EnterArrowIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 11l17.5-7.5L13.5 21l-2-8z" />
    </svg>
  );
}
