# SumUp: validación previa y avisos repetidos

La configuración completa del proveedor se valida antes de consultar pedidos o reservar un intento. Un origen de retorno inválido, merchant mal formado o clave con espacios/caracteres de control devuelve 503 sin crear una reserva financiera. La validación se comparte con el transporte para mantener el mismo contrato.

El webhook comprueba restaurante, comercio y moneda antes de reconocer un pago ya confirmado en el libro de la base de datos. Los avisos repetidos de ese pago no consultan nuevamente SumUp ni vuelven a escribir el libro. Sigue existiendo una lectura por aviso; no se afirma eliminación completa de consultas ni reducción del porcentaje de CPU.

Las pruebas ejecutan las rutas TypeScript con dependencias externas simuladas: configuración inválida sin acceso a datos, configuración válida, pago pendiente con verificación, 100 avisos de pago confirmado sin tráfico al proveedor ni escritura, y rechazo de otro restaurante. Las pruebas financieras existentes siguen siendo obligatorias.

No se habilitan cobros ni se modifican pedidos reales. Para activar el servicio siguen pendientes la migración verificada en staging, configuración de secretos de la empresa y pruebas de cobro y devolución conciliados. El despliegue web de main continúa sujeto a la cuota de Vercel.
