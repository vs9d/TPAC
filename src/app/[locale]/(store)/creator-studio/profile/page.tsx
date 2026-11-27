import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator } from "@/lib/creators";
import { CreatorProfileForm } from "@/components/creators/profile-form";
import { ShareButtons } from "@/components/creators/share-buttons";

export default async function CreatorProfile({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8"><CreatorProfileForm c={me} /></div>
      <aside className="space-y-3 rounded-[1.5rem] border border-line bg-paper p-5 lg:col-span-4">
        <h2 className="font-bold">{ar ? "شارك صفحتك" : "Share your page"}</h2>
        <p className="text-sm text-mute">{ar ? "كل ما تشارك أكثر، يزورك أكثر، تبيع أكثر. حط الرابط بالبايو مالتك بإنستغرام وتيك توك." : "The more you share, the more you sell. Put the link in your Instagram and TikTok bio."}</p>
        <ShareButtons url={`/${locale}/creator/${me.username}`} text={ar ? `شوف تصاميمي على TPAC 🔥` : `See my designs on TPAC 🔥`} />
      </aside>
    </div>
  );
}
