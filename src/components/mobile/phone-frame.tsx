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
 * Context that hands the nearest overlay root down to the sheets,
 * bubbles, and modals rendered inside it. Consumers call
 * `usePhoneOverlayRoot()` and portal into the returned element instead
 * of looking it up by global id.
 *
 * 有嵌套才需要这个 context：聊天浮层盖在地图上时，屏里有两个浮层槽，按 id
 * 全局找永远只会找到先渲染的那个（地图的），聊天里开的半层就掉到聊天底下去
 * 了。走 context 的话，一个半层总是挂进包着它的那个作用域。
 */
const PhoneOverlayRootContext = createContext<HTMLElement | null>(null);

export function usePhoneOverlayRoot(): HTMLElement | null {
  return useContext(PhoneOverlayRootContext);
}

/**
 * 一块「本层的浮层归我管」的作用域：children 里的半层都会 portal 到紧跟在它
 * 们后面的那个槽里，而不是外面那个。
 *
 * PhoneFrame 自己用它开出第一层；进群聊的 `EnterLayer` 再开一层 —— 聊天盖在
 * 地图上，聊天里打开的半层就得盖在聊天上，用外层那个槽会掉到聊天底下去。
 *
 * `pointer-events-none` 让没东西挂着的时候点击照常穿过去；每个挂进来的层自
 * 己把点击收回去。
 */
export function PhoneOverlayScope({
  children,
  id,
  className,
}: {
  children: ReactNode;
  /** 只为 devtools 好认，代码里没人按 id 找它。 */
  id?: string;
  className?: string;
}) {
  // Ref-callback state so consumers re-render once the overlay node
  // mounts (SSR renders with `null`, then the client pass fills it in).
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  return (
    <>
      <PhoneOverlayRootContext.Provider value={root}>
        {children}
      </PhoneOverlayRootContext.Provider>
      <div
        id={id}
        ref={setRoot}
        className={`pointer-events-none absolute inset-0 z-[60] ${className ?? ""}`}
      />
    </>
  );
}

export function PhoneFrame({
  children,
  className,
  style,
  dataNodeId,
  dataName,
}: PhoneFrameProps) {
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
      /* 钻进下一层时要按「屏里的百分比」定原点，得先找得到这个盒子。 */
      data-phone-frame=""
    >
      {/*
       * 框内最上面那一层浮层：世界播报、动作半层这类东西 portal 到这儿，压住
       * 别的所有子层。`id` 只是留给 devtools 好认 —— 代码里没人按 id 找它，
       * 也不能找：同屏可能有不止一个手机框，靠 context 才认得自己那个。
       */}
      <PhoneOverlayScope id="phone-overlay-root">{children}</PhoneOverlayScope>
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
