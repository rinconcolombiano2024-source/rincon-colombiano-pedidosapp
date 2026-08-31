const { test, expect } = require("@playwright/test");
const { installSupabaseMock } = require("./support/supabase-mock.cjs");

const testUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "jhon@example.test",
  user_metadata: { full_name: "Jhon Mendez", phone: "+48 000 000 000" },
  app_metadata: {},
};

test("restaurante: cambia idioma y abre el acceso sin recargar", async ({ page }) => {
  await installSupabaseMock(page);
  await page.goto("/index.html?app=v91.0.3", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#authScreen")).toBeVisible();
  await page.locator("#autoLanguageSelect").selectOption("pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.locator(".role-access-card h2").first()).toHaveText("Restauracja");

  await page.locator("#openRestaurantSignInButton").click();
  await expect(page.locator("#restaurantAuthDialog")).toBeVisible();
  await expect(page.locator("#restaurantAuthTitle")).toHaveText("Zaloguj");

  await page.locator("#autoLanguageSelect").selectOption("en");
  await expect(page.locator("#restaurantAuthTitle")).toHaveText("Sign in");
});

test("cliente: traduce Hola Jhon sin perder el nombre", async ({ page }) => {
  await installSupabaseMock(page, { user: testUser });
  await page.goto("/cliente.html?app=v91.0.3&lang=es", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#customerGreeting")).toHaveText("Hola,");
  await expect(page.locator("#customerGreetingName")).toHaveText("Jhon");

  await page.locator('[data-customer-view-target="profile"]').first().click();
  await expect(page.locator("#customerLanguageSelect")).toBeVisible();
  await page.locator("#customerLanguageSelect").selectOption("pl");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.locator("#customerGreeting")).toHaveText("Cześć,");
  await expect(page.locator("#customerGreetingName")).toHaveText("Jhon");

  await page.locator("#customerLanguageSelect").selectOption("en");
  await expect(page.locator("#customerGreeting")).toHaveText("Hello,");
  await expect(page.locator("#customerGreetingName")).toHaveText("Jhon");
  await expect(page.locator('[data-customer-view-target="home"] [data-i18n="navHome"]')).toHaveText("Home");
});

test("cliente: catálogo local agrega un producto escapado al carrito", async ({ page }) => {
  const restaurant = {
    user_id: "store-e2e",
    business_name: "Restaurante E2E",
    public_address: "Calle de prueba 1",
    operational_open: true,
    active: true,
    country_code: "PL",
  };
  const menu = {
    menu: {
      Entradas: [{
        id: "product-e2e",
        name: "<b>Arepa segura</b>",
        description: "Descripción de prueba",
        price: 15,
        available: true,
        station: "kitchen",
      }],
    },
    settings: {
      businessName: "Restaurante E2E",
      currencySymbol: "zł",
      currencyPosition: "after",
      moneyFormat: "eu",
      restaurantOperationalOpen: true,
    },
  };

  await installSupabaseMock(page, {
    rpcData: {
      get_public_restaurant_directory_by_region: [restaurant],
      get_public_restaurant_menu: menu,
    },
  });
  await page.goto("/cliente.html?app=v91.0.3&lang=es&store=store-e2e", { waitUntil: "domcontentloaded" });

  const product = page.locator("#customerMenuGrid .customer-dish-button");
  await expect(product).toHaveCount(1);
  await expect(product.locator("strong")).toHaveText("<b>Arepa segura</b>");
  await expect(product.locator("strong b")).toHaveCount(0);
  await product.click();
  await expect(page.locator("#customerCartItems .customer-cart-item")).toHaveCount(1);
  await expect(page.locator("#customerCartItems strong")).toHaveText("<b>Arepa segura</b>");
});

test("cliente: una respuesta tardía no reemplaza el restaurante elegido", async ({ page }) => {
  const restaurants = [
    { user_id: "store-slow", business_name: "Restaurante lento", country_code: "PL", operational_open: true },
    { user_id: "store-fast", business_name: "Restaurante actual", country_code: "PL", operational_open: true },
  ];
  const catalog = (businessName, productName) => ({
    menu: { Principal: [{ id: productName, name: productName, price: 20, available: true }] },
    settings: { businessName, currencySymbol: "zł", currencyPosition: "after", restaurantOperationalOpen: true },
  });

  await installSupabaseMock(page, {
    rpcData: { get_public_restaurant_directory_by_region: restaurants },
    rpcDataByUser: {
      get_public_restaurant_menu: {
        "store-slow": catalog("Restaurante lento", "Producto anterior"),
        "store-fast": catalog("Restaurante actual", "Producto correcto"),
      },
    },
    rpcDelayByUser: { get_public_restaurant_menu: { "store-slow": 180, "store-fast": 10 } },
  });
  await page.goto("/cliente.html?app=v91.0.3&lang=es", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#customerRestaurantList .customer-restaurant-card")).toHaveCount(2);

  await page.evaluate(async () => {
    const slowSelection = customerSelectRestaurant("store-slow");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const currentSelection = customerSelectRestaurant("store-fast");
    await Promise.all([slowSelection, currentSelection]);
  });

  await expect(page.locator("#customerBusinessName")).toHaveText("Restaurante actual");
  await expect(page.locator("#customerMenuGrid")).toContainText("Producto correcto");
  await expect(page.locator("#customerMenuGrid")).not.toContainText("Producto anterior");
});

test("mesero: una estación renderiza notas y nombres como texto seguro", async ({ page }) => {
  await installSupabaseMock(page, {
    user: testUser,
    rpcData: {
      claim_my_restaurant_staff_invitation: null,
      get_my_restaurant_station: {
        station: "kitchen",
        active: true,
        display_name: "Jhon",
        business_name: "Restaurante E2E",
      },
      list_my_station_orders: [{
        order_id: "order-e2e",
        table_label: "<img src=x onerror=alert(1)>",
        customer_name: "Cliente",
        order_type: "Mesa",
        station_status: "received",
        source: "customer",
        notes: "<script>window.__xss = true</script>",
        created_at: "2026-08-30T12:00:00.000Z",
        items: [{ quantity: 1, name: "<b>Producto</b>", note: "<i>Nota</i>" }],
      }],
      get_my_restaurant_shift_status: { is_open: false },
    },
  });
  await page.goto("/mesero.html?app=v91.0.3&store=store-e2e", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#restaurantStationBoard")).toBeVisible();
  await expect(page.locator("#restaurantStationOrders .restaurant-station-order")).toHaveCount(1);
  await expect(page.locator("#restaurantStationOrders img[src='x']")).toHaveCount(0);
  await expect(page.locator("#restaurantStationOrders script")).toHaveCount(0);
  await expect(page.locator("#restaurantStationOrders")).toContainText("<b>Producto</b>");
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test("colaborador: oferta simulada conserva navegación y escape", async ({ page }) => {
  await installSupabaseMock(page, {
    user: testUser,
    tableData: {
      courier_profiles: {
        user_id: testUser.id,
        first_name: "Jhon",
        last_name: "Mendez",
        status: "approved",
        country: "PL",
        terms_accepted_at: "2026-08-30T10:00:00.000Z",
      },
      courier_live_locations: { available: true, lat: 52.23, lng: 21.01, accuracy_m: 10 },
    },
    rpcData: {
      get_my_courier_approval: [{ approved: true, profile_status: "approved" }],
      get_courier_delivery_offers: [{
        assignment_id: "assignment-e2e",
        status: "offered",
        restaurant_name: "<img src=x onerror=alert(1)>",
        customer_name: "<script>window.__xss = true</script>",
        delivery_address: "Calle <b>segura</b>",
        distance_km: 1.5,
        total: 20,
        order_json: { items: [{ quantity: 1, name: "<i>Pedido</i>", note: "<b>Nota</b>" }] },
      }],
      get_my_courier_delivery_history: [],
    },
  });
  await page.goto("/colaborador.html?app=v91.0.3", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#courierDashboard")).toBeVisible();
  await expect(page.locator("#courierOffersList .courier-offer-card")).toHaveCount(1);
  await expect(page.locator("#courierOffersList img[src='x']")).toHaveCount(0);
  await expect(page.locator("#courierOffersList script")).toHaveCount(0);
  await page.locator('[data-courier-view-target="history"]').click();
  await expect(page.locator('section[data-courier-view="history"]')).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test("admin: muestra los controles esenciales sin autenticar", async ({ page }) => {
  await installSupabaseMock(page);
  await page.goto("/admin.html?app=v91.0.3", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#adminEmailInput")).toBeVisible();
  await expect(page.locator("#adminPasswordInput")).toBeVisible();
  await expect(page.locator("#adminSignInButton")).toBeEnabled();
  await expect(page.locator("#adminResetPasswordButton")).toBeEnabled();
  await expect(page.locator("#adminCourierList")).toContainText(/Inicia sesion|Zaloguj sie|Sign in/);
});
