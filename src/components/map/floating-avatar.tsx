import Image from "next/image";

export function FloatingAvatar({
  xPct,
  yPct,
  src,
  alt,
  showArrow = true,
}: {
  /** Horizontal center of the avatar as fraction of map width (0..1). */
  xPct: number;
  /** Top of the avatar as fraction of map height (0..1). */
  yPct: number;
  src: string;
  alt: string;
  showArrow?: boolean;
}) {
  return (
    <div
      className="absolute -translate-x-1/2"
      style={{
        left: `${xPct * 100}%`,
        top: `${yPct * 100}%`,
        width: 40,
        height: 53,
      }}
    >
      <div className="relative size-[40px] overflow-hidden rounded-[20px] border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
        <Image src={src} alt={alt} fill sizes="40px" className="object-cover" />
      </div>
      {showArrow && (
        <Image
          src="/figma/map/speech-arrow.svg"
          alt=""
          width={12}
          height={8}
          className="absolute left-1/2 top-[45px] -translate-x-1/2"
        />
      )}
    </div>
  );
}

export function SpeechChip({
  xPct,
  yPct,
  text,
}: {
  /** Horizontal center of the chip as fraction of map width (0..1). */
  xPct: number;
  /** Top of the chip as fraction of map height (0..1). */
  yPct: number;
  text: string;
}) {
  return (
    <div
      className="absolute inline-flex -translate-x-1/2 items-center justify-center rounded-[16px] bg-black/45 px-[8px] py-[2px] backdrop-blur-[4px]"
      style={{ left: `${xPct * 100}%`, top: `${yPct * 100}%` }}
    >
      <span className="whitespace-nowrap text-[10px] font-light text-white">
        {text}
      </span>
    </div>
  );
}
