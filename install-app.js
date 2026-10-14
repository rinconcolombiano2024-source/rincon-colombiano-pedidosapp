/* Shared installation entry point for portal, customer and courier. No polling. */
(() => {
  'use strict';
  const button = document.querySelector('[data-install-app]');
  if (!button) return;
  const copy = {
    es: ['Descargar app', 'Instalar RC ORDERA', 'Android: abre el menú de Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio». iPhone/iPad: abre esta página en Safari, pulsa Compartir y «Añadir a pantalla de inicio». En ordenador, utiliza la opción Instalar del navegador, si está disponible.', 'Cerrar', 'La app ya está abierta en modo aplicación.', 'Instalación solicitada. Completa la confirmación del navegador.'],
    pl: ['Pobierz aplikację', 'Zainstaluj RC ORDERA', 'Android: otwórz menu Chrome i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”. iPhone/iPad: otwórz tę stronę w Safari, wybierz Udostępnij i „Dodaj do ekranu początkowego”. Na komputerze użyj opcji instalacji w przeglądarce, jeśli jest dostępna.', 'Zamknij', 'Aplikacja jest już otwarta w trybie aplikacji.', 'Wysłano prośbę o instalację. Dokończ potwierdzenie w przeglądarce.'],
    en: ['Download app', 'Install RC ORDERA', 'Android: open the Chrome menu and choose “Install app” or “Add to Home screen”. iPhone/iPad: open this page in Safari, tap Share and “Add to Home Screen”. On desktop, use the browser installation option, if available.', 'Close', 'The app is already open in app mode.', 'Installation requested. Complete the browser confirmation.']
  };
  const dialog = document.createElement('dialog');
  dialog.className = 'rc-install-dialog';dialog.setAttribute('data-no-auto-i18n','');
  dialog.setAttribute('aria-labelledby','rc-install-title');
  const title = document.createElement('h2');title.id = 'rc-install-title';
  const message = document.createElement('p');
  const close = document.createElement('button');close.type='button';close.className='rc-install-button';
  dialog.append(title,message,close);document.body.append(dialog);
  let deferred = null, busy = false, installed = false, messageIndex = 2;
  const installedCopy = {es:'Instalación completada. Abre RC ORDERA desde el icono de tu dispositivo.',pl:'Instalacja zakończona. Otwórz RC ORDERA za pomocą ikony na urządzeniu.',en:'Installation completed. Open RC ORDERA using its icon on your device.'};
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function render() {
    const texts = copy[document.documentElement.lang] || copy.es;
    for (const [element, text] of [[button,texts[0]],[title,texts[1]],[message,messageIndex === 6 ? installedCopy[document.documentElement.lang] || installedCopy.es : texts[messageIndex]],[close,texts[3]]]) {
      if(element.textContent !== text)element.textContent=text;
    }
  }
  function show(index) {messageIndex=index;render();if(!dialog.open)dialog.showModal();}
  close.addEventListener('click',()=>{dialog.close();button.focus();});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;});
  window.addEventListener('appinstalled',()=>{deferred=null;installed=true;if(dialog.open)show(6);});
  button.addEventListener('click',async()=>{
    if(busy)return;
    if(standalone()){show(4);return;}
    if(installed){show(6);return;}
    if(!deferred){show(2);return;}
    const prompt=deferred;deferred=null;busy=true;button.disabled=true;
    try {await prompt.prompt();const result=await prompt.userChoice;if(result?.outcome==='accepted')show(installed ? 6 : 5);}
    catch {show(2);}
    finally {busy=false;button.disabled=false;}
  });
  let renderVersionState = () => {};
  // User-initiated only: no polling, no cache deletion and no reload while working in POS.
  const versionButton = document.querySelector('[data-check-portal-version]');
  const versionStatus = document.querySelector('#portalVersionStatus');
  const currentRelease = document.documentElement.getAttribute('data-rc-release');
  if (versionButton && versionStatus && currentRelease) {
    const versionCopy = {
      es: {check:'Comprobar versión',checking:'Consultando versión publicada...',current:'Esta pantalla está actualizada.',outdated:'Hay una versión nueva. Pulsa el botón para abrirla; no se borrarán tus datos.',open:'Abrir versión nueva',error:'No se pudo verificar la versión. Comprueba internet e inténtalo de nuevo.'},
      pl: {check:'Sprawdź wersję',checking:'Sprawdzanie opublikowanej wersji...',current:'Ta strona jest aktualna.',outdated:'Dostępna jest nowa wersja. Kliknij, aby ją otworzyć; Twoje dane nie zostaną usunięte.',open:'Otwórz nową wersję',error:'Nie można sprawdzić wersji. Sprawdź połączenie internetowe i spróbuj ponownie.'},
      en: {check:'Check version',checking:'Checking published version...',current:'This page is up to date.',outdated:'A new version is available. Select to open it; your data will not be deleted.',open:'Open new version',error:'Could not verify the version. Check your connection and try again.'}
    };
    let phase='idle', targetRelease='';
    const strings=()=>versionCopy[document.documentElement.lang] || versionCopy.es;
    renderVersionState=()=>{
      const t=strings();
      versionButton.textContent=phase==='outdated'?t.open:t.check;
      versionStatus.hidden=phase==='idle';
      if (phase!=='idle') versionStatus.textContent=t[phase] || t.error;
    };
    versionButton.addEventListener('click',async()=>{
      if(phase==='outdated'){
        // Explicit navigation only from the public portal; never restart restaurant checkout.
        const next=new URL('./index.html',window.location.href);
        next.searchParams.set('rc_release',targetRelease);
        window.location.assign(next.toString());
        return;
      }
      if(versionButton.disabled)return;
      versionButton.disabled=true;phase='checking';renderVersionState();
      try{
        const marker=new URL('./rc-ordera-release.json',window.location.href);
        marker.searchParams.set('check',String(Date.now()));
        const response=await fetch(marker,{cache:'no-store',
          signal:typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?AbortSignal.timeout(10000):undefined});
        if(!response.ok)throw new Error('RELEASE_NOT_AVAILABLE');
        const info=await response.json();
        if(info?.app!=='RC ORDERA'||typeof info.release!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(info.release))throw new Error('INVALID_RELEASE');
        targetRelease=info.release;
        // Ask the browser for the current worker only on user action.
        if('serviceWorker' in navigator){
          const registration=await navigator.serviceWorker.getRegistration();
          if(registration)await registration.update().catch(()=>{});
        }
        phase=targetRelease===currentRelease?'current':'outdated';
      }catch{phase='error';}
      finally{versionButton.disabled=false;renderVersionState();}
    });
  }
  render();
  renderVersionState();
  // Observe only language changes, never the page subtree or a timer.
  new MutationObserver(()=>{render();renderVersionState();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.getRegistration().then(existing=>existing || navigator.serviceWorker.register('./service-worker.js')).catch(()=>{});
  }
})();
