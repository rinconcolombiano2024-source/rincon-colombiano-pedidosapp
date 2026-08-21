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
  let translationGeneration = 0;

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
      "Administracion de plataforma": "Administracja platformy",
      "Panel privado para aprobar o rechazar colaboradores despues de verificar sus documentos manualmente.": "Prywatny panel do zatwierdzania lub odrzucania kurierow po recznej weryfikacji dokumentow.",
      "Acceso plataforma": "Dostep do platformy",
      "Acceso privado para la cuenta administradora autorizada.": "Prywatny dostep dla autoryzowanego konta administratora.",
      "Sesion administrativa activa y verificada.": "Sesja administratora jest aktywna i zweryfikowana.",
      "Entrar sin contrasena": "Zaloguj bez hasla",
      "Instalar panel": "Zainstaluj panel",
      "Correo autorizado": "Autoryzowany email",
      "Solicitudes": "Wnioski",
      "Revision de colaboradores": "Weryfikacja kurierow",
      "Restaurante": "Restauracja",
      "Operacion en tiempo real": "Operacje w czasie rzeczywistym",
      "Resumen de hoy": "Podsumowanie dnia",
      "Pedidos recibidos": "Otrzymane zamowienia",
      "Nuevos": "Nowe",
      "En preparacion": "W przygotowaniu",
      "Listos / reparto": "Gotowe / w dostawie",
      "Ventas de hoy": "Dzisiejsza sprzedaz",
      "Menu": "Menu",
      "Cocina": "Kuchnia",
      "Estadisticas": "Statystyki",
      "Personal": "Personel",
      "Cuenta para recibir pagos": "Konto do otrzymywania platnosci",
      "Configurar pagos": "Skonfiguruj platnosci",
      "Revisar cuenta": "Sprawdz konto",
      "Configuracion pendiente": "Konfiguracja w toku",
      "Sin configurar": "Nieskonfigurowane",
      "Verificada para recibir pagos": "Zweryfikowane do otrzymywania platnosci",
      "Cuenta de pagos": "Konto platnicze",
      "Configura una cuenta verificada para recibir el valor neto de los domicilios completados.": "Skonfiguruj zweryfikowane konto, aby otrzymywac kwote netto za zakonczone dostawy.",
      "Confirmar que recibi el pedido": "Potwierdzam odbior zamowienia",
      "Registro de horarios": "Ewidencja czasu pracy",
      "Horas registradas por el personal durante la semana y el mes actuales.": "Godziny zarejestrowane przez personel w biezacym tygodniu i miesiacu.",
      "Semana": "Tydzien",
      "Mes": "Miesiac",
      "Jornada": "Zmiana",
      "Sin registrar entrada": "Brak zarejestrowanego wejscia",
      "Registrar entrada": "Zarejestruj wejscie",
      "Registrar salida": "Zarejestruj wyjscie",
      "Acceso de personal": "Dostep personelu",
      "Estacion de restaurante": "Stanowisko restauracji",
      "Ingresa con tu cuenta. El propietario debe autorizar este correo en su panel.": "Zaloguj sie na swoje konto. Wlasciciel musi zatwierdzic ten adres e-mail w panelu.",
      "Crear cuenta de empleado": "Utworz konto pracownika",
      "Falta autorizacion": "Brak uprawnien",
      "Pide al propietario que autorice tu correo en una estacion.": "Popros wlasciciela o zatwierdzenie Twojego e-maila na stanowisku.",
      "Activar autorizacion": "Sprawdz uprawnienia",
      "Menu del restaurante": "Menu restauracji",
      "Agregar productos": "Dodaj produkty",
      "Buscar producto": "Szukaj produktu",
      "Nombre del plato": "Nazwa dania",
      "Pedido actual": "Biezace zamowienie",
      "Mesero": "Kelner",
      "Mesa": "Stolik",
      "Cliente opcional": "Klient opcjonalnie",
      "Tipo de pedido": "Rodzaj zamowienia",
      "Metodo de pago": "Metoda platnosci",
      "Notas para cocina": "Uwagi dla kuchni",
      "Enviar pedido": "Wyslij zamowienie",
      "Cierre diario": "Zamkniecie dnia",
      "Cierre mensual": "Zamkniecie miesiaca",
      "Mes del informe": "Miesiac raportu",
      "Pedidos del mes": "Zamowienia w miesiacu",
      "Total del mes": "Suma miesiaca",
      "Necesitas conexion para confirmar el cierre mensual.": "Polaczenie z internetem jest wymagane do potwierdzenia zamkniecia miesiaca.",
      "No fue posible confirmar el cierre mensual.": "Nie udalo sie potwierdzic zamkniecia miesiaca.",
      "Ejecuta la migracion V85.02 para ver el cierre mensual confirmado.": "Uruchom migracje V85.02, aby zobaczyc potwierdzone zamkniecie miesiaca.",
      "Pedidos enviados": "Wyslane zamowienia",
      "Estacion operativa": "Stanowisko operacyjne",
      "Pedidos activos": "Aktywne zamowienia",
      "Parrilla": "Grill",
      "Bebidas": "Napoje",
      "Comidas rapidas": "Fast food",
      "Entradas": "Przystawki",
      "Ensaladas": "Salatki",
      "Empaque": "Pakowanie",
      "Despacho": "Wydawanie",
      "Caja": "Kasa",
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
      "Verificado / Aprobado": "Zweryfikowany / Zatwierdzony",
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
      "Acceso colaborador": "Dostęp kuriera",
      "Acepto el contrato, terminos, politica de privacidad y tratamiento de datos para revision y entregas.": "Akceptuję umowę, warunki, politykę prywatności i przetwarzanie danych na potrzeby weryfikacji oraz dostaw.",
      "Actividad": "Aktywność",
      "Cambiar entorno": "Zmień panel",
      "Ciudad, municipio, pueblo, corregimiento o vereda": "Miasto, gmina, wieś lub inna miejscowość",
      "Código postal": "Kod pocztowy",
      "Colombia": "Kolumbia",
      "Compartir ubicacion": "Udostępnij lokalizację",
      "Cuenta y documentos": "Konto i dokumenty",
      "Ej: lunes a viernes 12:00-20:00": "Np. od poniedziałku do piątku 12:00-20:00",
      "Entorno de prueba": "Środowisko testowe",
      "Entrega activa": "Aktywna dostawa",
      "Entregas disponibles": "Dostępne dostawy",
      "Estado": "Status",
      "Guardar nueva contrasena": "Zapisz nowe hasło",
      "Historial": "Historia",
      "Inicia sesion desde Perfil para gestionar entregas.": "Zaloguj się w sekcji Profil, aby zarządzać dostawami.",
      "Inicio": "Start",
      "Localidad": "Miejscowość",
      "Navegacion del colaborador": "Nawigacja kuriera",
      "Nueva contrasena": "Nowe hasło",
      "País": "Kraj",
      "Panel de trabajo": "Panel pracy",
      "Panel del colaborador": "Panel kuriera",
      "Perfil": "Profil",
      "Polonia": "Polska",
      "Primero selecciona un país": "Najpierw wybierz kraj",
      "Región / Departamento": "Województwo / departament",
      "Ruta y estado": "Trasa i status",
      "Selecciona un país": "Wybierz kraj",
      "Sin iniciar sesion": "Niezalogowany",
      "Solicitud de colaborador": "Wniosek kuriera",
      "Selecciona una región": "Wybierz region",
      "Escribe tu localidad": "Wpisz miejscowość",
      "Inicia sesion para ver tu entrega activa.": "Zaloguj się, aby zobaczyć aktywną dostawę.",
      "No tienes una entrega activa.": "Nie masz aktywnej dostawy.",
      "Inicia sesion para consultar el historial.": "Zaloguj się, aby zobaczyć historię.",
      "Todavia no hay entregas finalizadas en esta sesion.": "W tej sesji nie ma jeszcze zakończonych dostaw.",
      "La administracion debe aprobar tu perfil antes de recibir pedidos.": "Administracja musi zatwierdzić Twój profil, zanim otrzymasz zamówienia.",
      "No tienes pedidos disponibles ahora. Activa disponibilidad y comparte ubicacion.": "Nie masz teraz dostępnych zamówień. Włącz dostępność i udostępnij lokalizację.",
      "Este dispositivo no permite compartir ubicacion.": "To urządzenie nie pozwala udostępniać lokalizacji.",
      "Tu perfil debe estar aprobado antes de compartir ubicacion para entregas.": "Twój profil musi być zatwierdzony przed udostępnieniem lokalizacji do dostaw.",
      "Solicitando ubicacion...": "Pobieranie lokalizacji...",
      "Primero comparte tu ubicacion actual.": "Najpierw udostępnij aktualną lokalizację.",
      "Actualizando pedidos disponibles...": "Aktualizowanie dostępnych zamówień...",
      "Nuevo pedido disponible. Revisa y acepta si puedes tomarlo.": "Dostępne jest nowe zamówienie. Sprawdź je i zaakceptuj, jeśli możesz je dostarczyć.",
      "Pedidos actualizados.": "Zamówienia zaktualizowane.",
      "Actualizando entrega...": "Aktualizowanie dostawy...",
      "Selecciona una localidad del pais elegido.": "Wybierz miejscowość w wybranym kraju.",
      "La localidad seleccionada no pertenece a la region elegida. Revisa la region o escribe la localidad manualmente.": "Wybrana miejscowość nie należy do wybranego regionu. Sprawdź region albo wpisz miejscowość ręcznie.",
      "Puedes llenar los datos, pero debes iniciar sesion para guardar la solicitud.": "Możesz wypełnić dane, ale musisz się zalogować, aby zapisać wniosek.",
      "Perfil aprobado. Activa disponibilidad, comparte ubicacion y recibiras pedidos cercanos.": "Profil zatwierdzony. Włącz dostępność, udostępnij lokalizację i odbieraj pobliskie zamówienia.",
      "Debes aceptar contrato, terminos y privacidad.": "Musisz zaakceptować umowę, warunki i politykę prywatności.",
      "Primero inicia sesion o crea tu cuenta.": "Najpierw zaloguj się lub utwórz konto.",
      "Guardando solicitud...": "Zapisywanie wniosku...",
      "Perfil actualizado. Tu aprobacion permanece activa.": "Profil zaktualizowany. Twoje zatwierdzenie pozostaje aktywne.",
      "Solicitud guardada con documentos. Queda pendiente de revision y aprobacion para empezar a trabajar.": "Wniosek z dokumentami został zapisany. Oczekuje na weryfikację i zatwierdzenie przed rozpoczęciem pracy.",
      "No se pudo guardar la solicitud.": "Nie udało się zapisać wniosku.",
      "Escribe correo y contrasena.": "Wpisz email i hasło.",
      "Iniciando sesion...": "Logowanie...",
      "Sesion iniciada.": "Zalogowano.",
      "Usa correo y contrasena de minimo 6 caracteres.": "Użyj adresu email i hasła o długości co najmniej 6 znaków.",
      "Detectando pais e idioma...": "Wykrywanie kraju i języka...",
      "Creando cuenta...": "Tworzenie konta...",
      "Para estar disponible primero comparte tu ubicacion actual.": "Aby być dostępnym, najpierw udostępnij aktualną lokalizację.",
      "Estas disponible para recibir pedidos cercanos.": "Jesteś dostępny do przyjmowania pobliskich zamówień.",
      "Estas desconectado para nuevas entregas.": "Jesteś niedostępny dla nowych dostaw.",
      "Pedido ofrecido": "Zlecenie dostawy",
      "Aceptado": "Zaakceptowano",
      "Llegaste al restaurante": "Dotarłeś do restauracji",
      "Llegaste al cliente": "Dotarłeś do klienta",
      "Entregado": "Dostarczono",
      "Cancelado": "Anulowano",
      "Pendiente": "Oczekuje",
      "Direccion del cliente pendiente": "Adres klienta oczekuje",
      "GPS restaurante": "GPS do restauracji",
      "GPS cliente": "GPS do klienta",
      "Falta configurar la conexion de Supabase para usar colaboradores.": "Brakuje konfiguracji połączenia Supabase dla kurierów.",
      "No se pudo iniciar la conexion de colaborador.": "Nie udało się uruchomić połączenia kuriera.",
      "Primero inicia sesion como colaborador para subir archivos.": "Najpierw zaloguj się jako kurier, aby przesyłać pliki.",
      "El archivo es muy pesado. Usa imagen o PDF menor a 8 MB.": "Plik jest za duży. Użyj obrazu lub pliku PDF mniejszego niż 8 MB.",
      "No se pudo subir el archivo. Revisa internet, el tipo de archivo o los permisos de Storage.": "Nie udało się przesłać pliku. Sprawdź internet, typ pliku lub uprawnienia Storage.",
      "Obligatorio para moto o automovil": "Wymagane dla motocykla lub samochodu",
      "Obligatoria para moto o automovil": "Wymagane dla motocykla lub samochodu",
      "La asignacion de entregas cercanas aun no esta activa en la nube. Revisa la configuracion de Supabase.": "Przydzielanie pobliskich dostaw nie jest jeszcze aktywne w chmurze. Sprawdź konfigurację Supabase.",
      "Tu perfil debe estar aprobado por la administracion antes de recibir pedidos.": "Twój profil musi zostać zatwierdzony przez administrację przed otrzymywaniem zamówień.",
      "La ubicacion no es valida. Intenta compartirla de nuevo.": "Lokalizacja jest nieprawidłowa. Udostępnij ją ponownie.",
      "Inicia sesion como colaborador.": "Zaloguj się jako kurier.",
      "No se pudo actualizar la entrega.": "Nie udało się zaktualizować dostawy.",
      "Correo o contrasena incorrectos.": "Nieprawidłowy email lub hasło.",
      "RC ORDERA envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.": "RC ORDERA wysłała wiadomość weryfikacyjną. Sprawdź pocztę, potwierdź konto i zaloguj się ponownie.",
      "Ese correo ya tiene cuenta. Inicia sesion aqui con ese correo y despues envia la solicitud de colaborador.": "Ten adres email ma już konto. Zaloguj się nim tutaj, a następnie wyślij wniosek kuriera.",
      "Escribe tu nombre.": "Wpisz imię.",
      "Escribe tus apellidos.": "Wpisz nazwisko.",
      "Escribe tu telefono.": "Wpisz numer telefonu.",
      "Escribe tu fecha de nacimiento.": "Wpisz datę urodzenia.",
      "Escribe tu pais.": "Wybierz kraj.",
      "Escribe tu ciudad.": "Wpisz miejscowość.",
      "Escribe tu provincia, departamento o region.": "Wybierz województwo lub region.",
      "Escribe tu direccion.": "Wpisz adres.",
      "Escribe tu documento de identidad.": "Wpisz numer dokumentu tożsamości.",
      "Selecciona el tipo de vehiculo.": "Wybierz typ pojazdu.",
      "Escribe tu cuenta bancaria o datos de pago.": "Wpisz rachunek bankowy lub dane płatności.",
      "Para motocicleta o automovil escribe la matricula.": "Dla motocykla lub samochodu wpisz numer rejestracyjny.",
      "Para motocicleta o automovil escribe la licencia.": "Dla motocykla lub samochodu wpisz dane prawa jazdy.",
      "Para motocicleta o automovil escribe el seguro.": "Dla motocykla lub samochodu wpisz dane ubezpieczenia.",
      "Cuenta creada. RC ORDERA te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion como colaborador.": "Konto zostało utworzone. RC ORDERA wysłała wiadomość weryfikacyjną. Otwórz ją, potwierdź konto, a następnie zaloguj się jako kurier.",
      "Escribe tu correo electronico para recuperar la contrasena.": "Wpisz email, aby odzyskać hasło.",
      "RC ORDERA esta enviando el correo de recuperacion...": "RC ORDERA wysyła wiadomość do odzyskania hasła...",
      "Correo enviado por RC ORDERA. Abre el enlace para crear una contrasena nueva.": "RC ORDERA wysłała wiadomość. Otwórz link, aby utworzyć nowe hasło.",
      "Escribe tu correo electronico para reenviar la verificacion.": "Wpisz email, aby ponownie wysłać weryfikację.",
      "RC ORDERA esta reenviando el correo de verificacion...": "RC ORDERA ponownie wysyła wiadomość weryfikacyjną...",
      "Correo de verificacion reenviado por RC ORDERA. Revisa entrada, spam o promociones.": "RC ORDERA ponownie wysłała wiadomość weryfikacyjną. Sprawdź skrzynkę, spam i oferty.",
      "RC ORDERA verifico el enlace. Escribe tu nueva contrasena.": "RC ORDERA zweryfikowała link. Wpisz nowe hasło.",
      "La nueva contrasena debe tener minimo 6 caracteres.": "Nowe hasło musi mieć co najmniej 6 znaków.",
      "Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.": "Hasło zostało zaktualizowane. Możesz zalogować się do RC ORDERA.",
      "documento de identidad": "dokument tożsamości",
      "selfie de verificacion": "selfie weryfikacyjne",
      "archivo de licencia": "plik prawa jazdy",
      "archivo de seguro": "plik ubezpieczenia",
      "foto": "zdjęcie",
      "permiso de trabajo": "pozwolenie na pracę",
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
      "Administracion de plataforma": "Platform administration",
      "Panel privado para aprobar o rechazar colaboradores despues de verificar sus documentos manualmente.": "Private panel to approve or reject couriers after manually verifying their documents.",
      "Acceso plataforma": "Platform access",
      "Acceso privado para la cuenta administradora autorizada.": "Private access for the authorized administrator account.",
      "Sesion administrativa activa y verificada.": "Administrative session active and verified.",
      "Entrar sin contrasena": "Sign in without password",
      "Instalar panel": "Install panel",
      "Correo autorizado": "Authorized email",
      "Solicitudes": "Applications",
      "Revision de colaboradores": "Courier review",
      "Restaurante": "Restaurant",
      "Operacion en tiempo real": "Real-time operations",
      "Resumen de hoy": "Today's summary",
      "Pedidos recibidos": "Orders received",
      "Nuevos": "New",
      "En preparacion": "In preparation",
      "Listos / reparto": "Ready / delivering",
      "Ventas de hoy": "Today's sales",
      "Menu": "Menu",
      "Cocina": "Kitchen",
      "Estadisticas": "Statistics",
      "Personal": "Staff",
      "Cuenta para recibir pagos": "Payout account",
      "Configurar pagos": "Set up payments",
      "Revisar cuenta": "Review account",
      "Configuracion pendiente": "Setup pending",
      "Sin configurar": "Not configured",
      "Verificada para recibir pagos": "Verified for payouts",
      "Cuenta de pagos": "Payout account",
      "Configura una cuenta verificada para recibir el valor neto de los domicilios completados.": "Set up a verified account to receive the net amount from completed deliveries.",
      "Confirmar que recibi el pedido": "Confirm order received",
      "Registro de horarios": "Time records",
      "Horas registradas por el personal durante la semana y el mes actuales.": "Hours recorded by staff during the current week and month.",
      "Semana": "Week",
      "Mes": "Month",
      "Jornada": "Shift",
      "Sin registrar entrada": "No clock-in recorded",
      "Registrar entrada": "Clock in",
      "Registrar salida": "Clock out",
      "Acceso de personal": "Staff access",
      "Estacion de restaurante": "Restaurant station",
      "Ingresa con tu cuenta. El propietario debe autorizar este correo en su panel.": "Sign in with your account. The owner must authorize this email in the restaurant panel.",
      "Crear cuenta de empleado": "Create employee account",
      "Falta autorizacion": "Authorization required",
      "Pide al propietario que autorice tu correo en una estacion.": "Ask the owner to authorize your email for a station.",
      "Activar autorizacion": "Check authorization",
      "Menu del restaurante": "Restaurant menu",
      "Agregar productos": "Add products",
      "Buscar producto": "Search product",
      "Nombre del plato": "Dish name",
      "Pedido actual": "Current order",
      "Mesero": "Waiter",
      "Mesa": "Table",
      "Cliente opcional": "Customer optional",
      "Tipo de pedido": "Order type",
      "Metodo de pago": "Payment method",
      "Notas para cocina": "Kitchen notes",
      "Enviar pedido": "Send order",
      "Cierre diario": "Daily close",
      "Cierre mensual": "Monthly close",
      "Mes del informe": "Report month",
      "Pedidos del mes": "Monthly orders",
      "Total del mes": "Monthly total",
      "Necesitas conexion para confirmar el cierre mensual.": "An internet connection is required to confirm the monthly close.",
      "No fue posible confirmar el cierre mensual.": "The monthly close could not be confirmed.",
      "Ejecuta la migracion V85.02 para ver el cierre mensual confirmado.": "Run migration V85.02 to view the confirmed monthly close.",
      "Pedidos enviados": "Sent orders",
      "Estacion operativa": "Operating station",
      "Pedidos activos": "Active orders",
      "Parrilla": "Grill",
      "Bebidas": "Drinks",
      "Comidas rapidas": "Fast food",
      "Entradas": "Starters",
      "Ensaladas": "Salads",
      "Empaque": "Packing",
      "Despacho": "Dispatch",
      "Caja": "Cashier",
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
      "Verificado / Aprobado": "Verified / Approved",
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
      "Acceso colaborador": "Courier access",
      "Acepto el contrato, terminos, politica de privacidad y tratamiento de datos para revision y entregas.": "I accept the agreement, terms, privacy policy, and data processing for verification and deliveries.",
      "Actividad": "Activity",
      "Cambiar entorno": "Switch area",
      "Ciudad, municipio, pueblo, corregimiento o vereda": "City, municipality, town, village, or other locality",
      "Código postal": "Postal code",
      "Colombia": "Colombia",
      "Compartir ubicacion": "Share location",
      "Cuenta y documentos": "Account and documents",
      "Ej: lunes a viernes 12:00-20:00": "E.g. Monday to Friday 12:00-20:00",
      "Entorno de prueba": "Test environment",
      "Entrega activa": "Active delivery",
      "Entregas disponibles": "Available deliveries",
      "Estado": "Status",
      "Guardar nueva contrasena": "Save new password",
      "Historial": "History",
      "Inicia sesion desde Perfil para gestionar entregas.": "Sign in from Profile to manage deliveries.",
      "Inicio": "Home",
      "Localidad": "Locality",
      "Navegacion del colaborador": "Courier navigation",
      "Nueva contrasena": "New password",
      "País": "Country",
      "Panel de trabajo": "Work dashboard",
      "Panel del colaborador": "Courier dashboard",
      "Perfil": "Profile",
      "Polonia": "Poland",
      "Primero selecciona un país": "Select a country first",
      "Región / Departamento": "Voivodeship / department",
      "Ruta y estado": "Route and status",
      "Selecciona un país": "Select a country",
      "Sin iniciar sesion": "Not signed in",
      "Solicitud de colaborador": "Courier application",
      "Selecciona una región": "Select a region",
      "Escribe tu localidad": "Enter your locality",
      "Inicia sesion para ver tu entrega activa.": "Sign in to view your active delivery.",
      "No tienes una entrega activa.": "You do not have an active delivery.",
      "Inicia sesion para consultar el historial.": "Sign in to view your history.",
      "Todavia no hay entregas finalizadas en esta sesion.": "There are no completed deliveries in this session yet.",
      "La administracion debe aprobar tu perfil antes de recibir pedidos.": "Administration must approve your profile before you can receive orders.",
      "No tienes pedidos disponibles ahora. Activa disponibilidad y comparte ubicacion.": "You have no available orders now. Turn on availability and share your location.",
      "Este dispositivo no permite compartir ubicacion.": "This device does not support location sharing.",
      "Tu perfil debe estar aprobado antes de compartir ubicacion para entregas.": "Your profile must be approved before sharing your location for deliveries.",
      "Solicitando ubicacion...": "Requesting location...",
      "Primero comparte tu ubicacion actual.": "Share your current location first.",
      "Actualizando pedidos disponibles...": "Refreshing available orders...",
      "Nuevo pedido disponible. Revisa y acepta si puedes tomarlo.": "A new order is available. Review and accept it if you can take it.",
      "Pedidos actualizados.": "Orders refreshed.",
      "Actualizando entrega...": "Updating delivery...",
      "Selecciona una localidad del pais elegido.": "Select a locality in the chosen country.",
      "La localidad seleccionada no pertenece a la region elegida. Revisa la region o escribe la localidad manualmente.": "The selected locality is not in the chosen region. Check the region or enter the locality manually.",
      "Puedes llenar los datos, pero debes iniciar sesion para guardar la solicitud.": "You can fill in the details, but you must sign in to save the application.",
      "Perfil aprobado. Activa disponibilidad, comparte ubicacion y recibiras pedidos cercanos.": "Profile approved. Turn on availability, share your location, and receive nearby orders.",
      "Debes aceptar contrato, terminos y privacidad.": "You must accept the agreement, terms, and privacy policy.",
      "Primero inicia sesion o crea tu cuenta.": "Sign in or create your account first.",
      "Guardando solicitud...": "Saving application...",
      "Perfil actualizado. Tu aprobacion permanece activa.": "Profile updated. Your approval remains active.",
      "Solicitud guardada con documentos. Queda pendiente de revision y aprobacion para empezar a trabajar.": "Application saved with documents. It is pending review and approval before you can start working.",
      "No se pudo guardar la solicitud.": "Could not save the application.",
      "Escribe correo y contrasena.": "Enter your email and password.",
      "Iniciando sesion...": "Signing in...",
      "Sesion iniciada.": "Signed in.",
      "Usa correo y contrasena de minimo 6 caracteres.": "Use an email and a password of at least 6 characters.",
      "Detectando pais e idioma...": "Detecting country and language...",
      "Creando cuenta...": "Creating account...",
      "Para estar disponible primero comparte tu ubicacion actual.": "Share your current location before going available.",
      "Estas disponible para recibir pedidos cercanos.": "You are available to receive nearby orders.",
      "Estas desconectado para nuevas entregas.": "You are offline for new deliveries.",
      "Pedido ofrecido": "Delivery offered",
      "Aceptado": "Accepted",
      "Llegaste al restaurante": "Arrived at restaurant",
      "Llegaste al cliente": "Arrived at customer",
      "Entregado": "Delivered",
      "Cancelado": "Cancelled",
      "Pendiente": "Pending",
      "Direccion del cliente pendiente": "Customer address pending",
      "GPS restaurante": "Restaurant GPS",
      "GPS cliente": "Customer GPS",
      "Falta configurar la conexion de Supabase para usar colaboradores.": "The Supabase connection for couriers has not been configured.",
      "No se pudo iniciar la conexion de colaborador.": "The courier connection could not be started.",
      "Primero inicia sesion como colaborador para subir archivos.": "Sign in as a courier before uploading files.",
      "El archivo es muy pesado. Usa imagen o PDF menor a 8 MB.": "The file is too large. Use an image or PDF smaller than 8 MB.",
      "No se pudo subir el archivo. Revisa internet, el tipo de archivo o los permisos de Storage.": "The file could not be uploaded. Check your connection, file type, or Storage permissions.",
      "Obligatorio para moto o automovil": "Required for a motorcycle or car",
      "Obligatoria para moto o automovil": "Required for a motorcycle or car",
      "La asignacion de entregas cercanas aun no esta activa en la nube. Revisa la configuracion de Supabase.": "Nearby delivery assignment is not active in the cloud yet. Check the Supabase configuration.",
      "Tu perfil debe estar aprobado por la administracion antes de recibir pedidos.": "Your profile must be approved by administration before receiving orders.",
      "La ubicacion no es valida. Intenta compartirla de nuevo.": "The location is invalid. Try sharing it again.",
      "Inicia sesion como colaborador.": "Sign in as a courier.",
      "No se pudo actualizar la entrega.": "The delivery could not be updated.",
      "Correo o contrasena incorrectos.": "Incorrect email or password.",
      "RC ORDERA envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.": "RC ORDERA sent a verification email. Check your inbox, confirm the account, and sign in again.",
      "Ese correo ya tiene cuenta. Inicia sesion aqui con ese correo y despues envia la solicitud de colaborador.": "That email already has an account. Sign in here with it, then submit the courier application.",
      "Escribe tu nombre.": "Enter your first name.",
      "Escribe tus apellidos.": "Enter your last name.",
      "Escribe tu telefono.": "Enter your phone number.",
      "Escribe tu fecha de nacimiento.": "Enter your date of birth.",
      "Escribe tu pais.": "Select your country.",
      "Escribe tu ciudad.": "Enter your locality.",
      "Escribe tu provincia, departamento o region.": "Select your province, department, or region.",
      "Escribe tu direccion.": "Enter your address.",
      "Escribe tu documento de identidad.": "Enter your identity document number.",
      "Selecciona el tipo de vehiculo.": "Select the vehicle type.",
      "Escribe tu cuenta bancaria o datos de pago.": "Enter your bank account or payment details.",
      "Para motocicleta o automovil escribe la matricula.": "Enter the registration number for a motorcycle or car.",
      "Para motocicleta o automovil escribe la licencia.": "Enter the driving licence details for a motorcycle or car.",
      "Para motocicleta o automovil escribe el seguro.": "Enter the insurance details for a motorcycle or car.",
      "Cuenta creada. RC ORDERA te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion como colaborador.": "Account created. RC ORDERA sent a verification email. Open it, confirm the account, then sign in as a courier.",
      "Escribe tu correo electronico para recuperar la contrasena.": "Enter your email to recover your password.",
      "RC ORDERA esta enviando el correo de recuperacion...": "RC ORDERA is sending the recovery email...",
      "Correo enviado por RC ORDERA. Abre el enlace para crear una contrasena nueva.": "RC ORDERA sent the email. Open the link to create a new password.",
      "Escribe tu correo electronico para reenviar la verificacion.": "Enter your email to resend verification.",
      "RC ORDERA esta reenviando el correo de verificacion...": "RC ORDERA is resending the verification email...",
      "Correo de verificacion reenviado por RC ORDERA. Revisa entrada, spam o promociones.": "RC ORDERA resent the verification email. Check your inbox, spam, or promotions.",
      "RC ORDERA verifico el enlace. Escribe tu nueva contrasena.": "RC ORDERA verified the link. Enter your new password.",
      "La nueva contrasena debe tener minimo 6 caracteres.": "The new password must have at least 6 characters.",
      "Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.": "Password updated. You can now sign in to RC ORDERA.",
      "documento de identidad": "identity document",
      "selfie de verificacion": "verification selfie",
      "archivo de licencia": "driving licence file",
      "archivo de seguro": "insurance file",
      "foto": "photo",
      "permiso de trabajo": "work permit",
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
  function shouldTranslateContent(value) {
  const text = normalize(value);

  if (!text) return false;

  // Solo números, precios, porcentajes, horas, etc.
  if (/^[\d\s.,:+\-/%€$£złPLNCOP]+$/i.test(text)) {
    return false;
  }

  // Correos electrónicos.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text)) {
    return false;
  }

  // URLs.
  if (/^(https?:\/\/|www\.)/i.test(text)) {
    return false;
  }

  // Teléfonos.
  if (/^\+?[\d\s()\-]{6,}$/.test(text)) {
    return false;
  }

  // UUID.
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      text
    )
  ) {
    return false;
  }

  // Códigos, referencias e identificadores técnicos.
  if (/^[A-Z0-9_-]{4,}$/i.test(text) && /\d/.test(text)) {
    return false;
  }

  // Extensiones y nombres de archivo.
  if (
    /^[^\s]+\.(jpg|jpeg|png|webp|gif|pdf|doc|docx|xls|xlsx|zip|js|css|html)$/i.test(
      text
    )
  ) {
    return false;
  }
// Fechas numéricas.
if (
  /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(text)
) {
  return false;
}

// Horas.
if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
  return false;
}

// Coordenadas GPS.
if (
  /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/.test(text)
) {
  return false;
}

// Códigos postales polacos.
if (/^\d{2}-\d{3}$/.test(text)) {
  return false;
}

// Números de pedido/ticket simples.
if (/^#?\d{1,10}$/.test(text)) {
  return false;
}

// IBAN.
if (/^[A-Z]{2}\d{2}[A-Z0-9\s]{10,32}$/i.test(text)) {
  return false;
}

// Matrículas/códigos cortos con letras y números.
if (
  /^[A-Z0-9]{1,5}[-\s]?[A-Z0-9]{1,5}$/i.test(text) &&
  /\d/.test(text)
) {
  return false;
}
  return true;
}

 function shouldSkipElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  return Boolean(
    element.closest(
      [
        "script",
        "style",
        "noscript",
        "code",
        "pre",
        "textarea",
        "[contenteditable='true']",
        "[data-no-auto-i18n]",
      ].join(",")
    )
  );
}
 function shouldSkipAttributeElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  return Boolean(
    element.closest(
      [
        "script",
        "style",
        "noscript",
        "code",
        "pre",
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
    const direct = dictionary[targetLanguage]?.[clean] || "";
    if (direct) return direct;
    const statusMatch = clean.match(/^Estado actual: (.+)\.$/i);
    if (statusMatch) {
      const translatedStatus = dictionary[targetLanguage]?.[statusMatch[1]] || statusMatch[1];
      return targetLanguage === "pl"
        ? `Aktualny status: ${translatedStatus}.`
        : targetLanguage === "en"
          ? `Current status: ${translatedStatus}.`
          : "";
    }
    const savedFileMatch = clean.match(/^(.+) guardado$/i);
    if (savedFileMatch) {
      const translatedLabel = dictionary[targetLanguage]?.[savedFileMatch[1]] || savedFileMatch[1];
      return targetLanguage === "pl"
        ? `${translatedLabel} zapisano`
        : targetLanguage === "en"
          ? `${translatedLabel} saved`
          : "";
    }
    const missingDocumentsMatch = clean.match(/^Solicitud guardada\. Para revision completa faltan: (.+)\. Puedes subirlos aqui o enviarlos a (.+)\.$/i);
    if (missingDocumentsMatch) {
      const translatedLabels = missingDocumentsMatch[1]
        .split(",")
        .map((label) => dictionary[targetLanguage]?.[normalize(label)] || normalize(label))
        .join(", ");
      return targetLanguage === "pl"
        ? `Wniosek zapisano. Do pełnej weryfikacji brakuje: ${translatedLabels}. Możesz przesłać je tutaj lub wysłać na ${missingDocumentsMatch[2]}.`
        : targetLanguage === "en"
          ? `Application saved. The following items are missing for full review: ${translatedLabels}. Upload them here or send them to ${missingDocumentsMatch[2]}.`
          : "";
    }
    const confirmedLocalityMatch = clean.match(/^Localidad confirmada: (.+)\.$/i);
    if (confirmedLocalityMatch) {
      return targetLanguage === "pl"
        ? `Potwierdzona miejscowość: ${confirmedLocalityMatch[1]}.`
        : targetLanguage === "en"
          ? `Confirmed locality: ${confirmedLocalityMatch[1]}.`
          : "";
    }
    const rules = targetLanguage === "pl"
      ? [
          [/^Sesion activa: (.+)$/i, "Aktywna sesja: $1"],
          [/^Estado actual: (.+)\.$/i, "Aktualny status: $1."],
          [/^Cliente: (.+)$/i, "Klient: $1"],
          [/^Destino: (.+)$/i, "Cel: $1"],
          [/^Distancia al restaurante: (.+)$/i, "Odległość do restauracji: $1"],
          [/^Subiendo (.+)\.\.\.$/i, "Przesyłanie: $1..."],
          [/^Ubicacion guardada: (.+)\. Precision aprox: (.+)\.$/i, "Lokalizacja zapisana: $1. Przybliżona dokładność: $2."],
          [/^Cierre mensual confirmado: (.+)\.$/i, "Zamkniecie miesiaca potwierdzone: $1."],
        ]
      : targetLanguage === "en"
        ? [
            [/^Sesion activa: (.+)$/i, "Active session: $1"],
            [/^Estado actual: (.+)\.$/i, "Current status: $1."],
            [/^Cliente: (.+)$/i, "Customer: $1"],
            [/^Destino: (.+)$/i, "Destination: $1"],
            [/^Distancia al restaurante: (.+)$/i, "Distance to restaurant: $1"],
            [/^Subiendo (.+)\.\.\.$/i, "Uploading $1..."],
            [/^Ubicacion guardada: (.+)\. Precision aprox: (.+)\.$/i, "Location saved: $1. Approximate accuracy: $2."],
            [/^Cierre mensual confirmado: (.+)\.$/i, "Monthly close confirmed: $1."],
          ]
        : [];
    for (const [pattern, replacement] of rules) {
      if (pattern.test(clean)) return clean.replace(pattern, replacement);
    }
    return "";
  }

  async function fetchTranslation(text, targetLanguage) {
  const clean = normalize(text);

  if (!clean) return clean;
  if (targetLanguage === "es") return clean;

  // 1. Primero usa nuestro diccionario profesional.
  const direct = dictionaryTranslation(clean, targetLanguage);
  if (direct) return direct;

  // 2. Después revisa traducciones ya guardadas.
  const key = cacheKey(targetLanguage, clean);
  if (cache[key]) return cache[key];

  // 3. No traducir datos demasiado largos o sin conexión.
  if (clean.length > 500 || !navigator.onLine) {
    return clean;
  }

  // 4. Cualquier texto de interfaz que no conozcamos
  // se traduce automáticamente.
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx` +
      `&sl=es` +
      `&tl=${encodeURIComponent(targetLanguage)}` +
      `&dt=t` +
      `&q=${encodeURIComponent(clean)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return clean;
    }

    const data = await response.json();

    const translated = normalize(
      (data?.[0] || [])
        .map((part) => part?.[0] || "")
        .join("")
    );

    if (
      translated &&
      translated.toLowerCase() !== clean.toLowerCase()
    ) {
      cache[key] = translated;
      saveCache();
      return translated;
    }
  } catch (error) {
    console.warn(
      "RC ORDERA: traducción automática no disponible.",
      error
    );
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
  let state = values[attribute];

  if (!state) {
    state = {
      source: current,
      last: "",
    };

    values[attribute] = state;

    return state;
  }

  const currentNormalized = normalize(current);
  const sourceNormalized = normalize(state.source);
  const lastNormalized = normalize(state.last);

  // Si otra parte de la app modificó realmente el atributo,
  // guardamos ese nuevo valor como original.
  if (
    currentNormalized !== sourceNormalized &&
    currentNormalized !== lastNormalized
  ) {
    state.source = current;
    state.last = "";
  }

  return state;
}

 async function translateTextNode(
  node,
  generation = translationGeneration
) {
  const parent = node.parentElement;

  if (!parent || shouldSkipElement(parent)) {
    return;
  }

  const clean = normalize(node.nodeValue);

  if (!shouldTranslateContent(clean)) {
    return;
  }

  let state = originalText.get(node);

  if (!state) {
    state = {
      source: node.nodeValue,
      last: "",
    };

    originalText.set(node, state);
  } else {
    const currentNormalized = normalize(node.nodeValue);
    const sourceNormalized = normalize(state.source);
    const lastNormalized = normalize(state.last);

    // Si otra parte de la app cambió realmente el texto,
    // ese nuevo texto pasa a ser el nuevo original.
    if (
      currentNormalized !== sourceNormalized &&
      currentNormalized !== lastNormalized
    ) {
      state.source = node.nodeValue;
      state.last = "";
    }
  }

  const sourceText = state.source;

  const translated =
    language === "es"
      ? sourceText
      : await fetchTranslation(sourceText, language);
   if (generation !== translationGeneration) {
  return;
}

  state.last = translated;

  if (node.nodeValue !== translated) {
    node.nodeValue = translated;
  }
}
 async function translateAttributes(
  element,
  generation = translationGeneration
) {
  if (shouldSkipAttributeElement(element)) return;

 const attributes = [
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "alt",
];

  const tagName = element.tagName?.toLowerCase();
  const inputType = String(element.type || "").toLowerCase();

  if (
    tagName === "input" &&
    ["button", "submit", "reset"].includes(inputType)
  ) {
    attributes.push("value");
  }

  for (const attribute of attributes) {
    if (!element.hasAttribute(attribute)) continue;

    const state = setOriginalAttribute(element, attribute);
    const source = normalize(state.source);

if (!shouldTranslateContent(source)) {
  continue;
}

    const translated =
      language === "es"
        ? state.source
        : await fetchTranslation(state.source, language);
if (generation !== translationGeneration) {
  return;
}
    state.last = translated;

    if (element.getAttribute(attribute) !== translated) {
      element.setAttribute(attribute, translated);
    }

    if (
      attribute === "value" &&
      tagName === "input" &&
      ["button", "submit", "reset"].includes(inputType)
    ) {
      element.value = translated;
    }
  }
}

 async function translateTree(root = document.body) {
  const generation = translationGeneration;
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
      for (const node of textNodes) {
  if (generation !== translationGeneration) {
    return;
  }

  await translateTextNode(node, generation);
}
      
      const elements = root.querySelectorAll
  ? root.querySelectorAll(
      [
  "[placeholder]",
  "[title]",
  "[aria-label]",
  "[aria-description]",
  "[alt]",
  'input[type="button"][value]',
  'input[type="submit"][value]',
  'input[type="reset"][value]',
].join(",")
    )
  : [];
      for (const element of elements) {
  if (generation !== translationGeneration) {
    return;
  }

  await translateAttributes(element, generation);
}
    } catch {
      // Si la traduccion externa falla, se conserva el texto original.
    } finally {
      translating = false;
    }
  }

function scheduleTranslate(delay = 180) {
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }

  renderTimer = window.setTimeout(async () => {
    renderTimer = null;

    if (translating) {
      scheduleTranslate(120);
      return;
    }

    await translateTree(document.body);
  }, delay);
}

  function createLanguageControl() {
    const existingSelect = document.querySelector("#autoLanguageSelect");
    if (existingSelect) {
      existingSelect.value = language;
      existingSelect.addEventListener("change", () => {
  language = existingSelect.value;
translationGeneration += 1;
        
  localStorage.setItem(LANGUAGE_KEY, language);
  localStorage.setItem(
    "rincon_colombiano_customer_language",
    language
  );

  document.documentElement.lang = language;

  scheduleTranslate(0);
});
      return;
    }
    const customerSelect =
  document.querySelector("#customerLanguageSelect");

if (customerSelect) {
  customerSelect.value = language;

  customerSelect.addEventListener("change", () => {
    language = String(
      customerSelect.value || "es"
    ).toLowerCase();

    translationGeneration += 1;

    localStorage.setItem(
      LANGUAGE_KEY,
      language
    );

    localStorage.setItem(
      "rincon_colombiano_customer_language",
      language
    );

    document.documentElement.lang = language;

    scheduleTranslate(0);
  });

  return;
}
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
 translationGeneration += 1;
     
  localStorage.setItem(LANGUAGE_KEY, language);
  localStorage.setItem(
    "rincon_colombiano_customer_language",
    language
  );

  document.documentElement.lang = language;

  scheduleTranslate(0);
});
  }

  window.RinconAutoTranslate = {
    setLanguage(nextLanguage) {
  const normalizedLanguage = String(
    nextLanguage || ""
  ).toLowerCase();

  if (!SUPPORTED[normalizedLanguage]) {
    return;
  }

  language = normalizedLanguage;
      translationGeneration += 1;

  localStorage.setItem(LANGUAGE_KEY, language);
  localStorage.setItem(
    "rincon_colombiano_customer_language",
    language
  );

  document.documentElement.lang = language;

  const languageSelect =
    document.querySelector("#autoLanguageSelect");

  if (
    languageSelect &&
    languageSelect.value !== language
  ) {
    languageSelect.value = language;
  }
      const customerLanguageSelect =
  document.querySelector("#customerLanguageSelect");

if (
  customerLanguageSelect &&
  customerLanguageSelect.value !== language
) {
  customerLanguageSelect.value = language;
}

  scheduleTranslate(0);
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
