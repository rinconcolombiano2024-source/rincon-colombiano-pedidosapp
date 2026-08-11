const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const projectDir = __dirname;
const result = { assertions: [], pageErrors: [] };
let browser;

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

async function openLocal(page, file) {
  const url = pathToFileURL(path.join(projectDir, file));
  url.search = "?app=v79";
  await page.route(/^https?:/, (route) => route.abort());
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(250);
}

(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  const courierPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  courierPage.on("pageerror", (error) => result.pageErrors.push({ page: "colaborador", message: error.message }));
  await courierPage.addInitScript(() => {
    localStorage.setItem("rincon_colombiano_app_language", "es");
    localStorage.setItem("rincon_colombiano_google_maps_api_key", "qa-browser-key");
  });
  await openLocal(courierPage, "colaborador.html");

  const courier = await courierPage.evaluate(async () => {
    let autocompleteOptions = null;
    let placeChanged = null;
    window.google = {
      maps: {
        places: {
          Autocomplete: class {
            constructor(input, options) {
              this.input = input;
              this.options = options;
              autocompleteOptions = options;
            }
            addListener(eventName, callback) {
              if (eventName === "place_changed") placeChanged = callback;
            }
            setComponentRestrictions(restrictions) {
              this.options.componentRestrictions = restrictions;
              autocompleteOptions = this.options;
            }
            getPlace() {
              return {};
            }
          },
        },
      },
    };

    courierElements.countryInput.value = "CO";
    courierElements.countryInput.dispatchEvent(new Event("change"));
    courierElements.regionInput.value = "Tolima";
    courierElements.regionInput.dispatchEvent(new Event("change"));
    await courierPreparePlaceAutocomplete();

    const ruralPlace = {
      name: "Playa Rica",
      address_components: [
        { long_name: "Playa Rica", short_name: "Playa Rica", types: ["sublocality_level_1", "sublocality"] },
        { long_name: "Tolima", short_name: "Tolima", types: ["administrative_area_level_1"] },
        { long_name: "730001", short_name: "730001", types: ["postal_code"] },
        { long_name: "Colombia", short_name: "CO", types: ["country"] },
      ],
      geometry: { location: { lat: () => 3.91, lng: () => -75.48 } },
    };
    courierApplyLocalityPlace(ruralPlace);
    courierUser = { id: "00000000-0000-0000-0000-000000000201", email: "courier@example.com" };
    const payload = courierGeneralProfilePayload();

    const beforeMismatch = courierElements.cityInput.value;
    courierApplyLocalityPlace({
      name: "Soacha",
      address_components: [
        { long_name: "Soacha", short_name: "Soacha", types: ["locality"] },
        { long_name: "Cundinamarca Department", short_name: "Cundinamarca", types: ["administrative_area_level_1"] },
        { long_name: "Colombia", short_name: "CO", types: ["country"] },
      ],
      geometry: { location: { lat: () => 4.58, lng: () => -74.21 } },
    });
    const mismatchMessage = courierElements.profileMessage.textContent.trim();

    courierProfile = { status: "approved" };
    courierRender();
    const approvedEs = courierElements.statusBadge.textContent.trim();
    const languageSelect = document.querySelector("#autoLanguageSelect");
    languageSelect.value = "pl";
    languageSelect.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const approvedPl = courierElements.statusBadge.textContent.trim();
    languageSelect.value = "en";
    languageSelect.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const approvedEn = courierElements.statusBadge.textContent.trim();

    if (courierOffersTimer) window.clearInterval(courierOffersTimer);
    courierOffersTimer = null;
    return {
      payload,
      localityFromAdmin3: courierPlaceLocality({
        address_components: [
          { long_name: "San Antonio", short_name: "San Antonio", types: ["administrative_area_level_3"] },
        ],
      }),
      polishRegion: courierNormalizedRegion("PL", "Masovian Voivodeship"),
      spanishPolishRegion: courierNormalizedRegion("PL", "Voivodato de Mazovia"),
      bogotaRegion: courierNormalizedRegion("CO", "Bogotá"),
      autocompleteCountry: autocompleteOptions?.componentRestrictions?.country || "",
      hasPlaceChangedListener: typeof placeChanged === "function",
      beforeMismatch,
      afterMismatch: courierElements.cityInput.value,
      mismatchMessage,
      approvedEs,
      approvedPl,
      approvedEn,
      availabilityEnabled: !courierElements.availabilityButton.disabled,
      cityEnabled: !courierElements.cityInput.disabled,
      pageWidth: document.documentElement.scrollWidth,
    };
  });

  assert("Places restringe colaborador a Colombia", courier.autocompleteCountry === "co", courier);
  assert("Places conserva listener unico de seleccion", courier.hasPlaceChangedListener, courier);
  assert("Places acepta localidad rural", courier.payload.city === "Playa Rica", courier);
  assert("Places guarda pais legible y codigo separado", courier.payload.country === "Colombia" && courier.payload.country_code === "CO", courier);
  assert("Places guarda region y codigo postal", courier.payload.region === "Tolima" && courier.payload.postal_code === "730001", courier);
  assert("Places guarda coordenadas y zona horaria", courier.payload.registration_latitude === 3.91 && courier.payload.registration_longitude === -75.48 && courier.payload.detected_timezone === "America/Bogota", courier);
  assert("Places contempla administrative_area_level_3", courier.localityFromAdmin3 === "San Antonio", courier);
  assert("Places normaliza voivodato en ingles", courier.polishRegion === "Mazowieckie", courier);
  assert("Places normaliza voivodato en espanol", courier.spanishPolishRegion === "Mazowieckie", courier);
  assert("Places normaliza distrito capital de Colombia", courier.bogotaRegion === "Bogotá D.C.", courier);
  assert("Places rechaza localidad de otra region sin borrar la anterior", courier.beforeMismatch === "Playa Rica" && courier.afterMismatch === "Playa Rica" && /region elegida/i.test(courier.mismatchMessage), courier);
  assert("Fallback manual permanece habilitado", courier.cityEnabled, courier);
  assert("Aprobacion real habilita disponibilidad", courier.availabilityEnabled, courier);
  assert("Estado aprobado es claro en espanol", courier.approvedEs === "Verificado / Aprobado", courier);
  assert("Estado aprobado se traduce al polaco", plain(courier.approvedPl) === plain("Zweryfikowany / Zatwierdzony"), courier);
  assert("Estado aprobado se traduce al ingles", courier.approvedEn === "Verified / Approved", courier);
  assert("Colaborador movil no desborda", courier.pageWidth <= 390, courier);

  const adminPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  adminPage.on("pageerror", (error) => result.pageErrors.push({ page: "administrador", message: error.message }));
  await openLocal(adminPage, "admin.html");
  const adminText = await adminPage.evaluate(() => {
    adminRenderCourierList([{
      user_id: "00000000-0000-0000-0000-000000000202",
      first_name: "Courier",
      last_name: "QA",
      country: "Polonia",
      country_code: "PL",
      region: "Mazowieckie",
      city: "Warszawa",
      postal_code: "00-001",
      status: "pending_review",
    }]);
    return document.querySelector("#adminCourierList")?.textContent || "";
  });
  assert("Administrador renderiza ubicacion completa", /Polonia\s*\/\s*Mazowieckie\s*\/\s*Warszawa\s*\/\s*00-001/.test(adminText), { adminText });

  const sql = fs.readFileSync(path.join(projectDir, "MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql"), "utf8");
  assert("Migracion agrega country_code a la cola", /country_code text[\s\S]*region text[\s\S]*postal_code text/.test(sql), {});
  assert("Migracion conserva validacion platform_admin", /role = 'platform_admin'[\s\S]*status = 'active'/.test(sql), {});
  assert("Migracion corrige conflicto del mesero", /on conflict on constraint customer_orders_pkey do nothing;/i.test(sql), {});
  assert("Migracion no conserva conflicto ambiguo", !/on conflict \(id\) do nothing;/i.test(sql), {});
  assert("Migracion recarga esquema PostgREST", /notify pgrst, 'reload schema';/i.test(sql), {});
  assert("Migracion no elimina tablas ni desactiva RLS", !/drop\s+table|disable\s+row\s+level\s+security/i.test(sql), {});
  assert("Sin errores JavaScript inesperados", result.pageErrors.length === 0, { pageErrors: result.pageErrors });
})()
  .catch((error) => {
    result.error = error.stack || error.message;
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
