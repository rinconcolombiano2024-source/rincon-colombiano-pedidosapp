const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const projectDir = __dirname;
const result = { assertions: [], pageErrors: [] };

function assert(name, condition, details = {}) {
  const entry = { name, passed: Boolean(condition), details };
  result.assertions.push(entry);
  if (!entry.passed) throw new Error(`Fallo: ${name} ${JSON.stringify(details)}`);
}

function plain(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function openLocal(page, file, query = "?app=v79") {
  const url = pathToFileURL(path.join(projectDir, file));
  url.search = query;
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  const customerPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  customerPage.on("pageerror", (error) => result.pageErrors.push({ page: "cliente", message: error.message }));
  await openLocal(customerPage, "cliente.html");
  const customer = await customerPage.evaluate(() => {
    customerElements.registerCountryInput.value = "CO";
    customerElements.registerCountryInput.dispatchEvent(new Event("change"));
    customerElements.registerRegionInput.value = "Tolima";
    customerElements.registerRegionInput.dispatchEvent(new Event("change"));
    customerElements.registerCityInput.value = "Playa Rica";
    customerElements.registerPostalCodeInput.value = "730001";
    customerElements.registerNameInput.value = "Cliente QA";
    customerElements.nameInput.value = "Cliente QA";
    customerUser = { id: "00000000-0000-0000-0000-000000000101" };
    customerRegistrationRegion = customerSyncRegistrationRegionFromInputs();
    const payload = customerGeneralProfilePayload();
    const smallLocality = customerPlaceLocality({
      address_components: [
        { long_name: "Playa Rica", short_name: "Playa Rica", types: ["sublocality_level_1", "sublocality"] },
      ],
    });
    return {
      country: payload.country,
      countryCode: payload.country_code,
      region: payload.region,
      city: payload.city,
      postalCode: payload.postal_code,
      smallLocality,
      normalizedPoland: customerNormalizedRegion("PL", "Wojewodztwo Mazowieckie"),
      countryOptions: Array.from(customerElements.registerCountryInput.options).map((option) => option.value),
      regionOptions: Array.from(customerElements.registerRegionInput.options).map((option) => option.value),
      localityTag: customerElements.registerCityInput.tagName,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  assert("Cliente guarda nombre de pais", customer.country === "Colombia", customer);
  assert("Cliente separa country_code", customer.countryCode === "CO", customer);
  assert("Cliente conserva departamento", customer.region === "Tolima", customer);
  assert("Cliente acepta localidad rural libre", customer.city === "Playa Rica" && customer.localityTag === "INPUT", customer);
  assert("Cliente conserva codigo postal", customer.postalCode === "730001", customer);
  assert("Cliente acepta sublocality de Google", customer.smallLocality === "Playa Rica", customer);
  assert("Cliente normaliza voivodato", customer.normalizedPoland === "Mazowieckie", customer);
  assert("Cliente ofrece Colombia y Polonia", customer.countryOptions.includes("CO") && customer.countryOptions.includes("PL"), customer);
  assert("Cliente ofrece Tolima sin lista fija de ciudades", customer.regionOptions.includes("Tolima"), customer);
  assert("Cliente movil no desborda", customer.pageWidth <= 390, customer);
  await customerPage.screenshot({ path: path.join(projectDir, "qa-v79-cliente-ubicacion.png"), fullPage: true });

  const restaurantPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  restaurantPage.on("pageerror", (error) => result.pageErrors.push({ page: "restaurante", message: error.message }));
  await openLocal(restaurantPage, "index.html");
  const restaurant = await restaurantPage.evaluate(() => {
    elements.authCountryCodeInput.value = "CO";
    elements.authCountryCodeInput.dispatchEvent(new Event("change"));
    elements.authRegionInput.value = "Tolima";
    elements.authCityInput.value = "San Antonio";
    elements.authRestaurantNameInput.value = "Restaurante QA";
    const profile = restaurantSignupProfileFromInputs("qa@example.com");
    const smallLocality = restaurantPlaceLocality({
      address_components: [
        { long_name: "San Antonio", short_name: "San Antonio", types: ["postal_town"] },
      ],
    });
    return {
      country: profile.country,
      countryCode: profile.countryCode,
      region: profile.region,
      city: profile.city,
      smallLocality,
      normalizedPoland: normalizedRestaurantRegion("PL", "Wojewodztwo Mazowieckie"),
      suggestions: Array.from(document.querySelectorAll("#restaurantRegionOptions option")).map((option) => option.value),
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  assert("Restaurante guarda nombre de pais", restaurant.country === "Colombia", restaurant);
  assert("Restaurante separa country_code", restaurant.countryCode === "CO", restaurant);
  assert("Restaurante conserva region y localidad", restaurant.region === "Tolima" && restaurant.city === "San Antonio", restaurant);
  assert("Restaurante acepta postal_town de Google", restaurant.smallLocality === "San Antonio", restaurant);
  assert("Restaurante normaliza voivodato", restaurant.normalizedPoland === "Mazowieckie", restaurant);
  assert("Restaurante ofrece regiones sin fijar ciudades", restaurant.suggestions.includes("Tolima"), restaurant);
  assert("Restaurante escritorio no desborda", restaurant.pageWidth <= 1280, restaurant);
  await restaurantPage.screenshot({ path: path.join(projectDir, "qa-v79-restaurante-ubicacion.png"), fullPage: false });

  const courierPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  courierPage.on("pageerror", (error) => result.pageErrors.push({ page: "colaborador", message: error.message }));
  await courierPage.addInitScript(() => localStorage.setItem("rincon_colombiano_app_language", "pl"));
  await openLocal(courierPage, "colaborador.html");
  const courier = await courierPage.evaluate(async () => {
    courierElements.countryInput.value = "CO";
    courierElements.countryInput.dispatchEvent(new Event("change"));
    courierElements.regionInput.value = "Tolima";
    courierElements.regionInput.dispatchEvent(new Event("change"));
    courierElements.cityInput.value = "Playa Rica";
    courierElements.cityInput.dispatchEvent(new Event("input"));
    courierElements.postalCodeInput.value = "730001";
    courierElements.firstNameInput.value = "Courier";
    courierElements.lastNameInput.value = "QA";
    courierUser = { id: "00000000-0000-0000-0000-000000000102", email: "courier@example.com" };
    const payload = courierGeneralProfilePayload();
    courierProfile = { status: "approved" };
    courierRender();
    courierSetMessage(courierElements.authMessage, "Correo o contrasena incorrectos.", "error");
    courierSetMessage(courierElements.profileMessage, "El archivo es muy pesado. Usa imagen o PDF menor a 8 MB.", "error");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const polish = {
      countryLabel: document.querySelector("#courierCountryLabel")?.textContent.trim(),
      regionLabel: document.querySelector("#courierRegionLabel")?.textContent.trim(),
      cityLabel: document.querySelector("#courierCityLabel")?.textContent.trim(),
      badge: courierElements.statusBadge.textContent.trim(),
      status: courierElements.profileStatus.textContent.trim(),
      availabilityEnabled: !courierElements.availabilityButton.disabled,
      authMessage: courierElements.authMessage.textContent.trim(),
      fileMessage: courierElements.profileMessage.textContent.trim(),
    };
    const languageSelect = document.querySelector("#autoLanguageSelect");
    languageSelect.value = "en";
    languageSelect.dispatchEvent(new Event("change"));
    courierSetMessage(courierElements.authMessage, "Correo o contrasena incorrectos.", "error");
    courierSetMessage(courierElements.profileMessage, "El archivo es muy pesado. Usa imagen o PDF menor a 8 MB.", "error");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const english = {
      countryLabel: document.querySelector("#courierCountryLabel")?.textContent.trim(),
      regionLabel: document.querySelector("#courierRegionLabel")?.textContent.trim(),
      cityLabel: document.querySelector("#courierCityLabel")?.textContent.trim(),
      badge: courierElements.statusBadge.textContent.trim(),
      status: courierElements.profileStatus.textContent.trim(),
      authMessage: courierElements.authMessage.textContent.trim(),
      fileMessage: courierElements.profileMessage.textContent.trim(),
    };
    courierApplyProfileFields({ country: "PL", region: "Mazowieckie", city: "Radom", postal_code: "26-600" });
    const legacy = {
      countryCode: courierElements.countryInput.value,
      country: courierRegistrationRegion.country,
      region: courierElements.regionInput.value,
      city: courierElements.cityInput.value,
    };
    if (courierOffersTimer) window.clearInterval(courierOffersTimer);
    courierOffersTimer = null;
    return {
      country: payload.country,
      countryCode: payload.country_code,
      region: payload.region,
      city: payload.city,
      postalCode: payload.postal_code,
      cityEnabled: !courierElements.cityInput.disabled,
      countryOptions: Array.from(courierElements.countryInput.options).map((option) => option.value),
      polish,
      english,
      legacy,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  assert("Colaborador guarda nombre de pais", courier.country === "Colombia", courier);
  assert("Colaborador separa country_code", courier.countryCode === "CO", courier);
  assert("Colaborador conserva region y localidad libre", courier.region === "Tolima" && courier.city === "Playa Rica", courier);
  assert("Colaborador habilita localidad despues de region", courier.cityEnabled, courier);
  assert("Colaborador conserva codigo postal", courier.postalCode === "730001", courier);
  assert("Colaborador ofrece ambos paises", courier.countryOptions.includes("CO") && courier.countryOptions.includes("PL"), courier);
  assert("Colaborador aprobado habilita disponibilidad", courier.polish.availabilityEnabled, courier);
  assert("Colaborador traduce etiquetas al polaco", plain(courier.polish.countryLabel) === "kraj" && plain(courier.polish.cityLabel) === "miejscowosc", courier);
  assert("Colaborador traduce estado aprobado al polaco", plain(courier.polish.badge) === plain("Zweryfikowany / Zatwierdzony") && plain(courier.polish.status).includes("aktualny status"), courier);
  assert("Colaborador traduce errores dinamicos al polaco", plain(courier.polish.authMessage).startsWith("nieprawid") && plain(courier.polish.fileMessage).startsWith("plik jest za du"), courier);
  assert("Colaborador traduce etiquetas al ingles", courier.english.countryLabel === "Country" && courier.english.cityLabel === "Locality", courier);
  assert("Colaborador traduce estado aprobado al ingles", courier.english.badge === "Verified / Approved" && courier.english.status.includes("Current status"), courier);
  assert("Colaborador traduce errores dinamicos al ingles", courier.english.authMessage === "Incorrect email or password." && courier.english.fileMessage.startsWith("The file is too large."), courier);
  assert("Colaborador recupera perfiles antiguos con PL", courier.legacy.countryCode === "PL" && courier.legacy.country === "Polonia" && courier.legacy.region === "Mazowieckie", courier);
  assert("Colaborador movil no desborda", courier.pageWidth <= 390, courier);
  await courierPage.screenshot({ path: path.join(projectDir, "qa-v79-colaborador-idiomas.png"), fullPage: true });

  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  adminPage.on("pageerror", (error) => result.pageErrors.push({ page: "admin", message: error.message }));
  await openLocal(adminPage, "admin.html");
  const admin = await adminPage.evaluate(() => {
    adminRenderCourierList([{
      user_id: "00000000-0000-0000-0000-000000000103",
      first_name: "Courier",
      last_name: "QA",
      country: "Colombia",
      region: "Tolima",
      city: "Playa Rica",
      postal_code: "730001",
      status: "pending_review",
      created_at: new Date().toISOString(),
    }]);
    return document.querySelector("#adminCourierList")?.textContent || "";
  });
  assert("Administrador muestra ubicacion jerarquica disponible", /Colombia\s*\/\s*Tolima\s*\/\s*Playa Rica\s*\/\s*730001/.test(admin), { admin });

  assert("Sin errores JavaScript inesperados", result.pageErrors.length === 0, { pageErrors: result.pageErrors });
  await browser.close();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
});
