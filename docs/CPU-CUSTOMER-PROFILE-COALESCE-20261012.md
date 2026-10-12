# RC ORDERA — Reducir lecturas duplicadas de perfiles Realtime (12 oct 2026)

## Hallazgo específico
`customerStartMenuRealtime` registraba una segunda suscripción a
`restaurant_profiles`, además de la suscripción de directorio existente.
Por cada evento de perfil, ejecutaba inmediatamente
`await customerLoadRestaurantDirectory({silent:true})`.
El circuito del directorio, entretanto, ya cuenta con su propia
agrupación fija de 5 segundos, pero ese handler la ignoraba.

## Corrección
El handler de perfil del menú sigue escuchando la misma tabla y conserva
el refresco del menú. Ahora pide la actualización del directorio mediante
`customerScheduleDirectoryRefresh()`, que agrupa eventos en una sola
consulta por ventana. El menú utiliza su propia ventana corta (1,2 s)
definida en PR #23. Si la página está oculta o fuera de línea no se
solicitan datos. Si se cambia de restaurante se ignoran eventos del anterior.

La lista/directorio puede reflejar la actualización tras su ventana de
5 segundos en lugar de recibir peticiones inmediatas; el pedido y el
checkout no cambian. El costo de decodificación WAL de Realtime no
desaparece con este parche y la CPU exacta todavía debe medirse en el
Dashboard de Supabase.

Pruebas: 1000 notificaciones de perfil en ambos archivos publicables,
seguimiento de dos ventanas, cambios de restaurante y modo oculto/offline.
No se tocaron tablas, RLS, pagos, datos comerciales, caja ni impresora fiscal.
