/**
 * Demo 演示预设 —— 供右侧系统菜单快速切换地图图层。
 * 默认态与当前产品口径一致：仅角色头像漫游。
 */

export type DemoMapPreset = "default" | "destiny" | "echo" | "all";

export type DemoMapLayers = {
  /** 地图命运演式（红/蓝旋涡）。 */
  showDestiny: boolean;
  /** 地图世界回响（金橙光环）。 */
  showEcho: boolean;
};

export type DemoPresetDef = {
  id: DemoMapPreset;
  label: string;
  hint: string;
  layers: DemoMapLayers;
};

export const DEMO_PRESETS: readonly DemoPresetDef[] = [
  {
    id: "default",
    label: "默认态",
    hint: "仅角色头像漫游",
    layers: { showDestiny: false, showEcho: false },
  },
  {
    id: "destiny",
    label: "命运演式",
    hint: "红 / 蓝命运标记",
    layers: { showDestiny: true, showEcho: false },
  },
  {
    id: "echo",
    label: "世界回响",
    hint: "金橙回响标记",
    layers: { showDestiny: false, showEcho: true },
  },
  {
    id: "all",
    label: "完整图层",
    hint: "命运 + 回响同屏",
    layers: { showDestiny: true, showEcho: true },
  },
];

export const DEFAULT_DEMO_PRESET: DemoMapPreset = "default";

export function layersForPreset(preset: DemoMapPreset): DemoMapLayers {
  const hit = DEMO_PRESETS.find((p) => p.id === preset);
  return hit?.layers ?? DEMO_PRESETS[0].layers;
}
