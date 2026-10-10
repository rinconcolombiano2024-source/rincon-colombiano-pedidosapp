#!/usr/bin/env python3
"""Prueba en Chromium real del IVA por plato y por restaurante (editor de menú de restaurante.html).
Sin red ni sesión: ejerce el editor local. Verifica guardado, persistencia tras recarga, 'heredar' (sin clave),
carga en el formulario, ajuste por defecto e idiomas."""
import re, sys, json, threading, socketserver, http.server, functools, os
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(H, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
fails = []
def check(name, cond, detail=""):
    print(("OK    " if cond else "FALLO ") + name + (f" — {detail}" if detail and not cond else ""))
    if not cond: fails.append(name)

def new_page(b, lang="es"):
    c = b.new_context(viewport={"width": 1280, "height": 900})
    c.add_init_script(f"try{{localStorage.setItem('rincon_colombiano_app_language','{lang}')}}catch(e){{}}")
    pg = c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    pg.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    return c, pg, errs

SAVE = """async ({name, price, vat}) => {
  menuCatalog["Platos"] = menuCatalog["Platos"] || []; activeCategory = "Platos";
  openMenuEditor(); renderMenuEditor();
  elements.productCategorySelect.value = "Platos";
  elements.productNameInput.value = name; elements.productPriceInput.value = price;
  elements.productVatSelect.value = vat;
  await saveProduct();
}"""

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}))
    c, pg, errs = new_page(b)
    pg.goto(base + "/restaurante.html", wait_until="domcontentloaded"); pg.wait_for_timeout(2000)
    check("helper normalizeVatRate: A/VAT_8/'8 %'/19/vacío", pg.evaluate("[normalizeVatRate('A'),normalizeVatRate('VAT_8'),normalizeVatRate('8 %'),normalizeVatRate('19'),normalizeVatRate(''),normalizeVatRate(null),normalizeVatRate('zw')]") == ["", "8", "8", "", "", "", "ZW"])
    for prod in [("Bandeja paisa", "45.00", "8"), ("Gaseosa", "9.00", ""), ("Servicio exento", "5.00", "ZW"), ("Cerveza", "14.00", "23")]:
        pg.evaluate(SAVE, {"name": prod[0], "price": prod[1], "vat": prod[2]}); pg.wait_for_timeout(300)
    items = pg.evaluate("menuCatalog['Platos']")
    by = {i["name"]: i for i in items}
    check("se guardaron 4 productos", len(items) == 4, str(len(items)))
    check("IVA 8 % guardado como string '8'", by.get("Bandeja paisa", {}).get("vatRate") == "8")
    check("'Heredar' NO escribe la clave vatRate (para que el servidor use el valor por defecto)", "vatRate" not in by.get("Gaseosa", {"vatRate": 1}))
    check("exento guardado como 'ZW' y 23 % como '23'", by.get("Servicio exento", {}).get("vatRate") == "ZW" and by.get("Cerveza", {}).get("vatRate") == "23")
    persisted = pg.evaluate("Object.values(localStorage).some(v => v.includes('\"vatRate\":\"8\"'))")
    check("el IVA llegó al almacenamiento persistente", persisted)
    # edición: el formulario carga el IVA
    idx = [i["name"] for i in pg.evaluate("menuCatalog['Platos']")].index("Bandeja paisa")
    pg.evaluate(f"(()=>{{ activeCategory='Platos'; editProduct({idx}); }})()")
    check("al editar, el selector muestra la tasa guardada", pg.evaluate("elements.productVatSelect.value") == "8")
    # recarga: la carga del menú no descarta vatRate
    pg.reload(wait_until="domcontentloaded"); pg.wait_for_timeout(2000)
    # Sin sesión la app arranca con menuCatalog vacío (comportamiento previo, también sin IVA); se ejerce el lector local real.
    after = {i["name"]: i for i in pg.evaluate("Object.values(readMenuCatalog()).flat()")}
    check("tras recargar, el IVA sobrevive al normalizador de carga", after.get("Bandeja paisa", {}).get("vatRate") == "8" and after.get("Servicio exento", {}).get("vatRate") == "ZW")
    check("tras recargar, 'heredar' sigue sin clave", "vatRate" not in after.get("Gaseosa", {"vatRate": 1}))
    # IVA por defecto del restaurante
    pg.evaluate("openMenuEditor()"); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{ const s=elements.restaurantDefaultVatSelect; s.value='23'; s.dispatchEvent(new Event('change',{bubbles:true})); })()"); pg.wait_for_timeout(600)
    check("IVA por defecto: se guarda y va en el payload de ajustes (defaultVatRate)", pg.evaluate("localStorage.getItem('rc_ordera_default_vat_rate')") == "23" and pg.evaluate("currentSettingsPayload().defaultVatRate") == "23")
    pg.reload(wait_until="domcontentloaded"); pg.wait_for_timeout(1800); pg.evaluate("openMenuEditor()"); pg.wait_for_timeout(300)
    check("IVA por defecto sobrevive a la recarga y se muestra", pg.evaluate("elements.restaurantDefaultVatSelect.value") == "23")
    check("sin errores JS en español", not errs, str(errs[:2]))
    c.close()
    # idiomas
    exp = {"pl": ("Stawka VAT produktu", "Domyślna stawka VAT restauracji"), "en": ("Product VAT rate", "Restaurant default VAT rate"), "es": ("IVA del producto", "IVA por defecto del restaurante")}
    for lang, (a, b2) in exp.items():
        c, pg, errs = new_page(b, lang)
        pg.goto(base + "/restaurante.html", wait_until="domcontentloaded"); pg.wait_for_timeout(2200); pg.evaluate("openMenuEditor()"); pg.wait_for_timeout(500)
        t1 = pg.evaluate("elements.productVatSelect.closest('label').innerText"); t2 = pg.evaluate("elements.restaurantDefaultVatSelect.closest('label').innerText")
        check(f"[{lang}] etiquetas traducidas", a in t1 and b2 in t2, f"{t1!r} / {t2!r}")
        check(f"[{lang}] sin errores JS", not errs, str(errs[:2]))
        c.close()
    b.close()
print("\nbrowser-menu-vat:", "FALLÓ" if fails else "OK"); sys.exit(1 if fails else 0)
