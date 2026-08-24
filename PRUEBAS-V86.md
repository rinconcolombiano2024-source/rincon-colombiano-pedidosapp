# RC ORDERA V86.1 - Matriz de pruebas

## Pruebas automaticas locales

Ejecuta desde la carpeta del proyecto:

```powershell
npm run qa
```

Debe terminar con `RC ORDERA V86.1 static QA: OK`. Esta prueba revisa sintaxis,
contratos de interfaz, versiones PWA, migraciones, pagos, pedidos, traducciones,
impresion y copia Android.

## Pruebas de base de datos

Despues de aplicar las ocho migraciones, ejecuta `VALIDACION-V86.sql`. Comprueba:

- funciones RPC presentes y con permisos correctos;
- RLS activa en tablas sensibles;
- tickets unicos por restaurante y fecha;
- buckets de documentos privados;
- usuario normal sin acceso administrativo;
- cola de colaboradores vacia como `[]`, no como error.

## Prueba integral con dos dispositivos

1. Restaurante abre la atencion y publica un producto.
2. Cliente ve el cambio sin cerrar la aplicacion.
3. Cliente crea un pedido para recoger y otro a domicilio.
4. Restaurante recibe la alarma, acepta e imprime una sola vez.
5. Mesero crea un pedido; la caja central lo recibe con el mismo total.
6. Estaciones reciben solo los productos que les corresponden.
7. Colaborador disponible recibe la oferta, acepta, recoge y entrega con PIN.
8. Cliente y restaurante confirman la entrega.
9. Historial, cierres y reportes conservan precio, moneda, fecha y zona horaria.

## Pagos de prueba

En Stripe test mode verifica:

- onboarding Connect del restaurante y colaborador;
- pago correcto y pago fallido;
- comision de plataforma del 5% y del 0,1%;
- fondos retenidos hasta las confirmaciones requeridas;
- reintento idempotente, reembolso y disputa;
- un webhook repetido no duplica pedido, transferencia ni comision.

## Seguridad y aislamiento

Prueba con dos usuarios por perfil que cliente A, restaurante A, empleado A y
colaborador A no puedan leer ni modificar datos de B. Intenta tambien cambiar
precio, total, `restaurant_id`, rol o estado desde una solicitud manual.

## Dispositivos y operacion

Prueba movil Android, iPhone/iPad, tableta y computador; instalacion PWA;
reconexion; ubicacion permitida y rechazada; notificacion con pantalla bloqueada;
y cada impresora real. El corte automatico exige que navegador, controlador e
impresora permitan comandos ESC/POS; en caso contrario se usa el dialogo del
sistema y el corte manual.

## Criterio de aprobacion

No pasar a cobros reales hasta que todas las pruebas anteriores esten registradas
como aprobadas, no existan errores de consola o Supabase y se haya realizado la
revision legal y contractual de pagos, privacidad y reparto en cada pais.
