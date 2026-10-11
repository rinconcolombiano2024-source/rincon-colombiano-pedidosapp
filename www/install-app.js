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
  render();
  // Observe only language changes, never the page subtree or a timer.
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.getRegistration().then(existing=>existing || navigator.serviceWorker.register('./service-worker.js')).catch(()=>{});
  }
})();
