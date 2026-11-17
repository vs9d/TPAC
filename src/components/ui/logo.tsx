import Image from "next/image";
import Link from "next/link";

export function Logo({ href, variant = "black", className = "h-7 w-auto" }: { href: string; variant?: "black" | "white" | "orange"; className?: string }) {
  return (
    <Link href={href} aria-label="TPAC" className="inline-flex shrink-0 items-center">
      <Image src={`/brand/tpac-logo-${variant}.png`} alt="TPAC" width={1512} height={806} priority className={className} />
    </Link>
  );
}
