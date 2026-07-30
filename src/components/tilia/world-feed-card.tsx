"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { SpeakerStack, speakerName } from "@/components/tilia/tilia-avatar";
import { WorldFeedSheet } from "@/components/tilia/world-feed-sheet";
import { WorldLiveIndicator } from "@/components/tilia/world-live-indicator";
import {
  FEED_HISTORY_CAP,
  FEED_STREAM_INTERVAL_MS,
  FEED_STREAM_POOL,
  FEED_TYPE_MS,
  WORLD_CLOCK,
  WORLD_FEED,
  type FeedItem,
  type WorldClock,
} from "@/lib/tilia/world-feed";

/**
 * 世界动态卡片。
 *
 * V3.3 把它定位成「世界所有信息的汇总分发，短内容」：世界客观变化、
 * 角色日程、世界回响，加上两类命运的缩略版，全都汇到这一张卡里。
 * 表头那句「世界动态 · 11:35 多云」里的天气本身就是「世界客观变化」
 * 的常驻呈现，不是装饰文案。
 *
 * 视觉严格照设计稿 `3378:8485`：卡片上方一枚 38px 蝴蝶胶囊，卡片本体
 * 20px 背景模糊 + 30% 黑底 + 16px 圆角。可视区约三行，时间正序，
 * 最新在最底；上滑可看历史，新内容到来时若人还在底部则自动贴底。
 *
 * 点整张卡（表头 + 列表那一片）打开全屏世界动态页，看同一批内容的
 * 完整版。单条不再是热区 —— 一行 13px 的字里塞一个跳地图的入口，
 * 手指分不清点的是哪一条，读的时候也总怕碰到。
 *
 * 表头右上那枚呼吸指示是另一个入口：动态页答「世界发生了什么」，它答
 * 「那些事汇聚成了什么」，也就是全屏回响星图。落在它身上是因为那枚绿
 * 点本来讲的就是「世界正在往前长」，点进去看长出了什么，是同一句话的
 * 下一层。
 */
export function WorldFeedCard({
  onOpenDestiny,
  onOpenRespond,
  cooldownRemainingSec,
  voiceItem,
  clock,
}: {
  /** 点蝴蝶：打开命运叙事入口。 */
  onOpenDestiny: () => void;
  /** 点「回应这一刻」：打开全屏输入遮罩。 */
  onOpenRespond: () => void;
  /** 冷却剩余秒数；>0 时入口禁用并显示酝酿文案。 */
  cooldownRemainingSec: number;
  /** 父级下发的用户回应；按 id 去重后写入动态。 */
  voiceItem: FeedItem | null;
  /** 覆盖表头时钟（一周后等）。 */
  clock?: WorldClock | null;
}) {
  const clockLabel = clock ?? WORLD_CLOCK;

  /** 时间正序：旧在上、新在下。种子 `WORLD_FEED` 是倒序的，翻过来用。 */
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    [...WORLD_FEED].reverse(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * 落下新动态时盖的天数。流式推入那个 interval 只装一次（依赖为空），
   * 闭包里的时钟会停在首屏那一版 —— 走 ref 才能让跳到一周后之后落下的
   * 动态记到第十日，而不是被算回第三日。
   */
  const dayRef = useRef(clockLabel.day);
  dayRef.current = clockLabel.day;
  /** 正在流式输出的条目 id；正文按字出现。 */
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [typedLen, setTypedLen] = useState(0);
  const poolIdx = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const seenVoiceIds = useRef(new Set<string>());
  /**
   * 用户是否贴在列表底部。贴底时新消息自动滚下来；上滑翻历史时
   * 不抢滚动位置。
   */
  const stickToBottom = useRef(true);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    // 距底 24px 内算「还在看最新」。
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  /** 追加到末尾，保留一段历史；人在底部时跟着贴底。 */
  const appendItem = (item: FeedItem) => {
    const stamped = item.day ? item : { ...item, day: dayRef.current };
    setFeed((prev) => [...prev, stamped].slice(-FEED_HISTORY_CAP));
    setStreamingId(stamped.id);
    setTypedLen(0);
  };

  // 用户回应写入动态。
  useEffect(() => {
    if (!voiceItem) return;
    if (seenVoiceIds.current.has(voiceItem.id)) return;
    seenVoiceIds.current.add(voiceItem.id);
    appendItem(voiceItem);
  }, [voiceItem]);

  // 新条目 / 打字推进后，若贴底则滚到底。
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [feed, typedLen]);

  // 首屏把镜头落到最新三条。
  useEffect(() => {
    scrollToBottom();
  }, []);

  /** 从池里抽下一条，追加到底部，进入打字机状态。 */
  const pushStreamItem = () => {
    const template =
      FEED_STREAM_POOL[poolIdx.current % FEED_STREAM_POOL.length];
    poolIdx.current += 1;
    appendItem({
      ...template,
      id: `stream-${Date.now()}-${poolIdx.current}`,
    });
  };

  // 定时从池里流式推入新动态（世界始终 live）。
  useEffect(() => {
    const first = setTimeout(pushStreamItem, 3_200);
    const t = setInterval(pushStreamItem, FEED_STREAM_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打字机：对 streamingId 那条按字推进。
  useEffect(() => {
    if (!streamingId) return;
    const item = feed.find((f) => f.id === streamingId);
    if (!item) return;
    if (typedLen >= item.text.length) {
      setStreamingId(null);
      return;
    }
    const t = setTimeout(() => setTypedLen((n) => n + 1), FEED_TYPE_MS);
    return () => clearTimeout(t);
  }, [streamingId, typedLen, feed]);

  return (
    <div className="pointer-events-none absolute bottom-[87px] left-1/2 z-40 flex w-[340px] -translate-x-1/2 flex-col items-center gap-[10px]">
      <ButterflyCapsule onClick={onOpenDestiny} />

      <div className="pointer-events-auto flex w-full flex-col items-center gap-[10px] rounded-[16px] bg-black/30 pb-[8px] pt-[12px] backdrop-blur-[20px]">
        {/*
          表头 + 列表整片是一个热区：点开全屏世界动态页。
          用 role=button 而不是 <button>：里面那个列表要能上滑翻历史，
          原生按钮包一个可滚动区在移动端会互相抢手势。滑动不会触发
          click，所以两者不冲突。
        */}
        <div
          role="button"
          tabIndex={0}
          aria-label="展开世界动态"
          onClick={() => setSheetOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            setSheetOpen(true);
          }}
          className="flex w-full cursor-pointer flex-col items-center gap-[10px] rounded-[12px] transition-colors duration-200 hover:bg-white/[0.03]"
        >
          {/* 表头：世界动态 · 时间 天气 + live 指示 */}
          <div className="flex w-full items-center justify-center gap-[6px] px-[16px]">
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-[1.5] text-[#9f9f9f]">
              世界动态 · {clockLabel.time} {clockLabel.weather}
            </p>
            <WorldLiveIndicator />
          </div>

          {/*
            可视约三行；上滑翻历史。停掉冒泡，避免拖列表时把车厢地图
            一起拖走。
          */}
          <div
            ref={listRef}
            onScroll={onListScroll}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="max-h-[102px] w-full touch-pan-y overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-full flex-col justify-end">
              {feed.map((item) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  displayText={
                    item.id === streamingId
                      ? item.text.slice(0, typedLen)
                      : item.text
                  }
                  streaming={item.id === streamingId}
                />
              ))}
            </div>
          </div>
        </div>

        <RespondInput
          cooldownRemainingSec={cooldownRemainingSec}
          onOpenRespond={onOpenRespond}
        />
      </div>

      <WorldFeedSheet
        open={sheetOpen}
        feed={feed}
        clock={clockLabel}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

/* ─────────────────────────── 蝴蝶胶囊 ─────────────────────────── */

/**
 * 蝴蝶胶囊 —— 命运叙事系统的入口，按产品口径承载「注定的命运 / 潜在
 * 的命运」。设计稿把它放在卡片正上方居中，38×38。
 */
function ButterflyCapsule({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="我们的命运"
      className="pointer-events-auto size-[38px] shrink-0 transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <Image
        src="/figma/tilia/butterfly.svg"
        alt=""
        width={38}
        height={38}
        className="size-full select-none"
        draggable={false}
        priority
      />
    </button>
  );
}

/* ──────────────────────────── 动态行 ──────────────────────────── */

/**
 * 一条动态。左侧头像组，右侧名字+内容作为同一段内联文案：
 * 同一行起排，超出宽度自动折行，折行后与名字左缘对齐（不钻到头像下）。
 * 流式输出时正文按字出现，末尾跟一枚闪烁光标。
 *
 * 不可点、也不带任何可点的暗示（原来长内容尾部那枚「›」一并去掉）：
 * 展开看完整内容是整张卡的事，一条一条各带一个入口反而让人不敢读。
 */
function FeedRow({
  item,
  displayText,
  streaming,
}: {
  item: FeedItem;
  displayText: string;
  streaming: boolean;
}) {
  const prefix = item.speakers.map(speakerName).join("、");

  return (
    <div className="flex w-full items-start gap-[6px] px-[16px] py-[6px]">
      <SpeakerStack speakers={item.speakers} />
      {/*
        名字与正文都是 inline，落在同一个 flex 子项里 —— 折行时第二行
        从这段文案的左缘起排，正好和名字对齐。
      */}
      <p className="min-w-0 flex-1 break-words text-[13px] font-medium leading-[1.4]">
        <span className="text-white/30">{prefix}：</span>
        <span className="text-white/70">{displayText}</span>
        {streaming ? (
          <span
            aria-hidden
            className="ml-[1px] inline-block h-[11px] w-[1.5px] translate-y-[1px] animate-pulse bg-white/70 align-middle"
          />
        ) : null}
      </p>
    </div>
  );
}

/* ──────────────────────── 回应这一刻 ──────────────────────── */

/**
 * 「回应这一刻」入口：点开全屏毛玻璃输入；冷却中显示酝酿倒计时。
 */
function RespondInput({
  cooldownRemainingSec,
  onOpenRespond,
}: {
  cooldownRemainingSec: number;
  onOpenRespond: () => void;
}) {
  const cooling = cooldownRemainingSec > 0;

  return (
    <div className="flex w-full items-center justify-center border-t-[0.5px] border-[rgba(153,153,153,0.2)] px-[16px] pb-[4px] pt-[8px]">
      {cooling ? (
        <p
          className="w-full text-left text-[12px] leading-[1.5] text-[#ffc46b]/85"
          aria-live="polite"
        >
          {cooldownRemainingSec}s世界正在酝酿回响
        </p>
      ) : (
        <button
          type="button"
          onClick={onOpenRespond}
          className="min-w-0 flex-1 text-left text-[12px] leading-[1.5] text-white/30"
        >
          回应这一刻...
        </button>
      )}
    </div>
  );
}
