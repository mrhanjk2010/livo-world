import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { PageTransition } from "@/components/mobile/page-transition";
import { StoryFlagsProvider } from "@/components/tilia/story-flags-context";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="min-h-dvh antialiased">
        <StoryFlagsProvider>
          <PageTransition>{children}</PageTransition>
          {modal}
        </StoryFlagsProvider>
      </body>
    </html>
  );
}
