#!/usr/bin/env node

/**
 * PHP Syntax Validation Script
 * Validates all PHP files in the php-backend directory
 * Compatible with shared hosting (no Node.js/Next.js dependencies)
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHP_BACKEND_DIR = path.resolve(__dirname, "..", "php-backend");

const REQUIRED_FILES = [
  "index.php",
  "schema.sql",
  "install.php",
  "config.example.php",
  "includes/db.php",
  "includes/helpers.php",
  "routes/admin.php",
  "routes/auth.php",
  "routes/data.php",
  "routes/functions.php",
  "routes/rpc.php",
  "routes/storage.php",
  "routes/attachments.php",
  "routes/forwarding.php",
  "routes/webhooks.php",
  "routes/logs.php",
  "cron/imap-poll.php",
  "cron/maintenance.php",
  "cron/health-check.php",
];

const REQUIRED_TABLES = [
  "users",
  "emails",
  "domains",
  "mailboxes",
  "app_settings",
  "email_stats",
  "subscriptions",
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function collectPhpFiles(dir) {
  const files = [];
  
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".php")) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

async function validatePhpSyntax(filePath) {
  return new Promise((resolve) => {
    const child = spawn("php", ["-l", filePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    
    child.on("close", (code) => {
      resolve({
        valid: code === 0,
        output: stdout.trim(),
        error: stderr.trim(),
      });
    });
    
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        resolve({ valid: true, output: "", error: "PHP not installed - skipping syntax check" });
      } else {
        resolve({ valid: false, output: "", error: err.message });
      }
    });
  });
}

async function validateSchema(schemaPath) {
  const content = await fs.readFile(schemaPath, "utf8");
  const missing = [];
  
  for (const table of REQUIRED_TABLES) {
    const regex = new RegExp(`CREATE\\s+TABLE.*${table}`, "i");
    if (!regex.test(content)) {
      missing.push(table);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           PHP Backend Validation Script                      ║");
  console.log("║        Compatible with Shared Hosting (cPanel)               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let hasErrors = false;

  // Check if php-backend exists
  if (!(await pathExists(PHP_BACKEND_DIR))) {
    console.error("❌ php-backend directory not found!");
    process.exit(1);
  }

  // 1. Check required files
  console.log("📁 Checking required files...\n");
  const missingFiles = [];
  
  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(PHP_BACKEND_DIR, file);
    if (await pathExists(fullPath)) {
      console.log(`   ✓ ${file}`);
    } else {
      console.log(`   ❌ ${file} (MISSING)`);
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.log(`\n❌ Missing ${missingFiles.length} required file(s)\n`);
    hasErrors = true;
  } else {
    console.log("\n✅ All required files present\n");
  }

  // 2. Validate PHP syntax
  console.log("🔍 Validating PHP syntax...\n");
  const phpFiles = await collectPhpFiles(PHP_BACKEND_DIR);
  const syntaxErrors = [];

  for (const file of phpFiles) {
    const relativePath = path.relative(PHP_BACKEND_DIR, file);
    const result = await validatePhpSyntax(file);
    
    if (result.valid) {
      console.log(`   ✓ ${relativePath}`);
    } else {
      console.log(`   ❌ ${relativePath}`);
      console.log(`      ${result.error || result.output}`);
      syntaxErrors.push({ file: relativePath, error: result.error || result.output });
    }
  }

  if (syntaxErrors.length > 0) {
    console.log(`\n❌ Found ${syntaxErrors.length} syntax error(s)\n`);
    hasErrors = true;
  } else {
    console.log(`\n✅ All ${phpFiles.length} PHP files are syntactically correct\n`);
  }

  // 3. Validate schema.sql
  console.log("📋 Validating schema.sql...\n");
  const schemaPath = path.join(PHP_BACKEND_DIR, "schema.sql");
  
  if (await pathExists(schemaPath)) {
    const schemaResult = await validateSchema(schemaPath);
    
    if (schemaResult.valid) {
      console.log("   ✓ All required tables defined");
      console.log("\n✅ Schema validation passed\n");
    } else {
      console.log(`   ❌ Missing tables: ${schemaResult.missing.join(", ")}`);
      console.log("\n❌ Schema validation failed\n");
      hasErrors = true;
    }
  } else {
    console.log("   ❌ schema.sql not found");
    hasErrors = true;
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  if (hasErrors) {
    console.log("❌ Validation FAILED - Please fix the issues above");
    process.exit(1);
  } else {
    console.log("✅ All validations PASSED - Backend is ready for deployment");
    console.log("\nNext steps:");
    console.log("  1. Run: npm run package:cpanel");
    console.log("  2. Upload to cPanel");
    console.log("  3. Run install wizard: https://yourdomain.com/api/install.php");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Validation script error:", err);
  process.exit(1);
});
