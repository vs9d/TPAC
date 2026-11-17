import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-x flex min-h-[70dvh] flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="display text-[22vw] leading-none md:text-[12rem]">404</p>
      <p className="text-lg text-mute">الصفحة غير موجودة — Page not found</p>
      <Link href="/" className="btn btn-primary">TPAC</Link>
    </main>
  );
}
