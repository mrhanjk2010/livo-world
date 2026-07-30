/**
 * 「和平号」地图底图 —— 按车厢分段。
 *
 * 为什么分段：整车会越接越长。如果继续维护一张巨图，每加一节车厢就得
 * 重画底图、再把已有房间的归一化坐标全部重量一遍（`train.ts` 顶上原来
 * 那句「换底图就必须重新量」说的就是这个代价）。
 *
 * 分段之后：
 *   • 每节车厢一张自己的底图，自带一套「段内坐标」（0..1 相对这一段）；
 *   • 各段缩放到统一画布高度后横向排布，加一节只是往 `TRAIN_SEGMENTS`
 *     尾部 push，已有段的段内坐标一个都不用动；
 *   • 对外只暴露解析后的整幅画布坐标，渲染层与标记层无感。
 *
 * 纵向不受影响：新段只让画布变宽，画布高度恒为 `TRAIN_CANVAS_H`，
 * 所以 `TRAIN_PAN_SCALE` 那套纵向取景的调参依然成立。
 */

export type MapSegment = {
  id: string;
  /** 车厢名，用于无障碍描述与调试。 */
  name: string;
  src: string;
  /**
   * 底图原始像素尺寸。只用来推这一段缩放到统一高度后占多宽，
   * 不要求各段同尺寸。
   */
  width: number;
  height: number;
  /**
   * 默认不显示，等剧情把它揭开。
   *
   * 注意：被 gate 的段**始终**参与画布布局与坐标解析 —— 画布尺寸恒定，
   * 所有落点才能在模块加载时一次算完。揭开与否只影响三件事：底图渲染、
   * 拖拽边界、以及这一段上的房间/标记是否入场。
   */
  gated?: boolean;
};

/** 整幅画布的统一高度：每段先缩放到这个高度，再横向拼接。 */
export const TRAIN_CANVAS_H = 1440;

/**
 * 段与段之间留出的连接过道宽度（画布像素）。真实列车的车厢之间有一段
 * 折棚，留出这道缝隙一是让接缝变成「有意为之」而不是看着像图没对齐，
 * 二是给房间名牌留出不会跨段互撞的呼吸位。
 */
export const SEGMENT_GAP = 72;

/** 驾驶车厢的段 id，剧情侧要按它判断揭开状态。 */
export const CAB_SEGMENT_ID = "cab";

/**
 * 车厢顺序 = 从车头到车尾。
 *
 * 首屏取景写成主车厢的段内锚点（见 `train.ts`），所以往任意一端加段都不会
 * 让主车厢在屏幕上挪动 —— 画布变宽的同时各段渲染尺寸不变，主车厢的落点
 * 像素位置恒定。这一点是实测过的。
 */
export const TRAIN_SEGMENTS: readonly MapSegment[] = [
  {
    id: CAB_SEGMENT_ID,
    name: "驾驶车厢",
    src: "/figma/tilia/train-map-cab.jpg",
    width: 1024,
    height: 1024,
    // 「地图扩展」剧情节点之前，车头是不存在的。
    gated: true,
  },
  {
    id: "main",
    name: "主车厢",
    src: "/figma/tilia/train-map.jpg",
    width: 1600,
    height: 1440,
  },
];

/** 省略 `segment` 时默认落在哪一节。 */
export const DEFAULT_SEGMENT_ID = "main";

export type SegmentLayout = MapSegment & {
  /** 缩放到统一高度后的宽度（画布像素）。 */
  drawW: number;
  /** 这一段左沿在整幅画布上的像素位置。 */
  offsetX: number;
};

const LAYOUT: readonly SegmentLayout[] = (() => {
  const out: SegmentLayout[] = [];
  let cursor = 0;
  TRAIN_SEGMENTS.forEach((seg, i) => {
    if (i > 0) cursor += SEGMENT_GAP;
    const drawW = (seg.width / seg.height) * TRAIN_CANVAS_H;
    out.push({ ...seg, drawW, offsetX: cursor });
    cursor += drawW;
  });
  return out;
})();

export const SEGMENT_LAYOUT = LAYOUT;

/** 整幅画布宽度 = 最后一段的右沿。 */
export const TRAIN_CANVAS_W = LAYOUT.reduce(
  (max, seg) => Math.max(max, seg.offsetX + seg.drawW),
  0,
);

const BY_ID: Record<string, SegmentLayout> = LAYOUT.reduce<
  Record<string, SegmentLayout>
>((acc, seg) => {
  acc[seg.id] = seg;
  return acc;
}, {});

function segmentOf(id: string | undefined): SegmentLayout {
  return BY_ID[id ?? DEFAULT_SEGMENT_ID] ?? BY_ID[DEFAULT_SEGMENT_ID]!;
}

/** 这个段 id 当前是否需要剧情揭开。 */
export function isSegmentGated(id: string | undefined): boolean {
  return segmentOf(id).gated === true;
}

/**
 * 两段之间的连接过道，渲染层照它画折棚。单段时为空数组。
 */
export const SEGMENT_CONNECTORS: readonly {
  id: string;
  /** 过道左沿 / 宽度，均为整幅画布的归一化比例。 */
  leftPct: number;
  widthPct: number;
  /** 相邻两段里有没有还没揭开的，用来决定折棚是否入场。 */
  gatedSide: boolean;
}[] = LAYOUT.slice(1).map((seg, i) => {
  const prev = LAYOUT[i]!;
  const left = prev.offsetX + prev.drawW;
  return {
    id: `${prev.id}→${seg.id}`,
    leftPct: left / TRAIN_CANVAS_W,
    widthPct: SEGMENT_GAP / TRAIN_CANVAS_W,
    gatedSide: prev.gated === true || seg.gated === true,
  };
});

/** 当前该画出来的车厢段。 */
export function visibleSegments(includeGated: boolean): SegmentLayout[] {
  return LAYOUT.filter((seg) => includeGated || !seg.gated);
}

/** 两侧都已入场的折棚才画得出来。 */
export function visibleConnectors(
  includeGated: boolean,
): typeof SEGMENT_CONNECTORS {
  if (includeGated) return SEGMENT_CONNECTORS;
  return SEGMENT_CONNECTORS.filter((c) => !c.gatedSide);
}

/**
 * 可拖拽范围（整幅画布的归一化比例）。没揭开的段要连带把它那段画布
 * 关在边界外，否则用户能拖进一片纯黑。
 */
export function xBoundsForReveal(includeGated: boolean): {
  min: number;
  max: number;
} {
  const segs = visibleSegments(includeGated);
  const left = Math.min(...segs.map((s) => s.offsetX));
  const right = Math.max(...segs.map((s) => s.offsetX + s.drawW));
  return { min: left / TRAIN_CANVAS_W, max: right / TRAIN_CANVAS_W };
}

/** 一个「段内坐标」落点。`xPct` / `yPct` 相对这一段自己的底图。 */
export type SegmentPoint = {
  /** 落在哪一节车厢；省略即主车厢。 */
  segment?: string;
  xPct: number;
  yPct: number;
};

/** 段内坐标 → 整幅画布归一化坐标。 */
export function resolveSegmentPoint(point: SegmentPoint): {
  xPct: number;
  yPct: number;
} {
  const seg = segmentOf(point.segment);
  return {
    xPct: (seg.offsetX + point.xPct * seg.drawW) / TRAIN_CANVAS_W,
    // 各段等高铺满画布，纵向无需换算。
    yPct: point.yPct,
  };
}

/**
 * 解析一条带落点的记录，其余字段原样保留。
 *
 * 约定：数据模块对外导出的都是**已解析**的记录，消费方拿到的 `xPct`
 * 一律是整幅画布坐标 —— 不要对同一条记录解析两次。
 */
export function resolveOnSegment<T extends SegmentPoint>(item: T): T {
  return { ...item, ...resolveSegmentPoint(item) };
}

/**
 * 把一段「段内尺度」的偏移量折算成整幅画布尺度。
 *
 * 派生落点（比如「餐车名牌左上方一点」）必须用它：直接给整幅画布的
 * 0.02 会随着车越接越长而越缩越小，视觉偏移量就不稳定了。
 */
export function scaleSegmentDx(dxPct: number, segmentId?: string): number {
  return (dxPct * segmentOf(segmentId).drawW) / TRAIN_CANVAS_W;
}

/** 某一段在整幅画布上的横向区间，供随机落点限制在车厢内部。 */
export function segmentXRange(segmentId?: string): {
  min: number;
  max: number;
} {
  const seg = segmentOf(segmentId);
  return {
    min: seg.offsetX / TRAIN_CANVAS_W,
    max: (seg.offsetX + seg.drawW) / TRAIN_CANVAS_W,
  };
}
