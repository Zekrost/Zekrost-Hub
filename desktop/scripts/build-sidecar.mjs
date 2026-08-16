// Construye el sidecar Go y lo renombra con el sufijo -<target-triple>
// que exige Tauri (bundle.externalBin). Funciona en Linux, macOS y
// Windows (cada CI compila su propio binario nativo — sin cross-compile).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const binDir = join(here, "..", "src-tauri", "binaries");
const ext = process.platform === "win32" ? ".exe" : "";

const version = process.env.HUB_VERSION || "0.1.0";
const triple = execSync("rustc --print host-tuple", { stdio: ["ignore", "pipe", "ignore"] })
  .toString()
  .trim();

mkdirSync(binDir, { recursive: true });
const tmp = join(binDir, `zekrost-hub-tmp${ext}`);
const final = join(binDir, `zekrost-hub-${triple}${ext}`);

console.log(`[sidecar] go build (${triple}) v${version}`);
execSync(`go build -ldflags "-s -w -X github.com/zekrost/hub/internal/server.Version=${version}" -o ${tmp} ./cmd/hub`, {
  cwd: root,
  stdio: "inherit",
});

if (existsSync(final)) rmSync(final);
renameSync(tmp, final);
console.log(`[sidecar] ok: ${final}`);
