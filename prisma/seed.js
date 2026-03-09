"use strict";

const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_WORKSPACE = "demo";
const DEFAULT_EMAIL = "admin@demo.com";
const DEFAULT_PASSWORD = "demo123"; // change after first login
const DEFAULT_NAME = "Demo Workspace";

async function main() {
  const passwordHash = await hash(DEFAULT_PASSWORD, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_WORKSPACE },
    update: {},
    create: {
      name: DEFAULT_NAME,
      slug: DEFAULT_WORKSPACE,
      isActive: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "admin" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "admin",
      description: "Full access including settings and user management",
      permissions: ["*"],
      isActive: true,
    },
  });

  await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: "standard" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "standard",
      description: "Can use modules and views; cannot manage settings or users",
      permissions: ["entities:read", "entities:write", "views:manage"],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: DEFAULT_EMAIL },
    },
    update: { passwordHash, roleId: adminRole.id },
    create: {
      tenantId: tenant.id,
      email: DEFAULT_EMAIL,
      name: "Admin",
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log("Seed done.");
  console.log("  Workspace (slug):", DEFAULT_WORKSPACE);
  console.log("  Email:", DEFAULT_EMAIL);
  console.log("  Password:", DEFAULT_PASSWORD);
  console.log("  → Log in at /login with the above.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
