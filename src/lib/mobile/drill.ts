/**
 * 「往里钻一层」——进某个地方的群聊，这件事的共享状态。
 *
 * 点地图上的一枚地标进群聊，动作是钻进去：聊天从被点的那一点长开来占满屏，
 * 地图同时往前压一档、暗下去。视差是「进到里面去了」的主要线索 —— 只让聊天
 * 长大、底下那层不动，读起来就还是一张卡片浮上来，不是穿过去。
 *
 * 这一层不走路由。原来它是 Next 的拦截路由（`src/app/@modal`）：点地标 push
 * 一个 `/chat/...`，拦截槽把聊天渲染成浮层，地图留在 children 槽里不动。这在
 * `next dev` 下很好，但线上是 GitHub Pages 的静态导出，而 `output: 'export'`
 * 明确不支持拦截路由（它建在 rewrites 上，要服务端在请求时决定渲染哪个组件）。
 * 发布脚本因此每次都得把整个 `@modal` 搬走再构建 —— 于是线上点地标是一次真
 * 路由跳转：地图整棵树卸载、聊天页直接替上，没有过渡，连地图上「回应这一刻」
 * 生成的命运、相机位置、冷却计时也一起没了。
 *
 * 所以改成由地图页自己端着这层浮层（`EnterLayer`），谁都不用跳转：地图始终
 * 挂着，本地和线上是同一套。`/chat/[location]`、`/event/[location]` 这两条真
 * 路由留着，只服务直接打开地址和刷新。
 *
 * 两层不在同一个组件里（一个是地图的内容层，一个是它旁边的浮层），要对的东
 * 西又少 —— 点在哪、进哪儿、进去了没 —— 所以做成一个小的外部 store，谁关心
 * 谁订阅。
 *
 * 坐标记的是「手机屏里的百分比」而不是视口像素：两层同处一个手机框，百分比
 * 过去就能直接当 `transform-origin` 用，两边都不用再量一次自己的位置。
 */

import { useSyncExternalStore } from "react";

/**
 * 两层共用一套配时 —— 聊天长开来和地图往后退必须是同一个动作的两半，各写各
 * 的迟早会错开。进比出慢：进去是要看清「这是走进了哪儿」，退出来只要利索。
 */
export const DRILL_IN_MS = 460;
export const DRILL_OUT_MS = 340;
/** 进：一记减速，末端几乎贴住 —— 到了就停，不回弹。 */
export const DRILL_EASE_IN = "cubic-bezier(0.22, 1, 0.36, 1)";
/** 出：起步慢一点，后半段收回去。 */
export const DRILL_EASE_OUT = "cubic-bezier(0.4, 0, 1, 1)";

/** 要进的那个地方。`mode` 决定聊天页的成色（自由群聊 / 日常事件）。 */
export type EnterTarget = {
  location: string;
  mode: "free" | "event";
};

export type DrillState = {
  /** 有值就是要进去了；`EnterLayer` 认它开场。 */
  target: EnterTarget | null;
  /** 已经钻进去了 —— 上一层该往后退。 */
  deep: boolean;
  /** 从哪一点长开来，写成 `transform-origin` 的样子。 */
  origin: string;
};

const CENTER = "50% 50%";

/** 快照要稳：同一状态必须是同一个对象，不然订阅方每次都以为变了。 */
let state: DrillState = { target: null, deep: false, origin: CENTER };
const SERVER_STATE: DrillState = state;

const listeners = new Set<() => void>();

function set(next: DrillState) {
  if (
    next.target === state.target &&
    next.deep === state.deep &&
    next.origin === state.origin
  ) {
    return;
  }
  state = next;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * 进这个地方。`from` 是被点的那个元素 —— 聊天从它那儿长开来。
 *
 * 不传 `from` 就从屏幕正中长开（列表里选一条之类，本来也没有一个「那一点」）。
 */
export function enterPlace(target: EnterTarget, from?: Element | null): void {
  const origin = from ? originWithin(from) : CENTER;
  set({ ...state, target, origin });
}

/** 只记原点，不开场 —— 给「点完还要等半层收起再进」的入口用。 */
export function markDrillOrigin(el: Element | null): void {
  set({ ...state, origin: el ? originWithin(el) : CENTER });
}

/** 退出去。动画由 `EnterLayer` 自己收尾，这里只是把目标摘掉。 */
export function clearEnterTarget(): void {
  set({ ...state, target: null });
}

/** 钻进去 / 退回来。浮层负责喊，底下那层跟着动。 */
export function setDrillDeep(deep: boolean): void {
  set({ ...state, deep });
}

export function useDrill(): DrillState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/**
 * 元素中心在它所属手机框里的位置，夹回屏内。
 *
 * 地图能拖，pill 被拖出取景框之后照样在 DOM 里、照样点得着（列表里选一个、
 * 或者刚好卡在边上半个）。原点落到屏外几百像素，放大就成了从画面外斜甩进
 * 来。夹到边上：仍然是「从那个方向进去的」，但幅度回到人能看的范围。
 */
function originWithin(el: Element): string {
  const box = el.closest("[data-phone-frame]")?.getBoundingClientRect();
  if (!box || box.width === 0 || box.height === 0) return CENTER;
  const r = el.getBoundingClientRect();
  const x = ((r.left + r.width / 2 - box.left) / box.width) * 100;
  const y = ((r.top + r.height / 2 - box.top) / box.height) * 100;
  return `${clamp(x)}% ${clamp(y)}%`;
}

function clamp(pct: number): number {
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}
