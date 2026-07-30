"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";
import { CastAvatar } from "@/components/tilia/cast-avatar";
import { TILIA_CAST, type CastMember } from "@/lib/tilia/cast";
import {
  RELEASE_830,
  RELEASE_830_LABEL,
  STORY_CORE,
  XK101_NOTE,
} from "@/lib/tilia/lore";
import { CITY_BY_ID } from "@/lib/tilia/world";

const ANIM_MS = 340;

type Tab = "cast" | "lore";

/**
 * 人物与世界观面板。自下而上升起的全屏层，两个分页：
 *   • 人物 —— 女主 + 四位男主，可展开看性格／台词／具体人设；
 *   • 世界观 —— 故事核心分段、XK-101 判词、830 体验内容清单。
 *
 * 之所以做成一个面板两个分页而不是两个入口：地图页顶部空间有限，
 * 而这两块内容都是「读设定」的行为，放在一起切换比来回开关两个
 * 浮层更顺。
 */
export function CastPanel({
  open,
  /**
   * 打开时要直接展开哪个角色。从地图上点角色头像、或从房间弹窗的
   * 「此刻在场」点进来时会带上，面板会自动切到人物页并展开对应卡片，
   * 省掉用户再自己找一次的步骤。
   */
  focusMemberId,
  onClose,
}: {
  open: boolean;
  focusMemberId?: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>("cast");
  /** 当前展开的角色 id；一次只展开一个，避免长文堆叠难读。 */
  const [expanded, setExpanded] = useState<string | null>(null);

  // 带着指定角色打开时，切到人物页、展开它，并滚动到可见位置 ——
  // 被点的角色可能排在列表末尾，不滚动的话面板打开后看起来像没反应。
  useEffect(() => {
    if (!open || !focusMemberId) return;
    setTab("cast");
    setExpanded(focusMemberId);
    // 等升起动画走完再滚，否则滚动位置会被 transform 带偏。
    const t = setTimeout(() => {
      document
        .getElementById(`tilia-cast-${focusMemberId}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, ANIM_MS + 60);
    return () => clearTimeout(t);
  }, [open, focusMemberId]);

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

  const overlayRoot = usePhoneOverlayRoot();
  if (!mounted || !overlayRoot) return null;

  return createPortal(
    <div className="pointer-events-auto absolute inset-0 z-[70]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="人物与世界观"
        className={`absolute inset-0 flex flex-col bg-[#0D141C] transform-gpu transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 头部：标题 + 关闭 + 分页切换。状态栏由外层页面渲染，
            这里只留出 44px 的安全区。 */}
        <header className="shrink-0 px-[16px] pb-[10px] pt-[52px]">
          <div className="flex items-center justify-between">
            <h1 className="text-[17px] font-medium leading-[1.2] text-white">
              人物与世界观
            </h1>
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="-mr-[6px] inline-flex size-[32px] items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                className="size-[19px]"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div
            role="tablist"
            aria-label="面板分页"
            className="mt-[12px] inline-flex rounded-full bg-white/[0.07] p-[3px]"
          >
            {(
              [
                ["cast", "人物设定"],
                ["lore", "故事核心"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-full px-[16px] py-[6px] text-[12.5px] leading-none transition-colors ${
                  tab === key
                    ? "bg-white text-[#111]"
                    : "text-white/65 hover:text-white/85"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[16px] pb-[34px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tab === "cast" ? (
            <ul className="flex flex-col gap-[10px]">
              {TILIA_CAST.map((m) => (
                <li key={m.id} id={`tilia-cast-${m.id}`} className="scroll-mt-[8px]">
                  <CastCard
                    member={m}
                    expanded={expanded === m.id}
                    onToggle={() =>
                      setExpanded((cur) => (cur === m.id ? null : m.id))
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <LoreTab />
          )}
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/* ─────────────────────────── 人物卡 ─────────────────────────── */

function CastCard({
  member,
  expanded,
  onToggle,
}: {
  member: CastMember;
  expanded: boolean;
  onToggle: () => void;
}) {
  const city = CITY_BY_ID[member.cityId];

  return (
    <div
      className="overflow-hidden rounded-[16px] bg-white/[0.045]"
      style={{ boxShadow: `inset 3px 0 0 ${member.accent}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-[12px] px-[13px] py-[12px] text-left"
      >
        <CastAvatar member={member} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-[7px]">
            <span className="text-[15px] font-medium leading-none text-white">
              {member.name}
            </span>
            <span className="text-[11px] leading-none text-white/45">
              {member.gender} · {member.age}
            </span>
          </div>
          {member.nameNote ? (
            <div className="mt-[4px] text-[10.5px] leading-none text-white/35">
              {member.nameNote}
            </div>
          ) : null}
          <p className="mt-[5px] line-clamp-1 text-[11.5px] leading-[1.4] text-white/62">
            {member.headline}
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className={`size-[14px] shrink-0 text-white/40 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded ? (
        <div className="px-[13px] pb-[15px] motion-safe:animate-[livo-fade-in_240ms_ease-out]">
          {/* 城籍 + 核心标签 */}
          <div className="flex flex-wrap gap-[6px]">
            <Chip>{`城籍 · ${member.origin}`}</Chip>
            {city ? <Chip>{`势力 · ${city.name}`}</Chip> : null}
            {member.coreTags.map((t) => (
              <Chip key={t} accent={member.accent}>
                {t}
              </Chip>
            ))}
          </div>

          <Field label="性格">{member.personality}</Field>

          <Field label="说话风格">
            <ul className="flex flex-col gap-[6px]">
              {member.quotes.map((q) => (
                <li
                  key={q}
                  className="border-l border-white/15 pl-[9px] text-white/75"
                >
                  {q}
                </li>
              ))}
            </ul>
          </Field>

          <Field label="具体人设">
            <div className="flex flex-col gap-[7px]">
              {member.profile.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Field>

          <p
            className="mt-[13px] rounded-[10px] px-[11px] py-[9px] text-[12px] italic leading-[1.65] text-white/80"
            style={{ backgroundColor: `${member.accent}1f` }}
          >
            {member.epigraph}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-[7px] py-[3px] text-[10.5px] leading-none"
      style={
        accent
          ? { backgroundColor: `${accent}2b`, color: "#fff" }
          : { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }
      }
    >
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-[13px]">
      <div className="text-[10.5px] font-medium tracking-[0.08em] text-white/38">
        {label}
      </div>
      <div className="mt-[5px] text-[12px] leading-[1.7] text-white/78">
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────── 世界观页 ─────────────────────────── */

function LoreTab() {
  return (
    <div className="flex flex-col gap-[12px]">
      {/* XK-101 判词置顶 —— 它是整个故事的驱动核心。 */}
      <div className="rounded-[16px] bg-gradient-to-br from-[#FFD79A]/[0.16] to-[#FFD79A]/[0.04] px-[14px] py-[13px]">
        <div className="text-[10.5px] font-medium tracking-[0.1em] text-[#FFD79A]/80">
          XK-101
        </div>
        <p className="mt-[6px] text-[13px] leading-[1.65] text-white/90">
          {XK101_NOTE}
        </p>
      </div>

      {STORY_CORE.map((s) => (
        <div
          key={s.heading}
          className="rounded-[16px] bg-white/[0.045] px-[14px] py-[13px]"
        >
          <h3 className="text-[13.5px] font-medium leading-none text-white">
            {s.heading}
          </h3>
          <p className="mt-[7px] text-[12.5px] leading-[1.7] text-white/78">
            {s.body}
          </p>
        </div>
      ))}

      {/*
        大陆势力图的入口。它还原的是文档里的「XK-101 势力诉求表」，
        但设计稿的地图页没有它的位置 —— 于是收到这里：读世界观的人
        才会想看车窗外那片大陆上谁在盯着女主手里的试管。
      */}
      <Link
        href="/tilia/continent"
        className="flex items-center gap-[12px] rounded-[16px] bg-white/[0.045] px-[14px] py-[13px] transition-colors hover:bg-white/[0.07]"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-medium leading-none text-white">
            大陆势力图
          </h3>
          <p className="mt-[6px] text-[12px] leading-[1.6] text-white/60">
            和平号沿途五座城、各自的诉求与能动的手，以及那条从维萨到万晁的航线。
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="size-[14px] shrink-0 text-white/40"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      <div className="rounded-[16px] bg-white/[0.045] px-[14px] py-[13px]">
        <h3 className="text-[13.5px] font-medium leading-none text-white">
          {RELEASE_830_LABEL}
        </h3>
        <div className="mt-[10px] flex flex-wrap gap-[6px]">
          {RELEASE_830.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-[7px] bg-white/[0.08] px-[9px] py-[5px] text-[11.5px] leading-none text-white/80"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
