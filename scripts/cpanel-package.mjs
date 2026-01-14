import { spawn } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const OUT_DIR = path.resolve(ROOT, getArg("--out") ?? "cpanel-package");
const SKIP_BUILD = args.includes("--skip-build");
const CREATE_ZIP = args.includes("--zip");
const CREATE_TAR = args.includes("--tar") || CREATE_ZIP; // --zip now creates both
const API_URL = getArg("--api-url");
const VERBOSE = args.includes("--verbose") || args.includes("-v");

const DIST_DIR = path.join(ROOT, "dist");
const PHP_BACKEND_DIR = path.join(ROOT, "php-backend");

// Console helpers
const log = (msg) => console.log(msg);
const logVerbose = (msg) => VERBOSE && console.log(`  ${msg}`);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function mkdirp(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyDir(src, dst, { filter } = {}) {
  await mkdirp(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (filter && !filter(srcPath, entry)) continue;

    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath, { filter });
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, dstPath);
    }
  }
}

function run(cmd, cmdArgs, { env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${cmdArgs.join(" ")} exited with code ${code}`));
    });
  });
}

// Simple TAR implementation (POSIX ustar format)
async function createTarGz(sourceDir, outputPath) {
  const tarPath = outputPath.replace(/\.gz$/, "");
  const files = [];

  async function collectFiles(dir, prefix = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        files.push({ path: relativePath + "/", isDir: true, fullPath });
        await collectFiles(fullPath, relativePath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        files.push({ path: relativePath, isDir: false, fullPath, size: stat.size, mode: stat.mode });
      }
    }
  }

  await collectFiles(sourceDir);

  // Write TAR file
  const tarHandle = await fs.open(tarPath, "w");
  const BLOCK_SIZE = 512;

  function octal(num, len) {
    return num.toString(8).padStart(len - 1, "0") + "\0";
  }

  function createHeader(filePath, size, mode, isDir) {
    const header = Buffer.alloc(BLOCK_SIZE, 0);
    const name = filePath.slice(0, 100);

    header.write(name, 0, 100);
    header.write(octal(isDir ? 0o755 : (mode & 0o777) || 0o644, 8), 100, 8);
    header.write(octal(0, 8), 108, 8); // uid
    header.write(octal(0, 8), 116, 8); // gid
    header.write(octal(size, 12), 124, 12);
    header.write(octal(Math.floor(Date.now() / 1000), 12), 136, 12);
    header.write("        ", 148, 8); // checksum placeholder
    header.write(isDir ? "5" : "0", 156, 1); // typeflag
    header.write("ustar\0", 257, 6);
    header.write("00", 263, 2);

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      checksum += header[i];
    }
    header.write(octal(checksum, 7) + " ", 148, 8);

    return header;
  }

  for (const file of files) {
    const header = createHeader(file.path, file.isDir ? 0 : file.size, file.mode || 0o644, file.isDir);
    await tarHandle.write(header);

    if (!file.isDir && file.size > 0) {
      const content = await fs.readFile(file.fullPath);
      await tarHandle.write(content);

      // Pad to 512-byte boundary
      const remainder = file.size % BLOCK_SIZE;
      if (remainder > 0) {
        await tarHandle.write(Buffer.alloc(BLOCK_SIZE - remainder, 0));
      }
    }
  }

  // Write two empty blocks to end TAR
  await tarHandle.write(Buffer.alloc(BLOCK_SIZE * 2, 0));
  await tarHandle.close();

  // Gzip the TAR file
  const tarData = await fs.readFile(tarPath);
  const gzStream = createGzip({ level: 9 });
  const outStream = createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    gzStream.on("error", reject);
    outStream.on("error", reject);
    outStream.on("finish", resolve);
    gzStream.pipe(outStream);
    gzStream.end(tarData);
  });

  await fs.unlink(tarPath);
  return outputPath;
}

// PHP syntax validation
async function lintPhpFiles(dir) {
  const errors = [];
  
  async function checkFile(filePath) {
    return new Promise((resolve) => {
      const child = spawn("php", ["-l", filePath], {
        stdio: ["pipe", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      
      let stderr = "";
      child.stderr.on("data", (data) => { stderr += data.toString(); });
      
      child.on("close", (code) => {
        if (code !== 0) {
          errors.push({ file: filePath, error: stderr.trim() || `Exit code ${code}` });
        }
        resolve();
      });
      
      child.on("error", () => {
        // PHP not available - skip lint
        resolve();
      });
    });
  }
  
  async function walkDir(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".php")) {
        await checkFile(fullPath);
      }
    }
  }
  
  await walkDir(dir);
  return errors;
}

// Validate schema.sql syntax
async function validateSchema(schemaPath) {
  if (!(await pathExists(schemaPath))) {
    return { valid: false, error: "schema.sql not found" };
  }
  
  const content = await fs.readFile(schemaPath, "utf-8");
  const issues = [];
  
  // Check for required tables
  const requiredTables = ["users", "profiles", "domains", "temp_emails", "mailboxes", "app_settings"];
  for (const table of requiredTables) {
    if (!content.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
      issues.push(`Missing required table: ${table}`);
    }
  }
  
  // Check for proper IF NOT EXISTS usage
  const createTableMatches = content.match(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi);
  if (createTableMatches) {
    issues.push("Some CREATE TABLE statements missing IF NOT EXISTS clause");
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

// Get version from package.json
async function getVersion() {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf-8"));
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

async function main() {
  const version = await getVersion();
  console.log(`\n🚀 TempMail cPanel Packager v${version}\n`);

  // Pre-flight checks
  console.log("🔍 Running pre-flight checks...\n");

  if (!(await pathExists(PHP_BACKEND_DIR))) {
    throw new Error(`Missing php-backend/ folder at: ${PHP_BACKEND_DIR}`);
  }
  logVerbose("✓ php-backend directory exists");

  // Validate PHP syntax
  console.log("  Validating PHP syntax...");
  const phpErrors = await lintPhpFiles(PHP_BACKEND_DIR);
  if (phpErrors.length > 0) {
    console.error("\n❌ PHP syntax errors found:\n");
    for (const { file, error } of phpErrors) {
      console.error(`  ${path.relative(ROOT, file)}:`);
      console.error(`    ${error}\n`);
    }
    throw new Error("PHP syntax validation failed. Fix the errors above before packaging.");
  }
  console.log("  ✅ PHP syntax validation passed");

  // Validate schema.sql
  console.log("  Validating schema.sql...");
  const schemaResult = await validateSchema(path.join(PHP_BACKEND_DIR, "schema.sql"));
  if (!schemaResult.valid) {
    console.warn("\n⚠️  Schema issues found:");
    for (const issue of schemaResult.issues || [schemaResult.error]) {
      console.warn(`    - ${issue}`);
    }
    console.log("");
  } else {
    console.log("  ✅ Schema validation passed");
  }

  // Check for required files
  const requiredFiles = ["index.php", "config.example.php", "schema.sql", "install.php", "requirements-check.php", "verify-installation.php"];
  for (const file of requiredFiles) {
    if (!(await pathExists(path.join(PHP_BACKEND_DIR, file)))) {
      throw new Error(`Missing required file: php-backend/${file}`);
    }
  }
  console.log("  ✅ Required files present\n");

  if (!SKIP_BUILD) {
    console.log("📦 Building React app for self-hosted deployment...\n");
    const userAgent = process.env.npm_config_user_agent ?? "";
    const isBun = userAgent.startsWith("bun");

    // Always set self-hosted flag for cPanel builds
    const buildEnv = { 
      VITE_SELF_HOSTED: "true",
      ...(API_URL ? { VITE_PHP_API_URL: API_URL } : {})
    };

    if (isBun) {
      await run("bun", ["run", "build"], { env: buildEnv });
    } else {
      await run("npm", ["run", "build"], { env: buildEnv });
    }
  }

  if (!(await pathExists(DIST_DIR))) {
    throw new Error(
      `Missing dist/ folder at: ${DIST_DIR}. Run the script without --skip-build, or run "npm run build" first.`
    );
  }

  // Output structure designed for cPanel
  const PUBLIC_HTML_DIR = path.join(OUT_DIR, "public_html");
  const API_DIR = path.join(PUBLIC_HTML_DIR, "api");

  console.log("📁 Creating package structure...\n");

  await rmrf(OUT_DIR);
  await mkdirp(PUBLIC_HTML_DIR);
  await mkdirp(API_DIR);

  // Copy frontend build
  await copyDir(DIST_DIR, PUBLIC_HTML_DIR);
  logVerbose("Copied frontend build");

  // Copy backend into /api
  await copyDir(PHP_BACKEND_DIR, API_DIR, {
    filter: (srcPath, entry) => {
      // Never ship config.php (only example)
      if (entry.isFile() && path.basename(srcPath) === "config.php") return false;
      return true;
    },
  });
  logVerbose("Copied PHP backend");

  // Create version file
  const versionInfo = {
    version,
    built_at: new Date().toISOString(),
    php_required: "8.1+",
    mysql_required: "8.0+",
  };
  await fs.writeFile(
    path.join(API_DIR, "version.json"),
    JSON.stringify(versionInfo, null, 2)
  );
  logVerbose("Created version.json");

  console.log("✅ Package folder created:", OUT_DIR);

  // Create archives if requested
  if (CREATE_TAR) {
    console.log("\n📦 Creating archive...");
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const archiveName = `tempmail-cpanel-${version}-${timestamp}.tar.gz`;
    const archivePath = path.join(ROOT, archiveName);

    await createTarGz(PUBLIC_HTML_DIR, archivePath);

    const stats = await fs.stat(archivePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Archive created: ${archiveName} (${sizeMB} MB)`);
    console.log(`   Location: ${archivePath}`);
  }

  // Print instructions
  console.log("\n" + "=".repeat(60));
  console.log("📋 UPLOAD INSTRUCTIONS");
  console.log("=".repeat(60));
  console.log("\n1) Upload the CONTENTS of cpanel-package/public_html/ to your cPanel public_html/");
  if (CREATE_TAR) {
    console.log("   OR upload the .tar.gz file and extract in cPanel File Manager");
  }
  console.log("\n2) Visit: https://YOURDOMAIN.com/api/install.php (once)");
  console.log("\n3) DELETE install.php after setup (security!)");
  console.log("\n4) Copy api/config.example.php to api/config.php and edit settings");
  console.log("\n5) Verify API: https://YOURDOMAIN.com/api/health");
  console.log("\n6) Set up cron jobs in cPanel:");
  console.log("   */2 * * * * /usr/bin/php /home/USER/public_html/api/cron/imap-poll.php");
  console.log("   0 * * * * /usr/bin/php /home/USER/public_html/api/cron/maintenance.php");
  console.log("   0 */6 * * * /usr/bin/php /home/USER/public_html/api/cron/health-check.php");
  console.log("\n" + "=".repeat(60));
  console.log("\n💡 Tips:");
  console.log("   --zip        Create downloadable .tar.gz archive");
  console.log("   --skip-build Skip frontend build (use existing dist/)");
  console.log("   --verbose    Show detailed output");
  console.log("   --api-url    Set custom API URL for frontend");
  console.log("\n   Example: node scripts/cpanel-package.mjs --zip --verbose\n");
}

main().catch((err) => {
  console.error("\n❌ Packaging failed:");
  console.error(err);
  process.exit(1);
});
