"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_BASE,
  DEMO_VERSION_ID,
  DEMO_VERSIONS,
  demoVersionHref,
} from "@/lib/demo-versions";

/**
 * 演示版本切换 —— 演示控制最上面那一段。
 *
 * 每一项是一次发布，点了整页换成那一版（跨版本是跨静态站，只能整页跳，见
 * `demoVersionHref`）。放在手机框外和别的演示控制并排：版本是「讲的人」的事，
 * 产品里没有这个概念，不该出现在手机屏里。
 *
 * 平时只占一行，展开的列表浮在上面而不是把这一段撑开：版本一版版攒着，摊开五六
 * 条能把下面的剧情节点和图层顶出屏外；就算收得回去，每点一次整块菜单跳一下也难
 * 用 —— 而讲的过程里一直在用的是下面两段，版本是偶尔才换一次的东西。
 *
 * 本地 dev 下没有版本号，列表照旧列出来但不可点 —— 本地只有一份代码，让人点了
 * 跳到 404 更糟。
 */
export function DemoVersionSwitch() {
  const live = DEMO_BASE !== "" && DEMO_VERSION_ID !== "";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* 线上认版本号，本地没有版本号就把最新那一版当作「当前」。 */
  const current =
    (live ? DEMO_VERSIONS.find((v) => v.id === DEMO_VERSION_ID) : undefined) ??
    DEMO_VERSIONS[0];

  /* 浮层挡着后面的演示控制，点别处和 Esc 都要能立刻让开。 */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <section className="flex flex-col gap-[6px]" aria-label="演示版本">
      <p className="px-[2px] text-[11px] font-medium uppercase tracking-[0.06em] text-white/35">
        演示版本
      </p>

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-[8px] rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
            open
              ? "border-white/25 bg-white/[0.1] text-white"
              : "border-white/15 bg-white/[0.06] text-white hover:border-white/25 hover:bg-white/[0.1]"
          }`}
        >
          <span className="truncate text-[13px] font-medium leading-none">
            {current.id} · {current.label}
          </span>
          <span className="flex shrink-0 items-center gap-[6px]">
            <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] leading-none text-white/80">
              当前
            </span>
            <svg
              aria-hidden
              width="9"
              height="6"
              viewBox="0 0 9 6"
              fill="none"
              className={`text-white/50 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            >
              <path
                d="M1 1.25 4.5 4.75 8 1.25"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {/*
          浮层：脱开文档流盖在下面那两段上，展开收起都不动它们的位置。
          收起时留在 DOM 里但不可点、不可读 —— 只是淡出，不是消失。
        */}
        <div
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-30 origin-top rounded-[14px] border border-white/10 bg-neutral-900/95 p-[6px] shadow-[0_20px_44px_rgba(0,0,0,0.6)] backdrop-blur-xl transition duration-200 ease-out ${
            open
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-[4px] scale-[0.98] opacity-0"
          }`}
          aria-hidden={!open}
          inert={!open}
        >
          {/*
            列表自己滚：版本还会继续攒，浮层一路长下去会掉出屏幕底下。
            露三条多一点，再往前翻是滚的事。
          */}
          <div className="flex max-h-[268px] flex-col gap-[6px] overflow-y-auto">
            {DEMO_VERSIONS.map((v) => {
              const isCurrent = v.id === current.id;
              const shell = `rounded-[10px] border px-[12px] py-[10px] text-left transition-colors ${
                isCurrent
                  ? "border-white/25 bg-white/[0.1] text-white"
                  : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
              }`;

              const body = (
                <>
                  <span className="flex items-center justify-between gap-[8px]">
                    <span className="text-[13px] font-medium leading-none">
                      {v.id} · {v.label}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-full bg-white/15 px-[6px] py-[2px] text-[10px] text-white/80">
                        当前
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/30">{v.date}</span>
                    )}
                  </span>
                  <span className="mt-[6px] block text-[11px] leading-[1.4] text-white/40">
                    {v.note}
                  </span>
                </>
              );

              /*
               * 当前这一版不做成链接：点了只是原地重载，白等一次白屏。
               * 本地同理 —— 没有别的版本可去。
               */
              if (isCurrent || !live) {
                return (
                  <div key={v.id} className={`${shell} cursor-default`}>
                    {body}
                  </div>
                );
              }
              return (
                <a key={v.id} href={demoVersionHref(v.id)} className={shell}>
                  {body}
                </a>
              );
            })}

            <p className="px-[6px] pb-[2px] pt-[2px] text-[11px] leading-[1.45] text-white/30">
              {live
                ? "每版是一次完整发布，各自留在线上；根地址永远指向最新那一版。"
                : "本地预览只有当前这一份代码，线上才切得动。"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
