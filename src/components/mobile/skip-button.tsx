"use client";

import Image from "next/image";
import type { MouseEventHandler } from "react";

export function SkipButton({
  onClick,
}: {
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-[5px] rounded-[16px] bg-white/10 px-[10px] py-[6px] text-[14px] font-medium text-white backdrop-blur-[4px] transition-colors hover:bg-white/15 active:bg-white/20"
    >
      <span>跳过</span>
      <Image src="/figma/skip-arrow.svg" alt="" width={14} height={14} />
    </button>
  );
}
