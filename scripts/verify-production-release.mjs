#!/usr/bin/env node
// Read-only: compare production with the exact checked-out release and critical assets.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const expected = JSON.parse(readFileSync(new URL('../rc-ordera-release.json', import.meta.url)));
const site = (process.env.SITE_URL || 'https://rincon-colombiano-pedidosapp.vercel.app').replace(/\/$/, '');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function download(path) {
  const response = await fetch(`${site}/${path}?verify=${Date.now()}`, {cache: "no-store", signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
try {
  const actual = JSON.parse(new TextDecoder().decode(await download('rc-ordera-release.json')));
  if (actual.app !== expected.app || actual.release !== expected.release || actual.pwaCache !== expected.pwaCache)
    throw Error(`servidor=${actual.release}, esperado=${expected.release}`);
  // A reused release label must not hide missing menu, station or payment fixes.
  for (const path of ['index.html','app.js','cliente.js','mesero.js','mesero.html','restaurante.html','offline-i18n.js','styles.css','service-worker.js']) {
    if (digest(await download(path)) !== digest(readFileSync(new URL(`../${path}`, import.meta.url))))
      throw Error(`${path}: contenido publicado distinto del repositorio`);
  }
  // The deployment entry point must serve the same portal as the committed index.
  // A previous release can otherwise keep showing staff access on the public home.
  const publishedHome = new TextDecoder().decode(await download(''));
  const expectedHome = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  if (publishedHome !== expectedHome)
    throw Error('ruta /: portada desplegada distinta de index.html del repositorio');
  if (/Personal y estaciones/i.test(publishedHome) || /href=["'][^"']*mesero\.html/i.test(publishedHome))
    throw Error('ruta /: estaciones aparecen fuera del inicio de sesión del restaurante');
  const publishedRestaurant = new TextDecoder().decode(await download('restaurante.html'));
  if (!/id=["']restaurantStaffAccessLink["']/.test(publishedRestaurant) ||
      !/id=["']waiterTeamButton["']/.test(publishedRestaurant))
    throw Error('restaurante.html: falta acceso controlado a personal y estaciones');
  console.log(`DESPLIEGUE CONFIRMADO: ${expected.release}; 9 archivos críticos y portada / verificados en ${site}`);
} catch (error) {
  console.error(`DESPLIEGUE NO CONFIRMADO: ${error.message}`);
  process.exitCode = 1;
}
