import { useUIStore } from "@/store/uiStore";

const ORANGE = "#fe6a34";
const NAVY   = "#041627";

function resolveTrakColor(variant, theme) {
  if (variant === "dark")  return "white";
  if (variant === "light") return NAVY;
  return theme === "dark" ? "white" : NAVY; // "auto" — follows current theme
}

export function LogoIcon({ size = 52 }) {
  const pad = Math.round(size * 0.1);
  return (
    <div
      style={{
        width: size,
        height: size,
        padding: pad,
        borderRadius: Math.round(size * 0.22),
        background: "linear-gradient(135deg, #041627 0%, #0d2d4a 100%)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img src="/favicon.svg" width={size - pad * 2} height={size - pad * 2} alt="trakvora" style={{ display: "block" }} />
    </div>
  );
}

export function LogoFull({ iconSize = 44, variant = "auto", className = "", tagline }) {
  const theme = useUIStore((s) => s.theme);
  const trakColor = resolveTrakColor(variant, theme);
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <div className="flex flex-col leading-none" style={{ maxWidth: iconSize * 5 }}>
        <span
          className="font-heading font-black tracking-tight select-none whitespace-nowrap"
          style={{ fontSize: iconSize * 0.68 }}
        >
          <span style={{ color: trakColor }}>TRAK</span>
          <span style={{ color: ORANGE }}>VORA</span>
        </span>
        {tagline && (
          <span
            className="font-heading font-semibold uppercase tracking-widest select-none mt-0.5"
            style={{ fontSize: iconSize * 0.3, color: ORANGE, opacity: 0.85, lineHeight: 1.3 }}
          >
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}

export function LogoWordmark({ size = "2xl", variant = "auto" }) {
  const theme = useUIStore((s) => s.theme);
  const trakColor = resolveTrakColor(variant, theme);
  const sizeMap = { lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" };
  return (
    <span className={`font-heading font-black tracking-tight ${sizeMap[size] ?? "text-2xl"}`}>
      <span style={{ color: trakColor }}>TRAK</span>
      <span style={{ color: ORANGE }}>VORA</span>
    </span>
  );
}
