import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "www");
if (!output.startsWith(`${root}\\`) && !output.startsWith(`${root}/`)) {
  throw new Error("Invalid Android web output path");
}

const runtimeFiles = [
  "index.html",
  "cliente.html",
  "colaborador.html",
  "mesero.html",
  "admin.html",
  "styles.css",
  "app.js",
  "cliente.js",
  "colaborador.js",
  "mesero.js",
  "admin.js",
  "offline-i18n.js",
  "auto-translate.js",
  "supabase-config.js",
  "service-worker.js",
  "manifest.webmanifest",
  "cliente-manifest.webmanifest",
  "colaborador-manifest.webmanifest",
  "admin-manifest.webmanifest",
  "manifest.pl.webmanifest",
  "manifest.en.webmanifest",
  "cliente-manifest.pl.webmanifest",
  "cliente-manifest.en.webmanifest",
  "colaborador-manifest.pl.webmanifest",
  "colaborador-manifest.en.webmanifest",
  "admin-manifest.pl.webmanifest",
  "admin-manifest.en.webmanifest",
  "mesero-manifest.webmanifest",
  "mesero-manifest.pl.webmanifest",
  "mesero-manifest.en.webmanifest",
  "app-icon.svg",
  "app-icon-192.png",
  "app-icon-512.png"
];

const publicConfig = readFileSync(join(root, "supabase-config.js"), "utf8");
if (/service[_-]?role|sb_secret|STRIPE_SECRET|WEBHOOK_SECRET/i.test(publicConfig)) {
  throw new Error("A private secret was detected in the public frontend configuration");
}

for (const file of runtimeFiles) {
  if (!existsSync(join(root, file))) throw new Error(`Missing runtime file: ${file}`);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const file of runtimeFiles) cpSync(join(root, file), join(output, file));
writeFileSync(join(output, "BUILD-METADATA.json"), JSON.stringify({ app: "RC ORDERA", version: "v91.0.0" }, null, 2));
console.log(`Android web assets prepared: ${runtimeFiles.length} files`);

