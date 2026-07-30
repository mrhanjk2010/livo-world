import Image from "next/image";
import type { CastMember } from "@/lib/tilia/cast";

/**
 * 角色头像。目前项目文档没有提供立绘，所以渲染风格化占位：角色主色
 * 的渐变底 + 姓氏单字 + 一圈霜白描边。`CastMember.avatarSrc` 一旦
 * 补上真图就自动切换到位图分支，展示层无需再改。
 */
export function CastAvatar({
  member,
  size = 40,
  /**
   * 描边样式。列表里用半透明白细边融进背景；摆到地图上时传入实心
   * 白粗边（`ring-2 ring-white`），才能在复杂的车厢底图上把头像从
   * 背景里"抠"出来。
   */
  ringClass = "ring-2 ring-white/25",
  className,
}: {
  member: CastMember;
  size?: number;
  ringClass?: string;
  className?: string;
}) {
  if (member.avatarSrc) {
    return (
      <span
        className={`relative shrink-0 overflow-hidden rounded-full ${ringClass} ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={member.avatarSrc}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${ringClass} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        // 从角色主色到其暗部，避免纯色块显得像未加载的占位图。
        backgroundImage: `linear-gradient(150deg, ${member.accent} 0%, ${member.accent}99 55%, rgba(0,0,0,0.55) 100%)`,
        boxShadow: `0 4px 14px -6px ${member.accent}`,
      }}
      aria-hidden
    >
      <span
        className="font-medium text-white"
        style={{
          fontSize: Math.round(size * 0.42),
          lineHeight: 1,
          textShadow: "0 1px 3px rgba(0,0,0,0.45)",
        }}
      >
        {member.initial}
      </span>
    </span>
  );
}
