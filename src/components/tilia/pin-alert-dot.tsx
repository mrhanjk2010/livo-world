import { PIN_ALERT_LABEL, type PinAlert } from "@/lib/tilia/train";

/**
 * 挂在地图 pin 上的提醒红点。
 *
 * V3.3：「把之前在固定位置通过提醒气泡的提醒都放到了地图头像或者
 * 地标上，包括：出现了新角色、发生了新的命运/回响/见闻」。所以这
 * 不是一个全局浮层，而是长在具体房间名牌 / 角色头像右上角的小红点。
 *
 * 只用一种红点、不按类型分色：地图上已经有雾、名牌白光、水滴头像三
 * 层视觉信息了，再塞进四种颜色的角标只会变成噪音。类型差异留给点开
 * 之后的房间弹窗去讲（`PIN_ALERT_LABEL`）。
 */
export function PinAlertDot({ alert }: { alert: PinAlert }) {
  return (
    <span
      title={PIN_ALERT_LABEL[alert]}
      aria-label={PIN_ALERT_LABEL[alert]}
      className="pointer-events-none absolute -right-[3px] -top-[3px] z-10 block size-[8px] rounded-full border-[0.5px] border-white/70 bg-[#ff5058]"
      style={{ boxShadow: "0 0 6px 0 rgba(255,80,88,0.9)" }}
    >
      {/* 呼吸光环：静态红点在这张暖褐色底图上太容易被忽略。 */}
      <span
        aria-hidden
        className="absolute inset-0 animate-ping rounded-full bg-[#ff5058] opacity-60"
        style={{ animationDuration: "2.4s" }}
      />
    </span>
  );
}
