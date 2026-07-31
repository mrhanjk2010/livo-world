"use client";

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
 * 本地 dev 下没有版本号，列表照旧列出来但不可点 —— 本地只有一份代码，让人点了
 * 跳到 404 更糟。
 */
export function DemoVersionSwitch() {
  const live = DEMO_BASE !== "" && DEMO_VERSION_ID !== "";

  return (
    <section className="flex flex-col gap-[6px]" aria-label="演示版本">
      <p className="px-[2px] text-[11px] font-medium uppercase tracking-[0.06em] text-white/35">
        演示版本
      </p>

      {DEMO_VERSIONS.map((v) => {
        const current = live ? v.id === DEMO_VERSION_ID : v === DEMO_VERSIONS[0];
        const shell = `rounded-[12px] border px-[12px] py-[10px] text-left transition-colors ${
          current
            ? "border-white/25 bg-white/[0.1] text-white"
            : "border-white/[0.06] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06]"
        }`;

        const body = (
          <>
            <span className="flex items-center justify-between gap-[8px]">
              <span className="text-[13px] font-medium leading-none">
                {v.id} · {v.label}
              </span>
              {current ? (
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
        if (current || !live) {
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
    </section>
  );
}
