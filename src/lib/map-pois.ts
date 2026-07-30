/**
 * Canonical POI registry — single source of truth for the seven
 * locations on DOLO's world map. Both `MapScreen` (pannable map)
 * and `TrajectoryOverlay` (activity-trajectory takeover) read from
 * here, but they scale the raw Figma coordinates differently:
 *
 *   • MapScreen renders the map image at 906px wide (Figma's map
 *     layer), offset -78px within the 750px frame. POI pins use
 *     `centerXPct = (centerX - (-78)) / 906` (map-image-space).
 *
 *   • TrajectoryOverlay renders the whole phone frame at the
 *     Figma 750×1624 aspect (the phone is 375px wide so percentages
 *     work out to half-scale). POIs here use
 *     `xPct = centerX / 750, yPct = topY / 1624` (frame-space).
 *
 * Keeping the raw Figma coords in one place avoids drift between
 * the two surfaces when a POI moves.
 */

export type POIDef = {
  label: string;
  /** Horizontal center of the POI chip in the 750-wide Figma frame. */
  figmaCenterX: number;
  /** Top edge of the POI chip in the 1624-tall Figma frame. */
  figmaTopY: number;
};

export const FIGMA_FRAME_W = 750;
export const FIGMA_FRAME_H = 1624;

/**
 * Map-layer geometry shared with `MapScreen`: the map image is
 * positioned at x=-78 within the 750-wide frame and spans 906 wide —
 * so it overflows horizontally (pan) while exactly filling the frame's
 * height. Trajectory overlay reuses these to place POIs + characters
 * in the same pixel positions as the home map.
 */
export const FIGMA_MAP_OFFSET_X = -78;
export const FIGMA_MAP_W = 906;
export const FIGMA_MAP_H = FIGMA_FRAME_H;
/**
 * Vertical offset (in Figma units) between a POI chip's top edge and
 * where a character's avatar TOP should sit when "standing at" that
 * POI. Matches the home page's wandering-friends layout.
 */
export const AVATAR_STAND_OFFSET_FIGMA = 114;

export const POIS: readonly POIDef[] = [
  { label: "操场", figmaCenterX: 52 + 54, figmaTopY: 294 },
  { label: "图书馆", figmaCenterX: 538 + 64, figmaTopY: 494 },
  { label: "体育馆", figmaCenterX: 230 + 64, figmaTopY: 486 },
  { label: "食堂", figmaCenterX: 556 + 54, figmaTopY: 738 },
  { label: "后山", figmaCenterX: 158 + 54, figmaTopY: 891 },
  { label: "教室", figmaCenterX: 543 + 54, figmaTopY: 1130 },
  { label: "学校大门", figmaCenterX: 72 + 74, figmaTopY: 1240 },
];

/** Map of label → definition for quick lookup. */
export const POI_BY_LABEL: Readonly<Record<string, POIDef>> = Object.fromEntries(
  POIS.map((p) => [p.label, p]),
);

/** Frame-space percentage (0..1) for a given POI — used by TrajectoryOverlay. */
export function poiFramePct(label: string): { xPct: number; yPct: number } {
  const p = POI_BY_LABEL[label];
  if (!p) return { xPct: 0.5, yPct: 0.5 };
  return {
    xPct: p.figmaCenterX / FIGMA_FRAME_W,
    yPct: p.figmaTopY / FIGMA_FRAME_H,
  };
}

/**
 * Map-image-space percentage (0..1) — same basis `MapScreen` uses for
 * POIPin inside PannableMap: the map image spans `FIGMA_MAP_W` wide and
 * starts at `FIGMA_MAP_OFFSET_X` within the Figma frame, so shifting
 * `figmaCenterX` by +78 gives the POI's position within the map image.
 * Use this when rendering POIs / trails / characters *inside* a
 * PannableMap whose inner div represents the map image.
 */
export function poiMapPct(label: string): { xPct: number; yPct: number } {
  const p = POI_BY_LABEL[label];
  if (!p) return { xPct: 0.5, yPct: 0.5 };
  return {
    xPct: (p.figmaCenterX - FIGMA_MAP_OFFSET_X) / FIGMA_MAP_W,
    yPct: p.figmaTopY / FIGMA_MAP_H,
  };
}
