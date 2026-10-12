/* RC ORDERA: fiscal USB permission preflight INSIDE the restaurant app.
 * Browser permission is NOT a fiscal connection: no port.open(), commands or printing.
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
  trigger.addEventListener("click",()=>{
    state=!auth()?9:!serial()?8:12;
    translate();
    if(!modal.open) modal.showModal();
  });
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
