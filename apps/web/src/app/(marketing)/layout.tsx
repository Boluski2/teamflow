import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <div className="marketing-page flex-1">{children}</div>
      <MarketingFooter />
    </>
  );
}