"use client";

import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type PhoneFrameProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  dataNodeId?: string;
  dataName?: string;
};

/**
 * Context that hands each PhoneFrame's overlay root down to the sheets,
 * bubbles, and modals rendered inside it. Consumers call
 * `usePhoneOverlayRoot()` and portal into the returned element instead
 * of looking it up by global id.
 *
 * This matters once more than one PhoneFrame is in the DOM at the same
 * time — e.g. when the chat modal slides in over the map, both frames
 * carry a `#phone-overlay-root` node and `document.getElementById`
 * would always resolve to the one that rendered first (the map's),
 * causing sheets opened inside the chat to render behind the chat. The
 * context guarantees a sheet always portals into the overlay root of
 * its own enclosing PhoneFrame.
 */
const PhoneOverlayRootContext = createContext<HTMLElement | null>(null);

export function usePhoneOverlayRoot(): HTMLElement | null {
  return useContext(PhoneOverlayRootContext);
}

export function PhoneFrame({
  children,
  className,
  style,
  dataNodeId,
  dataName,
}: PhoneFrameProps) {
  // Ref-callback state so consumers re-render once the overlay node
  // mounts (SSR renders with `null`, then the client pass fills it in).
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);

  return (
    <div
      className={`relative w-full max-w-[375px] overflow-hidden bg-[#101519] md:rounded-[40px] md:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.35)] md:ring-1 md:ring-white/10 ${className ?? ""}`}
      style={{
        height: "min(100dvh, 812px)",
        containerType: "inline-size",
        ...style,
      }}
      data-node-id={dataNodeId}
      data-name={dataName}
    >
      <PhoneOverlayRootContext.Provider value={overlayRoot}>
        {children}
      </PhoneOverlayRootContext.Provider>
      {/*
       * Top-most overlay slot for transient UI that must sit above every
       * other phone-frame child (world broadcast, nav, etc.) — action
       * sheets / modal bubbles portal into here via the
       * `usePhoneOverlayRoot` context. `pointer-events-none` on the host
       * lets taps fall through when nothing is mounted; each portaled
       * layer re-enables pointer events on itself as needed.
       *
       * The `id` is kept for backwards compatibility and easier
       * inspection in devtools, but nothing inside the app still looks
       * it up globally (and when the chat modal is open there are two
       * elements with this id, which is why the context exists).
       */}
      <div
        id="phone-overlay-root"
        ref={setOverlayRoot}
        className="pointer-events-none absolute inset-0 z-[60]"
      />
    </div>
  );
}

/**
 * Scales a 2x Figma design canvas (750×1624) to fit the PhoneFrame width,
 * so you can paste Figma coordinates verbatim. Requires a PhoneFrame ancestor
 * (uses container queries via `100cqw`).
 */
export function DesignCanvas({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute left-0 top-0 origin-top-left"
      style={{
        width: "750px",
        height: "1624px",
        transform: "scale(calc(100cqw / 750px))",
      }}
    >
      {children}
    </div>
  );
}
