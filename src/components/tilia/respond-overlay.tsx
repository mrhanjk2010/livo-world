"use client";

import { useEffect, useRef, useState } from "react";
import { useStoryFlags } from "@/components/tilia/story-flags-context";
import { CAB_RESPOND_PHRASE } from "@/lib/tilia/cab-carriage";
import {
  pickFloatingPhrases,
  type FloatingPhrase,
} from "@/lib/tilia/respond";

const KEY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

/**
 * 全屏毛玻璃「回应这一刻」：飘浮推荐短语 + 输入框 + 页内软键盘。
 * 选中短语自动填入；发送后交给父级做星轨转场。
 */
export function RespondOverlay({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const { cabExpansionArmed, cabRevealed } = useStoryFlags();
  const [text, setText] = useState("");
  const [phrases, setPhrases] = useState<FloatingPhrase[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 「地图扩展」备好、那道门还没开时，把触发句钉在第一位。
  const stageCabPhrase = cabExpansionArmed && !cabRevealed;

  useEffect(() => {
    if (!open) return;
    setText("");
    setPhrases(
      pickFloatingPhrases(5, stageCabPhrase ? [CAB_RESPOND_PHRASE] : []),
    );
    // 不自动 focus：避免系统键盘顶起视口导致整页错位；用页内软键盘即可。
  }, [open, stageCabPhrase]);

  if (!open) return null;

  const canSend = text.trim().length > 0;

  const insert = (ch: string) => {
    setText((prev) => (prev.length >= 60 ? prev : prev + ch));
  };

  const backspace = () => {
    setText((prev) => prev.slice(0, -1));
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
  };

  return (
    <div
      className="absolute inset-0 z-[70] overflow-hidden"
      role="dialog"
      aria-label="回应这一刻"
    >
      {/* 毛玻璃底 */}
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(12,17,53,0.55)] backdrop-blur-[14px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[240px] bg-gradient-to-b from-[#ffc46b]/15 to-transparent"
      />

      {/* 标题区 —— 固定顶部，不参与底部键盘挤压 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex flex-col items-center px-[28px] pt-[64px]">
        <h1 className="text-[22px] font-semibold leading-[1.3] text-white">
          回应这一刻
        </h1>
        <p className="mt-[8px] max-w-[280px] text-center text-[13px] font-medium leading-[1.45] text-white/45">
          发出的心声也许会改变这个世界的一些命运线
        </p>
      </div>

      {/* 飘浮推荐 —— 落在标题与输入之间 */}
      <div className="pointer-events-none absolute inset-x-0 top-[130px] bottom-[290px] z-[1]">
        {phrases.map((p) => (
          <span
            key={`${p.text}-${p.top}`}
            className="absolute"
            style={{
              top: p.top,
              left: p.left,
              right: p.right,
              transform: `rotate(${p.rotate})`,
            }}
          >
            <button
              type="button"
              onClick={() => setText(p.text)}
              className="pointer-events-auto max-w-[240px] rounded-[100px] border border-white/15 bg-white/10 px-[14px] py-[8px] text-left text-[13px] font-medium leading-[1.35] text-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-[10px] transition-transform active:scale-95 motion-safe:animate-[livo-phrase-float_4.8s_ease-in-out_infinite]"
              style={{ animationDelay: p.delay }}
            >
              {p.text}
            </button>
          </span>
        ))}
      </div>

      {/* 底部输入 + 键盘 —— 贴手机底边，避免悬空错位 */}
      <div className="absolute inset-x-0 bottom-0 z-[2] flex flex-col">
        <div className="px-[12px] pb-[10px]">
          <div className="flex items-center gap-[8px] rounded-[16px] border border-white/12 bg-black/45 px-[12px] py-[10px] backdrop-blur-[12px]">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 60))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") onClose();
              }}
              placeholder="回应这一刻…"
              maxLength={60}
              inputMode="none"
              className="min-w-0 flex-1 bg-transparent text-[15px] leading-[1.4] text-white outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={submit}
              className={`shrink-0 rounded-[100px] px-[14px] py-[7px] text-[13px] font-medium transition-opacity ${
                canSend
                  ? "bg-gradient-to-r from-[#ffc46b] to-[#ff8874] text-[#1a1208]"
                  : "bg-white/10 text-white/30"
              }`}
            >
              发送
            </button>
          </div>
        </div>

        <SoftKeyboard
          onKey={insert}
          onSpace={() => insert(" ")}
          onBackspace={backspace}
          onSend={submit}
          canSend={canSend}
        />
      </div>
    </div>
  );
}

function SoftKeyboard({
  onKey,
  onSpace,
  onBackspace,
  onSend,
  canSend,
}: {
  onKey: (ch: string) => void;
  onSpace: () => void;
  onBackspace: () => void;
  onSend: () => void;
  canSend: boolean;
}) {
  return (
    <div className="w-full border-t border-white/10 bg-[#1c1f26]/96 px-[5px] pb-[10px] pt-[6px] backdrop-blur-[16px]">
      {KEY_ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={`mb-[5px] flex w-full gap-[4px] ${
            rowIdx === 0 ? "" : "px-[8px]"
          }`}
        >
          {rowIdx === 2 ? (
            <Key wide muted onClick={onBackspace} label="⌫" />
          ) : null}
          {row.map((k) => (
            <Key key={k} onClick={() => onKey(k)} label={k} />
          ))}
          {rowIdx === 2 ? (
            <Key
              wide
              onClick={onSend}
              label="发送"
              accent={canSend}
              disabled={!canSend}
            />
          ) : null}
        </div>
      ))}
      <div className="flex w-full gap-[4px]">
        <Key wide onClick={() => onKey("，")} label="，" />
        <Key flex onClick={onSpace} label="空格" />
        <Key wide onClick={() => onKey("。")} label="。" />
        <Key wide onClick={() => onKey("？")} label="？" />
      </div>
    </div>
  );
}

function Key({
  label,
  onClick,
  wide,
  flex,
  muted,
  accent,
  disabled,
}: {
  label: string;
  onClick: () => void;
  wide?: boolean;
  flex?: boolean;
  muted?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-[42px] rounded-[7px] text-[14px] font-medium capitalize transition-transform active:scale-95 disabled:opacity-40 ${
        flex
          ? "min-w-0 flex-[3]"
          : wide
            ? "min-w-0 flex-[1.35] px-[4px]"
            : "min-w-0 flex-1"
      } ${
        accent
          ? "bg-gradient-to-b from-[#ffc46b] to-[#ff9a6b] text-[#1a1208]"
          : muted
            ? "bg-white/8 text-white/70"
            : "bg-white/12 text-white/90"
      }`}
    >
      {label}
    </button>
  );
}
