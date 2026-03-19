#!/usr/bin/env node

/**
 * Securely create an admin user directly in the database.
 *
 * Usage:
 *   node scripts/create-admin.mjs --email admin@example.com
 *   node scripts/create-admin.mjs --email admin@example.com --password 'MyStr0ngP@ss'
 *   node scripts/create-admin.mjs --email admin@example.com --name '管理员'
 *
 * If --password is omitted, a random 24-character password is generated.
 * The script connects directly to PostgreSQL via DATABASE_URL, no web server needed.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { parseArgs } from "util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    phone: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "Admin" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help || (!values.email && !values.phone)) {
  console.log(`
Usage: node scripts/create-admin.mjs --email <email> [--password <pwd>] [--name <name>]
       node scripts/create-admin.mjs --phone <phone> [--password <pwd>] [--name <name>]

Options:
  --email       Admin email address
  --phone       Admin phone number (alternative to email)
  --password    Password (auto-generated if omitted)
  --name        Display name (default: "Admin")
  -h, --help    Show this help
  `);
  process.exit(0);
}

const db = new PrismaClient();

async function main() {
  const identifier = values.email ?? values.phone;
  const identifierType = values.email ? "email" : "phone";

  const existing = await db.user.findFirst({
    where: values.email ? { email: values.email } : { phone: values.phone },
  });

  if (existing) {
    console.log(`User with ${identifierType} "${identifier}" already exists (id: ${existing.id}).`);
    console.log("Granting admin role to existing user...");

    const role = await db.role.upsert({
      where: { name: "admin" },
      create: { name: "admin" },
      update: {},
    });

    await db.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: role.id } },
      create: { userId: existing.id, roleId: role.id },
      update: {},
    });

    console.log(`Done. User ${existing.id} now has admin role.`);
    return;
  }

  const rawPassword = values.password ?? randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const user = await db.user.create({
    data: {
      email: values.email ?? undefined,
      phone: values.phone ?? undefined,
      emailVerifiedAt: values.email ? new Date() : undefined,
      phoneVerifiedAt: values.phone ? new Date() : undefined,
      password: passwordHash,
      name: values.name,
      status: "active",
    },
  });

  const adminRole = await db.role.upsert({
    where: { name: "admin" },
    create: { name: "admin" },
    update: {},
  });
  await db.userRole.create({
    data: { userId: user.id, roleId: adminRole.id },
  });

  const studentRole = await db.role.upsert({
    where: { name: "student" },
    create: { name: "student" },
    update: {},
  });
  await db.userRole.create({
    data: { userId: user.id, roleId: studentRole.id },
  });

  console.log("");
  console.log("========================================");
  console.log("  Admin account created successfully");
  console.log("========================================");
  console.log(`  ID:       ${user.id}`);
  console.log(`  ${identifierType === "email" ? "Email" : "Phone"}:    ${identifier}`);
  console.log(`  Name:     ${values.name}`);
  console.log(`  Password: ${rawPassword}`);
  console.log("========================================");
  console.log("");
  console.log("IMPORTANT: Save the password now. It cannot be retrieved later.");
  console.log("Change it after first login at /profile.");
  console.log("");

  if (!values.password) {
    console.log("(Password was auto-generated because --password was not provided)");
  }
}

main()
  .catch((err) => {
    console.error("Failed to create admin:", err.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
