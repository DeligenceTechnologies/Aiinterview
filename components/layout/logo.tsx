import Image from "next/image";
import logo from "@/public/brand/hirelens-logo.png";
import powered from "@/public/brand/powered-by-deligence.png";

export const PRODUCT_NAME = "HireLens";

export function Logo({ className = "", height = 28 }: { className?: string; height?: number }) {
  return (
    <Image
      src={logo}
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
