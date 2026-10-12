#!/usr/bin/env node
// Read-only deployment identity check. Never touches orders, Auth, caches or database.
const release = "2026-10-12-r15";
const site = (process.env.SITE_URL || "https://rincon-colombiano-pedidosapp.vercel.app").replace(/\\/$/, "");
const url = site + "/rc-ordera-release.json?verify=" + Date.now();
try {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const payload = await response.json();
  if (payload.app !== "RC ORDERA" || payload.release !== release) {
    console.error("DESPLIEGUE PENDIENTE: servidor=" + String(payload.release) + ", esperado=" + release);
    process.exitCode = 1;
  } else {
    console.log("DESPLIEGUE CONFIRMADO: RC ORDERA " + release + " en " + site);
  }
} catch (error) {
  console.error("No se pudo validar la publicación: " + String(error.message || error));
  process.exitCode = 1;
}
