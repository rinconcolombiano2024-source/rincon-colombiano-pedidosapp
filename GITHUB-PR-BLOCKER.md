# Publicación GitHub bloqueada por permiso de escritura

Rama local: codex/rc-ordera-v6-consolidada-verificada. Base main2730150506122ae59ba142ca1ba84ec820acb301; última V5fae1e3cc62eb792eb2ef67ea4de44ecf38d9f35f. GitHub read/fetch funciona; create_branch de esta operación devuelve403 Resource not accessible by integration. No hay rama remota ni PR. No es rechazo de revisión automática ni falta de autorización del usuario; falta permiso técnico de la conexión. No se tocó main.

GITHUB-BRANCH.patch contiene un commit de transferencia consolidado; la rama local conserva commits organizados. GITHUB-TRANSFER-RESULTS.json registra aplicación limpia y comparación de archivos, salvo siete metadatos de entrega enumerados. El ZIP refleja exactamente la rama local, incluidos estos metadatos finales.

En un clon limpio con escritura autorizada:

```bash
git fetch origin
git switch -c codex/rc-ordera-v6-consolidada-verificada 2730150506122ae59ba142ca1ba84ec820acb301
git am --keep-cr /ruta/GITHUB-BRANCH.patch
npm ci --ignore-scripts --no-audit --no-fund
npm run qa
npx playwright install chromium
RC_E2E_FULL_MATRIX=1 npm run qa:e2e
git push -u origin codex/rc-ordera-v6-consolidada-verificada
```

Abrir PR draft hacia main usando PULL-REQUEST.md. Si main avanzó, revisar/rebasar en rama independiente. No force-push a main ni aplicar migraciones de producción. Metadatos específicos del paquete pueden registrarse en commit separado, conservando el código comparado.
