/**
 * Vertical / industry templates: pre-defined modules + fields + optional default views.
 * applyTemplate(tenantId, templateKey) creates modules and fields; no new schema.
 */

export type TemplateField = {
  name: string;
  slug: string;
  fieldType:
    | "text"
    | "number"
    | "date"
    | "boolean"
    | "select"
    | "tenant-user"
    | "relation"
    | "relation-multi"
    | "file"
    | "json"
    | "activity";
  isRequired?: boolean;
  settings?: { options?: string[]; targetModuleSlug?: string };
};

export type TemplateModule = {
  name: string;
  slug: string;
  description?: string;
  fields: TemplateField[];
  /** Optional: default view type and settings (e.g. board by status, calendar by date). */
  defaultView?: { viewType: "list" | "board" | "calendar"; boardColumnField?: string; dateField?: string };
};

export type Template = {
  id: string;
  name: string;
  description: string;
  modules: TemplateModule[];
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const TEMPLATES: Template[] = [
  {
    id: "nonprofit",
    name: "Nonprofit",
    description: "Donors, donations, campaigns, designations, and fund accounting.",
    modules: [
      {
        name: "Constituents",
        slug: "constituents",
        description: "Donors, volunteers, members",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Email", slug: "email", fieldType: "text" },
          { name: "Phone", slug: "phone", fieldType: "text" },
          { name: "Type", slug: "type", fieldType: "select", settings: { options: ["Donor", "Volunteer", "Member", "Board"] } },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
      },
      {
        name: "Donations",
        slug: "donations",
        description: "Gift records",
        fields: [
          { name: "Amount (cents)", slug: "amount_cents", fieldType: "number" },
          { name: "Date", slug: "date", fieldType: "date" },
          { name: "Donor", slug: "donor", fieldType: "relation", settings: { targetModuleSlug: "constituents" } },
          { name: "Campaign", slug: "campaign", fieldType: "relation", settings: { targetModuleSlug: "campaigns" } },
          { name: "Designation", slug: "designation", fieldType: "text" },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
      },
      {
        name: "Campaigns",
        slug: "campaigns",
        description: "Appeals and campaigns",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Goal (cents)", slug: "goal_cents", fieldType: "number" },
          { name: "Start Date", slug: "start_date", fieldType: "date" },
          { name: "End Date", slug: "end_date", fieldType: "date" },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Draft", "Active", "Closed"] } },
        ],
        defaultView: { viewType: "board", boardColumnField: "status" },
      },
    ],
  },
  {
    id: "field_service",
    name: "Field Service",
    description: "Customers, jobs, work orders, and scheduling.",
    modules: [
      {
        name: "Customers",
        slug: "customers",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Email", slug: "email", fieldType: "text" },
          { name: "Phone", slug: "phone", fieldType: "text" },
          { name: "Address", slug: "address", fieldType: "text" },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
      },
      {
        name: "Jobs",
        slug: "jobs",
        description: "Service jobs",
        fields: [
          { name: "Title", slug: "title", fieldType: "text", isRequired: true },
          { name: "Customer", slug: "customer", fieldType: "relation", settings: { targetModuleSlug: "customers" } },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Scheduled", "In Progress", "Done", "Canceled"] } },
          { name: "Scheduled Date", slug: "scheduled_date", fieldType: "date" },
          { name: "Completed Date", slug: "completed_date", fieldType: "date" },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
        defaultView: { viewType: "board", boardColumnField: "status" },
      },
      {
        name: "Work Orders",
        slug: "work_orders",
        fields: [
          { name: "Title", slug: "title", fieldType: "text", isRequired: true },
          { name: "Job", slug: "job", fieldType: "relation", settings: { targetModuleSlug: "jobs" } },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Pending", "In Progress", "Done"] } },
          { name: "Due Date", slug: "due_date", fieldType: "date" },
        ],
      },
    ],
  },
  {
    id: "events",
    name: "Events & Ticketing",
    description: "Events, tickets, and check-in.",
    modules: [
      {
        name: "Events",
        slug: "events",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Date", slug: "event_date", fieldType: "date" },
          { name: "Location", slug: "location", fieldType: "text" },
          { name: "Description", slug: "description", fieldType: "text" },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Draft", "Published", "Past"] } },
        ],
        defaultView: { viewType: "calendar", dateField: "event_date" },
      },
    ],
  },
  {
    id: "professional_services",
    name: "Professional Services",
    description: "Clients, projects, and invoices.",
    modules: [
      {
        name: "Clients",
        slug: "clients",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Email", slug: "email", fieldType: "text" },
          { name: "Phone", slug: "phone", fieldType: "text" },
          { name: "Company", slug: "company", fieldType: "text" },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
      },
      {
        name: "Projects",
        slug: "projects",
        fields: [
          { name: "Name", slug: "name", fieldType: "text", isRequired: true },
          { name: "Client", slug: "client", fieldType: "relation", settings: { targetModuleSlug: "clients" } },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Proposal", "Active", "On Hold", "Completed"] } },
          { name: "Start Date", slug: "start_date", fieldType: "date" },
          { name: "Due Date", slug: "due_date", fieldType: "date" },
          { name: "Notes", slug: "notes", fieldType: "text" },
        ],
        defaultView: { viewType: "board", boardColumnField: "status" },
      },
      {
        name: "Invoices",
        slug: "invoices",
        fields: [
          { name: "Number", slug: "number", fieldType: "text" },
          { name: "Client", slug: "client", fieldType: "relation", settings: { targetModuleSlug: "clients" } },
          { name: "Project", slug: "project", fieldType: "relation", settings: { targetModuleSlug: "projects" } },
          { name: "Amount (cents)", slug: "amount_cents", fieldType: "number" },
          { name: "Due Date", slug: "due_date", fieldType: "date" },
          { name: "Status", slug: "status", fieldType: "select", settings: { options: ["Draft", "Sent", "Paid", "Overdue"] } },
        ],
      },
    ],
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
