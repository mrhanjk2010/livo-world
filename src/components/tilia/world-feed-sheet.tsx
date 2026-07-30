"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { StatusBar } from "@/components/mobile/status-bar";
import { SpeakerStack, speakerName } from "@/components/tilia/tilia-avatar";
import { WorldLiveIndicator } from "@/components/tilia/world-live-indicator";
import type { FeedItem, WorldClock } from "@/lib/tilia/world-feed";
import { buildWorldLog, type WorldLogDay } from "@/lib/tilia/world-log";

const ANIM_MS = 260;

/**
 * 全屏世界动态页 —— 设计稿 `4857:35835`「世界动态展开」。
 *
 * 它是动态卡的展开态，不是另一个页面：同一批内容，卡片上是每条一句
 * 缩略（可视三行），这里是完整几段 + 按「第 N 天」分组，能一直翻到
 * 发车那天。所以底下不铺实色，只在地图上压一层 40px 背景模糊 ——
 * 世界还在下面走，你只是把动态摊开来看。
 *
 * 单条不可点：动态是世界的记录，不是入口。要去某处走地图，要进某段
 * 剧情走命运，这里只负责读。
 */
export function WorldFeedSheet({
  open,
  feed,
  clock,
  onClose,
}: {
  open: boolean;
  /** 动态卡里那份实时列表（时间正序）。 */
  feed: readonly FeedItem[];
  clock: WorldClock;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  /** 列表是否已离开顶部；决定上沿那道渐隐要不要挂。 */
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const days = useMemo(() => buildWorldLog(feed, clock.day), [feed, clock.day]);

  useEffect(() => {
    if (open) {
      setMounted(true);
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
    const t = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  /**
   * 打开时落到最新那天。卡片上看的是最新三条，展开后如果停在发车第一日，
   * 等于把人从刚看的地方甩开了 —— 要往回翻是主动行为，交给手指。
   */
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setScrolled(el.scrollTop > 0);
  }, [open, days]);

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[65]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="世界动态"
        className={`absolute inset-0 flex flex-col bg-black/20 backdrop-blur-[40px] transition-opacity duration-[260ms] ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <StatusBar />

        {/* 表头：世界动态 + 第 N 天 · 时间 · 天气 + live + 关闭 */}
        <header className="flex shrink-0 items-start justify-between px-[16px] pb-[16px] pt-[9.5px]">
          <div className="flex flex-col justify-center">
            <h1 className="text-[20px] font-medium leading-[normal] text-white">
              世界动态
            </h1>
            <div className="flex items-center gap-[8px] text-[12px] font-medium text-[#9f9f9f]">
              <span>第 {clock.day} 天</span>
              <span className="flex items-center gap-[2px]">
                <Image
                  src="/figma/tilia/feed/icon-clock.svg"
                  alt=""
                  width={15}
                  height={15}
                  className="size-[15px]"
                />
                {clock.time}
              </span>
              <span className="flex items-center gap-[2px]">
                <Image
                  src="/figma/tilia/feed/icon-weather.svg"
                  alt=""
                  width={15}
                  height={15}
                  className="size-[15px]"
                />
                {clock.weather}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[12px] pt-[4px]">
            <WorldLiveIndicator scale={1.086} />
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="flex size-[29px] shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-[23px] transition-transform duration-200 active:scale-90"
            >
              <Image
                src="/figma/tilia/feed/icon-close.svg"
                alt=""
                width={29}
                height={29}
                className="size-full"
              />
            </button>
          </div>
        </header>

        {/*
          时间正序，最新在最下。翻到顶就是发车第一日 —— 世界的完整记录
          比这次会话长，所以这里能往上翻很远。

          离顶之后上沿加一道 14px 渐隐：表头是透明的，不遮挡，被卷上去
          的那一行汉字会齐刷刷切一刀，看着像渲染坏了。贴顶时不加，
          否则「第 1 天」那枚圆点会被削掉一角。
        */}
        <div
          ref={scrollRef}
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pb-[40px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={
            scrolled
              ? {
                  maskImage:
                    "linear-gradient(to bottom, transparent 0, #000 14px)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0, #000 14px)",
                }
              : undefined
          }
        >
          {days.map((group) => (
            <DayGroup key={group.day} group={group} />
          ))}
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/* ─────────────────────────── 一天 ─────────────────────────── */

function DayGroup({ group }: { group: WorldLogDay }) {
  return (
    <section>
      <div className="flex w-full items-center gap-[8px] px-[16px] py-[8px]">
        <Image
          src="/figma/tilia/feed/day-marker.svg"
          alt=""
          width={24}
          height={24}
          className="size-[24px] shrink-0"
        />
        <h2 className="text-[13px] font-medium leading-[22px] text-[#ffc46b]">
          第 {group.day} 天
        </h2>
      </div>

      {group.items.map((item) => (
        <LogEntry key={item.id} item={item} />
      ))}
    </section>
  );
}

/**
 * 一条完整动态：头像组 + 说话人一行，正文按段落排在下面。
 *
 * 和卡片里那行的区别不只是长度 —— 这里名字和正文分两行，正文有 22px
 * 行距，读的是段落而不是扫一眼的标题。
 */
function LogEntry({ item }: { item: FeedItem }) {
  const paragraphs = item.detail ?? [item.text];

  return (
    <article className="flex w-full flex-col items-start gap-[8px] px-[16px] pb-[16px] pt-[12px]">
      <div className="flex items-center gap-[6px]">
        <SpeakerStack speakers={item.speakers} size={24} />
        <p className="text-[13px] font-medium leading-[1.6] text-white/30">
          {item.speakers.map(speakerName).join("、")}
        </p>
      </div>

      <div className="flex w-full flex-col gap-[4px]">
        {paragraphs.map((text, i) => (
          <p
            key={i}
            className="w-full text-[13px] font-medium leading-[22px] text-white/70"
          >
            {text}
          </p>
        ))}
      </div>
    </article>
  );
}
