import Image from "next/image";

/**
 * iPhone-ish status bar overlay (9:41 + signal/wifi/battery).
 *
 * The shipped SVG icons render white (the asset's baked fallback fill),
 * so for use over light backgrounds we apply a CSS `invert(1)` filter
 * on the icons to flip them to black, and swap the time text color
 * to match. Avoids duplicating the SVG assets per tone.
 */
export function StatusBar({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  const iconClass = isDark ? "invert" : "";

  return (
    <div
      className={`relative h-[53px] w-full shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <p
        className={`absolute left-[43px] top-[18px] w-[54px] text-center text-[17px] font-medium leading-[22px] ${
          isDark ? "text-black" : "text-white"
        }`}
      >
        9:41
      </p>
      <Image
        src="/figma/cellular.svg"
        alt=""
        width={17}
        height={11}
        className={`absolute right-[71px] top-[23px] ${iconClass}`}
      />
      <Image
        src="/figma/wifi.svg"
        alt=""
        width={16}
        height={11}
        className={`absolute right-[50px] top-[23px] ${iconClass}`}
      />
      <Image
        src="/figma/battery.svg"
        alt=""
        width={27}
        height={13}
        className={`absolute right-[16px] top-[22px] ${iconClass}`}
      />
    </div>
  );
}
