# Decimocuarta mejora — redirecciones de comandos de reparto

Base remota: 5c0b1522a65612fa299cc82a90520507d2c5b54b. Rama codex/rc-ordera-fusion-v6, PR #1.

## Defecto y corrección

La cola de reparto usaba fetch con seguimiento automático de redirecciones. Un servidor local devolvió HTTP 307: antes de la corrección se observaron dos peticiones, a /command y /unexpected-target, y la regresión falló. Esto permite reenviar el cuerpo del comando a una ruta distinta de la generada por el adaptador.

Se añade redirect: error al transporte existente. Si se rechaza una redirección, el resultado pasa por el manejo de incertidumbre existente y queda UNKNOWN. No puede suponerse que el primer servidor no ejecutó el comando; no se reintenta automáticamente. Se conservan la reclamación atómica, la idempotencia, los plazos y la conciliación.

La prueba usa un servidor HTTP real en loopback, payload ficticio y la cola en modo simulación. Tras la corrección observa únicamente /command, estado UNKNOWN y ninguna nueva petición al ejecutar otro tick. No contacta APIs comerciales ni acredita integración oficial.

## Verificación y límites

- npm run qa: 431 pruebas aprobadas, cero fallidas; se repite desde el ZIP limpio. El resultado final y hash del ZIP constan en PR #1.
- npm run qa:integration: nueve pruebas omitidas por ausencia de Supabase TEST/cuentas. No aprobadas.
- Ambos CI de la revisión base finalizaron correctamente, incluyendo la matriz E2E configurada en móvil/tableta/escritorio. El CI del nuevo commit se consulta por separado.
- Benchmark diagnóstico: 100 consultas/200 nodos, 2000 traducciones, 0 escrituras de texto, 100 peticiones; muestra CPU Node 19351 microsegundos. Se mantienen contadores; una muestra temporal no acredita mejora ni degradación de CPU global.
- Sin cambios visuales ni de idiomas en esta revisión; regresiones ES/PL/EN siguen en la batería. No equivale a inspección visual manual completa ni prueba móvil física.

## Diez objetivos

Esta revisión fortalece reparto y seguridad (4 y 8). El resto conserva la evidencia previa; consultar docs/ESTADO-10-PUNTOS.md. Permanecen pendientes hardware POSNET, acceso oficial a proveedores, Stripe test y pruebas de Supabase con conexiones/roles reales. No se modifica main ni se despliega ni aplica SQL a producción.
