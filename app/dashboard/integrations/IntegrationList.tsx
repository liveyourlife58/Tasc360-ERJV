"use client";

const PROVIDER_LABELS: Record<string, string> = {
  qbo: "QuickBooks Online",
  xero: "Xero",
};

type IntegrationStub = {
  id: string;
  provider: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

export function IntegrationList({
  integrations,
  encryptionOk,
}: {
  integrations: IntegrationStub[];
  encryptionOk: boolean;
}) {
  if (integrations.length === 0) {
    return (
      <div className="integrations-empty card">
        <p className="integrations-empty-title">No integrations connected</p>
        <p className="integrations-empty-text">
          When connect flows are added (e.g. QuickBooks Online), you will be able to link your account from this page.
        </p>
        {encryptionOk && (
          <p className="integrations-empty-hint">
            Encryption is configured; connect buttons will appear here when available.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="integrations-list card">
      <ul className="integrations-list-ul">
        {integrations.map((int) => (
          <li key={int.id} className="integrations-list-item">
            <span className="integrations-list-provider">
              {PROVIDER_LABELS[int.provider] ?? int.provider}
            </span>
            <span className="integrations-list-meta">
              Connected {new Date(int.createdAt).toLocaleDateString()}
              {int.lastSyncedAt && (
                <> · Last synced {new Date(int.lastSyncedAt).toLocaleString()}</>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
