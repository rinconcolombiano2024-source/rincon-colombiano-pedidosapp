# Validación del despliegue y conservación de correcciones

Base revisada: b2213d7 (#40), incluyendo recuperación de estaciones #39 y publicación verificada del menú #40. Se conservan los cambios integrados de SumUp, traducciones, ventanas independientes y reducción de consultas.

La comprobación de producción ahora lee la versión del repositorio y compara SHA-256 de ocho archivos críticos. Una etiqueta antigua o reutilizada ya no puede acreditar que el menú y estaciones estén desplegados. El verificador de servicios rechaza HTTP 503 de los webhooks fiscal, reparto y pagos: un servicio sin configurar no está listo.

Lectura de Supabase del 13 de octubre: existen dos perfiles RINCON COLOMBIANO; ambos tienen menús privados y públicos iguales. Uno conserva revisión 1; el actualizado a las 14:17 UTC tiene revisión 40. Esto no acredita que los productos editados localmente se hayan sincronizado ni identifica qué perfil abre cada QR. No se sobrescribieron menús ni pedidos.

Vercel rechazó el despliegue de b2213d7 a las 12:36 UTC con `Deployment rate limited — retry in 24 hours.` La consulta directa desde este entorno agotó el tiempo; no se confirma la versión actualmente publicada. Resolver la cuota del proyecto y repetir `node scripts/verify-production-release.mjs` después de desplegar main. No basta con fusionar un PR.

SumUp permanece sujeto a configuración segura de cuenta y pruebas de transacción/conciliación; la conexión fiscal requiere protocolo y hardware real. No se afirma disponibilidad 99,9 % ni reducción medida del CPU reportado del 93 %.
