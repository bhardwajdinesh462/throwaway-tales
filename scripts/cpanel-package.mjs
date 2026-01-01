import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const API_URL = getArg("--api-url");

const DIST_DIR = path.join(ROOT, "dist");
const PHP_BACKEND_DIR = path.join(ROOT, "php-backend");

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

async function main() {
  if (!(await pathExists(PHP_BACKEND_DIR))) {
    throw new Error(`Missing php-backend/ folder at: ${PHP_BACKEND_DIR}`);
  }

  if (!SKIP_BUILD) {
    const userAgent = process.env.npm_config_user_agent ?? "";
    const isBun = userAgent.startsWith("bun");

    const buildEnv = API_URL ? { VITE_PHP_API_URL: API_URL } : {};

    if (isBun) {
      await run("bun", ["run", "build"], { env: buildEnv });
    } else {
      await run("npm", ["run", "build"], { env: buildEnv });
    }
  }

  if (!(await pathExists(DIST_DIR))) {
    throw new Error(
      `Missing dist/ folder at: ${DIST_DIR}. Run the script without --skip-build, or run \"npm run build\" first.`
    );
  }

  // Output structure designed for cPanel: upload CONTENTS of public_html into your public_html
  // and upload the api folder to public_html/api
  const PUBLIC_HTML_DIR = path.join(OUT_DIR, "public_html");
  const API_DIR = path.join(PUBLIC_HTML_DIR, "api");

  await rmrf(OUT_DIR);
  await mkdirp(PUBLIC_HTML_DIR);
  await mkdirp(API_DIR);

  // Copy frontend build
  await copyDir(DIST_DIR, PUBLIC_HTML_DIR);

  // Copy backend into /api
  await copyDir(PHP_BACKEND_DIR, API_DIR, {
    filter: (srcPath, entry) => {
      // Never ship example configs as active config
      if (entry.isFile() && path.basename(srcPath) === "config.php") return false;
      return true;
    },
  });

  console.log("\n✅ cPanel package created:");
  console.log(`   ${OUT_DIR}`);
  console.log("\nUpload instructions:");
  console.log("  1) Upload the CONTENTS of cpanel-package/public_html/ to your cPanel public_html/");
  console.log("  2) Visit: https://YOURDOMAIN.com/api/install.php (once)");
  console.log("  3) Delete install.php after setup (security)");
  console.log("  4) Verify backend: https://YOURDOMAIN.com/api/health");
  console.log("\nTip:");
  console.log("  If you host the frontend in a subfolder, you must update the frontend .htaccess RewriteBase and Vite base config.");
}

main().catch((err) => {
  console.error("\n❌ Packaging failed:");
  console.error(err);
  process.exit(1);
});
