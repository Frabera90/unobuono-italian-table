import logoMark from "@/assets/logo-mark.png";
import logoMarkDark from "@/assets/logo-mark-dark.png";
import logoWordmark from "@/assets/logo-wordmark.png";

type Variant = "yellow" | "dark" | "wordmark";

export function BrandMark({
  variant = "yellow",
  className = "h-9 w-9",
  alt = "Unobuono",
}: {
  variant?: Variant;
  className?: string;
  alt?: string;
}) {
  const src = variant === "dark" ? logoMarkDark : logoMark;
  return <img src={src} alt={alt} className={`${className} object-contain select-none`} draggable={false} />;
}

export function BrandWordmark({ className = "h-6" }: { className?: string }) {
  return <img src={logoWordmark} alt="Unobuono" className={`${className} object-contain select-none`} draggable={false} />;
}

export function BrandLockup({
  variant = "yellow",
  size = "md",
  subtitle,
  className = "",
}: {
  variant?: "yellow" | "dark";
  size?: "sm" | "md" | "lg";
  subtitle?: string | null;
  className?: string;
}) {
  const markSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg";
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <BrandMark variant={variant} className={`${markSize} shrink-0`} />
      <div className="min-w-0">
        <p className={`font-display uppercase leading-none tracking-tight ${titleSize}`}>UNOBUONO</p>
        {subtitle !== undefined && (
          <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.2em] opacity-50">{subtitle || "—"}</p>
        )}
      </div>
    </div>
  );
}
