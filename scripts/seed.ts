/**
 * Seed Script — creates Supabase Auth users and DB records for every student.
 * Usage: npm run seed
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing environment variables in .env.local");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
}

function generatePassword(firstName: string): string {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const clean = firstName.replace(/[^a-zA-Z]/g, "");
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1).toLowerCase()}@${suffix}`;
}

type CredentialRow = {
  name: string;
  username: string;
  password: string;
  loginEmail: string;
};

async function main() {
  // Load student list
  const { STUDENTS } = require("../src/config/students") as { STUDENTS: string[] };

  if (!STUDENTS || STUDENTS.length === 0) {
    console.error("❌  No students found in src/config/students.ts");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🎓  Farewell Voting — Seed Script`);
  console.log(`   Processing ${STUDENTS.length} students…\n`);

  const credentials: CredentialRow[] = [];
  const errors: string[] = [];

  for (const studentName of STUDENTS) {
    const slug = toSlug(studentName);
    const username = slug;
    const firstName = studentName.trim().split(/\s+/)[0];
    const password = generatePassword(firstName);
    const loginEmail = `${username}@farewell.local`;

    try {
      // 1. Upsert student record
      const { data: student, error: studentErr } = await supabase
        .from("students")
        .upsert({ full_name: studentName, slug }, { onConflict: "slug" })
        .select("id")
        .single();

      if (studentErr) {
        console.error(`  ✗ Student DB error [${studentName}]: ${studentErr.message}`);
        errors.push(studentName);
        continue;
      }

      // 2. Create (or find existing) auth user
      const { data: authData, error: authErr } =
        await supabase.auth.admin.createUser({
          email: loginEmail,
          password,
          email_confirm: true,
          user_metadata: { username, display_name: studentName },
        });

      let authUserId: string | undefined;

      if (authErr) {
        if (authErr.message.toLowerCase().includes("already been registered")) {
          const { data: existingList } = await supabase.auth.admin.listUsers();
          const existing = existingList?.users.find((u) => u.email === loginEmail);
          authUserId = existing?.id;
          console.log(`  ↻ Already exists: ${studentName}`);
        } else {
          console.error(`  ✗ Auth error [${studentName}]: ${authErr.message}`);
          errors.push(studentName);
          continue;
        }
      } else {
        authUserId = authData.user?.id;
      }

      if (!authUserId) {
        console.error(`  ✗ Could not resolve auth user ID for ${studentName}`);
        errors.push(studentName);
        continue;
      }

      // 3. Upsert profile
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          auth_user_id: authUserId,
          student_id: student.id,
          username,
          display_name: studentName,
        },
        { onConflict: "auth_user_id" }
      );

      if (profileErr) {
        console.error(`  ✗ Profile error [${studentName}]: ${profileErr.message}`);
        errors.push(studentName);
        continue;
      }

      credentials.push({ name: studentName, username, password, loginEmail });
      console.log(
        `  ✓ ${studentName.padEnd(28)} ${username.padEnd(24)} ${password}`
      );
    } catch (err) {
      console.error(`  ✗ Unexpected error [${studentName}]:`, err);
      errors.push(studentName);
    }
  }

  // Write CSV
  const csvLines = [
    "Student Name,Username,Password,Login Email",
    ...credentials.map(
      (c) => `"${c.name}","${c.username}","${c.password}","${c.loginEmail}"`
    ),
  ];

  const csvPath = join(process.cwd(), "generated-credentials.csv");
  writeFileSync(csvPath, csvLines.join("\n"), "utf-8");

  console.log(`\n─────────────────────────────────────────────────`);
  console.log(`✅  Done!  ${credentials.length} student(s) created.`);
  if (errors.length > 0) {
    console.log(`⚠️  Errors for: ${errors.join(", ")}`);
  }
  console.log(`\n📄  Credentials saved to: generated-credentials.csv`);
  console.log(`🔒  Keep that file private — do NOT commit it to git!`);
  console.log(`─────────────────────────────────────────────────\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
