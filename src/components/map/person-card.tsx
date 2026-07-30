import Image from "next/image";

/** Floating bottom card showing the focused person. Pixel-positioned in phone display space. */
export function PersonCard({
  avatarSrc,
  name,
  status,
  className = "",
}: {
  avatarSrc: string;
  name: string;
  status: string;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-[10px] rounded-[14px] bg-white/95 p-[10px] backdrop-blur-[6px] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div className="relative size-[40px] shrink-0 overflow-hidden rounded-[20px]">
        <Image
          src={avatarSrc}
          alt={name}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-[2px] text-black">
        <p className="text-[15px] font-medium leading-none">{name}</p>
        <p className="text-[11px] font-light leading-none text-black/70">
          {status}
        </p>
      </div>
    </div>
  );
}
