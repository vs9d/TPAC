import Image from "next/image";
import Link from "next/link";

/** Black logo on light theme, white on dark (both rendered, CSS picks one — no flash). */
export function Logo({ href, className = "h-8 w-auto", priority = false }: { href?: string; className?: string; priority?: boolean }) {
  const img = (
    <>
      <Image src="/brand/tpac-logo-black.png" alt="TPAC" width={1512} height={806} priority={priority} className={`${className} dark:hidden`} />
      <Image src="/brand/tpac-logo-white.png" alt="" aria-hidden width={1512} height={806} priority={priority} className={`${className} hidden dark:block`} />
    </>
  );
  return href ? (
    <Link href={href} aria-label="TPAC" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  ) : (
    img
  );
}
