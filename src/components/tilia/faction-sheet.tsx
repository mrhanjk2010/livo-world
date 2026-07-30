"use client";

import { useEffect, useState } from "react";
import {
  BottomSheet,
  SectionLabel,
  SheetCloseButton,
} from "@/components/tilia/bottom-sheet";
import { CastAvatar } from "@/components/tilia/cast-avatar";
import { ResourceRow } from "@/components/tilia/resource-icon";
import { CAST_BY_CITY } from "@/lib/tilia/cast";
import { FACTIONS, stopLabel, type City } from "@/lib/tilia/world";

/**
 * 城邦势力半层弹窗（大陆视图）。
 *
 * 内容严格对应项目文档的两份表格：城邦简介与资源来自「世界地图」
 * 示意图，派系倾向／核心诉求／可采取的行动来自「XK-101 势力诉求」
 * 表。底部再挂上该城籍的角色，把势力和人物串起来。
 */
export function FactionSheet({
  city,
  onClose,
}: {
  /** null 表示无选中城邦（关闭态）。 */
  city: City | null;
  onClose: () => void;
}) {
  /**
   * 保留最后一个非空 city，让关闭动画期间内容不会先消失再滑走。
   */
  const [shown, setShown] = useState<City | null>(null);
  useEffect(() => {
    if (city) setShown(city);
  }, [city]);

  if (!shown) return null;

  const faction = FACTIONS[shown.factionId];
  const stop = stopLabel(shown);
  const cast = CAST_BY_CITY[shown.id] ?? [];

  return (
    <BottomSheet
      open={city !== null}
      onClose={onClose}
      label={`${shown.name} 势力详情`}
      accent={faction.accent}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-[8px] text-[20px] font-medium leading-[1.2] text-white">
            {shown.name}
            {shown.aka ? (
              <span className="text-[12px] font-light text-white/50">
                {shown.aka}
              </span>
            ) : null}
          </h2>
          <div className="mt-[8px] flex flex-wrap items-center gap-[6px]">
            <span
              className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11px] font-medium leading-none"
              style={{
                backgroundColor: `${faction.accent}26`,
                color: faction.accent,
                boxShadow: `inset 0 0 0 1px ${faction.accent}59`,
              }}
            >
              <span
                aria-hidden
                className="size-[6px] rounded-full"
                style={{ backgroundColor: faction.accent }}
              />
              {faction.label}
            </span>
            {stop ? (
              <span className="inline-flex items-center rounded-full bg-[#FFD79A]/15 px-[9px] py-[4px] text-[11px] leading-none text-[#FFD79A]">
                {stop}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/[0.07] px-[9px] py-[4px] text-[11px] leading-none text-white/55">
                列车不停靠
              </span>
            )}
          </div>
        </div>

        <SheetCloseButton onClose={onClose} />
      </div>

      <p className="mt-[14px] text-[13px] leading-[1.65] text-white/80">
        {shown.blurb}
      </p>

      {shown.resources.length > 0 ? (
        <div className="mt-[14px]">
          <SectionLabel>城邦资源</SectionLabel>
          <ResourceRow resources={shown.resources} className="mt-[8px]" />
        </div>
      ) : null}

      <div className="mt-[18px] space-y-[12px]">
        <DetailBlock
          accent={faction.accent}
          label="对 XK-101 的核心诉求"
          body={faction.demand}
        />
        <DetailBlock
          accent={faction.accent}
          label="在列车上／针对女主可采取的行动"
          body={faction.actions}
        />
      </div>

      {cast.length > 0 ? (
        <div className="mt-[18px]">
          <SectionLabel>这座城的人</SectionLabel>
          <ul className="mt-[10px] flex flex-col gap-[10px]">
            {cast.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-[10px] rounded-[12px] bg-white/[0.05] px-[10px] py-[9px]"
              >
                <CastAvatar member={m} size={36} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-[6px]">
                    <span className="text-[13px] font-medium text-white">
                      {m.name}
                    </span>
                    <span className="text-[11px] text-white/45">
                      {m.position} · {m.age}
                    </span>
                  </div>
                  <p className="mt-[2px] truncate text-[11px] leading-[1.4] text-white/60">
                    {m.headline}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function DetailBlock({
  accent,
  label,
  body,
}: {
  accent: string;
  label: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[12px] bg-white/[0.04] px-[12px] py-[11px]"
      style={{ boxShadow: `inset 2px 0 0 ${accent}` }}
    >
      <div className="text-[11px] font-medium text-white/45">{label}</div>
      <p className="mt-[5px] text-[12.5px] leading-[1.65] text-white/85">
        {body}
      </p>
    </div>
  );
}
