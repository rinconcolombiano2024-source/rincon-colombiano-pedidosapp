const CUSTOMER_DEFAULT_MENU = {
  Entradas: [],
};

const customerElements = {
  languageSelect: document.querySelector("#customerLanguageSelect"),
  status: document.querySelector("#customerStatus"),
  trackingStatus: document.querySelector("#customerTrackingStatus"),
  businessLogo: document.querySelector("#customerBusinessLogo"),
  businessName: document.querySelector("#customerBusinessName"),
  accountSummary: document.querySelector("#customerAccountSummary"),
  authFields: document.querySelector("#customerAuthFields"),
  authEmail: document.querySelector("#customerAuthEmail"),
  authPassword: document.querySelector("#customerAuthPassword"),
  registerNameInput: document.querySelector("#customerRegisterNameInput"),
  registerPhoneInput: document.querySelector("#customerRegisterPhoneInput"),
  registerAddressInput: document.querySelector("#customerRegisterAddressInput"),
  registerNeighborhoodInput: document.querySelector("#customerRegisterNeighborhoodInput"),
  registerReferenceInput: document.querySelector("#customerRegisterReferenceInput"),
  privacyConsentInput: document.querySelector("#customerPrivacyConsentInput"),
  authMessage: document.querySelector("#customerAuthMessage"),
  signInButton: document.querySelector("#customerSignInButton"),
  signUpButton: document.querySelector("#customerSignUpButton"),
  signOutButton: document.querySelector("#customerSignOutButton"),
  restaurantPanel: document.querySelector("#customerRestaurantPanel"),
  selectedRestaurantText: document.querySelector("#customerSelectedRestaurantText"),
  restaurantSearchInput: document.querySelector("#customerRestaurantSearchInput"),
  restaurantList: document.querySelector("#customerRestaurantList"),
  refreshRestaurantsButton: document.querySelector("#customerRefreshRestaurantsButton"),
  historyList: document.querySelector("#customerHistoryList"),
  refreshHistoryButton: document.querySelector("#customerRefreshHistoryButton"),
  refreshMenuButton: document.querySelector("#customerRefreshMenuButton"),
  tableLabel: document.querySelector("#customerTableLabel"),
  categoryTabs: document.querySelector("#customerCategoryTabs"),
  menuSearchInput: document.querySelector("#customerMenuSearchInput"),
  menuSearchClearButton: document.querySelector("#customerMenuSearchClearButton"),
  menuGrid: document.querySelector("#customerMenuGrid"),
  cartItems: document.querySelector("#customerCartItems"),
  cartTotal: document.querySelector("#customerCartTotal"),
  notifyButton: document.querySelector("#customerNotifyButton"),
  orderType: document.querySelector("#customerOrderType"),
  paymentMethod: document.querySelector("#customerPaymentMethod"),
  nameInput: document.querySelector("#customerNameInput"),
  tableInput: document.querySelector("#customerTableInput"),
  deliveryFields: document.querySelector("#customerDeliveryFields"),
  phoneInput: document.querySelector("#customerPhoneInput"),
  addressInput: document.querySelector("#customerAddressInput"),
  neighborhoodInput: document.querySelector("#customerNeighborhoodInput"),
  referenceInput: document.querySelector("#customerReferenceInput"),
  distanceInput: document.querySelector("#customerDistanceInput"),
  useLocationButton: document.querySelector("#customerUseLocationButton"),
  calculateDistanceButton: document.querySelector("#customerCalculateDistanceButton"),
  mapResult: document.querySelector("#customerMapResult"),
  notesInput: document.querySelector("#customerOrderNotes"),
  deliveryFeeRow: document.querySelector("#customerDeliveryFeeRow"),
  deliveryFeeLabel: document.querySelector("#customerDeliveryFeeLabel"),
  paymentBox: document.querySelector("#customerPaymentBox"),
  chatPanel: document.querySelector("#customerChatPanel"),
  chatMessages: document.querySelector("#customerChatMessages"),
  chatInput: document.querySelector("#customerChatInput"),
  chatImageInput: document.querySelector("#customerChatImageInput"),
  chatSendButton: document.querySelector("#customerSendChatButton"),
  chatStatus: document.querySelector("#customerChatStatus"),
  sendButton: document.querySelector("#sendCustomerOrderButton"),
};

const CUSTOMER_LANGUAGE_KEY = "rincon_colombiano_customer_language";
const CUSTOMER_I18N = {
  es: {
    heroEyebrow: "Pedido del cliente",
    languageLabel: "Idioma",
    refreshMenu: "Actualizar menu",
    refreshingMenu: "Actualizando menu...",
    menuUpdated: "Menu actualizado.",
    heroSubtitle: "Escanea, elige y envia tu pedido.",
    warning: "App de prueba: si algo sale diferente, el restaurante confirmara el pedido y cualquier ajuste antes de prepararlo.",
    legalNotice: "Usamos los datos que escribes para crear tu cuenta, preparar el pedido, entregarlo, guardar historial y responder por chat. La app usa cookies tecnicas/localStorage para mantener sesion, idioma, carrito y funcionamiento.",
    accountPanelAria: "Cuenta del cliente",
    accountTitle: "Mi cuenta",
    accountGuest: "Inicia sesion o crea una cuenta para enviar pedidos y ver tu historial.",
    accountSignedIn: "Conectado como {email}. Tus pedidos quedaran guardados en tu historial.",
    restaurantPanelAria: "Elegir restaurante",
    restaurantTitle: "Elegir restaurante",
    restaurantHelp: "Busca el restaurante donde quieres hacer tu pedido.",
    restaurantSelected: "Restaurante seleccionado: {name}. Ya puedes revisar el menu y enviar tu pedido.",
    restaurantSearchLabel: "Buscar restaurante",
    restaurantSearchPlaceholder: "Nombre, ciudad o direccion",
    restaurantRefresh: "Actualizar restaurantes",
    restaurantLoading: "Cargando restaurantes...",
    restaurantEmpty: "Todavia no hay restaurantes publicados.",
    restaurantSearchEmpty: "No encontre restaurantes con \"{query}\".",
    restaurantLoadError: "No se pudieron cargar restaurantes. Ejecuta el SQL actualizado o revisa internet.",
    restaurantChoose: "Elegir",
    restaurantCurrent: "Seleccionado",
    restaurantChooseFirst: "Elige un restaurante para ver su menu.",
    restaurantNoAddress: "Direccion no publicada",
    emailLabel: "Correo electronico",
    emailPlaceholder: "correo@ejemplo.com",
    passwordLabel: "Contrasena",
    passwordPlaceholder: "Minimo 6 caracteres",
    registerNameLabel: "Nombre completo para registro",
    registerNamePlaceholder: "Nombre y apellido",
    registerPhoneLabel: "Telefono de registro",
    registerAddressLabel: "Direccion de registro",
    registerNeighborhoodLabel: "Barrio / ciudad de registro",
    registerReferenceLabel: "Referencia de direccion",
    privacyConsent: "Acepto el tratamiento de mis datos para gestionar pedidos, historial, entrega, chat y cookies tecnicas necesarias.",
    signIn: "Iniciar sesion",
    signUp: "Crear cuenta cliente",
    signOut: "Cerrar sesion",
    signingIn: "Iniciando sesion...",
    signingUp: "Creando cuenta...",
    signedIn: "Sesion iniciada.",
    signedOut: "Sesion cerrada.",
    accountCreated: "Cuenta creada. Revisa tu correo electronico para confirmar la cuenta antes de iniciar sesion.",
    accountRequired: "Inicia sesion o crea una cuenta para enviar el pedido y guardar tu historial.",
    authMissing: "Escribe correo y contrasena.",
    authPasswordShort: "La contrasena debe tener minimo 6 caracteres.",
    authError: "No se pudo completar el acceso.",
    authInvalidCredentials: "Correo o contrasena incorrectos.",
    authEmailConfirm: "Confirma tu correo electronico antes de iniciar sesion.",
    authAlreadyRegistered: "Ese correo ya tiene cuenta. Intenta iniciar sesion.",
    privacyRequired: "Acepta el tratamiento de datos para crear la cuenta.",
    historyPanelAria: "Historial del cliente",
    historyTitle: "Mis pedidos",
    refreshHistory: "Actualizar",
    historySignIn: "Inicia sesion para ver tus pedidos anteriores.",
    historyEmpty: "Todavia no tienes pedidos guardados.",
    historyLoadError: "No se pudo cargar el historial. Ejecuta el SQL actualizado.",
    historyOpenOrder: "Ver estado y chat",
    historyTicket: "Ticket",
    historyNoTicket: "Sin ticket",
    historyItems: "{count} producto(s)",
    loadingMenu: "Cargando menu...",
    menuPanelAria: "Menu del restaurante",
    searchLabel: "Buscar producto",
    searchPlaceholder: "Ej: bandeja paisa",
    searchClear: "Limpiar",
    searchEmpty: "No encontre productos con \"{query}\".",
    cartPanelAria: "Pedido del cliente",
    yourOrder: "Tu pedido",
    enableNotifications: "Activar notificaciones",
    orderTypeLabel: "Tipo de pedido",
    eatHere: "Comer en el punto",
    pickup: "Para llevar / recoger en el punto",
    delivery: "Envio a domicilio",
    nameLabel: "Nombre",
    namePlaceholder: "Tu nombre",
    tableLabel: "Mesa / ubicacion",
    tablePlaceholder: "Mesa, punto de entrega o ubicacion",
    deliveryTablePlaceholder: "Nombre del barrio o punto de referencia",
    paymentMethodLabel: "Metodo de pago",
    cash: "Efectivo",
    transfer: "Transferencia",
    cardTerminal: "Datafono / tarjeta al recibir",
    phoneLabel: "Telefono",
    phonePlaceholder: "Numero de contacto",
    addressLabel: "Direccion completa",
    addressPlaceholder: "Calle, numero, apartamento",
    neighborhoodLabel: "Barrio / ciudad",
    neighborhoodPlaceholder: "Barrio o ciudad",
    referenceLabel: "Referencia",
    referencePlaceholder: "Piso, timbre, instrucciones",
    distanceLabel: "Distancia aproximada km",
    distancePlaceholder: "Ej: 3.4",
    useLocation: "Usar mi ubicacion",
    calculateMaps: "Calcular con Google Maps",
    deliveryHelp: "Domicilio: minimo configurado por el restaurante; si la distancia supera ese valor, se calcula por tramos con Google Maps o km aproximados.",
    kitchenNotesLabel: "Notas para cocina",
    kitchenNotesPlaceholder: "Ej: sin cebolla, salsa aparte...",
    estimatedTotal: "Total estimado",
    estimatedDelivery: "Domicilio estimado",
    chatTitle: "Chat con el restaurante",
    chatMessageLabel: "Mensaje",
    chatPlaceholder: "Escribe aqui. Puedes enviar comprobante de transferencia.",
    imageLabel: "Imagen",
    sendChat: "Enviar chat",
    sendOrder: "Enviar pedido",
    missingStore: "Falta el codigo del restaurante en el QR.",
    appNotConfigured: "La conexion de la app no esta configurada.",
    menuLoadError: "No se pudo cargar el menu. Avisa al restaurante.",
    noMenu: "Este QR no tiene menu disponible.",
    menuReady: "Menu listo. Elige tus productos.",
    menuRealtimeConnecting: "Sincronizando menu en vivo...",
    menuRealtimeUpdated: "Menu actualizado automaticamente.",
    menuRealtimeError: "No pude actualizar el menu en vivo. Usa Actualizar menu.",
    openMenuError: "No se pudo abrir el menu del restaurante.",
    orderFor: "Pedido para {table}",
    emptyCategory: "No hay productos en esta categoria.",
    emptyCart: "Agrega productos del menu.",
    unavailable: "No disponible",
    remove: "Quitar",
    itemNotePlaceholder: "NOTA PARA ESTE PLATO",
    noConnection: "No hay conexion con el restaurante.",
    addProductFirst: "Agrega al menos un producto.",
    sendingOrder: "Enviando pedido...",
    sendOrderError: "No se pudo enviar. Revisa internet o avisa al restaurante.",
    orderSent: "Pedido enviado. Espera confirmacion del restaurante.",
    orderSentWaiting: "Pedido enviado. Esperando que el restaurante lo acepte.",
    orderSentCashier: "Pedido enviado. El restaurante confirmara el estado en caja.",
    accepted: "Pedido aceptado por el restaurante.{ticket}",
    sent: "Pedido enviado por el restaurante.{ticket}",
    delivered: "Pedido entregado. Gracias por tu compra.{ticket}",
    cancelled: "Pedido cancelado. Comunicate con el restaurante para confirmar.",
    ticketSuffix: " Ticket #{ticket}.",
    registerNameRequired: "Escribe tu nombre completo para crear la cuenta.",
    nameRequired: "Escribe tu nombre para enviar el pedido.",
    phoneRequired: "Escribe un telefono para el domicilio.",
    addressRequired: "Escribe la direccion completa para el domicilio.",
    distanceRequired: "Escribe la distancia aproximada en kilometros para calcular el domicilio.",
    locationDeliveryOnly: "La ubicacion se usa solo para pedidos a domicilio.",
    locationUnsupported: "Este navegador no permite compartir ubicacion.",
    locationRequest: "Solicitando permiso de ubicacion...",
    locationReceived: "Ubicacion recibida. Intentando calcular distancia...",
    locationReceivedManual: "Ubicacion recibida. Para calcular automaticamente falta configurar Google Maps; tambien puedes escribir los kilometros manualmente.",
    locationAddressFilled: "Ubicacion recibida y direccion aproximada completada.",
    locationAddressUnavailable: "Ubicacion recibida. No pude convertirla en direccion, pero puedo calcular la distancia con coordenadas.",
    locationError: "No se pudo obtener la ubicacion. Puedes escribir la direccion y kilometros manualmente.",
    mapsNeedAddress: "El restaurante debe configurar su direccion para usar Google Maps.",
    mapsNeedKey: "Falta configurar Google Maps API key. Puedes escribir km manualmente.",
    mapsNeedDestination: "Escribe la direccion o permite usar tu ubicacion antes de calcular.",
    mapsCalculating: "Calculando distancia con Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Domicilio: {fee}",
    mapsManual: "{error} Puedes escribir km manualmente.",
    mapsFallback: "No se pudo calcular con Google Maps.",
    manualDistanceHelp: "Puedes escribir kilometros manualmente. Google Maps funciona cuando el restaurante configure la API key y direccion.",
    mapsLoadError: "No se pudo cargar Google Maps.",
    mapsResponseError: "Google Maps respondio: {status}",
    mapsRouteError: "No se pudo calcular ruta: {status}",
    paymentTitle: "Pago del pedido",
    totalLabel: "Total",
    referencePaymentLabel: "Referencia",
    bankAccountMissing: "Cuenta bancaria no configurada por el restaurante.",
    transferNoteDefault: "Usa la referencia del pedido en el comprobante.",
    bankAccountLabel: "Cuenta",
    transferNoteLabel: "Nota",
    payOnDelivery: "Paga {amount} en {method} cuando el restaurante confirme.",
    cashLower: "efectivo",
    cardLower: "datafono/tarjeta",
    notificationUnsupported: "Este navegador no permite notificaciones.",
    notificationsOn: "Notificaciones activadas para avisarte el estado del pedido.",
    notificationsOff: "Notificaciones no activadas. Puedes ver el estado en esta pantalla.",
    notificationEnableError: "No se pudieron activar las notificaciones.",
    notificationStatusTitle: "Estado de tu pedido",
    restaurantMessageTitle: "Mensaje del restaurante",
    restaurantMessageBody: "Tienes una respuesta en el chat del pedido.",
    chatEmpty: "Chat listo. Puedes enviar el comprobante o una pregunta.",
    restaurantSender: "Restaurante",
    customerSender: "Cliente",
    chatImageAlt: "Imagen enviada en chat",
    chatLoadError: "No se pudo cargar el chat. Ejecuta el SQL actualizado.",
    chatFirstOrder: "Primero envia el pedido para activar el chat.",
    chatNeedMessage: "Escribe un mensaje o selecciona una imagen.",
    chatSending: "Enviando chat...",
    chatSent: "Mensaje enviado.",
    chatSendError: "No se pudo enviar el mensaje.",
    imageInvalid: "Selecciona una imagen valida.",
    imageTooLarge: "La imagen es muy pesada. Usa una foto menor a 5 MB.",
    imageReadError: "No se pudo leer la imagen.",
    imagePrepareError: "No se pudo preparar la imagen.",
    imageStillLarge: "La imagen sigue muy pesada. Recorta la foto o baja la calidad.",
  },
  pl: {
    heroEyebrow: "Zamowienie klienta",
    languageLabel: "Jezyk",
    refreshMenu: "Odswiez menu",
    refreshingMenu: "Odswiezanie menu...",
    menuUpdated: "Menu zaktualizowane.",
    heroSubtitle: "Zeskanuj, wybierz i wyslij zamowienie.",
    warning: "Aplikacja testowa: jesli cos bedzie nie tak, restauracja potwierdzi zamowienie i korekty przed przygotowaniem.",
    legalNotice: "Uzywamy podanych danych do utworzenia konta, przygotowania zamowienia, dostawy, historii i czatu. Aplikacja uzywa technicznego localStorage/cookies do sesji, jezyka, koszyka i dzialania.",
    accountPanelAria: "Konto klienta",
    accountTitle: "Moje konto",
    accountGuest: "Zaloguj sie albo utworz konto, aby wysylac zamowienia i widziec historie.",
    accountSignedIn: "Zalogowano jako {email}. Twoje zamowienia beda zapisane w historii.",
    restaurantPanelAria: "Wybierz restauracje",
    restaurantTitle: "Wybierz restauracje",
    restaurantHelp: "Znajdz restauracje, w ktorej chcesz zlozyc zamowienie.",
    restaurantSelected: "Wybrana restauracja: {name}. Mozesz teraz zobaczyc menu i wyslac zamowienie.",
    restaurantSearchLabel: "Szukaj restauracji",
    restaurantSearchPlaceholder: "Nazwa, miasto lub adres",
    restaurantRefresh: "Odswiez restauracje",
    restaurantLoading: "Ladowanie restauracji...",
    restaurantEmpty: "Nie ma jeszcze opublikowanych restauracji.",
    restaurantSearchEmpty: "Nie znaleziono restauracji dla \"{query}\".",
    restaurantLoadError: "Nie udalo sie zaladowac restauracji. Wykonaj zaktualizowany SQL albo sprawdz internet.",
    restaurantChoose: "Wybierz",
    restaurantCurrent: "Wybrano",
    restaurantChooseFirst: "Wybierz restauracje, aby zobaczyc menu.",
    restaurantNoAddress: "Adres nieopublikowany",
    emailLabel: "E-mail",
    emailPlaceholder: "email@przyklad.com",
    passwordLabel: "Haslo",
    passwordPlaceholder: "Minimum 6 znakow",
    registerNameLabel: "Pelne imie i nazwisko do rejestracji",
    registerNamePlaceholder: "Imie i nazwisko",
    registerPhoneLabel: "Telefon do rejestracji",
    registerAddressLabel: "Adres do rejestracji",
    registerNeighborhoodLabel: "Dzielnica / miasto do rejestracji",
    registerReferenceLabel: "Wskazowki do adresu",
    privacyConsent: "Akceptuje przetwarzanie danych do obslugi zamowien, historii, dostawy, czatu i niezbednych cookies technicznych.",
    signIn: "Zaloguj",
    signUp: "Utworz konto klienta",
    signOut: "Wyloguj",
    signingIn: "Logowanie...",
    signingUp: "Tworzenie konta...",
    signedIn: "Zalogowano.",
    signedOut: "Wylogowano.",
    accountCreated: "Konto utworzone. Sprawdz e-mail i potwierdz konto przed logowaniem.",
    accountRequired: "Zaloguj sie albo utworz konto, aby wyslac zamowienie i zapisac historie.",
    authMissing: "Wpisz e-mail i haslo.",
    authPasswordShort: "Haslo musi miec minimum 6 znakow.",
    authError: "Nie udalo sie zakonczyc logowania.",
    authInvalidCredentials: "Nieprawidlowy e-mail lub haslo.",
    authEmailConfirm: "Potwierdz e-mail przed zalogowaniem.",
    authAlreadyRegistered: "Ten e-mail ma juz konto. Sprobuj sie zalogowac.",
    privacyRequired: "Zaakceptuj przetwarzanie danych, aby utworzyc konto.",
    historyPanelAria: "Historia klienta",
    historyTitle: "Moje zamowienia",
    refreshHistory: "Odswiez",
    historySignIn: "Zaloguj sie, aby zobaczyc poprzednie zamowienia.",
    historyEmpty: "Nie masz jeszcze zapisanych zamowien.",
    historyLoadError: "Nie udalo sie zaladowac historii. Wykonaj zaktualizowany SQL.",
    historyOpenOrder: "Zobacz status i czat",
    historyTicket: "Bilet",
    historyNoTicket: "Bez biletu",
    historyItems: "{count} produkt(y)",
    loadingMenu: "Ladowanie menu...",
    menuPanelAria: "Menu restauracji",
    searchLabel: "Szukaj produktu",
    searchPlaceholder: "Np. bandeja paisa",
    searchClear: "Wyczysc",
    searchEmpty: "Nie znaleziono produktu: \"{query}\".",
    cartPanelAria: "Zamowienie klienta",
    yourOrder: "Twoje zamowienie",
    enableNotifications: "Wlacz powiadomienia",
    orderTypeLabel: "Typ zamowienia",
    eatHere: "Na miejscu",
    pickup: "Na wynos / odbior w lokalu",
    delivery: "Dostawa",
    nameLabel: "Imie",
    namePlaceholder: "Twoje imie",
    tableLabel: "Stolik / lokalizacja",
    tablePlaceholder: "Stolik, punkt odbioru lub lokalizacja",
    deliveryTablePlaceholder: "Dzielnica lub punkt orientacyjny",
    paymentMethodLabel: "Metoda platnosci",
    cash: "Gotowka",
    transfer: "Przelew",
    cardTerminal: "Terminal / karta przy odbiorze",
    phoneLabel: "Telefon",
    phonePlaceholder: "Numer kontaktowy",
    addressLabel: "Pelny adres",
    addressPlaceholder: "Ulica, numer, mieszkanie",
    neighborhoodLabel: "Dzielnica / miasto",
    neighborhoodPlaceholder: "Dzielnica lub miasto",
    referenceLabel: "Wskazowki",
    referencePlaceholder: "Pietro, domofon, instrukcje",
    distanceLabel: "Przyblizona odleglosc km",
    distancePlaceholder: "Np. 3.4",
    useLocation: "Uzyj mojej lokalizacji",
    calculateMaps: "Oblicz w Google Maps",
    deliveryHelp: "Dostawa: obowiazuje minimum ustawione przez restauracje; jesli dystans przekracza ten koszt, cena liczona jest progami z Google Maps albo przyblizonych km.",
    kitchenNotesLabel: "Uwagi do kuchni",
    kitchenNotesPlaceholder: "Np. bez cebuli, sos osobno...",
    estimatedTotal: "Suma szacunkowa",
    estimatedDelivery: "Dostawa szacunkowa",
    chatTitle: "Czat z restauracja",
    chatMessageLabel: "Wiadomosc",
    chatPlaceholder: "Napisz tutaj. Mozesz wyslac potwierdzenie przelewu.",
    imageLabel: "Obraz",
    sendChat: "Wyslij czat",
    sendOrder: "Wyslij zamowienie",
    missingStore: "Brakuje kodu restauracji w QR.",
    appNotConfigured: "Polaczenie aplikacji nie jest skonfigurowane.",
    menuLoadError: "Nie udalo sie zaladowac menu. Powiadom restauracje.",
    noMenu: "Ten QR nie ma dostepnego menu.",
    menuReady: "Menu gotowe. Wybierz produkty.",
    menuRealtimeConnecting: "Synchronizacja menu na zywo...",
    menuRealtimeUpdated: "Menu zaktualizowane automatycznie.",
    menuRealtimeError: "Nie udalo sie zaktualizowac menu na zywo. Uzyj Odswiez menu.",
    openMenuError: "Nie udalo sie otworzyc menu restauracji.",
    orderFor: "Zamowienie dla {table}",
    emptyCategory: "Brak produktow w tej kategorii.",
    emptyCart: "Dodaj produkty z menu.",
    unavailable: "Niedostepne",
    remove: "Usun",
    itemNotePlaceholder: "UWAGA DO TEGO DANIA",
    noConnection: "Brak polaczenia z restauracja.",
    addProductFirst: "Dodaj przynajmniej jeden produkt.",
    sendingOrder: "Wysylanie zamowienia...",
    sendOrderError: "Nie udalo sie wyslac. Sprawdz internet albo powiadom restauracje.",
    orderSent: "Zamowienie wyslane. Poczekaj na potwierdzenie restauracji.",
    orderSentWaiting: "Zamowienie wyslane. Oczekiwanie na akceptacje restauracji.",
    orderSentCashier: "Zamowienie wyslane. Restauracja potwierdzi status w kasie.",
    accepted: "Zamowienie zaakceptowane przez restauracje.{ticket}",
    sent: "Zamowienie wyslane przez restauracje.{ticket}",
    delivered: "Zamowienie dostarczone. Dziekujemy za zakup.{ticket}",
    cancelled: "Zamowienie anulowane. Skontaktuj sie z restauracja, aby potwierdzic.",
    ticketSuffix: " Bilet #{ticket}.",
    registerNameRequired: "Wpisz pelne imie i nazwisko, aby utworzyc konto.",
    nameRequired: "Wpisz imie, aby wyslac zamowienie.",
    phoneRequired: "Wpisz telefon do dostawy.",
    addressRequired: "Wpisz pelny adres dostawy.",
    distanceRequired: "Wpisz przyblizona odleglosc w kilometrach, aby obliczyc dostawe.",
    locationDeliveryOnly: "Lokalizacja jest uzywana tylko dla dostawy.",
    locationUnsupported: "Ta przegladarka nie pozwala udostepnic lokalizacji.",
    locationRequest: "Prosba o pozwolenie na lokalizacje...",
    locationReceived: "Lokalizacja odebrana. Proba obliczenia odleglosci...",
    locationReceivedManual: "Lokalizacja odebrana. Aby obliczyc automatycznie, trzeba skonfigurowac Google Maps; mozna tez wpisac kilometry recznie.",
    locationAddressFilled: "Lokalizacja odebrana i przyblizony adres uzupelniony.",
    locationAddressUnavailable: "Lokalizacja odebrana. Nie udalo sie zamienic jej na adres, ale mozna liczyc dystans z koordynatow.",
    locationError: "Nie udalo sie pobrac lokalizacji. Mozesz wpisac adres i kilometry recznie.",
    mapsNeedAddress: "Restauracja musi skonfigurowac adres, aby uzyc Google Maps.",
    mapsNeedKey: "Brakuje klucza Google Maps API. Mozesz wpisac km recznie.",
    mapsNeedDestination: "Wpisz adres albo pozwol uzyc lokalizacji przed obliczeniem.",
    mapsCalculating: "Obliczanie odleglosci w Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Dostawa: {fee}",
    mapsManual: "{error} Mozesz wpisac km recznie.",
    mapsFallback: "Nie udalo sie obliczyc w Google Maps.",
    manualDistanceHelp: "Mozesz wpisac kilometry recznie. Google Maps dziala, gdy restauracja ustawi API key i adres.",
    mapsLoadError: "Nie udalo sie zaladowac Google Maps.",
    mapsResponseError: "Google Maps odpowiedzial: {status}",
    mapsRouteError: "Nie udalo sie obliczyc trasy: {status}",
    paymentTitle: "Platnosc za zamowienie",
    totalLabel: "Suma",
    referencePaymentLabel: "Referencja",
    bankAccountMissing: "Restauracja nie skonfigurowala konta bankowego.",
    transferNoteDefault: "Uzyj referencji zamowienia w potwierdzeniu.",
    bankAccountLabel: "Konto",
    transferNoteLabel: "Notatka",
    payOnDelivery: "Zapalc {amount} metoda {method}, gdy restauracja potwierdzi.",
    cashLower: "gotowka",
    cardLower: "terminal/karta",
    notificationUnsupported: "Ta przegladarka nie obsluguje powiadomien.",
    notificationsOn: "Powiadomienia wlaczone dla statusu zamowienia.",
    notificationsOff: "Powiadomienia nie sa wlaczone. Status widac na tej stronie.",
    notificationEnableError: "Nie udalo sie wlaczyc powiadomien.",
    notificationStatusTitle: "Status zamowienia",
    restaurantMessageTitle: "Wiadomosc z restauracji",
    restaurantMessageBody: "Masz odpowiedz w czacie zamowienia.",
    chatEmpty: "Czat gotowy. Mozesz wyslac potwierdzenie lub pytanie.",
    restaurantSender: "Restauracja",
    customerSender: "Klient",
    chatImageAlt: "Obraz wyslany w czacie",
    chatLoadError: "Nie udalo sie zaladowac czatu. Wykonaj zaktualizowany SQL.",
    chatFirstOrder: "Najpierw wyslij zamowienie, aby wlaczyc czat.",
    chatNeedMessage: "Napisz wiadomosc albo wybierz obraz.",
    chatSending: "Wysylanie czatu...",
    chatSent: "Wiadomosc wyslana.",
    chatSendError: "Nie udalo sie wyslac wiadomosci.",
    imageInvalid: "Wybierz poprawny obraz.",
    imageTooLarge: "Obraz jest za duzy. Uzyj zdjecia mniejszego niz 5 MB.",
    imageReadError: "Nie udalo sie odczytac obrazu.",
    imagePrepareError: "Nie udalo sie przygotowac obrazu.",
    imageStillLarge: "Obraz nadal jest za duzy. Przytnij zdjecie albo obniz jakosc.",
  },
  en: {
    heroEyebrow: "Customer order",
    languageLabel: "Language",
    refreshMenu: "Refresh menu",
    refreshingMenu: "Refreshing menu...",
    menuUpdated: "Menu updated.",
    heroSubtitle: "Scan, choose, and send your order.",
    warning: "Test app: if something is different, the restaurant will confirm the order and any adjustment before preparing it.",
    legalNotice: "We use the data you enter to create your account, prepare the order, deliver it, keep history, and answer by chat. The app uses technical cookies/localStorage for session, language, cart, and operation.",
    accountPanelAria: "Customer account",
    accountTitle: "My account",
    accountGuest: "Sign in or create an account to send orders and see your history.",
    accountSignedIn: "Signed in as {email}. Your orders will be saved in your history.",
    restaurantPanelAria: "Choose restaurant",
    restaurantTitle: "Choose restaurant",
    restaurantHelp: "Find the restaurant where you want to place your order.",
    restaurantSelected: "Selected restaurant: {name}. You can now review the menu and send your order.",
    restaurantSearchLabel: "Search restaurant",
    restaurantSearchPlaceholder: "Name, city, or address",
    restaurantRefresh: "Refresh restaurants",
    restaurantLoading: "Loading restaurants...",
    restaurantEmpty: "No restaurants have been published yet.",
    restaurantSearchEmpty: "No restaurants found for \"{query}\".",
    restaurantLoadError: "Could not load restaurants. Run the updated SQL or check internet.",
    restaurantChoose: "Choose",
    restaurantCurrent: "Selected",
    restaurantChooseFirst: "Choose a restaurant to see its menu.",
    restaurantNoAddress: "Address not published",
    emailLabel: "Email",
    emailPlaceholder: "email@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "Minimum 6 characters",
    registerNameLabel: "Full name for registration",
    registerNamePlaceholder: "First and last name",
    registerPhoneLabel: "Registration phone",
    registerAddressLabel: "Registration address",
    registerNeighborhoodLabel: "Neighborhood / city for registration",
    registerReferenceLabel: "Address reference",
    privacyConsent: "I accept data processing for orders, history, delivery, chat, and necessary technical cookies.",
    signIn: "Sign in",
    signUp: "Create customer account",
    signOut: "Sign out",
    signingIn: "Signing in...",
    signingUp: "Creating account...",
    signedIn: "Signed in.",
    signedOut: "Signed out.",
    accountCreated: "Account created. Check your email to confirm the account before signing in.",
    accountRequired: "Sign in or create an account to send the order and save your history.",
    authMissing: "Enter email and password.",
    authPasswordShort: "Password must be at least 6 characters.",
    authError: "Could not complete account access.",
    authInvalidCredentials: "Email or password is incorrect.",
    authEmailConfirm: "Confirm your email before signing in.",
    authAlreadyRegistered: "That email already has an account. Try signing in.",
    privacyRequired: "Accept data processing to create the account.",
    historyPanelAria: "Customer history",
    historyTitle: "My orders",
    refreshHistory: "Refresh",
    historySignIn: "Sign in to see your previous orders.",
    historyEmpty: "You do not have saved orders yet.",
    historyLoadError: "Could not load history. Run the updated SQL.",
    historyOpenOrder: "View status and chat",
    historyTicket: "Ticket",
    historyNoTicket: "No ticket",
    historyItems: "{count} item(s)",
    loadingMenu: "Loading menu...",
    menuPanelAria: "Restaurant menu",
    searchLabel: "Search product",
    searchPlaceholder: "Ex: bandeja paisa",
    searchClear: "Clear",
    searchEmpty: "No products found for \"{query}\".",
    cartPanelAria: "Customer order",
    yourOrder: "Your order",
    enableNotifications: "Enable notifications",
    orderTypeLabel: "Order type",
    eatHere: "Eat in",
    pickup: "Takeaway / pickup",
    delivery: "Delivery",
    nameLabel: "Name",
    namePlaceholder: "Your name",
    tableLabel: "Table / location",
    tablePlaceholder: "Table, pickup point, or location",
    deliveryTablePlaceholder: "Neighborhood or reference point",
    paymentMethodLabel: "Payment method",
    cash: "Cash",
    transfer: "Bank transfer",
    cardTerminal: "Card terminal on delivery",
    phoneLabel: "Phone",
    phonePlaceholder: "Contact number",
    addressLabel: "Full address",
    addressPlaceholder: "Street, number, apartment",
    neighborhoodLabel: "Neighborhood / city",
    neighborhoodPlaceholder: "Neighborhood or city",
    referenceLabel: "Reference",
    referencePlaceholder: "Floor, doorbell, instructions",
    distanceLabel: "Approximate distance km",
    distancePlaceholder: "Ex: 3.4",
    useLocation: "Use my location",
    calculateMaps: "Calculate with Google Maps",
    deliveryHelp: "Delivery: the restaurant minimum applies; if distance is higher than that amount, the price is calculated by tiers using Google Maps or approximate km.",
    kitchenNotesLabel: "Kitchen notes",
    kitchenNotesPlaceholder: "Ex: no onion, sauce on the side...",
    estimatedTotal: "Estimated total",
    estimatedDelivery: "Estimated delivery",
    chatTitle: "Chat with restaurant",
    chatMessageLabel: "Message",
    chatPlaceholder: "Write here. You can send a transfer receipt.",
    imageLabel: "Image",
    sendChat: "Send chat",
    sendOrder: "Send order",
    missingStore: "Restaurant code is missing from the QR.",
    appNotConfigured: "The app connection is not configured.",
    menuLoadError: "Could not load the menu. Please tell the restaurant.",
    noMenu: "This QR has no menu available.",
    menuReady: "Menu ready. Choose your products.",
    menuRealtimeConnecting: "Syncing live menu...",
    menuRealtimeUpdated: "Menu updated automatically.",
    menuRealtimeError: "Could not update the live menu. Use Refresh menu.",
    openMenuError: "Could not open the restaurant menu.",
    orderFor: "Order for {table}",
    emptyCategory: "There are no products in this category.",
    emptyCart: "Add products from the menu.",
    unavailable: "Unavailable",
    remove: "Remove",
    itemNotePlaceholder: "NOTE FOR THIS DISH",
    noConnection: "No connection with the restaurant.",
    addProductFirst: "Add at least one product.",
    sendingOrder: "Sending order...",
    sendOrderError: "Could not send. Check internet or tell the restaurant.",
    orderSent: "Order sent. Wait for restaurant confirmation.",
    orderSentWaiting: "Order sent. Waiting for the restaurant to accept it.",
    orderSentCashier: "Order sent. The restaurant will confirm the status at the register.",
    accepted: "Order accepted by the restaurant.{ticket}",
    sent: "Order sent by the restaurant.{ticket}",
    delivered: "Order delivered. Thank you for your purchase.{ticket}",
    cancelled: "Order cancelled. Contact the restaurant to confirm.",
    ticketSuffix: " Ticket #{ticket}.",
    registerNameRequired: "Enter your full name to create the account.",
    nameRequired: "Enter your name to send the order.",
    phoneRequired: "Enter a phone number for delivery.",
    addressRequired: "Enter the full delivery address.",
    distanceRequired: "Enter the approximate distance in kilometers to calculate delivery.",
    locationDeliveryOnly: "Location is only used for delivery orders.",
    locationUnsupported: "This browser does not allow location sharing.",
    locationRequest: "Requesting location permission...",
    locationReceived: "Location received. Trying to calculate distance...",
    locationReceivedManual: "Location received. Google Maps must be configured for automatic distance; you can also enter kilometers manually.",
    locationAddressFilled: "Location received and approximate address filled in.",
    locationAddressUnavailable: "Location received. I could not convert it into an address, but distance can be calculated with coordinates.",
    locationError: "Could not get location. You can enter address and kilometers manually.",
    mapsNeedAddress: "The restaurant must configure its address to use Google Maps.",
    mapsNeedKey: "Google Maps API key is missing. You can enter km manually.",
    mapsNeedDestination: "Enter the address or allow location before calculating.",
    mapsCalculating: "Calculating distance with Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Delivery: {fee}",
    mapsManual: "{error} You can enter km manually.",
    mapsFallback: "Could not calculate with Google Maps.",
    manualDistanceHelp: "You can enter kilometers manually. Google Maps works when the restaurant configures API key and address.",
    mapsLoadError: "Could not load Google Maps.",
    mapsResponseError: "Google Maps responded: {status}",
    mapsRouteError: "Could not calculate route: {status}",
    paymentTitle: "Order payment",
    totalLabel: "Total",
    referencePaymentLabel: "Reference",
    bankAccountMissing: "Bank account not configured by the restaurant.",
    transferNoteDefault: "Use the order reference in the receipt.",
    bankAccountLabel: "Account",
    transferNoteLabel: "Note",
    payOnDelivery: "Pay {amount} by {method} when the restaurant confirms.",
    cashLower: "cash",
    cardLower: "card terminal/card",
    notificationUnsupported: "This browser does not support notifications.",
    notificationsOn: "Notifications enabled for order status.",
    notificationsOff: "Notifications not enabled. You can see the status on this screen.",
    notificationEnableError: "Could not enable notifications.",
    notificationStatusTitle: "Order status",
    restaurantMessageTitle: "Restaurant message",
    restaurantMessageBody: "You have a reply in the order chat.",
    chatEmpty: "Chat ready. You can send a receipt or a question.",
    restaurantSender: "Restaurant",
    customerSender: "Customer",
    chatImageAlt: "Image sent in chat",
    chatLoadError: "Could not load chat. Run the updated SQL.",
    chatFirstOrder: "Send the order first to activate chat.",
    chatNeedMessage: "Write a message or select an image.",
    chatSending: "Sending chat...",
    chatSent: "Message sent.",
    chatSendError: "Could not send the message.",
    imageInvalid: "Select a valid image.",
    imageTooLarge: "The image is too heavy. Use a photo under 5 MB.",
    imageReadError: "Could not read the image.",
    imagePrepareError: "Could not prepare the image.",
    imageStillLarge: "The image is still too heavy. Crop the photo or lower the quality.",
  },
};

const customerParams = new URLSearchParams(window.location.search);
let customerStoreId = String(customerParams.get("store") || "").trim();
const customerTableFromQr = String(customerParams.get("mesa") || customerParams.get("table") || "").trim();

function customerInitialLanguage() {
  const fromUrl = String(customerParams.get("lang") || "").toLowerCase();
  const saved = String(localStorage.getItem(CUSTOMER_LANGUAGE_KEY) || "").toLowerCase();
  const browser = String(navigator.language || "").toLowerCase();
  if (CUSTOMER_I18N[fromUrl]) return fromUrl;
  if (CUSTOMER_I18N[saved]) return saved;
  if (browser.startsWith("pl")) return "pl";
  if (browser.startsWith("en")) return "en";
  return "es";
}

let customerLanguage = customerInitialLanguage();

function customerT(key, values = {}) {
  const dictionary = CUSTOMER_I18N[customerLanguage] || CUSTOMER_I18N.es;
  const fallback = CUSTOMER_I18N.es[key] || key;
  return String(dictionary[key] || fallback).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function customerApplyTranslations() {
  document.documentElement.lang = customerLanguage;
  if (customerElements.languageSelect) customerElements.languageSelect.value = customerLanguage;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = customerT(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", customerT(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", customerT(node.dataset.i18nAriaLabel));
  });
}

function customerSetLanguage(language) {
  if (!CUSTOMER_I18N[language]) return;
  customerLanguage = language;
  localStorage.setItem(CUSTOMER_LANGUAGE_KEY, language);
  customerApplyTranslations();
  if (customerTableFromQr) {
    customerElements.tableLabel.textContent = customerT("orderFor", { table: customerTableFromQr });
  }
  customerRenderDeliveryFields();
  customerRenderCategories();
  customerRenderMenu();
  customerRenderCart();
  customerRenderAccount();
  customerRenderHistory();
  customerRenderRestaurantDirectory();
}

function customerOrderTypeText(value) {
  if (value === "Recoger en el punto") return customerT("pickup");
  if (value === "Domicilio") return customerT("delivery");
  return customerT("eatHere");
}

function customerPaymentMethodText(value) {
  if (value === "Transferencia") return customerT("transfer");
  if (value === "Datafono") return customerT("cardTerminal");
  return customerT("cash");
}

let customerClient = null;
let customerAuthInitialized = false;
let customerUser = null;
let customerHistoryRows = [];
let customerRestaurants = [];
let customerRestaurantSearchQuery = "";
let customerMenu = CUSTOMER_DEFAULT_MENU;
let customerActiveCategory = "Entradas";
let customerSearchQuery = "";
let customerCart = [];
let customerSettings = {
  businessName: "RINCON COLOMBIANO",
  businessLogoUrl: "",
  currencySymbol: "$",
  currencyPosition: "before",
  moneyFormat: "us",
  deliveryFee: 0,
  deliveryMinimumFee: 20,
  restaurantAddress: "",
  googleMapsApiKey: "",
  bankAccount: "",
  bankTransferNote: "",
};

let customerMapDistance = null;
let googleMapsScriptPromise = null;
let customerLocationCoords = null;
let customerTrackedOrder = null;
let customerStatusTimer = null;
let customerChatTimer = null;
let customerKnownChatMessageIds = new Set();
let customerChatLoadedOnce = false;
let customerMenuRealtimeChannel = null;
let customerMenuRealtimeStoreId = "";
let customerMenuRealtimeTimer = null;

const CUSTOMER_DELIVERY_RATES = {
  baseKm: 1.5,
  baseFee: 4.5,
  intermediateLimitKm: 6,
  intermediatePerKm: 1.5,
  longLimitKm: 8,
  longPerKm: 2.5,
  extraLongPerKm: 3.5,
};

function customerSupabaseConfig() {
  const config = window.RINCON_SUPABASE || {};
  const rawUrl = String(config.url || "").trim();
  let cleanUrl = rawUrl;

  try {
    const parsed = new URL(rawUrl);
    cleanUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    cleanUrl = rawUrl.replace(/\/rest\/v1\/?.*$/i, "").replace(/\/+$/, "");
  }

  return {
    url: cleanUrl,
    anonKey: String(config.anonKey || "").trim(),
  };
}

function customerFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return customerT("authInvalidCredentials");
  if (/email not confirmed/i.test(message)) return customerT("authEmailConfirm");
  if (/already registered|already exists|user already/i.test(message)) return customerT("authAlreadyRegistered");
  return message || customerT("authError");
}

function customerSetAuthMessage(message, type = "") {
  if (!customerElements.authMessage) return;
  customerElements.authMessage.textContent = message;
  customerElements.authMessage.dataset.type = type;
  customerElements.authMessage.hidden = !message;
}

function customerInputValue(input) {
  return String(input?.value || "").trim();
}

function customerSetInputIfEmpty(input, value) {
  const cleanValue = customerNormalizeText(value);
  if (input && cleanValue && !input.value.trim()) input.value = cleanValue;
}

function customerRegisteredAddressPayload() {
  return {
    table: customerInputValue(customerElements.tableInput),
    address: customerInputValue(customerElements.registerAddressInput) || customerInputValue(customerElements.addressInput),
    neighborhood:
      customerInputValue(customerElements.registerNeighborhoodInput) || customerInputValue(customerElements.neighborhoodInput),
    reference: customerInputValue(customerElements.registerReferenceInput) || customerInputValue(customerElements.referenceInput),
    distanceKm: customerInputValue(customerElements.distanceInput),
  };
}

function customerApplyRegisterFieldsToOrder() {
  customerSetInputIfEmpty(customerElements.nameInput, customerInputValue(customerElements.registerNameInput));
  customerSetInputIfEmpty(customerElements.phoneInput, customerInputValue(customerElements.registerPhoneInput));
  customerSetInputIfEmpty(customerElements.addressInput, customerInputValue(customerElements.registerAddressInput));
  customerSetInputIfEmpty(customerElements.neighborhoodInput, customerInputValue(customerElements.registerNeighborhoodInput));
  customerSetInputIfEmpty(customerElements.referenceInput, customerInputValue(customerElements.registerReferenceInput));
}

function customerApplyProfileFields(profile = {}) {
  const address = profile.default_address || {};
  customerSetInputIfEmpty(customerElements.registerNameInput, profile.full_name);
  customerSetInputIfEmpty(customerElements.registerPhoneInput, profile.phone);
  customerSetInputIfEmpty(customerElements.registerAddressInput, address.address);
  customerSetInputIfEmpty(customerElements.registerNeighborhoodInput, address.neighborhood);
  customerSetInputIfEmpty(customerElements.registerReferenceInput, address.reference);
  customerSetInputIfEmpty(customerElements.nameInput, profile.full_name);
  customerSetInputIfEmpty(customerElements.phoneInput, profile.phone);
  customerSetInputIfEmpty(customerElements.tableInput, address.table);
  customerSetInputIfEmpty(customerElements.addressInput, address.address);
  customerSetInputIfEmpty(customerElements.neighborhoodInput, address.neighborhood);
  customerSetInputIfEmpty(customerElements.referenceInput, address.reference);
  customerSetInputIfEmpty(customerElements.distanceInput, address.distanceKm);
}

function customerProfileFromMetadata() {
  const metadata = customerUser?.user_metadata || {};
  return {
    full_name: metadata.full_name || "",
    phone: metadata.phone || "",
    default_address: metadata.default_address || {},
  };
}

function customerEnsureClient() {
  if (customerClient) return customerClient;
  const config = customerSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  customerClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return customerClient;
}

function customerRenderAccount() {
  const email = customerUser?.email || "";
  if (customerElements.accountSummary) {
    customerElements.accountSummary.removeAttribute("data-i18n");
    customerElements.accountSummary.textContent = customerUser
      ? customerT("accountSignedIn", { email })
      : customerT("accountGuest");
  }
  if (customerElements.authFields) customerElements.authFields.hidden = Boolean(customerUser);
  if (customerElements.signOutButton) customerElements.signOutButton.hidden = !customerUser;
  if (customerElements.sendButton) customerElements.sendButton.disabled = customerCart.length === 0 || !customerUser;

  if (customerUser) {
    customerApplyProfileFields(customerProfileFromMetadata());
    if (!customerElements.nameInput.value.trim()) {
      const fallbackName = String(email.split("@")[0] || "").trim();
      if (fallbackName) customerElements.nameInput.value = fallbackName;
    }
  }
}

async function customerInitializeAuth() {
  const client = customerEnsureClient();
  if (!client || customerAuthInitialized) return;
  customerAuthInitialized = true;
  const { data } = await client.auth.getSession();
  customerUser = data.session?.user || null;
  customerRenderAccount();
  if (customerUser) {
    await customerLoadProfile();
    await customerLoadHistory();
  } else {
    customerRenderHistory();
  }
  client.auth.onAuthStateChange(async (_event, session) => {
    customerUser = session?.user || null;
    customerRenderAccount();
    if (customerUser) {
      await customerLoadProfile();
      await customerLoadHistory();
    } else {
      customerHistoryRows = [];
      customerRenderHistory();
    }
  });
}

async function customerSignInWithEmail() {
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  const password = customerElements.authPassword.value;
  if (!client) {
    customerSetAuthMessage(customerT("appNotConfigured"), "error");
    return;
  }
  if (!email || !password) {
    customerSetAuthMessage(customerT("authMissing"), "error");
    return;
  }
  customerSetAuthMessage(customerT("signingIn"));
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerElements.authPassword.value = "";
  customerSetAuthMessage(customerT("signedIn"), "ok");
}

async function customerSignUpWithEmail() {
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  const password = customerElements.authPassword.value;
  const fullName = customerInputValue(customerElements.registerNameInput) || customerInputValue(customerElements.nameInput);
  if (!client) {
    customerSetAuthMessage(customerT("appNotConfigured"), "error");
    return;
  }
  if (!email || !password) {
    customerSetAuthMessage(customerT("authMissing"), "error");
    return;
  }
  if (password.length < 6) {
    customerSetAuthMessage(customerT("authPasswordShort"), "error");
    return;
  }
  if (!fullName) {
    customerSetAuthMessage(customerT("registerNameRequired"), "error");
    customerElements.registerNameInput?.focus();
    return;
  }
  if (!customerElements.privacyConsentInput?.checked) {
    customerSetAuthMessage(customerT("privacyRequired"), "error");
    customerElements.privacyConsentInput?.focus();
    return;
  }

  if (!customerElements.registerNameInput.value.trim()) customerElements.registerNameInput.value = fullName;
  customerApplyRegisterFieldsToOrder();
  customerSetAuthMessage(customerT("signingUp"));
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
      data: {
        app_name: customerSettings.businessName || "RINCON COLOMBIANO",
        full_name: fullName,
        phone: customerInputValue(customerElements.registerPhoneInput),
        default_address: customerRegisteredAddressPayload(),
        privacy_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerElements.authPassword.value = "";
  if (data?.session?.user) {
    customerUser = data.session.user;
    await customerSaveProfile();
    await customerLoadHistory();
  }
  customerSetAuthMessage(customerT("accountCreated"), "ok");
}

async function customerSignOut() {
  if (!customerClient) return;
  await customerClient.auth.signOut();
  customerSetAuthMessage(customerT("signedOut"), "ok");
}

function customerProfilePayload() {
  const registeredAddress = customerRegisteredAddressPayload();
  return {
    user_id: customerUser.id,
    full_name: customerInputValue(customerElements.nameInput) || customerInputValue(customerElements.registerNameInput),
    phone: customerInputValue(customerElements.phoneInput) || customerInputValue(customerElements.registerPhoneInput),
    default_address: {
      table: customerInputValue(customerElements.tableInput) || registeredAddress.table,
      address: customerInputValue(customerElements.addressInput) || registeredAddress.address,
      neighborhood: customerInputValue(customerElements.neighborhoodInput) || registeredAddress.neighborhood,
      reference: customerInputValue(customerElements.referenceInput) || registeredAddress.reference,
      distanceKm: customerInputValue(customerElements.distanceInput) || registeredAddress.distanceKm,
    },
    language: customerLanguage,
    updated_at: new Date().toISOString(),
  };
}

async function customerLoadProfile() {
  if (!customerClient || !customerUser) return;
  const { data, error } = await customerClient
    .from("customer_profiles")
    .select("full_name, phone, default_address, language")
    .eq("user_id", customerUser.id)
    .maybeSingle();
  if (error || !data) {
    const metadataProfile = customerProfileFromMetadata();
    customerApplyProfileFields(metadataProfile);
    if (!error && (metadataProfile.full_name || metadataProfile.phone || Object.keys(metadataProfile.default_address || {}).length)) {
      await customerSaveProfile();
    }
    return;
  }
  if (data.language && CUSTOMER_I18N[data.language]) customerSetLanguage(data.language);
  customerApplyProfileFields(data);
  customerRenderDeliveryFields();
}

async function customerSaveProfile() {
  if (!customerClient || !customerUser) return;
  await customerClient.from("customer_profiles").upsert(customerProfilePayload());
}

function customerHistoryItems(row) {
  return Array.isArray(row?.order_json?.items) ? row.order_json.items : [];
}

function customerLineQuantity(item) {
  const quantity = Number.parseFloat(item?.qty ?? item?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function customerLinePrice(item) {
  const price = Number.parseFloat(item?.price ?? item?.unit_price_snapshot);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function customerLineName(item) {
  return customerNormalizeText(item?.name || item?.product_name_snapshot || "Producto");
}

function customerHistoryItemCount(row) {
  return customerHistoryItems(row).reduce((count, item) => count + customerLineQuantity(item), 0);
}

function customerRenderHistory() {
  if (!customerElements.historyList) return;
  if (!customerUser) {
    customerElements.historyList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(customerT("historySignIn"))}</div>`;
    return;
  }
  if (!customerHistoryRows.length) {
    customerElements.historyList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(customerT("historyEmpty"))}</div>`;
    return;
  }
  customerElements.historyList.innerHTML = customerHistoryRows
    .map((row) => {
      const created = new Date(row.created_at);
      const dateText = Number.isNaN(created.getTime())
        ? ""
        : `${created.toLocaleDateString()} ${created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const ticketText = row.ticket_number
        ? `${customerT("historyTicket")} #${String(row.ticket_number).padStart(4, "0")}`
        : customerT("historyNoTicket");
      const itemsText = customerT("historyItems", { count: customerHistoryItemCount(row) });
      const statusType = customerStatusType(row.status);
      return `
        <article class="customer-history-item" data-order-id="${customerEscapeHtml(row.id)}">
          <div class="customer-history-main">
            <strong>${customerEscapeHtml(row.restaurant_name || customerSettings.businessName)}</strong>
            <span>${customerEscapeHtml(dateText)}</span>
          </div>
          <div class="customer-history-meta">
            <span data-type="${customerEscapeHtml(statusType)}">${customerEscapeHtml(customerStatusText(row))}</span>
            <span>${customerEscapeHtml(ticketText)}</span>
            <span>${customerEscapeHtml(row.order_type || "")}</span>
            <span>${customerEscapeHtml(itemsText)}</span>
          </div>
          <div class="customer-history-total">
            <strong>${customerEscapeHtml(customerFormatMoney(row.total))}</strong>
            <button class="customer-map-button" type="button" data-action="open-history-order">
              ${customerEscapeHtml(customerT("historyOpenOrder"))}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function customerLoadHistory() {
  if (!customerClient || !customerUser) {
    customerHistoryRows = [];
    customerRenderHistory();
    return;
  }
  const { data, error } = await customerClient.rpc("get_customer_order_history");
  if (error) {
    customerElements.historyList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(customerT("historyLoadError"))}</div>`;
    return;
  }
  customerHistoryRows = Array.isArray(data) ? data : [];
  customerRenderHistory();
}

function customerOpenHistoryOrder(orderId) {
  const row = customerHistoryRows.find((item) => item.id === orderId);
  if (!row) return;
  customerStartStatusTracking(row.id, row.public_token, row.order_json?.paymentMethod || "", "");
  customerSetTrackingStatus(customerStatusText(row), customerStatusType(row.status));
  customerRenderPaymentBox(row.id, Number(row.total) || 0, row.order_json || {});
  customerElements.chatPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function customerSetStatus(message, type = "") {
  customerElements.status.removeAttribute("data-i18n");
  customerElements.status.textContent = message;
  customerElements.status.dataset.type = type;
}

function customerSetTrackingStatus(message, type = "") {
  if (!customerElements.trackingStatus) return;
  customerElements.trackingStatus.textContent = message;
  customerElements.trackingStatus.dataset.type = type;
  customerElements.trackingStatus.hidden = !message;
}

function customerEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function customerCleanCategoryName(value) {
  const cleanName = String(value || "").trim().replace(/\s+/g, " ");
  return cleanName || "Menu";
}

function customerCategoryKey(value) {
  return customerCleanCategoryName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function customerNormalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function customerNormalizeRestaurantProfile(row = {}) {
  const userId = customerNormalizeText(row.user_id || row.userId);
  const name = customerNormalizeText(row.business_name || row.businessName);
  if (!userId || !name) return null;
  return {
    userId,
    name,
    logoUrl: customerNormalizeText(row.logo_url || row.logoUrl),
    address: customerNormalizeText(row.public_address || row.publicAddress),
    phone: customerNormalizeText(row.phone),
    description: customerNormalizeText(row.description),
  };
}

function customerSelectedRestaurant() {
  return customerRestaurants.find((restaurant) => restaurant.userId === customerStoreId) || null;
}

function customerRenderRestaurantDirectory() {
  if (!customerElements.restaurantList) return;

  const selected = customerSelectedRestaurant();
  if (customerElements.selectedRestaurantText) {
    customerElements.selectedRestaurantText.removeAttribute("data-i18n");
    if (customerStoreId) {
      const name = selected?.name || customerSettings.businessName || "Restaurante";
      customerElements.selectedRestaurantText.textContent = customerT("restaurantSelected", { name });
    } else {
      customerElements.selectedRestaurantText.textContent = customerT("restaurantHelp");
    }
  }

  const query = customerNormalizeSearchText(customerRestaurantSearchQuery);
  const visibleRestaurants = customerRestaurants.filter((restaurant) => {
    if (!query) return true;
    return customerNormalizeSearchText(
      `${restaurant.name} ${restaurant.address} ${restaurant.phone} ${restaurant.description}`
    ).includes(query);
  });

  if (!customerRestaurants.length) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantEmpty")
    )}</div>`;
    return;
  }

  if (!visibleRestaurants.length) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantSearchEmpty", { query: customerRestaurantSearchQuery })
    )}</div>`;
    return;
  }

  customerElements.restaurantList.innerHTML = visibleRestaurants
    .map((restaurant) => {
      const isSelected = restaurant.userId === customerStoreId;
      const initials = restaurant.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
      return `
        <article class="customer-restaurant-card ${isSelected ? "is-selected" : ""}" data-store-id="${customerEscapeHtml(
        restaurant.userId
      )}">
          ${
            restaurant.logoUrl
              ? `<img src="${customerEscapeHtml(restaurant.logoUrl)}" alt="${customerEscapeHtml(restaurant.name)}" loading="lazy" />`
              : `<div class="customer-restaurant-initials">${customerEscapeHtml(initials || "R")}</div>`
          }
          <div class="customer-restaurant-info">
            <strong>${customerEscapeHtml(restaurant.name)}</strong>
            <span>${customerEscapeHtml(restaurant.address || customerT("restaurantNoAddress"))}</span>
            ${restaurant.phone ? `<small>${customerEscapeHtml(restaurant.phone)}</small>` : ""}
          </div>
          <button class="customer-map-button" type="button" data-action="choose-restaurant" ${
            isSelected ? "disabled" : ""
          }>${customerEscapeHtml(isSelected ? customerT("restaurantCurrent") : customerT("restaurantChoose"))}</button>
        </article>
      `;
    })
    .join("");
}

async function customerLoadRestaurantDirectory(options = {}) {
  const { silent = false } = options;
  const client = customerEnsureClient();
  if (!client || !customerElements.restaurantList) return;

  if (!silent) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantLoading")
    )}</div>`;
  }

  const { data, error } = await client
    .from("restaurant_profiles")
    .select("user_id, business_name, logo_url, public_address, phone, description, updated_at")
    .eq("active", true)
    .order("business_name", { ascending: true });

  if (error) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantLoadError")
    )}</div>`;
    return;
  }

  customerRestaurants = (Array.isArray(data) ? data : [])
    .map(customerNormalizeRestaurantProfile)
    .filter(Boolean);
  customerRenderRestaurantDirectory();
}

async function customerSelectRestaurant(storeId, options = {}) {
  const nextStoreId = customerNormalizeText(storeId);
  if (!nextStoreId) return;

  const previousStoreId = customerStoreId;
  customerStoreId = nextStoreId;
  if (previousStoreId && previousStoreId !== customerStoreId) {
    customerStopMenuRealtime();
    customerCart = [];
    customerMapDistance = null;
    customerLocationCoords = null;
    customerSetTrackingStatus("");
  }

  if (options.updateUrl !== false) {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("store", customerStoreId);
    nextUrl.searchParams.set("app", "v52");
    window.history.replaceState({}, "", nextUrl.toString());
  }

  customerApplyMenuSearch("");
  customerRenderRestaurantDirectory();
  await customerLoadMenu({ skipDirectory: true });
}

async function customerFetchPublicMenu(storeId) {
  const { data: rpcData, error: rpcError } = await customerClient.rpc("get_public_restaurant_menu", {
    p_user_id: storeId,
  });
  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row) return row;
  }

  const { data, error } = await customerClient
    .from("app_settings")
    .select("menu, settings")
    .eq("user_id", storeId)
    .maybeSingle();

  if (error) throw rpcError || error;
  return data;
}

function customerStopMenuRealtime() {
  if (customerMenuRealtimeTimer) {
    window.clearTimeout(customerMenuRealtimeTimer);
    customerMenuRealtimeTimer = null;
  }
  const channel = customerMenuRealtimeChannel;
  customerMenuRealtimeChannel = null;
  customerMenuRealtimeStoreId = "";
  if (channel && customerClient?.removeChannel) {
    customerClient.removeChannel(channel).catch((error) => {
      console.warn("No se pudo cerrar la sincronizacion en vivo del menu.", error);
    });
  }
}

function customerScheduleMenuRealtimeRefetch() {
  if (!customerStoreId || !customerClient) return;
  if (customerMenuRealtimeTimer) window.clearTimeout(customerMenuRealtimeTimer);
  customerMenuRealtimeTimer = window.setTimeout(async () => {
    customerMenuRealtimeTimer = null;
    try {
      await customerLoadMenu({ skipDirectory: true, fromRealtime: true });
      if (customerMenuProductCount(customerMenu)) {
        customerSetStatus(customerT("menuRealtimeUpdated"), "ok");
      }
    } catch (error) {
      console.error(error);
      customerSetStatus(customerT("menuRealtimeError"), "error");
    }
  }, 350);
}

function customerStartMenuRealtime() {
  if (!customerClient?.channel || !customerStoreId) return;
  if (customerMenuRealtimeChannel && customerMenuRealtimeStoreId === customerStoreId) return;

  customerStopMenuRealtime();
  const storeId = customerStoreId;
  customerMenuRealtimeStoreId = storeId;
  customerMenuRealtimeChannel = customerClient
    .channel(`public-menu-${storeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_settings",
        filter: `user_id=eq.${storeId}`,
      },
      () => {
        if (storeId !== customerStoreId) return;
        customerSetStatus(customerT("menuRealtimeConnecting"), "");
        customerScheduleMenuRealtimeRefetch();
      }
    )
    .subscribe((status) => {
      if (storeId !== customerStoreId) return;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        customerSetStatus(customerT("menuRealtimeError"), "error");
      }
    });
}

function customerMenuProductCount(menu = customerMenu) {
  return Object.values(menu || {}).reduce((count, dishes) => count + (Array.isArray(dishes) ? dishes.length : 0), 0);
}

function customerProductAvailable(product) {
  return product?.available !== false;
}

function customerNormalizeProductDescription(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 260);
}

function customerHashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function customerNormalizeProductId(value) {
  return String(value || "").trim().replace(/\s+/g, "-").slice(0, 90);
}

function customerStableProductId(category, name, description = "") {
  const cleanCategory = customerCategoryKey(category) || "menu";
  const cleanName = customerCategoryKey(name) || "producto";
  return `prod-${cleanCategory}-${cleanName}-${customerHashText(`${category}|${name}|${description}`)}`;
}

function customerNormalizeMenu(menu) {
  const normalized = {};
  const categoriesByKey = new Map();

  Object.entries(menu || {}).forEach(([category, dishes]) => {
    const cleanCategory = customerCleanCategoryName(category);
    const categoryKey = customerCategoryKey(cleanCategory);
    const finalCategory = categoriesByKey.get(categoryKey) || cleanCategory;
    categoriesByKey.set(categoryKey, finalCategory);
    if (!normalized[finalCategory]) normalized[finalCategory] = [];

    if (Array.isArray(dishes)) {
      dishes.forEach((dish) => {
        const name = String(dish?.name || "").trim();
        const price = Number.parseFloat(dish?.price) || 0;
        const imageUrl = String(dish?.imageUrl || dish?.image || dish?.photo || "").trim();
        const description = customerNormalizeProductDescription(dish?.description || dish?.descripcion || dish?.details || "");
        if (name) {
          normalized[finalCategory].push({
            id: customerNormalizeProductId(dish?.id || dish?.productId) || customerStableProductId(finalCategory, name, description),
            name,
            price,
            available: dish?.available === false ? false : true,
            imageUrl,
            description,
          });
        }
      });
    }
  });

  if (!Object.keys(normalized).length) normalized.Entradas = [];
  return normalized;
}

function customerFormatMoney(amount) {
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const localized =
    customerSettings.moneyFormat === "eu" ? formatted.replaceAll(",", " ").replace(".", ",") : formatted;

  if (customerSettings.currencyPosition === "after") {
    return `${localized} ${customerSettings.currencySymbol}`;
  }

  const separator = /[A-Za-z0-9]$/.test(customerSettings.currencySymbol) ? " " : "";
  return `${customerSettings.currencySymbol}${separator}${localized}`;
}

function customerNormalizeMoney(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function customerNormalizeDeliveryMinimumFee(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number >= 0 ? number : 20;
}

function customerNormalizeText(value) {
  return String(value || "").trim();
}

function customerNormalizeBusinessName(value) {
  const name = customerNormalizeText(value).replace(/\s+/g, " ");
  return name || "RINCON COLOMBIANO";
}

function customerApplyBusinessName() {
  const name = customerNormalizeBusinessName(customerSettings.businessName);
  customerSettings.businessName = name;
  if (customerElements.businessName) customerElements.businessName.textContent = name;
  if (customerElements.businessLogo) {
    if (customerSettings.businessLogoUrl) {
      customerElements.businessLogo.src = customerSettings.businessLogoUrl;
      customerElements.businessLogo.hidden = false;
    } else {
      customerElements.businessLogo.removeAttribute("src");
      customerElements.businessLogo.hidden = true;
    }
  }
  document.title = `${name} - Menu cliente`;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", name);
  customerRenderRestaurantDirectory();
}

function customerNormalizeDistance(value) {
  const number = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function customerCalculateDeliveryFee(distanceKm) {
  const distance = customerNormalizeDistance(distanceKm);
  if (distance <= 0) return 0;

  const rates = CUSTOMER_DELIVERY_RATES;
  let total = rates.baseFee;

  if (distance > rates.baseKm) {
    total += (Math.min(distance, rates.intermediateLimitKm) - rates.baseKm) * rates.intermediatePerKm;
  }

  if (distance > rates.intermediateLimitKm) {
    total += (Math.min(distance, rates.longLimitKm) - rates.intermediateLimitKm) * rates.longPerKm;
  }

  if (distance > rates.longLimitKm) {
    total += (distance - rates.longLimitKm) * rates.extraLongPerKm;
  }

  return Math.round(total * 100) / 100;
}

function customerSetMapResult(message, type = "") {
  customerElements.mapResult.textContent = message;
  customerElements.mapResult.dataset.type = type;
  customerElements.mapResult.hidden = !message;
}

function customerMapDestinationLabel(destination) {
  if (destination?.lat && destination?.lng) {
    const lat = typeof destination.lat === "function" ? destination.lat() : destination.lat;
    const lng = typeof destination.lng === "function" ? destination.lng() : destination.lng;
    return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  }
  return String(destination || "");
}

function customerDeliveryDestination() {
  return [
    customerElements.addressInput.value.trim(),
    customerElements.neighborhoodInput.value.trim(),
    "Poland",
  ].filter(Boolean).join(", ");
}

function customerDeliveryDestinationForMaps() {
  if (customerLocationCoords && window.google?.maps?.LatLng) {
    return new google.maps.LatLng(customerLocationCoords.lat, customerLocationCoords.lng);
  }
  return customerDeliveryDestination();
}

function customerCanUseGoogleMaps() {
  return Boolean(customerSettings.googleMapsApiKey && customerSettings.restaurantAddress && window.navigator.onLine);
}

function customerLoadGoogleMaps() {
  if (window.google?.maps?.DistanceMatrixService) return Promise.resolve();
  if (!customerSettings.googleMapsApiKey) return Promise.reject(new Error(customerT("mapsNeedKey")));
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const callbackName = `rinconGoogleMapsReady_${Date.now()}`;
    const script = document.createElement("script");
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(customerSettings.googleMapsApiKey)}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.addEventListener("error", () => {
      delete window[callbackName];
      googleMapsScriptPromise = null;
      reject(new Error(customerT("mapsLoadError")));
    });
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

function customerGetGoogleMapsDistance(origin, destination) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== "OK") {
          reject(new Error(customerT("mapsResponseError", { status })));
          return;
        }
        const element = response?.rows?.[0]?.elements?.[0];
        if (!element || element.status !== "OK") {
          reject(new Error(customerT("mapsRouteError", { status: element?.status || "sin resultado" })));
          return;
        }
        resolve({
          distanceKm: Math.round((element.distance.value / 1000) * 10) / 10,
          distanceText: element.distance.text,
          durationText: element.duration?.text || "",
          origin,
          destination: customerMapDestinationLabel(destination),
        });
      }
    );
  });
}

function customerAddressComponent(result, types = []) {
  const components = result?.address_components || [];
  const component = components.find((entry) => types.every((type) => entry.types.includes(type)));
  return component?.long_name || "";
}

async function customerReverseGeocodeLocation(coords) {
  if (!coords || !customerSettings.googleMapsApiKey) return false;
  await customerLoadGoogleMaps();

  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve(false);
        return;
      }

      const result = results[0];
      const approximateAddress = String(result.formatted_address || "").replace(/,\s*Poland$/i, "").trim();
      const neighborhood =
        customerAddressComponent(result, ["sublocality"]) ||
        customerAddressComponent(result, ["neighborhood"]) ||
        customerAddressComponent(result, ["locality"]) ||
        customerAddressComponent(result, ["administrative_area_level_2"]);

      if (approximateAddress && !customerElements.addressInput.value.trim()) {
        customerElements.addressInput.value = approximateAddress;
      }
      if (neighborhood && !customerElements.neighborhoodInput.value.trim()) {
        customerElements.neighborhoodInput.value = neighborhood;
      }
      resolve(Boolean(approximateAddress || neighborhood));
    });
  });
}

async function customerUseLocation() {
  if (customerElements.orderType.value !== "Domicilio") {
    customerSetMapResult(customerT("locationDeliveryOnly"), "error");
    return;
  }
  if (!navigator.geolocation) {
    customerSetMapResult(customerT("locationUnsupported"), "error");
    return;
  }

  customerElements.useLocationButton.disabled = true;
  customerSetMapResult(customerT("locationRequest"), "");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      customerLocationCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      customerSetMapResult(customerT("locationReceived"), "ok");
      customerElements.useLocationButton.disabled = false;

      if (customerSettings.googleMapsApiKey) {
        const addressFilled = await customerReverseGeocodeLocation(customerLocationCoords);
        customerSetMapResult(
          addressFilled ? customerT("locationAddressFilled") : customerT("locationAddressUnavailable"),
          addressFilled ? "ok" : ""
        );
      }

      if (customerCanUseGoogleMaps()) {
        await customerCalculateDistanceWithMaps();
      } else {
        customerSetMapResult(customerT("locationReceivedManual"), "");
      }
    },
    () => {
      customerLocationCoords = null;
      customerElements.useLocationButton.disabled = false;
      customerSetMapResult(customerT("locationError"), "error");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}

async function customerCalculateDistanceWithMaps() {
  if (customerElements.orderType.value !== "Domicilio") return;
  if (!customerSettings.restaurantAddress) {
    customerSetMapResult(customerT("mapsNeedAddress"), "error");
    return;
  }
  if (!customerSettings.googleMapsApiKey) {
    customerSetMapResult(customerT("mapsNeedKey"), "error");
    return;
  }
  if (!customerElements.addressInput.value.trim() && !customerLocationCoords) {
    customerSetMapResult(customerT("mapsNeedDestination"), "error");
    customerElements.addressInput.focus();
    return;
  }

  const origin = customerSettings.restaurantAddress;
  customerSetMapResult(customerT("mapsCalculating"), "");
  customerElements.calculateDistanceButton.disabled = true;

  try {
    await customerLoadGoogleMaps();
    const destination = customerDeliveryDestinationForMaps();
    customerMapDistance = await customerGetGoogleMapsDistance(origin, destination);
    customerElements.distanceInput.value = customerMapDistance.distanceKm;
    customerSetMapResult(
      customerT("mapsResult", {
        distance: customerMapDistance.distanceText,
        duration: customerMapDistance.durationText ? ` / ${customerMapDistance.durationText}` : "",
        fee: customerFormatMoney(customerDeliveryFee()),
      }),
      "ok"
    );
    customerRenderCart();
  } catch (error) {
    customerMapDistance = null;
    customerSetMapResult(customerT("mapsManual", { error: error.message || customerT("mapsFallback") }), "error");
  } finally {
    customerElements.calculateDistanceButton.disabled = false;
  }
}

function customerDeliveryFee() {
  if (customerElements.orderType.value !== "Domicilio") return 0;
  const calculatedFee = customerCalculateDeliveryFee(customerElements.distanceInput.value);
  const minimumFee = customerNormalizeDeliveryMinimumFee(customerSettings.deliveryMinimumFee);
  const extraFee = customerNormalizeMoney(customerSettings.deliveryFee);
  return Math.max(minimumFee, calculatedFee) + extraFee;
}

function customerItemTotal(item) {
  return customerLineQuantity(item) * customerLinePrice(item);
}

function customerCartTotal() {
  return customerCart.reduce((total, item) => total + customerItemTotal(item), 0) + customerDeliveryFee();
}

function customerNormalizeNote(value) {
  return String(value || "").trim().toUpperCase();
}

function customerRenderDeliveryFields() {
  const isDelivery = customerElements.orderType.value === "Domicilio";
  customerElements.deliveryFields.hidden = !isDelivery;
  customerElements.tableInput.placeholder = isDelivery ? customerT("deliveryTablePlaceholder") : customerT("tablePlaceholder");
  if (!isDelivery) {
    customerMapDistance = null;
    customerSetMapResult("");
  } else if (!customerCanUseGoogleMaps()) {
    customerSetMapResult(customerT("manualDistanceHelp"), "");
  }
  customerRenderCart();
}

function customerDeliveryPayload() {
  if (customerElements.orderType.value !== "Domicilio") return null;
  const distanceKm = customerNormalizeDistance(customerElements.distanceInput.value);
  const calculatedFee = customerCalculateDeliveryFee(distanceKm);
  const minimumFee = customerNormalizeDeliveryMinimumFee(customerSettings.deliveryMinimumFee);
  const extraFee = customerNormalizeMoney(customerSettings.deliveryFee);
  const feeBeforeExtra = Math.max(minimumFee, calculatedFee);
  return {
    name: customerElements.nameInput.value.trim(),
    phone: customerElements.phoneInput.value.trim(),
    address: customerElements.addressInput.value.trim(),
    neighborhood: customerElements.neighborhoodInput.value.trim(),
    reference: customerElements.referenceInput.value.trim(),
    distanceKm,
    calculatedFee,
    minimumFee,
    extraFee,
    fee: feeBeforeExtra + extraFee,
    mapDistanceText: customerMapDistance?.distanceText || "",
    mapDurationText: customerMapDistance?.durationText || "",
    mapOrigin: customerMapDistance?.origin || customerSettings.restaurantAddress || "",
    mapDestination: customerMapDistance?.destination || customerDeliveryDestination(),
    location: customerLocationCoords,
    tariff: `MINIMO=${minimumFee} PLN; BASE 1.5KM=4.50 PLN; 1.5-6KM=1.50 PLN/KM; 6-8KM=2.50 PLN/KM; +8KM=3.50 PLN/KM`,
  };
}

function customerOrderReference(orderId) {
  return String(orderId || "").slice(0, 8).toUpperCase();
}

function customerClearPaymentBox() {
  if (!customerElements.paymentBox) return;
  customerElements.paymentBox.hidden = true;
  customerElements.paymentBox.innerHTML = "";
}

function customerRenderPaymentBox(orderId, total, payload) {
  if (!customerElements.paymentBox) return;
  const reference = customerOrderReference(orderId);
  const paymentMethod = payload.paymentMethod;
  const amountText = customerFormatMoney(total);
  const bankAccount = customerSettings.bankAccount || customerT("bankAccountMissing");
  const transferNote = customerSettings.bankTransferNote || customerT("transferNoteDefault");
  let actionHtml = "";

  if (paymentMethod === "Transferencia") {
    actionHtml = `
      <p><strong>${customerEscapeHtml(customerT("bankAccountLabel"))}:</strong> ${customerEscapeHtml(bankAccount)}</p>
      <p><strong>${customerEscapeHtml(customerT("transferNoteLabel"))}:</strong> ${customerEscapeHtml(transferNote)}</p>
    `;
  } else {
    actionHtml = `<p>${customerEscapeHtml(
      customerT("payOnDelivery", {
        amount: amountText,
        method: paymentMethod === "Datafono" ? customerT("cardLower") : customerT("cashLower"),
      })
    )}</p>`;
  }

  customerElements.paymentBox.innerHTML = `
    <strong>${customerEscapeHtml(customerT("paymentTitle"))}</strong>
    <p><strong>${customerEscapeHtml(customerT("totalLabel"))}:</strong> ${customerEscapeHtml(amountText)}</p>
    <p><strong>${customerEscapeHtml(customerT("referencePaymentLabel"))}:</strong> ${customerEscapeHtml(reference)}</p>
    ${actionHtml}
  `;
  customerElements.paymentBox.hidden = false;
}

async function customerRequestNotificationPermission() {
  if (!("Notification" in window)) {
    customerSetTrackingStatus(customerT("notificationUnsupported"), "error");
    return "unsupported";
  }

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission === "granted") {
    customerSetTrackingStatus(customerT("notificationsOn"), "ok");
  } else {
    customerSetTrackingStatus(customerT("notificationsOff"), "");
  }
  return permission;
}

function customerShowNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "app-icon-192.png",
      tag: "rincon-colombiano-order-status",
    });
  } catch {
    // El estado visible en pantalla sigue funcionando aunque el navegador bloquee el aviso.
  }
}

function customerSetChatStatus(message, type = "") {
  if (!customerElements.chatStatus) return;
  customerElements.chatStatus.textContent = message;
  customerElements.chatStatus.dataset.type = type;
  customerElements.chatStatus.hidden = !message;
}

function customerMessageImageHtml(message) {
  const image = String(message?.image_data_url || "");
  if (!image.startsWith("data:image/")) return "";
  return `<a href="${customerEscapeHtml(image)}" target="_blank" rel="noopener"><img src="${customerEscapeHtml(image)}" alt="${customerEscapeHtml(customerT("chatImageAlt"))}" loading="lazy" /></a>`;
}

function customerRenderChatMessages(messages = []) {
  if (!customerElements.chatMessages) return;
  if (!messages.length) {
    customerElements.chatMessages.innerHTML = `<div class="customer-empty">${customerEscapeHtml(customerT("chatEmpty"))}</div>`;
    return;
  }

  customerElements.chatMessages.innerHTML = messages
    .map((message) => {
      const sender = message.sender === "restaurant" ? customerT("restaurantSender") : customerT("customerSender");
      const side = message.sender === "restaurant" ? "restaurant" : "customer";
      return `
        <article class="customer-chat-message ${side}">
          <strong>${customerEscapeHtml(sender)}</strong>
          ${message.body ? `<p>${customerEscapeHtml(message.body)}</p>` : ""}
          ${customerMessageImageHtml(message)}
        </article>
      `;
    })
    .join("");
  customerElements.chatMessages.scrollTop = customerElements.chatMessages.scrollHeight;
}

async function customerImageFileToDataUrl(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error(customerT("imageInvalid"));
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(customerT("imageTooLarge"));
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error(customerT("imageReadError"))));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error(customerT("imagePrepareError"))));
    img.src = dataUrl;
  });

  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.76);
  if (compressed.length > 950000) {
    throw new Error(customerT("imageStillLarge"));
  }
  return compressed;
}

async function customerLoadChatMessages(options = {}) {
  const { silent = false } = options;
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) return;

  const { data, error } = await customerClient.rpc("get_customer_order_messages", {
    p_order_id: customerTrackedOrder.id,
    p_public_token: customerTrackedOrder.publicToken,
  });

  if (error) {
    if (!silent) customerSetChatStatus(customerT("chatLoadError"), "error");
    return;
  }

  const messages = Array.isArray(data) ? data : [];
  const newRestaurantMessage = messages.some(
    (message) => message.sender === "restaurant" && customerChatLoadedOnce && !customerKnownChatMessageIds.has(message.id)
  );
  customerKnownChatMessageIds = new Set(messages.map((message) => message.id));
  customerChatLoadedOnce = true;
  customerRenderChatMessages(messages);
  if (newRestaurantMessage) {
    customerShowNotification(customerT("restaurantMessageTitle"), customerT("restaurantMessageBody"));
  }
}

function customerStartChat(orderId, publicToken) {
  if (!customerElements.chatPanel || !orderId || !publicToken) return;
  if (customerChatTimer) window.clearInterval(customerChatTimer);
  customerKnownChatMessageIds = new Set();
  customerChatLoadedOnce = false;
  customerElements.chatPanel.hidden = false;
  customerRenderChatMessages([]);
  customerSetChatStatus("");
  customerLoadChatMessages().catch(() => {});
  customerChatTimer = window.setInterval(() => {
    customerLoadChatMessages({ silent: true }).catch(() => {});
  }, 7000);
}

async function customerSendChatMessage() {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) {
    customerSetChatStatus(customerT("chatFirstOrder"), "error");
    return;
  }

  const body = customerNormalizeText(customerElements.chatInput.value);
  const file = customerElements.chatImageInput.files?.[0] || null;
  if (!body && !file) {
    customerSetChatStatus(customerT("chatNeedMessage"), "error");
    return;
  }

  customerElements.chatSendButton.disabled = true;
  customerSetChatStatus(customerT("chatSending"), "");

  try {
    const imageDataUrl = await customerImageFileToDataUrl(file);
    const { error } = await customerClient.rpc("create_customer_message", {
      p_order_id: customerTrackedOrder.id,
      p_public_token: customerTrackedOrder.publicToken,
      p_body: body,
      p_image_data_url: imageDataUrl,
    });

    if (error) throw error;
    customerElements.chatInput.value = "";
    customerElements.chatImageInput.value = "";
    customerSetChatStatus(customerT("chatSent"), "ok");
    await customerLoadChatMessages({ silent: true });
  } catch (error) {
    customerSetChatStatus(error.message || customerT("chatSendError"), "error");
  } finally {
    customerElements.chatSendButton.disabled = false;
  }
}

function customerValidateOrderData() {
  const isDelivery = customerElements.orderType.value === "Domicilio";
  if (!customerElements.nameInput.value.trim()) {
    customerSetStatus(customerT("nameRequired"), "error");
    customerElements.nameInput.focus();
    return false;
  }

  if (!isDelivery) return true;

  if (!customerElements.phoneInput.value.trim()) {
    customerSetStatus(customerT("phoneRequired"), "error");
    customerElements.phoneInput.focus();
    return false;
  }

  if (!customerElements.addressInput.value.trim()) {
    customerSetStatus(customerT("addressRequired"), "error");
    customerElements.addressInput.focus();
    return false;
  }

  if (customerNormalizeDistance(customerElements.distanceInput.value) <= 0) {
    customerSetStatus(customerT("distanceRequired"), "error");
    customerElements.distanceInput.focus();
    return false;
  }

  return true;
}

function customerGenerateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function customerNormalizeRpcRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

async function customerCreateCustomerOrder(orderPayload, total, tableLabel, customerName, orderType) {
  const orderId = customerGenerateId();
  const publicToken = customerGenerateId();
  const payloadWithToken = { ...orderPayload, publicToken };

  const { data: rpcData, error: rpcError } = await customerClient.rpc("create_customer_order", {
    p_id: orderId,
    p_user_id: customerStoreId,
    p_public_token: publicToken,
    p_table_label: tableLabel,
    p_customer_name: customerName,
    p_order_type: orderType,
    p_order_json: payloadWithToken,
    p_total: total,
  });

  if (!rpcError) {
    const row = customerNormalizeRpcRow(rpcData);
    return {
      id: row?.id || orderId,
      publicToken: row?.public_token || publicToken,
      payload: payloadWithToken,
      trackingAvailable: true,
    };
  }

  const insertPayload = {
    id: orderId,
    user_id: customerStoreId,
    customer_user_id: customerUser?.id || null,
    public_token: publicToken,
    status: "pending",
    table_label: tableLabel,
    customer_name: customerName,
    order_type: orderType,
    order_json: payloadWithToken,
    total,
  };

  let { error: insertError } = await customerClient.from("customer_orders").insert(insertPayload);
  if (!insertError) {
    return {
      id: orderId,
      publicToken,
      payload: payloadWithToken,
      trackingAvailable: true,
    };
  }

  const legacyPayload = { ...insertPayload };
  delete legacyPayload.public_token;
  delete legacyPayload.customer_user_id;
  legacyPayload.order_json = orderPayload;
  ({ error: insertError } = await customerClient.from("customer_orders").insert(legacyPayload));
  if (insertError) throw insertError;

  return {
    id: orderId,
    publicToken: "",
    payload: orderPayload,
    trackingAvailable: false,
  };
}

function customerStatusText(row) {
  const ticket = row?.ticket_number ? customerT("ticketSuffix", { ticket: String(row.ticket_number).padStart(4, "0") }) : "";
  if (row?.status === "accepted") return customerT("accepted", { ticket });
  if (row?.status === "sent") return customerT("sent", { ticket });
  if (row?.status === "delivered") return customerT("delivered", { ticket });
  if (row?.status === "cancelled") return customerT("cancelled");
  return customerT("orderSentWaiting");
}

function customerStatusType(status) {
  if (status === "accepted" || status === "sent" || status === "delivered") return "ok";
  if (status === "cancelled") return "error";
  return "";
}

async function customerPollOrderStatus() {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) return;

  const { data, error } = await customerClient.rpc("get_customer_order_status", {
    p_order_id: customerTrackedOrder.id,
    p_public_token: customerTrackedOrder.publicToken,
  });

  if (error) {
    customerSetTrackingStatus(customerT("orderSentCashier"), "");
    if (customerStatusTimer) window.clearInterval(customerStatusTimer);
    customerStatusTimer = null;
    return;
  }

  const row = customerNormalizeRpcRow(data);
  if (!row) return;
  const previousStatus = customerTrackedOrder.status;
  customerTrackedOrder.status = row.status;
  const message = customerStatusText(row);
  const type = customerStatusType(row.status);
  customerSetTrackingStatus(message, type);

  if (previousStatus && previousStatus !== row.status) {
    customerShowNotification(customerT("notificationStatusTitle"), message);
  }

  if (row.status === "delivered" || row.status === "cancelled") {
    if (customerStatusTimer) window.clearInterval(customerStatusTimer);
    customerStatusTimer = null;
  }
}

function customerStartStatusTracking(orderId, publicToken, paymentMethod, paymentUrl) {
  if (customerStatusTimer) window.clearInterval(customerStatusTimer);
  customerTrackedOrder = {
    id: orderId,
    publicToken,
    paymentMethod,
    paymentUrl,
    status: "pending",
  };
  customerSetTrackingStatus(customerT("orderSentWaiting"), "");
  customerPollOrderStatus().catch(() => {});
  customerStatusTimer = window.setInterval(() => {
    customerPollOrderStatus().catch(() => {});
  }, 8000);
  customerStartChat(orderId, publicToken);
}

function customerRenderCategories() {
  const categories = Object.keys(customerMenu);
  if (!categories.includes(customerActiveCategory)) {
    customerActiveCategory = categories[0] || "Entradas";
  }

  customerElements.categoryTabs.innerHTML = categories
    .map(
      (category) => `
        <button type="button" data-category="${customerEscapeHtml(category)}" aria-selected="${
        !customerSearchQuery && category === customerActiveCategory
      }">
          ${customerEscapeHtml(category)}
        </button>
      `
    )
    .join("");
}

function customerMenuSearchEntries(query) {
  const cleanQuery = customerNormalizeSearchText(query);
  const entries = [];
  Object.entries(customerMenu).forEach(([category, dishes]) => {
    (dishes || []).forEach((dish, index) => {
      const searchable = customerNormalizeSearchText(`${category} ${dish.name} ${dish.description || ""}`);
      if (!cleanQuery || searchable.includes(cleanQuery)) entries.push({ category, dish, index });
    });
  });
  return entries;
}

function customerApplyMenuSearch(value) {
  customerSearchQuery = String(value || "").trim();
  if (customerElements.menuSearchInput && customerElements.menuSearchInput.value !== customerSearchQuery) {
    customerElements.menuSearchInput.value = customerSearchQuery;
  }
  if (customerElements.menuSearchClearButton) customerElements.menuSearchClearButton.hidden = !customerSearchQuery;
  customerRenderCategories();
  customerRenderMenu();
}

function customerRenderMenu() {
  const searchQuery = customerNormalizeSearchText(customerSearchQuery);
  const entries = searchQuery
    ? customerMenuSearchEntries(searchQuery)
    : (customerMenu[customerActiveCategory] || []).map((dish, index) => ({ category: customerActiveCategory, dish, index }));

  if (!entries.length) {
    customerElements.menuGrid.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      searchQuery ? customerT("searchEmpty", { query: customerSearchQuery }) : customerT("emptyCategory")
    )}</div>`;
    return;
  }

  customerElements.menuGrid.innerHTML = entries
    .map(
      ({ category, dish, index }) => `
        <button
          class="customer-dish-button ${dish.imageUrl ? "has-product-image" : ""} ${customerProductAvailable(dish) ? "" : "is-unavailable"}"
          type="button"
          data-category="${customerEscapeHtml(category)}"
          data-index="${index}"
          ${customerProductAvailable(dish) ? "" : "disabled aria-disabled=\"true\""}
        >
          ${dish.imageUrl ? `<img src="${customerEscapeHtml(dish.imageUrl)}" alt="${customerEscapeHtml(dish.name)}" loading="lazy" />` : ""}
          <strong>${customerEscapeHtml(dish.name)}</strong>
          ${dish.description ? `<small>${customerEscapeHtml(dish.description)}</small>` : ""}
          ${searchQuery ? `<small>${customerEscapeHtml(category)}</small>` : ""}
          <span>${customerFormatMoney(dish.price)}</span>
          ${customerProductAvailable(dish) ? "" : `<em>${customerEscapeHtml(customerT("unavailable"))}</em>`}
        </button>
      `
    )
    .join("");
}

function customerRenderCart() {
  if (!customerCart.length) {
    customerElements.cartItems.innerHTML = `<div class="customer-empty">${customerEscapeHtml(customerT("emptyCart"))}</div>`;
  } else {
    customerElements.cartItems.innerHTML = customerCart
      .map(
        (item) => `
          <article class="customer-cart-item" data-id="${customerEscapeHtml(item.id)}">
            <div>
              <strong>${customerEscapeHtml(item.name)}</strong>
              <span>${customerFormatMoney(customerItemTotal(item))}</span>
            </div>
            <div class="customer-qty-row">
              <button type="button" data-action="minus">-</button>
              <input type="number" min="1" step="1" value="${item.qty}" data-action="qty" />
              <button type="button" data-action="plus">+</button>
              <button type="button" data-action="remove">${customerEscapeHtml(customerT("remove"))}</button>
            </div>
            <input class="customer-note-input" type="text" value="${customerEscapeHtml(
              item.note
            )}" data-action="note" placeholder="${customerEscapeHtml(customerT("itemNotePlaceholder"))}" />
          </article>
        `
      )
      .join("");
  }

  customerElements.cartTotal.textContent = customerFormatMoney(customerCartTotal());
  customerElements.deliveryFeeRow.hidden = customerElements.orderType.value !== "Domicilio";
  customerElements.deliveryFeeLabel.textContent = customerFormatMoney(customerDeliveryFee());
  customerElements.sendButton.disabled = customerCart.length === 0 || !customerUser;
}

function customerAddItem(dish) {
  const productId =
    customerNormalizeProductId(dish.id || dish.productId) ||
    customerStableProductId(customerActiveCategory, dish.name, dish.description || "");
  const existing = customerCart.find(
    (item) => item.productId === productId && item.name.toLowerCase() === dish.name.toLowerCase() && !item.note
  );
  if (existing) {
    existing.qty += 1;
  } else {
    customerCart.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      productId,
      name: dish.name,
      description: dish.description || "",
      price: Number.parseFloat(dish.price) || 0,
      qty: 1,
      note: "",
    });
  }
  customerRenderCart();
}

async function customerLoadMenu(options = {}) {
  const config = customerSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    customerSetStatus(customerT("appNotConfigured"), "error");
    return;
  }

  customerClient = customerEnsureClient();
  await customerInitializeAuth();

  if (!options.skipDirectory) {
    await customerLoadRestaurantDirectory({ silent: true });
  }

  if (!customerStoreId) {
    customerStopMenuRealtime();
    customerMenu = CUSTOMER_DEFAULT_MENU;
    customerCart = [];
    customerSetStatus(customerT("restaurantChooseFirst"), "");
    customerRenderRestaurantDirectory();
    customerRenderCategories();
    customerRenderMenu();
    customerRenderCart();
    return;
  }

  customerStartMenuRealtime();

  let data = null;

  try {
    data = await customerFetchPublicMenu(customerStoreId);
  } catch (error) {
    console.error(error);
    customerSetStatus(customerT("menuLoadError"), "error");
    return;
  }

  if (!data) {
    customerSetStatus(customerT("noMenu"), "error");
    return;
  }

  customerSettings = {
    businessName: customerNormalizeBusinessName(data.settings?.businessName),
    businessLogoUrl: customerNormalizeText(data.settings?.businessLogoUrl),
    currencySymbol: data.settings?.currencySymbol || "$",
    currencyPosition: data.settings?.currencyPosition === "after" ? "after" : "before",
    moneyFormat: data.settings?.moneyFormat === "eu" ? "eu" : "us",
    deliveryFee: customerNormalizeMoney(data.settings?.deliveryFee),
    deliveryMinimumFee: customerNormalizeDeliveryMinimumFee(data.settings?.deliveryMinimumFee),
    restaurantAddress: customerNormalizeText(data.settings?.restaurantAddress),
    googleMapsApiKey: customerNormalizeText(data.settings?.googleMapsApiKey),
    bankAccount: customerNormalizeText(data.settings?.bankAccount),
    bankTransferNote: customerNormalizeText(data.settings?.bankTransferNote),
  };
  customerApplyBusinessName();

  const loadedMenu = customerNormalizeMenu(data.menu || {});
  if (!customerMenuProductCount(loadedMenu)) {
    customerMenu = loadedMenu;
    customerSetStatus(customerT("noMenu"), "error");
    customerRenderCategories();
    customerRenderMenu();
    return;
  }

  customerMenu = loadedMenu;
  customerActiveCategory = Object.keys(customerMenu)[0] || "Entradas";

  if (customerTableFromQr) {
    customerElements.tableInput.value = customerTableFromQr;
    customerElements.tableLabel.textContent = customerT("orderFor", { table: customerTableFromQr });
  }

  customerSetStatus(customerT("menuReady"), "ok");
  customerRenderCategories();
  customerRenderMenu();
  customerRenderDeliveryFields();
  customerRenderCart();
}

async function customerRefreshMenu() {
  customerSetStatus(customerT("refreshingMenu"), "");
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update?.();
    }
  } catch (error) {
    console.error(error);
  }

  try {
    await customerLoadMenu();
    customerSetStatus(customerStoreId ? customerT("menuUpdated") : customerT("restaurantChooseFirst"), customerStoreId ? "ok" : "");
  } catch (error) {
    console.error(error);
    customerSetStatus(customerT("menuLoadError"), "error");
  }
}

async function customerSendOrder() {
  if (!customerClient || !customerStoreId) {
    customerSetStatus(customerT("noConnection"), "error");
    return;
  }

  if (!customerUser) {
    customerSetStatus(customerT("accountRequired"), "error");
    customerElements.authEmail?.focus();
    return;
  }

  if (!customerCart.length) {
    customerSetStatus(customerT("addProductFirst"), "error");
    return;
  }

  if (!customerValidateOrderData()) return;

  const tableLabel = customerElements.tableInput.value.trim();
  const customerName = customerElements.nameInput.value.trim();
  const orderType = customerElements.orderType.value;
  const paymentMethod = customerElements.paymentMethod.value;
  const delivery = customerDeliveryPayload();
  const notes = customerNormalizeNote(customerElements.notesInput.value);
  const items = customerCart.map((item) => {
    const quantity = Math.max(1, Number.parseInt(item.qty, 10) || 1);
    const unitPrice = Number.parseFloat(item.price) || 0;
    const itemTotal = Math.round(unitPrice * quantity * 100) / 100;
    const productName = customerLineName(item);
    const itemNote = customerNormalizeNote(item.note);
    return {
      product_id: item.productId || item.id || "",
      product_name_snapshot: productName,
      unit_price_snapshot: unitPrice,
      quantity,
      options_snapshot: {
        description: item.description || "",
        note: itemNote,
      },
      total_snapshot: itemTotal,
      name: productName,
      description: item.description || "",
      price: unitPrice,
      qty: quantity,
      note: itemNote,
    };
  });
  const total = customerCartTotal();
  const orderPayload = {
    source: "cliente_qr",
    customerUserId: customerUser.id,
    customerEmail: customerUser.email || "",
    customer: customerName,
    table: tableLabel,
    type: orderType,
    paymentMethod,
    delivery,
    notes,
    items,
    total,
    createdAt: new Date().toISOString(),
  };

  customerElements.sendButton.disabled = true;
  customerSetStatus(customerT("sendingOrder"), "");
  customerClearPaymentBox();

  let insertedOrder;
  try {
    await customerSaveProfile();
    insertedOrder = await customerCreateCustomerOrder(orderPayload, total, tableLabel, customerName, orderType);
  } catch {
    insertedOrder = null;
  }

  if (!insertedOrder) {
    customerElements.sendButton.disabled = false;
    customerSetStatus(customerT("sendOrderError"), "error");
    return;
  }

  customerCart = [];
  customerElements.notesInput.value = "";
  customerRenderCart();
  if (insertedOrder.trackingAvailable) {
    customerStartStatusTracking(insertedOrder.id, insertedOrder.publicToken, paymentMethod, "");
  } else {
    customerTrackedOrder = {
      id: insertedOrder.id,
      publicToken: "",
      paymentMethod,
      paymentUrl: "",
      status: "pending",
    };
    customerSetTrackingStatus(customerT("orderSentCashier"), "");
  }
  customerRenderPaymentBox(insertedOrder.id, total, insertedOrder.payload);
  customerRenderCart();
  customerSetStatus(customerT("orderSent"), "ok");
  customerLoadHistory().catch(() => {});
}

customerElements.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  customerActiveCategory = button.dataset.category;
  customerApplyMenuSearch("");
  customerRenderCategories();
  customerRenderMenu();
});

if (customerElements.menuSearchInput) {
  customerElements.menuSearchInput.addEventListener("input", () => {
    customerApplyMenuSearch(customerElements.menuSearchInput.value);
  });
}

if (customerElements.menuSearchClearButton) {
  customerElements.menuSearchClearButton.addEventListener("click", () => {
    customerApplyMenuSearch("");
    if (customerElements.menuSearchInput) customerElements.menuSearchInput.focus();
  });
}

customerElements.menuGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".customer-dish-button");
  if (!button || button.disabled) return;
  const category = button.dataset.category || customerActiveCategory;
  const dish = (customerMenu[category] || [])[Number.parseInt(button.dataset.index, 10)];
  if (dish) customerAddItem(dish);
});

customerElements.cartItems.addEventListener("click", (event) => {
  const row = event.target.closest(".customer-cart-item");
  const action = event.target.dataset.action;
  if (!row || !action) return;
  const item = customerCart.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  if (action === "plus") item.qty += 1;
  if (action === "minus") item.qty = Math.max(1, item.qty - 1);
  if (action === "remove") customerCart = customerCart.filter((entry) => entry.id !== item.id);
  customerRenderCart();
});

customerElements.cartItems.addEventListener("input", (event) => {
  const row = event.target.closest(".customer-cart-item");
  const action = event.target.dataset.action;
  if (!row || !action) return;
  const item = customerCart.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  if (action === "qty") {
    item.qty = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
    event.target.value = item.qty;
  }
  if (action === "note") {
    item.note = customerNormalizeNote(event.target.value);
    event.target.value = item.note;
    return;
  }
  customerRenderCart();
});

customerElements.signInButton.addEventListener("click", customerSignInWithEmail);
customerElements.signUpButton.addEventListener("click", customerSignUpWithEmail);
customerElements.signOutButton.addEventListener("click", customerSignOut);
customerElements.restaurantSearchInput?.addEventListener("input", () => {
  customerRestaurantSearchQuery = customerElements.restaurantSearchInput.value.trim();
  customerRenderRestaurantDirectory();
});
customerElements.refreshRestaurantsButton?.addEventListener("click", () => customerLoadRestaurantDirectory());
customerElements.restaurantList?.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="choose-restaurant"]');
  const card = event.target.closest(".customer-restaurant-card");
  if (!button || !card) return;
  customerSelectRestaurant(card.dataset.storeId).catch((error) => {
    console.error(error);
    customerSetStatus(customerT("menuLoadError"), "error");
  });
});
customerElements.refreshHistoryButton.addEventListener("click", () => customerLoadHistory());
customerElements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="open-history-order"]');
  const row = event.target.closest(".customer-history-item");
  if (!button || !row) return;
  customerOpenHistoryOrder(row.dataset.orderId);
});

customerElements.notesInput.addEventListener("input", () => {
  customerElements.notesInput.value = customerNormalizeNote(customerElements.notesInput.value);
});

customerElements.orderType.addEventListener("change", customerRenderDeliveryFields);
customerElements.paymentMethod.addEventListener("change", customerRenderCart);
customerElements.distanceInput.addEventListener("input", customerRenderCart);
customerElements.languageSelect.addEventListener("change", () => customerSetLanguage(customerElements.languageSelect.value));
if (customerElements.refreshMenuButton) {
  customerElements.refreshMenuButton.addEventListener("click", customerRefreshMenu);
}
customerElements.notifyButton.addEventListener("click", () => {
  customerRequestNotificationPermission().catch(() => {
    customerSetTrackingStatus(customerT("notificationEnableError"), "error");
  });
});
customerElements.useLocationButton.addEventListener("click", customerUseLocation);
customerElements.calculateDistanceButton.addEventListener("click", customerCalculateDistanceWithMaps);
customerElements.chatSendButton.addEventListener("click", customerSendChatMessage);
customerElements.sendButton.addEventListener("click", customerSendOrder);

window.addEventListener("online", () => {
  if (!customerStoreId) return;
  customerStartMenuRealtime();
  customerRefreshMenu().catch(() => {
    customerSetStatus(customerT("menuRealtimeError"), "error");
  });
});

window.addEventListener("offline", () => {
  if (customerStoreId) customerSetStatus(customerT("noConnection"), "error");
});

let customerPullToRefreshStartY = 0;
window.addEventListener(
  "touchstart",
  (event) => {
    customerPullToRefreshStartY = event.touches?.[0]?.clientY || 0;
  },
  { passive: true }
);
window.addEventListener(
  "touchmove",
  (event) => {
    const currentY = event.touches?.[0]?.clientY || 0;
    if (window.scrollY <= 0 && currentY > customerPullToRefreshStartY + 8) {
      event.preventDefault();
    }
  },
  { passive: false }
);

customerApplyBusinessName();
customerApplyTranslations();
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
customerLoadMenu().catch(() => {
  customerSetStatus(customerT("openMenuError"), "error");
});
