import { redirect } from "next/navigation";

/** Legacy URL: team and billing live on `/dashboard/team`. */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(p)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === "string") qs.append(key, v);
      }
    } else if (typeof val === "string") {
      qs.set(key, val);
    }
  }
  const s = qs.toString();
  redirect(s ? `/dashboard/team?${s}` : "/dashboard/team");
}
