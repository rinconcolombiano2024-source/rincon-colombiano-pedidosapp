# RC ORDERA Android — paquete interno de verificación
**13 de octubre de 2026 — App Capacitor 8, proyecto `com.rcordera.app`.**

## Qué realiza la nueva automatización
`.github/workflows/android-debug-apk.yml` prepara assets web existentes, genera el proyecto nativo Android con Capacitor 8, sincroniza el plugin oficial `@capacitor/browser`, compila `assembleDebug` con Node 22/JDK 21/SDK 36 y guarda el APK como artefacto de GitHub Actions durante siete días. No modifica Vercel ni Supabase, no modifica el paquete instalado en el móvil, no usa secretos, no genera pagos ni envía tickets fiscales.

**No es un APK de producción.** El APK debug usa una firma de depuración creada para el ejecutor, y no debe instalarse como actualización encima de una aplicación firmada para distribución. El propietario debe descargar el artefacto solo para realizar pruebas en un teléfono de ensayo autorizado; nunca pedir a empleados que desinstalen la aplicación operativa si guarda pedidos o menús locales sin sincronizar.

## Prueba manual mínima
1. Conservar intacta la aplicación que ya funciona y usar un teléfono de pruebas.
2. Instalar la APK interna de Actions, abrir Restaurante e iniciar sesión.
3. Pulsar QR cliente → Ir a cliente y Estaciones → Ir a estaciones: la pantalla del restaurante no debe cerrarse.
4. Regresar al restaurante y confirmar que el menú y los pedidos previos no se alteraron; ejecutar un pedido de prueba sin cobro real.
5. Verificar que Impresora fiscal abre un cuadro en la misma app y **no** presenta el simple permiso USB como fiscalización real.
6. Confirmar en Caja/Cliente los productos publicados. Las descripciones no sincronizadas deben recuperarse desde su dispositivo original.

## Producción
Se requiere firma Android de lanzamiento bajo control del propietario, prueba física, backup de datos locales, permisos, verificación de SumUp/Stripe y fiscal, desplegar la web (actualmente Vercel informa límite de builds) y seguimiento de Supabase. **Este artefacto no satisface ninguna de esas puertas de seguridad.**

Ejecuciones: GitHub → Actions → «RC ORDERA — Android debug APK for internal verification». Puede dispararse manualmente sin publicar un release ni reemplazar un binario estable.
