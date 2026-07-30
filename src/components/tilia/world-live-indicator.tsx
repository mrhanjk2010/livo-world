/**
 * 世界动态表头右侧的 live 指示（设计稿 `3378:8455`，52×17）。
 *
 * 视觉是淡绿轨道 + 进度段 + 绿点，但它不是开关 —— 绿点持续呼吸，
 * 表达「世界正在实时往前走」。
 *
 * 动态卡和全屏世界动态页共用一枚：设计稿里两处只差一个整体缩放
 * （卡片 52×17，全屏页 56.47×20），所以尺寸走 `scale` 而不是把那几个
 * 绝对定位的小方块按比例各算一遍。
 *
 * 给了 `onClick` 就变成按钮（动态卡上点它进全屏回响星图）；不给就还是
 * 一枚纯指示。整张动态卡本身也是可点的，所以按钮要吞掉冒泡，否则一下
 * 点开两层。
 */
export function WorldLiveIndicator({
  scale = 1,
  onClick,
  label,
}: {
  scale?: number;
  onClick?: () => void;
  /** 可点时的无障碍名，缺省沿用「实时更新中」那句。 */
  label?: string;
}) {
  const size = { width: 52 * scale, height: 17 * scale };
  const inner = (
    <span
      aria-hidden
      className="absolute left-0 top-0 h-[17px] w-[52px] origin-top-left"
      style={{ transform: `scale(${scale})` }}
    >
      <span className="absolute left-0 top-0 h-[17px] w-[48px] rounded-[100px] border-[0.5px] border-black/5 bg-[rgba(2,194,98,0.1)]" />
      <span className="absolute left-[18px] top-[7px] h-[3px] w-[22px] rounded-[10px] border border-white/20 bg-[rgba(2,194,98,0.3)]" />
      <span className="absolute left-[18px] top-[7px] h-[3px] w-[11px] rounded-[10px] bg-[#02c262]" />
      {/* 呼吸光晕 */}
      <span className="absolute left-[5px] top-[5px] size-[7px] rounded-full bg-[#02c262]/60 motion-safe:animate-[livo-live-halo_2.2s_ease-in-out_infinite]" />
      {/* 绿点本体 */}
      <span className="absolute left-[5px] top-[5px] size-[7px] rounded-full border-2 border-white/30 bg-[#02c262] motion-safe:animate-[livo-live-breathe_2.2s_ease-in-out_infinite]" />
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label ?? "世界动态实时更新中"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="relative block shrink-0 rounded-[100px] transition-[transform,filter] duration-200 hover:brightness-125 active:scale-90 active:brightness-150"
        style={size}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      aria-label="世界动态实时更新中"
      className="relative block shrink-0"
      style={size}
    >
      {inner}
    </span>
  );
}
