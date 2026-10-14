/* RC ORDERA: fiscal USB permission preflight INSIDE the restaurant app.
 * Browser permission is NOT a fiscal connection: no opening a serial port, issuing commands or printing.
 */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const modal=el("fiscalPrinterDialog"), trigger=el("connectFiscalPrinterButton");
  const permit=el("fiscalRequestPortButton"), inspect=el("fiscalCheckPortButton");
  const status=el("fiscalDeviceStatus"), summary=el("fiscalPrinterSummary");
  if (!modal || !trigger || !permit || !inspect || !status || !summary) return;
  const messages = {
    es: ["Conectar impresora fiscal", "Sin conexión fiscal verificada", "Dispositivo fiscal · RC ORDERA",
      "Autoriza un puerto desde la app. El permiso USB NO supone conexión fiscal.",
      "POSNET requiere modelo y protocolo oficial, agente local, mapa PTU validado y pruebas físicas; la emisión fiscal sigue bloqueada.",
      "Autorizar puerto USB/serie", "Revisar permisos", "Cerrar",
      "Web Serial no disponible: usa Chrome o Edge en ordenador con HTTPS. En Android hace falta un agente o integración nativa.",
      "Inicia sesión como restaurante para conectar dispositivos.",
      "Permiso USB autorizado; la impresora fiscal NO está verificada ni preparada para emitir comprobantes.",
      "Hay un puerto autorizado, pero la conexión fiscal NO está verificada.",
      "No hay puertos autorizados.", "Selección cancelada. No se modificó la configuración fiscal.",
      "No se pudo acceder al puerto. Comprueba los permisos y la conexión."],
    pl: ["Podłącz drukarkę fiskalną", "Brak zweryfikowanego połączenia fiskalnego", "Urządzenie fiskalne · RC ORDERA",
      "Zezwól na port w aplikacji. Uprawnienie USB NIE jest połączeniem fiskalnym.",
      "POSNET wymaga oficjalnego protokołu, lokalnego agenta, sprawdzonej mapy PTU i testów urządzenia. Fiskalizacja pozostaje zablokowana.",
      "Zezwól na port USB/szeregowy", "Sprawdź uprawnienia", "Zamknij",
      "Web Serial niedostępny: użyj Chrome lub Edge na komputerze z HTTPS. Android wymaga agenta lub integracji natywnej.",
      "Zaloguj się jako restauracja, aby połączyć urządzenia.",
      "Dostęp USB przyznany; drukarka fiskalna NIE jest zweryfikowana ani gotowa do wystawiania paragonów.",
      "Port ma uprawnienia, lecz połączenie fiskalne NIE jest zweryfikowane.",
      "Brak autoryzowanych portów.", "Anulowano wybór. Konfiguracja fiskalna bez zmian.",
      "Nie można uzyskać dostępu do portu. Sprawdź uprawnienia i połączenie."],
    en: ["Connect fiscal printer", "No verified fiscal connection", "Fiscal device · RC ORDERA",
      "Allow a port in the app. USB permission is NOT a fiscal connection.",
      "POSNET requires an official protocol, local agent, verified PTU tax mapping and hardware testing. Fiscal issuance remains blocked.",
      "Authorize USB/serial port", "Check permissions", "Close",
      "Web Serial unavailable: use desktop Chrome or Edge over HTTPS. Android needs a local agent or native integration.",
      "Sign in as a restaurant to connect devices.",
      "USB access granted; fiscal printer NOT verified or ready to issue receipts.",
      "A port has permission, but fiscal connection is NOT verified.",
      "No authorized ports.", "Selection cancelled. Fiscal configuration unchanged.",
      "Port access failed. Check permissions and connection."]
  };
  const keys=["connectFiscalPrinterButton","fiscalPrinterSummary","fiscalDialogTitle",
    "fiscalDialogDescription","fiscalDialogWarning","fiscalRequestPortButton",
    "fiscalCheckPortButton","fiscalCloseButton"];
  let state=12, busy=false;
  const lang=()=>["es","pl","en"].includes(document.documentElement.lang?.slice(0,2))
    ?document.documentElement.lang.slice(0,2):"es";
  const auth=()=>typeof cloudState!=="undefined" && Boolean(cloudState?.user?.id);
  const serial=()=>Boolean(window.isSecureContext && navigator.serial
    && typeof navigator.serial.getPorts==="function"
    && typeof navigator.serial.requestPort==="function");
  function translate() {
    const copy=messages[lang()];
    keys.forEach((id,i)=>{ const node=el(id); if(node) node.textContent=copy[i]; });
    if (el("openFiscalPrinterTopButton")) el("openFiscalPrinterTopButton").textContent = "🧾 " + copy[0];
    status.textContent=copy[state];
    summary.textContent=copy[1]; // Never claim fiscal connection from browser permission.
  }
  async function action(isNew) {
    if (busy) return;
    if (!auth()) {state=9;translate();return;}
    if (!serial()) {state=8;translate();return;}
    busy=true; permit.disabled=true;inspect.disabled=true;
    try {
      if (isNew) {
        const port=await navigator.serial.requestPort(); // User gesture. No data is sent.
        if (!port || typeof port.getInfo!=="function") throw new Error("INVALID_PORT");
        port.getInfo();
        state=10;
      } else {
        const ports=await navigator.serial.getPorts();
        state=Array.isArray(ports)&&ports.length>0?11:12;
      }
    } catch (error) {state=error?.name==="NotFoundError"?13:14;}
    finally {busy=false;permit.disabled=false;inspect.disabled=false;translate();}
  }
  function showFiscalDialog() {
    state=!auth()?9:!serial()?8:12;
    translate();
    if(!modal.open) modal.showModal();
  }
  trigger.addEventListener("click", showFiscalDialog);
  el("openFiscalPrinterTopButton")?.addEventListener("click", showFiscalDialog);
  permit.addEventListener("click",()=>{void action(true);});
  inspect.addEventListener("click",()=>{void action(false);});
  el("fiscalCloseButton")?.addEventListener("click",()=>modal.close());
  el("signOutButton")?.addEventListener("click",()=>{
    if(modal.open) modal.close();
    state=9;translate();
  });
  // Attribute-only observer: no timers, repeated network traffic or CPU polling.
  const observer=new MutationObserver(translate);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  window.addEventListener("pagehide",()=>observer.disconnect(),{once:true});
  state=serial()?12:8;
  translate();
})();

/*
 * Capacitor native module links. The regular HTML anchors continue opening
 * separate tabs on the web. Android uses the official Browser plugin so that
 * opening Cliente/Estaciones does not replace or terminate the POS WebView.
 * This independent bridge is bundled with the existing restaurant runtime.
 */
(() => {
  "use strict";
  const ids = new Set(["openClientPageButton", "openWaiterLinkButton", "restaurantKitchenLink", "restaurantStaffAccessLink"]);
  let opening = false;
  const translations = {
    es: {
      upgrade: "Actualiza la aplicación Android de RC ORDERA para abrir módulos sin cerrar el restaurante.",
      invalid: "El enlace al módulo no es válido. Vuelve a generar el enlace.",
      failed: "No se pudo abrir la ventana del módulo. El restaurante permanece abierto.",
    },
    pl: {
      upgrade: "Zaktualizuj aplikację RC ORDERA na Androidzie, aby otwierać moduły bez zamykania restauracji.",
      invalid: "Nieprawidłowy link do modułu. Wygeneruj link ponownie.",
      failed: "Nie można otworzyć modułu. Panel restauracji pozostaje otwarty.",
    },
    en: {
      upgrade: "Update the RC ORDERA Android app to open modules without closing the restaurant.",
      invalid: "The module link is invalid. Regenerate the link.",
      failed: "Could not open the module window. The restaurant remains open.",
    },
  };
  function notify(key) {
    const locale = document.documentElement.lang;
    const msg = (translations[locale] || translations.es)[key];
    const toast = document.getElementById("toastNotice");
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
  }
  function allowedUrl(raw) {
    if (!raw) return null;
    try {
      // Resolve relative module links against the deployed origin on native Android.
      // Capacitor serves local assets from a different origin, which must never
      // be passed to the external Browser plugin as a customer/station URL.
      const deployedOrigin = "https://rincon-colombiano-pedidosapp.vercel.app/";
      const base = window.Capacitor?.isNativePlatform?.() ? deployedOrigin : window.location.href;
      const url = new URL(raw, base);
      if (url.protocol !== "https:" ||
          url.hostname !== "rincon-colombiano-pedidosapp.vercel.app" ||
          url.port || url.username || url.password ||
          !["/cliente.html", "/mesero.html"].includes(url.pathname)) return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[id]");
    if (!anchor || !ids.has(anchor.id)) return;
    const capacitor = window.Capacitor;
    if (typeof capacitor?.isNativePlatform !== "function" ||
        !capacitor.isNativePlatform()) return; // Normal browser _blank links.
    if (event.defaultPrevented) return; // Auth and module checks run first.
    event.preventDefault(); // Never navigate the main native WebView.
    if (opening) return; // One external launch at a time.
    const url = allowedUrl(anchor.getAttribute("href"));
    if (!url) return notify("invalid");
    const browser = capacitor.Plugins?.Browser;
    if (typeof browser?.open !== "function") return notify("upgrade");
    opening = true;
    Promise.resolve().then(() => browser.open({ url }))
      .catch(() => notify("failed"))
      .finally(() => { opening = false; });
  });
})();

/* RC ORDERA: read-only menu publication audit.
 * One database read only when the owner explicitly clicks the button.
 * Never writes a product, updates its revision, clears a cache or modifies a cart.
 */
(() => {
  "use strict";
  const publishButton = document.getElementById("publishCurrentMenuButton");
  const publicationStatus = document.getElementById("menuPublicationStatus");
  if (!publishButton || !publicationStatus) return;
  const localize = {
    es: {
      action: "Comparar Cliente y Caja",
      loading: "Comparando menú local con el publicado…",
      noSession: "Inicia sesión como propietario para comprobar el menú público.",
      offline: "Sin conexión. Las descripciones locales no se han borrado.",
      changedSession: "Cambió la sesión. Vuelve a comparar antes de publicar.",
      failed: "No se pudo leer el menú público. Conserva los datos de este equipo.",
      summary: (l,r,lc,rc)=>`Este equipo: ${l} productos, ${lc} descripciones ES. Cliente y Caja: ${r} productos, ${rc} descripciones ES.`,
      synced: "Los productos y descripciones coinciden con la nube.",
      pending: n=>`Hay ${n} productos distintos o sin publicar. Usa «Publicar y verificar menú» desde este equipo para sincronizarlos.`,
      samples: n=>`Revisar: ${n}`,
      label: n=>`Revisión publicada: ${n}.`,
    },
    pl: {
      action: "Porównaj menu klienta i kasy",
      loading: "Porównywanie menu lokalnego z opublikowanym…",
      noSession: "Zaloguj się jako właściciel, aby sprawdzić menu publiczne.",
      offline: "Brak połączenia. Lokalne opisy nie zostały usunięte.",
      changedSession: "Sesja się zmieniła. Porównaj menu ponownie.",
      failed: "Nie udało się pobrać menu publicznego. Zachowaj dane na tym urządzeniu.",
      summary: (l,r,lc,rc)=>`To urządzenie: ${l} produktów, ${lc} opisów ES. Klient i kasa: ${r} produktów, ${rc} opisów ES.`,
      synced: "Produkty i opisy są zgodne z chmurą.",
      pending: n=>`${n} produktów jest innych lub nieopublikowanych. Użyj „Opublikuj i sprawdź menu” na tym urządzeniu.`,
      samples: n=>`Sprawdź: ${n}`,
      label: n=>`Opublikowana wersja: ${n}.`,
    },
    en: {
      action: "Compare Customer and Cashier",
      loading: "Comparing local menu with the published menu…",
      noSession: "Sign in as the owner to check the public menu.",
      offline: "Offline. Local descriptions have not been deleted.",
      changedSession: "Session changed. Compare the menu again.",
      failed: "Could not read the public menu. Keep this device's data.",
      summary: (l,r,lc,rc)=>`This device: ${l} products, ${lc} ES descriptions. Customer and Cashier: ${r} products, ${rc} ES descriptions.`,
      synced: "Products and descriptions match the cloud.",
      pending: n=>`${n} products differ or are not published. Use “Publish and verify menu” on this device.`,
      samples: n=>`Check: ${n}`,
      label: n=>`Published revision: ${n}.`,
    },
  };
  const button = document.createElement("button");
  button.type = "button";
  button.id = "compareMenuPublicationButton";
  const output = document.createElement("p");
  output.id = "menuPublicationAuditResult";
  output.setAttribute("role", "status");
  output.setAttribute("aria-live", "polite");
  output.style.whiteSpace = "pre-line";
  publicationStatus.insertAdjacentElement("afterend", output);
  publishButton.insertAdjacentElement("afterend", button);
  function t() {
    const lang = (document.documentElement.lang || "es").split("-")[0].toLowerCase();
    return localize[lang] || localize.es;
  }
  function updateButtonLanguage() { button.textContent = t().action; }
  updateButtonLanguage();
  const observer = typeof MutationObserver === "function"
    ? new MutationObserver(updateButtonLanguage) : null;
  observer?.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  window.addEventListener("pagehide",()=>observer?.disconnect(),{once:true});

  function snapshot(raw) {
    const entries = [];
    for (const [category, products] of Object.entries(raw || {})) {
      if (!Array.isArray(products)) continue;
      for (const p of products) {
        if (!p || typeof p !== "object") continue;
        const id = String(p.id || p.productId || "").trim();
        const base = p.translations?.es || {};
        const pl = p.translations?.pl || {};
        const en = p.translations?.en || {};
        entries.push({
          id,
          name: String(p.name || ""),
          description: String(p.description || base.description || "").trim(),
          signature: JSON.stringify([
            category, p.name || "", p.description || "", Number(p.price || 0),
            p.available !== false, String(p.station || ""),
            base.name || "", base.description || "", pl.name || "", pl.description || "",
            en.name || "", en.description || "", String(p.imageUrl || ""),
          ]),
        });
      }
    }
    return entries;
  }
  let running = false;
  async function compare() {
    if (running) return;
    const words = t();
    if (typeof cloudState === "undefined" || !cloudState.user?.id || !cloudState.client) {
      output.textContent = words.noSession;
      return;
    }
    if (!navigator.onLine) { output.textContent = words.offline; return; }
    running = true;
    button.disabled = true;
    output.textContent = words.loading;
    const id = cloudState.user.id;
    const client = cloudState.client;
    // Snapshot first. Edits made during the request remain untouched.
    const localBefore = snapshot(typeof menuCatalog === "undefined" ? {} : menuCatalog);
    try {
      const {data,error} = await client.from("restaurant_public_catalogs")
        .select("menu, menu_revision").eq("restaurant_user_id",id).maybeSingle();
      if (client !== cloudState.client || id !== cloudState.user?.id) {
        output.textContent = t().changedSession;
        return;
      }
      if (error || !data) throw error || new Error("PUBLIC_MENU_MISSING");
      const remote = snapshot(data.menu);
      const key = (p,i) => p.id || `no-id-${i}`;
      const published = new Map(remote.map((p,i)=>[key(p,i),p]));
      const localIds = new Set(localBefore.map(key));
      const mismatched = localBefore.filter((p,i)=> {
        const copy=published.get(key(p,i));
        return !copy || copy.signature !== p.signature;
      });
      const extra = remote.filter((p,i)=>!localIds.has(key(p,i)));
      const examples = [...mismatched,...extra].slice(0,5).map(p=>p.name).filter(Boolean);
      const totalDiff = mismatched.length+extra.length;
      const descriptionCount = list => list.filter(p=>p.description).length;
      const wordsNow = t();
      const sentences = [
        wordsNow.summary(localBefore.length,remote.length,descriptionCount(localBefore),descriptionCount(remote)),
        wordsNow.label(data.menu_revision),
        totalDiff ? wordsNow.pending(totalDiff) : wordsNow.synced,
      ];
      if (examples.length) sentences.push(wordsNow.samples(examples.join(", ")));
      output.textContent = sentences.join("\n");
    } catch (error) {
      console.error("[RC ORDERA] Menu publication read-only comparison:", error);
      output.textContent = t().failed;
    } finally {
      running = false;
      button.disabled = false;
    }
  }
  button.addEventListener("click",()=>{void compare();});
})();

/* RC ORDERA: non-destructive LOCAL menu backup and visible unpublished-menu warning.
 * No Supabase calls, timers, menu writes or implicit publication.
 */
(() => {
  "use strict";
  const section = document.getElementById("restaurantMenuSection");
  const publish = document.getElementById("publishCurrentMenuButton");
  if (!section || !publish) return;

  const copy = {
    es: {
      backup: "Descargar respaldo del menú de este equipo",
      ready: "Respaldo local descargado. No significa que el menú esté publicado.",
      empty: "No hay productos locales que respaldar. No se modificó el menú.",
      failed: "No se pudo descargar el respaldo. No borres los datos de este equipo.",
      warning: "MENÚ SIN PUBLICAR: hay cambios locales que Cliente y Caja podrían no ver. Conserva los datos de este equipo.",
      open: "Abrir menú y publicar",
    },
    pl: {
      backup: "Pobierz kopię menu z tego urządzenia",
      ready: "Pobrano kopię lokalną. To nie oznacza publikacji menu.",
      empty: "Brak lokalnych produktów do zapisania. Menu nie zostało zmienione.",
      failed: "Nie można pobrać kopii. Nie usuwaj danych z tego urządzenia.",
      warning: "NIEOPUBLIKOWANE MENU: zmiany lokalne mogą być niewidoczne dla klienta i kasy. Zachowaj dane na urządzeniu.",
      open: "Otwórz menu i opublikuj",
    },
    en: {
      backup: "Download this device's menu backup",
      ready: "Local backup downloaded. This does not confirm menu publication.",
      empty: "No local products to back up. The menu was not modified.",
      failed: "Could not download the backup. Do not erase this device's data.",
      warning: "UNPUBLISHED MENU: local changes may be missing for Customer and Cashier. Keep this device's data.",
      open: "Open menu and publish",
    },
  };
  function words() {
    const choice = String(document.documentElement.lang || "").split("-")[0].toLowerCase();
    return copy[choice] || copy.es;
  }

  const backup = document.createElement("button");
  backup.id = "backupLocalRestaurantMenuButton";
  backup.type = "button";
  backup.textContent = words().backup;
  backup.style.cssText = "border:1px solid #307c67;border-radius:12px;padding:11px 14px;cursor:pointer;background:#f0faf5;color:#164b3c;font-weight:700;";
  publish.insertAdjacentElement("afterend", backup);

  const feedback = document.createElement("p");
  feedback.id = "localMenuBackupResult";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  backup.insertAdjacentElement("afterend", feedback);

  const serviceBar = document.querySelector(".restaurant-service-bar");
  const alertBox = serviceBar ? document.createElement("section") : null;
  let openButton = null;
  if (alertBox) {
    alertBox.id = "unpublishedMenuWarning";
    alertBox.hidden = true;
    alertBox.setAttribute("role", "status");
    alertBox.setAttribute("aria-live", "polite");
    alertBox.style.cssText = "background:#fff4e0;color:#674210;border:1px solid #dbb46a;border-left:5px solid #dc8619;border-radius:14px;padding:14px 16px;margin:12px 0;display:flex;flex-wrap:wrap;align-items:center;gap:12px;";
    const label = document.createElement("strong");
    label.id = "unpublishedMenuWarningText";
    label.style.cssText = "flex:1 1 220px;line-height:1.45;";
    openButton = document.createElement("button");
    openButton.type = "button";
    openButton.id = "unpublishedMenuOpenButton";
    openButton.style.cssText = "border:0;border-radius:10px;padding:10px 13px;background:#205b43;color:#fff;font-weight:700;cursor:pointer;";
    alertBox.append(label, openButton);
    serviceBar.insertAdjacentElement("afterend", alertBox);
    openButton.addEventListener("click", () => {
      if (typeof openMenuEditor !== "function" ||
          typeof showRestaurantEditSection !== "function") return;
      openMenuEditor();
      showRestaurantEditSection("restaurant-menu");
    });
  }

  function refresh() {
    backup.textContent = words().backup;
    if (alertBox) {
      const pending = typeof hasPendingMenu === "function" && hasPendingMenu();
      alertBox.hidden = !pending;
      alertBox.style.display = pending ? "flex" : "none";
      document.getElementById("unpublishedMenuWarningText").textContent = words().warning;
      openButton.textContent = words().open;
    }
  }

  backup.addEventListener("click", () => {
    // Snapshot only; never call saveMenuCatalog/saveCloudMenu or clear pending.
    try {
      const current = typeof menuCatalog !== "undefined" ? menuCatalog : null;
      if (!current || typeof current !== "object" ||
          !Object.values(current).some(products => Array.isArray(products) && products.length > 0)) {
        feedback.textContent = words().empty;
        return;
      }
      const snapshot = JSON.parse(JSON.stringify(current));
      const payload = {
        format: "RC_ORDERA_LOCAL_MENU_BACKUP_V1",
        exportedAt: new Date().toISOString(),
        publicationVerified: false,
        menu: snapshot,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.download = "rc-ordera-menu-respaldo-" + payload.exportedAt.slice(0, 10) + ".json";
        link.href = href;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        feedback.textContent = words().ready;
      } finally {
        // Reclaim the object URL without adding background polling.
        window.setTimeout(() => URL.revokeObjectURL(href), 30000);
      }
    } catch (error) {
      console.error("[RC ORDERA] Local menu backup failed:", error);
      feedback.textContent = words().failed;
    }
  });

  const cloudLabel = document.getElementById("cloudStatus");
  const statusObserver = cloudLabel && typeof MutationObserver === "function"
    ? new MutationObserver(refresh) : null;
  statusObserver?.observe(cloudLabel, {childList: true, subtree: true, characterData: true});
  const languageObserver = typeof MutationObserver === "function"
    ? new MutationObserver(refresh) : null;
  languageObserver?.observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pageshow", refresh);
  window.addEventListener("pagehide", () => {
    statusObserver?.disconnect();
    languageObserver?.disconnect();
    document.removeEventListener("visibilitychange", refresh);
  }, {once: true});
  refresh();
})();
