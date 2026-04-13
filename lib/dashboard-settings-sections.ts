/**
 * Dashboard settings modal sections: each card maps to a dashboard feature flag
 * so the settings hub can hide options when a feature is disabled for the tenant.
 */

import type { DashboardFeatureKey } from "./dashboard-features";

export type SettingsHubSectionId =
  | "customer-ai"
  | "customer-contact"
  | "customer-hero"
  | "customer-sidebar"
  | "customer-modules"
  | "customer-seo"
  | "customer-waitlist"
  | "customer-footer"
  | "customer-cookie-banner"
  | "backend-branding"
  | "backend-home"
  | "backend-modules-hub"
  | "backend-payments"
  | "backend-api"
  | "backend-customer-logins"
  | "backend-features"
  | "backend-webhooks"
  | "backend-locale"
  | "email-notifications"
  | "consent-types";

export type SettingsHubSection = {
  id: SettingsHubSectionId;
  title: string;
  desc: string;
  /** Dashboard feature that must be on for this card to show. */
  feature: DashboardFeatureKey;
  /** Hidden unless developer setup + permission (API, webhooks). */
  developerOnly?: boolean;
};

export const SETTINGS_HUB_SECTIONS: SettingsHubSection[] = [
  { id: "customer-ai", title: "Homepage Text", desc: "Site name, tagline & homepage copy", feature: "customerSite" },
  { id: "customer-contact", title: "Contact", desc: "Contact page: email, phone, address for the public site", feature: "customerSite" },
  { id: "customer-hero", title: "Homepage hero image", desc: "Optional banner image URL", feature: "customerSite" },
  { id: "customer-sidebar", title: "Homepage right column", desc: "Entity list sidebar", feature: "customerSite" },
  { id: "customer-modules", title: "Public modules", desc: "Which modules appear on the public site", feature: "customerSite" },
  { id: "customer-seo", title: "SEO", desc: "Meta title, description, social image & canonical URL", feature: "customerSite" },
  { id: "customer-waitlist", title: "Waitlist", desc: "When events are sold out, visitors can join a waitlist", feature: "customerSite" },
  { id: "customer-footer", title: "Footer", desc: "Custom footer HTML for the customer site", feature: "customerSite" },
  { id: "customer-cookie-banner", title: "Cookie banner", desc: "Show a cookie consent banner on the customer site", feature: "customerSite" },
  { id: "backend-branding", title: "Branding", desc: "Dashboard name, logo, primary color", feature: "settings" },
  { id: "backend-home", title: "Default home", desc: "Where to go after login", feature: "settings" },
  {
    id: "backend-modules-hub",
    title: "Modules & data",
    desc: "Templates, AI builder, import/export, and links to your modules",
    feature: "settings",
  },
  {
    id: "backend-payments",
    title: "Payments (Stripe)",
    desc: "Accept payments from your customers on the public site",
    feature: "customerSite",
  },
  { id: "backend-api", title: "API access", desc: "API keys for REST API", feature: "integrations", developerOnly: true },
  { id: "backend-customer-logins", title: "End-user accounts", desc: "Customer logins for your custom frontend", feature: "customerSite" },
  { id: "backend-features", title: "Feature flags", desc: "Enable or disable customer-facing features", feature: "settings" },
  { id: "backend-webhooks", title: "Webhooks", desc: "Receive entity and event notifications", feature: "integrations", developerOnly: true },
  { id: "backend-locale", title: "Locale & format", desc: "Locale, timezone, and number format for the dashboard", feature: "settings" },
  {
    id: "email-notifications",
    title: "Email notifications",
    desc: "Opt-in emails for approvals, payments, webhook failures",
    feature: "settings",
  },
  {
    id: "consent-types",
    title: "Consent types",
    desc: "GDPR-style consent type labels (e.g. marketing, essential). Manage records on Consent page.",
    feature: "consent",
  },
];

/** Visual groups on the settings hub (order preserved). */
export const SETTINGS_HUB_GROUPS: { title: string; ids: SettingsHubSectionId[] }[] = [
  {
    title: "Customer site & public",
    ids: [
      "customer-ai",
      "customer-contact",
      "customer-hero",
      "customer-sidebar",
      "customer-modules",
      "customer-seo",
      "customer-waitlist",
      "customer-footer",
      "customer-cookie-banner",
      "backend-payments",
      "backend-customer-logins",
    ],
  },
  {
    title: "Workspace",
    ids: ["backend-branding", "backend-home", "backend-modules-hub", "backend-locale", "email-notifications", "backend-features"],
  },
  {
    title: "Integrations",
    ids: ["backend-api", "backend-webhooks"],
  },
  {
    title: "Consent & compliance",
    ids: ["consent-types"],
  },
];

export function getSectionMeta(id: SettingsHubSectionId): SettingsHubSection | undefined {
  return SETTINGS_HUB_SECTIONS.find((s) => s.id === id);
}
