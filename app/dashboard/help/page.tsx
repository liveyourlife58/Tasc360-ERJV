import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readFileSync } from "fs";
import { join } from "path";
import { UserGuideContent } from "@/components/dashboard/UserGuideContent";

export default async function DashboardHelpPage() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  let content: string;
  try {
    const path = join(process.cwd(), "docs", "USER_GUIDE.md");
    content = readFileSync(path, "utf-8");
  } catch {
    content = "# Help\n\nDocumentation is not available at the moment.";
  }

  return (
    <div className="dashboard-help-page">
      <div className="page-header">
        <h1>Help</h1>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1.5rem" }}>
        How to use the dashboard and your public site. Use the table of contents below to jump to a section.
      </p>
      <UserGuideContent content={content} />
    </div>
  );
}
