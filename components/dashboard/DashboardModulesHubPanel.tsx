"use client";

import Link from "next/link";
import { CreateModuleAiForm } from "@/components/dashboard/CreateModuleAiForm";
import { TemplatePicker } from "@/components/dashboard/TemplatePicker";
import { AskAiForm } from "@/components/dashboard/AskAiForm";
import { ExportDataButton } from "@/components/dashboard/ExportDataButton";
import { ImportDataForm } from "@/components/dashboard/ImportDataForm";

type ModuleStub = { id: string; name: string; slug: string };

/** Templates, AI module creation, import/export, and module links — formerly on the dashboard home. */
export function DashboardModulesHubPanel({
  tenantId,
  orderedModules,
}: {
  tenantId: string;
  orderedModules: ModuleStub[];
}) {
  if (orderedModules.length === 0) {
    return (
      <>
        <section className="onboarding-intro" aria-label="Get started">
          <h2 className="onboarding-title">What&apos;s your business?</h2>
          <p className="onboarding-description">
            Start from an industry template or describe what you need with AI.
          </p>
        </section>
        <TemplatePicker />
        <section className="create-module-ai-section">
          <h2 className="create-module-ai-title">Or describe a custom module</h2>
          <CreateModuleAiForm tenantId={tenantId} />
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-header-actions" style={{ marginBottom: "1rem" }}>
        <AskAiForm />
        <ExportDataButton />
      </div>
      <details className="import-data-details">
        <summary>Import from export JSON</summary>
        <ImportDataForm />
      </details>
      <CreateModuleAiForm tenantId={tenantId} />
      <ul className="dashboard-module-tiles" role="list">
        {orderedModules.map((m) => (
          <li key={m.id} className="dashboard-module-tile">
            <Link href={`/dashboard/m/${m.slug}`} className="dashboard-module-tile-link">
              <span className="dashboard-module-tile-label">{m.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
