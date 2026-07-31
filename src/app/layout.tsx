import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { PageTransition } from "@/components/mobile/page-transition";
import { StoryFlagsProvider } from "@/components/tilia/story-flags-context";
import { cn } from "@/lib/utils";

/*
 * 字体走本地包，不走 `next/font/google`。
 *
 * 同一支 Geist，区别只在从哪儿拿：`next/font/google` 是构建期去 Google 下载
 * 字体文件，网一慢就整个 build 挂在那儿不动（没有超时，看着像卡死，日志停在
 * 「Creating an optimized production build」）。发布是要能随时按下去的事，不
 * 该押在外网上。
 *
 * 本地包挂出来的变量叫 `--font-geist-sans`，而全站读的是 `--font-sans`
 * （`globals.css` 里 `html, body { font-family: var(--font-sans) }`），所以在
 * html 上把两者接起来 —— 位置和 next/font 原来做的事一样，只是这回由我们写。
 * 汉字排在 Geist 后面：Geist 没有汉字，写在前面只是让每个汉字都先撞一次空。
 */
const FONT_STACK = {
  "--font-sans":
    'var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Livo Demo",
  description: "Demo scaffolded for Figma → code workflow",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  /**
   * Parallel `@modal` slot. Used by the intercepting-route overlay for
   * `/chat/[location]` / `/event/[location]` so the underlying map
   * (rendered in `children`) stays mounted while the chat slides in
   * on top of it.
   */
  modal: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={cn("font-sans", GeistSans.variable)}
      style={FONT_STACK}
    >
      <body className="min-h-dvh antialiased">
        <StoryFlagsProvider>
          <PageTransition>{children}</PageTransition>
          {modal}
        </StoryFlagsProvider>
      </body>
    </html>
  );
}
