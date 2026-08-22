const waiterParams = new URLSearchParams(window.location.search);
const waiterStoreId = String(waiterParams.get("store") || "").trim();

const waiterElements = {
  restaurantName: document.querySelector("#waiterRestaurantName"),
  logo: document.querySelector("#waiterLogo"),
  connectionStatus: document.querySelector("#waiterConnectionStatus"),
  signOutButton: document.querySelector("#waiterSignOutButton"),
  authCard: document.querySelector("#waiterAuthCard"),
  authForm: document.querySelector("#waiterAuthForm"),
  email: document.querySelector("#waiterEmail"),
  password: document.querySelector("#waiterPassword"),
  signUpButton: document.querySelector("#waiterSignUpButton"),
  authMessage: document.querySelector("#waiterAuthMessage"),
  accessCard: document.querySelector("#waiterAccessCard"),
  accessMessage: document.querySelector("#waiterAccessMessage"),
  retryAccessButton: document.querySelector("#waiterRetryAccessButton"),
  app: document.querySelector("#waiterApp"),
  stationBoard: document.querySelector("#restaurantStationBoard"),
  stationEyebrow: document.querySelector("#restaurantStationEyebrow"),
  stationTitle: document.querySelector("#restaurantStationTitle"),
  stationHelp: document.querySelector("#restaurantStationHelp"),
  stationOrders: document.querySelector("#restaurantStationOrders"),
  stationRefreshButton: document.querySelector("#restaurantStationRefreshButton"),
  serverLabel: document.querySelector("#waiterServerLabel"),
  refreshButton: document.querySelector("#waiterRefreshButton"),
  searchInput: document.querySelector("#waiterSearchInput"),
  categoryTabs: document.querySelector("#waiterCategoryTabs"),
  menuGrid: document.querySelector("#waiterMenuGrid"),
  waiterCustomItemForm: document.querySelector("#waiterCustomItemForm"),
waiterCustomItemName: document.querySelector("#waiterCustomItemName"),
waiterCustomItemPrice: document.querySelector("#waiterCustomItemPrice"),
  tableInput: document.querySelector("#waiterTableInput"),
  customerInput: document.querySelector("#waiterCustomerInput"),
  orderType: document.querySelector("#waiterOrderType"),
  paymentMethod: document.querySelector("#waiterPaymentMethod"),
  cart: document.querySelector("#waiterCart"),
  notes: document.querySelector("#waiterNotes"),
  total: document.querySelector("#waiterTotal"),
  cartBadge: document.querySelector("#waiterCartBadge"),
  sendButton: document.querySelector("#waiterSendOrderButton"),
  clearButton: document.querySelector("#waiterClearOrderButton"),
  orderMessage: document.querySelector("#waiterOrderMessage"),
  sentOrders: document.querySelector("#waiterSentOrders"),
  refreshSentButton: document.querySelector("#waiterRefreshSentButton"),
  dailySummary: document.querySelector("#waiterDailySummary"),
  dailyCloseButton: document.querySelector("#waiterDailyCloseButton"),
  monthlyCloseButton: document.querySelector("#waiterMonthlyCloseButton"),
  monthInput: document.querySelector("#waiterMonthInput"),
  monthlySummary: document.querySelector("#waiterMonthlySummary"),
  shiftBar: document.querySelector("#waiterShiftBar"),
  shiftStatus: document.querySelector("#waiterShiftStatus"),
  shiftButton: document.querySelector("#waiterShiftButton"),
  toast: document.querySelector("#waiterToast"),
};

let waiterClient = null;
let waiterUser = null;
let waiterMembership = null;
let waiterMenu = {};
let waiterSettings = {};
let waiterActiveCategory = "";
let waiterCart = [];
let waiterMenuChannel = null;
let waiterOrdersChannel = null;
let waiterStationPollTimer = null;
let waiterToastTimer = null;
let waiterSyncingQueue = false;

function waiterEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function waiterConfig() {
  const config = window.RINCON_SUPABASE || {};
  return {
    url: String(config.url || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, ""),
    anonKey: String(config.anonKey || "").trim(),
  };
}

function waiterSetStatus(message, type = "") {
  waiterElements.connectionStatus.textContent = message;
  waiterElements.connectionStatus.dataset.type = type;
}

function waiterSetMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function waiterShowToast(message) {
  window.clearTimeout(waiterToastTimer);
  waiterElements.toast.textContent = message;
  waiterElements.toast.hidden = false;
  waiterToastTimer = window.setTimeout(() => {
    waiterElements.toast.hidden = true;
  }, 3200);
}

function waiterDraftKey() {
  return `rc_ordera_waiter_draft_${waiterStoreId}_${waiterUser?.id || "guest"}`;
}

function waiterQueueKey() {
  return `rc_ordera_waiter_queue_${waiterStoreId}_${waiterUser?.id || "guest"}`;
}

function waiterStationCacheKey() {
  return `rc_ordera_station_orders_${waiterStoreId}_${waiterUser?.id || "guest"}`;
}

function waiterReadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function waiterSaveDraft() {
  if (!waiterUser) return;
  localStorage.setItem(
    waiterDraftKey(),
    JSON.stringify({
      cart: waiterCart,
      table: waiterElements.tableInput.value,
      customer: waiterElements.customerInput.value,
      orderType: waiterElements.orderType.value,
      paymentMethod: waiterElements.paymentMethod.value,
      notes: waiterElements.notes.value,
    })
  );
}

function waiterLoadDraft() {
  const draft = waiterReadJson(waiterDraftKey(), {});
  waiterCart = Array.isArray(draft.cart) ? draft.cart : [];
  waiterElements.tableInput.value = String(draft.table || "");
  waiterElements.customerInput.value = String(draft.customer || "");
  waiterElements.orderType.value = String(draft.orderType || "Comer en el punto");
  waiterElements.paymentMethod.value = String(draft.paymentMethod || "Pago en caja");
  waiterElements.notes.value = String(draft.notes || "").toUpperCase();
}

function waiterClearDraft() {
  waiterCart = [];
  waiterElements.tableInput.value = "";
  waiterElements.customerInput.value = "";
  waiterElements.orderType.value = "Comer en el punto";
  waiterElements.paymentMethod.value = "Pago en caja";
  waiterElements.notes.value = "";
  localStorage.removeItem(waiterDraftKey());
  waiterRenderCart();
}

function waiterNormalizeMenu(rawMenu) {
  const normalized = {};

  Object.entries(rawMenu || {}).forEach(([category, products]) => {
    const cleanCategory = String(category || "").trim();

    if (!cleanCategory || !Array.isArray(products)) return;

    normalized[cleanCategory] = products
      .map((product, index) => {
        const name = String(product?.name || "").trim();

        if (!name) return null;

        const productId = String(
          product?.id ||
          product?.productId ||
          product?.product_id ||
          `${cleanCategory}-${name}-${index}`
        ).trim();

        return {
          id: productId,

          name,

          description: String(
            product?.description || ""
          ).trim(),

          price: Math.max(
            0,
            Number.parseFloat(product?.price) || 0
          ),

          available:
            product?.available !== false,

          imageUrl: String(
            product?.imageUrl ||
            product?.image_url ||
            product?.image ||
            ""
          ).trim(),

          station: waiterNormalizeProductStation(
            product?.station || product?.preparationStation || product?.preparation_station
          ),
        };
      })
      .filter(Boolean);
  });

  return normalized;
}

function waiterNormalizeProductStation(station) {
  const value = String(station || "").trim().toLowerCase();
  return ["kitchen", "grill", "drinks", "fast_food", "starters", "salads"].includes(value)
    ? value
    : "kitchen";
}

function waiterMoney(value) {
  const number = Number.parseFloat(value) || 0;
  const symbol = String(waiterSettings.currencySymbol || "$");
  const position = waiterSettings.currencyPosition === "after" ? "after" : "before";
  const formatted = number.toLocaleString(waiterSettings.moneyFormat === "eu" ? "pl-PL" : "es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return position === "after" ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function waiterRenderCategories() {
  const categories = Object.keys(waiterMenu);
  if (!categories.includes(waiterActiveCategory)) waiterActiveCategory = categories[0] || "";
  waiterElements.categoryTabs.innerHTML = categories
    .map(
      (category) =>
        `<button type="button" class="${category === waiterActiveCategory ? "is-active" : ""}" data-category="${waiterEscape(category)}">${waiterEscape(category)}</button>`
    )
    .join("");
}

function waiterAllProducts() {
  const search = waiterElements.searchInput.value.trim().toLocaleLowerCase();
  const source = search
    ? Object.entries(waiterMenu).flatMap(([category, products]) => products.map((product) => ({ ...product, category })))
    : (waiterMenu[waiterActiveCategory] || []).map((product) => ({ ...product, category: waiterActiveCategory }));
  return source.filter((product) => !search || product.name.toLocaleLowerCase().includes(search));
}

function waiterRenderMenu() {

  const products = waiterAllProducts();


  if (!products.length) {

    waiterElements.menuGrid.innerHTML = `
      <div class="waiter-empty">
        No hay productos disponibles en esta selección.
      </div>
    `;

    return;
  }


  waiterElements.menuGrid.innerHTML =
    products
      .map((product) => {

        const image = product.imageUrl
          ? `
            <img
              src="${waiterEscape(product.imageUrl)}"
              alt="${waiterEscape(product.name)}"
              loading="lazy"
            />
          `
          : `
            <div
              class="waiter-product-placeholder"
              aria-hidden="true"
            >
              🍽️
            </div>
          `;


        return `
       <article
  class="waiter-product-card
    ${product.available ? "" : "is-unavailable"}"
  data-product-id="${waiterEscape(product.id)}"
  data-category="${waiterEscape(product.category)}"
  data-product-available="${product.available ? "true" : "false"}"
  role="button"
  tabindex="${product.available ? "0" : "-1"}"
  aria-disabled="${product.available ? "false" : "true"}"
>

            <div class="waiter-product-image">
              ${image}
            </div>


            <div class="waiter-product-info">

              <strong class="waiter-product-name">
                ${waiterEscape(product.name)}
              </strong>

              ${
                product.description
                  ? `
                    <span class="waiter-product-description">
                      ${waiterEscape(product.description)}
                    </span>
                  `
                  : ""
              }

              <div class="waiter-product-bottom">

                <strong class="waiter-product-price">
                  ${
                    product.available
                      ? waiterMoney(product.price)
                      : "Agotado"
                  }
                </strong>

                <button
                  class="waiter-add-product-button"
                  type="button"
                  data-product-id="${waiterEscape(product.id)}"
                  data-category="${waiterEscape(product.category)}"
                  ${product.available ? "" : "disabled"}
                  aria-label="Agregar ${waiterEscape(product.name)}"
                >
                  +
                </button>

              </div>

            </div>

          </article>
        `;

      })
      .join("");

}
function waiterCartTotal() {
  return waiterCart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function waiterRenderCart() {

  const count =
    waiterCart.reduce(
      (sum, item) =>
        sum + Math.max(1, Number(item.qty) || 1),
      0
    );


  waiterElements.cartBadge.textContent =
    count;


  waiterElements.total.textContent =
    waiterMoney(waiterCartTotal());


  waiterElements.sendButton.disabled =
    waiterCart.length === 0;


  if (!waiterCart.length) {

    waiterElements.cart.innerHTML = `
      <div class="waiter-empty">
        Selecciona productos del menú.
      </div>
    `;

    return;
  }


  waiterElements.cart.innerHTML =
    waiterCart
      .map((item) => `

        <article
          class="waiter-cart-item"
          data-cart-id="${waiterEscape(item.cartId)}"
        >

          <div class="waiter-cart-item-head">

            <div>
              <strong>
                ${waiterEscape(item.name)}
              </strong>

              <small>
                ${waiterMoney(item.price)}
                por unidad
              </small>
            </div>

            <strong class="waiter-cart-subtotal">
              ${waiterMoney(
                item.price *
                Math.max(1, Number(item.qty) || 1)
              )}
            </strong>

          </div>


          <div class="waiter-quantity">

            <button
              type="button"
              data-action="minus"
              aria-label="Restar uno"
            >
              −
            </button>

            <strong>
              ${Math.max(1, Number(item.qty) || 1)}
            </strong>

            <button
              type="button"
              data-action="plus"
              aria-label="Agregar uno"
            >
              +
            </button>

            <button
              class="waiter-remove-product"
              type="button"
              data-action="remove"
            >
              Quitar
            </button>

          </div>


          <label class="waiter-item-note-label">

            <span>
              Nota para este plato
            </span>

            <textarea
              data-action="note"
              rows="2"
              placeholder="Ej: SIN CEBOLLA, SALSA APARTE..."
            >${waiterEscape(item.note || "")}</textarea>

          </label>

        </article>

      `)
      .join("");

}

function waiterAddProduct(productId, category) {

  const cleanProductId =
    String(productId || "").trim();

  const cleanCategory =
    String(category || "").trim();

  if (!cleanProductId) {
    waiterShowToast(
      "No fue posible identificar este producto."
    );
    return;
  }


  let product = null;


  /* Primero buscar dentro de la categoría indicada */

  if (cleanCategory && waiterMenu[cleanCategory]) {
    product =
      waiterMenu[cleanCategory].find(
        (entry) =>
          String(entry.id) === cleanProductId
      ) || null;
  }


  /* Respaldo:
     buscar en TODO el menú si la categoría no coincide */

  if (!product) {

    for (const products of Object.values(waiterMenu)) {

      product =
        products.find(
          (entry) =>
            String(entry.id) === cleanProductId
        ) || null;

      if (product) break;
    }

  }


  if (!product) {
    waiterShowToast(
      "No encontré este producto en el menú."
    );
    return;
  }


  if (!product.available) {
    waiterShowToast(
      `${product.name} está agotado.`
    );
    return;
  }


  const existing =
    waiterCart.find(
      (item) =>
        String(item.productId) ===
          String(product.id) &&
        !String(item.note || "").trim()
    );


  if (existing) {

    existing.qty =
      Math.max(1, Number(existing.qty) || 1) + 1;

  } else {

    waiterCart.push({

      cartId:
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,

      productId: String(product.id),

      name: product.name,

      price: Number(product.price) || 0,

      qty: 1,

      note: "",

      station: waiterNormalizeProductStation(product.station),

    });

  }


  waiterRenderCart();

  waiterSaveDraft();

  waiterShowToast(
    `${product.name} agregado al pedido.`
  );

}
function waiterAddCustomItem() {
  const name = String(
    waiterElements.waiterCustomItemName?.value || ""
  ).trim();

  const price = Number.parseFloat(
    waiterElements.waiterCustomItemPrice?.value || "0"
  );

  if (!name) {
    waiterShowToast("Escribe el nombre del producto especial.");
    waiterElements.waiterCustomItemName?.focus();
    return;
  }

  if (!Number.isFinite(price) || price <= 0) {
    waiterShowToast("Escribe un precio valido.");
    waiterElements.waiterCustomItemPrice?.focus();
    return;
  }

  waiterCart.push({
    cartId: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,

    productId: `custom-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,

    name: name.toUpperCase(),
    price: Math.round(price * 100) / 100,
    qty: 1,
    note: "",
    station: "kitchen",
    custom: true,
  });

  waiterElements.waiterCustomItemName.value = "";
  waiterElements.waiterCustomItemPrice.value = "";

  waiterRenderCart();
  waiterSaveDraft();

  waiterShowToast(`${name.toUpperCase()} agregado al pedido.`);
}
async function waiterLoadMenu() {
  if (!waiterClient || !waiterStoreId) return;
  waiterSetStatus(navigator.onLine ? "Actualizando menu..." : "Sin internet", navigator.onLine ? "" : "offline");
  const { data, error } = await waiterClient.rpc("get_public_restaurant_menu", { p_user_id: waiterStoreId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("El restaurante esta cerrado o no esta disponible.");
  waiterMenu = waiterNormalizeMenu(row.menu);
  waiterSettings = row.settings || {};
  waiterElements.restaurantName.textContent = String(waiterSettings.businessName || waiterMembership?.business_name || "Restaurante");
  const logo = String(waiterSettings.businessLogoUrl || waiterMembership?.logo_url || "").trim();
  waiterElements.logo.src = logo;
  waiterElements.logo.hidden = !logo;
  waiterRenderCategories();
  waiterRenderMenu();
  waiterRenderCart();
  waiterSetStatus("Sincronizado", "ok");
}

function waiterStatusLabel(status) {
  if (status === "accepted") return "Aceptado e impreso";
  if (status === "sent") return "Enviado";
  if (status === "delivered") return "Entregado";
  if (status === "cancelled") return "Cancelado";
  return "Esperando caja";
}

function waiterStationLabel(station) {
  return {
    waiter: "Mesero",
    cashier: "Caja",
    kitchen: "Cocina",
    grill: "Parrilla",
    drinks: "Bebidas",
    fast_food: "Comidas rapidas",
    starters: "Entradas",
    salads: "Ensaladas",
    packing: "Empaque",
    dispatch: "Despacho",
    manager: "Encargado",
  }[station] || "Estacion";
}

function waiterStationStatusLabel(status) {
  return {
    blocked: "Esperando preparacion",
    received: "Recibido en cocina",
    preparing: "En preparacion",
    ready: "Listo para empacar",
    packed: "Empacado",
    dispatched: "En camino / despachado",
    completed: "Entregado",
    cancelled: "Cancelado",
  }[status] || "Recibido";
}

function waiterStationActions(order) {
  const station = waiterMembership?.station;
  const status = order.station_status || "received";
  if (["kitchen", "grill", "drinks", "fast_food", "starters", "salads"].includes(station)) {
    if (status === "received") return `<button type="button" data-next-status="preparing">Iniciar preparacion</button>`;
    if (status === "preparing") return `<button type="button" data-next-status="ready">Marcar listo</button>`;
  }
  if (station === "packing" && ["received", "preparing", "ready"].includes(status)) {
    return `<button type="button" data-next-status="packed">Marcar empacado</button>`;
  }
  if (station === "dispatch") {
    if (["received", "preparing", "ready", "packed"].includes(status)) {
      return `<button type="button" data-next-status="dispatched">Marcar despachado</button>`;
    }
    if (status === "dispatched") return `<button type="button" data-next-status="completed">Marcar entregado</button>`;
  }
  return `<span>Esperando la siguiente estacion.</span>`;
}

function waiterRenderStationOrders(orders = []) {
  if (!waiterElements.stationOrders) return;
  if (!orders.length) {
    waiterElements.stationOrders.innerHTML = `<div class="waiter-empty">No hay pedidos activos para esta estacion.</div>`;
    return;
  }
  waiterElements.stationOrders.innerHTML = orders
    .map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const time = new Date(order.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
      const label = [order.table_label, order.customer_name].filter(Boolean).join(" - ") || "Pedido";
      const notes = String(order.notes || "").trim().toUpperCase();
      return `<article class="restaurant-station-order" data-order-id="${waiterEscape(order.order_id)}">
        <header><div><h2>${waiterEscape(label)}</h2><span>${waiterEscape(order.order_type || "Pedido")} / ${waiterEscape(time)}</span></div><strong>${waiterEscape(waiterStationStatusLabel(order.station_status))}</strong></header>
        <div class="restaurant-station-items">${items
          .map((item) => `<div><strong>${Number.parseInt(item.qty || item.quantity, 10) || 1} x ${waiterEscape(item.name || item.product_name_snapshot || "Producto")}</strong>${item.note ? `<p class="restaurant-station-note">${waiterEscape(String(item.note).toUpperCase())}</p>` : ""}</div>`)
          .join("")}</div>
        ${notes ? `<p class="restaurant-station-note">NOTAS: ${waiterEscape(notes)}</p>` : ""}
        <footer><span>${order.source === "waiter" ? `Mesero: ${waiterEscape(order.server_name || "Personal")}` : "Pedido de cliente"}</span><div class="restaurant-station-actions">${navigator.onLine ? waiterStationActions(order) : "<span>Acciones disponibles al recuperar internet.</span>"}</div></footer>
      </article>`;
    })
    .join("");
}

async function waiterLoadStationOrders() {
  if (!waiterClient || !waiterUser || !waiterMembership || !waiterElements.stationOrders) return;
  const cachedOrders = waiterReadJson(waiterStationCacheKey(), []);
  if (!navigator.onLine) {
    waiterRenderStationOrders(Array.isArray(cachedOrders) ? cachedOrders : []);
    waiterSetStatus("Sin internet / ultima informacion", "offline");
    return;
  }
  waiterElements.stationOrders.innerHTML = `<div class="waiter-empty">Actualizando pedidos...</div>`;
  const { data, error } = await waiterClient.rpc("list_my_station_orders", {
    p_restaurant_user_id: waiterStoreId,
  });
  if (error) {
    if (Array.isArray(cachedOrders) && cachedOrders.length) waiterRenderStationOrders(cachedOrders);
    else waiterElements.stationOrders.innerHTML = `<div class="waiter-empty">No fue posible cargar esta estacion. Ejecuta nuevamente la migracion V71.</div>`;
    waiterSetStatus("Error de estacion", "error");
    return;
  }
  const orders = Array.isArray(data) ? data : [];
  localStorage.setItem(waiterStationCacheKey(), JSON.stringify(orders));
  waiterRenderStationOrders(orders);
  waiterSetStatus("Sincronizado", "ok");
}

async function waiterAdvanceStationOrder(orderId, nextStatus, button) {
  if (!orderId || !nextStatus || !waiterClient) return;
  button.disabled = true;
  const { error } = await waiterClient.rpc("update_my_station_order", {
    p_restaurant_user_id: waiterStoreId,
    p_order_id: orderId,
    p_next_station_status: nextStatus,
  });
  if (error) {
    waiterShowToast(/not allowed/i.test(String(error.message || "")) ? "Ese cambio no corresponde a tu estacion." : "No fue posible actualizar el pedido.");
    button.disabled = false;
    return;
  }
  waiterShowToast(`Pedido actualizado: ${waiterStationStatusLabel(nextStatus)}.`);
  await waiterLoadStationOrders();
}

async function waiterLoadSentOrders() {
  if (!waiterClient || !waiterUser) return;
  const businessDate = waiterBusinessDateKey();
  const { startAt, endAt } = waiterBusinessDayBounds(businessDate);
  const { data, error } = await waiterClient
    .from("customer_orders")
    .select("id,status,table_label,customer_name,total,created_at,order_json")
    .eq("created_by_user_id", waiterUser.id)
    .eq("user_id", waiterStoreId)
    .gte("created_at", startAt)
    .lt("created_at", endAt)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    waiterElements.sentOrders.innerHTML = `<div class="waiter-empty">No se pudo cargar el seguimiento. Ejecuta la migracion V71 y vuelve a intentar.</div>`;
    return;
  }
  const orders = data || [];
  waiterElements.sentOrders.innerHTML = orders.length
    ? orders
        .map((order) => {
          const items = Array.isArray(order.order_json?.items) ? order.order_json.items : [];
          const time = new Date(order.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
          return `<article class="waiter-sent-card"><div><strong>${waiterEscape(order.table_label || order.customer_name || "Pedido")}</strong><span>${waiterEscape(time)}</span></div><strong>${waiterStatusLabel(order.status)}</strong><p>${items.map((item) => `${item.qty || item.quantity || 1} x ${item.name || item.product_name_snapshot || "Producto"}`).join(" | ")}</p><span>${waiterMoney(order.total)}</span></article>`;
        })
        .join("")
    : `<div class="waiter-empty">Aun no has enviado pedidos hoy.</div>`;

  const reportResult = await waiterClient.rpc("get_my_waiter_daily_report", {
    p_restaurant_user_id: waiterStoreId,
    p_business_date: businessDate,
  });
  if (!reportResult.error && waiterElements.dailySummary) {
    const report = reportResult.data || {};
    waiterElements.dailySummary.innerHTML = `
      <div><span>Pedidos</span><strong>${Number(report.order_count) || 0}</strong></div>
      <div><span>Total</span><strong>${waiterMoney(report.sales_total)}</strong></div>
      <div><span>Promedio</span><strong>${waiterMoney(report.average_ticket)}</strong></div>
      <div><span>Cancelados</span><strong>${Number(report.cancelled_count) || 0}</strong></div>`;
  } else if (waiterElements.dailySummary) {
    waiterElements.dailySummary.innerHTML = `<p>Ejecuta la migracion V85.02 para ver el cierre diario confirmado.</p>`;
  }
  await waiterLoadMonthlyReport();
}

function waiterBusinessDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function waiterMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function waiterSelectedMonthAnchor() {
  const month = /^\d{4}-\d{2}$/.test(waiterElements.monthInput?.value || "")
    ? waiterElements.monthInput.value
    : waiterMonthKey();
  if (waiterElements.monthInput) waiterElements.monthInput.value = month;
  return `${month}-01`;
}

function waiterRenderMonthlyReport(report = {}) {
  if (!waiterElements.monthlySummary) return;
  waiterElements.monthlySummary.innerHTML = `
    <div><span>Pedidos del mes</span><strong>${Number(report.order_count) || 0}</strong></div>
    <div><span>Total del mes</span><strong>${waiterMoney(report.sales_total)}</strong></div>
    <div><span>Promedio</span><strong>${waiterMoney(report.average_ticket)}</strong></div>
    <div><span>Cancelados</span><strong>${Number(report.cancelled_count) || 0}</strong></div>`;
}

async function waiterLoadMonthlyReport() {
  if (!waiterClient || !waiterUser || !waiterElements.monthlySummary) return;
  const { data, error } = await waiterClient.rpc("get_my_waiter_monthly_report", {
    p_restaurant_user_id: waiterStoreId,
    p_anchor_date: waiterSelectedMonthAnchor(),
  });
  if (error) {
    waiterElements.monthlySummary.innerHTML = `<p>Ejecuta la migracion V85.02 para ver el cierre mensual confirmado.</p>`;
    return;
  }
  waiterRenderMonthlyReport(data || {});
}

function waiterBusinessDayBounds(day) {
  const [year, month, date] = String(day).split("-").map(Number);
  const start = new Date(year, month - 1, date, 0, 0, 0, 0);
  const end = new Date(year, month - 1, date + 1, 0, 0, 0, 0);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

async function waiterCloseDay() {
  if (!waiterClient || !waiterUser || !navigator.onLine) {
    waiterShowToast("Necesitas conexion para confirmar el cierre diario.");
    return;
  }
  if (!confirm("Confirmar el cierre de tus pedidos de hoy? El historial del restaurante se conserva.")) return;
  waiterElements.dailyCloseButton.disabled = true;
  const { data, error } = await waiterClient.rpc("close_my_waiter_day", {
    p_restaurant_user_id: waiterStoreId,
    p_business_date: waiterBusinessDateKey(),
  });
  waiterElements.dailyCloseButton.disabled = false;
  if (error) {
    waiterShowToast(["42883", "PGRST202"].includes(error.code) ? "Ejecuta la migracion V85.02 en Supabase." : "No fue posible confirmar el cierre diario.");
    return;
  }
  const closure = Array.isArray(data) ? data[0] : data;
  waiterShowToast(`Cierre diario confirmado: ${waiterMoney(closure?.report_snapshot?.sales_total)}.`);
  await waiterLoadSentOrders();
}

async function waiterCloseMonth() {
  if (!waiterClient || !waiterUser || !navigator.onLine) {
    waiterShowToast("Necesitas conexion para confirmar el cierre mensual.");
    return;
  }
  const month = waiterElements.monthInput?.value || waiterMonthKey();
  if (!confirm(`Confirmar el cierre de tus pedidos de ${month}? El historial del restaurante se conserva.`)) return;
  waiterElements.monthlyCloseButton.disabled = true;
  const { data, error } = await waiterClient.rpc("close_my_waiter_month", {
    p_restaurant_user_id: waiterStoreId,
    p_anchor_date: waiterSelectedMonthAnchor(),
  });
  waiterElements.monthlyCloseButton.disabled = false;
  if (error) {
    waiterShowToast(["42883", "PGRST202"].includes(error.code) ? "Ejecuta la migracion V85.02 en Supabase." : "No fue posible confirmar el cierre mensual.");
    return;
  }
  const closure = Array.isArray(data) ? data[0] : data;
  waiterShowToast(`Cierre mensual confirmado: ${waiterMoney(closure?.report_snapshot?.sales_total)}.`);
  await waiterLoadMonthlyReport();
}

async function waiterLoadShiftStatus() {
  if (!waiterClient || !waiterUser || !waiterMembership) return;
  const { data, error } = await waiterClient.rpc("get_my_restaurant_shift_status", {
    p_restaurant_user_id: waiterStoreId,
  });
  if (error) {
    waiterElements.shiftStatus.textContent = "Migracion V85.02 pendiente";
    waiterElements.shiftButton.disabled = true;
    return;
  }
  const entry = Array.isArray(data) ? data[0] : data;
  const open = entry?.is_open === true;
  waiterElements.shiftStatus.textContent = open
    ? `En servicio · ${Number(entry.worked_minutes) || 0} min`
    : entry?.clock_out_at ? "Jornada finalizada" : "Sin registrar entrada";
  waiterElements.shiftButton.textContent = open ? "Registrar salida" : "Registrar entrada";
  waiterElements.shiftButton.dataset.action = open ? "out" : "in";
  waiterElements.shiftButton.disabled = false;
}

async function waiterToggleShift() {
  if (!navigator.onLine || !waiterClient || !waiterUser) {
    waiterShowToast("La entrada y salida requieren confirmacion en linea.");
    return;
  }
  waiterElements.shiftButton.disabled = true;
  const action = waiterElements.shiftButton.dataset.action || "in";
  const { error } = await waiterClient.rpc("clock_my_restaurant_shift", {
    p_restaurant_user_id: waiterStoreId,
    p_action: action,
  });
  if (error) waiterShowToast(["42883", "PGRST202"].includes(error.code) ? "Ejecuta la migracion V85.02 en Supabase." : "No fue posible registrar la jornada.");
  else waiterShowToast(action === "in" ? "Entrada registrada." : "Salida registrada.");
  await waiterLoadShiftStatus();
}

function waiterOrderPayload() {
  return {
    p_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    p_restaurant_user_id: waiterStoreId,
    p_table_label: waiterElements.tableInput.value.trim(),
    p_customer_name: waiterElements.customerInput.value.trim(),
    p_order_type: waiterElements.orderType.value,
    p_payment_method: waiterElements.paymentMethod.value,
    p_notes: waiterElements.notes.value.trim().toUpperCase(),
   p_items: waiterCart.map((item) => ({
  productId: item.productId,
  name: item.name,
  price: item.price,
  qty: item.qty,
  note: String(item.note || "").trim().toUpperCase(),
  station: waiterNormalizeProductStation(item.station),
  custom: item.custom === true,
})),
  };
}

function waiterReadQueue() {
  const queue = waiterReadJson(waiterQueueKey(), []);
  return Array.isArray(queue) ? queue : [];
}

function waiterWriteQueue(queue) {
  localStorage.setItem(waiterQueueKey(), JSON.stringify(queue));
}

function waiterQueueOrder(payload) {
  const queue = waiterReadQueue();
  if (!queue.some((entry) => entry.p_id === payload.p_id)) queue.push(payload);
  waiterWriteQueue(queue);
}

async function waiterSubmitPayload(payload) {
  const { data, error } = await waiterClient.rpc("submit_waiter_order", payload);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function waiterSyncQueue() {
  if (waiterSyncingQueue || !navigator.onLine || !waiterClient || !waiterUser || !waiterMembership) return;
  waiterSyncingQueue = true;
  const queue = waiterReadQueue();
  const remaining = [];
  for (const payload of queue) {
    try {
      await waiterSubmitPayload(payload);
    } catch (error) {
      remaining.push(payload);
      if (!/fetch|network|timeout/i.test(String(error?.message || ""))) console.error(error);
    }
  }
  waiterWriteQueue(remaining);
  waiterSyncingQueue = false;
  if (queue.length && !remaining.length) waiterShowToast("Pedidos pendientes sincronizados con la caja.");
  await waiterLoadSentOrders();
}

async function waiterSendOrder() {
  if (!waiterCart.length) return;
  if (!waiterElements.tableInput.value.trim() && !waiterElements.customerInput.value.trim()) {
    waiterSetMessage(waiterElements.orderMessage, "Escribe la mesa o el nombre del cliente.", "error");
    waiterElements.tableInput.focus();
    return;
  }
  const payload = waiterOrderPayload();
  waiterElements.sendButton.disabled = true;
  waiterSetMessage(waiterElements.orderMessage, "Enviando a la caja...");
  if (!navigator.onLine) {
    waiterQueueOrder(payload);
    waiterClearDraft();
    waiterSetMessage(waiterElements.orderMessage, "Guardado sin internet. Se enviara automaticamente al recuperar la conexion.", "ok");
    waiterElements.sendButton.disabled = false;
    return;
  }
  try {
    await waiterSubmitPayload(payload);
    waiterClearDraft();
    waiterSetMessage(waiterElements.orderMessage, "Pedido enviado. La caja recibio la solicitud para aceptar e imprimir.", "ok");
    waiterShowToast("Pedido enviado a la caja.");
    await waiterLoadSentOrders();
    waiterSelectView("sent");
  } catch (error) {
    console.error("ERROR REAL submit_waiter_order:", error);
    const message = String(error?.message || "");
    if (/fetch|network|timeout/i.test(message)) {
      waiterQueueOrder(payload);
      waiterClearDraft();
      waiterSetMessage(waiterElements.orderMessage, "Conexion inestable. El pedido quedo pendiente de sincronizacion.", "ok");
    } else if (/not authorized|autoriz/i.test(message)) {
      waiterSetMessage(waiterElements.orderMessage, "Tu autorizacion ya no esta activa. Pide ayuda al propietario.", "error");
      await waiterAuthorize();
    } else if (/unavailable/i.test(message)) {
      waiterSetMessage(waiterElements.orderMessage, "Un producto ya no esta disponible. Actualiza el menu y revisa el pedido.", "error");
      await waiterLoadMenu();
    } else {
      waiterSetMessage(waiterElements.orderMessage, "No fue posible enviar el pedido. Revisa la conexion y la migracion V71.", "error");
      console.error(error);
    }
  } finally {
    waiterElements.sendButton.disabled = waiterCart.length === 0;
  }
}

function waiterStopRealtime() {
  if (waiterStationPollTimer) {
    window.clearInterval(waiterStationPollTimer);
    waiterStationPollTimer = null;
  }
  [waiterMenuChannel, waiterOrdersChannel].forEach((channel) => {
    if (channel && waiterClient?.removeChannel) waiterClient.removeChannel(channel).catch(() => {});
  });
  waiterMenuChannel = null;
  waiterOrdersChannel = null;
}

function waiterStartRealtime() {
  waiterStopRealtime();
  if (!waiterClient || !waiterStoreId || !waiterUser) return;
  const canTakeOrders = ["waiter", "cashier", "manager"].includes(waiterMembership?.station);
  if (canTakeOrders) {
    waiterMenuChannel = waiterClient
      .channel(`waiter-menu-${waiterStoreId}-${waiterUser.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings", filter: `user_id=eq.${waiterStoreId}` }, () => {
        waiterLoadMenu().catch(console.error);
        waiterShowToast("Menu actualizado por el restaurante.");
      })
      .subscribe();
    waiterOrdersChannel = waiterClient
      .channel(`waiter-orders-${waiterStoreId}-${waiterUser.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "customer_orders", filter: `created_by_user_id=eq.${waiterUser.id}` }, () => {
        waiterLoadSentOrders().catch(console.error);
      })
      .subscribe();
    return;
  }
  waiterOrdersChannel = waiterClient
    .channel(`restaurant-station-${waiterStoreId}-${waiterUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "customer_orders", filter: `user_id=eq.${waiterStoreId}` }, () => {
      waiterLoadStationOrders().catch(console.error);
    })
    .subscribe();
  waiterStationPollTimer = window.setInterval(() => waiterLoadStationOrders().catch(() => {}), 15000);
}

async function waiterAuthorize() {
  if (!waiterClient || !waiterUser || !waiterStoreId) return;
  waiterSetStatus("Verificando autorizacion...");
  const claimResult = await waiterClient.rpc("claim_my_restaurant_staff_invitation", {
    p_restaurant_user_id: waiterStoreId,
  });
  if (claimResult.error && !["42883", "PGRST202"].includes(claimResult.error.code)) {
    waiterElements.authCard.hidden = true;
    waiterElements.app.hidden = true;
    waiterElements.stationBoard.hidden = true;
    waiterElements.accessCard.hidden = false;
    waiterElements.accessMessage.textContent = "No fue posible activar la invitacion. Revisa la conexion e intentalo nuevamente.";
    waiterSetStatus("Error de autorizacion", "error");
    console.error(claimResult.error);
    return;
  }
  const { data, error } = await waiterClient.rpc("get_my_restaurant_station", {
    p_restaurant_user_id: waiterStoreId,
  });
  if (error) {
    waiterElements.authCard.hidden = true;
    waiterElements.app.hidden = true;
    waiterElements.stationBoard.hidden = true;
    waiterElements.accessCard.hidden = false;
    waiterElements.accessMessage.textContent = "No se pudo verificar el acceso. El propietario debe ejecutar la migracion V71 en Supabase.";
    waiterSetStatus("Configuracion pendiente", "error");
    return;
  }
  waiterMembership = Array.isArray(data) ? data[0] : data;
  const validStations = [
    "waiter", "cashier", "manager", "kitchen", "grill", "drinks",
    "fast_food", "starters", "salads", "packing", "dispatch"
  ];
  if (!waiterMembership || !validStations.includes(waiterMembership.station)) {
    waiterElements.authCard.hidden = true;
    waiterElements.app.hidden = true;
    waiterElements.stationBoard.hidden = true;
    waiterElements.accessCard.hidden = false;
    waiterElements.accessMessage.textContent = `La cuenta ${waiterUser.email || "actual"} inicio sesion, pero la invitacion aun no esta activa. Pide al propietario que pulse Confirmar autorizacion y despues pulsa Activar autorizacion aqui.`;
    waiterSetStatus("Sin autorizacion", "error");
    return;
  }
  waiterElements.authCard.hidden = true;
  waiterElements.accessCard.hidden = true;
  waiterElements.signOutButton.hidden = false;
  waiterElements.shiftBar.hidden = false;
  const stationLabel = waiterStationLabel(waiterMembership.station);
  const restaurantName = waiterMembership.business_name || "Restaurante";
  waiterElements.restaurantName.textContent = `${restaurantName} / ${stationLabel}`;
  const logo = String(waiterMembership.logo_url || "").trim();
  waiterElements.logo.src = logo;
  waiterElements.logo.hidden = !logo;
  const canTakeOrders = ["waiter", "cashier", "manager"].includes(waiterMembership.station);
  waiterElements.app.hidden = !canTakeOrders;
  waiterElements.stationBoard.hidden = canTakeOrders;
  if (canTakeOrders) {
    waiterElements.serverLabel.textContent = waiterMembership.display_name || waiterUser.email?.split("@")[0] || stationLabel;
    waiterLoadDraft();
    await waiterLoadMenu();
    await waiterLoadSentOrders();
    await waiterSyncQueue();
  } else {
    waiterElements.stationEyebrow.textContent = stationLabel;
    waiterElements.stationTitle.textContent = `${restaurantName} / Pedidos activos`;
    waiterElements.stationHelp.textContent = {
      kitchen: "Prepara los productos y marca el pedido listo para empaque.",
      grill: "Prepara los productos de parrilla y marcalos listos.",
      drinks: "Prepara las bebidas y marcalas listas.",
      fast_food: "Prepara los productos de comidas rapidas y marcalos listos.",
      starters: "Prepara las entradas y marcalas listas.",
      salads: "Prepara las ensaladas y marcalas listas.",
      packing: "Revisa el pedido completo y confirma cuando quede empacado.",
      dispatch: "Confirma la salida y la entrega del pedido.",
    }[waiterMembership.station] || "Actualiza el estado operativo del pedido.";
    await waiterLoadStationOrders();
  }
  await waiterLoadShiftStatus();
  waiterStartRealtime();
}

async function waiterActivateAuthorization() {
  waiterElements.retryAccessButton.disabled = true;
  waiterElements.retryAccessButton.textContent = "Activando...";
  try {
    await waiterAuthorize();
    if (waiterMembership?.active) waiterShowToast("Autorizacion confirmada. Bienvenido a tu estacion.");
  } finally {
    waiterElements.retryAccessButton.disabled = false;
    waiterElements.retryAccessButton.textContent = "Activar autorizacion";
  }
}

async function waiterSignIn(event) {
  event.preventDefault();
  const email = waiterElements.email.value.trim();
  const password = waiterElements.password.value;
  if (!email || !password) return;
  waiterSetMessage(waiterElements.authMessage, "Iniciando sesion...");
  const { error } = await waiterClient.auth.signInWithPassword({ email, password });
  if (error) {
    waiterSetMessage(waiterElements.authMessage, /invalid login/i.test(error.message) ? "Correo o contrasena incorrectos." : error.message, "error");
  }
}

async function waiterSignUp() {
  const email = waiterElements.email.value.trim();
  const password = waiterElements.password.value;
  if (!email || password.length < 6) {
    waiterSetMessage(waiterElements.authMessage, "Escribe correo y una contrasena de minimo 6 caracteres.", "error");
    return;
  }
  const redirectTo = new URL("mesero.html", window.location.href);
  redirectTo.searchParams.set("store", waiterStoreId);
  const { data, error } = await waiterClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo.href, data: { requested_role: "restaurant_employee" } },
  });
  if (error) {
    waiterSetMessage(waiterElements.authMessage, error.message, "error");
    return;
  }
  if (data.session) {
    waiterSetMessage(waiterElements.authMessage, "Cuenta creada. Verificando la autorizacion del restaurante...", "ok");
    waiterUser = data.user;
    await waiterAuthorize();
  } else {
    waiterSetMessage(waiterElements.authMessage, "Cuenta creada. Revisa tu correo y confirma la cuenta. La autorizacion pendiente se activara al iniciar sesion.", "ok");
  }
}

async function waiterSignOut() {
  waiterStopRealtime();
  try {
    await waiterClient.auth.signOut({ scope: "local" });
  } finally {
    waiterUser = null;
    waiterMembership = null;
    window.location.replace("index.html?app=v85");
  }
}

function waiterRenderLoggedOut() {
  waiterMembership = null;
  waiterElements.authCard.hidden = false;
  waiterElements.accessCard.hidden = true;
  waiterElements.app.hidden = true;
  waiterElements.stationBoard.hidden = true;
  waiterElements.shiftBar.hidden = true;
  waiterElements.signOutButton.hidden = true;
  waiterSetStatus("Inicia sesion", "");
}

function waiterSelectView(view) {
  document.querySelectorAll("[data-waiter-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.waiterView === view));
  document.querySelectorAll("[data-waiter-panel]").forEach((panel) => panel.classList.toggle("is-mobile-active", panel.dataset.waiterPanel === view));
}

async function waiterInitialize() {
  if (!waiterStoreId) {
    waiterElements.authCard.hidden = true;
    waiterElements.stationBoard.hidden = true;
    waiterElements.accessCard.hidden = false;
    waiterElements.accessMessage.textContent = "Este enlace no identifica un restaurante. Pide al propietario el enlace de meseros.";
    waiterSetStatus("Enlace incompleto", "error");
    return;
  }
  const config = waiterConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    waiterElements.authCard.hidden = true;
    waiterElements.stationBoard.hidden = true;
    waiterElements.accessCard.hidden = false;
    waiterElements.accessMessage.textContent = "Supabase no esta configurado o no pudo cargar.";
    waiterSetStatus("Sin conexion", "error");
    return;
  }
  waiterClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "rc-ordera-waiter-auth",
    },
  });
  const { data, error } = await waiterClient.auth.getSession();
  if (error) throw error;
  waiterUser = data.session?.user || null;
  if (waiterUser) await waiterAuthorize();
  else waiterRenderLoggedOut();

  waiterClient.auth.onAuthStateChange(async (_event, session) => {
    waiterUser = session?.user || null;
    if (waiterUser) await waiterAuthorize();
    else waiterRenderLoggedOut();
  });
}

waiterElements.authForm.addEventListener("submit", waiterSignIn);
waiterElements.signUpButton.addEventListener("click", waiterSignUp);
waiterElements.signOutButton.addEventListener("click", waiterSignOut);
waiterElements.retryAccessButton.addEventListener("click", waiterActivateAuthorization);
waiterElements.refreshButton.addEventListener("click", () => waiterLoadMenu().catch((error) => waiterSetMessage(waiterElements.orderMessage, error.message, "error")));
waiterElements.refreshSentButton.addEventListener("click", waiterLoadSentOrders);
waiterElements.dailyCloseButton.addEventListener("click", waiterCloseDay);
waiterElements.monthlyCloseButton?.addEventListener("click", waiterCloseMonth);
waiterElements.monthInput?.addEventListener("change", waiterLoadMonthlyReport);
waiterElements.shiftButton.addEventListener("click", waiterToggleShift);
waiterElements.stationRefreshButton.addEventListener("click", waiterLoadStationOrders);
waiterElements.stationOrders.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-next-status]");
  const card = event.target.closest("[data-order-id]");
  if (button && card) waiterAdvanceStationOrder(card.dataset.orderId, button.dataset.nextStatus, button);
});
waiterElements.waiterCustomItemForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  waiterAddCustomItem();
});
waiterElements.searchInput.addEventListener("input", waiterRenderMenu);
waiterElements.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  waiterActiveCategory = button.dataset.category;
  waiterElements.searchInput.value = "";
  waiterRenderCategories();
  waiterRenderMenu();
});
waiterElements.menuGrid.addEventListener(
  "click",
  (event) => {

    const productElement =
      event.target.closest("[data-product-id]");

    if (!productElement) return;


    const card =
      productElement.closest(
        ".waiter-product-card"
      ) || productElement;


    if (
      card.dataset.productAvailable === "false"
    ) {
      waiterShowToast(
        "Este producto está agotado."
      );

      return;
    }


    event.preventDefault();


    waiterAddProduct(
      productElement.dataset.productId ||
        card.dataset.productId,

      productElement.dataset.category ||
        card.dataset.category
    );

  }
);
waiterElements.menuGrid.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }


    const card =
      event.target.closest(
        ".waiter-product-card[data-product-id]"
      );

    if (!card) return;

    if (
      card.dataset.productAvailable === "false"
    ) {
      return;
    }


    event.preventDefault();


    waiterAddProduct(
      card.dataset.productId,
      card.dataset.category
    );

  }
);
waiterElements.cart.addEventListener(
  "click",
  (event) => {

    const actionButton =
      event.target.closest(
        'button[data-action="plus"], ' +
        'button[data-action="minus"], ' +
        'button[data-action="remove"]'
      );

    /*
     * Si el clic fue en el textarea de notas,
     * en el nombre del producto o en cualquier
     * otro elemento, no hacemos nada.
     */
    if (!actionButton) {
      return;
    }

    const card =
      actionButton.closest("[data-cart-id]");

    if (!card) {
      return;
    }

    const item =
      waiterCart.find(
        (entry) =>
          String(entry.cartId) ===
          String(card.dataset.cartId)
      );

    if (!item) {
      return;
    }

    const action =
      actionButton.dataset.action;

    if (action === "plus") {

      item.qty =
        Math.max(
          1,
          Number(item.qty) || 1
        ) + 1;

    }

    if (action === "minus") {

      item.qty =
        Math.max(
          1,
          (Number(item.qty) || 1) - 1
        );

    }

    if (action === "remove") {

      waiterCart =
        waiterCart.filter(
          (entry) =>
            String(entry.cartId) !==
            String(item.cartId)
        );

    }

    waiterRenderCart();
    waiterSaveDraft();

  }
);
waiterElements.cart.addEventListener(
  "input",
  (event) => {

    const target = event.target;

    if (
      !target ||
      target.dataset.action !== "note"
    ) {
      return;
    }


    const card =
      target.closest("[data-cart-id]");

    if (!card) return;


    const item =
      waiterCart.find(
        (entry) =>
          String(entry.cartId) ===
          String(card.dataset.cartId)
      );

    if (!item) return;


    const cursorStart =
      target.selectionStart;

    const cursorEnd =
      target.selectionEnd;


    item.note =
      String(target.value || "")
        .toUpperCase();


    if (target.value !== item.note) {
      target.value = item.note;
    }


    try {

      if (
        Number.isInteger(cursorStart) &&
        Number.isInteger(cursorEnd)
      ) {

        target.setSelectionRange(
          cursorStart,
          cursorEnd
        );

      }

    } catch {
      // Algunos navegadores móviles no permiten
      // restaurar la posición del cursor.
    }


    waiterSaveDraft();

  }
);
waiterElements.notes.addEventListener("input", () => {
  const start = waiterElements.notes.selectionStart;
  waiterElements.notes.value = waiterElements.notes.value.toUpperCase();
  waiterElements.notes.setSelectionRange(start, start);
  waiterSaveDraft();
});
[waiterElements.tableInput, waiterElements.customerInput, waiterElements.orderType, waiterElements.paymentMethod].forEach((element) => element.addEventListener("input", waiterSaveDraft));
waiterElements.clearButton.addEventListener("click", () => {
  if (!waiterCart.length || confirm("Limpiar el pedido actual?")) waiterClearDraft();
});
waiterElements.sendButton.addEventListener("click", waiterSendOrder);
document.querySelectorAll("[data-waiter-view]").forEach((button) => button.addEventListener("click", () => waiterSelectView(button.dataset.waiterView)));
window.addEventListener("online", () => {
  waiterSetStatus("Reconectando...");
  const canTakeOrders = ["waiter", "cashier", "manager"].includes(waiterMembership?.station);
  if (canTakeOrders) waiterSyncQueue().then(() => waiterLoadMenu()).catch(console.error);
  else waiterLoadStationOrders().catch(console.error);
});
window.addEventListener("offline", () => waiterSetStatus("Sin internet", "offline"));
window.addEventListener("beforeunload", waiterSaveDraft);
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(() => {});

waiterSelectView("menu");
waiterInitialize().catch((error) => {
  console.error(error);
  waiterElements.authCard.hidden = true;
  waiterElements.stationBoard.hidden = true;
  waiterElements.accessCard.hidden = false;
  waiterElements.accessMessage.textContent = "No fue posible iniciar la estacion. Revisa internet y la configuracion de Supabase.";
  waiterSetStatus("Error de conexion", "error");
});
