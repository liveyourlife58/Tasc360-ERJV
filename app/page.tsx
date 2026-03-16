import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTenantByCustomDomain } from "@/lib/tenant";
import { MarketingPage } from "./MarketingPage";

export const metadata: Metadata = {
  title: "Tasc360 — Simple Custom Database Workspace | Minimal Setup for Non-Technical Teams",
  description:
    "A quick, simple database workspace for non-technical users. Get a custom workspace with minimal setup. Setup support included; developer support available for complex customization.",
  keywords: [
    "simple database workspace",
    "custom database",
    "minimal setup",
    "non-technical",
    "workspace for small business",
    "custom workspace",
    "database without coding",
  ],
  openGraph: {
    title: "Tasc360 — Simple Custom Database Workspace | Minimal Setup",
    description:
      "A quick, simple database workspace for non-technical users. Custom workspace, minimal setup. Setup support and developer support available.",
    type: "website",
  },
};

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? undefined;
  const tenant = await getTenantByCustomDomain(host ?? null);
  if (tenant) {
    redirect(`/s/${tenant.slug}`);
  }
  return <MarketingPage />;
}
