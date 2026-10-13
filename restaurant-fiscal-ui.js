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
  const ids = new Set(["openClientPageButton", "openWaiterLinkButton", "restaurantKitchenLink"]);
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
      const url = new URL(raw, window.location.href);
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
