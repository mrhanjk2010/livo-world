import { TiliaMapDemoShell } from "@/components/tilia/tilia-map-demo-shell";

/**
 * 《蒂利亚之冬》世界地图的规范地址。
 *
 * `/` 也渲染同一棵树（首页默认落地世界地图），这个前缀路由存在的
 * 意义是：给世界切换器一个稳定的「这个世界的地图」链接，并为后续
 * `/tilia/chat/*`、`/tilia/stories` 等子页预留命名空间 —— 避免和
 * DOLO 现有的扁平 `/chat/[location]` 撞车（那里的 location 直接是
 * POI 名字，两个作品的地名会互相覆盖）。
 */
export default function TiliaMapPage() {
  return <TiliaMapDemoShell />;
}
