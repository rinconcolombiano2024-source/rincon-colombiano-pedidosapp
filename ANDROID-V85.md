# Android RC ORDERA V85

RC ORDERA conserva una sola base web/PWA y esta preparada para envolverla con
Capacitor 8.5.0. El identificador Android es `com.rcordera.app`.

## Requisitos

- Node.js 22 o superior.
- Android Studio y SDK Android 36.
- Java compatible con la version de Android Studio/Capacitor.
- Cuenta de Google Play Console.
- Clave de firma guardada fuera del repositorio y con respaldo seguro.

## Crear el proyecto Android

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Cada cambio web requiere `npm run android:sync`. El script prepara `www`, valida
que los 21 archivos de ejecucion existan y rechaza secretos privados en la
configuracion publica.

## Antes del AAB

1. Configura una clave Google Maps exclusiva de Android, restringida por nombre
   de paquete y huella SHA-256.
2. Mantiene la clave web restringida a los dominios Vercel/produccion.
3. Prueba geolocalizacion, camara, archivos, notificaciones, offline y retorno de
   Stripe en un dispositivo fisico.
4. Configura enlaces de aplicacion para el retorno del pago.
5. Genera un AAB firmado de release y ejecuta pruebas internas de Google Play.

El ZIP V85 no contiene una clave de firma ni un AAB. Eso es deliberado: una clave
de firma no debe distribuirse dentro del codigo y el binario debe compilarse y
probarse en el entorno de publicacion autorizado.
