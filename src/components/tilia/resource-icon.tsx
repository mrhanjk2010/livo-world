import { RESOURCE_LABEL, type ResourceKey } from "@/lib/tilia/world";

/**
 * 示意图图例里的五类资源徽标。用内联 SVG 而不是切图，因为这些图标
 * 需要在深色地图与浅色势力卡两种底色上换色（`currentColor`），且
 * 尺寸从 10px 到 14px 都要保持清晰。
 */
export function ResourceIcon({
  kind,
  className,
}: {
  kind: ResourceKey;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 16 16",
    className,
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "military":
      // 盾牌 —— 军事
      return (
        <svg {...common} fill="currentColor">
          <path d="M8 1.2 2.9 3v4.7c0 3.1 2.1 5.9 5.1 7.1 3-1.2 5.1-4 5.1-7.1V3L8 1.2Z" />
        </svg>
      );
    case "economy":
      // 铜钱 —— 经济
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.6v6.8M5.8 6.4h4.4M5.8 9.6h4.4" strokeLinecap="round" />
        </svg>
      );
    case "culture":
      // 摊开的书 —— 文化
      return (
        <svg {...common} fill="currentColor">
          <path d="M7.3 3.5C6.2 2.7 4.8 2.3 3 2.3a.9.9 0 0 0-.9.9v8.1c0 .5.4.9.9.9 1.6 0 2.8.3 3.7 1 .2.1.4.1.6 0V3.5Zm1.4 0v9.7c.2.1.4.1.6 0 .9-.7 2.1-1 3.7-1 .5 0 .9-.4.9-.9V3.2a.9.9 0 0 0-.9-.9c-1.8 0-3.2.4-4.3 1.2Z" />
        </svg>
      );
    case "mineral":
      // 油滴 —— 矿藏/石油
      return (
        <svg {...common} fill="currentColor">
          <path d="M8 1.4S3.4 6.6 3.4 9.6a4.6 4.6 0 0 0 9.2 0C12.6 6.6 8 1.4 8 1.4Z" />
        </svg>
      );
    case "nature":
      // 水滴叶片 —— 天然资源
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path
            d="M8 14V7.4M8 7.4C8 4.6 10 2.4 13 2c.4 2.9-1.6 5.4-5 5.4ZM8 9.5C8 7.6 6.4 6 4 5.7c-.3 2.2 1.5 3.8 4 3.8Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/**
 * 资源徽标 + 文字的横排 chip 组。地图节点上只显示图标（`compact`），
 * 势力卡里则带文字说明。
 */
export function ResourceRow({
  resources,
  compact = false,
  className,
}: {
  resources: readonly ResourceKey[];
  compact?: boolean;
  className?: string;
}) {
  if (resources.length === 0) return null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-[3px] ${className ?? ""}`}>
        {resources.map((r) => (
          <ResourceIcon key={r} kind={r} className="size-[9px]" />
        ))}
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap gap-[6px] ${className ?? ""}`}>
      {resources.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-[4px] rounded-[6px] bg-white/[0.08] px-[8px] py-[4px] text-[11px] leading-none text-white/85"
        >
          <ResourceIcon kind={r} className="size-[11px]" />
          {RESOURCE_LABEL[r]}
        </span>
      ))}
    </div>
  );
}
