import Image from "next/image";
import logoFull from "@/public/brand/deliberatehire-logo.png";
import logoCompact from "@/public/brand/deliberatehire-logo-compact.png";
import logoLight from "@/public/brand/deliberatehire-logo-compact-light.png";
import powered from "@/public/brand/powered-by-deligence.png";

export const PRODUCT_NAME = "DeliberateHire AI";

/**
 * `full` is the complete lockup (includes "Powered by Deligence"), so don't pair it with <PoweredBy />.
 * `compact` is the single-line mark + wordmark for tight spaces like the app sidebar.
 * `light` is the compact logo in white, for dark backgrounds.
 */
export function Logo({
  className = "",
  height = 28,
  variant = "compact",
}: {
  className?: string;
  height?: number;
  variant?: "full" | "compact" | "light";
}) {
  return (
    <Image
      src={variant === "full" ? logoFull : variant === "light" ? logoLight : logoCompact}
      alt={PRODUCT_NAME}
      priority
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}

export function PoweredBy({ className = "", height = 16 }: { className?: string; height?: number }) {
  return (
    <Image
      src={powered}
      alt="Powered by Deligence Technologies"
      style={{ height, width: "auto" }}
      className={className}
    />
  );
}

const COPYRIGHT = `© ${new Date().getFullYear()} Deligence Technologies. All rights reserved.`;

export function Copyright({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-muted-foreground ${className}`}>{COPYRIGHT}</p>;
}
