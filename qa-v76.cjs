const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const projectDir = __dirname;
const result = {
  pages: {},
  assertions: [],
  pageErrors: [],
};

function assert(name, condition, details = {}) {
  result.assertions.push({ name, passed: Boolean(condition), details });
  if (!condition) throw new Error(`Fallo: ${name}`);
}

async function openLocal(page, file, query = "") {
  const url = pathToFileURL(path.join(projectDir, file));
  url.search = query;
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (error) => result.pageErrors.push({ page: "mobile", message: error.message }));

  await openLocal(mobile, "cliente.html", "?app=v76");
  const translatedMenu = await mobile.evaluate(() => {
    customerLanguage = "pl";
    customerMenu = {
      Entradas: [
        {
          id: "qa-1",
          name: "Arepa con queso",
          description: "Masa de maiz con queso",
          price: 15,
          available: true,
          imageUrl: "",
        },
      ],
    };
    customerActiveCategory = "Entradas";
    customerDescriptionTranslations[customerDescriptionTranslationKey("pl", "Entradas")] = "Przystawki";
    customerDescriptionTranslations[customerDescriptionTranslationKey("pl", "Arepa con queso")] = "Arepa z serem";
    customerDescriptionTranslations[customerDescriptionTranslationKey("pl", "Masa de maiz con queso")] =
      "Ciasto kukurydziane z serem";
    customerRenderCategories();
    customerRenderMenu();
    return {
      category: document.querySelector("#customerCategoryTabs button")?.textContent.trim(),
      name: document.querySelector("#customerMenuGrid strong")?.textContent.trim(),
      description: document.querySelector("#customerMenuGrid small")?.textContent.trim(),
      viewportWidth: document.documentElement.scrollWidth,
      deliveryMarkup: CUSTOMER_DELIVERY_MARKUP,
      normalizedRestaurant: customerNormalizeRestaurantProfile({
        user_id: "qa-store",
        business_name: "QA Store",
        country_code: "PL",
        city: "Warszawa",
        region: "Mazowieckie",
      }),
    };
  });
  assert("Categoria traducida en cliente", translatedMenu.category === "Przystawki", translatedMenu);
  assert("Producto traducido en cliente", translatedMenu.name === "Arepa z serem", translatedMenu);
  assert("Descripcion traducida en cliente", translatedMenu.description === "Ciasto kukurydziane z serem", translatedMenu);
  assert("Cliente movil sin desbordamiento horizontal", translatedMenu.viewportWidth <= 390, translatedMenu);
  assert("Domicilio usa incremento de 30 por ciento", translatedMenu.deliveryMarkup === 1.3, translatedMenu);
  assert("Cliente conserva pais del restaurante", translatedMenu.normalizedRestaurant?.countryCode === "PL", translatedMenu);
  assert("Cliente conserva provincia del restaurante", translatedMenu.normalizedRestaurant?.region === "Mazowieckie", translatedMenu);
  await mobile.screenshot({ path: path.join(projectDir, "qa-v76-cliente-movil.png"), fullPage: true });

  await openLocal(mobile, "index.html", "?app=v76");
  const operationalStatus = await mobile.evaluate(() => {
    cloudState.user = { id: "qa-restaurant" };
    cloudState.authChecked = true;
    setAuthScreenVisible(false);
    document.body.classList.remove("auth-checking");
    restaurantActive = true;
    restaurantOperationalMode = "manual";
    restaurantOperationalOpen = false;
    renderRestaurantStatus();
    const manual = {
      title: document.querySelector("#mainRestaurantStatusText")?.textContent.trim(),
      action: document.querySelector("#mainRestaurantToggleButton")?.textContent.trim(),
      disabled: document.querySelector("#mainRestaurantToggleButton")?.disabled,
    };
    restaurantOperationalMode = "schedule";
    restaurantOperationalOpen = true;
    renderRestaurantStatus();
    const automatic = {
      title: document.querySelector("#mainRestaurantStatusText")?.textContent.trim(),
      detail: document.querySelector("#mainRestaurantStatusDetail")?.textContent.trim(),
      action: document.querySelector("#mainRestaurantToggleButton")?.textContent.trim(),
      disabled: document.querySelector("#mainRestaurantToggleButton")?.disabled,
      checked: document.querySelector("#restaurantScheduleModeInput")?.checked,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
    return { manual, automatic };
  });
  assert("Estado manual muestra cerrar o abrir", operationalStatus.manual.action === "Abrir atencion", operationalStatus);
  assert("Estado automatico visible", /automatico/i.test(operationalStatus.automatic.detail), operationalStatus);
  assert("Control manual se bloquea en modo automatico", operationalStatus.automatic.disabled === true, operationalStatus);
  assert("Selector automatico conserva su estado", operationalStatus.automatic.checked === true, operationalStatus);
  assert("Barra operativa movil sin desbordamiento", operationalStatus.automatic.pageWidth <= operationalStatus.automatic.viewportWidth, operationalStatus);

  const ticketTools = await mobile.evaluate(() => {
    menuCatalog = {};
    activeCategory = "";
    renderCategories();
    renderMenu();
    const first = {
      ...createBlankOrder(),
      id: "qa-ticket-1",
      ticketNumber: 12,
      customer: "Mesa 3",
      server: "QA",
      items: [{ name: "Producto QA", price: 10, qty: 2 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      businessDate: todayKey,
      saved: true,
      paymentStatus: "pending",
    };
    savedOrders = [first];
    renderTicketHistory();
    renderPrintTicket(first);
    return {
      emptyMenu: document.querySelector("#menuGrid")?.textContent.trim(),
      historyText: document.querySelector("#ticketHistoryList")?.textContent.trim(),
      paymentButtons: Array.from(document.querySelectorAll("#ticketHistoryList button")).map((button) => button.textContent.trim()),
      thermalConnectorExists: typeof connectThermalPrinter === "function",
      dedicatedPrinterExists: typeof printTicketWithSystemDialog === "function",
      receiptHeight: document.querySelector("#printTicket")?.scrollHeight || 0,
    };
  });
  assert("Menu vacio no inventa categorias", /crea una categoria/i.test(ticketTools.emptyMenu), ticketTools);
  assert("Historial muestra tickets por cobrar", /por cobrar/i.test(ticketTools.historyText), ticketTools);
  assert("Historial permite reimprimir", ticketTools.paymentButtons.includes("Reimprimir"), ticketTools);
  assert("Conexion termica directa disponible en codigo", ticketTools.thermalConnectorExists, ticketTools);
  assert("Impresion aislada disponible", ticketTools.dedicatedPrinterExists, ticketTools);
  await mobile.screenshot({ path: path.join(projectDir, "qa-v76-estado-movil.png"), fullPage: false });
  const closeDialog = await mobile.evaluate(() => {
    const dialog = document.querySelector("#dailyCloseDialog");
    const content = document.querySelector("#dailyCloseContent");
    content.innerHTML = Array.from({ length: 35 }, (_, index) => `<p>Fila de comprobacion ${index + 1}</p>`).join("");
    dialog.showModal();
    const form = dialog.querySelector("form");
    form.scrollTop = form.scrollHeight;
    const style = getComputedStyle(form);
    return {
      dialogOpen: dialog.open,
      scrollHeight: form.scrollHeight,
      clientHeight: form.clientHeight,
      scrollTop: form.scrollTop,
      overflowY: style.overflowY,
      bodyWidth: document.documentElement.scrollWidth,
    };
  });
  assert("Cierre diario abre", closeDialog.dialogOpen, closeDialog);
  assert("Cierre diario tiene desplazamiento interno", closeDialog.scrollHeight > closeDialog.clientHeight, closeDialog);
  assert("Cierre diario permite bajar", closeDialog.scrollTop > 0, closeDialog);
  assert("Cierre diario usa overflow vertical", closeDialog.overflowY === "auto", closeDialog);
  assert("Restaurante movil sin desbordamiento horizontal", closeDialog.bodyWidth <= 390, closeDialog);
  await mobile.screenshot({ path: path.join(projectDir, "qa-v76-cierre-movil.png"), fullPage: false });
  await mobile.evaluate(() => document.querySelector("#dailyCloseDialog")?.close());
  const mobileTeam = await mobile.evaluate(() => {
    renderWaiterMembers([
      {
        member_user_id: null,
        member_email: "empleado@correo.com",
        display_name: "Empleado de prueba",
        station: "kitchen",
        active: false,
        pending: true,
      },
    ]);
    document.querySelector("#waiterTeamDialog").showModal();
    const buttons = Array.from(document.querySelectorAll("#waiterMembersList button")).map((button) =>
      button.textContent.trim()
    );
    const form = document.querySelector("#waiterTeamDialog form");
    return {
      buttons,
      pageWidth: document.documentElement.scrollWidth,
      formWidth: form.getBoundingClientRect().width,
      viewportWidth: window.innerWidth,
    };
  });
  assert("Autorizacion movil muestra confirmar", mobileTeam.buttons.includes("Confirmar autorizacion"), mobileTeam);
  assert("Autorizacion movil sin desbordamiento", mobileTeam.pageWidth <= mobileTeam.viewportWidth, mobileTeam);
  await mobile.screenshot({ path: path.join(projectDir, "qa-v76-autorizacion-movil.png"), fullPage: false });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.on("pageerror", (error) => result.pageErrors.push({ page: "desktop", message: error.message }));
  await openLocal(desktop, "index.html", "?app=v76");
  const desktopStatus = await desktop.evaluate(() => {
    cloudState.user = { id: "qa-restaurant" };
    cloudState.authChecked = true;
    setAuthScreenVisible(false);
    document.body.classList.remove("auth-checking");
    restaurantActive = true;
    restaurantOperationalMode = "manual";
    restaurantOperationalOpen = true;
    renderRestaurantStatus();
    const bar = document.querySelector(".restaurant-service-bar");
    return {
      title: document.querySelector("#mainRestaurantStatusText")?.textContent.trim(),
      action: document.querySelector("#mainRestaurantToggleButton")?.textContent.trim(),
      barWidth: bar?.getBoundingClientRect().width || 0,
      viewportWidth: window.innerWidth,
    };
  });
  assert("Estado principal visible en escritorio", desktopStatus.title === "Abierto y recibiendo pedidos", desktopStatus);
  assert("Barra operativa cabe en escritorio", desktopStatus.barWidth > 0 && desktopStatus.barWidth <= desktopStatus.viewportWidth, desktopStatus);
  await desktop.screenshot({ path: path.join(projectDir, "qa-v76-estado-escritorio.png"), fullPage: false });
  const team = await desktop.evaluate(() => {
    renderWaiterMembers([
      {
        member_user_id: null,
        member_email: "empleado@correo.com",
        display_name: "Empleado de prueba",
        station: "kitchen",
        active: false,
        pending: true,
      },
    ]);
    document.querySelector("#waiterTeamDialog").showModal();
    const buttons = Array.from(document.querySelectorAll("#waiterMembersList button")).map((button) =>
      button.textContent.trim()
    );
    const row = document.querySelector("#waiterMembersList .waiter-member-row");
    return {
      buttons,
      rowWidth: row?.getBoundingClientRect().width || 0,
      dialogWidth: document.querySelector("#waiterTeamDialog").getBoundingClientRect().width,
    };
  });
  assert("Boton Confirmar autorizacion visible", team.buttons.includes("Confirmar autorizacion"), team);
  assert("Boton Cancelar invitacion visible", team.buttons.includes("Cancelar invitacion"), team);
  assert("Fila de personal cabe en el dialogo", team.rowWidth > 0 && team.rowWidth <= team.dialogWidth, team);
  await desktop.screenshot({ path: path.join(projectDir, "qa-v76-autorizacion-escritorio.png"), fullPage: false });

  for (const smoke of [
    { file: "colaborador.html", selector: "#courierIdentityFileInput", label: "Colaborador" },
    { file: "mesero.html", selector: "#waiterAuthForm", label: "Estacion" },
    { file: "admin.html", selector: "#adminSignInButton", label: "Administrador" },
  ]) {
    const smokePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    smokePage.on("pageerror", (error) => result.pageErrors.push({ page: smoke.label, message: error.message }));
    await openLocal(smokePage, smoke.file, "?app=v76");
    const smokeResult = await smokePage.evaluate((selector) => ({
      controlVisible: Boolean(document.querySelector(selector)),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }), smoke.selector);
    assert(`${smoke.label} carga su control principal`, smokeResult.controlVisible, smokeResult);
    assert(`${smoke.label} movil sin desbordamiento`, smokeResult.pageWidth <= smokeResult.viewportWidth, smokeResult);
    if (smoke.label === "Colaborador") {
      const sessionResult = await smokePage.evaluate(() => {
        courierUser = { id: "qa-courier", email: "qa@courier.test", user_metadata: {} };
        courierProfile = { status: "approved" };
        courierApplyProfileFields({
          status: "approved",
          country: "Polonia",
          country_code: "PL",
          city: "Warszawa",
          region: "Mazowieckie",
          postal_code: "00-001",
        });
        courierRender();
        return {
          authHidden: document.querySelector("#courierAuthFields")?.hidden,
          dashboardVisible: !document.querySelector("#courierDashboard")?.hidden,
          region: document.querySelector("#courierRegionInput")?.value,
          postalCode: document.querySelector("#courierPostalCodeInput")?.value,
        };
      });
      assert("Colaborador no repite inicio de sesion al entrar", sessionResult.authHidden === true, sessionResult);
      assert("Panel del colaborador aparece al entrar", sessionResult.dashboardVisible === true, sessionResult);
      assert("Colaborador conserva provincia", sessionResult.region === "Mazowieckie", sessionResult);
      assert("Colaborador conserva codigo postal", sessionResult.postalCode === "00-001", sessionResult);
    }
    result.pages[smoke.label.toLowerCase()] = smokeResult;
    await smokePage.close();
  }

  result.pages.mobile = translatedMenu;
  result.pages.operationalStatus = operationalStatus;
  result.pages.closeDialog = closeDialog;
  result.pages.mobileTeam = mobileTeam;
  result.pages.desktopStatus = desktopStatus;
  result.pages.team = team;
  await browser.close();

  const unexpectedErrors = result.pageErrors.filter(
    ({ message }) =>
      !/supabase|Failed to fetch|ERR_FILE_NOT_FOUND|cdn\.jsdelivr|Cannot read properties of null/i.test(message)
  );
  assert("Sin errores JavaScript inesperados", unexpectedErrors.length === 0, { pageErrors: result.pageErrors });
  process.stdout.write(JSON.stringify(result, null, 2));
})().catch((error) => {
  result.failure = error.stack || error.message;
  process.stderr.write(JSON.stringify(result, null, 2));
  process.exit(1);
});
