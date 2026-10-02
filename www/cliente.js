const CUSTOMER_DEFAULT_MENU = {};
const customerElements = {
  languageSelect: document.querySelector("#customerLanguageSelect"),
  status: document.querySelector("#customerStatus"),
  trackingStatus: document.querySelector("#customerTrackingStatus"),
  courierTracking: document.querySelector("#customerCourierTracking"),
  orderTimeline: document.querySelector("#customerOrderTimeline"),
  businessLogo: document.querySelector("#customerBusinessLogo"),
  businessName: document.querySelector("#customerBusinessName"),
  accountSummary: document.querySelector("#customerAccountSummary"),
  accountActions: document.querySelector("#customerAccountActions"),
  openSignInButton: document.querySelector("#customerOpenSignInButton"),
  openSignUpButton: document.querySelector("#customerOpenSignUpButton"),
  authDialog: document.querySelector("#customerAuthDialog"),
  authDialogBody: document.querySelector("#customerAuthDialogBody"),
  authModalForm: document.querySelector("#customerAuthModalForm"),
  authTitle: document.querySelector("#customerAuthTitle"),
  authCloseButton: document.querySelector("#customerAuthCloseButton"),
  authFields: document.querySelector("#customerAuthFields"),
  authEmail: document.querySelector("#customerAuthEmail"),
  authPassword: document.querySelector("#customerAuthPassword"),
  registerNameInput: document.querySelector("#customerRegisterNameInput"),
  registerPhoneInput: document.querySelector("#customerRegisterPhoneInput"),
  registerCountryInput: document.querySelector("#customerRegisterCountryInput"),
  registerRegionInput: document.querySelector("#customerRegisterRegionInput"),
  registerCityInput: document.querySelector("#customerRegisterCityInput"),
  registerPostalCodeInput: document.querySelector("#customerRegisterPostalCodeInput"),
  registerAddressInput: document.querySelector("#customerRegisterAddressInput"),
  registerNeighborhoodInput: document.querySelector("#customerRegisterNeighborhoodInput"),
  registerReferenceInput: document.querySelector("#customerRegisterReferenceInput"),
  privacyConsentInput: document.querySelector("#customerPrivacyConsentInput"),
  authMessage: document.querySelector("#customerAuthMessage"),
  signInButton: document.querySelector("#customerSignInButton"),
  signUpButton: document.querySelector("#customerSignUpButton"),
  resetPasswordButton: document.querySelector("#customerResetPasswordButton"),
  resendVerificationButton: document.querySelector("#customerResendVerificationButton"),
  passwordRecoveryPanel: document.querySelector("#customerPasswordRecoveryPanel"),
  newPasswordInput: document.querySelector("#customerNewPasswordInput"),
  updatePasswordButton: document.querySelector("#customerUpdatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#customerCancelRecoveryButton"),
  signOutButton: document.querySelector("#customerSignOutButton"),
  restaurantPanel: document.querySelector("#customerRestaurantPanel"),
  restaurantTitle: document.querySelector("#customerRestaurantTitle"),
  selectedRestaurantText: document.querySelector("#customerSelectedRestaurantText"),
  restaurantSearchInput: document.querySelector("#customerRestaurantSearchInput"),
  homeSearchInput: document.querySelector("#customerHomeSearchInput"),
  restaurantList: document.querySelector("#customerRestaurantList"),
  refreshRestaurantsButton: document.querySelector("#customerRefreshRestaurantsButton"),
  historyList: document.querySelector("#customerHistoryList"),
  refreshHistoryButton: document.querySelector("#customerRefreshHistoryButton"),
  refreshMenuButton: document.querySelector("#customerRefreshMenuButton"),
  favoriteRestaurantButton: document.querySelector("#customerFavoriteRestaurantButton"),
  tableLabel: document.querySelector("#customerTableLabel"),
  topLocation: document.querySelector("#customerTopLocation"),
  greeting: document.querySelector("#customerGreeting"),
  greetingName: document.querySelector("#customerGreetingName"),
profileAvatarInitials:
document.querySelector("#customerProfileAvatarInitials"),
headerCartButton:
document.querySelector("#customerHeaderCartButton"),
headerCartBadge:
document.querySelector("#customerHeaderCartBadge"),
views: Array.from(document.querySelectorAll("[data-customer-view]")),
  viewButtons: Array.from(document.querySelectorAll("[data-customer-view-target]")),
  backToRestaurantsButton: document.querySelector("#customerBackToRestaurantsButton"),
  
  selectedRestaurantDescription: document.querySelector("#customerSelectedRestaurantDescription"),
  selectedRestaurantAddress: document.querySelector("#customerSelectedRestaurantAddress"),
  selectedRestaurantDelivery: document.querySelector("#customerSelectedRestaurantDelivery"),
  selectedRestaurantStatus: document.querySelector("#customerSelectedRestaurantStatus"),
  noActiveOrder: document.querySelector("#customerNoActiveOrder"),
  profileDetails: document.querySelector("#customerProfileDetails"),
  profileEditActions: document.querySelector("#customerProfileEditActions"),
editProfileButton: document.querySelector("#customerEditProfileButton"),
  categoryTabs: document.querySelector("#customerCategoryTabs"),
  menuSearchInput: document.querySelector("#customerMenuSearchInput"),
  menuSearchClearButton: document.querySelector("#customerMenuSearchClearButton"),
  menuGrid: document.querySelector("#customerMenuGrid"),
cartItems: document.querySelector("#customerCartItems"),
cartTotal: document.querySelector("#customerCartTotal"),
cartModal:
  document.querySelector("#customerCartModal"),
cartSheet:
  document.querySelector("#customerCartSheet"),
cartCloseButton:
  document.querySelector("#customerCartCloseButton"),
notifyButton:
  document.querySelector("#customerNotifyButton"),
  orderType: document.querySelector("#customerOrderType"),
  paymentMethod: document.querySelector("#customerPaymentMethod"),
  onlinePaymentOption: document.querySelector("#customerOnlinePaymentOption"),
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
  confirmDeliveryButton: document.querySelector("#customerConfirmDeliveryButton"),
  chatPanel: document.querySelector("#customerChatPanel"),
  chatMessages: document.querySelector("#customerChatMessages"),
  chatInput: document.querySelector("#customerChatInput"),
  chatImageInput: document.querySelector("#customerChatImageInput"),
  chatSendButton: document.querySelector("#customerSendChatButton"),
  chatStatus: document.querySelector("#customerChatStatus"),
  sendButton: document.querySelector("#sendCustomerOrderButton"),
};
const CUSTOMER_LANGUAGE_KEY = "rincon_colombiano_customer_language";
const CUSTOMER_APP_LANGUAGE_KEY = "rincon_colombiano_app_language";
const CUSTOMER_TRANSLATION_CACHE_KEY = "rincon_colombiano_description_translations_v1";
const CUSTOMER_PENDING_ORDER_KEY_PREFIX = "rc_ordera_pending_customer_order";
const CUSTOMER_TRACKED_ORDER_KEY_PREFIX = "rc_ordera_tracked_customer_order";
const CUSTOMER_TRACKED_ORDER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_ORDER_GUARD_KEY = "rc_ordera_order_guard_v1";
const CUSTOMER_MENU_CACHE_KEY_PREFIX = "rc_ordera_customer_menu_cache_v1";
const CUSTOMER_REALTIME_RECONNECT_MIN_MS = 2_000;
const CUSTOMER_REALTIME_RECONNECT_MAX_MS = 60_000;
const CUSTOMER_REALTIME_STABLE_MS = 30_000;
const CUSTOMER_RECOVERY_DEDUP_MS = 30_000;
const CUSTOMER_DIRECTORY_POLL_MIN_MS = 300_000;
const CUSTOMER_DIRECTORY_POLL_MAX_MS = 600_000;
const CUSTOMER_CHAT_POLL_MIN_MS = 15_000;
const CUSTOMER_CHAT_POLL_MAX_MS = 120_000;
const CUSTOMER_STATUS_POLL_MIN_MS = 15_000;
const CUSTOMER_STATUS_POLL_MAX_MS = 120_000;
const CUSTOMER_DELIVERY_MARKUP = 1.6714285714;
const CUSTOMER_I18N = {
  es: {
    documentTitleSuffix: "Menú del cliente",
    profileSaved: "Tus datos fueron guardados correctamente.",
    profileSaveError: "No se pudo guardar el perfil.",
    cartAria: "Carrito",
    closeCartAria: "Cerrar carrito",
    editProfile: "Editar perfil",
    profileAria: "Perfil",
    heroEyebrow: "Pedido del cliente",
    languageLabel: "Idioma",
    refreshMenu: "Actualizar menu",
    refreshingMenu: "Actualizando menu...",
    menuUpdated: "Menu actualizado.",
    heroSubtitle: "Escanea, elige y envia tu pedido.",
    warning: "App de prueba: si algo sale diferente, el restaurante confirmara el pedido y cualquier ajuste antes de prepararlo.",
    testEnvironment: "Entorno de prueba",
    greeting: "Hola",
    defaultCustomerName: "Cliente",
    deliveryTo: "Entregar en",
    homePrompt: "¿Que se te antoja hoy?",
    homeSearchPlaceholder: "Buscar restaurantes o platos...",
    categoriesTitle: "Categorias",
    showAll: "Ver todas",
    showLess: "Ver menos",
    homeEyebrow: "Cerca de ti",
    deliveryLocation: "Direccion de entrega",
    locationNotSet: "Agrega una direccion al hacer tu pedido",
    navHome: "Inicio",
    navOrders: "Pedidos",
    navReservations: "Reservas",
    navProfile: "Perfil",
    platformHome: "Volver a la pantalla principal",
    customerNavigationAria: "Navegacion del cliente",
    backToRestaurants: "Volver",
    restaurantOpen: "Abierto",
    restaurantClosed: "Cerrado",
    restaurantClosedBrowse: "Puedes revisar el menu, pero el restaurante no recibe pedidos en este momento.",
    restaurantClosedOrder: "El restaurante esta cerrado y no puede recibir el pedido ahora.",
    restaurantRegionMismatch: "Este restaurante pertenece a otro pais. Actualiza tu ubicacion y elige un restaurante de tu region.",
    deliveryCalculatedAtCheckout: "Domicilio calculado con tu direccion",
    ordersEyebrow: "Seguimiento",
    activeOrderTitle: "Pedido activo",
    noActiveOrder: "No tienes un pedido activo.",
    reservationsEyebrow: "Tus mesas",
    reservationsEmpty: "No tienes reservas registradas.",
    profileEyebrow: "Cuenta y preferencias",
    profileName: "Nombre",
    profilePhone: "Telefono",
    profileAddress: "Direccion",
    profileNotSet: "Sin registrar",
    privacySummary: "Privacidad y datos",
    legalNotice: "Usamos los datos que escribes para crear tu cuenta, preparar el pedido, entregarlo, guardar historial y responder por chat. La app usa cookies tecnicas/localStorage para mantener sesion, idioma, carrito y funcionamiento.",
    accountPanelAria: "Cuenta del cliente",
    accountTitle: "Mi cuenta",
    accountGuest: "Puedes pedir como invitado. Inicia sesion o crea cuenta si quieres guardar historial.",
    accountSignedIn: "Conectado como {email}. Tus pedidos quedaran guardados en tu historial.",
    restaurantPanelAria: "Elegir restaurante",
    restaurantTitle: "Elegir restaurante",
    restaurantHelp: "Busca el restaurante donde quieres hacer tu pedido.",
    restaurantSelected: "Restaurante seleccionado: {name}. Ya puedes revisar el menu y enviar tu pedido.",
    restaurantSingleSelected: "{name} esta listo para recibir tu pedido.",
    restaurantSearchLabel: "Buscar restaurante",
    restaurantSearchPlaceholder: "Nombre, ciudad o direccion",
    restaurantRefresh: "Actualizar restaurantes",
    restaurantLoading: "Cargando restaurantes...",
    restaurantEmpty: "Todavia no hay restaurantes publicados.",
    restaurantSearchEmpty: "No encontre restaurantes con \"{query}\".",
    restaurantLoadError: "No se pudieron cargar restaurantes. Revisa internet e intenta de nuevo.",
    restaurantUnavailable: "Este restaurante fue cerrado o eliminado y ya no recibe pedidos.",
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
    registerCountryLabel: "Pais",
    countrySelectPlaceholder: "Selecciona un pais",
    registerRegionLabel: "Departamento / voivodato",
    regionSelectCountryFirst: "Primero selecciona un pais",
    regionSelectPlaceholder: "Selecciona una region",
    registerCityLabel: "Localidad",
    cityPlaceholder: "Ciudad, municipio, pueblo, corregimiento o vereda",
    registerAddressLabel: "Direccion de registro",
    registerNeighborhoodLabel: "Barrio / sector",
    registerNeighborhoodPlaceholder: "Barrio, sector o referencia local",
    registerPostalCodeLabel: "Codigo postal",
    postalCodePlaceholder: "Codigo postal (opcional)",
    registerReferenceLabel: "Referencia de direccion",
    privacyConsent: "Acepto el tratamiento de mis datos para gestionar pedidos, historial, entrega, chat y cookies tecnicas necesarias.",
    signIn: "Iniciar sesion",
    signUp: "Crear cuenta cliente",
    resetPassword: "Recuperar contrasena",
    resendVerification: "Reenviar verificacion",
    newPasswordLabel: "Nueva contrasena",
    updatePassword: "Guardar nueva contrasena",
    cancel: "Cancelar",
    signOut: "Cerrar sesion",
    signingIn: "Iniciando sesion...",
    signingUp: "Creando cuenta...",
    signedIn: "Sesion iniciada.",
    signedOut: "Sesion cerrada.",
    accountCreated: "Cuenta creada. RC ORDERA te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion.",
    resetEmailRequired: "Escribe tu correo electronico para recuperar la contrasena.",
    resetSending: "RC ORDERA esta enviando el correo de recuperacion...",
    resetSent: "Correo enviado por RC ORDERA. Abre el enlace para crear una contrasena nueva.",
    resendEmailRequired: "Escribe tu correo electronico para reenviar la verificacion.",
    resendSending: "RC ORDERA esta reenviando el correo de verificacion...",
    resendSent: "Correo de verificacion reenviado por RC ORDERA. Revisa entrada, spam o promociones.",
    recoveryTitle: "Nueva contrasena",
    recoveryReady: "RC ORDERA verifico el enlace. Escribe tu nueva contrasena.",
    newPasswordShort: "La nueva contrasena debe tener minimo 6 caracteres.",
    passwordUpdated: "Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.",
    accountRequired: "Puedes enviar el pedido como invitado llenando tus datos. Inicia sesion solo si quieres guardar historial.",
    authMissing: "Escribe correo y contrasena.",
    authPasswordShort: "La contrasena debe tener minimo 6 caracteres.",
    authError: "No se pudo completar el acceso.",
    authInvalidCredentials: "Correo o contrasena incorrectos.",
    authEmailConfirm: "RC ORDERA envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.",
    authAlreadyRegistered: "Ese correo ya tiene cuenta. Intenta iniciar sesion.",
    privacyRequired: "Acepta el tratamiento de datos para crear la cuenta.",
    historyPanelAria: "Historial del cliente",
    historyTitle: "Mis pedidos",
    refreshHistory: "Actualizar",
    historySignIn: "Inicia sesion para ver tus pedidos anteriores.",
    historyEmpty: "Todavia no tienes pedidos guardados.",
    historyLoadError: "No se pudo cargar el historial. Revisa internet e intenta de nuevo.",
    historyOpenOrder: "Ver estado y chat",
    historyRepeatOrder: "Pedir nuevamente",
    historyRepeatReady: "Carrito actualizado con los productos y precios disponibles ahora.",
    historyRepeatPartial: "Algunos productos ya no estan disponibles. Agregue los que siguen activos con sus precios actuales.",
    historyRepeatUnavailable: "Ningun producto de ese pedido esta disponible actualmente.",
    favoriteRestaurant: "Guardar restaurante favorito",
    unfavoriteRestaurant: "Quitar restaurante de favoritos",
    favoriteSignIn: "Inicia sesion como cliente para guardar favoritos.",
    favoriteSaveError: "No fue posible actualizar el favorito.",
    orderTimelineLabel: "Progreso del pedido",
    timelineCreated: "Pedido creado",
    timelineSubmitted: "Pedido enviado",
    timelineAccepted: "Restaurante acepto",
    timelinePreparing: "En preparacion",
    timelineReady: "Pedido listo",
    timelineCourierOffered: "Buscando colaborador",
    timelineCourierAccepted: "Colaborador asignado",
    timelineCourierArrivedRestaurant: "Colaborador llego al restaurante",
    timelineOnTheWay: "Pedido en camino",
    timelineCourierArrivedCustomer: "Colaborador llego",
    timelineDelivered: "Pedido entregado",
    timelineCancelled: "Pedido cancelado",
    courierTrackingTitle: "Seguimiento del colaborador",
    courierTrackingWaiting: "La ubicacion aparecera cuando un colaborador acepte el domicilio.",
    courierTrackingName: "Colaborador: {name}",
    courierTrackingLocation: "Ubicacion actualizada {time}",
    courierTrackingEta: "Llegada estimada: {time}",
    courierTrackingMap: "Abrir ubicacion en el mapa",
    courierTrackingNow: "ahora",
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
    deliveryHelp: "La distancia y el domicilio se calculan de forma segura con la ruta real antes de enviar el pedido.",
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
    appConnectionLoadError: "No se pudo cargar la conexion de la app. Revisa internet e intenta de nuevo.",
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
    orderRateLimited: "Has enviado varios pedidos en poco tiempo. Espera unos minutos antes de intentarlo de nuevo.",
    menuChangedBeforeOrder: "El menu cambio antes de confirmar el pedido. Ya cargamos los precios y productos actuales; revisa el carrito.",
    orderSent: "Pedido enviado. Espera confirmacion del restaurante.",
    orderSentWaiting: "Pedido enviado. Esperando que el restaurante lo acepte.",
    orderSentCashier: "Pedido enviado. El restaurante confirmara el estado en caja.",
    accepted: "Pedido aceptado por el restaurante.{ticket}",
    sent: "Pedido enviado por el restaurante.{ticket}",
    delivered: "Pedido entregado. Gracias por tu compra.{ticket}",
    cancelled: "Pedido cancelado. Comunicate con el restaurante para confirmar.",
    ticketSuffix: " Ticket #{ticket}.",
    registerNameRequired: "Escribe tu nombre completo para crear la cuenta.",
    registerCountryRequired: "Selecciona Colombia o Polonia.",
    registerRegionRequired: "Selecciona tu departamento o voivodato.",
    registerCityRequired: "Escribe tu ciudad, municipio, pueblo, corregimiento, vereda o localidad.",
    nameRequired: "Escribe tu nombre para enviar el pedido.",
    phoneRequired: "Escribe un telefono para el domicilio.",
    addressRequired: "Escribe la direccion completa para el domicilio.",
    distanceRequired: "Calcula la ruta del domicilio antes de enviar el pedido.",
    deliveryQuoteRequired: "Calcula nuevamente la ruta del domicilio. La cotizacion debe estar vigente al enviar el pedido.",
    locationDeliveryOnly: "La ubicacion se usa solo para pedidos a domicilio.",
    locationUnsupported: "Este navegador no permite compartir ubicacion.",
    locationRequest: "Solicitando permiso de ubicacion...",
    locationReceived: "Ubicacion recibida. Intentando calcular distancia...",
    locationReceivedManual: "Ubicacion recibida. Para calcular automaticamente falta configurar Google Maps; tambien puedes escribir los kilometros manualmente.",
    locationAddressFilled: "Ubicacion recibida y direccion aproximada completada.",
    locationAddressUnavailable: "Ubicacion recibida. No pude convertirla en direccion, pero puedo calcular la distancia con coordenadas.",
    locationError: "No se pudo obtener la ubicacion. Puedes escribir la direccion y kilometros manualmente.",
    locationSecureRequired: "La ubicacion requiere abrir RC ORDERA desde la direccion segura HTTPS publicada.",
    locationPermissionDenied: "Permiso de ubicacion denegado. Habilitalo en el navegador o escribe la direccion.",
    locationUnavailable: "El dispositivo no pudo determinar la ubicacion. Intenta nuevamente o escribe la direccion.",
    locationTimeout: "La ubicacion tardo demasiado. Intenta nuevamente o escribe la direccion.",
    mapsNeedAddress: "El restaurante debe configurar su direccion para usar Google Maps.",
    mapsNeedKey: "Falta configurar Google Maps API key. Puedes escribir km manualmente.",
    mapsNeedDestination: "Escribe la direccion o permite usar tu ubicacion antes de calcular.",
    mapsCalculating: "Calculando distancia con Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Domicilio: {fee}",
    mapsManual: "{error} Revisa la direccion e intenta nuevamente.",
    mapsFallback: "No se pudo calcular con Google Maps.",
    manualDistanceHelp: "Escribe o confirma la direccion y pulsa Calcular con Google Maps.",
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
    onlinePayment: "Pago online — BLIK, tarjeta y otros",
    payOnlineNow: "Pagar ahora de forma segura",
    paymentRedirecting: "Abriendo el pago seguro...",
    onlinePaymentFailed: "No fue posible iniciar el pago en linea. Puedes reintentarlo desde este pedido.",
    paymentSuccess: "El pago fue recibido y se esta confirmando.",
    paymentCancelled: "El pago no se completo. El pedido sigue visible para que puedas reintentarlo.",
    confirmDelivery: "Confirmar que recibi el pedido",
    confirmingDelivery: "Confirmando entrega...",
    deliveryConfirmed: "Entrega confirmada. Gracias.",
    deliveryConfirmError: "No fue posible confirmar la entrega.",
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
    chatLoadError: "No se pudo cargar el chat. Revisa internet e intenta de nuevo.",
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
    documentTitleSuffix: "Menu klienta",
    profileSaved: "Twoje dane zostały zapisane.",
    profileSaveError: "Nie udało się zapisać profilu.",
    cartAria: "Koszyk",
    closeCartAria: "Zamknij koszyk",
    editProfile: "Edytuj profil",
    profileAria: "Profil",
    heroEyebrow: "Zamowienie klienta",
    languageLabel: "Jezyk",
    refreshMenu: "Odswiez menu",
    refreshingMenu: "Odswiezanie menu...",
    menuUpdated: "Menu zaktualizowane.",
    heroSubtitle: "Zeskanuj, wybierz i wyslij zamowienie.",
    warning: "Aplikacja testowa: jesli cos bedzie nie tak, restauracja potwierdzi zamowienie i korekty przed przygotowaniem.",
    testEnvironment: "Srodowisko testowe",
    greeting: "Cześć",
    defaultCustomerName: "Klient",
    deliveryTo: "Dostawa pod adres",
    homePrompt: "Na co masz dzisiaj ochote?",
    homeSearchPlaceholder: "Szukaj restauracji lub dan...",
    categoriesTitle: "Kategorie",
    showAll: "Zobacz wszystkie",
    showLess: "Pokaz mniej",
    homeEyebrow: "W poblizu",
    deliveryLocation: "Adres dostawy",
    locationNotSet: "Dodaj adres podczas skladania zamowienia",
    navHome: "Start",
    navOrders: "Zamowienia",
    navReservations: "Rezerwacje",
    navProfile: "Profil",
    platformHome: "Wroc do ekranu glownego",
    customerNavigationAria: "Nawigacja klienta",
    backToRestaurants: "Wstecz",
    restaurantOpen: "Otwarte",
    restaurantClosed: "Zamkniete",
    restaurantClosedBrowse: "Mozesz przegladac menu, ale restauracja nie przyjmuje teraz zamowien.",
    restaurantClosedOrder: "Restauracja jest zamknieta i nie moze teraz przyjac zamowienia.",
    restaurantRegionMismatch: "Ta restauracja znajduje sie w innym kraju. Zaktualizuj lokalizacje i wybierz restauracje w swoim regionie.",
    deliveryCalculatedAtCheckout: "Dostawa obliczana dla Twojego adresu",
    ordersEyebrow: "Sledzenie",
    activeOrderTitle: "Aktywne zamowienie",
    noActiveOrder: "Nie masz aktywnego zamowienia.",
    reservationsEyebrow: "Twoje stoliki",
    reservationsEmpty: "Nie masz zapisanych rezerwacji.",
    profileEyebrow: "Konto i preferencje",
    profileName: "Imie i nazwisko",
    profilePhone: "Telefon",
    profileAddress: "Adres",
    profileNotSet: "Brak danych",
    privacySummary: "Prywatnosc i dane",
    legalNotice: "Uzywamy podanych danych do utworzenia konta, przygotowania zamowienia, dostawy, historii i czatu. Aplikacja uzywa technicznego localStorage/cookies do sesji, jezyka, koszyka i dzialania.",
    accountPanelAria: "Konto klienta",
    accountTitle: "Moje konto",
    accountGuest: "Mozesz zamowic jako gosc. Zaloguj sie lub utworz konto, jesli chcesz zapisac historie.",
    accountSignedIn: "Zalogowano jako {email}. Twoje zamowienia beda zapisane w historii.",
    restaurantPanelAria: "Wybierz restauracje",
    restaurantTitle: "Wybierz restauracje",
    restaurantHelp: "Znajdz restauracje, w ktorej chcesz zlozyc zamowienie.",
    restaurantSelected: "Wybrana restauracja: {name}. Mozesz teraz zobaczyc menu i wyslac zamowienie.",
    restaurantSingleSelected: "{name} jest gotowe na Twoje zamowienie.",
    restaurantSearchLabel: "Szukaj restauracji",
    restaurantSearchPlaceholder: "Nazwa, miasto lub adres",
    restaurantRefresh: "Odswiez restauracje",
    restaurantLoading: "Ladowanie restauracji...",
    restaurantEmpty: "Nie ma jeszcze opublikowanych restauracji.",
    restaurantSearchEmpty: "Nie znaleziono restauracji dla \"{query}\".",
    restaurantLoadError: "Nie udalo sie zaladowac restauracji. Sprawdz internet i sprobuj ponownie.",
    restaurantUnavailable: "Ta restauracja zostala zamknieta lub usunieta i nie przyjmuje juz zamowien.",
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
    registerCountryLabel: "Kraj",
    countrySelectPlaceholder: "Wybierz kraj",
    registerRegionLabel: "Wojewodztwo / departament",
    regionSelectCountryFirst: "Najpierw wybierz kraj",
    regionSelectPlaceholder: "Wybierz region",
    registerCityLabel: "Miejscowosc",
    cityPlaceholder: "Miasto, gmina, wieś lub inna miejscowosc",
    registerAddressLabel: "Adres do rejestracji",
    registerNeighborhoodLabel: "Dzielnica / obszar",
    registerNeighborhoodPlaceholder: "Dzielnica, obszar lub wskazowka lokalna",
    registerPostalCodeLabel: "Kod pocztowy",
    postalCodePlaceholder: "Kod pocztowy (opcjonalnie)",
    registerReferenceLabel: "Wskazowki do adresu",
    privacyConsent: "Akceptuje przetwarzanie danych do obslugi zamowien, historii, dostawy, czatu i niezbednych cookies technicznych.",
    signIn: "Zaloguj",
    signUp: "Utworz konto klienta",
    resetPassword: "Odzyskaj haslo",
    resendVerification: "Wyslij weryfikacje ponownie",
    newPasswordLabel: "Nowe haslo",
    updatePassword: "Zapisz nowe haslo",
    cancel: "Anuluj",
    signOut: "Wyloguj",
    signingIn: "Logowanie...",
    signingUp: "Tworzenie konta...",
    signedIn: "Zalogowano.",
    signedOut: "Wylogowano.",
    accountCreated: "Konto utworzone. RC ORDERA wyslala e-mail weryfikacyjny. Otworz wiadomosc, potwierdz konto i potem sie zaloguj.",
    resetEmailRequired: "Wpisz e-mail, aby odzyskac haslo.",
    resetSending: "RC ORDERA wysyla e-mail do odzyskania hasla...",
    resetSent: "E-mail wyslany przez RC ORDERA. Otworz link, aby utworzyc nowe haslo.",
    resendEmailRequired: "Wpisz e-mail, aby ponownie wyslac weryfikacje.",
    resendSending: "RC ORDERA ponownie wysyla e-mail weryfikacyjny...",
    resendSent: "E-mail weryfikacyjny wyslany ponownie przez RC ORDERA. Sprawdz skrzynke, spam lub promocje.",
    recoveryTitle: "Nowe haslo",
    recoveryReady: "RC ORDERA zweryfikowala link. Wpisz nowe haslo.",
    newPasswordShort: "Nowe haslo musi miec minimum 6 znakow.",
    passwordUpdated: "Haslo zaktualizowane. Mozesz zalogowac sie do RC ORDERA.",
    accountRequired: "Mozesz wyslac zamowienie jako gosc po wpisaniu danych. Logowanie jest potrzebne tylko do historii.",
    authMissing: "Wpisz e-mail i haslo.",
    authPasswordShort: "Haslo musi miec minimum 6 znakow.",
    authError: "Nie udalo sie zakonczyc logowania.",
    authInvalidCredentials: "Nieprawidlowy e-mail lub haslo.",
    authEmailConfirm: "RC ORDERA wyslala e-mail weryfikacyjny. Sprawdz poczte, potwierdz konto i zaloguj sie ponownie.",
    authAlreadyRegistered: "Ten e-mail ma juz konto. Sprobuj sie zalogowac.",
    privacyRequired: "Zaakceptuj przetwarzanie danych, aby utworzyc konto.",
    historyPanelAria: "Historia klienta",
    historyTitle: "Moje zamowienia",
    refreshHistory: "Odswiez",
    historySignIn: "Zaloguj sie, aby zobaczyc poprzednie zamowienia.",
    historyEmpty: "Nie masz jeszcze zapisanych zamowien.",
    historyLoadError: "Nie udalo sie zaladowac historii. Sprawdz internet i sprobuj ponownie.",
    historyOpenOrder: "Zobacz status i czat",
    historyRepeatOrder: "Zamow ponownie",
    historyRepeatReady: "Koszyk zostal zaktualizowany o produkty i ceny dostepne teraz.",
    historyRepeatPartial: "Niektore produkty nie sa juz dostepne. Dodano aktywne produkty z aktualnymi cenami.",
    historyRepeatUnavailable: "Zaden produkt z tego zamowienia nie jest obecnie dostepny.",
    favoriteRestaurant: "Dodaj restauracje do ulubionych",
    unfavoriteRestaurant: "Usun restauracje z ulubionych",
    favoriteSignIn: "Zaloguj sie jako klient, aby zapisywac ulubione.",
    favoriteSaveError: "Nie udalo sie zaktualizowac ulubionych.",
    orderTimelineLabel: "Postep zamowienia",
    timelineCreated: "Zamowienie utworzone",
    timelineSubmitted: "Zamowienie wyslane",
    timelineAccepted: "Restauracja zaakceptowala",
    timelinePreparing: "W przygotowaniu",
    timelineReady: "Zamowienie gotowe",
    timelineCourierOffered: "Szukamy kuriera",
    timelineCourierAccepted: "Kurier przydzielony",
    timelineCourierArrivedRestaurant: "Kurier dotarl do restauracji",
    timelineOnTheWay: "Zamowienie w drodze",
    timelineCourierArrivedCustomer: "Kurier dotarl",
    timelineDelivered: "Zamowienie dostarczone",
    timelineCancelled: "Zamowienie anulowane",
    courierTrackingTitle: "Sledzenie kuriera",
    courierTrackingWaiting: "Lokalizacja pojawi sie, gdy kurier zaakceptuje dostawe.",
    courierTrackingName: "Kurier: {name}",
    courierTrackingLocation: "Lokalizacja zaktualizowana {time}",
    courierTrackingEta: "Szacowany czas przyjazdu: {time}",
    courierTrackingMap: "Otworz lokalizacje na mapie",
    courierTrackingNow: "teraz",
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
    pickup: "Na wynos / odbiór w lokalu",
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
    deliveryHelp: "Odleglosc i koszt dostawy sa bezpiecznie obliczane z rzeczywistej trasy przed wyslaniem zamowienia.",
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
    appConnectionLoadError: "Nie udalo sie zaladowac polaczenia aplikacji. Sprawdz internet i sprobuj ponownie.",
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
    orderRateLimited: "Wysłano zbyt wiele zamówień w krótkim czasie. Odczekaj kilka minut i spróbuj ponownie.",
    menuChangedBeforeOrder: "Menu zmienilo sie przed potwierdzeniem zamowienia. Zaladowalismy aktualne produkty i ceny; sprawdz koszyk.",
    orderSent: "Zamowienie wyslane. Poczekaj na potwierdzenie restauracji.",
    orderSentWaiting: "Zamowienie wyslane. Oczekiwanie na akceptacje restauracji.",
    orderSentCashier: "Zamowienie wyslane. Restauracja potwierdzi status w kasie.",
    accepted: "Zamowienie zaakceptowane przez restauracje.{ticket}",
    sent: "Zamowienie wyslane przez restauracje.{ticket}",
    delivered: "Zamowienie dostarczone. Dziekujemy za zakup.{ticket}",
    cancelled: "Zamowienie anulowane. Skontaktuj sie z restauracja, aby potwierdzic.",
    ticketSuffix: " Bilet #{ticket}.",
    registerNameRequired: "Wpisz pelne imie i nazwisko, aby utworzyc konto.",
    registerCountryRequired: "Wybierz Kolumbie albo Polske.",
    registerRegionRequired: "Wybierz departament lub wojewodztwo.",
    registerCityRequired: "Wpisz miasto, gmine, wieś lub inna miejscowosc.",
    nameRequired: "Wpisz imie, aby wyslac zamowienie.",
    phoneRequired: "Wpisz telefon do dostawy.",
    addressRequired: "Wpisz pelny adres dostawy.",
    distanceRequired: "Oblicz trase dostawy przed wyslaniem zamowienia.",
    deliveryQuoteRequired: "Oblicz trase ponownie. Wycena musi byc wazna podczas wysylania zamowienia.",
    locationDeliveryOnly: "Lokalizacja jest uzywana tylko dla dostawy.",
    locationUnsupported: "Ta przegladarka nie pozwala udostepnic lokalizacji.",
    locationRequest: "Prosba o pozwolenie na lokalizacje...",
    locationReceived: "Lokalizacja odebrana. Proba obliczenia odleglosci...",
    locationReceivedManual: "Lokalizacja odebrana. Aby obliczyc automatycznie, trzeba skonfigurowac Google Maps; mozna tez wpisac kilometry recznie.",
    locationAddressFilled: "Lokalizacja odebrana i przyblizony adres uzupelniony.",
    locationAddressUnavailable: "Lokalizacja odebrana. Nie udalo sie zamienic jej na adres, ale mozna liczyc dystans z koordynatow.",
    locationError: "Nie udalo sie pobrac lokalizacji. Mozesz wpisac adres i kilometry recznie.",
    locationSecureRequired: "Lokalizacja wymaga bezpiecznego adresu HTTPS opublikowanej aplikacji RC ORDERA.",
    locationPermissionDenied: "Odmowiono dostepu do lokalizacji. Wlacz uprawnienie lub wpisz adres.",
    locationUnavailable: "Urzadzenie nie moglo ustalic lokalizacji. Sprobuj ponownie lub wpisz adres.",
    locationTimeout: "Ustalanie lokalizacji trwalo zbyt dlugo. Sprobuj ponownie lub wpisz adres.",
    mapsNeedAddress: "Restauracja musi skonfigurowac adres, aby uzyc Google Maps.",
    mapsNeedKey: "Brakuje klucza Google Maps API. Mozesz wpisac km recznie.",
    mapsNeedDestination: "Wpisz adres albo pozwol uzyc lokalizacji przed obliczeniem.",
    mapsCalculating: "Obliczanie odleglosci w Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Dostawa: {fee}",
    mapsManual: "{error} Sprawdz adres i sprobuj ponownie.",
    mapsFallback: "Nie udalo sie obliczyc w Google Maps.",
    manualDistanceHelp: "Wpisz lub potwierdz adres i nacisnij Oblicz z Google Maps.",
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
    onlinePayment: "Płatność online — BLIK, karta i inne",
    payOnlineNow: "Zapłać teraz bezpiecznie",
    paymentRedirecting: "Otwieranie bezpiecznej platnosci...",
    onlinePaymentFailed: "Nie udalo sie uruchomic platnosci online. Mozesz sprobowac ponownie przy tym zamowieniu.",
    paymentSuccess: "Platnosc zostala odebrana i jest potwierdzana.",
    paymentCancelled: "Platnosc nie zostala zakonczona. Zamowienie pozostaje dostepne do ponowienia platnosci.",
    confirmDelivery: "Potwierdz odbior zamowienia",
    confirmingDelivery: "Potwierdzanie dostawy...",
    deliveryConfirmed: "Dostawa potwierdzona. Dziekujemy.",
    deliveryConfirmError: "Nie udalo sie potwierdzic dostawy.",
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
    chatLoadError: "Nie udało się załadować czatu. Spróbuj ponownie później.",
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
    documentTitleSuffix: "Customer menu",
    profileSaved: "Your details were saved successfully.",
    profileSaveError: "The profile could not be saved.",
    cartAria: "Cart",
    closeCartAria: "Close cart",
    editProfile: "Edit profile",
    profileAria: "Profile",
    heroEyebrow: "Customer order",
    languageLabel: "Language",
    refreshMenu: "Refresh menu",
    refreshingMenu: "Refreshing menu...",
    menuUpdated: "Menu updated.",
    heroSubtitle: "Scan, choose, and send your order.",
    warning: "Test app: if something is different, the restaurant will confirm the order and any adjustment before preparing it.",
    testEnvironment: "Test environment",
    greeting: "Hello",
    defaultCustomerName: "Customer",
    deliveryTo: "Deliver to",
    homePrompt: "What would you like today?",
    homeSearchPlaceholder: "Search restaurants or dishes...",
    categoriesTitle: "Categories",
    showAll: "See all",
    showLess: "Show less",
    homeEyebrow: "Near you",
    deliveryLocation: "Delivery address",
    locationNotSet: "Add an address when placing your order",
    navHome: "Home",
    navOrders: "Orders",
    navReservations: "Reservations",
    navProfile: "Profile",
    platformHome: "Back to the main screen",
    customerNavigationAria: "Customer navigation",
    backToRestaurants: "Back",
    restaurantOpen: "Open",
    restaurantClosed: "Closed",
    restaurantClosedBrowse: "You can browse the menu, but the restaurant is not accepting orders right now.",
    restaurantClosedOrder: "The restaurant is closed and cannot accept this order right now.",
    restaurantRegionMismatch: "This restaurant belongs to another country. Update your location and choose a restaurant in your region.",
    deliveryCalculatedAtCheckout: "Delivery calculated for your address",
    ordersEyebrow: "Tracking",
    activeOrderTitle: "Active order",
    noActiveOrder: "You do not have an active order.",
    reservationsEyebrow: "Your tables",
    reservationsEmpty: "You do not have any reservations.",
    profileEyebrow: "Account and preferences",
    profileName: "Name",
    profilePhone: "Phone",
    profileAddress: "Address",
    profileNotSet: "Not provided",
    privacySummary: "Privacy and data",
    legalNotice: "We use the data you enter to create your account, prepare the order, deliver it, keep history, and answer by chat. The app uses technical cookies/localStorage for session, language, cart, and operation.",
    accountPanelAria: "Customer account",
    accountTitle: "My account",
    accountGuest: "You can order as a guest. Sign in or create an account if you want order history.",
    accountSignedIn: "Signed in as {email}. Your orders will be saved in your history.",
    restaurantPanelAria: "Choose restaurant",
    restaurantTitle: "Choose restaurant",
    restaurantHelp: "Find the restaurant where you want to place your order.",
    restaurantSelected: "Selected restaurant: {name}. You can now review the menu and send your order.",
    restaurantSingleSelected: "{name} is ready for your order.",
    restaurantSearchLabel: "Search restaurant",
    restaurantSearchPlaceholder: "Name, city, or address",
    restaurantRefresh: "Refresh restaurants",
    restaurantLoading: "Loading restaurants...",
    restaurantEmpty: "No restaurants have been published yet.",
    restaurantSearchEmpty: "No restaurants found for \"{query}\".",
    restaurantLoadError: "Could not load restaurants. Check internet and try again.",
    restaurantUnavailable: "This restaurant was closed or removed and is no longer accepting orders.",
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
    registerCountryLabel: "Country",
    countrySelectPlaceholder: "Select a country",
    registerRegionLabel: "Department / voivodeship",
    regionSelectCountryFirst: "Select a country first",
    regionSelectPlaceholder: "Select a region",
    registerCityLabel: "Locality",
    cityPlaceholder: "City, municipality, town, village, or other locality",
    registerAddressLabel: "Registration address",
    registerNeighborhoodLabel: "Neighborhood / area",
    registerNeighborhoodPlaceholder: "Neighborhood, area, or local reference",
    registerPostalCodeLabel: "Postal code",
    postalCodePlaceholder: "Postal code (optional)",
    registerReferenceLabel: "Address reference",
    privacyConsent: "I accept data processing for orders, history, delivery, chat, and necessary technical cookies.",
    signIn: "Sign in",
    signUp: "Create customer account",
    resetPassword: "Recover password",
    resendVerification: "Resend verification",
    newPasswordLabel: "New password",
    updatePassword: "Save new password",
    cancel: "Cancel",
    signOut: "Sign out",
    signingIn: "Signing in...",
    signingUp: "Creating account...",
    signedIn: "Signed in.",
    signedOut: "Signed out.",
    accountCreated: "Account created. RC ORDERA sent you a verification email. Open it, confirm the account, then sign in.",
    resetEmailRequired: "Enter your email to recover the password.",
    resetSending: "RC ORDERA is sending the recovery email...",
    resetSent: "Email sent by RC ORDERA. Open the link to create a new password.",
    resendEmailRequired: "Enter your email to resend verification.",
    resendSending: "RC ORDERA is resending the verification email...",
    resendSent: "Verification email resent by RC ORDERA. Check inbox, spam, or promotions.",
    recoveryTitle: "New password",
    recoveryReady: "RC ORDERA verified the link. Enter your new password.",
    newPasswordShort: "The new password must be at least 6 characters.",
    passwordUpdated: "Password updated. You can now sign in to RC ORDERA.",
    accountRequired: "You can send the order as a guest after entering your details. Sign in only if you want order history.",
    authMissing: "Enter email and password.",
    authPasswordShort: "Password must be at least 6 characters.",
    authError: "Could not complete account access.",
    authInvalidCredentials: "Email or password is incorrect.",
    authEmailConfirm: "RC ORDERA sent a verification email. Check your email, confirm the account, and sign in again.",
    authAlreadyRegistered: "That email already has an account. Try signing in.",
    privacyRequired: "Accept data processing to create the account.",
    historyPanelAria: "Customer history",
    historyTitle: "My orders",
    refreshHistory: "Refresh",
    historySignIn: "Sign in to see your previous orders.",
    historyEmpty: "You do not have saved orders yet.",
    historyLoadError: "Could not load history. Check internet and try again.",
    historyOpenOrder: "View status and chat",
    historyRepeatOrder: "Order again",
    historyRepeatReady: "The cart now uses the products and prices currently available.",
    historyRepeatPartial: "Some products are no longer available. Active items were added with current prices.",
    historyRepeatUnavailable: "None of the products in that order are currently available.",
    favoriteRestaurant: "Save favorite restaurant",
    unfavoriteRestaurant: "Remove restaurant from favorites",
    favoriteSignIn: "Sign in as a customer to save favorites.",
    favoriteSaveError: "The favorite could not be updated.",
    orderTimelineLabel: "Order progress",
    timelineCreated: "Order created",
    timelineSubmitted: "Order submitted",
    timelineAccepted: "Restaurant accepted",
    timelinePreparing: "Preparing",
    timelineReady: "Order ready",
    timelineCourierOffered: "Finding a courier",
    timelineCourierAccepted: "Courier assigned",
    timelineCourierArrivedRestaurant: "Courier arrived at restaurant",
    timelineOnTheWay: "Order on the way",
    timelineCourierArrivedCustomer: "Courier arrived",
    timelineDelivered: "Order delivered",
    timelineCancelled: "Order cancelled",
    courierTrackingTitle: "Courier tracking",
    courierTrackingWaiting: "The location will appear after a courier accepts the delivery.",
    courierTrackingName: "Courier: {name}",
    courierTrackingLocation: "Location updated {time}",
    courierTrackingEta: "Estimated arrival: {time}",
    courierTrackingMap: "Open location in map",
    courierTrackingNow: "now",
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
    deliveryHelp: "Distance and delivery cost are securely calculated from the real route before the order is sent.",
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
    appConnectionLoadError: "Could not load the app connection. Check internet and try again.",
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
    orderRateLimited: "Too many orders were sent in a short time. Wait a few minutes before trying again.",
    menuChangedBeforeOrder: "The menu changed before the order was confirmed. Current products and prices are loaded; review your cart.",
    orderSent: "Order sent. Wait for restaurant confirmation.",
    orderSentWaiting: "Order sent. Waiting for the restaurant to accept it.",
    orderSentCashier: "Order sent. The restaurant will confirm the status at the register.",
    accepted: "Order accepted by the restaurant.{ticket}",
    sent: "Order sent by the restaurant.{ticket}",
    delivered: "Order delivered. Thank you for your purchase.{ticket}",
    cancelled: "Order cancelled. Contact the restaurant to confirm.",
    ticketSuffix: " Ticket #{ticket}.",
    registerNameRequired: "Enter your full name to create the account.",
    registerCountryRequired: "Select Colombia or Poland.",
    registerRegionRequired: "Select your department or voivodeship.",
    registerCityRequired: "Enter your city, municipality, town, village, or other locality.",
    nameRequired: "Enter your name to send the order.",
    phoneRequired: "Enter a phone number for delivery.",
    addressRequired: "Enter the full delivery address.",
    distanceRequired: "Calculate the delivery route before sending the order.",
    deliveryQuoteRequired: "Calculate the delivery route again. The quote must still be valid when the order is sent.",
    locationDeliveryOnly: "Location is only used for delivery orders.",
    locationUnsupported: "This browser does not allow location sharing.",
    locationRequest: "Requesting location permission...",
    locationReceived: "Location received. Trying to calculate distance...",
    locationReceivedManual: "Location received. Google Maps must be configured for automatic distance; you can also enter kilometers manually.",
    locationAddressFilled: "Location received and approximate address filled in.",
    locationAddressUnavailable: "Location received. I could not convert it into an address, but distance can be calculated with coordinates.",
    locationError: "Could not get location. You can enter address and kilometers manually.",
    locationSecureRequired: "Location requires opening RC ORDERA from its published secure HTTPS address.",
    locationPermissionDenied: "Location permission was denied. Enable it in the browser or enter the address.",
    locationUnavailable: "The device could not determine your location. Try again or enter the address.",
    locationTimeout: "Location took too long. Try again or enter the address.",
    mapsNeedAddress: "The restaurant must configure its address to use Google Maps.",
    mapsNeedKey: "Google Maps API key is missing. You can enter km manually.",
    mapsNeedDestination: "Enter the address or allow location before calculating.",
    mapsCalculating: "Calculating distance with Google Maps...",
    mapsResult: "Google Maps: {distance}{duration}. Delivery: {fee}",
    mapsManual: "{error} Check the address and try again.",
    mapsFallback: "Could not calculate with Google Maps.",
    manualDistanceHelp: "Enter or confirm the address, then select Calculate with Google Maps.",
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
    onlinePayment: "Online payment — BLIK, card and more",
    payOnlineNow: "Pay securely online",
    paymentRedirecting: "Opening secure payment...",
    onlinePaymentFailed: "Online payment could not be started. You can retry it from this order.",
    paymentSuccess: "The payment was received and is being confirmed.",
    paymentCancelled: "The payment was not completed. The order remains available so you can retry.",
    confirmDelivery: "Confirm that I received the order",
    confirmingDelivery: "Confirming delivery...",
    deliveryConfirmed: "Delivery confirmed. Thank you.",
    deliveryConfirmError: "Delivery could not be confirmed.",
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
    chatLoadError: "The chat could not be loaded. Please try again later.",
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
const CUSTOMER_DESCRIPTION_TRANSLATION_FALLBACKS = {
  en: [
    ["acompanado de", "served with"],
    ["acompanada de", "served with"],
    ["acompanados de", "served with"],
    ["acompanadas de", "served with"],
    ["termino de carne", "meat doneness"],
    ["salsa aparte", "sauce on the side"],
    ["sin cebolla", "without onion"],
    ["sin picante", "not spicy"],
    ["para llevar", "takeaway"],
    ["plato principal", "main dish"],
    ["porcion", "portion"],
    ["bebida", "drink"],
    ["postre", "dessert"],
    ["entrada", "starter"],
    ["extra", "extra"],
    ["bandeja paisa", "bandeja paisa"],
    ["arroz blanco", "white rice"],
    ["arroz con coco", "coconut rice"],
    ["frijoles", "beans"],
    ["lentejas", "lentils"],
    ["garbanzos", "chickpeas"],
    ["carne asada", "grilled beef"],
    ["carne molida", "ground beef"],
    ["carne", "beef"],
    ["pollo asado", "grilled chicken"],
    ["pollo", "chicken"],
    ["res", "beef"],
    ["cerdo", "pork"],
    ["chicharron", "crispy pork belly"],
    ["pescado", "fish"],
    ["camaron", "shrimp"],
    ["camarones", "shrimp"],
    ["huevo", "egg"],
    ["arepa", "corn cake"],
    ["empanada", "empanada"],
    ["patacon", "fried green plantain"],
    ["maduro", "sweet plantain"],
    ["platano", "plantain"],
    ["yuca", "cassava"],
    ["papa", "potato"],
    ["papas", "potatoes"],
    ["ensalada", "salad"],
    ["aguacate", "avocado"],
    ["queso", "cheese"],
    ["maiz", "corn"],
    ["tomate", "tomato"],
    ["cebolla", "onion"],
    ["lechuga", "lettuce"],
    ["cilantro", "cilantro"],
    ["limon", "lime"],
    ["limonada", "lemonade"],
    ["maracuya", "passion fruit"],
    ["guanabana", "soursop"],
    ["mango", "mango"],
    ["mora", "blackberry"],
    ["salsa", "sauce"],
    ["picante", "spicy"],
    ["dulce", "sweet"],
    ["frito", "fried"],
    ["frita", "fried"],
    ["asado", "grilled"],
    ["asada", "grilled"],
    ["cocido", "cooked"],
    ["cocida", "cooked"],
    ["con", "with"],
    ["sin", "without"],
    ["y", "and"],
  ],
  pl: [
    ["acompanado de", "podawane z"],
    ["acompanada de", "podawane z"],
    ["acompanados de", "podawane z"],
    ["acompanadas de", "podawane z"],
    ["termino de carne", "stopien wysmazenia miesa"],
    ["salsa aparte", "sos osobno"],
    ["sin cebolla", "bez cebuli"],
    ["sin picante", "bez ostrego sosu"],
    ["para llevar", "na wynos"],
    ["plato principal", "danie glowne"],
    ["porcion", "porcja"],
    ["bebida", "napoj"],
    ["postre", "deser"],
    ["entrada", "przystawka"],
    ["extra", "extra"],
    ["bandeja paisa", "bandeja paisa"],
    ["arroz blanco", "bialy ryz"],
    ["arroz con coco", "ryz kokosowy"],
    ["frijoles", "fasola"],
    ["lentejas", "soczewica"],
    ["garbanzos", "ciecierzyca"],
    ["carne asada", "grillowana wolowina"],
    ["carne molida", "mielona wolowina"],
    ["carne", "wolowina"],
    ["pollo asado", "grillowany kurczak"],
    ["pollo", "kurczak"],
    ["res", "wolowina"],
    ["cerdo", "wieprzowina"],
    ["chicharron", "chrupiacy boczek"],
    ["pescado", "ryba"],
    ["camaron", "krewetka"],
    ["camarones", "krewetki"],
    ["huevo", "jajko"],
    ["arepa", "placek kukurydziany"],
    ["empanada", "empanada"],
    ["patacon", "smazony zielony banan"],
    ["maduro", "slodki banan"],
    ["platano", "banan plantan"],
    ["yuca", "maniok"],
    ["papa", "ziemniak"],
    ["papas", "ziemniaki"],
    ["ensalada", "salatka"],
    ["aguacate", "awokado"],
    ["queso", "ser"],
    ["maiz", "kukurydza"],
    ["tomate", "pomidor"],
    ["cebolla", "cebula"],
    ["lechuga", "salata"],
    ["cilantro", "kolendra"],
    ["limon", "limonka"],
    ["limonada", "lemoniada"],
    ["maracuya", "marakuja"],
    ["guanabana", "guanabana"],
    ["mango", "mango"],
    ["mora", "jezyna"],
    ["salsa", "sos"],
    ["picante", "ostry"],
    ["dulce", "slodki"],
    ["frito", "smazony"],
    ["frita", "smazona"],
    ["asado", "grillowany"],
    ["asada", "grillowana"],
    ["cocido", "gotowany"],
    ["cocida", "gotowana"],
    ["con", "z"],
    ["sin", "bez"],
    ["y", "i"],
  ],
};
const customerParams = new URLSearchParams(window.location.search);
let customerStoreId = String(customerParams.get("store") || "").trim();
const customerTableFromQr = String(customerParams.get("mesa") || customerParams.get("table") || "").trim();
function customerDetectedRegion(coords = null) {
  const latitude = Number(coords?.latitude ?? coords?.lat);
  const longitude = Number(coords?.longitude ?? coords?.lng);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const browserLanguage = String(navigator.language || "es").toLowerCase();
  let countryCode = "";
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (latitude >= 49 && latitude <= 55.2 && longitude >= 14 && longitude <= 24.3) countryCode = "PL";
    if (latitude >= -5 && latitude <= 14.5 && longitude >= -82 && longitude <= -66) countryCode = "CO";
  }
  if (!countryCode && timezone === "Europe/Warsaw") countryCode = "PL";
  if (!countryCode && timezone === "America/Bogota") countryCode = "CO";
  if (!countryCode && browserLanguage.startsWith("pl")) countryCode = "PL";
  if (!countryCode && browserLanguage.startsWith("es-co")) countryCode = "CO";
  return {
    countryCode,
    country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : "",
    city: "",
    region: "",
    postalCode: "",
    timezone,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}
const CUSTOMER_CATEGORY_LABELS = {
  es: {
    all: "Todos", colombiana: "Colombiana", polaca: "Polaca", mexicana: "Mexicana", italiana: "Italiana",
    pizza: "Pizza", hamburguesas: "Hamburguesas", americana: "Americana", pollo: "Pollo", parrilla: "Parrilla",
    bbq: "BBQ", mariscos: "Mariscos", pescados: "Pescados", sushi: "Sushi", japonesa: "Japonesa", china: "China",
    coreana: "Coreana", tailandesa: "Tailandesa", vietnamita: "Vietnamita", india: "India", arabe: "Árabe",
    turca: "Turca", griega: "Griega", mediterranea: "Mediterránea", espanola: "Española", francesa: "Francesa",
    peruana: "Peruana", venezolana: "Venezolana", brasilena: "Brasileña", argentina: "Argentina", latina: "Latina",
    africana: "Africana", caribena: "Caribeña", vegetariana: "Vegetariana", vegana: "Vegana", saludable: "Saludable",
    ensaladas: "Ensaladas", sopas: "Sopas", desayunos: "Desayunos", brunch: "Brunch", sandwiches: "Sandwiches",
    hotdogs: "Hot Dogs", empanadas: "Empanadas", "comida-rapida": "Comida rápida", "street-food": "Street Food",
    panaderia: "Panadería", cafeteria: "Cafetería", postres: "Postres", helados: "Helados", dulces: "Dulces",
    bebidas: "Bebidas", jugos: "Jugos", "comida-casera": "Casera", familiar: "Familiar", other: "Otras",
  },
  pl: {
    all: "Wszystkie", colombiana: "Kolumbijska", polaca: "Polska", mexicana: "Meksykańska", italiana: "Włoska",
    pizza: "Pizza", hamburguesas: "Burgery", americana: "Amerykańska", pollo: "Kurczak", parrilla: "Grill",
    bbq: "BBQ", mariscos: "Owoce morza", pescados: "Ryby", sushi: "Sushi", japonesa: "Japońska", china: "Chińska",
    coreana: "Koreańska", tailandesa: "Tajska", vietnamita: "Wietnamska", india: "Indyjska", arabe: "Arabska",
    turca: "Turecka", griega: "Grecka", mediterranea: "Śródziemnomorska", espanola: "Hiszpańska", francesa: "Francuska",
    peruana: "Peruwiańska", venezolana: "Wenezuelska", brasilena: "Brazylijska", argentina: "Argentyńska", latina: "Latynoamerykańska",
    africana: "Afrykańska", caribena: "Karaibska", vegetariana: "Wegetariańska", vegana: "Wegańska", saludable: "Zdrowe",
    ensaladas: "Sałatki", sopas: "Zupy", desayunos: "Śniadania", brunch: "Brunch", sandwiches: "Kanapki",
    hotdogs: "Hot dogi", empanadas: "Empanady", "comida-rapida": "Fast food", "street-food": "Street food",
    panaderia: "Piekarnia", cafeteria: "Kawiarnia", postres: "Desery", helados: "Lody", dulces: "Słodycze",
    bebidas: "Napoje", jugos: "Soki", "comida-casera": "Domowe", familiar: "Dla rodziny", other: "Inne",
  },
  en: {
    all: "All", colombiana: "Colombian", polaca: "Polish", mexicana: "Mexican", italiana: "Italian",
    pizza: "Pizza", hamburguesas: "Burgers", americana: "American", pollo: "Chicken", parrilla: "Grill",
    bbq: "BBQ", mariscos: "Seafood", pescados: "Fish", sushi: "Sushi", japonesa: "Japanese", china: "Chinese",
    coreana: "Korean", tailandesa: "Thai", vietnamita: "Vietnamese", india: "Indian", arabe: "Arabic",
    turca: "Turkish", griega: "Greek", mediterranea: "Mediterranean", espanola: "Spanish", francesa: "French",
    peruana: "Peruvian", venezolana: "Venezuelan", brasilena: "Brazilian", argentina: "Argentinian", latina: "Latin American",
    africana: "African", caribena: "Caribbean", vegetariana: "Vegetarian", vegana: "Vegan", saludable: "Healthy",
    ensaladas: "Salads", sopas: "Soups", desayunos: "Breakfast", brunch: "Brunch", sandwiches: "Sandwiches",
    hotdogs: "Hot Dogs", empanadas: "Empanadas", "comida-rapida": "Fast food", "street-food": "Street Food",
    panaderia: "Bakery", cafeteria: "Cafe", postres: "Desserts", helados: "Ice cream", dulces: "Sweets",
    bebidas: "Drinks", jugos: "Juices", "comida-casera": "Home-style", familiar: "Family", other: "Other",
  },
};
const CUSTOMER_REGIONS = {
  PL: [
    "Dolnośląskie", "Kujawsko-Pomorskie", "Lubelskie", "Lubuskie", "Łódzkie", "Małopolskie",
    "Mazowieckie", "Opolskie", "Podkarpackie", "Podlaskie", "Pomorskie", "Śląskie",
    "Świętokrzyskie", "Warmińsko-Mazurskie", "Wielkopolskie", "Zachodniopomorskie",
  ],
  CO: [
    "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá",
    "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare",
    "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo",
    "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
    "Valle del Cauca", "Vaupés", "Vichada", "Bogotá D.C.",
  ],
};
function customerCountryName(countryCode) {
  if (countryCode === "PL") return "Polonia";
  if (countryCode === "CO") return "Colombia";
  return "";
}
function customerRenderRegistrationRegions(countryCode, selectedRegion = "") {
  const select = customerElements.registerRegionInput;
  if (!select) return;
  const regions = CUSTOMER_REGIONS[countryCode] || [];
  const selected = customerNormalizeText(selectedRegion);
  const options = [...regions];
  if (selected && !options.includes(selected)) options.push(selected);
  select.innerHTML = `
    <option value="">${customerEscapeHtml(customerT(countryCode ? "regionSelectPlaceholder" : "regionSelectCountryFirst"))}</option>
    ${options.map((region) => `<option value="${customerEscapeHtml(region)}" ${region === selected ? "selected" : ""}>${customerEscapeHtml(region)}</option>`).join("")}
  `;
  select.disabled = regions.length === 0;
}
function customerSyncRegistrationRegionFromInputs(base = customerRegistrationRegion) {
  const countryCode = customerInputValue(customerElements.registerCountryInput).toUpperCase() || base.countryCode || "";
  return {
    ...base,
    countryCode,
    country: customerCountryName(countryCode) || base.country || "",
    region: customerInputValue(customerElements.registerRegionInput) || base.region || "",
    city: customerInputValue(customerElements.registerCityInput) || base.city || "",
    postalCode: customerInputValue(customerElements.registerPostalCodeInput) || base.postalCode || "",
    timezone: countryCode === "PL" ? "Europe/Warsaw" : countryCode === "CO" ? "America/Bogota" : base.timezone || "",
  };
}
function customerRegistrationPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation || (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname))) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}
function customerInitialLanguage() {
  const fromUrl = String(customerParams.get("lang") || "").toLowerCase();
  let saved = "";
  try {
    saved = String(
      localStorage.getItem(CUSTOMER_LANGUAGE_KEY) ||
      localStorage.getItem(CUSTOMER_APP_LANGUAGE_KEY) ||
      ""
    ).toLowerCase();
  } catch {}
  const browser = String(navigator.language || "").toLowerCase();
  if (CUSTOMER_I18N[fromUrl]) return fromUrl;
  if (CUSTOMER_I18N[saved]) return saved;
  if (browser.startsWith("pl")) return "pl";
  if (browser.startsWith("en")) return "en";
  return "es";
}
let customerLanguage = customerInitialLanguage();
let customerRegistrationRegion = customerDetectedRegion();
let customerDescriptionTranslations = customerReadDescriptionTranslationCache();
let customerDescriptionTranslationRequests = new Set();
let customerDescriptionTranslationFailures = new Map();
let customerDescriptionTranslationRenderTimer = null;
function customerT(key, values = {}) {
  const dictionary = CUSTOMER_I18N[customerLanguage] || CUSTOMER_I18N.es;
  const fallback = CUSTOMER_I18N.es[key] || key;
  let template = String(dictionary[key] || fallback);
  if (customerLanguage === "es" && window.RC_ORDERA_OFFLINE_I18N?.spanishText) {
    template = window.RC_ORDERA_OFFLINE_I18N.spanishText(template);
  }
  if (customerLanguage === "pl" && window.RC_ORDERA_OFFLINE_I18N?.polishText) {
    template = window.RC_ORDERA_OFFLINE_I18N.polishText(template);
  }
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}
function customerReadDescriptionTranslationCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOMER_TRANSLATION_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function customerSaveDescriptionTranslationCache() {
  try {
    const entries = Object.entries(customerDescriptionTranslations).slice(-450);
    localStorage.setItem(CUSTOMER_TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // La traduccion sigue funcionando aunque el navegador limite el almacenamiento.
  }
}
function customerDescriptionTranslationKey(language, text) {
  return `auto>${language}|${String(text || "").trim()}`;
}
function customerNormalizeDescriptionForFallback(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function customerEscapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function customerFallbackDescriptionTranslation(text, language) {
  const description = customerNormalizeProductDescription(text);
  if (!description || language === "es") return description;
  const replacements = CUSTOMER_DESCRIPTION_TRANSLATION_FALLBACKS[language] || [];
  if (!replacements.length) return description;
  let translated = ` ${customerNormalizeDescriptionForFallback(description)} `;
  replacements
    .slice()
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([source, target]) => {
      const cleanSource = customerNormalizeDescriptionForFallback(source);
      const pattern = new RegExp(`(^|[^a-z0-9])${customerEscapeRegExp(cleanSource)}(?=$|[^a-z0-9])`, "g");
      translated = translated.replace(pattern, `$1${target}`);
    });
  translated = translated.replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim();
  if (translated) translated = translated[0].toUpperCase() + translated.slice(1);
  return translated && translated !== customerNormalizeDescriptionForFallback(description) ? translated : description;
}
function customerMenuTextDisplay(text) {
  const cleanText = customerNormalizeProductDescription(text);
  if (!cleanText) return "";
  const key = customerDescriptionTranslationKey(customerLanguage, cleanText);
  return customerDescriptionTranslations[key] || customerFallbackDescriptionTranslation(cleanText, customerLanguage);
}
function customerDescriptionDisplay(dish) {
  return customerMenuTextDisplay(dish?.description || "");
}
function customerScheduleDescriptionRender() {
  if (customerDescriptionTranslationRenderTimer) return;
  customerDescriptionTranslationRenderTimer = window.setTimeout(() => {
    customerDescriptionTranslationRenderTimer = null;
    customerSaveDescriptionTranslationCache();
    customerRenderCategories();
    customerRenderMenu();
    customerRenderSelectedRestaurantDetails();
  }, 120);
}
async function customerFetchDescriptionTranslation(text, language) {
  const description = customerNormalizeProductDescription(text);
  const targetLanguage = ["es", "pl", "en"].includes(language) ? language : "";
  if (!description || !targetLanguage) return description;
  if (!customerClient?.functions) throw new Error("translation service unavailable");
  const { data, error } = await customerClient.functions.invoke("translate-public-content", {
    body: { text: description, targetLanguage },
  });
  if (!error) {
    const translated = customerNormalizeProductDescription(data?.translatedText);
    if (translated) return translated;
  }
  const fallback = customerFallbackDescriptionTranslation(description, targetLanguage);
  if (fallback && fallback.toLowerCase() !== description.toLowerCase()) return fallback;
  if (targetLanguage === "es" && fallback) return fallback;
  throw error || new Error("translation unavailable");
}
function customerQueueMenuTextTranslation(text) {
  const description = customerNormalizeProductDescription(text);
  if (!description || !window.navigator.onLine) return;
  const key = customerDescriptionTranslationKey(customerLanguage, description);
  const failedAt = customerDescriptionTranslationFailures.get(key);
  if (
    customerDescriptionTranslations[key] ||
    customerDescriptionTranslationRequests.has(key) ||
    (failedAt && Date.now() - failedAt < 120000)
  ) {
    return;
  }
  customerDescriptionTranslationFailures.delete(key);
  customerDescriptionTranslationRequests.add(key);
  customerFetchDescriptionTranslation(description, customerLanguage)
    .then((translated) => {
      const cleanTranslated = customerNormalizeProductDescription(translated);
      if (cleanTranslated) {
        customerDescriptionTranslations[key] = cleanTranslated;
        customerScheduleDescriptionRender();
      }
    })
    .catch(() => {
      customerDescriptionTranslationFailures.set(key, Date.now());
    })
    .finally(() => {
      customerDescriptionTranslationRequests.delete(key);
    });
}
function customerQueueDescriptionTranslation(dish) {
  customerQueueMenuTextTranslation(dish?.description || "");
}
function customerRenderGreeting(fullName = customerResolvedProfileName) {
  const firstName = customerNormalizeText(fullName).split(/\s+/)[0] || "";
  if (customerElements.greeting) {
    customerElements.greeting.textContent = firstName ? `${customerT("greeting")}, ` : customerT("greeting");
  }
  if (customerElements.greetingName) {
    customerElements.greetingName.textContent = firstName;
    customerElements.greetingName.hidden = !firstName;
  }
}
function customerResetResolvedIdentity(userId = "") {
  customerIdentityUserId = String(userId || "");
  customerResolvedProfileName = "";
  customerProfileLoaded = false;
  customerRenderGreeting("");
  if (customerElements.profileAvatarInitials) customerElements.profileAvatarInitials.textContent = "C";
}
function customerAdoptIdentityUser(user) {
  const nextUserId = String(user?.id || "");
  if (nextUserId !== customerIdentityUserId) customerResetResolvedIdentity(nextUserId);
}
function customerApplyTranslations() {
  document.documentElement.lang = customerLanguage;
  if (customerElements.languageSelect) customerElements.languageSelect.value = customerLanguage;
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) {
    const manifestName = customerLanguage === "es"
      ? "cliente-manifest.webmanifest"
      : `cliente-manifest.${customerLanguage}.webmanifest`;
    manifest.setAttribute("href", manifestName);
  }
  document.title = `${customerNormalizeBusinessName(customerSettings.businessName)} - ${customerT("documentTitleSuffix")}`;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = customerT(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", customerT(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", customerT(node.dataset.i18nAriaLabel));
  });
  const categoryLabels = CUSTOMER_CATEGORY_LABELS[customerLanguage] || CUSTOMER_CATEGORY_LABELS.es;
  document.querySelectorAll(".customer-category-card[data-category]").forEach((button) => {
    const label = button.querySelector(".customer-category-name");
    const category = String(button.dataset.category || "");
    if (label && categoryLabels[category]) label.textContent = categoryLabels[category];
  });
  customerRenderGreeting();
}
function customerSetLanguage(language) {
  if (!CUSTOMER_I18N[language]) return;
  customerLanguage = language;
  customerDescriptionTranslationFailures = new Map();
try {
  localStorage.setItem(CUSTOMER_LANGUAGE_KEY, language);
  localStorage.setItem(CUSTOMER_APP_LANGUAGE_KEY, language);
} catch {
  // El idioma sigue funcionando aunque el navegador bloquee el almacenamiento.
}
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
  customerRenderLocationSummary();
  customerRenderProfileDetails();
  customerRenderSelectedRestaurantDetails();
  customerRenderRegistrationRegions(
    customerInputValue(customerElements.registerCountryInput) || customerRegistrationRegion.countryCode,
    customerInputValue(customerElements.registerRegionInput) || customerRegistrationRegion.region
  );
}
function customerOrderTypeText(value) {
  if (value === "Recoger en el punto") {
    return customerT("pickup");
  }
  if (value === "Domicilio") {
    return customerT("delivery");
  }
  if (value === "Comer en el punto") {
    return customerT("eatHere");
  }
  return String(value || "");
}
function customerPaymentMethodText(value) {
  if (value === "Transferencia") return customerT("transfer");
  if (value === "Datafono") return customerT("cardTerminal");
  if (value === "Online") return customerT("onlinePayment");
  return customerT("cash");
}
let customerClient = null;
let customerAuthInitialized = false;
let customerAuthStateRevision = 0;
let customerUser = null;
let customerIdentityUserId = "";
let customerResolvedProfileName = "";
let customerProfileLoaded = false;
let customerRecoveringPassword = false;
let customerHistoryRows = [];
let customerRestaurants = [];
let customerRestaurantSearchQuery = "";
let customerRestaurantCategoryFilter = "all";
let customerMenu = CUSTOMER_DEFAULT_MENU;
let customerActiveCategory = "";
let customerSearchQuery = "";
let customerMenuSearchTimer = null;
let customerCart = [];
let customerSettings = {
  businessName: "RC ORDERA",
  businessLogoUrl: "",
  currencySymbol: "$",
  currencyPosition: "before",
  moneyFormat: "us",
  deliveryFee: 0,
  deliveryMinimumFee: 20,
  restaurantAddress: "",
  restaurantOperationalOpen: false,
  openingHours: {},
  restaurantLatitude: null,
  restaurantLongitude: null,
  googleMapsApiKey: "",
  bankAccount: "",
  bankTransferNote: "",
  onlinePaymentProvider: "disabled",
  onlinePaymentNote: "",
};
let customerMapDistance = null;
let googleMapsScriptPromise = null;
const customerPlaceAutocompletes = new Map();
let customerLocationCoords = null;
let customerTrackedOrder = null;
let customerStatusTimer = null;
let customerStatusPollSignature = "";
let customerStatusPollingDelay = CUSTOMER_STATUS_POLL_MIN_MS;
let customerStatusPollInFlight = null;
let customerTrackingRealtimeChannel = null;
let customerTrackingRealtimeSignature = "";
let customerTrackingRealtimeRow = null;
let customerTrackingRefreshTimer = null;
let customerTrackingRealtimeRetryTimer = null;
let customerTrackingRealtimeStableTimer = null;
let customerTrackingRealtimeRetryDelay =
  CUSTOMER_REALTIME_RECONNECT_MIN_MS;
let customerTrackingRealtimeStatus = "idle";
let customerTrackingRpcAvailable = null;
let customerChatTimer = null;
let customerChatLoadInFlight = null;
let customerChatVersion = "";
let customerChatGeneration = 0;
let customerChatConditionalSupported = true;
let customerChatPollSignature = "";
let customerChatPollingDelay = CUSTOMER_CHAT_POLL_MIN_MS;
let customerKnownChatMessageIds = new Set();
let customerChatLoadedOnce = false;
let customerMenuRealtimeChannel = null;
let customerMenuRealtimeStoreId = "";
let customerMenuRealtimeTimer = null;
let customerMenuRealtimeRetryTimer = null;
let customerMenuRealtimeStableTimer = null;
let customerMenuRealtimeRetryDelay =
  CUSTOMER_REALTIME_RECONNECT_MIN_MS;
let customerDirectoryRealtimeChannel = null;
let customerDirectoryRealtimeTimer = null;
let customerDirectoryPollTimer = null;
let customerDirectoryRealtimeRetryTimer = null;
let customerDirectoryRealtimeStableTimer = null;
let customerDirectoryRealtimeRetryDelay =
  CUSTOMER_REALTIME_RECONNECT_MIN_MS;
let customerDirectoryRealtimeStatus = "idle";
let customerDirectoryPollingDelay = CUSTOMER_DIRECTORY_POLL_MIN_MS;
let customerRecoveryInFlight = null;
let customerRecoveryLastCompletedAt = 0;
let customerDirectoryLoadPromise = null;
let customerMenuFetchPromise = null;
let customerMenuFetchStoreId = "";
let customerRestaurantFavorite = false;
let customerCurrentView = customerStoreId ? "store" : "home";
let customerPaymentReturnHandled = false;
const CUSTOMER_DELIVERY_RATES = {
  baseKm: 1.5,
  baseFee: 4.5,
  intermediateLimitKm: 6,
  intermediatePerKm: 1.5,
  longLimitKm: 8,
  longPerKm: 2.5,
  extraLongPerKm: 3.5,
};
function customerSetView(view, options = {}) {
  const allowedViews = new Set(["home", "store", "orders", "profile"]);
  let nextView = allowedViews.has(view) ? view : "home";
  if (nextView === "store" && !customerStoreId) nextView = "home";
  customerCurrentView = nextView;
  customerElements.views.forEach((section) => {
    section.hidden = section.dataset.customerView !== nextView;
  });
  customerElements.viewButtons.forEach((button) => {
    const isCurrent = button.dataset.customerViewTarget === nextView;
    if (isCurrent) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.body.dataset.customerView = nextView;
  if (nextView === "profile") customerRenderProfileDetails();
  if (nextView === "orders") customerRenderActiveOrderState();
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
}
function customerRenderLocationSummary() {
  if (!customerElements.topLocation) return;
  const address = customerNormalizeText(
    customerElements.addressInput?.value || customerElements.registerAddressInput?.value
  );
  const neighborhood = customerNormalizeText(
    customerElements.neighborhoodInput?.value || customerElements.registerNeighborhoodInput?.value
  );
  const summary = [address, neighborhood].filter(Boolean).join(", ");
  customerElements.topLocation.removeAttribute("data-i18n");
  customerElements.topLocation.textContent = summary || customerT("locationNotSet");
}
function customerRenderProfileDetails() {
  if (!customerElements.profileDetails) return;
  if (customerElements.profileEditActions) {
  customerElements.profileEditActions.hidden = !customerUser;
}
  const fullName = customerNormalizeText(
    customerElements.nameInput?.value || customerElements.registerNameInput?.value
  );
  const phone = customerNormalizeText(
    customerElements.phoneInput?.value || customerElements.registerPhoneInput?.value
  );
  const address = customerNormalizeText(
    [
      customerElements.addressInput?.value || customerElements.registerAddressInput?.value,
      customerElements.neighborhoodInput?.value || customerElements.registerNeighborhoodInput?.value,
    ]
      .filter(Boolean)
      .join(", ")
  );
  const fallback = customerT("profileNotSet");
  customerElements.profileDetails.innerHTML = `
    <div><span>${customerEscapeHtml(customerT("profileName"))}</span><strong>${customerEscapeHtml(fullName || fallback)}</strong></div>
    <div><span>${customerEscapeHtml(customerT("profilePhone"))}</span><strong>${customerEscapeHtml(phone || fallback)}</strong></div>
    <div><span>${customerEscapeHtml(customerT("profileAddress"))}</span><strong>${customerEscapeHtml(address || fallback)}</strong></div>
  `;
}
function customerRenderSelectedRestaurantDetails() {
  const selected = customerSelectedRestaurant();
  const originalDescription = selected?.description || "";
  const description = customerMenuTextDisplay(originalDescription);
  customerQueueMenuTextTranslation(originalDescription);
  const address = selected?.address || customerSettings.restaurantAddress || customerT("restaurantNoAddress");
  const isOpen = selected ? selected.operationalOpen === true : customerSettings.restaurantOperationalOpen === true;
  if (customerElements.selectedRestaurantDescription) {
    customerElements.selectedRestaurantDescription.textContent = description;
    customerElements.selectedRestaurantDescription.hidden = !description;
  }
  if (customerElements.selectedRestaurantAddress) {
    customerElements.selectedRestaurantAddress.textContent = address;
  }
  if (customerElements.selectedRestaurantStatus) {
    customerElements.selectedRestaurantStatus.textContent = customerT(isOpen ? "restaurantOpen" : "restaurantClosed");
    customerElements.selectedRestaurantStatus.classList.toggle("is-open", isOpen);
    customerElements.selectedRestaurantStatus.classList.toggle("is-closed", !isOpen);
  }
  if (customerElements.selectedRestaurantDelivery) {
    const hasDistance = customerElements.orderType?.value === "Domicilio" && customerNormalizeDistance(customerElements.distanceInput?.value) > 0;
    customerElements.selectedRestaurantDelivery.textContent = hasDistance
      ? `${customerElements.distanceInput.value} km / ${customerFormatMoney(customerDeliveryFee())}`
      : customerT("deliveryCalculatedAtCheckout");
  }
  customerRenderFavoriteRestaurantButton();
}
function customerRenderFavoriteRestaurantButton() {
  const button = customerElements.favoriteRestaurantButton;
  if (!button) return;
  const active = Boolean(customerUser && customerStoreId && customerRestaurantFavorite);
  const label = customerT(active ? "unfavoriteRestaurant" : "favoriteRestaurant");
  button.disabled = !customerStoreId;
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  const icon = button.querySelector("span");
  if (icon) icon.textContent = active ? "\u2665" : "\u2661";
}
async function customerLoadFavoriteRestaurant() {
  customerRestaurantFavorite = false;
  if (!customerClient || !customerUser || !customerStoreId) {
    customerRenderFavoriteRestaurantButton();
    return;
  }
  const { data, error } = await customerClient
    .from("customer_favorites")
    .select("id")
    .eq("customer_user_id", customerUser.id)
    .eq("restaurant_user_id", customerStoreId)
    .eq("favorite_type", "restaurant")
    .eq("product_id", "")
    .limit(1);
  if (!error) customerRestaurantFavorite = Array.isArray(data) && data.length > 0;
  customerRenderFavoriteRestaurantButton();
}
async function customerToggleFavoriteRestaurant() {
  if (!customerUser) {
    customerSetStatus(customerT("favoriteSignIn"), "error");
    customerOpenAuthDialog("login");
    return;
  }
  if (!customerClient || !customerStoreId) return;
  const button = customerElements.favoriteRestaurantButton;
  if (button) button.disabled = true;
  const { data, error } = await customerClient.rpc("toggle_customer_favorite", {
    p_restaurant_user_id: customerStoreId,
    p_favorite_type: "restaurant",
    p_product_id: "",
  });
  if (error) {
    customerSetStatus(customerT("favoriteSaveError"), "error");
  } else {
    customerRestaurantFavorite = data === true;
    customerSetStatus(customerT(customerRestaurantFavorite ? "favoriteRestaurant" : "unfavoriteRestaurant"), "ok");
  }
  customerRenderFavoriteRestaurantButton();
}
function customerRenderActiveOrderState() {
  if (!customerElements.noActiveOrder) return;
  const hasActiveOrder = Boolean(
    customerTrackedOrder ||
      (customerElements.trackingStatus && !customerElements.trackingStatus.hidden) ||
      (customerElements.paymentBox && !customerElements.paymentBox.hidden) ||
      (customerElements.chatPanel && !customerElements.chatPanel.hidden)
  );
  customerElements.noActiveOrder.hidden = hasActiveOrder;
}
const CUSTOMER_PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
function customerRoundMoney(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}
function customerSupabaseConfig() {
  const config = window.RC_ORDERA_SUPABASE || {};
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
function customerConnectionMessage() {
  const config = customerSupabaseConfig();
  if (!config.url || !config.anonKey) return customerT("appNotConfigured");
  if (!window.supabase?.createClient) return customerT("appConnectionLoadError");
  return customerT("appConnectionLoadError");
}
function customerLoadSupabaseLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(true);
  if (!navigator.onLine) return Promise.resolve(false);
  return new Promise((resolve) => {
    const existingScript = document.querySelector("script[data-supabase-loader]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(Boolean(window.supabase?.createClient)), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "vendor/supabase-2.57.4.js";
    script.async = true;
    script.dataset.supabaseLoader = "true";
    script.addEventListener("load", () => resolve(Boolean(window.supabase?.createClient)), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}
function customerFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return customerT("authInvalidCredentials");
  if (/email not confirmed/i.test(message)) return customerT("authEmailConfirm");
  if (/already registered|already exists|user already/i.test(message)) return customerT("authAlreadyRegistered");
  return customerT("authError");
}
function customerSetAuthMessage(message, type = "") {
  if (!customerElements.authMessage) return;
  customerElements.authMessage.textContent = message;
  customerElements.authMessage.dataset.type = type;
  customerElements.authMessage.hidden = !message;
}
function customerMountAuthDialog() {
  if (!customerElements.authDialogBody || !customerElements.authFields) return;
  if (customerElements.authFields.parentElement !== customerElements.authDialogBody) {
    customerElements.authDialogBody.appendChild(customerElements.authFields);
    if (customerElements.authMessage) customerElements.authDialogBody.appendChild(customerElements.authMessage);
  }
}
function customerSetAuthMode(mode = "login") {
  const normalizedMode = mode === "register" ? "register" : "login";
  customerRecoveringPassword = false;
  if (customerElements.passwordRecoveryPanel) customerElements.passwordRecoveryPanel.hidden = true;
  customerElements.authModalForm?.setAttribute("data-mode", normalizedMode);
  if (customerElements.authTitle) {
    customerElements.authTitle.removeAttribute("data-i18n");
    customerElements.authTitle.textContent = normalizedMode === "register" ? customerT("signUp") : customerT("signIn");
  }
  const labels = Array.from(customerElements.authFields?.querySelectorAll("label") || []);
  labels.forEach((label, index) => {
    label.hidden = normalizedMode === "login" && index > 1;
  });
  if (customerElements.signInButton) customerElements.signInButton.hidden = normalizedMode === "register";
  if (customerElements.signUpButton) customerElements.signUpButton.hidden = normalizedMode !== "register";
  if (customerElements.resetPasswordButton) customerElements.resetPasswordButton.hidden = normalizedMode === "register";
  if (customerElements.resendVerificationButton) customerElements.resendVerificationButton.hidden = normalizedMode === "register";
  customerSetAuthMessage("");
}
function customerOpenAuthDialog(mode = "login") {
  customerMountAuthDialog();
  customerSetAuthMode(mode);
  if (customerElements.authDialog?.showModal && !customerElements.authDialog.open) {
    customerElements.authDialog.showModal();
  }
  window.setTimeout(() => {
    customerElements.authDialog?.scrollTo?.({ top: 0, behavior: "instant" });
    customerElements.authModalForm?.scrollTo?.({ top: 0, behavior: "instant" });
    customerElements.authEmail?.focus({ preventScroll: true });
  }, 50);
}
function customerCloseAuthDialog() {
  if (customerElements.authDialog?.open) customerElements.authDialog.close();
}
function customerShowPasswordRecoveryForm() {
  customerMountAuthDialog();
  customerRecoveringPassword = true;
  if (customerElements.authFields) customerElements.authFields.hidden = false;
  customerElements.authModalForm?.setAttribute("data-mode", "recovery");
  if (customerElements.authTitle) {
    customerElements.authTitle.removeAttribute("data-i18n");
    customerElements.authTitle.textContent = customerT("recoveryTitle");
  }
  const labels = Array.from(customerElements.authFields?.querySelectorAll("label") || []);
  labels.forEach((label) => {
    label.hidden = true;
  });
  customerElements.passwordRecoveryPanel?.querySelectorAll("label").forEach((label) => {
    label.hidden = false;
  });
  if (customerElements.signInButton) customerElements.signInButton.hidden = true;
  if (customerElements.signUpButton) customerElements.signUpButton.hidden = true;
  if (customerElements.resetPasswordButton) customerElements.resetPasswordButton.hidden = true;
  if (customerElements.resendVerificationButton) customerElements.resendVerificationButton.hidden = true;
  if (customerElements.passwordRecoveryPanel) customerElements.passwordRecoveryPanel.hidden = false;
  if (customerElements.authDialog?.showModal && !customerElements.authDialog.open) customerElements.authDialog.showModal();
  customerSetAuthMessage(customerT("recoveryReady"), "ok");
  window.setTimeout(() => customerElements.newPasswordInput?.focus(), 50);
}
function customerHidePasswordRecoveryForm(message = "") {
  customerRecoveringPassword = false;
  if (customerElements.newPasswordInput) customerElements.newPasswordInput.value = "";
  customerSetAuthMode("login");
  if (message) customerSetAuthMessage(message, "ok");
}
function customerInputValue(input) {
  return String(input?.value || "").trim();
}
function customerSetInputIfEmpty(input, value) {
  const cleanValue = customerNormalizeText(value);
  if (input && cleanValue && !input.value.trim()) input.value = cleanValue;
}
function customerRegisteredAddressPayload() {
  customerRegistrationRegion = customerSyncRegistrationRegionFromInputs();
  return {
    table: customerInputValue(customerElements.tableInput),
    address: customerInputValue(customerElements.registerAddressInput) || customerInputValue(customerElements.addressInput),
    neighborhood:
      customerInputValue(customerElements.registerNeighborhoodInput) || customerInputValue(customerElements.neighborhoodInput),
    reference: customerInputValue(customerElements.registerReferenceInput) || customerInputValue(customerElements.referenceInput),
    distanceKm: customerInputValue(customerElements.distanceInput),
    country: customerRegistrationRegion.country,
    countryCode: customerRegistrationRegion.countryCode,
    city: customerRegistrationRegion.city,
    region: customerRegistrationRegion.region,
    postalCode: customerRegistrationRegion.postalCode,
    latitude: customerRegistrationRegion.latitude,
    longitude: customerRegistrationRegion.longitude,
  };
}
function customerApplyRegisterFieldsToOrder() {
  customerSetInputIfEmpty(customerElements.nameInput, customerInputValue(customerElements.registerNameInput));
  customerSetInputIfEmpty(customerElements.phoneInput, customerInputValue(customerElements.registerPhoneInput));
  customerSetInputIfEmpty(customerElements.addressInput, customerInputValue(customerElements.registerAddressInput));
  customerSetInputIfEmpty(customerElements.neighborhoodInput, customerInputValue(customerElements.registerNeighborhoodInput));
  customerSetInputIfEmpty(customerElements.referenceInput, customerInputValue(customerElements.registerReferenceInput));
}
function customerApplyProfileFields(
  profile = {},
  options = {}
) {
  const overwrite =
    options.overwrite === true;
  const address = profile.default_address || {};
  const fullName = String(profile.full_name || "").trim();
  const customerAssignProfileValue =
  (element, value) => {
    if (!element) return;
    const cleanValue =
      String(value ?? "").trim();
    if (!cleanValue) return;
    if (
      overwrite ||
      !String(element.value || "").trim()
    ) {
      element.value = cleanValue;
    }
  };
  if (fullName) customerResolvedProfileName = fullName;
  customerRenderGreeting();
  if (customerElements.profileAvatarInitials) {
  const nameParts =
    fullName
      .split(/\s+/)
      .filter(Boolean);
  let initials = "C";
  if (nameParts.length === 1) {
    initials =
      nameParts[0]
        .slice(0, 2)
        .toUpperCase();
  }
  if (nameParts.length >= 2) {
    initials =
      (
        nameParts[0][0] +
        nameParts[nameParts.length - 1][0]
      ).toUpperCase();
  }
  customerElements.profileAvatarInitials.textContent =
    initials;
}
  customerRegistrationRegion = {
    ...customerRegistrationRegion,
    country: address.country || customerRegistrationRegion.country,
    countryCode: address.countryCode || customerRegistrationRegion.countryCode,
    city: address.city || address.neighborhood || customerRegistrationRegion.city,
    region: address.region || customerRegistrationRegion.region,
    postalCode: address.postalCode || customerRegistrationRegion.postalCode,
    latitude: Number.isFinite(Number(address.latitude)) ? Number(address.latitude) : customerRegistrationRegion.latitude,
    longitude: Number.isFinite(Number(address.longitude)) ? Number(address.longitude) : customerRegistrationRegion.longitude,
  };
  if (customerElements.registerCountryInput) {
    customerElements.registerCountryInput.value = customerRegistrationRegion.countryCode || "";
  }
  customerRenderRegistrationRegions(customerRegistrationRegion.countryCode, customerRegistrationRegion.region);
 customerAssignProfileValue(
  customerElements.registerCityInput,
  customerRegistrationRegion.city
);
customerAssignProfileValue(
  customerElements.registerPostalCodeInput,
  customerRegistrationRegion.postalCode
);
customerAssignProfileValue(
  customerElements.registerNameInput,
  profile.full_name
);
customerAssignProfileValue(
  customerElements.registerPhoneInput,
  profile.phone
);
customerAssignProfileValue(
  customerElements.registerAddressInput,
  address.address
);
customerAssignProfileValue(
  customerElements.registerNeighborhoodInput,
  address.neighborhood
);
customerAssignProfileValue(
  customerElements.registerReferenceInput,
  address.reference
);
customerAssignProfileValue(
  customerElements.nameInput,
  profile.full_name
);
customerAssignProfileValue(
  customerElements.phoneInput,
  profile.phone
);
customerAssignProfileValue(
  customerElements.tableInput,
  address.table
);
customerAssignProfileValue(
  customerElements.addressInput,
  address.address
);
customerAssignProfileValue(
  customerElements.neighborhoodInput,
  address.neighborhood
);
customerAssignProfileValue(
  customerElements.referenceInput,
  address.reference
);
customerAssignProfileValue(
  customerElements.distanceInput,
  address.distanceKm
);
  customerRenderLocationSummary();
  customerRenderProfileDetails();
}
function customerProfileFromMetadata() {
  const metadata = customerUser?.user_metadata || {};
  return {
    full_name: metadata.full_name || "",
    phone: metadata.phone || "",
    default_address: metadata.default_address || {
      country: metadata.country || "",
      countryCode: metadata.country_code || "",
      city: metadata.city || "",
      region: metadata.region || "",
      postalCode: metadata.postal_code || "",
      latitude: metadata.registration_latitude ?? null,
      longitude: metadata.registration_longitude ?? null,
    },
  };
}
function customerEnsureClient() {
  if (customerClient) return customerClient;
  const config = customerSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
 customerClient = window.supabase.createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "rc-ordera-customer-auth",
  },
});
  return customerClient;
}
function customerRenderAccount() {
  customerAdoptIdentityUser(customerUser);
  const email = customerUser?.email || "";
  if (customerElements.accountSummary) {
    customerElements.accountSummary.removeAttribute("data-i18n");
    customerElements.accountSummary.textContent = customerUser
      ? customerT("accountSignedIn", { email })
      : customerT("accountGuest");
  }
  if (customerElements.accountActions) customerElements.accountActions.hidden = Boolean(customerUser);
  if (customerElements.authFields) customerElements.authFields.hidden = Boolean(customerUser);
  if (customerElements.signOutButton) customerElements.signOutButton.hidden = !customerUser;
  if (customerElements.sendButton) customerElements.sendButton.disabled = customerCart.length === 0;
  if (customerUser && !customerRecoveringPassword) customerCloseAuthDialog();
  if (customerUser && !customerProfileLoaded) {
    customerApplyProfileFields(customerProfileFromMetadata());
    if (!customerElements.nameInput.value.trim()) {
      const fallbackName = String(email.split("@")[0] || "").trim();
      if (fallbackName) customerElements.nameInput.value = fallbackName;
    }
  }
  customerRenderLocationSummary();
  customerRenderProfileDetails();
  customerRenderFavoriteRestaurantButton();
}
function customerUrlLooksLikeRecovery() {
  return /type=recovery/i.test(window.location.hash) || customerParams.get("type") === "recovery" || customerParams.get("recovery") === "1";
}
async function customerInitializeAuth() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  if (!client || customerAuthInitialized) return;
  customerAuthInitialized = true;
  const { data } = await client.auth.getSession();
  customerUser = data.session?.user || null;
  if (customerUrlLooksLikeRecovery()) customerRecoveringPassword = true;
  customerRenderAccount();
  if (customerRecoveringPassword) customerShowPasswordRecoveryForm();
  if (customerUser) {
    await customerLoadProfile();
    await customerEnsureIdentity();
    await customerLoadHistory();
    await customerLoadFavoriteRestaurant();
  } else {
    customerRenderHistory();
  }
client.auth.onAuthStateChange((event, session) => {
  const previousUserId = customerUser?.id || null;
  const nextUserId = session?.user?.id || null;
  const identityChanged = previousUserId !== nextUserId;
  if (identityChanged) {
    try {
      [sessionStorage, localStorage].forEach((storage) => {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (
            key?.startsWith(`${CUSTOMER_PENDING_ORDER_KEY_PREFIX}_`) ||
            key?.startsWith(`${CUSTOMER_TRACKED_ORDER_KEY_PREFIX}_`)
          ) {
            storage.removeItem(key);
          }
        }
      });
    } catch {}
    customerStopStatusPolling();
    customerStopChatPolling();
    customerStopOrderTrackingRealtime();
    customerTrackedOrder = null;
  }
  customerUser = session?.user || null;
  if (event === "PASSWORD_RECOVERY") {
    customerAuthStateRevision += 1;
    customerShowPasswordRecoveryForm();
    customerRenderAccount();
    return;
  }
  customerRenderAccount();
  if (!customerUser) {
    if (identityChanged) {
      customerAuthStateRevision += 1;
    }
    customerHistoryRows = [];
    customerRestaurantFavorite = false;
    customerRenderHistory();
    customerRenderFavoriteRestaurantButton();
    return;
  }
  const shouldHydrate =
    identityChanged ||
    event === "USER_UPDATED";
  if (!shouldHydrate) {
    return;
  }
  const revision = ++customerAuthStateRevision;
  // Ejecutar la hidratación fuera del callback de Auth evita bloquear
  // llamadas posteriores de Supabase y descarta trabajos obsoletos.
  window.setTimeout(() => {
    (async () => {
      if (revision !== customerAuthStateRevision || !customerUser) return;
      await customerLoadProfile();
      if (revision !== customerAuthStateRevision || !customerUser) return;
      await customerEnsureIdentity();
      if (revision !== customerAuthStateRevision || !customerUser) return;
      await customerLoadHistory();
      if (revision !== customerAuthStateRevision || !customerUser) return;
      await customerLoadFavoriteRestaurant();
    })().catch((error) => {
      if (revision !== customerAuthStateRevision) return;
      console.error(
        "Error procesando cambio de autenticación del cliente:",
        error
      );
    });
  }, 0);
});
}
async function customerSignInWithEmail() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  const password = customerElements.authPassword.value;
  if (!client) {
    customerSetAuthMessage(customerConnectionMessage(), "error");
    return;
  }
  if (!email || !password) {
    customerSetAuthMessage(customerT("authMissing"), "error");
    return;
  }
  customerSetAuthMessage(customerT("signingIn"));
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerUser = data?.user || data?.session?.user || null;
  customerRenderAccount();
  customerElements.authPassword.value = "";
  customerSetAuthMessage(customerT("signedIn"), "ok");
}
async function customerSignUpWithEmail() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  const password = customerElements.authPassword.value;
  const fullName = customerInputValue(customerElements.registerNameInput) || customerInputValue(customerElements.nameInput);
  if (!client) {
    customerSetAuthMessage(customerConnectionMessage(), "error");
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
  if (!customerInputValue(customerElements.registerCountryInput)) {
    customerSetAuthMessage(customerT("registerCountryRequired"), "error");
    customerElements.registerCountryInput?.focus();
    return;
  }
  if (!customerInputValue(customerElements.registerRegionInput)) {
    customerSetAuthMessage(customerT("registerRegionRequired"), "error");
    customerElements.registerRegionInput?.focus();
    return;
  }
  if (!customerInputValue(customerElements.registerCityInput)) {
    customerSetAuthMessage(customerT("registerCityRequired"), "error");
    customerElements.registerCityInput?.focus();
    return;
  }
  customerSetAuthMessage(customerT("locationRequest"));
  const registrationCoords = await customerRegistrationPosition();
  const detectedRegion = customerDetectedRegion(registrationCoords);
  customerRegistrationRegion = customerSyncRegistrationRegionFromInputs({
    ...customerRegistrationRegion,
    ...detectedRegion,
    countryCode: customerInputValue(customerElements.registerCountryInput) || detectedRegion.countryCode,
    region: customerInputValue(customerElements.registerRegionInput),
    city: customerInputValue(customerElements.registerCityInput),
    postalCode: customerInputValue(customerElements.registerPostalCodeInput),
  });
  if (registrationCoords) {
    customerLocationCoords = {
      lat: Number(registrationCoords.latitude),
      lng: Number(registrationCoords.longitude),
    };
    if (customerSettings.googleMapsApiKey) {
      try {
        await customerReverseGeocodeLocation(customerLocationCoords, { preserveManual: true });
      } catch {
        // El registro continua con coordenadas y pais detectado.
      }
    }
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
        app_name: customerSettings.businessName || "RC ORDERA",
        full_name: fullName,
        phone: customerInputValue(customerElements.registerPhoneInput),
        default_address: customerRegisteredAddressPayload(),
        country: customerRegistrationRegion.country,
        country_code: customerRegistrationRegion.countryCode,
        city: customerRegistrationRegion.city,
        region: customerRegistrationRegion.region,
        postal_code: customerRegistrationRegion.postalCode,
        preferred_language: customerLanguage,
        timezone: customerRegistrationRegion.timezone,
        registration_latitude: customerRegistrationRegion.latitude,
        registration_longitude: customerRegistrationRegion.longitude,
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
    await customerEnsureIdentity();
    await customerLoadHistory();
  }
  customerSetAuthMessage(customerT("accountCreated"), "ok");
}
async function customerSendPasswordResetEmail() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  if (!client) {
    customerSetAuthMessage(customerConnectionMessage(), "error");
    return;
  }
  if (!email) {
    customerSetAuthMessage(customerT("resetEmailRequired"), "error");
    customerElements.authEmail?.focus();
    return;
  }
  customerSetAuthMessage(customerT("resetSending"));
  const redirectTo = window.location.href.split("#")[0];
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerSetAuthMessage(customerT("resetSent"), "ok");
}
async function customerResendVerificationEmail() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  const email = customerElements.authEmail.value.trim();
  if (!client) {
    customerSetAuthMessage(customerConnectionMessage(), "error");
    return;
  }
  if (!email) {
    customerSetAuthMessage(customerT("resendEmailRequired"), "error");
    customerElements.authEmail?.focus();
    return;
  }
  customerSetAuthMessage(customerT("resendSending"));
  const redirectTo = window.location.href.split("#")[0].split("?")[0];
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerSetAuthMessage(customerT("resendSent"), "ok");
}
async function customerUpdateRecoveredPassword() {
  if (!customerEnsureClient()) await customerLoadSupabaseLibrary();
  const client = customerEnsureClient();
  const password = customerElements.newPasswordInput?.value || "";
  if (!client) {
    customerSetAuthMessage(customerConnectionMessage(), "error");
    return;
  }
  if (password.length < 6) {
    customerSetAuthMessage(customerT("newPasswordShort"), "error");
    customerElements.newPasswordInput?.focus();
    return;
  }
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    customerSetAuthMessage(customerFriendlyAuthError(error), "error");
    return;
  }
  customerHidePasswordRecoveryForm(customerT("passwordUpdated"));
}
async function customerSignOut() {
  if (!customerClient) return;
  try {
    await customerClient.auth.signOut({ scope: "local" });
  } finally {
    customerStopStatusPolling();
    customerStopChatPolling();
    customerStopOrderTrackingRealtime();
try {
  [sessionStorage, localStorage].forEach((storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (
        key?.startsWith(`${CUSTOMER_PENDING_ORDER_KEY_PREFIX}_`) ||
        key?.startsWith(`${CUSTOMER_TRACKED_ORDER_KEY_PREFIX}_`)
      ) {
        storage.removeItem(key);
      }
    }
  });
} catch {}
    customerTrackedOrder = null;
    customerUser = null;
    customerResetResolvedIdentity();
    customerHistoryRows = [];
    customerRenderAccount();
    window.location.replace("index.html?app=v91.0.4");
  }
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
      country: registeredAddress.country,
      countryCode: registeredAddress.countryCode,
      city: registeredAddress.city,
      region: registeredAddress.region,
      postalCode: registeredAddress.postalCode,
      latitude: registeredAddress.latitude,
      longitude: registeredAddress.longitude,
    },
    language: customerLanguage,
    updated_at: new Date().toISOString(),
  };
}
function customerSplitName(fullName = "") {
  const cleanName = customerNormalizeText(fullName);
  if (!cleanName) return { firstName: "", lastName: "" };
  const parts = cleanName.split(" ");
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}
function customerGeneralProfilePayload() {
  const profile = customerProfilePayload();
  const nameParts = customerSplitName(profile.full_name);
  const defaultAddress = profile.default_address || {};
  return {
    user_id: customerUser.id,
    first_name: nameParts.firstName,
    last_name: nameParts.lastName,
    full_name: profile.full_name,
    phone: profile.phone,
    country: customerRegistrationRegion.country || defaultAddress.country || "",
    city: customerNormalizeText(defaultAddress.city || defaultAddress.neighborhood || customerRegistrationRegion.city || ""),
    country_code: customerNormalizeText(defaultAddress.countryCode || customerRegistrationRegion.countryCode || "").toUpperCase(),
    region: customerNormalizeText(defaultAddress.region || customerRegistrationRegion.region || ""),
    postal_code: customerNormalizeText(defaultAddress.postalCode || customerRegistrationRegion.postalCode || ""),
    preferred_language: customerLanguage,
    registration_latitude: customerRegistrationRegion.latitude ?? defaultAddress.latitude ?? null,
    registration_longitude: customerRegistrationRegion.longitude ?? defaultAddress.longitude ?? null,
    detected_timezone: customerRegistrationRegion.timezone,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}
async function customerActivateRole(role) {
  if (!customerClient || !customerUser) return;
  try {
    const { error } = await customerClient.rpc("activate_user_role", {
      p_role: role,
      p_scope_type: "platform",
      p_scope_id: CUSTOMER_PLATFORM_SCOPE_ID,
    });
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo activar el rol del cliente en la nube.", error);
  }
}
async function customerEnsureIdentity() {
  if (!customerClient || !customerUser) return;
  try {
    const { error } = await customerClient.from("user_profiles").upsert(customerGeneralProfilePayload());
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo actualizar el perfil general del cliente.", error);
  }
  await customerActivateRole("customer");
}
async function customerLoadProfile() {
  if (!customerClient || !customerUser) return;
  const requestedUserId = customerUser.id;
  const { data, error } = await customerClient
    .from("customer_profiles")
    .select("full_name, phone, default_address, language")
    .eq("user_id", requestedUserId)
    .maybeSingle();
  if (customerUser?.id !== requestedUserId) return;
  if (error || !data) {
    const metadataProfile = customerProfileFromMetadata();
    customerApplyProfileFields(metadataProfile);
    if (!error && (metadataProfile.full_name || metadataProfile.phone || Object.keys(metadataProfile.default_address || {}).length)) {
      await customerSaveProfile();
    }
    return;
  }
  customerProfileLoaded = true;
  if (data.language && CUSTOMER_I18N[data.language]) customerSetLanguage(data.language);
  customerApplyProfileFields(
  data,
  {
    overwrite: true
  }
);
  customerRenderDeliveryFields();
}
async function customerSaveProfile() {
  if (!customerClient || !customerUser) {
    throw new Error(
      "No hay una sesión de cliente activa."
    );
  }
  const profile =
    customerProfilePayload();
  /* Guardar perfil específico del cliente */
  const { error: profileError } =
    await customerClient
      .from("customer_profiles")
      .upsert(
        profile,
        {
          onConflict: "user_id"
        }
      );
  if (profileError) {
    throw profileError;
  }
  /* Mantener también actualizado el perfil general */
  const { error: generalProfileError } =
    await customerClient
      .from("user_profiles")
      .upsert(
        customerGeneralProfilePayload(),
        {
          onConflict: "user_id"
        }
      );
  if (generalProfileError) {
    throw generalProfileError;
  }
  /* Actualizar también los datos de Supabase Auth.
     Así al volver a iniciar sesión no aparece
     nuevamente el nombre antiguo. */
  const currentMetadata =
    customerUser.user_metadata || {};
  const { data: authData, error: authError } =
    await customerClient.auth.updateUser({
      data: {
        ...currentMetadata,
        full_name:
          profile.full_name,
        phone:
          profile.phone,
        default_address:
          profile.default_address,
        country:
          profile.default_address?.country || "",
        country_code:
          profile.default_address?.countryCode || "",
        city:
          profile.default_address?.city || "",
        region:
          profile.default_address?.region || "",
        postal_code:
          profile.default_address?.postalCode || "",
        preferred_language:
          customerLanguage
      }
    });
  if (authError) {
    throw authError;
  }
  /* Actualizar también el usuario que tenemos en memoria */
  if (authData?.user) {
    customerUser = authData.user;
  }
  customerResolvedProfileName = profile.full_name;
  customerProfileLoaded = true;
  customerRenderGreeting();
  return profile;
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
            <span>${customerEscapeHtml(customerOrderTypeText(row.order_type))}</span>
            <span>${customerEscapeHtml(itemsText)}</span>
          </div>
          <div class="customer-history-total">
            <strong>${customerEscapeHtml(customerFormatMoney(row.total))}</strong>
            <button class="customer-map-button" type="button" data-action="open-history-order">
              ${customerEscapeHtml(customerT("historyOpenOrder"))}
            </button>
            <button class="customer-map-button" type="button" data-action="repeat-history-order">
              ${customerEscapeHtml(customerT("historyRepeatOrder"))}
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
  customerTrackedOrder.total = Number(row.total) || 0;
  customerPersistTrackedOrder();
  customerSetTrackingStatus(customerStatusText(row), customerStatusType(row.status));
  customerRenderPaymentBox(row.id, Number(row.total) || 0, row.order_json || {});
  customerSetView("orders");
  customerElements.chatPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function customerRepeatHistoryOrder(orderId) {
  const row = customerHistoryRows.find((item) => item.id === orderId);
  if (!row?.restaurant_user_id) return;
  await customerSelectRestaurant(row.restaurant_user_id);
  const repeatedItems = [];
  let unavailableCount = 0;
  customerHistoryItems(row).forEach((historicalItem) => {
    const lookup = {
      productId:
        historicalItem?.product_id ||
        historicalItem?.productId ||
        historicalItem?.id ||
        "",
      name: customerLineName(historicalItem),
    };
    const currentProduct = customerFindCurrentMenuProduct(lookup);
    if (!currentProduct || !customerProductAvailable(currentProduct)) {
      unavailableCount += 1;
      return;
    }
    const quantity = Math.min(99, Math.max(1, Math.trunc(customerLineQuantity(historicalItem))));
    repeatedItems.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      productId:
        customerNormalizeProductId(currentProduct.id || currentProduct.productId) ||
        lookup.productId,
      name: currentProduct.name,
      description: currentProduct.description || "",
      price: Number.parseFloat(currentProduct.price) || 0,
      qty: quantity,
      note: customerNormalizeNoteDraft(
        historicalItem?.note || historicalItem?.options_snapshot?.note || ""
      ),
    });
  });
  if (!repeatedItems.length) {
    customerSetStatus(customerT("historyRepeatUnavailable"), "error");
    return;
  }
  customerCart = repeatedItems;
  if (["Comer en el punto", "Recoger en el punto", "Domicilio"].includes(row.order_type)) {
    customerElements.orderType.value = row.order_type;
  }
  customerRenderDeliveryFields();
  customerRenderCart();
  customerSetView("store");
  customerSetStatus(
    customerT(unavailableCount ? "historyRepeatPartial" : "historyRepeatReady"),
    unavailableCount ? "error" : "ok"
  );
  customerElements.cartItems?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  customerRenderActiveOrderState();
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
const CUSTOMER_RESTAURANT_CATEGORY_KEYWORDS = {
  colombiana: ["colombiana", "colombiano", "colombia"],
  polaca: ["polaca", "polaco", "polska", "polish"],
  mexicana: ["mexicana", "mexicano", "mexico", "taco", "tacos"],
  italiana: ["italiana", "italiano", "italia", "pasta"],
  pizza: ["pizza", "pizzeria"],
  hamburguesas: ["hamburguesa", "hamburguesas", "burger", "burgers"],
  americana: ["americana", "americano", "american"],
  pollo: ["pollo", "chicken"],
  parrilla: ["parrilla", "parrillada", "grill", "steak"],
  bbq: ["bbq", "barbecue", "barbacoa"],
  mariscos: ["marisco", "mariscos", "seafood"],
  pescados: ["pescado", "pescados", "fish"],
  sushi: ["sushi"],
  japonesa: ["japonesa", "japones", "japanese", "japon"],
  china: ["china", "chino", "chinese"],
  coreana: ["coreana", "coreano", "korean", "korea"],
  tailandesa: ["tailandesa", "tailandes", "thai"],
  vietnamita: ["vietnamita", "vietnamese", "vietnam"],
  india: ["india", "indio", "indian"],
  arabe: ["arabe", "arabic", "arabian"],
  turca: ["turca", "turco", "turkish", "turquia"],
  griega: ["griega", "griego", "greek"],
  mediterranea: ["mediterranea", "mediterraneo", "mediterranean"],
  espanola: ["espanola", "espanol", "spanish", "espana"],
  francesa: ["francesa", "frances", "french", "francia"],
  peruana: ["peruana", "peruano", "peru"],
  venezolana: ["venezolana", "venezolano", "venezuela"],
  brasilena: ["brasilena", "brasileno", "brasil", "brazil"],
  argentina: ["argentina", "argentino"],
  latina: ["latina", "latino", "latinoamericana"],
  africana: ["africana", "africano", "african"],
  caribena: ["caribena", "caribeno", "caribbean", "caribe"],
  vegetariana: ["vegetariana", "vegetariano", "vegetarian"],
  vegana: ["vegana", "vegano", "vegan"],
  saludable: ["saludable", "healthy", "fit"],
  ensaladas: ["ensalada", "ensaladas", "salad"],
  sopas: ["sopa", "sopas", "soup"],
  desayunos: ["desayuno", "desayunos", "breakfast"],
  brunch: ["brunch"],
  sandwiches: ["sandwich", "sandwiches", "kanapka"],
  hotdogs: ["hot dog", "hotdog", "hot dogs"],
  empanadas: ["empanada", "empanadas"],
  "comida-rapida": ["comida rapida", "fast food"],
  "street-food": ["street food", "comida callejera"],
  panaderia: ["panaderia", "bakery", "piekarnia"],
  cafeteria: ["cafeteria", "cafe", "coffee"],
  postres: ["postre", "postres", "dessert"],
  helados: ["helado", "helados", "ice cream"],
  dulces: ["dulce", "dulces", "sweet"],
  bebidas: ["bebida", "bebidas", "drinks"],
  jugos: ["jugo", "jugos", "juice"],
  "comida-casera": ["comida casera", "casera", "homemade"],
  familiar: ["familiar", "family"]
};
function customerRestaurantMatchesCategory(restaurant, category) {
  if (!category || category === "all") return true;
  const searchable = customerNormalizeSearchText(
    [
      restaurant.name,
      restaurant.description,
      restaurant.address,
      restaurant.city,
      restaurant.region
    ]
      .filter(Boolean)
      .join(" ")
  );
  const knownCategoryKeys =
    Object.keys(CUSTOMER_RESTAURANT_CATEGORY_KEYWORDS);
  if (category === "other") {
    return !knownCategoryKeys.some((categoryKey) => {
      const keywords =
        CUSTOMER_RESTAURANT_CATEGORY_KEYWORDS[categoryKey] || [];
      return keywords.some((keyword) =>
        searchable.includes(
          customerNormalizeSearchText(keyword)
        )
      );
    });
  }
  const keywords =
    CUSTOMER_RESTAURANT_CATEGORY_KEYWORDS[category] || [category];
  return keywords.some((keyword) =>
    searchable.includes(
      customerNormalizeSearchText(keyword)
    )
  );
}
function customerNormalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:_-]+/g, " ")
    .replace(/\s+/g, " ")
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
    operationalOpen: row.operational_open === true || row.operationalOpen === true,
    openingHours: row.opening_hours || row.openingHours || {},
    latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    countryCode: customerNormalizeText(row.country_code || row.countryCode).toUpperCase(),
    city: customerNormalizeText(row.city),
    region: customerNormalizeText(row.region),
    postalCode: customerNormalizeText(row.postal_code || row.postalCode),
    updatedAt: customerNormalizeText(row.updated_at || row.updatedAt),
  };
}
function customerIsMissingRpc(error) {
  const code = String(error?.code || error?.status || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || message.includes("could not find the function");
}
function customerStopDirectoryRealtime() {
  if (customerDirectoryRealtimeRetryTimer) {
    window.clearTimeout(customerDirectoryRealtimeRetryTimer);
    customerDirectoryRealtimeRetryTimer = null;
  }
  if (customerDirectoryRealtimeStableTimer) {
  window.clearTimeout(customerDirectoryRealtimeStableTimer);
  customerDirectoryRealtimeStableTimer = null;
}
  if (customerDirectoryRealtimeTimer) {
    window.clearTimeout(customerDirectoryRealtimeTimer);
    customerDirectoryRealtimeTimer = null;
  }
  if (customerDirectoryPollTimer) {
    window.clearTimeout(customerDirectoryPollTimer);
    customerDirectoryPollTimer = null;
  }
  const channel = customerDirectoryRealtimeChannel;
  customerDirectoryRealtimeChannel = null;
  customerDirectoryRealtimeStatus = "idle";
  if (channel && customerClient?.removeChannel) customerClient.removeChannel(channel).catch(() => {});
}
function customerScheduleDirectoryRefresh() {
  if (customerDirectoryRealtimeTimer) window.clearTimeout(customerDirectoryRealtimeTimer);
  customerDirectoryRealtimeTimer = window.setTimeout(() => {
    customerDirectoryRealtimeTimer = null;
    customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
  }, 300);
}
function customerScheduleDirectoryPoll(delayMs = customerDirectoryPollingDelay) {
  if (customerDirectoryRealtimeStatus === "SUBSCRIBED") {
    if (customerDirectoryPollTimer) {
      window.clearTimeout(customerDirectoryPollTimer);
      customerDirectoryPollTimer = null;
    }
    return;
  }
  if (customerDirectoryPollTimer) {
    window.clearTimeout(customerDirectoryPollTimer);
  }
  customerDirectoryPollTimer = window.setTimeout(async () => {
    customerDirectoryPollTimer = null;
    if (customerDirectoryRealtimeStatus === "SUBSCRIBED") return;
    if (document.visibilityState !== "visible" || !window.navigator.onLine) {
      customerScheduleDirectoryPoll(CUSTOMER_DIRECTORY_POLL_MIN_MS);
      return;
    }
    const loaded = await customerLoadRestaurantDirectory({ silent: true });
    customerDirectoryPollingDelay = loaded
      ? CUSTOMER_DIRECTORY_POLL_MIN_MS
      : Math.min(
          Math.max(customerDirectoryPollingDelay, CUSTOMER_DIRECTORY_POLL_MIN_MS) * 2,
          CUSTOMER_DIRECTORY_POLL_MAX_MS
        );
    if (customerDirectoryRealtimeStatus !== "SUBSCRIBED") {
      customerScheduleDirectoryPoll(customerDirectoryPollingDelay);
    }
  }, Math.max(0, Number(delayMs) || 0));
}
function customerStartDirectoryRealtime() {
  if (
    customerDirectoryRealtimeChannel &&
    ["connecting", "SUBSCRIBED"].includes(customerDirectoryRealtimeStatus)
  ) {
    return;
  }
  if (!customerDirectoryPollTimer) {
    customerScheduleDirectoryPoll(customerDirectoryPollingDelay);
  }
  if (!customerClient?.channel || customerDirectoryRealtimeChannel) return;
  customerDirectoryRealtimeStatus = "connecting";
  const changeFilter = { event: "*", schema: "public", table: "restaurant_profiles" };
  if (customerRegistrationRegion.countryCode) {
    changeFilter.filter = `country_code=eq.${customerRegistrationRegion.countryCode}`;
  }
  const channel = customerClient
    .channel(`public-restaurant-directory-v86-1-${customerRegistrationRegion.countryCode || "all"}`)
    .on(
      "postgres_changes",
      changeFilter,
      customerScheduleDirectoryRefresh
    );
  customerDirectoryRealtimeChannel = channel;
 channel.subscribe((status) => {
  if (channel !== customerDirectoryRealtimeChannel) return;
  customerDirectoryRealtimeStatus = status;
  if (status === "SUBSCRIBED") {
    if (customerDirectoryRealtimeStableTimer) {
      window.clearTimeout(customerDirectoryRealtimeStableTimer);
    }
    customerDirectoryRealtimeStableTimer = window.setTimeout(() => {
      customerDirectoryRealtimeStableTimer = null;
      if (
        channel === customerDirectoryRealtimeChannel &&
        customerDirectoryRealtimeStatus === "SUBSCRIBED"
      ) {
        customerDirectoryRealtimeRetryDelay =
          CUSTOMER_REALTIME_RECONNECT_MIN_MS;
      }
    }, CUSTOMER_REALTIME_STABLE_MS);
    if (customerDirectoryPollTimer) {
      window.clearTimeout(customerDirectoryPollTimer);
      customerDirectoryPollTimer = null;
    }
    customerDirectoryPollingDelay = CUSTOMER_DIRECTORY_POLL_MIN_MS;
    customerScheduleDirectoryRefresh();
    return;
  }
  if (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  ) {
    if (customerDirectoryRealtimeStableTimer) {
      window.clearTimeout(customerDirectoryRealtimeStableTimer);
      customerDirectoryRealtimeStableTimer = null;
    }
    customerDirectoryRealtimeChannel = null;
    customerScheduleDirectoryPoll(customerDirectoryPollingDelay);
    if (customerClient?.removeChannel) {
      customerClient.removeChannel(channel).catch(() => {});
    }
    if (customerDirectoryRealtimeRetryTimer) {
      window.clearTimeout(customerDirectoryRealtimeRetryTimer);
    }
    const retryDelay = customerDirectoryRealtimeRetryDelay;
    customerDirectoryRealtimeRetryDelay = Math.min(
      retryDelay * 2,
      CUSTOMER_REALTIME_RECONNECT_MAX_MS
    );
    customerDirectoryRealtimeRetryTimer = window.setTimeout(() => {
      customerDirectoryRealtimeRetryTimer = null;
      if (window.navigator.onLine) {
        customerStartDirectoryRealtime();
      }
    }, retryDelay);
  }
});
  }
function customerRestaurantDedupeKey(restaurant) {
  const name = customerNormalizeSearchText(restaurant?.name || "");
  const address = customerNormalizeSearchText(restaurant?.address || "");
  if (!name) return `id:${restaurant?.userId || ""}`;
  return address ? `${name}|${address}` : `name:${name}`;
}
function customerRestaurantIsNewer(candidate, current) {
  const candidateTime = new Date(candidate?.updatedAt || 0).getTime();
  const currentTime = new Date(current?.updatedAt || 0).getTime();
  return Number.isFinite(candidateTime) && candidateTime > currentTime;
}
function customerDeduplicateRestaurants(restaurants = []) {
  const byIdentity = new Map();
  restaurants.forEach((restaurant) => {
    const key = customerRestaurantDedupeKey(restaurant);
    const current = byIdentity.get(key);
    if (!current) {
      byIdentity.set(key, restaurant);
      return;
    }
    if (customerRestaurantIsNewer(restaurant, current)) byIdentity.set(key, restaurant);
  });
  return Array.from(byIdentity.values()).sort((a, b) => a.name.localeCompare(b.name));
}
function customerSelectedRestaurant() {
  return customerRestaurants.find((restaurant) => restaurant.userId === customerStoreId) || null;
}
function customerRenderPaymentMethods() {
  const option = customerElements.onlinePaymentOption;
  if (!option) return;
  const restaurant = customerSelectedRestaurant();
  const enabled = customerSettings.onlinePaymentProvider === "stripe"
    && restaurant?.countryCode === "PL";
  option.hidden = !enabled;
  option.disabled = !enabled;
  if (!enabled && customerElements.paymentMethod?.value === "Online") {
    customerElements.paymentMethod.value = "Efectivo";
  }
}
function customerClearRestaurantSelection(messageKey = "") {
  customerStoreId = "";
  customerStopMenuRealtime();
  customerMenu = CUSTOMER_DEFAULT_MENU;
  customerActiveCategory = "";
  customerCart = [];
  customerMapDistance = null;
  customerLocationCoords = null;
  customerSettings = {
    ...customerSettings,
    businessName: "RC ORDERA",
    businessLogoUrl: "",
    restaurantAddress: "",
    restaurantOperationalOpen: false,
    openingHours: {},
    restaurantLatitude: null,
    restaurantLongitude: null,
    onlinePaymentProvider: "disabled",
    onlinePaymentNote: "",
  };
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("store");
  nextUrl.searchParams.set("app", "v91.0.4");
  window.history.replaceState({}, "", nextUrl.toString());
  customerApplyBusinessName();
  customerRenderRestaurantDirectory();
  customerRenderSelectedRestaurantDetails();
  customerRenderCategories();
  customerRenderMenu();
  customerRenderCart();
  customerRenderPaymentMethods();
  customerSetView("home", { keepScroll: true });
  if (messageKey) customerSetStatus(customerT(messageKey), "error");
}
function customerRenderRestaurantDirectory() {
  if (!customerElements.restaurantList) return;
  const selected = customerSelectedRestaurant();
  const compactSingleRestaurant = false;
  customerElements.restaurantPanel?.classList.toggle("is-compact", compactSingleRestaurant);
  if (customerElements.restaurantTitle) {
    if (compactSingleRestaurant) {
      customerElements.restaurantTitle.removeAttribute("data-i18n");
      customerElements.restaurantTitle.textContent = selected.name;
    } else {
      customerElements.restaurantTitle.dataset.i18n = "restaurantTitle";
      customerElements.restaurantTitle.textContent = customerT("restaurantTitle");
    }
  }
  if (customerElements.selectedRestaurantText) {
    customerElements.selectedRestaurantText.removeAttribute("data-i18n");
    if (compactSingleRestaurant) {
      const addressText = selected.address ? ` - ${selected.address}` : "";
      customerElements.selectedRestaurantText.textContent = `${customerT("restaurantSingleSelected", { name: selected.name })}${addressText}`;
    } else if (customerStoreId) {
      const name = selected?.name || customerSettings.businessName || "Restaurante";
      customerElements.selectedRestaurantText.textContent = customerT("restaurantSelected", { name });
    } else {
      customerElements.selectedRestaurantText.textContent = customerT("restaurantHelp");
    }
  }
  if (compactSingleRestaurant) {
    customerElements.restaurantList.innerHTML = "";
    return;
  }
const query =
  customerNormalizeSearchText(
    customerRestaurantSearchQuery
  );
const visibleRestaurants =
  customerRestaurants.filter((restaurant) => {
    const matchesSearch =
      !query ||
      customerNormalizeSearchText(
        [
          restaurant.name,
          restaurant.address,
          restaurant.phone,
          restaurant.description,
          restaurant.city,
          restaurant.region
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(query);
    const matchesCategory =
      customerRestaurantMatchesCategory(
        restaurant,
        customerRestaurantCategoryFilter
      );
    return matchesSearch && matchesCategory;
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
    const isOpen = restaurant.operationalOpen === true;
    const initials = restaurant.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
    const restaurantImage = restaurant.logoUrl
      ? `
        <img
          class="customer-restaurant-cover-image"
          src="${customerEscapeHtml(restaurant.logoUrl)}"
          alt="${customerEscapeHtml(restaurant.name)}"
          loading="lazy"
        />
      `
      : `
        <div class="customer-restaurant-cover-placeholder">
          <span>${customerEscapeHtml(initials || "RC")}</span>
        </div>
      `;
return `
  <article
    class="customer-restaurant-card ${isSelected ? "is-selected" : ""}"
    data-store-id="${customerEscapeHtml(restaurant.userId)}"
    role="button"
    tabindex="0"
    aria-label="${customerEscapeHtml(
      `${restaurant.name}, ${
        restaurant.address || customerT("restaurantNoAddress")
      }`
    )}"
  >
    <div class="customer-restaurant-cover">
      ${restaurantImage}
     <button
  class="customer-restaurant-heart"
  type="button"
  data-favorite-store-id="${customerEscapeHtml(restaurant.userId)}"
  aria-label="${customerEscapeHtml(customerT("favoriteRestaurant"))}"
  title="${customerEscapeHtml(customerT("favoriteRestaurant"))}"
>
  &#9825;
</button>
      <span class="customer-restaurant-open-label ${
        isOpen ? "is-open" : "is-closed"
      }">
        ${customerEscapeHtml(
          customerT(isOpen ? "restaurantOpen" : "restaurantClosed")
        )}
      </span>
    </div>
    <div class="customer-restaurant-content">
      <div class="customer-restaurant-name-row">
        <strong class="customer-restaurant-name">
          ${customerEscapeHtml(restaurant.name)}
        </strong>
      </div>
      <span class="customer-restaurant-address">
        ${customerEscapeHtml(
          restaurant.address || customerT("restaurantNoAddress")
        )}
      </span>
      <div class="customer-restaurant-meta">
        <span>
          ${customerEscapeHtml(
            customerT("deliveryCalculatedAtCheckout")
          )}
        </span>
      </div>
    </div>
  </article>
`;
    })
  .join("");
  customerRenderSelectedRestaurantDetails();
}
function customerLoadRestaurantDirectory(options = {}) {
  if (customerDirectoryLoadPromise) return customerDirectoryLoadPromise;
  customerDirectoryLoadPromise = customerLoadRestaurantDirectoryNow(options).finally(() => {
    customerDirectoryLoadPromise = null;
  });
  return customerDirectoryLoadPromise;
}
async function customerLoadRestaurantDirectoryNow(options = {}) {
  const { silent = false } = options;
  const client = customerEnsureClient();
  if (!client || !customerElements.restaurantList) return false;
  if (!silent) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantLoading")
    )}</div>`;
  }
  customerStartDirectoryRealtime();
  let { data, error } = await client.rpc("get_public_restaurant_directory_by_region", {
    p_country_code: customerRegistrationRegion.countryCode || "",
    p_city: customerRegistrationRegion.city || "",
    p_region: customerRegistrationRegion.region || "",
  });
  if (error && customerIsMissingRpc(error)) {
    let query = client
      .from("restaurant_profiles")
      .select("user_id, business_name, logo_url, public_address, phone, description, operational_open, opening_hours, latitude, longitude, country_code, city, region, postal_code, updated_at")
      .eq("active", true)
      .is("deleted_at", null);
    if (customerRegistrationRegion.countryCode) query = query.eq("country_code", customerRegistrationRegion.countryCode);
    if (customerRegistrationRegion.region) query = query.ilike("region", customerRegistrationRegion.region);
    ({ data, error } = await query.order("business_name", { ascending: true }));
  }
  if (error) {
    customerElements.restaurantList.innerHTML = `<div class="customer-empty">${customerEscapeHtml(
      customerT("restaurantLoadError")
    )}</div>`;
    return false;
  }
  customerRestaurants = customerDeduplicateRestaurants((Array.isArray(data) ? data : [])
    .map(customerNormalizeRestaurantProfile)
    .filter(Boolean)
    .filter((restaurant) =>
      !customerRegistrationRegion.countryCode
      || restaurant.countryCode === customerRegistrationRegion.countryCode
    )
    .filter((restaurant) =>
      !customerRegistrationRegion.region
      || customerNormalizeSearchText(restaurant.region) === customerNormalizeSearchText(customerRegistrationRegion.region)
    ));
  if (customerStoreId && !customerSelectedRestaurant()) {
    customerClearRestaurantSelection("restaurantUnavailable");
    return true;
  }
  customerRenderRestaurantDirectory();
  return true;
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
    nextUrl.searchParams.set("app", "v91.0.4");
    window.history.replaceState({}, "", nextUrl.toString());
  }
  customerApplyMenuSearch("");
  customerRenderRestaurantDirectory();
  customerSetStatus(customerT("refreshingMenu"), "");
  customerSetView("store");
  await customerLoadMenu({ skipDirectory: true });
  await customerLoadFavoriteRestaurant();
  customerRenderSelectedRestaurantDetails();
  if (customerSelectedRestaurant()?.operationalOpen !== true) {
    customerSetStatus(customerT("restaurantClosedBrowse"), "error");
  }
}
function customerFetchPublicMenu(storeId) {
  if (customerMenuFetchPromise && customerMenuFetchStoreId === storeId) return customerMenuFetchPromise;
  customerMenuFetchStoreId = storeId;
  customerMenuFetchPromise = customerFetchPublicMenuNow(storeId).finally(() => {
    if (customerMenuFetchStoreId === storeId) {
      customerMenuFetchPromise = null;
      customerMenuFetchStoreId = "";
    }
  });
  return customerMenuFetchPromise;
}
function customerMenuCacheKey(storeId) {
  return `${CUSTOMER_MENU_CACHE_KEY_PREFIX}:${customerNormalizeText(storeId)}`;
}
function customerReadMenuCache(storeId) {
  try {
    const cached = JSON.parse(localStorage.getItem(customerMenuCacheKey(storeId)) || "null");
    if (!cached || cached.storeId !== customerNormalizeText(storeId)) return null;
    const menu = customerNormalizeMenu(cached.menu || {});
    if (!customerMenuProductCount(menu)) return null;
    return { menu, settings: cached.settings || {} };
  } catch {
    return null;
  }
}
function customerStoreMenuCache(storeId, menu, settings) {
  const normalizedMenu = customerNormalizeMenu(menu || {});
  if (!customerMenuProductCount(normalizedMenu)) return;
  try {
    localStorage.setItem(customerMenuCacheKey(storeId), JSON.stringify({
      storeId: customerNormalizeText(storeId),
      menu: normalizedMenu,
      settings: settings || {},
      updatedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("No se pudo conservar el menu publico para uso sin conexion.", error);
  }
}
async function customerFetchPublicMenuNow(storeId) {
  const { data: rpcData, error: rpcError } = await customerClient.rpc("get_public_restaurant_menu", {
    p_user_id: storeId,
  });
  if (!rpcError) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row) return row;
  }
  const { data: activeProfile, error: profileError } = await customerClient
    .from("restaurant_profiles")
    .select("user_id")
    .eq("user_id", storeId)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (profileError) throw rpcError || profileError;
  if (!activeProfile) return null;
  const { data, error } = await customerClient
    .from("restaurant_public_catalogs")
    .select("menu, settings")
    .eq("restaurant_user_id", storeId)
    .maybeSingle();
  if (error) throw rpcError || error;
  return data;
}
function customerStopMenuRealtime() {
  if (customerMenuRealtimeRetryTimer) {
    window.clearTimeout(customerMenuRealtimeRetryTimer);
    customerMenuRealtimeRetryTimer = null;
  }
  if (customerMenuRealtimeStableTimer) {
  window.clearTimeout(customerMenuRealtimeStableTimer);
  customerMenuRealtimeStableTimer = null;
}
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
  const channel = customerClient
    .channel(`public-menu-${storeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "restaurant_public_catalogs",
        filter: `restaurant_user_id=eq.${storeId}`,
      },
      () => {
        if (storeId !== customerStoreId) return;
        customerSetStatus(customerT("menuRealtimeConnecting"), "");
        customerScheduleMenuRealtimeRefetch();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "restaurant_profiles",
        filter: `user_id=eq.${storeId}`,
      },
      async () => {
        if (storeId !== customerStoreId) return;
        await customerLoadRestaurantDirectory({ silent: true });
        if (storeId === customerStoreId) customerScheduleMenuRealtimeRefetch();
      }
    );
  customerMenuRealtimeChannel = channel;
  channel.subscribe((status) => {
  if (
    storeId !== customerStoreId ||
    channel !== customerMenuRealtimeChannel
  ) {
    return;
  }
  if (status === "SUBSCRIBED") {
    if (customerMenuRealtimeStableTimer) {
      window.clearTimeout(customerMenuRealtimeStableTimer);
    }
    customerMenuRealtimeStableTimer = window.setTimeout(() => {
      customerMenuRealtimeStableTimer = null;
      if (
        storeId === customerStoreId &&
        channel === customerMenuRealtimeChannel
      ) {
        customerMenuRealtimeRetryDelay =
          CUSTOMER_REALTIME_RECONNECT_MIN_MS;
      }
    }, CUSTOMER_REALTIME_STABLE_MS);
    customerScheduleMenuRealtimeRefetch();
    return;
  }
  if (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  ) {
    if (customerMenuRealtimeStableTimer) {
      window.clearTimeout(customerMenuRealtimeStableTimer);
      customerMenuRealtimeStableTimer = null;
    }
    customerMenuRealtimeChannel = null;
    customerMenuRealtimeStoreId = "";
    if (customerClient?.removeChannel) {
      customerClient.removeChannel(channel).catch(() => {});
    }
    customerSetStatus(
      customerT("menuRealtimeError"),
      "error"
    );
    if (customerMenuRealtimeRetryTimer) {
      window.clearTimeout(customerMenuRealtimeRetryTimer);
    }
    const retryDelay = customerMenuRealtimeRetryDelay;
    customerMenuRealtimeRetryDelay = Math.min(
      retryDelay * 2,
      CUSTOMER_REALTIME_RECONNECT_MAX_MS
    );
    customerMenuRealtimeRetryTimer = window.setTimeout(() => {
      customerMenuRealtimeRetryTimer = null;
      if (
        storeId === customerStoreId &&
        window.navigator.onLine
      ) {
        customerStartMenuRealtime();
        customerRefreshMenu().catch(() => {});
      }
    }, retryDelay);
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
            translations: dish?.translations && typeof dish.translations === "object" ? dish.translations : {},
            station: customerNormalizeProductStation(
              dish?.station || dish?.preparationStation || dish?.preparation_station
            ),
          });
        }
      });
    }
  });
  return normalized;
}
function customerNormalizeProductStation(station) {
  const value = String(station || "").trim().toLowerCase();
  return ["kitchen", "grill", "drinks", "fast_food", "starters", "salads"].includes(value)
    ? value
    : "kitchen";
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
  return name || "RC ORDERA";
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
  document.title = `${name} - ${customerT("documentTitleSuffix")}`;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", name);
  customerRenderRestaurantDirectory();
  customerRenderSelectedRestaurantDetails();
}
function customerNormalizeDistance(value) {
  const number = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function customerDeliveryQuoteIsUsable() {
  if (!customerMapDistance?.quoteId || !customerMapDistance?.quoteToken) return false;
  const expiresAt = new Date(customerMapDistance.expiresAt || 0).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 5000;
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
  return customerRoundMoney(total * CUSTOMER_DELIVERY_MARKUP);
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
  if (window.google?.maps?.DistanceMatrixService && window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (!customerSettings.googleMapsApiKey) return Promise.reject(new Error(customerT("mapsNeedKey")));
  if (googleMapsScriptPromise) return googleMapsScriptPromise;
  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const callbackName = `rinconGoogleMapsReady_${Date.now()}`;
    const script = document.createElement("script");
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(customerSettings.googleMapsApiKey)}&libraries=places&loading=async&callback=${callbackName}`;
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
function customerAddressComponent(result, types = [], shortName = false) {
  const components = result?.address_components || [];
  const component = components.find((entry) => types.every((type) => entry.types.includes(type)));
  return (shortName ? component?.short_name : component?.long_name) || "";
}
function customerNormalizedRegion(countryCode, value) {
  const cleanValue = customerNormalizeText(value);
  if (!cleanValue) return "";
  const comparable = (text) => String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(wojewodztwo|voivodeship|departamento|department)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const match = (CUSTOMER_REGIONS[countryCode] || []).find((region) => comparable(region) === comparable(cleanValue));
  return match || cleanValue;
}
function customerPlaceLocality(place) {
  return customerAddressComponent(place, ["locality"])
    || customerAddressComponent(place, ["postal_town"])
    || customerAddressComponent(place, ["sublocality_level_1"])
    || customerAddressComponent(place, ["sublocality"])
    || customerAddressComponent(place, ["administrative_area_level_2"])
    || customerAddressComponent(place, ["administrative_area_level_3"]);
}
function customerApplyPlace(place, input) {
  if (!place?.address_components?.length) return;
  const countryCode = String(customerAddressComponent(place, ["country"], true)).toUpperCase();
  if (!["PL", "CO"].includes(countryCode)) return;
  const previousCountryCode = customerRegistrationRegion.countryCode;
  const previousRegion = customerRegistrationRegion.region;
  const city = customerPlaceLocality(place);
  const region = customerNormalizedRegion(
    countryCode,
    customerAddressComponent(place, ["administrative_area_level_1"])
  );
  const postalCode = customerAddressComponent(place, ["postal_code"]);
  const latitude = place.geometry?.location?.lat?.();
  const longitude = place.geometry?.location?.lng?.();
  const formattedAddress = customerNormalizeText(place.formatted_address || place.name);
  customerRegistrationRegion = {
    ...customerRegistrationRegion,
    countryCode,
    country: customerCountryName(countryCode),
    region: region || customerRegistrationRegion.region,
    city: city || customerRegistrationRegion.city,
    postalCode: postalCode || customerRegistrationRegion.postalCode,
    timezone: countryCode === "PL" ? "Europe/Warsaw" : "America/Bogota",
    latitude: Number.isFinite(latitude) ? latitude : customerRegistrationRegion.latitude,
    longitude: Number.isFinite(longitude) ? longitude : customerRegistrationRegion.longitude,
  };
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    customerLocationCoords = { lat: latitude, lng: longitude };
  }
  if (customerElements.registerCountryInput) customerElements.registerCountryInput.value = countryCode;
  customerRenderRegistrationRegions(countryCode, customerRegistrationRegion.region);
  if (customerElements.registerCityInput && city) customerElements.registerCityInput.value = city;
  if (customerElements.registerPostalCodeInput && postalCode) customerElements.registerPostalCodeInput.value = postalCode;
  if (formattedAddress && input === customerElements.registerAddressInput) {
    customerElements.registerAddressInput.value = formattedAddress;
  }
  if (formattedAddress && input === customerElements.addressInput) {
    customerElements.addressInput.value = formattedAddress;
    customerMapDistance = null;
    customerElements.distanceInput.value = "";
  }
  customerRenderLocationSummary();
  customerRenderProfileDetails();
  if (countryCode !== previousCountryCode || customerRegistrationRegion.region !== previousRegion) {
    customerStopDirectoryRealtime();
    customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
  }
}
async function customerPreparePlaceAutocomplete() {
  if (!customerSettings.googleMapsApiKey) return;
  await customerLoadGoogleMaps();
  const selectedCountry = customerInputValue(customerElements.registerCountryInput).toLowerCase();
  const inputs = [
    customerElements.registerCityInput,
    customerElements.registerAddressInput,
    customerElements.addressInput,
  ].filter(Boolean);
  inputs.forEach((input) => {
    let autocomplete = customerPlaceAutocompletes.get(input);
    if (!autocomplete) {
      const options = { fields: ["address_components", "formatted_address", "geometry", "name"] };
      if (["pl", "co"].includes(selectedCountry)) options.componentRestrictions = { country: selectedCountry };
      autocomplete = new google.maps.places.Autocomplete(input, options);
      autocomplete.addListener("place_changed", () => customerApplyPlace(autocomplete.getPlace(), input));
      customerPlaceAutocompletes.set(input, autocomplete);
    } else if (["pl", "co"].includes(selectedCountry)) {
      autocomplete.setComponentRestrictions({ country: selectedCountry });
    }
  });
}
async function customerReverseGeocodeLocation(coords, options = {}) {
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
      const approximateAddress = String(result.formatted_address || "")
        .replace(/,\s*(Poland|Polska|Colombia)$/i, "")
        .trim();
      const neighborhood =
        customerAddressComponent(result, ["sublocality"]) ||
        customerAddressComponent(result, ["neighborhood"]) ||
        customerAddressComponent(result, ["sublocality_level_1"]);
      const countryCode = String(customerAddressComponent(result, ["country"], true)).toUpperCase();
      const city = customerPlaceLocality(result);
      const region = customerNormalizedRegion(
        countryCode,
        customerAddressComponent(result, ["administrative_area_level_1"])
      );
      const postalCode = customerAddressComponent(result, ["postal_code"]);
      const previousCountryCode = customerRegistrationRegion.countryCode;
      const selectedCountryCode = customerInputValue(customerElements.registerCountryInput).toUpperCase();
      const preserveManual = options.preserveManual === true;
      const detectedMatchesSelection = !selectedCountryCode || selectedCountryCode === countryCode;
      const nextCountryCode = preserveManual && selectedCountryCode ? selectedCountryCode : countryCode;
      const nextRegion = preserveManual && customerInputValue(customerElements.registerRegionInput)
        ? customerInputValue(customerElements.registerRegionInput)
        : detectedMatchesSelection
          ? region
          : customerRegistrationRegion.region;
      const nextCity = preserveManual && customerInputValue(customerElements.registerCityInput)
        ? customerInputValue(customerElements.registerCityInput)
        : detectedMatchesSelection
          ? city
          : customerRegistrationRegion.city;
      const nextPostalCode = preserveManual && customerInputValue(customerElements.registerPostalCodeInput)
        ? customerInputValue(customerElements.registerPostalCodeInput)
        : detectedMatchesSelection
          ? postalCode
          : customerRegistrationRegion.postalCode;
      if (approximateAddress && (!preserveManual || detectedMatchesSelection)) {
        customerElements.addressInput.value = approximateAddress;
        if (customerElements.registerAddressInput && !customerElements.registerAddressInput.value.trim()) {
          customerElements.registerAddressInput.value = approximateAddress;
        }
      }
      if ((neighborhood || city) && (!preserveManual || detectedMatchesSelection)) {
        customerElements.neighborhoodInput.value = neighborhood || city;
        if (customerElements.registerNeighborhoodInput && !customerElements.registerNeighborhoodInput.value.trim()) {
          customerElements.registerNeighborhoodInput.value = neighborhood || city;
        }
      }
      customerRegistrationRegion = {
        ...customerRegistrationRegion,
        countryCode: ["PL", "CO"].includes(nextCountryCode) ? nextCountryCode : customerRegistrationRegion.countryCode,
        country: customerCountryName(nextCountryCode) || customerRegistrationRegion.country,
        city: nextCity || customerRegistrationRegion.city,
        region: nextRegion || customerRegistrationRegion.region,
        postalCode: nextPostalCode || customerRegistrationRegion.postalCode,
        latitude: preserveManual && !detectedMatchesSelection ? null : customerRegistrationRegion.latitude,
        longitude: preserveManual && !detectedMatchesSelection ? null : customerRegistrationRegion.longitude,
        timezone: nextCountryCode === "PL"
          ? "Europe/Warsaw"
          : nextCountryCode === "CO"
            ? "America/Bogota"
            : customerRegistrationRegion.timezone,
      };
      if (preserveManual && !detectedMatchesSelection) customerLocationCoords = null;
      if (customerElements.registerCountryInput && ["PL", "CO"].includes(nextCountryCode)) {
        customerElements.registerCountryInput.value = nextCountryCode;
      }
      customerRenderRegistrationRegions(customerRegistrationRegion.countryCode, customerRegistrationRegion.region);
      if (customerRegistrationRegion.city && customerElements.registerCityInput) {
        customerElements.registerCityInput.value = customerRegistrationRegion.city;
      }
      if (customerRegistrationRegion.postalCode && customerElements.registerPostalCodeInput) {
        customerElements.registerPostalCodeInput.value = customerRegistrationRegion.postalCode;
      }
      if (nextCountryCode && nextCountryCode !== previousCountryCode) {
        customerStopDirectoryRealtime();
        customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
      }
      resolve(Boolean(approximateAddress || neighborhood || city));
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
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    customerSetMapResult(customerT("locationSecureRequired"), "error");
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
      customerRegistrationRegion = {
        ...customerRegistrationRegion,
        ...customerDetectedRegion(position.coords),
        city: customerRegistrationRegion.city,
        region: customerRegistrationRegion.region,
        postalCode: customerRegistrationRegion.postalCode,
      };
      customerElements.addressInput.value = `${customerLocationCoords.lat.toFixed(6)}, ${customerLocationCoords.lng.toFixed(6)}`;
      customerSetMapResult(customerT("locationReceived"), "ok");
      try {
        if (customerSettings.googleMapsApiKey) {
          const addressFilled = await customerReverseGeocodeLocation(customerLocationCoords);
          customerRenderLocationSummary();
          customerSetMapResult(
            addressFilled ? customerT("locationAddressFilled") : customerT("locationAddressUnavailable"),
            addressFilled ? "ok" : ""
          );
        }
        await customerCalculateDistanceWithMaps();
      } catch (error) {
        console.warn("La ubicacion se obtuvo, pero no fue posible consultar Google Maps.", error);
        customerSetMapResult(customerT("locationReceivedManual"), "");
      } finally {
        customerElements.useLocationButton.disabled = false;
        customerRenderLocationSummary();
      }
    },
    (error) => {
      customerLocationCoords = null;
      customerElements.useLocationButton.disabled = false;
      const key = error?.code === 1
        ? "locationPermissionDenied"
        : error?.code === 2
          ? "locationUnavailable"
          : error?.code === 3
            ? "locationTimeout"
            : "locationError";
      customerSetMapResult(customerT(key), "error");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}
async function customerCalculateDistanceWithMaps() {
  if (customerElements.orderType.value !== "Domicilio") return;
  if (!customerStoreId || !customerClient) {
    customerSetMapResult(customerT("noConnection"), "error");
    return;
  }
  if (!customerSettings.restaurantAddress
      && !(Number.isFinite(customerSettings.restaurantLatitude) && Number.isFinite(customerSettings.restaurantLongitude))) {
    customerSetMapResult(customerT("mapsNeedAddress"), "error");
    return;
  }
  if (!customerElements.addressInput.value.trim() && !customerLocationCoords) {
    customerSetMapResult(customerT("mapsNeedDestination"), "error");
    customerElements.addressInput.focus();
    return;
  }
  customerSetMapResult(customerT("mapsCalculating"), "");
  customerElements.calculateDistanceButton.disabled = true;
  try {
    const selectedRestaurant = customerSelectedRestaurant();
    const countryCode = String(
      customerRegistrationRegion.countryCode || selectedRestaurant?.countryCode || ""
    ).trim().toUpperCase();
    if (!["PL", "CO"].includes(countryCode)) throw new Error(customerT("registerCountryRequired"));
    const { data, error } = await customerClient.functions.invoke("delivery-quote", {
      body: {
        restaurantUserId: customerStoreId,
        destinationAddress: customerDeliveryDestination(),
        destinationCountryCode: countryCode,
        destinationRegion: customerRegistrationRegion.region || selectedRestaurant?.region || "",
        destinationLat: customerLocationCoords?.lat ?? null,
        destinationLng: customerLocationCoords?.lng ?? null,
      },
    });
    if (error) throw error;
    if (!data?.quoteId || !data?.quoteToken || !(Number(data?.distanceKm) > 0)) {
      throw new Error(customerT("mapsRouteError", { status: "sin ruta" }));
    }
    customerMapDistance = {
      quoteId: data.quoteId,
      quoteToken: data.quoteToken,
      expiresAt: data.expiresAt,
      distanceKm: Number(data.distanceKm),
      distanceText: `${Number(data.distanceKm).toFixed(1)} km`,
      durationSeconds: Number(data.durationSeconds) || 0,
      durationText: Number(data.durationSeconds) > 0
        ? `${Math.max(1, Math.round(Number(data.durationSeconds) / 60))} min`
        : "",
      finalFee: Number(data.finalFee) || 0,
      feeBreakdown: data.feeBreakdown || {},
      origin: customerSettings.restaurantAddress || "",
      destination: customerDeliveryDestination(),
    };
    customerElements.distanceInput.value = customerMapDistance.distanceKm;
    customerRenderLocationSummary();
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
    customerSetMapResult(customerT("mapsManual", { error: customerT("mapsFallback") }), "error");
  } finally {
    customerElements.calculateDistanceButton.disabled = false;
  }
}
function customerDeliveryFee() {
  if (customerElements.orderType.value !== "Domicilio") return 0;
  return customerDeliveryQuoteIsUsable()
    ? customerRoundMoney(customerMapDistance.finalFee)
    : 0;
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
function customerNormalizeNoteDraft(value) {
  return String(value || "").toUpperCase();
}
function customerRenderDeliveryFields() {
  const isDelivery = customerElements.orderType.value === "Domicilio";
  customerElements.deliveryFields.hidden = !isDelivery;
  customerElements.tableInput.placeholder = isDelivery ? customerT("deliveryTablePlaceholder") : customerT("tablePlaceholder");
  if (!isDelivery) {
    customerMapDistance = null;
    customerSetMapResult("");
  } else if (!customerDeliveryQuoteIsUsable()) {
    customerSetMapResult(customerT("manualDistanceHelp"), "");
  }
  customerRenderCart();
  customerRenderLocationSummary();
}
function customerDeliveryPayload() {
  if (customerElements.orderType.value !== "Domicilio") return null;
  const distanceKm = customerNormalizeDistance(customerElements.distanceInput.value);
  const calculatedFee = customerDeliveryQuoteIsUsable()
    ? customerRoundMoney(customerMapDistance.finalFee)
    : 0;
  const minimumFee = customerNormalizeDeliveryMinimumFee(customerSettings.deliveryMinimumFee);
  const extraFee = customerNormalizeMoney(customerSettings.deliveryFee);
  const markupPercent = customerRoundMoney((CUSTOMER_DELIVERY_MARKUP - 1) * 100);
  const currencyLabel = customerNormalizeText(customerSettings.currencySymbol || "");
  return {
    name: customerElements.nameInput.value.trim(),
    phone: customerElements.phoneInput.value.trim(),
    address: customerElements.addressInput.value.trim(),
    neighborhood: customerElements.neighborhoodInput.value.trim(),
    reference: customerElements.referenceInput.value.trim(),
    country: customerRegistrationRegion.country,
    countryCode: customerRegistrationRegion.countryCode,
    city: customerRegistrationRegion.city,
    region: customerRegistrationRegion.region,
    postalCode: customerRegistrationRegion.postalCode,
    distanceKm,
    calculatedFee,
    minimumFee,
    extraFee,
    markupPercent,
    fee: calculatedFee,
    quoteId: customerMapDistance?.quoteId || "",
    quoteToken: customerMapDistance?.quoteToken || "",
    quoteExpiresAt: customerMapDistance?.expiresAt || "",
    durationSeconds: Number(customerMapDistance?.durationSeconds) || 0,
    feeBreakdown: customerMapDistance?.feeBreakdown || {},
    mapDistanceText: customerMapDistance?.distanceText || "",
    mapDurationText: customerMapDistance?.durationText || "",
    mapOrigin: customerMapDistance?.origin || customerSettings.restaurantAddress || "",
    mapDestination: customerMapDistance?.destination || customerDeliveryDestination(),
    location: customerLocationCoords,
    tariff: `MONEDA=${currencyLabel}; MINIMO=${minimumFee}; BASE 1.5KM=4.50; 1.5-6KM=1.50/KM; 6-8KM=2.50/KM; +8KM=3.50/KM; AJUSTE OPERATIVO=${markupPercent}%`,
  };
}
function customerOrderReference(orderId) {
  return String(orderId || "").slice(0, 8).toUpperCase();
}
function customerClearPaymentBox() {
  if (!customerElements.paymentBox) return;
  customerElements.paymentBox.hidden = true;
  customerElements.paymentBox.innerHTML = "";
  if (customerElements.confirmDeliveryButton) customerElements.confirmDeliveryButton.hidden = true;
  customerRenderActiveOrderState();
}
async function customerStartOnlinePayment(orderId, publicToken) {
  if (!customerClient || !orderId || !publicToken || !navigator.onLine) {
    customerSetTrackingStatus(customerT("onlinePaymentFailed"), "error");
    return false;
  }
  customerSetTrackingStatus(customerT("paymentRedirecting"), "");
  const { data, error } = await customerClient.functions.invoke("marketplace-checkout", {
    body: { orderId, publicToken },
  });
  if (error || !data?.url) {
    console.error("No fue posible iniciar el pago online:", error || data);
    customerSetTrackingStatus(customerT("onlinePaymentFailed"), "error");
    return false;
  }
  if (customerTrackedOrder?.id === orderId) {
    customerTrackedOrder.paymentUrl = data.url;
    customerPersistTrackedOrder();
  }
  window.location.assign(data.url);
  return true;
}
async function customerConfirmDelivery() {
  if (!customerClient || !customerTrackedOrder?.id || !customerTrackedOrder.publicToken) return;
  const button = customerElements.confirmDeliveryButton;
  if (button) {
    button.disabled = true;
    button.textContent = customerT("confirmingDelivery");
  }
  const { data, error } = await customerClient.functions.invoke("marketplace-confirm-delivery", {
    body: {
      orderId: customerTrackedOrder.id,
      publicToken: customerTrackedOrder.publicToken,
      actor: "customer",
    },
  });
  if (error) {
    console.error("No fue posible confirmar la entrega:", error);
    if (button) {
      button.disabled = false;
      button.textContent = customerT("confirmDelivery");
    }
    customerSetTrackingStatus(customerT("deliveryConfirmError"), "error");
    return;
  }
customerTrackedOrder.customerConfirmed = true;
try {
  const storageKey = customerTrackedOrderStorageKey();
  sessionStorage.removeItem(storageKey);
  localStorage.removeItem(storageKey);
} catch {}
  if (button) {
    button.disabled = true;
    button.textContent = customerT("deliveryConfirmed");
  }
  customerSetTrackingStatus(customerT("deliveryConfirmed"), "ok");
  return data;
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
  } else if (paymentMethod === "Online") {
    actionHtml = `
      <p>${customerEscapeHtml(customerSettings.onlinePaymentNote || customerT("payOnlineNow"))}</p>
      <button class="customer-map-button" type="button" data-action="retry-online-payment">${customerEscapeHtml(customerT("payOnlineNow"))}</button>
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
  customerRenderActiveOrderState();
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
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) return false;
  if (customerChatLoadInFlight) return customerChatLoadInFlight;
  const orderId = customerTrackedOrder.id;
  const publicToken = customerTrackedOrder.publicToken;
  const generation = customerChatGeneration;
  const operation = (async () => {
    let conditional = customerChatConditionalSupported;
    const args = { p_order_id: orderId, p_public_token: publicToken };
    let result = await customerClient.rpc("get_customer_order_messages", conditional
      ? { ...args, p_known_version: customerChatVersion } : args);
    if (conditional && result.error?.code === "PGRST202") {
      customerChatConditionalSupported = false;
      conditional = false;
      result = await customerClient.rpc("get_customer_order_messages", args);
    }
    if (generation !== customerChatGeneration || orderId !== customerTrackedOrder?.id
      || publicToken !== customerTrackedOrder?.publicToken) return false;
    const { data, error } = result;
    if (error) {
      if (!silent) customerSetChatStatus(customerT("chatLoadError"), "error");
      return false;
    }
    if (conditional && data?.[0]?.messages === null) return true;
    const messages = conditional
      ? (Array.isArray(data?.[0]?.messages) ? data[0].messages : [])
      : (Array.isArray(data) ? data : []);
    customerChatVersion = conditional ? String(data?.[0]?.version || "") : "";
    const newRestaurantMessage = messages.some(
      (message) => message.sender === "restaurant" && customerChatLoadedOnce && !customerKnownChatMessageIds.has(message.id)
    );
    customerKnownChatMessageIds = new Set(messages.map((message) => message.id));
    customerChatLoadedOnce = true;
    customerRenderChatMessages(messages);
    if (newRestaurantMessage) {
      customerShowNotification(customerT("restaurantMessageTitle"), customerT("restaurantMessageBody"));
    }
    return true;
  })();
  customerChatLoadInFlight = operation;
  try {
    return await operation;
  } finally {
    if (customerChatLoadInFlight === operation) customerChatLoadInFlight = null;
  }
}
function customerStopChatPolling() {
  if (customerChatTimer) {
    window.clearTimeout(customerChatTimer);
    customerChatTimer = null;
  }
  customerChatPollSignature = "";
}
function customerScheduleChatPoll(delayMs) {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) {
    customerStopChatPolling();
    return;
  }
  if (customerChatTimer) window.clearTimeout(customerChatTimer);
  const signature = `${customerTrackedOrder.id}:${customerTrackedOrder.publicToken}`;
  const generation = customerChatGeneration;
  const orderId = customerTrackedOrder.id;
  const publicToken = customerTrackedOrder.publicToken;
  customerChatPollSignature = signature;
  customerChatTimer = window.setTimeout(async () => {
    customerChatTimer = null;
    const currentSignature = `${customerTrackedOrder?.id || ""}:${customerTrackedOrder?.publicToken || ""}`;
    if (signature !== customerChatPollSignature || signature !== currentSignature) return;
    if (document.visibilityState !== "visible" || !window.navigator.onLine) {
      customerScheduleChatPoll(CUSTOMER_CHAT_POLL_MIN_MS);
      return;
    }
    const loaded = await customerLoadChatMessages({ silent: true });

    if (
      generation !== customerChatGeneration ||
      signature !== customerChatPollSignature ||
      orderId !== customerTrackedOrder?.id ||
      publicToken !== customerTrackedOrder?.publicToken
    ) return;
    customerChatPollingDelay = loaded
      ? CUSTOMER_CHAT_POLL_MIN_MS
      : Math.min(Math.max(customerChatPollingDelay, CUSTOMER_CHAT_POLL_MIN_MS) * 2, CUSTOMER_CHAT_POLL_MAX_MS);
    customerScheduleChatPoll(customerChatPollingDelay);
  }, Math.max(0, Number(delayMs) || 0));
}
function customerStartChat(orderId, publicToken) {
  if (!customerElements.chatPanel || !orderId || !publicToken) return;
  customerStopChatPolling();
  customerChatGeneration += 1;
  customerChatVersion = "";
  customerKnownChatMessageIds = new Set();
  customerChatLoadedOnce = false;
  customerChatPollingDelay = CUSTOMER_CHAT_POLL_MIN_MS;
  customerElements.chatPanel.hidden = false;
  customerRenderActiveOrderState();
  customerRenderChatMessages([]);
  customerSetChatStatus("");
  customerScheduleChatPoll(0);
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
    customerSetChatStatus(customerT("chatSendError"), "error");
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
  if (!customerDeliveryQuoteIsUsable()) {
    customerSetStatus(customerT("deliveryQuoteRequired"), "error");
    customerElements.calculateDistanceButton.focus();
    return false;
  }
  return true;
}
function customerGenerateId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
function customerOrderGuardId() {
  const uuidV4Pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  try {
    const stored = localStorage.getItem(CUSTOMER_ORDER_GUARD_KEY);
    if (stored && uuidV4Pattern.test(stored)) {
      return stored;
    }
    const generated = customerGenerateId();
    localStorage.setItem(CUSTOMER_ORDER_GUARD_KEY, generated);
    return generated;
  } catch {
    return customerGenerateId();
  }
}
function customerNormalizeRpcRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}
function customerPendingOrderStorageKey() {
  return `${CUSTOMER_PENDING_ORDER_KEY_PREFIX}_${customerStoreId || "unknown"}`;
}
function customerTrackedOrderStorageKey() {
  return `${CUSTOMER_TRACKED_ORDER_KEY_PREFIX}_${customerStoreId || "unknown"}`;
}
function customerPurgeLegacyPersistentOrderSecrets() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (
        key === CUSTOMER_PENDING_ORDER_KEY_PREFIX ||
        key?.startsWith(`${CUSTOMER_PENDING_ORDER_KEY_PREFIX}_`) ||
        key === CUSTOMER_TRACKED_ORDER_KEY_PREFIX ||
        key?.startsWith(`${CUSTOMER_TRACKED_ORDER_KEY_PREFIX}_`)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}
function customerPersistTrackedOrder() {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerStoreId) return;
  const storageKey = customerTrackedOrderStorageKey();
  try {
    // Elimina cualquier token antiguo que hubiera quedado persistido.
    localStorage.removeItem(storageKey);
    // El token solo vive durante la sesión actual del navegador.
    sessionStorage.setItem(storageKey, JSON.stringify({
      ...customerTrackedOrder,
      restaurantUserId: customerStoreId,
      savedAt: Date.now(),
    }));
  } catch {
    // No interrumpimos el pedido si el almacenamiento del navegador falla.
  }
}
function customerRestoreTrackedOrder() {
  customerPurgeLegacyPersistentOrderSecrets();
  if (!customerStoreId || customerTrackedOrder) return false;
  const storageKey = customerTrackedOrderStorageKey();
  try {
    // Limpia automáticamente el formato inseguro antiguo.
    localStorage.removeItem(storageKey);
    const stored = JSON.parse(
      sessionStorage.getItem(storageKey) || "null"
    );
    if (
      !stored?.id ||
      !stored.publicToken ||
      stored.restaurantUserId !== customerStoreId
    ) {
      sessionStorage.removeItem(storageKey);
      return false;
    }
    const savedAt = Number(stored.savedAt) || 0;
    if (
      !savedAt ||
      Date.now() - savedAt > CUSTOMER_TRACKED_ORDER_MAX_AGE_MS
    ) {
      sessionStorage.removeItem(storageKey);
      return false;
    }
    customerStartStatusTracking(
      stored.id,
      stored.publicToken,
      stored.paymentMethod || "",
      stored.paymentUrl || ""
    );
    customerTrackedOrder.status = stored.status || "pending";
    return true;
  } catch {
    try {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch {}
    return false;
  }
}
async function customerHandlePaymentReturn() {
  if (customerPaymentReturnHandled) return;
  const result = customerParams.get("payment");
  if (!result) return;
  customerPaymentReturnHandled = true;
  const returnedOrderId = customerParams.get("order") || "";
  if (customerTrackedOrder?.id && (!returnedOrderId || returnedOrderId === customerTrackedOrder.id)) {
    customerSetView("orders", { keepScroll: true });
    if (result === "success") {
      customerSetTrackingStatus(customerT("paymentSuccess"), "ok");
      customerPollOrderStatus().catch(() => {});
    } else {
      customerSetTrackingStatus(customerT("paymentCancelled"), "error");
      customerRenderPaymentBox(customerTrackedOrder.id, Number(customerTrackedOrder.total) || 0, { paymentMethod: "Online" });
    }
  }
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("payment");
  nextUrl.searchParams.delete("order");
  window.history.replaceState({}, "", nextUrl.toString());
}
function customerOrderFingerprint(orderPayload) {
  const fingerprintPayload = { ...orderPayload };
  delete fingerprintPayload.createdAt;
  delete fingerprintPayload.publicToken;
  return JSON.stringify(fingerprintPayload);
}
function customerReadPendingOrder(fingerprint) {
  const storageKey = customerPendingOrderStorageKey();
  try {
    // Elimina cualquier versión insegura antigua.
    localStorage.removeItem(storageKey);
    const pending = JSON.parse(
      sessionStorage.getItem(storageKey) || "null"
    );
    const createdAt = Number(pending?.createdAt) || 0;
    const isRecent = Date.now() - createdAt < 30 * 60 * 1000;
    if (
      isRecent &&
      pending?.fingerprint === fingerprint &&
      pending?.orderId &&
      pending?.publicToken
    ) {
      return pending;
    }
    // Si está vencido o dañado, lo eliminamos.
    sessionStorage.removeItem(storageKey);
  } catch {
    try {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch {}
  }
  return null;
}
async function customerCreateCustomerOrder(
  orderPayload,
  total,
  tableLabel,
  customerName,
  orderType
) {
  if (!customerClient) {
    throw new Error("ORDER_SERVICE_UNAVAILABLE");
  }
  const fingerprint = customerOrderFingerprint(orderPayload);
  const pendingOrder = customerReadPendingOrder(fingerprint);
  const orderId =
    pendingOrder?.orderId ||
    customerGenerateId();
  const publicToken =
    pendingOrder?.publicToken ||
    customerGenerateId();
  /*
   * El publicToken es una credencial privada.
   *
   * Nunca debe almacenarse dentro de order_json.
   * Solo viaja como p_public_token hacia el gateway seguro.
   */
  const payloadForServer = {
    ...orderPayload,
  };
  delete payloadForServer.publicToken;
  delete payloadForServer.public_token;
  /*
   * Identificador antiabuso del navegador.
   *
   * El servidor/Edge decide cómo utilizarlo.
   * El frontend nunca es la autoridad del rate limit.
   */
  payloadForServer.clientGuardId =
    customerOrderGuardId();
  const pendingStorageKey =
    customerPendingOrderStorageKey();
  /*
   * Conservamos temporalmente ID + token para idempotencia.
   *
   * Si hay un corte de red después de que el servidor haya
   * recibido el pedido, un reintento utiliza exactamente
   * las mismas credenciales y no crea otro pedido.
   *
   * Nunca se persiste en localStorage.
   */
  try {
    sessionStorage.setItem(
      pendingStorageKey,
      JSON.stringify({
        fingerprint,
        orderId,
        publicToken,
        createdAt:
          pendingOrder?.createdAt ||
          Date.now(),
      })
    );
    localStorage.removeItem(
      pendingStorageKey
    );
  } catch {
    /*
     * La falta de almacenamiento temporal no debe impedir
     * que el cliente pueda realizar el pedido.
     */
  }
  const edgePayload = {
    p_id: orderId,
    p_user_id: customerStoreId,
    p_public_token: publicToken,
    p_table_label: tableLabel,
    p_customer_name: customerName,
    p_order_type: orderType,
    p_order_json: payloadForServer,
    p_total: total,
  };
  /*
   * P0 SECURITY
   *
   * Desde este punto el navegador NO llama directamente a
   * public.create_customer_order().
   *
   * Todo pedido de cliente entra primero por:
   *
   *   Supabase Edge
   *       create-customer-order
   *
   * Ahí se aplican validación, identidad, cuotas y protección
   * antiabuso antes de llegar al núcleo SQL.
   *
   * No existe fallback directo al RPC. Esto es intencional:
   * si el gateway de seguridad falla, el pedido falla cerrado.
   */
  const {
    data,
    error: invokeError,
  } = await customerClient.functions.invoke(
    "create-customer-order",
    {
      body: edgePayload,
    }
  );
  if (invokeError) {
    let serverMessage = "";
    /*
     * Supabase FunctionsHttpError incluye normalmente una
     * Response en error.context. Intentamos recuperar únicamente
     * el código funcional enviado por nuestra Edge Function.
     */
    try {
      const response =
        invokeError?.context;
      if (
        response &&
        typeof response.clone === "function"
      ) {
        const responseData =
          await response.clone().json();
        serverMessage = String(
          responseData?.error ||
          responseData?.message ||
          ""
        ).trim();
      }
    } catch {
      /*
       * No propagamos un segundo error causado únicamente
       * por no poder decodificar la respuesta.
       */
    }
    const message =
      serverMessage ||
      String(
        invokeError?.message ||
        "ORDER_CREATE_FAILED"
      ).trim() ||
      "ORDER_CREATE_FAILED";
    const edgeError =
      new Error(message);
    if (invokeError?.name) {
      edgeError.name =
        invokeError.name;
    }
    throw edgeError;
  }
  /*
   * Defensa adicional:
   * una respuesta HTTP exitosa no debe poder transportar
   * silenciosamente un error funcional.
   */
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "ORDER_CREATE_INVALID_RESPONSE"
    );
  }
  if (
    data.error
  ) {
    throw new Error(
      String(data.error)
    );
  }
  const row =
    Array.isArray(data)
      ? data[0]
      : data;
  const returnedId =
    String(
      row?.id ||
      ""
    ).trim();
  const returnedPublicToken =
    String(
      row?.public_token ||
      row?.publicToken ||
      ""
    ).trim();
  /*
   * No aceptamos una respuesta incompleta.
   *
   * Si Edge/SQL deja de cumplir el contrato, fallamos antes
   * de empezar tracking/chat/pago con credenciales corruptas.
   */
  if (
    !returnedId ||
    !returnedPublicToken
  ) {
    throw new Error(
      "ORDER_CREATE_INVALID_RESPONSE"
    );
  }
  /*
   * El pedido fue confirmado por el servidor.
   * La estructura de reintento ya no es necesaria.
   */
  try {
    sessionStorage.removeItem(
      pendingStorageKey
    );
    localStorage.removeItem(
      pendingStorageKey
    );
  } catch {}
  /*
   * Conservamos exactamente el contrato que el resto de
   * cliente.js ya consume.
   *
   * No modificamos tracking, pagos, chat ni renderizado.
   */
  return {
    id: returnedId,
    publicToken:
      returnedPublicToken,
    payload:
      payloadForServer,
    trackingAvailable: true,
  };
}
function customerStatusText(row) {
  const ticket = row?.ticket_number ? customerT("ticketSuffix", { ticket: String(row.ticket_number).padStart(4, "0") }) : "";
  const status = row?.canonical_status || row?.status || "";
  if (status === "accepted") return customerT("accepted", { ticket });
  if (status === "sent") return customerT("sent", { ticket });
  if (status === "delivered") return customerT("delivered", { ticket });
  if (status === "cancelled" || status === "rejected") return customerT("cancelled");
  if (!["", "created", "submitted", "restaurant_review"].includes(status)) {
    const label = customerTimelineLabel(status);
    return ticket ? `${label} - ${ticket}` : label;
  }
  return customerT("orderSentWaiting");
}
function customerStatusType(status) {
  if (status === "accepted" || status === "sent" || status === "delivered") return "ok";
  if (status === "cancelled") return "error";
  return "";
}
function customerTimelineLabel(status) {
  const labels = {
    created: "timelineCreated",
    submitted: "timelineSubmitted",
    restaurant_review: "timelineSubmitted",
    accepted: "timelineAccepted",
    preparing: "timelinePreparing",
    ready_for_pickup: "timelineReady",
    courier_searching: "timelineCourierOffered",
    courier_offered: "timelineCourierOffered",
    courier_accepted: "timelineCourierAccepted",
    courier_arrived_restaurant: "timelineCourierArrivedRestaurant",
    picked_up: "timelineOnTheWay",
    on_the_way: "timelineOnTheWay",
    courier_arrived_customer: "timelineCourierArrivedCustomer",
    delivered: "timelineDelivered",
    cancelled: "timelineCancelled",
    rejected: "timelineCancelled",
  };
  return customerT(labels[status] || "timelineSubmitted");
}
function customerRenderOrderTimeline(events = []) {
  if (!customerElements.orderTimeline) return;
  customerElements.orderTimeline.hidden = !events.length;
  customerElements.orderTimeline.innerHTML = events
    .map((event) => {
      const created = new Date(event.created_at);
      const time = Number.isNaN(created.getTime())
        ? ""
        : created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `<li><span>${customerEscapeHtml(customerTimelineLabel(event.new_status))}</span><time>${customerEscapeHtml(time)}</time></li>`;
    })
    .join("");
}
async function customerLoadOrderTimeline() {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) {
    customerRenderOrderTimeline([]);
    return;
  }
  const { data, error } = await customerClient.rpc("get_customer_order_timeline", {
    p_order_id: customerTrackedOrder.id,
    p_public_token: customerTrackedOrder.publicToken,
  });
  if (error) return;
  customerRenderOrderTimeline(Array.isArray(data) ? data : []);
}
function customerTrackingRelativeTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 30) return customerT("courierTrackingNow");
  const formatter = new Intl.RelativeTimeFormat(customerLanguage, { numeric: "auto" });
  if (elapsedSeconds < 3600) return formatter.format(-Math.max(1, Math.round(elapsedSeconds / 60)), "minute");
  if (elapsedSeconds < 86400) return formatter.format(-Math.max(1, Math.round(elapsedSeconds / 3600)), "hour");
  return formatter.format(-Math.max(1, Math.round(elapsedSeconds / 86400)), "day");
}
function customerRenderCourierTracking(row = null) {
  const panel = customerElements.courierTracking;
  if (!panel) return;
  const assignmentStatus = String(row?.courier_assignment_status || "");
  const canonicalStatus = String(row?.canonical_status || "");
  const hasAssignment = Boolean(row?.assignment_id || row?.courier_user_id);
  const isSearching = ["courier_searching", "courier_offered"].includes(canonicalStatus)
    || ["offered", "no_courier"].includes(assignmentStatus);
  if (!hasAssignment && !isSearching) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  const name = String(row?.courier_name || "").trim();
  const lat = Number(row?.courier_lat);
  const lng = Number(row?.courier_lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const lastLocation = customerTrackingRelativeTime(row?.courier_location_updated_at);
  const etaDate = new Date(row?.estimated_delivery_at || row?.estimated_pickup_at || 0);
  const eta = Number.isNaN(etaDate.getTime())
    ? ""
    : etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const mapUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";
  panel.hidden = false;
  panel.innerHTML = `
    <strong>${customerEscapeHtml(customerT("courierTrackingTitle"))}</strong>
    ${name ? `<span>${customerEscapeHtml(customerT("courierTrackingName", { name }))}</span>` : ""}
    <div class="customer-courier-tracking-meta">
      ${lastLocation ? `<span>${customerEscapeHtml(customerT("courierTrackingLocation", { time: lastLocation }))}</span>` : ""}
      ${eta ? `<span>${customerEscapeHtml(customerT("courierTrackingEta", { time: eta }))}</span>` : ""}
    </div>
    ${!hasLocation ? `<span>${customerEscapeHtml(customerT("courierTrackingWaiting"))}</span>` : ""}
    ${mapUrl ? `<a class="customer-map-button" href="${mapUrl}" target="_blank" rel="noopener noreferrer">${customerEscapeHtml(customerT("courierTrackingMap"))}</a>` : ""}
  `;
}
function customerStopOrderTrackingRealtime() {
  if (customerTrackingRealtimeRetryTimer) {
    window.clearTimeout(customerTrackingRealtimeRetryTimer);
    customerTrackingRealtimeRetryTimer = null;
  }
  if (customerTrackingRealtimeStableTimer) {
  window.clearTimeout(customerTrackingRealtimeStableTimer);
  customerTrackingRealtimeStableTimer = null;
}
  if (customerTrackingRefreshTimer) {
    window.clearTimeout(customerTrackingRefreshTimer);
    customerTrackingRefreshTimer = null;
  }
  const channel = customerTrackingRealtimeChannel;
  customerTrackingRealtimeChannel = null;
  customerTrackingRealtimeSignature = "";
  customerTrackingRealtimeRow = null;
  customerTrackingRealtimeStatus = "idle";
  if (channel && customerClient?.removeChannel) customerClient.removeChannel(channel).catch(() => {});
}
function customerScheduleTrackingRefresh() {
  if (customerTrackingRefreshTimer) window.clearTimeout(customerTrackingRefreshTimer);
  customerTrackingRefreshTimer = window.setTimeout(() => {
    customerTrackingRefreshTimer = null;
    customerPollOrderStatus().catch(() => {});
  }, 250);
}
function customerStartOrderTrackingRealtime(row = {}) {
  if (!customerClient?.channel || !customerUser || !customerTrackedOrder?.id) return;
  const courierId = String(row.courier_user_id || "");
  const signature = `${customerTrackedOrder.id}:${courierId}`;
  if (customerTrackingRealtimeChannel && customerTrackingRealtimeSignature === signature) {
    customerTrackingRealtimeRow = { ...row };
    return;
  }
  customerStopOrderTrackingRealtime();
  customerTrackingRealtimeSignature = signature;
  customerTrackingRealtimeRow = { ...row };
  let channel = customerClient
    .channel(`customer-order-tracking-${customerUser.id}-${customerTrackedOrder.id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "customer_orders", filter: `id=eq.${customerTrackedOrder.id}` },
      customerScheduleTrackingRefresh
    );
  if (courierId) {
    channel = channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "courier_live_locations", filter: `user_id=eq.${courierId}` },
      (payload) => {
        if (channel !== customerTrackingRealtimeChannel || signature !== customerTrackingRealtimeSignature) return;
        const location = payload?.new;
        const current = customerTrackingRealtimeRow;
        if (current?.id !== customerTrackedOrder?.id) return;
        const locationAt = location?.last_location_at || location?.updated_at;
        const lat = Number(location?.lat), lng = Number(location?.lng);
        if (location?.user_id !== courierId || current?.courier_user_id !== courierId
          || !["accepted", "arrived_restaurant", "picked_up", "arrived_customer"].includes(current?.courier_assignment_status)
          || ["delivered", "cancelled", "rejected", "failed", "refunded"].includes(current?.canonical_status)
          || location?.lat == null || location?.lng == null
          || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
          || !Number.isFinite(Date.parse(locationAt))) {
          customerScheduleTrackingRefresh();
          return;
        }
        if (Date.parse(locationAt) < Date.parse(current.courier_location_updated_at)) return;
        customerTrackingRealtimeRow = { ...current, courier_lat: lat, courier_lng: lng,
          courier_location_updated_at: locationAt };
        customerRenderCourierTracking(customerTrackingRealtimeRow);
      }
    );
  }
  customerTrackingRealtimeChannel = channel;
  customerTrackingRealtimeStatus = "connecting";
  channel.subscribe((status) => {
  if (
    channel !== customerTrackingRealtimeChannel ||
    signature !== customerTrackingRealtimeSignature
  ) {
    return;
  }
  customerTrackingRealtimeStatus = status;
  if (status === "SUBSCRIBED") {
    if (customerTrackingRealtimeStableTimer) {
      window.clearTimeout(customerTrackingRealtimeStableTimer);
    }
    customerTrackingRealtimeStableTimer = window.setTimeout(() => {
      customerTrackingRealtimeStableTimer = null;
      if (
        channel === customerTrackingRealtimeChannel &&
        signature === customerTrackingRealtimeSignature &&
        customerTrackingRealtimeStatus === "SUBSCRIBED"
      ) {
        customerTrackingRealtimeRetryDelay =
          CUSTOMER_REALTIME_RECONNECT_MIN_MS;
      }
    }, CUSTOMER_REALTIME_STABLE_MS);
    customerScheduleTrackingRefresh();
    return;
  }
  if (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  ) {
    if (customerTrackingRealtimeStableTimer) {
      window.clearTimeout(customerTrackingRealtimeStableTimer);
      customerTrackingRealtimeStableTimer = null;
    }
    customerTrackingRealtimeChannel = null;
    customerTrackingRealtimeSignature = "";
    if (customerClient?.removeChannel) {
      customerClient.removeChannel(channel).catch(() => {});
    }
    if (customerTrackingRealtimeRetryTimer) {
      window.clearTimeout(customerTrackingRealtimeRetryTimer);
    }
    const retryDelay = customerTrackingRealtimeRetryDelay;
    customerTrackingRealtimeRetryDelay = Math.min(
      retryDelay * 2,
      CUSTOMER_REALTIME_RECONNECT_MAX_MS
    );
    customerTrackingRealtimeRetryTimer = window.setTimeout(() => {
      customerTrackingRealtimeRetryTimer = null;
      if (
        customerTrackedOrder?.id &&
        window.navigator.onLine
      ) {
        customerPollOrderStatus().catch(() => {});
      }
    }, retryDelay);
  }
});
  }
async function customerPollOrderStatus() {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient || !navigator.onLine) return false;
  if (customerStatusPollInFlight) return customerStatusPollInFlight;
  const orderId = customerTrackedOrder.id;
  const publicToken = customerTrackedOrder.publicToken;
  const operation = (async () => {
  let data = null;
  let error = null;
  if (customerTrackingRpcAvailable !== false) {
    ({ data, error } = await customerClient.rpc("get_customer_order_tracking", {
      p_order_id: orderId,
      p_public_token: publicToken,
    }));
    if (error && customerIsMissingRpc(error)) {
      customerTrackingRpcAvailable = false;
      data = null;
      error = null;
    } else if (!error) {
      customerTrackingRpcAvailable = true;
    }
  }
  if (customerTrackingRpcAvailable === false) {
    ({ data, error } = await customerClient.rpc("get_customer_order_status", {
      p_order_id: orderId,
      p_public_token: publicToken,
    }));
  }
  if (orderId !== customerTrackedOrder?.id || publicToken !== customerTrackedOrder?.publicToken) return false;
  if (error) {
    customerSetTrackingStatus(customerT("orderSentCashier"), "");
    return false;
  }
  const row = customerNormalizeRpcRow(data);
  if (!row) return false;
  const nextStatus = row.canonical_status || row.status || "pending";
  const previousStatus = customerTrackedOrder.status;
  customerTrackedOrder.status = nextStatus;
  customerPersistTrackedOrder();
  const statusRow = { ...row, status: nextStatus };
  const message = customerStatusText(statusRow);
  const type = customerStatusType(nextStatus);
  customerSetTrackingStatus(message, type);
  customerRenderCourierTracking(row);
  customerStartOrderTrackingRealtime(row);
  customerLoadOrderTimeline().catch(() => {});
  if (customerElements.confirmDeliveryButton) {
    customerElements.confirmDeliveryButton.hidden = nextStatus !== "delivered";
    customerElements.confirmDeliveryButton.disabled = customerTrackedOrder.customerConfirmed === true;
    customerElements.confirmDeliveryButton.textContent = customerTrackedOrder.customerConfirmed
      ? customerT("deliveryConfirmed")
      : customerT("confirmDelivery");
  }
  if (previousStatus && previousStatus !== nextStatus) {
    customerShowNotification(customerT("notificationStatusTitle"), message);
  }
 if (["delivered", "cancelled", "rejected", "failed", "refunded"].includes(nextStatus)) {
  customerStopStatusPolling();
  customerStopChatPolling();
  customerStopOrderTrackingRealtime();
  if (["cancelled", "rejected", "failed", "refunded"].includes(nextStatus)) {
    try {
      const storageKey = customerTrackedOrderStorageKey();
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch {}
  }
}
  return true;
  })();
  customerStatusPollInFlight = operation;
  try {
    return await operation;
  } finally {
    if (customerStatusPollInFlight === operation) customerStatusPollInFlight = null;
  }
}
function customerStopStatusPolling() {
  if (customerStatusTimer) {
    window.clearTimeout(customerStatusTimer);
    customerStatusTimer = null;
  }
  customerStatusPollSignature = "";
}
function customerScheduleStatusPoll(delayMs) {
  if (!customerTrackedOrder?.id || !customerTrackedOrder.publicToken || !customerClient) {
    customerStopStatusPolling();
    return;
  }
  if (customerStatusTimer) window.clearTimeout(customerStatusTimer);
  const signature = `${customerTrackedOrder.id}:${customerTrackedOrder.publicToken}`;
  customerStatusPollSignature = signature;
  customerStatusTimer = window.setTimeout(async () => {
    customerStatusTimer = null;
    const currentSignature = `${customerTrackedOrder?.id || ""}:${customerTrackedOrder?.publicToken || ""}`;
    if (signature !== customerStatusPollSignature || signature !== currentSignature) return;
    if (document.visibilityState !== "visible" || !window.navigator.onLine) {
      customerScheduleStatusPoll(CUSTOMER_STATUS_POLL_MIN_MS);
      return;
    }
    if (customerTrackingRealtimeStatus === "SUBSCRIBED") {
      customerScheduleStatusPoll(CUSTOMER_STATUS_POLL_MIN_MS);
      return;
    }
    const loaded = await customerPollOrderStatus();
    customerStatusPollingDelay = loaded
      ? CUSTOMER_STATUS_POLL_MIN_MS
      : Math.min(Math.max(customerStatusPollingDelay, CUSTOMER_STATUS_POLL_MIN_MS) * 2, CUSTOMER_STATUS_POLL_MAX_MS);
    customerScheduleStatusPoll(customerStatusPollingDelay);
  }, Math.max(0, Number(delayMs) || 0));
}
function customerStartStatusTracking(orderId, publicToken, paymentMethod, paymentUrl) {
  customerStopStatusPolling();
  customerStopOrderTrackingRealtime();
  customerTrackedOrder = {
    id: orderId,
    publicToken,
    paymentMethod,
    paymentUrl,
    status: "pending",
  };
  customerSetTrackingStatus(customerT("orderSentWaiting"), "");
  if (customerElements.confirmDeliveryButton) customerElements.confirmDeliveryButton.hidden = true;
  customerRenderCourierTracking(null);
  customerRenderOrderTimeline([]);
  customerStatusPollingDelay = CUSTOMER_STATUS_POLL_MIN_MS;
  customerScheduleStatusPoll(0);
  customerStartChat(orderId, publicToken);
}
function customerRenderCategories() {
  const categories = Object.keys(customerMenu);
  if (!categories.includes(customerActiveCategory)) {
    customerActiveCategory = categories[0] || "";
  }
  customerElements.categoryTabs.innerHTML = categories
    .map(
      (category) => {
        const translatedCategory = customerMenuTextDisplay(category) || category;
        customerQueueMenuTextTranslation(category);
        return `
        <button type="button" data-category="${customerEscapeHtml(category)}" aria-selected="${
        !customerSearchQuery && category === customerActiveCategory
      }">
          ${customerEscapeHtml(translatedCategory)}
        </button>
      `;
      }
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
      ({ category, dish, index }) => {
        const displayName = customerMenuTextDisplay(dish.name) || dish.name;
        const displayCategory = customerMenuTextDisplay(category) || category;
        const description = customerDescriptionDisplay(dish);
        customerQueueMenuTextTranslation(dish.name);
        customerQueueMenuTextTranslation(category);
        customerQueueDescriptionTranslation(dish);
        return `
          <button
            class="customer-dish-button ${dish.imageUrl ? "has-product-image" : ""} ${customerProductAvailable(dish) ? "" : "is-unavailable"}"
            type="button"
            data-category="${customerEscapeHtml(category)}"
            data-index="${index}"
            ${customerProductAvailable(dish) ? "" : "disabled aria-disabled=\"true\""}
          >
            ${dish.imageUrl ? `<img src="${customerEscapeHtml(dish.imageUrl)}" alt="${customerEscapeHtml(displayName)}" loading="lazy" />` : ""}
            <strong>${customerEscapeHtml(displayName)}</strong>
            ${description ? `<small>${customerEscapeHtml(description)}</small>` : ""}
            ${searchQuery ? `<small>${customerEscapeHtml(displayCategory)}</small>` : ""}
            <span>${customerFormatMoney(dish.price)}</span>
            ${customerProductAvailable(dish) ? "" : `<em>${customerEscapeHtml(customerT("unavailable"))}</em>`}
          </button>
        `;
      }
    )
    .join("");
}
function customerCartItemCount() {
  return customerCart.reduce(
    (total, item) =>
      total +
      Math.max(
        1,
        Number.parseInt(item?.qty, 10) || 1
      ),
    0
  );
}
function customerRenderHeaderCart() {
  if (
    !customerElements.headerCartBadge ||
    !customerElements.headerCartButton
  ) {
    return;
  }
  const count = customerCartItemCount();
  customerElements.headerCartBadge.textContent =
    count > 99 ? "99+" : String(count);
  customerElements.headerCartBadge.hidden =
    count === 0;
}
function customerOpenHeaderCart() {
  if (!customerStoreId) {
    customerSetView("home");
    return;
  }
  customerSetView("store", { keepScroll: true });
  if (!customerElements.cartModal) return;
  customerElements.cartModal.hidden = false;
  document.body.classList.add("customer-cart-open");
  window.requestAnimationFrame(() => {
    customerElements.cartSheet?.focus();
  });
}
function customerCloseHeaderCart() {
  if (!customerElements.cartModal || customerElements.cartModal.hidden) return;
  customerElements.cartModal.hidden = true;
  document.body.classList.remove("customer-cart-open");
  customerElements.headerCartButton?.focus();
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
customerElements.sendButton.disabled =
  customerCart.length === 0;
customerRenderHeaderCart();
customerRenderSelectedRestaurantDetails();
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
      station: customerNormalizeProductStation(dish.station),
    });
  }
  customerRenderCart();
}
function customerFindCurrentMenuProduct(cartItem) {
  const cartProductId = customerNormalizeProductId(cartItem?.productId || "");
  const cartName = String(cartItem?.name || "").toLowerCase();
  let fallbackMatch = null;
  Object.values(customerMenu || {}).forEach((dishes) => {
    (dishes || []).forEach((dish) => {
      const productId = customerNormalizeProductId(dish.id || dish.productId || "");
      if (cartProductId && productId && cartProductId === productId) fallbackMatch = dish;
      if (!fallbackMatch && cartName && String(dish.name || "").toLowerCase() === cartName) fallbackMatch = dish;
    });
  });
  return fallbackMatch;
}
function customerSyncCartWithCurrentMenu() {
  if (!customerCart.length) return;
  customerCart = customerCart.map((item) => {
    const product = customerFindCurrentMenuProduct(item);
    if (!product) return item;
    return {
      ...item,
      productId: customerNormalizeProductId(product.id || product.productId) || item.productId,
      name: product.name || item.name,
      description: product.description || "",
      price: Number.parseFloat(product.price) || 0,
      station: customerNormalizeProductStation(product.station),
    };
  });
}
async function customerLoadMenu(options = {}) {
  const config = customerSupabaseConfig();
  if (!config.url || !config.anonKey) {
    customerSetStatus(customerT("appNotConfigured"), "error");
    return;
  }
  if (!window.supabase?.createClient && !(await customerLoadSupabaseLibrary())) {
    customerSetStatus(customerT("appConnectionLoadError"), "error");
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
    customerSetView("home", { keepScroll: true });
    return;
  }
  const requestedStoreId = customerStoreId;
  customerStartMenuRealtime();
  let data = null;
  let loadedFromCache = false;
  try {
    data = await customerFetchPublicMenu(requestedStoreId);
  } catch (error) {
    console.error("ERROR REAL CARGANDO RESTAURANTE:", error);
    console.error("STORE ID:", requestedStoreId);
    if (requestedStoreId !== customerStoreId) return;
    data = customerReadMenuCache(requestedStoreId);
    if (!data) {
      customerSetStatus(customerT("menuLoadError"), "error");
      return;
    }
    loadedFromCache = true;
  }
  if (requestedStoreId !== customerStoreId) return;
  if (!data) {
    await customerLoadRestaurantDirectory({ silent: true });
    if (!customerStoreId || requestedStoreId !== customerStoreId) return;
    customerSetStatus(customerT("noMenu"), "error");
    return;
  }
  customerSettings = {
    businessName: customerNormalizeBusinessName(data.settings?.businessName || customerSelectedRestaurant()?.name),
    businessLogoUrl: customerNormalizeText(data.settings?.businessLogoUrl || customerSelectedRestaurant()?.logoUrl),
    currencySymbol: data.settings?.currencySymbol || "$",
    currencyPosition: data.settings?.currencyPosition === "after" ? "after" : "before",
    moneyFormat: data.settings?.moneyFormat === "eu" ? "eu" : "us",
    deliveryFee: customerNormalizeMoney(data.settings?.deliveryFee),
    deliveryMinimumFee: customerNormalizeDeliveryMinimumFee(data.settings?.deliveryMinimumFee),
    restaurantAddress: customerNormalizeText(data.settings?.restaurantAddress),
    restaurantOperationalOpen:
      typeof data.settings?.restaurantOperationalOpen === "boolean"
        ? data.settings.restaurantOperationalOpen
        : customerSelectedRestaurant()?.operationalOpen === true,
    openingHours: data.settings?.openingHours || customerSelectedRestaurant()?.openingHours || {},
    restaurantLatitude: Number.isFinite(Number(data.settings?.restaurantLatitude))
      ? Number(data.settings.restaurantLatitude)
      : customerSelectedRestaurant()?.latitude ?? null,
    restaurantLongitude: Number.isFinite(Number(data.settings?.restaurantLongitude))
      ? Number(data.settings.restaurantLongitude)
      : customerSelectedRestaurant()?.longitude ?? null,
    googleMapsApiKey: customerNormalizeText(data.settings?.googleMapsApiKey),
    bankAccount: customerNormalizeText(data.settings?.bankAccount),
    bankTransferNote: customerNormalizeText(data.settings?.bankTransferNote),
    onlinePaymentProvider: String(data.settings?.onlinePaymentProvider || "disabled").toLowerCase() === "stripe"
      ? "stripe"
      : "disabled",
    onlinePaymentNote: customerNormalizeText(data.settings?.onlinePaymentNote),
  };
  customerRestoreTrackedOrder();
  await customerHandlePaymentReturn();
  if (requestedStoreId !== customerStoreId) return;
  customerApplyBusinessName();
  customerRenderSelectedRestaurantDetails();
  customerRenderPaymentMethods();
  const loadedMenu = customerNormalizeMenu(data.menu || {});
  if (!customerMenuProductCount(loadedMenu)) {
    customerMenu = loadedMenu;
    customerSetStatus(customerT("noMenu"), "error");
    customerRenderCategories();
    customerRenderMenu();
    return;
  }
  if (!loadedFromCache) {
    customerStoreMenuCache(requestedStoreId, loadedMenu, customerSettings);
  }
  customerMenu = loadedMenu;
  customerActiveCategory = Object.keys(customerMenu)[0] || "";
  customerSyncCartWithCurrentMenu();
  if (customerTableFromQr) {
    customerElements.tableInput.value = customerTableFromQr;
    customerElements.tableLabel.textContent = customerT("orderFor", { table: customerTableFromQr });
  }
  customerSetStatus(customerT(loadedFromCache ? "noConnection" : "menuReady"), loadedFromCache ? "error" : "ok");
  customerRenderCategories();
  customerRenderMenu();
  customerRenderDeliveryFields();
  customerRenderCart();
  customerRenderSelectedRestaurantDetails();
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
  if (!customerCart.length) {
    customerSetStatus(customerT("addProductFirst"), "error");
    return;
  }
  const selectedRestaurant = customerSelectedRestaurant();
  if (
    selectedRestaurant?.countryCode
    && customerRegistrationRegion.countryCode
    && selectedRestaurant.countryCode !== customerRegistrationRegion.countryCode
  ) {
    customerSetStatus(customerT("restaurantRegionMismatch"), "error");
    await customerLoadRestaurantDirectory({ silent: true });
    return;
  }
  if (
    selectedRestaurant?.region
    && customerRegistrationRegion.region
    && customerNormalizeSearchText(selectedRestaurant.region) !== customerNormalizeSearchText(customerRegistrationRegion.region)
  ) {
    customerSetStatus(customerT("restaurantRegionMismatch"), "error");
    await customerLoadRestaurantDirectory({ silent: true });
    return;
  }
  const restaurantAcceptsOrders = selectedRestaurant
    ? selectedRestaurant.operationalOpen === true
    : customerSettings.restaurantOperationalOpen === true;
  if (!restaurantAcceptsOrders) {
    customerSetStatus(customerT("restaurantClosedOrder"), "error");
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
        station: customerNormalizeProductStation(item.station),
      },
      total_snapshot: itemTotal,
      name: productName,
      description: item.description || "",
      price: unitPrice,
      qty: quantity,
      note: itemNote,
      station: customerNormalizeProductStation(item.station),
    };
  });
  const total = customerCartTotal();
  const orderPayload = {
    source: "cliente_qr",
    customerUserId: customerUser?.id || null,
    customerEmail: customerUser?.email || "",
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
  if (customerUser) {
    await customerSaveProfile();
  }

  insertedOrder = await customerCreateCustomerOrder(
    orderPayload,
    total,
    tableLabel,
    customerName,
    orderType
  );
} catch (error) {
  console.error("ERROR REAL create_customer_order:", error);
if (/ORDER_RATE_LIMITED/i.test(String(error?.message || ""))) {
  customerSetStatus(customerT("orderRateLimited"), "error");
} else if (/restaurant is closed/i.test(String(error?.message || ""))) {
  customerSetStatus(customerT("restaurantClosedOrder"), "error");
      customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
    } else if (/restaurant (country|region) does not match/i.test(String(error?.message || ""))) {
      customerSetStatus(customerT("restaurantRegionMismatch"), "error");
      customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
    } else if (/delivery quote|delivery route/i.test(String(error?.message || ""))) {
      customerMapDistance = null;
      customerElements.distanceInput.value = "";
      customerSetStatus(customerT("deliveryQuoteRequired"), "error");
    } else if (/product .*unavailable|product not found|invalid product|menu changed/i.test(String(error?.message || ""))) {
      customerSetStatus(customerT("menuChangedBeforeOrder"), "error");
      customerLoadMenu({ silent: true }).catch(() => {});
    }
    insertedOrder = null;
  }
  if (!insertedOrder) {
    customerElements.sendButton.disabled = false;
 if (![customerT("orderRateLimited"), customerT("restaurantClosedOrder"), customerT("restaurantRegionMismatch"), customerT("deliveryQuoteRequired"), customerT("menuChangedBeforeOrder")].includes(customerElements.status.textContent)) {
      customerSetStatus(customerT("sendOrderError"), "error");
    }
    return;
  }
  customerCart = [];
  customerMapDistance = null;
  customerElements.distanceInput.value = "";
  customerElements.notesInput.value = "";
  customerRenderCart();
  if (insertedOrder.trackingAvailable) {
    customerStartStatusTracking(insertedOrder.id, insertedOrder.publicToken, paymentMethod, "");
    customerTrackedOrder.total = total;
    customerPersistTrackedOrder();
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
customerCloseHeaderCart();
customerSetView("orders");
  if (paymentMethod === "Online" && insertedOrder.publicToken) {
    await customerStartOnlinePayment(insertedOrder.id, insertedOrder.publicToken);
  }
}
customerElements.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  if (customerMenuSearchTimer) {
    window.clearTimeout(customerMenuSearchTimer);
    customerMenuSearchTimer = null;
  }
  customerActiveCategory = button.dataset.category;
  customerApplyMenuSearch("");
});
if (customerElements.menuSearchInput) {
  customerElements.menuSearchInput.addEventListener("input", () => {
    if (customerMenuSearchTimer) window.clearTimeout(customerMenuSearchTimer);
    const value = customerElements.menuSearchInput.value;
    customerMenuSearchTimer = window.setTimeout(() => {
      customerMenuSearchTimer = null;
      customerApplyMenuSearch(value);
    }, 120);
  });
}
if (customerElements.menuSearchClearButton) {
  customerElements.menuSearchClearButton.addEventListener("click", () => {
    if (customerMenuSearchTimer) {
      window.clearTimeout(customerMenuSearchTimer);
      customerMenuSearchTimer = null;
    }
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
    item.note = customerNormalizeNoteDraft(event.target.value);
    event.target.value = item.note;
    return;
  }
  customerRenderCart();
});
customerElements.signInButton.addEventListener("click", customerSignInWithEmail);
customerElements.signUpButton.addEventListener("click", customerSignUpWithEmail);
customerElements.resetPasswordButton?.addEventListener("click", customerSendPasswordResetEmail);
customerElements.resendVerificationButton?.addEventListener("click", customerResendVerificationEmail);
customerElements.updatePasswordButton?.addEventListener("click", customerUpdateRecoveredPassword);
customerElements.cancelRecoveryButton?.addEventListener("click", () => customerHidePasswordRecoveryForm());
customerElements.signOutButton.addEventListener("click", customerSignOut);
customerElements.openSignInButton?.addEventListener("click", () => customerOpenAuthDialog("login"));
customerElements.openSignUpButton?.addEventListener("click", () => customerOpenAuthDialog("register"));
customerElements.authCloseButton?.addEventListener("click", customerCloseAuthDialog);
customerElements.restaurantSearchInput?.addEventListener("input", () => {
  customerRestaurantSearchQuery = customerElements.restaurantSearchInput.value.trim();
  customerRenderRestaurantDirectory();
});
if (customerElements.homeSearchInput) {
  customerElements.homeSearchInput.addEventListener(
    "input",
    (event) => {
      const value =
        String(event.target.value || "").trim();
      customerRestaurantSearchQuery = value;
      if (customerElements.restaurantSearchInput) {
        customerElements.restaurantSearchInput.value =
          value;
      }
      customerRenderRestaurantDirectory();
    }
  );
}
const customerSeeAllCategoriesButton =
  document.querySelector("#customerSeeAllCategoriesButton");
let customerCategoriesExpanded = false;
const customerCategoryScroll =
  document.querySelector(".customer-category-scroll");
customerCategoryScroll?.addEventListener("click", (event) => {
  const button =
    event.target.closest(".customer-category-card");
  if (!button) return;
  const category =
    String(button.dataset.category || "all").trim();
  customerRestaurantCategoryFilter =
    category || "all";
  customerCategoryScroll
    .querySelectorAll(".customer-category-card")
    .forEach((categoryButton) => {
      const active =
        categoryButton === button;
      categoryButton.classList.toggle(
        "active",
        active
      );
      categoryButton.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
  customerRenderRestaurantDirectory();
});
customerSeeAllCategoriesButton?.addEventListener("click", () => {
  if (!customerCategoryScroll) return;
  customerCategoriesExpanded =
    !customerCategoriesExpanded;
  customerCategoryScroll.classList.toggle(
    "is-expanded",
    customerCategoriesExpanded
  );
  customerSeeAllCategoriesButton.innerHTML = customerCategoriesExpanded
    ? `${customerEscapeHtml(customerT("showLess"))} <span aria-hidden="true">↑</span>`
    : `${customerEscapeHtml(customerT("showAll"))} <span aria-hidden="true">→</span>`;
});
customerElements.refreshRestaurantsButton?.addEventListener("click", () => customerLoadRestaurantDirectory());
customerElements.restaurantList?.addEventListener("click", async (event) => {
  const favoriteButton = event.target.closest("[data-favorite-store-id]");
  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();
    const restaurantUserId =
      String(favoriteButton.dataset.favoriteStoreId || "").trim();
    if (!restaurantUserId) return;
    if (!customerUser) {
      customerSetStatus(customerT("favoriteSignIn"), "error");
      customerOpenAuthDialog("login");
      return;
    }
    const client = customerEnsureClient();
    if (!client) return;
    favoriteButton.disabled = true;
    try {
      const { data, error } = await client.rpc(
        "toggle_customer_favorite",
        {
          p_restaurant_user_id: restaurantUserId,
          p_favorite_type: "restaurant",
          p_product_id: "",
        }
      );
      if (error) throw error;
      const isFavorite = data === true;
      favoriteButton.classList.toggle(
        "is-active",
        isFavorite
      );
      favoriteButton.innerHTML =
        isFavorite ? "&#9829;" : "&#9825;";
      const label = customerT(
        isFavorite
          ? "unfavoriteRestaurant"
          : "favoriteRestaurant"
      );
      favoriteButton.setAttribute(
        "aria-label",
        label
      );
      favoriteButton.setAttribute(
        "title",
        label
      );
      favoriteButton.setAttribute(
        "aria-pressed",
        String(isFavorite)
      );
    } catch (error) {
      console.error(
        "Favorite restaurant error:",
        error
      );
      customerSetStatus(
        customerT("favoriteSaveError"),
        "error"
      );
    } finally {
      favoriteButton.disabled = false;
    }
    return;
  }
  const card = event.target.closest(
    ".customer-restaurant-card"
  );
  if (!card) return;
  console.log("CLICK RESTAURANTE:", card.dataset.storeId);
  customerSelectRestaurant(
    card.dataset.storeId
  ).catch((error) => {
    console.error(error);
    customerSetStatus(
      customerT("menuLoadError"),
      "error"
    );
  });
});
customerElements.restaurantList?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".customer-restaurant-card");
  if (!card) return;
  event.preventDefault();
  customerSelectRestaurant(card.dataset.storeId).catch((error) => {
    console.error(error);
    customerSetStatus(customerT("menuLoadError"), "error");
  });
});
customerElements.refreshHistoryButton.addEventListener("click", () => customerLoadHistory());
customerElements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const row = event.target.closest(".customer-history-item");
  if (!button || !row) return;
  if (button.dataset.action === "open-history-order") customerOpenHistoryOrder(row.dataset.orderId);
  if (button.dataset.action === "repeat-history-order") {
    customerRepeatHistoryOrder(row.dataset.orderId).catch((error) => {
      console.error(error);
      customerSetStatus(customerT("historyRepeatUnavailable"), "error");
    });
  }
});
customerElements.notesInput.addEventListener("input", () => {
  customerElements.notesInput.value = customerNormalizeNoteDraft(customerElements.notesInput.value);
});
customerElements.orderType.addEventListener("change", () => {
  customerRenderDeliveryFields();
  customerRenderSelectedRestaurantDetails();
});
customerElements.paymentMethod.addEventListener("change", customerRenderCart);
customerElements.distanceInput.addEventListener("input", customerRenderCart);
customerElements.languageSelect.addEventListener("change", () => customerSetLanguage(customerElements.languageSelect.value));
customerElements.registerCountryInput?.addEventListener("change", () => {
  const countryCode = customerInputValue(customerElements.registerCountryInput).toUpperCase();
  customerRegistrationRegion = {
    ...customerRegistrationRegion,
    countryCode,
    country: customerCountryName(countryCode),
    region: "",
    city: "",
    postalCode: customerInputValue(customerElements.registerPostalCodeInput),
    timezone: countryCode === "PL" ? "Europe/Warsaw" : countryCode === "CO" ? "America/Bogota" : "",
  };
  if (customerElements.registerCityInput) customerElements.registerCityInput.value = "";
  customerRenderRegistrationRegions(countryCode);
  customerStopDirectoryRealtime();
  customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
});
customerElements.registerRegionInput?.addEventListener("change", () => {
  customerRegistrationRegion = customerSyncRegistrationRegionFromInputs();
  customerStopDirectoryRealtime();
  customerLoadRestaurantDirectory({ silent: true }).catch(() => {});
});
[customerElements.registerCityInput, customerElements.registerPostalCodeInput].forEach((input) => {
  input?.addEventListener("input", () => {
    customerRegistrationRegion = customerSyncRegistrationRegionFromInputs();
    customerRenderLocationSummary();
  });
});
if (customerElements.refreshMenuButton) {
  customerElements.refreshMenuButton.addEventListener("click", customerRefreshMenu);
}
customerElements.favoriteRestaurantButton?.addEventListener("click", () => {
  customerToggleFavoriteRestaurant().catch((error) => {
    console.error(error);
    customerSetStatus(customerT("favoriteSaveError"), "error");
    customerRenderFavoriteRestaurantButton();
  });
});
customerElements.headerCartButton?.addEventListener(
  "click",
  customerOpenHeaderCart
);
customerElements.cartCloseButton?.addEventListener(
  "click",
  customerCloseHeaderCart
);
customerElements.cartModal?.addEventListener("click", (event) => {
  if (event.target.closest('[data-cart-close="true"]')) {
    customerCloseHeaderCart();
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    customerElements.cartModal &&
    !customerElements.cartModal.hidden
  ) {
    event.preventDefault();
    customerCloseHeaderCart();
  }
});
customerElements.notifyButton.addEventListener("click", () => {
  customerRequestNotificationPermission().catch(() => {
    customerSetTrackingStatus(customerT("notificationEnableError"), "error");
  });
});
customerElements.useLocationButton.addEventListener("click", customerUseLocation);
customerElements.calculateDistanceButton.addEventListener("click", customerCalculateDistanceWithMaps);
customerElements.chatSendButton.addEventListener("click", customerSendChatMessage);
customerElements.sendButton.addEventListener("click", customerSendOrder);
customerElements.paymentBox?.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="retry-online-payment"]');
  if (!button || !customerTrackedOrder?.id) return;
  button.disabled = true;
  customerStartOnlinePayment(customerTrackedOrder.id, customerTrackedOrder.publicToken)
    .finally(() => { button.disabled = false; });
});
customerElements.confirmDeliveryButton?.addEventListener("click", customerConfirmDelivery);
customerElements.backToRestaurantsButton?.addEventListener("click", () => customerSetView("home"));
customerElements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => customerSetView(button.dataset.customerViewTarget));
});
[customerElements.registerAddressInput, customerElements.registerNeighborhoodInput].forEach((input) => {
  input?.addEventListener("input", () => {
    customerRenderLocationSummary();
    customerRenderProfileDetails();
  });
});
[customerElements.registerCityInput, customerElements.registerAddressInput, customerElements.addressInput].forEach((input) => {
  input?.addEventListener("focus", () => {
    customerPreparePlaceAutocomplete().catch(() => {});
  });
});
[customerElements.addressInput, customerElements.neighborhoodInput].forEach((input) => {
  input?.addEventListener("input", () => {
    customerMapDistance = null;
    customerLocationCoords = null;
    if (customerElements.distanceInput) customerElements.distanceInput.value = "";
    customerRenderLocationSummary();
    customerRenderProfileDetails();
    customerRenderCart();
  });
});
customerElements.editProfileButton?.addEventListener("click", () => {
  if (!customerUser) return;
  const fullName = customerNormalizeText(
    customerElements.nameInput?.value || customerElements.registerNameInput?.value
  );
  const phone = customerNormalizeText(
    customerElements.phoneInput?.value || customerElements.registerPhoneInput?.value
  );
  const address = customerNormalizeText(
    customerElements.addressInput?.value || customerElements.registerAddressInput?.value
  );
  const neighborhood = customerNormalizeText(
    customerElements.neighborhoodInput?.value || customerElements.registerNeighborhoodInput?.value
  );
  customerElements.profileDetails.innerHTML = `
    <label>
      <span>${customerEscapeHtml(customerT("profileName"))}</span>
      <input id="customerProfileEditName" type="text" value="${customerEscapeHtml(fullName)}">
    </label>
    <label>
      <span>${customerEscapeHtml(customerT("profilePhone"))}</span>
      <input id="customerProfileEditPhone" type="tel" value="${customerEscapeHtml(phone)}">
    </label>
    <label>
      <span>${customerEscapeHtml(customerT("profileAddress"))}</span>
      <input id="customerProfileEditAddress" type="text" value="${customerEscapeHtml(address)}">
    </label>
    <label>
      <span>Barrio / ciudad</span>
      <input id="customerProfileEditNeighborhood" type="text" value="${customerEscapeHtml(neighborhood)}">
    </label>
    <div class="customer-profile-edit-buttons">
      <button class="customer-map-button" id="customerProfileSaveButton" type="button">
        Guardar cambios
      </button>
      <button class="customer-map-button" id="customerProfileCancelButton" type="button">
        Cancelar
      </button>
    </div>
  `;
  document
    .querySelector("#customerProfileCancelButton")
    ?.addEventListener("click", () => {
      customerRenderProfileDetails();
      });
    document
  .querySelector("#customerProfileSaveButton")
  ?.addEventListener("click", async () => {
    if (!customerUser) return;
    const newName = customerNormalizeText(
      document.querySelector("#customerProfileEditName")?.value
    );
    const newPhone = customerNormalizeText(
      document.querySelector("#customerProfileEditPhone")?.value
    );
    const newAddress = customerNormalizeText(
      document.querySelector("#customerProfileEditAddress")?.value
    );
    const newNeighborhood = customerNormalizeText(
      document.querySelector("#customerProfileEditNeighborhood")?.value
    );
    if (customerElements.nameInput) {
      customerElements.nameInput.value = newName;
    }
    if (customerElements.phoneInput) {
      customerElements.phoneInput.value = newPhone;
    }
    if (customerElements.addressInput) {
      customerElements.addressInput.value = newAddress;
    }
    if (customerElements.neighborhoodInput) {
      customerElements.neighborhoodInput.value = newNeighborhood;
    }
    if (customerElements.registerNameInput) {
  customerElements.registerNameInput.value =
    newName;
}
if (customerElements.registerPhoneInput) {
  customerElements.registerPhoneInput.value =
    newPhone;
}
if (customerElements.registerAddressInput) {
  customerElements.registerAddressInput.value =
    newAddress;
}
if (customerElements.registerNeighborhoodInput) {
  customerElements.registerNeighborhoodInput.value =
    newNeighborhood;
}
   try {
  await customerSaveProfile();
  customerResolvedProfileName = newName;
  customerRenderGreeting();
  customerRenderLocationSummary();
  customerRenderProfileDetails();
  alert(customerT("profileSaved"));
 }
   catch (error) {
      console.error("Error guardando perfil del cliente:", error);
      alert(customerT("profileSaveError"));
    }
  });
});
function customerRecoverConnection() {
  if (customerRecoveryInFlight) {
    return customerRecoveryInFlight;
  }
  if (
    Date.now() - customerRecoveryLastCompletedAt <
    CUSTOMER_RECOVERY_DEDUP_MS
  ) {
    return Promise.resolve(true);
  }
  const operation = (async () => {
    if (!window.navigator.onLine) return false;
    customerStartDirectoryRealtime();
    const recoveryTasks = [
      customerLoadRestaurantDirectory({
        silent: true,
      }).catch(() => {}),
    ];
    if (customerTrackedOrder) {
      recoveryTasks.push(
        customerPollOrderStatus().catch(() => {})
      );
    }
    if (customerStoreId) {
      customerStartMenuRealtime();
      recoveryTasks.push(
        customerRefreshMenu().catch(() => {
          customerSetStatus(
            customerT("menuRealtimeError"),
            "error"
          );
        })
      );
    }
    await Promise.all(recoveryTasks);
    customerRecoveryLastCompletedAt = Date.now();
    return true;
  })();
  customerRecoveryInFlight = operation;
  operation.then(
    () => {
      if (customerRecoveryInFlight === operation) {
        customerRecoveryInFlight = null;
      }
    },
    () => {
      if (customerRecoveryInFlight === operation) {
        customerRecoveryInFlight = null;
      }
    }
  );
  return operation;
}
window.addEventListener("online", () => {
  customerRecoverConnection().catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState !== "visible" ||
    !window.navigator.onLine
  ) {
    return;
  }
  customerRecoverConnection().catch(() => {});
});
window.addEventListener("offline", () => {
  if (customerStoreId) customerSetStatus(customerT("noConnection"), "error");
});
window.addEventListener("beforeunload", () => {
  customerStopStatusPolling();
  customerStopChatPolling();
  customerStopDirectoryRealtime();
  customerStopMenuRealtime();
  customerStopOrderTrackingRealtime();
});
if (customerElements.registerCountryInput && !customerElements.registerCountryInput.value) {
  customerElements.registerCountryInput.value = customerRegistrationRegion.countryCode || "";
}
customerRenderRegistrationRegions(customerRegistrationRegion.countryCode, customerRegistrationRegion.region);
customerMountAuthDialog();
customerApplyBusinessName();
customerApplyTranslations();
customerRenderLocationSummary();
customerRenderProfileDetails();
customerRenderActiveOrderState();
customerSetView(customerCurrentView, { instant: true });
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
customerLoadMenu().catch(() => {
  customerSetStatus(customerT("openMenuError"), "error");
});
if (customerParams.get("auth") === "login" || customerParams.get("auth") === "register") {
  window.setTimeout(() => customerOpenAuthDialog(customerParams.get("auth")), 250);
}
