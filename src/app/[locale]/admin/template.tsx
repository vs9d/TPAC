import { PageFade } from "@/components/ui/page-fade";

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageFade>{children}</PageFade>;
}
