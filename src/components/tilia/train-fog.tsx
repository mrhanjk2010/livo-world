import Image from "next/image";

/**
 * 车厢地图的雾层与压暗层。
 *
 * 这一层**不跟着地图平移** —— 设计稿里「雾」和两道渐变都挂在
 * 375×812 的画布上而不是那张 984.5×1001 的底图上，所以它是一圈固定
 * 的屏幕晕影：拖到哪儿，四边都在雾里。这也是这张图的标志性视觉：
 * 车厢是被风雪包住的，看得清的永远只有身边这几间房。
 *
 * 做法是同一张 `fog.png` 摆四份，各转一个方向，让雾从四条边往中间
 * 压。四份的位置、尺寸、变换全部照抄设计稿 `3378:4322`（雾容器
 * 882×815，水平居中、top -6）：
 *
 *   ┌ 上：垂直翻转
 *   │ 左：-90° + 垂直翻转
 *   │ 右：-90°
 *   └ 下：原图
 */

/** 设计稿里雾容器的尺寸与位置（相对 375×812 画布）。 */
const FOG_W = 882;
const FOG_H = 815;
const FOG_TOP = -6;

/** 每份雾的原始尺寸。旋转过的那两份容器宽高互换。 */
const SHEET_W = 540;
const SHEET_H = 716;

const FOG_SRC = "/figma/tilia/fog.png";

/** 四份雾片：容器在雾容器内的位置，以及那份的变换。 */
const SHEETS: readonly {
  key: string;
  left: number;
  top: number;
  /** 容器宽高（旋转 90° 的两份是横放的）。 */
  boxW: number;
  boxH: number;
  transform: string;
}[] = [
  // 下边：原图不变换。
  { key: "bottom", left: 241, top: 99, boxW: SHEET_W, boxH: SHEET_H, transform: "none" },
  // 上边：垂直翻转。
  {
    key: "top",
    left: 224,
    top: -124,
    boxW: SHEET_W,
    boxH: SHEET_H,
    transform: "scaleY(-1)",
  },
  // 左边：-90° 再垂直翻转。
  {
    key: "left",
    left: 65,
    top: 19,
    boxW: SHEET_H,
    boxH: SHEET_W,
    transform: "rotate(-90deg) scaleY(-1)",
  },
  // 右边：-90°。
  {
    key: "right",
    left: 112,
    top: 44,
    boxW: SHEET_H,
    boxH: SHEET_W,
    transform: "rotate(-90deg)",
  },
];

export function TrainFog() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ width: FOG_W, height: FOG_H, top: FOG_TOP }}
    >
      {SHEETS.map((s) => (
        <div
          key={s.key}
          className="absolute flex items-center justify-center"
          style={{ left: s.left, top: s.top, width: s.boxW, height: s.boxH }}
        >
          {/*
            旋转的两份靠外层容器定位、内层旋转 —— 和设计稿一样，
            这样 -90° 之后雾片仍然居中落在容器里，不用自己算旋转
            后的偏移。
          */}
          <div
            className="shrink-0"
            style={{
              width: SHEET_W,
              height: SHEET_H,
              transform: s.transform,
            }}
          >
            <Image
              src={FOG_SRC}
              alt=""
              width={SHEET_W}
              height={SHEET_H}
              className="size-full select-none object-cover"
              draggable={false}
              priority
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 两道自下而上的黑色渐变。
 *
 * 第一道从 y=487 起（正好是世界动态卡片的上沿）把下半屏压暗，第二道
 * 从 y=619 起再压一次 —— 叠起来是一条越往下越黑的过渡，让卡片和底
 * 导航压在深色上，同时不需要给它们自己加实底。
 */
export function TrainVignette() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[487px] h-[325px] bg-gradient-to-b from-transparent to-black/50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[619px] h-[193px]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 37.692%, rgba(0,0,0,0.4) 70.705%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </>
  );
}
