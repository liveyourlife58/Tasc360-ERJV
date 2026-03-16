"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { setSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/** Slug: 2–100 chars, lowercase, a-z 0-9 and hyphen only, no leading/trailing hyphen. */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/;
const SLUG_MIN = 2;
const SLUG_MAX = 100;
const NAME_MAX = 255;
const PASSWORD_MIN = 8;

export type SignupState = {
  error?: string;
  redirect?: string;
  session?: { userId: string; tenantId: string; email: string; name?: string | null };
};

function normalizeSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function signup(
  _prev: SignupState | null,
  formData: FormData
): Promise<SignupState> {
  const workspaceName = (formData.get("workspaceName") as string)?.trim();
  const workspaceSlugRaw = (formData.get("workspaceSlug") as string)?.trim().toLowerCase();
  const email = (formData.get("email") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;
  const password = formData.get("password") as string;

  if (!workspaceName || workspaceName.length > NAME_MAX) {
    return { error: "Workspace name is required (max 255 characters)." };
  }
  const slug = workspaceSlugRaw ? normalizeSlug(workspaceSlugRaw) : normalizeSlug(workspaceName);
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return { error: `Workspace URL must be ${SLUG_MIN}–${SLUG_MAX} characters.` };
  }
  if (!SLUG_REGEX.test(slug)) {
    return { error: "Workspace URL can only use letters, numbers, and hyphens." };
  }
  if (!email || !email.includes("@")) {
    return { error: "A valid email is required." };
  }
  if (email.length > 255) {
    return { error: "Email is too long." };
  }
  if (!password || password.length < PASSWORD_MIN) {
    return { error: `Password must be at least ${PASSWORD_MIN} characters.` };
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: { id: true },
  });
  if (existing) {
    return { error: "This workspace URL is already taken. Choose another." };
  }

  const passwordHash = await hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: workspaceName,
        slug,
        isActive: true,
      },
    });
    const { adminRoleId: aid } = await ensureDefaultRolesWithTx(tx, tenant.id);
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: name || undefined,
        passwordHash,
        roleId: aid,
        isActive: true,
      },
    });
    return { tenantId: tenant.id, userId: user.id, userEmail: user.email, userName: user.name };
  });

  await logAuditEvent(result.tenantId, "auth_signup", { email: result.userEmail, workspaceSlug: slug }, result.userId);

  await setSession({
    userId: result.userId,
    tenantId: result.tenantId,
    email: result.userEmail,
    name: result.userName ?? undefined,
  });

  return {
    redirect: "/dashboard",
    session: {
      userId: result.userId,
      tenantId: result.tenantId,
      email: result.userEmail,
      name: result.userName ?? undefined,
    },
  };
}

/** Create default roles using the same transaction client. */
async function ensureDefaultRolesWithTx(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<{ adminRoleId: string; standardRoleId: string }> {
  const { PERMISSIONS } = await import("@/lib/permissions");
  const STANDARD_PERMISSIONS = [PERMISSIONS.entitiesRead, PERMISSIONS.entitiesWrite, PERMISSIONS.viewsManage];

  const existing = await tx.role.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const byName = Object.fromEntries(existing.map((r) => [r.name, r.id]));
  let adminRoleId = byName["admin"];
  let standardRoleId = byName["standard"];

  if (!adminRoleId) {
    const admin = await tx.role.create({
      data: {
        tenantId,
        name: "admin",
        description: "Full access including settings and user management",
        permissions: ["*"],
        isActive: true,
      },
    });
    adminRoleId = admin.id;
  }
  if (!standardRoleId) {
    const standard = await tx.role.create({
      data: {
        tenantId,
        name: "standard",
        description: "Can use modules and views; cannot manage settings or users",
        permissions: STANDARD_PERMISSIONS,
        isActive: true,
      },
    });
    standardRoleId = standard.id;
  }
  return { adminRoleId, standardRoleId };
}
