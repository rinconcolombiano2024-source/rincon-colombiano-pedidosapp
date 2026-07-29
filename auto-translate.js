(function () {
  const LANGUAGE_KEY = "rincon_colombiano_app_language";
  const SUPPORTED = {
    es: "Espanol",
    pl: "Polski",
    en: "English",
  };
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const translationCacheKey = "rincon_colombiano_ui_translations_v1";
  let language = initialLanguage();
  let renderTimer = null;
  let translating = false;
  let cache = readCache();

  const dictionary = {
    pl: {
      "Idioma": "Jezyk",
      "Plataforma de pedidos": "Platforma zamowien",
      "Entorno de colaborador": "Panel kuriera",
      "Gestiona tu solicitud, disponibilidad y entregas asignadas.": "Zarzadzaj wnioskiem, dostepnoscia i przypisanymi dostawami.",
      "Colaborador: tu comida favorita, cerca de ti. Gestiona tu solicitud, disponibilidad y entregas asignadas.": "Kurier: Twoje ulubione jedzenie blisko Ciebie. Zarzadzaj wnioskiem, dostepnoscia i przypisanymi dostawami.",
      "App de prueba: el colaborador no recibe pedidos hasta que la administracion de la plataforma apruebe su perfil.": "Aplikacja testowa: kurier nie otrzyma zamowien, dopoki administracja platformy nie zatwierdzi profilu.",
      "Completa tus datos para revision.": "Uzupelnij dane do weryfikacji.",
      "Sin enviar": "Nie wyslano",
      "Acceso plataforma": "Dostep do platformy",
      "Solicitudes": "Wnioski",
      "Revision de colaboradores": "Weryfikacja kurierow",
      "Restaurante": "Restauracja",
      "Cliente": "Klient",
      "Colaborador": "Kurier",
      "Iniciar sesion como restaurante": "Zaloguj jako restauracja",
      "Registrarse como restaurante": "Zarejestruj restauracje",
      "Iniciar sesion como cliente": "Zaloguj jako klient",
      "Registrarse como cliente": "Zarejestruj jako klient",
      "Iniciar sesion como colaborador": "Zaloguj jako kurier",
      "Registrarse como colaborador": "Zarejestruj jako kurier",
      "Iniciar sesion": "Zaloguj",
      "Inicia sesion o crea una cuenta para enviar tu solicitud.": "Zaloguj sie albo utworz konto, aby wyslac wniosek.",
      "Crear cuenta": "Utworz konto",
      "Cerrar sesion": "Wyloguj",
      "Recuperar contrasena": "Odzyskaj haslo",
      "Reenviar verificacion": "Wyslij weryfikacje ponownie",
      "Correo electronico": "Email",
      "Contrasena": "Haslo",
      "Nombre": "Imie",
      "Apellidos": "Nazwisko",
      "Telefono": "Telefon",
      "Numero de contacto": "Numer telefonu",
      "Pais": "Kraj",
      "Ciudad": "Miasto",
      "Direccion": "Adres",
      "Direccion completa": "Pelny adres",
      "Guardar": "Zapisz",
      "Cancelar": "Anuluj",
      "Actualizar": "Odswiez",
      "Enviar solicitud": "Wyslij wniosek",
      "Disponible": "Dostepny",
      "Desconectado": "Offline",
      "Compartir ubicacion actual": "Udostepnij aktualna lokalizacje",
      "Abrir GPS": "Otworz GPS",
      "Actualizar pedidos": "Odswiez zamowienia",
      "Llegue al restaurante": "Dotarlem do restauracji",
      "Pedido recogido": "Zamowienie odebrane",
      "Llegue al cliente": "Dotarlem do klienta",
      "Pedido entregado": "Zamowienie dostarczone",
      "Aceptar": "Akceptuj",
      "Rechazar": "Odrzuc",
      "Panel": "Panel",
      "Solicitud": "Wniosek",
      "Acceso": "Dostep",
      "Tipo de vehiculo": "Typ pojazdu",
      "Bicicleta": "Rower",
      "Motocicleta": "Motocykl",
      "Automovil": "Samochod",
      "Documento de identidad": "Dokument tozsamosci",
      "Archivo documento de identidad": "Plik dokumentu tozsamosci",
      "Numero o referencia del documento": "Numer lub referencja dokumentu",
      "Foto": "Zdjecie",
      "Selfie de verificacion": "Selfie weryfikacyjne",
      "Permiso de trabajo": "Pozwolenie na prace",
      "Cuenta bancaria": "Konto bankowe",
      "IBAN o datos de pago": "IBAN lub dane platnosci",
      "Disponibilidad": "Dostepnosc",
      "Fecha de nacimiento": "Data urodzenia",
      "Matricula": "Numer rejestracyjny",
      "Licencia": "Prawo jazdy",
      "Archivo licencia": "Plik prawa jazdy",
      "Seguro": "Ubezpieczenie",
      "Archivo seguro": "Plik ubezpieczenia",
      "Seleccionar": "Wybierz",
      "Si aplica": "Jesli dotyczy",
      "No aplica para bicicleta": "Nie dotyczy roweru",
      "Minimo 6 caracteres": "Minimum 6 znakow",
      "Sin archivo subido": "Nie przeslano pliku",
      "Sin foto subida": "Nie przeslano zdjecia",
      "Sin selfie subida": "Nie przeslano selfie",
      "Otro": "Inny",
      "Pendiente de revision": "Oczekuje na weryfikacje",
      "Aprobado": "Zatwierdzony",
      "Borrador": "Szkic",
      "Rechazado": "Odrzucony",
      "Suspendido": "Zawieszony",
      "Inactivo": "Nieaktywny",
      "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o intenta de nuevo.": "Nie udalo sie zaladowac polaczenia Supabase. Sprawdz internet, odswiez strone albo sprobuj ponownie.",
      "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o prueba nuevamente.": "Nie udalo sie zaladowac polaczenia Supabase. Sprawdz internet, odswiez strone albo sprobuj ponownie.",
      "Bicicleta no requiere licencia. Envia documento, foto y selfie a pedidosapprinconcolombiano@gmail.com para revision.": "Rower nie wymaga prawa jazdy. Wyslij dokument, zdjecie i selfie na pedidosapprinconcolombiano@gmail.com do weryfikacji.",
      "Bicicleta: no requiere licencia. Motocicleta o automovil: requiere matricula, licencia y seguro.": "Rower: prawo jazdy nie jest wymagane. Motocykl lub samochod: wymagany numer rejestracyjny, prawo jazdy i ubezpieczenie.",
      "Sube los soportes desde la camara o archivos del dispositivo. Si algo falla, tambien puedes enviarlos a pedidosapprinconcolombiano@gmail.com para revision manual.": "Przeslij dokumenty z aparatu lub plikow urzadzenia. Jesli cos sie nie uda, mozesz tez wyslac je na pedidosapprinconcolombiano@gmail.com do recznej weryfikacji.",
      "Tu perfil debe ser aprobado antes de recibir pedidos.": "Twoj profil musi zostac zatwierdzony, zanim bedziesz otrzymywac zamowienia.",
      "Cuando tu perfil sea aprobado, podras recibir pedidos.": "Gdy profil zostanie zatwierdzony, bedziesz otrzymywac zamowienia.",
      "Inicia sesion para cargar colaboradores.": "Zaloguj sie, aby zaladowac kurierow.",
    },
    en: {
      "Idioma": "Language",
      "Plataforma de pedidos": "Ordering platform",
      "Entorno de colaborador": "Courier area",
      "Gestiona tu solicitud, disponibilidad y entregas asignadas.": "Manage your application, availability, and assigned deliveries.",
      "Colaborador: tu comida favorita, cerca de ti. Gestiona tu solicitud, disponibilidad y entregas asignadas.": "Courier: your favorite food, near you. Manage your application, availability, and assigned deliveries.",
      "App de prueba: el colaborador no recibe pedidos hasta que la administracion de la plataforma apruebe su perfil.": "Test app: the courier will not receive orders until platform administration approves the profile.",
      "Completa tus datos para revision.": "Complete your details for review.",
      "Sin enviar": "Not submitted",
      "Acceso plataforma": "Platform access",
      "Solicitudes": "Applications",
      "Revision de colaboradores": "Courier review",
      "Restaurante": "Restaurant",
      "Cliente": "Customer",
      "Colaborador": "Courier",
      "Iniciar sesion como restaurante": "Sign in as restaurant",
      "Registrarse como restaurante": "Register restaurant",
      "Iniciar sesion como cliente": "Sign in as customer",
      "Registrarse como cliente": "Register as customer",
      "Iniciar sesion como colaborador": "Sign in as courier",
      "Registrarse como colaborador": "Register as courier",
      "Iniciar sesion": "Sign in",
      "Inicia sesion o crea una cuenta para enviar tu solicitud.": "Sign in or create an account to submit your application.",
      "Crear cuenta": "Create account",
      "Cerrar sesion": "Sign out",
      "Recuperar contrasena": "Recover password",
      "Reenviar verificacion": "Resend verification",
      "Correo electronico": "Email",
      "Contrasena": "Password",
      "Nombre": "First name",
      "Apellidos": "Last name",
      "Telefono": "Phone",
      "Numero de contacto": "Contact number",
      "Pais": "Country",
      "Ciudad": "City",
      "Direccion": "Address",
      "Direccion completa": "Full address",
      "Guardar": "Save",
      "Cancelar": "Cancel",
      "Actualizar": "Refresh",
      "Enviar solicitud": "Submit application",
      "Disponible": "Available",
      "Desconectado": "Offline",
      "Compartir ubicacion actual": "Share current location",
      "Abrir GPS": "Open GPS",
      "Actualizar pedidos": "Refresh orders",
      "Llegue al restaurante": "Arrived at restaurant",
      "Pedido recogido": "Order picked up",
      "Llegue al cliente": "Arrived at customer",
      "Pedido entregado": "Order delivered",
      "Aceptar": "Accept",
      "Rechazar": "Reject",
      "Panel": "Dashboard",
      "Solicitud": "Application",
      "Acceso": "Access",
      "Tipo de vehiculo": "Vehicle type",
      "Bicicleta": "Bicycle",
      "Motocicleta": "Motorcycle",
      "Automovil": "Car",
      "Documento de identidad": "Identity document",
      "Archivo documento de identidad": "Identity document file",
      "Numero o referencia del documento": "Document number or reference",
      "Foto": "Photo",
      "Selfie de verificacion": "Verification selfie",
      "Permiso de trabajo": "Work permit",
      "Cuenta bancaria": "Bank account",
      "IBAN o datos de pago": "IBAN or payment details",
      "Disponibilidad": "Availability",
      "Fecha de nacimiento": "Birth date",
      "Matricula": "Vehicle plate",
      "Licencia": "License",
      "Archivo licencia": "License file",
      "Seguro": "Insurance",
      "Archivo seguro": "Insurance file",
      "Seleccionar": "Select",
      "Si aplica": "If applicable",
      "No aplica para bicicleta": "Not required for bicycle",
      "Minimo 6 caracteres": "Minimum 6 characters",
      "Sin archivo subido": "No file uploaded",
      "Sin foto subida": "No photo uploaded",
      "Sin selfie subida": "No selfie uploaded",
      "Otro": "Other",
      "Pendiente de revision": "Pending review",
      "Aprobado": "Approved",
      "Borrador": "Draft",
      "Rechazado": "Rejected",
      "Suspendido": "Suspended",
      "Inactivo": "Inactive",
      "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o intenta de nuevo.": "Could not load the Supabase connection. Check internet, refresh the page, or try again.",
      "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o prueba nuevamente.": "Could not load the Supabase connection. Check internet, refresh the page, or try again.",
      "Bicicleta no requiere licencia. Envia documento, foto y selfie a pedidosapprinconcolombiano@gmail.com para revision.": "Bicycle does not require a license. Send ID document, photo, and selfie to pedidosapprinconcolombiano@gmail.com for review.",
      "Bicicleta: no requiere licencia. Motocicleta o automovil: requiere matricula, licencia y seguro.": "Bicycle: no license required. Motorcycle or car: vehicle plate, license, and insurance required.",
      "Sube los soportes desde la camara o archivos del dispositivo. Si algo falla, tambien puedes enviarlos a pedidosapprinconcolombiano@gmail.com para revision manual.": "Upload documents from the camera or device files. If something fails, you can also send them to pedidosapprinconcolombiano@gmail.com for manual review.",
      "Tu perfil debe ser aprobado antes de recibir pedidos.": "Your profile must be approved before receiving orders.",
      "Cuando tu perfil sea aprobado, podras recibir pedidos.": "When your profile is approved, you will be able to receive orders.",
      "Inicia sesion para cargar colaboradores.": "Sign in to load couriers.",
    },
  };

  function initialLanguage() {
    const saved = String(localStorage.getItem(LANGUAGE_KEY) || localStorage.getItem("rincon_colombiano_customer_language") || "").toLowerCase();
    const browser = String(navigator.language || "").toLowerCase();
    if (SUPPORTED[saved]) return saved;
    if (browser.startsWith("pl")) return "pl";
    if (browser.startsWith("en")) return "en";
    return "es";
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(translationCacheKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCache() {
    try {
      const entries = Object.entries(cache).slice(-900);
      localStorage.setItem(translationCacheKey, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // La app sigue funcionando aunque el navegador limite almacenamiento.
    }
  }

  function normalize(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(
      element.closest(
        [
          "script",
          "style",
          "input",
          "textarea",
          ".print-ticket",
          ".line-items",
          ".menu-grid",
          ".history-list",
          ".product-list",
          ".editor-category-list",
          ".client-order-items",
          ".client-chat-messages",
          ".customer-menu-grid",
          ".customer-cart-items",
          ".customer-chat-messages",
          ".customer-restaurant-list",
          "#authBusinessName",
          "#appBusinessName",
          "#customerBusinessName",
          "[data-no-auto-i18n]",
        ].join(",")
      )
    );
  }

  function shouldSkipAttributeElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(
      element.closest(
        [
          "script",
          "style",
          ".print-ticket",
          ".line-items",
          ".menu-grid",
          ".history-list",
          ".product-list",
          ".editor-category-list",
          ".client-order-items",
          ".client-chat-messages",
          ".customer-menu-grid",
          ".customer-cart-items",
          ".customer-chat-messages",
          ".customer-restaurant-list",
          "#authBusinessName",
          "#appBusinessName",
          "#customerBusinessName",
          "[data-no-auto-i18n]",
        ].join(",")
      )
    );
  }

  function cacheKey(targetLanguage, text) {
    return `${targetLanguage}|${text}`;
  }

  function dictionaryTranslation(text, targetLanguage) {
    const clean = normalize(text);
    return dictionary[targetLanguage]?.[clean] || "";
  }

  async function fetchTranslation(text, targetLanguage) {
    const clean = normalize(text);
    if (!clean || targetLanguage === "es" || clean.length > 220 || !navigator.onLine) return clean;
    const direct = dictionaryTranslation(clean, targetLanguage);
    if (direct) return direct;
    const key = cacheKey(targetLanguage, clean);
    if (cache[key]) return cache[key];
    if (!window.RINCON_ENABLE_EXTERNAL_UI_TRANSLATION) return clean;

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${encodeURIComponent(
      targetLanguage
    )}&dt=t&q=${encodeURIComponent(clean)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("translation unavailable");
    const data = await response.json();
    const translated = normalize((data?.[0] || []).map((part) => part?.[0] || "").join(""));
    if (translated && translated.toLowerCase() !== clean.toLowerCase()) {
      cache[key] = translated;
      saveCache();
      return translated;
    }
    return clean;
  }

  function setOriginalAttribute(element, attribute) {
    let values = originalAttributes.get(element);
    if (!values) {
      values = {};
      originalAttributes.set(element, values);
    }
    const current = element.getAttribute(attribute) || "";
    const state = values[attribute];
    if (!state || (normalize(current) !== normalize(state.source) && normalize(current) !== normalize(state.last))) {
      values[attribute] = { source: current, last: "" };
    }
    return values[attribute];
  }

  async function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;
    const clean = normalize(node.nodeValue);
    if (!clean || /^\d+([:.,]\d+)?$/.test(clean)) return;
    const state = originalText.get(node);
    if (!state || (clean !== normalize(state.source) && clean !== normalize(state.last))) {
      originalText.set(node, { source: node.nodeValue, last: "" });
    }
    const latestState = originalText.get(node);
    const translated = language === "es" ? latestState.source : await fetchTranslation(latestState.source, language);
    latestState.last = translated;
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  async function translateAttributes(element) {
    if (shouldSkipAttributeElement(element)) return;
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      if (!element.hasAttribute(attribute)) continue;
      const state = setOriginalAttribute(element, attribute);
      const translated = language === "es" ? state.source : await fetchTranslation(state.source, language);
      state.last = translated;
      if (element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
    }
  }

  async function translateTree(root = document.body) {
    if (!root || translating) return;
    translating = true;
    document.documentElement.lang = language;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || shouldSkipElement(parent) || !normalize(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) await translateTextNode(node);
      const elements = root.querySelectorAll ? root.querySelectorAll("[placeholder], [title], [aria-label]") : [];
      for (const element of elements) await translateAttributes(element);
    } catch {
      // Si la traduccion externa falla, se conserva el texto original.
    } finally {
      translating = false;
    }
  }

  function scheduleTranslate() {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => translateTree(), 180);
  }

  function createLanguageControl() {
    const existingSelect = document.querySelector("#autoLanguageSelect");
    if (existingSelect) {
      existingSelect.value = language;
      existingSelect.addEventListener("change", () => {
        language = existingSelect.value;
        localStorage.setItem(LANGUAGE_KEY, language);
        localStorage.setItem("rincon_colombiano_customer_language", language);
        translateTree();
      });
      return;
    }
    if (document.querySelector("#customerLanguageSelect")) return;
    const label = document.createElement("label");
    label.className = "app-language-floating";
    label.innerHTML = `
      <span>Idioma</span>
      <select id="autoLanguageSelect">
        ${Object.entries(SUPPORTED)
          .map(([code, labelText]) => `<option value="${code}">${labelText}</option>`)
          .join("")}
      </select>
    `;
    document.body.appendChild(label);
    const select = label.querySelector("select");
    select.value = language;
    select.addEventListener("change", () => {
      language = select.value;
      localStorage.setItem(LANGUAGE_KEY, language);
      localStorage.setItem("rincon_colombiano_customer_language", language);
      translateTree();
    });
  }

  window.RinconAutoTranslate = {
    setLanguage(nextLanguage) {
      if (!SUPPORTED[nextLanguage]) return;
      language = nextLanguage;
      localStorage.setItem(LANGUAGE_KEY, language);
      scheduleTranslate();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      createLanguageControl();
      translateTree();
    });
  } else {
    createLanguageControl();
    translateTree();
  }

  const observer = new MutationObserver(scheduleTranslate);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
