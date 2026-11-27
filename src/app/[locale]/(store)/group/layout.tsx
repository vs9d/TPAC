import { Bebas_Neue, Lalezar, Reem_Kufi, Aref_Ruqaa } from "next/font/google";

// the faces a member's name can be printed in (see NAME_FONTS)
const block = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--g-block", display: "swap", preload: false });
const blockAr = Lalezar({ subsets: ["arabic", "latin"], weight: "400", variable: "--g-block-ar", display: "swap", preload: false });
const kufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["700"], variable: "--g-kufi", display: "swap", preload: false });
const script = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["700"], variable: "--g-script", display: "swap", preload: false });

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${block.variable} ${blockAr.variable} ${kufi.variable} ${script.variable}`}>{children}</div>;
}
