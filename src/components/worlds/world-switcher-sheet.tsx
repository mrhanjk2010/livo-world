"use client";

import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { StatusBar } from "@/components/mobile/status-bar";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { useTransitionNavigate } from "@/components/mobile/transition-shell";
import { ROUTE_PATH, CANVAS_H, CANVAS_W } from "@/lib/tilia/world";

/* ---------- Data ---------- */

type WorldCardDef = {
  id: string;
  /** Two-line title; the brand name is the first half, subtitle the second. */
  brand: string;
  subtitle?: string;
  description: string;
  genres: readonly string[];
  /**
   * Cover bitmap. Optional — worlds without art yet render a
   * procedural `art` panel instead of a broken/blank image.
   */
  cover?: string;
  /** Procedural cover, used when `cover` is absent. */
  art?: "tilia";
  /** Where entering this world lands. */
  href: string;
  /** Whether the user can enter — the rest are teasers. */
  enterable: boolean;
};

const WORLDS: readonly WorldCardDef[] = [
  {
    id: "tilia",
    brand: "蒂利亚之冬",
    subtitle: "和平号",
    description:
      "一辆名为「和平号」的列车，从极北的维萨始发，开往万晁。听说到达万晁的时候，会是百花盛开的季节。",
    genres: ["悬疑", "群像", "战后", "列车"],
    // 项目文档暂未提供封面素材，先用与地图同源的程序化封面。
    art: "tilia",
    href: "/",
    enterable: true,
  },
  {
    id: "dolo",
    brand: "DOLO",
    subtitle: "最后的夏天",
    description:
      "南一中学的最后一个暑假，五个少年的秘密与羁绊，五个少年的秘密与羁绊",
    genres: ["悬疑", "青春", "群像"],
    cover: "/figma/world-switcher/dolo-cover.png",
    href: "/map",
    enterable: true,
  },
  {
    id: "bloody",
    brand: "BLOODY",
    subtitle: "心跳回溯",
    description: "午夜的医院走廊，每次一心跳都是一条线索。",
    genres: ["悬疑", "青春", "群像"],
    cover: "/figma/world-switcher/bloody-cover.png",
    href: "#",
    enterable: false,
  },
  {
    id: "collapse",
    brand: "崩溃世纪",
    description:
      "午夜的医院走廊，每次一心跳都是一条线索。午夜的医院走廊，每次一心跳都是一条线索。",
    genres: ["悬疑", "青春", "群像"],
    cover: "/figma/world-switcher/collapse-cover.png",
    href: "#",
    enterable: false,
  },
];

/* ---------- Component ---------- */

/**
 * Bottom-up sheet that lists every Livo world. Triggered from the
 * brand chip in each world's map top-nav; slides up to cover the
 * entire phone frame and dismisses via the X in its top-right.
 *
 * Visually mirrors Figma node 2024:2486 (浅灰底 + 白色卡片 + 关闭按钮).
 * Rendered through a portal into the phone overlay root so it sits
 * above every other in-frame layer.
 */
export function WorldSwitcherSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useTransitionNavigate();
  // Two-phase mount: keep the DOM mounted across enter and leave so
  // the CSS transition runs on both edges. `mounted` controls
  // presence, `visible` drives the translate/opacity classes.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double rAF: paint the off-screen state first, then flip
      // `visible` so the transition animates instead of jumping
      // straight to the resting position.
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (!mounted) return;
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 360);
    return () => clearTimeout(t);
  }, [open, mounted]);

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  const enter = (world: WorldCardDef) => {
    if (!world.enterable) return;
    onClose();
    navigate(world.href);
  };

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[60]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="切换世界"
        onClick={stop}
        className={`absolute inset-0 flex flex-col overflow-hidden bg-[#f5f5f5] transform-gpu transition-[transform] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header: dark-tone status bar + centered title + X close. */}
        <header className="relative shrink-0">
          <StatusBar tone="dark" />
          <div className="relative flex h-[48px] items-center justify-center px-[16px]">
            <h1
              className="text-[16px] font-medium leading-[1.2] text-black"
              style={{
                fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif',
              }}
            >
              Livo 世界
            </h1>
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="absolute right-[10px] top-1/2 inline-flex size-[40px] -translate-y-1/2 items-center justify-center rounded-full text-black transition-colors hover:bg-black/[0.04] active:bg-black/[0.08]"
            >
              <CloseIcon className="size-[22px]" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[40px] pt-[8px]">
          <ul className="flex flex-col gap-[20px]">
            {WORLDS.map((w) => (
              <li key={w.id}>
                <WorldCard world={w} onEnter={() => enter(w)} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/* ---------- Card ---------- */

function WorldCard({
  world,
  onEnter,
}: {
  world: WorldCardDef;
  onEnter: () => void;
}) {
  // Disabled cards render as a non-interactive div so they don't
  // surface to AT users as clickable.
  const Tag = world.enterable ? "button" : "div";

  return (
    <Tag
      type={world.enterable ? "button" : undefined}
      onClick={world.enterable ? onEnter : undefined}
      className={`relative block w-full overflow-hidden rounded-[16px] border border-[#e4e4e4] bg-white text-left transition-transform ${
        world.enterable
          ? "cursor-pointer active:scale-[0.985]"
          : "cursor-default"
      }`}
      aria-disabled={!world.enterable}
    >
      {/* Cover — 2:1 to match the Figma mask region (640 × 320). */}
      <div className="relative aspect-[2/1] w-full overflow-hidden">
        {world.cover ? (
          <Image
            src={world.cover}
            alt=""
            fill
            sizes="(max-width: 480px) 90vw, 320px"
            className="object-cover"
            draggable={false}
          />
        ) : (
          <TiliaCoverArt />
        )}
        {/* Soft white fade so the cover transitions into the card body,
         *  like the Figma mask group does. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40px] bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="px-[16px] pb-[16px] pt-[12px]">
        <h2
          className="text-[16px] font-medium leading-[1.2] text-black"
          style={{
            fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif',
          }}
        >
          {world.brand}
          {world.subtitle ? ` ${world.subtitle}` : ""}
        </h2>

        <div className="mt-[10px] flex flex-wrap gap-[8px]">
          {world.genres.map((g) => (
            <span
              key={g}
              className="inline-flex items-center justify-center rounded-[3px] bg-black/10 px-[8px] py-[3px] text-[12px] leading-[1.4] text-black"
              style={{
                fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif',
              }}
            >
              {g}
            </span>
          ))}
        </div>

        <p
          className="mt-[10px] text-[12px] leading-[1.5] text-black/85"
          style={{
            fontFamily: '"Heiti SC", "PingFang SC", system-ui, sans-serif',
            textAlign: "justify",
          }}
        >
          {world.description}
        </p>

        {!world.enterable ? (
          <span className="mt-[10px] inline-flex items-center rounded-[3px] bg-black/[0.06] px-[8px] py-[4px] text-[11px] leading-none text-black/45">
            敬请期待
          </span>
        ) : null}
      </div>
    </Tag>
  );
}

/* ---------- Procedural cover ---------- */

/**
 * 《蒂利亚之冬》封面。项目文档只提供了大陆势力示意图和势力诉求表，
 * 没有封面美术，所以这里用与世界地图同源的元素画一张：极北冷蓝 →
 * 万晁暖金的横向渐变，中间是同一条 `ROUTE_PATH` 航线。等美术出图后
 * 给这张卡片补 `cover` 字段即可替换，不用改结构。
 */
function TiliaCoverArt() {
  return (
    <div className="absolute inset-0 bg-[#0B1626]">
      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="tilia-cover-sky" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#0A1B2E" />
            <stop offset="55%" stopColor="#122031" />
            <stop offset="100%" stopColor="#3A2A1C" />
          </linearGradient>
          <radialGradient id="tilia-cover-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFC978" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFC978" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tilia-cover-frost" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#A8DBFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#A8DBFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={CANVAS_W} height={CANVAS_H} fill="url(#tilia-cover-sky)" />
        <ellipse cx={60} cy={300} rx={360} ry={380} fill="url(#tilia-cover-frost)" />
        <ellipse
          cx={CANVAS_W - 60}
          cy={430}
          rx={380}
          ry={400}
          fill="url(#tilia-cover-sun)"
        />

        {/* 航线 */}
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="#FFD79A"
          strokeOpacity="0.28"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="#FFE9C4"
          strokeOpacity="0.9"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="3 16"
        />

        {/* 雪山剪影 */}
        <polygon points="520,300 596,196 672,300" fill="#DCEBF7" opacity="0.22" />
        <polygon points="600,300 668,224 736,300" fill="#DCEBF7" opacity="0.14" />
      </svg>

      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}

/* ---------- Icons ---------- */

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
