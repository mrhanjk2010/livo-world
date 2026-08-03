"use client";

import { useState } from "react";
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
 * 收起来只留当前这一版那一行，点开才列全部：版本一版版攒着，摊开列了五六条之
 * 后，这一段能把下面的剧情节点和图层全顶出屏外 —— 而讲的过程里真正常用的是那
 * 两段，版本是偶尔才去换一次的东西。
 *
 * 本地 dev 下没有版本号，列表照旧列出来但不可点 —— 本地只有一份代码，让人点了
 * 跳到 404 更糟。
 */
export function DemoVersionSwitch() {
  const live = DEMO_BASE !== "" && DEMO_VERSION_ID !== "";
  const [open, setOpen] = useState(false);

  /* 线上认版本号，本地没有版本号就把最新那一版当作「当前」。 */
  const current =
    (live ? DEMO_VERSIONS.find((v) => v.id === DEMO_VERSION_ID) : undefined) ??
    DEMO_VERSIONS[0];

  return (
    <section className="flex flex-col gap-[6px]" aria-label="演示版本">
      <p className="px-[2px] text-[11px] font-medium uppercase tracking-[0.06em] text-white/35">
        演示版本
      </p>

      <div>
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
              className={`text-white/50 transition-transform duration-300 ${
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
          0fr → 1fr 的网格行：不用估一个 max-height（版本条数一直在变，估小了会
          裁掉最后一版，估大了收起时会先空等一段），高度交给内容自己算。
        */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            {/*
              展开也压住高度：版本还会继续攒，全摊开会把下面两段顶到屏外 ——
              而那两段（剧情节点、图层）才是讲的时候一直在用的。露三条多一点，
              再往前翻是滚的事。
            */}
            <div className="flex max-h-[268px] flex-col gap-[6px] overflow-y-auto pt-[6px]">
              {DEMO_VERSIONS.map((v) => {
                const isCurrent = v.id === current.id;
                const shell = `rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
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
                        <span className="text-[10px] text-white/30">
                          {v.date}
                        </span>
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

              <p className="px-[2px] text-[11px] leading-[1.45] text-white/30">
                {live
                  ? "每版是一次完整发布，各自留在线上；根地址永远指向最新那一版。"
                  : "本地预览只有当前这一份代码，线上才切得动。"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
