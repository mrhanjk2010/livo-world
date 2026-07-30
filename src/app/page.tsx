import { TiliaMapDemoShell } from "@/components/tilia/tilia-map-demo-shell";

/**
 * 应用首页 —— 直接落地在《蒂利亚之冬》的世界地图（和平号车厢内部）。
 *
 * 状态栏与底导航都由 `TiliaMapScreen` 自己渲染：设计稿
 * `3378:4318` 里状态栏是「顶部」那层渐变 + 模糊的一部分，底导航是
 * 蒂利亚专用的「圆钮 + 三页签玻璃胶囊」，都和 DOLO 那套通用组件不是
 * 一个东西，所以页面这一层只负责摆手机框与演示菜单。
 *
 * 原来的 DOLO 开场视频流程在 `/intro`，DOLO 校园地图仍在 `/map`
 * （继续用它自己的 `BottomNav`），两个作品通过底导航左侧的「切换
 * 世界」圆钮互跳。这里和 `/tilia/map` 渲染同一棵树。
 */
export default function Home() {
  return <TiliaMapDemoShell />;
}
