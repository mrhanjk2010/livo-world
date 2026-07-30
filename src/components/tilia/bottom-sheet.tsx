"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePhoneOverlayRoot } from "@/components/mobile/phone-frame";

/** 进出动画时长，与世界切换页保持一致的手感。 */
const ANIM_MS = 320;

/**
 * 半层弹窗壳层 —— 遮罩、两段式挂载、上滑/下收动画、抓手、关闭按钮。
 *
 * 房间弹窗和城邦势力弹窗共用它：两者的外壳完全一致，只有内容不同。
 * 关键是「两段式挂载」——先以收起状态进 DOM，下一帧再翻到展开态，
 * 这样进和出两个方向的 CSS 过渡都能真正跑起来（直接条件渲染的话
 * 关闭动画会被卸载吃掉）。
 */
export function BottomSheet({
  open,
  onClose,
  label,
  /** 顶部那道细光的颜色，用来区分不同主体的弹窗身份。 */
  accent,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  accent?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

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
    <div className="pointer-events-auto absolute inset-0 z-[60]">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-[320ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={label}
        /* 底色取设计稿色板里的 #101519，弹窗和地图页是同一套深色。 */
        className={`absolute inset-x-0 bottom-0 flex max-h-[78%] flex-col overflow-hidden rounded-t-[22px] border-t border-white/10 bg-[#101519]/95 backdrop-blur-[16px] transform-gpu transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          boxShadow: `inset 0 1px 0 ${accent ?? "#ffffff"}66, 0 -18px 50px -20px rgba(0,0,0,0.9)`,
        }}
      >
        <div className="flex shrink-0 justify-center pt-[8px]">
          <span
            aria-hidden
            className="h-[4px] w-[36px] rounded-full bg-white/25"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[26px] pt-[12px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </section>
    </div>,
    overlayRoot,
  );
}

/** 弹窗右上角的关闭按钮，两个弹窗的标题行都用它。 */
export function SheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="关闭"
      onClick={onClose}
      className="-mr-[4px] -mt-[2px] inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        className="size-[17px]"
        aria-hidden
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** 小节标题，弹窗与面板通用。 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-medium tracking-[0.08em] text-white/40">
      {children}
    </div>
  );
}
