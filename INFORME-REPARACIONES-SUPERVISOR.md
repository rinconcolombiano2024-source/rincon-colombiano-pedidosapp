# RC ORDERA V91.0.3 - Informe de reparaciones del supervisor

## 1. CRÉDITOS / ALCANCE

Se completaron y validaron las prioridades 1, 2, 3, 4, 8 y 9 de la instrucción. La prioridad 5 se evaluó y se dejó pendiente porque reemplazar la carga de Supabase en los cinco puntos de entrada requiere una validación real de autenticación y conectividad que no puede garantizarse de forma segura en esta entrega. Las prioridades 6 y 7 se revisaron de manera dirigida; no se encontró otro cambio demostrable que justificara modificar el runtime.

No se modificaron migraciones, tablas, RLS, triggers, RPC, datos de producción ni V91.02.

## CONTINUIDAD DE SESIÓN

- Antes de reanudarse los créditos ya estaban terminadas la eliminación comprobada de copias históricas en `supabase/functions/`, la creación del lockfile, la instalación reproducible, la suite E2E mínima, el CI, `.gitattributes` y la eliminación de los tres archivos `download*` sin referencias.
- La sesión se había detenido después de ejecutar todas las validaciones finales con resultado satisfactorio y comprobar el diff acumulado, justo antes de crear este informe y el ZIP.
- En esta continuación no se repitieron reparaciones ni auditorías. Se conservó el estado validado, se documentó el alcance y se empaquetó la entrega excluyendo dependencias y resultados temporales.
- No se añadió ninguna reparación funcional nueva durante la continuación porque no había trabajo parcialmente implementado.
- Sigue pendiente la carga local de Supabase JS y las validaciones que exigen entornos reales de Supabase, Stripe o Google Cloud.

## 2. CORREGIDO

1. Se eliminó la copia histórica del frontend ubicada directamente en el nivel raíz de `supabase/functions/`.
   - Se comprobaron `supabase/config.toml`, imports, scripts y referencias.
   - Los 97 archivos eliminados tenían equivalentes en la raíz del proyecto: 73 eran idénticos y 24 eran versiones anteriores o divergentes.
   - Se preservaron las 11 Edge Functions legítimas, cada una en su carpeta y con `index.ts`.

2. Se creó `package-lock.json` reproducible sin actualizar las versiones declaradas de Capacitor.
   - Lockfile versión 3.
   - Capacitor permanece exactamente en `8.5.0`.
   - Playwright quedó fijado exactamente en `1.62.1` como dependencia de desarrollo.

3. Se añadió una suite E2E mínima y aislada.
   - Abre principal, cliente, colaborador, mesero y administración.
   - No usa usuarios, contraseñas ni datos reales.
   - Intercepta Supabase para impedir solicitudes al proyecto real.
   - Comprueba respuesta HTTP, estructura esencial, IDs duplicados, overflow horizontal grave y errores fatales de JavaScript.

4. Se añadió CI de validación, sin despliegue y sin secretos.
   - Instalación exacta mediante `npm ci`.
   - Sintaxis de los JS principales.
   - QA general e i18n.
   - Preparación web Android.
   - E2E con Chromium.

5. Se añadió `.gitattributes` para prevenir nueva mezcla de CRLF/LF sin reescribir masivamente los archivos existentes.

6. Se eliminaron `download`, `download (1)` y `download (2)`.
   - Eran fragmentos de listas de exclusión de 99, 166 y 132 bytes.
   - No existía ninguna referencia por nombre desde código, HTML, scripts, documentación o configuración.

## 3. NO CORREGIDO

1. Supabase JS continúa cargándose desde jsDelivr en el primer arranque.
   - Se verificó que la versión utilizada es `2.57.4`.
   - El cambio a un bundle local afectaría los cinco puntos de entrada, Service Worker y Capacitor. Se dejó pendiente porque esta entrega no dispone de una validación real completa de autenticación y reconexión.

2. No se consolidó `supabase-schema.sql` con las migraciones históricas.
   - Requiere contrastar el estado real de producción y no debe inventarse una baseline.

3. No se certificaron RLS, Stripe Connect, Google Maps ni pagos.
   - Esas comprobaciones requieren cuentas y entornos reales controlados.

4. No se implementó CSP.
   - Requiere un inventario completo y probado de dominios externos.

## 4. ARCHIVOS MODIFICADOS

Modificados:

- `.gitignore`
- `package.json`

Añadidos:

- `.gitattributes`
- `.github/workflows/qa.yml`
- `package-lock.json`
- `playwright.config.cjs`
- `scripts/serve-static.cjs`
- `tests/e2e/global-setup.cjs`
- `tests/e2e/smoke.spec.js`
- `INFORME-REPARACIONES-SUPERVISOR.md`

No se modificó ningún archivo de lógica funcional de la aplicación en esta reparación del supervisor.

## 5. ARCHIVOS ELIMINADOS

Archivos basura sin referencias eliminados de la raíz:

```text
download
download (1)
download (2)
```

Copias históricas eliminadas del nivel raíz de `supabase/functions/`:

```text
admin-manifest.en.webmanifest
admin-manifest.pl.webmanifest
admin-manifest.webmanifest
admin.html
admin.js
ANDROID-V85.md
app-icon-192.png
app-icon-512.png
app-icon.svg
app.js
AUDITORIA-V85-PREPRODUCCION.md
auto-translate.js
capacitor.config.json
cliente-manifest.en.webmanifest
cliente-manifest.pl.webmanifest
cliente-manifest.webmanifest
cliente.html
cliente.js
colaborador-manifest.en.webmanifest
colaborador-manifest.pl.webmanifest
colaborador-manifest.webmanifest
colaborador.html
colaborador.js
DESPLIEGUE-V86.md
download
download (1)
download (2)
ENTREGA-PARCIAL-RC-ORDERA-V89.md
ENTREGA-RC-ORDERA-V84.1.md
ENTREGA-RC-ORDERA-V84.md
ENTREGA-RC-ORDERA-V85.md
ENTREGA-RC-ORDERA-V91.md
GUIA-ACCESO-ADMIN-V70.txt
GUIA-ACTUALIZACION-V73.md
GUIA-ACTUALIZACION-V74.md
GUIA-ACTUALIZACION-V75.md
GUIA-ACTUALIZACION-V76.md
GUIA-ACTUALIZACION-V79.md
GUIA-ACTUALIZACION-V80.md
GUIA-CONFIGURACION-SUPABASE-V66.txt
GUIA-DESPLIEGUE-V85.md
GUIA-PUESTA-EN-MARCHA-V72.md
GUIA-RECUPERACION-ADMIN-V67.txt
index.html
INSTRUCCIONES-FASE3-ROLES-ACCESOS.txt
INSTRUCCIONES-FASE4-V55.txt
INSTRUCCIONES-FASE5-V56.txt
INSTRUCCIONES-FASE6-V57-CORREO-DISENO-RECUPERACION.txt
INSTRUCCIONES-FASE7-V58-COLABORADORES-ARCHIVOS-APROBACION.txt
INSTRUCCIONES-QR-CLIENTE.txt
INSTRUCCIONES-TABLET.txt
INSTRUCCIONES-V59-TRADUCCION-DESCRIPCIONES.txt
INSTRUCCIONES-V60-ADMIN-PLATAFORMA-COLABORADORES.txt
INSTRUCCIONES-V61-VALIDACION-SINCRONIZACION.txt
INSTRUCCIONES-V62-ADMIN-UNICO-ARCHIVOS-TRADUCCION.txt
INSTRUCCIONES-V63-COLABORADOR-CERCANO-IDIOMAS.txt
INSTRUCCIONES-V64-RC-ORDERA-FASE1.txt
INSTRUCCIONES-V65-ACCESOS-PERFILES.txt
INSTRUCCIONES-V71-MESEROS-ESTACIONES.txt
manifest.en.webmanifest
manifest.pl.webmanifest
manifest.webmanifest
MEMORIA_APP_RINCON_COLOMBIANO.txt
mesero-manifest.en.webmanifest
mesero-manifest.pl.webmanifest
mesero-manifest.webmanifest
mesero.html
mesero.js
MIGRACION-FASE1-V65-SEGURIDAD-ACCESOS.sql
MIGRACION-FASE1-V66-REPARAR-NUBE.sql
MIGRACION-FASE1-V67-VERIFICAR-ADMIN.sql
MIGRACION-FASE1-V69-ELIMINAR-RESTAURANTE.sql
MIGRACION-FASE1-V70-ACCESO-ADMIN-SEGURO.sql
MIGRACION-FASE1-V71-MESEROS-ESTACIONES.sql
MIGRACION-FASE1-V72-NUBE-HORARIOS-REALTIME.sql
MIGRACION-FASE1-V72-RECUPERAR-ADMIN-UNICO.sql
MIGRACION-FASE1-V73-AUTORIZACION-PERSONAL.sql
MIGRACION-FASE1-V74-ESTABILIZACION-APROBACIONES-UBICACION-ELIMINACION.sql
MIGRACION-FASE1-V75-ESTADO-HORARIO-AUTORIZACIONES.sql
MIGRACION-FASE1-V76-REGION-AUTORIZACIONES-IMPRESION.sql
MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql
MIGRACION-FASE1-V81-ENTREGAS-DOMICILIARIOS.sql
MIGRACION-FASE1-V82-ESTABILIDAD-CORE.sql
MIGRACION-FASE10-V63-COLABORADOR-CERCANO.sql
MIGRACION-FASE2-REALTIME-MENU.sql
MIGRACION-FASE2-V83-DESPACHO-PERSISTENTE.sql
MIGRACION-FASE3-ROLES-ACCESOS.sql
MIGRACION-FASE4-V55-ACCESO-LIMPIO-CIERRE-RESTAURANTE.sql
MIGRACION-FASE5-V56-PEDIDOS-INVITADO-MEJORAS.sql
MIGRACION-FASE7-V58-COLABORADORES-ARCHIVOS-APROBACION.sql
MIGRACION-FASE8-V60-ADMIN-PLATAFORMA-COLABORADORES.sql
MIGRACION-FASE9-V62-ADMIN-UNICO.sql
MIGRACION-FASES3-5-V84-EXPERIENCIA-CRECIMIENTO-FINANZAS.sql
MIGRACION-V73-REPARAR-COLA-REVISION-COLABORADORES.sql
MIGRACION-V84.1-ESTABILIZACION-PRODUCCION.sql
MIGRACIONES-V85.md
MIGRACIONES-V86.md
```

Las migraciones originales de la raíz permanecen intactas. Solo se eliminaron sus duplicados históricos dentro del lugar incorrecto.

## 6. PRUEBAS EJECUTADAS

- `node --check` sobre los ocho JS principales: PASS.
- `node --check` sobre servidor, configuración y pruebas E2E nuevas: PASS.
- `npm run qa`: PASS.
  - `RC ORDERA V91.0.3 QA: comprobaciones aprobadas.`
  - i18n incluido: 2024 comprobaciones.
- `npm run qa:i18n`: PASS, 2024 comprobaciones.
- `npm run android:prepare-web`: PASS, 33 archivos generados.
- Comparación SHA-256 raíz contra `www/` para los ocho JS runtime: PASS.
- `npm run qa:e2e`: PASS, 5/5 pantallas.
- `npm ci --ignore-scripts --no-audit --no-fund`: PASS.
- `npm ls --all`: PASS, sin dependencias inválidas.
- Búsqueda de referencias a los archivos históricos eliminados: PASS, sin referencias.
- Revisión de secretos privados en runtime público: PASS, sin patrones `service_role`, `sb_secret`, `STRIPE_SECRET` o `WEBHOOK_SECRET`.
- Revisión de referencias activas a V91.0.2: PASS, ninguna.
- Integridad de `MIGRACION-V91-02-SINCRONIZACION-CANCELACION-PEDIDOS.sql`: PASS; SHA-256 sin cambios `7FA9D3848F9EBC2FB26103F26CEB1C54A683B7FEF99352A36B8E8761A570D34D`.

## 7. HALLAZGOS NUEVOS

1. `@capacitor/cli@8.5.0` mantiene una dependencia transitiva en `uuid@7.0.3` que npm marca como obsoleta.
   - No se actualizó porque la tarea prohíbe upgrades y no existe un fallo funcional demostrado.

2. El CI se validó mediante los mismos comandos localmente, pero su ejecución en GitHub solo podrá confirmarse cuando el proyecto se publique en un repositorio con Actions habilitado.

## 8. NO TOCADO POR RIESGO

- Carga local de Supabase JS: requiere modificar cinco entradas, Service Worker y Capacitor, además de pruebas reales de autenticación.
- RLS y aislamiento A/B: requieren usuarios reales de prueba en Supabase.
- Stripe Connect, pagos, reembolsos, disputas y conciliación: requieren entorno Stripe de prueba controlado.
- Google Maps: las restricciones HTTP Referrer y API se validan en Google Cloud, no mediante cambios arbitrarios de código.
- CSP: se dejó pendiente hasta disponer del inventario exacto de dominios externos.
- Realtime, polling, estados pending/confirmed, `menu_revision`, `settings_revision`, RPC y V91.02: no se modificaron porque no se demostró una carrera o duplicación adicional.
- Usos prioritarios de `innerHTML`: se revisaron nombres, notas, chat, direcciones, productos, restaurante y personal; ya usan los helpers de escape existentes. No se cambió código sin un caso XSS nuevo demostrado.
- `.catch(() => {})`: los casos encontrados corresponden a limpieza de canales, refrescos o funciones que ya manejan su error. No se alteraron sin evidencia de pérdida de escritura crítica.

## 9. ESTADO FINAL

- `npm run qa`: PASS.
- QA i18n: PASS, 2024 comprobaciones.
- Sintaxis JS: PASS.
- Android prepare: PASS.
- Sincronización raíz -> `www/`: PASS.
- E2E: PASS, 5/5.
- Lockfile: incluido y validado mediante instalación limpia.
- CI: incluido; sin despliegue, conexiones reales ni secretos.
- Edge Functions legítimas: 11/11 preservadas con `index.ts`.
- Archivos históricos en la raíz de `supabase/functions/`: 0.
- Migraciones nuevas: ninguna.
- V91.02: intacta.

## 10. ZIP FINAL

Nombre previsto: `RC-ORDERA-V91.0.3-SUPERVISOR-CORREGIDA.zip`.

El ZIP incluye el proyecto completo, migraciones históricas, V91.02, lockfile, CI y pruebas E2E. No incluye `node_modules`, caches, resultados temporales de Playwright ni ZIP anteriores.
