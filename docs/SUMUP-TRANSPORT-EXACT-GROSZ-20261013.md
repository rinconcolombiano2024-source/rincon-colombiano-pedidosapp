# RC ORDERA — SumUp: seguridad decimal y conciliación de checkout
13/10/2026. Integración parcial, **inactiva en producción**.

La biblioteca compartida ahora compara importes PLN con grosz decimal exacto, sin tolerancias de coma flotante, y normaliza a minúsculas el UUID de referencia. Se añadió recuperación idempotente de checkout por referencia persistida **solo mediante dos lecturas GET**, sin repetir creación POST ante fallos de red. Rechaza estados ambiguos, comercios, referencias, importes y UUID de checkout diferentes.

Pruebas: `tests/hardening/sumup-reference-recovery.test.mjs`, `tests/hardening/sumup-exact-amount.test.mjs` y `tests/hardening/sumup-hosted.test.mjs`.

**Este PR deliberadamente no activa SumUp ni despliega Edge Functions.** No están desplegadas `sumup-checkout` ni `sumup-webhook` en el proyecto real; la integración end-to-end exige migraciones verificadas en staging, secretos almacenados en Supabase, revalidación de webhooks/ledger y autorización del operador. Los pedidos siguen intactos y el selector de SumUp no se activa. No se realiza llamada externa con dinero.
