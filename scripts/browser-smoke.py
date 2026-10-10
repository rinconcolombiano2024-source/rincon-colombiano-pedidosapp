#!/usr/bin/env python3
"""Humo en navegador real (Chromium/Playwright): carga cada página con las cabeceras de vercel.json
y falla si hay excepciones JS no controladas, violaciones de CSP activa o archivos internos servibles.
Uso: python3 scripts/browser-smoke.py [--langs es,en,pl]"""
import json, sys, threading, fnmatch, os, re, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VERCEL = json.load(open(os.path.join(ROOT, "vercel.json")))
IGNORE = [l.strip() for l in open(os.path.join(ROOT, ".vercelignore")) if l.strip() and not l.startswith("#")]
PAGES = ["index.html", "cliente.html", "restaurante.html", "colaborador.html", "mesero.html", "admin.html", "portal.html", "centro-integraciones.html"]
LANGS = (sys.argv[sys.argv.index("--langs") + 1] if "--langs" in sys.argv else "es,en,pl").split(",")

def ignored(path):
    p = path.lstrip("/")
    ok = False
    for pat in IGNORE:
        neg = pat.startswith("!"); pat = pat.lstrip("!")
        hit = fnmatch.fnmatch(p, pat) or fnmatch.fnmatch(os.path.basename(p), pat) or (pat.endswith("/") and p.startswith(pat))
        if hit: ok = not neg
    return ok

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        path = self.path.split("?")[0]
        if ignored(path) and path != "/":
            self.send_error(404); return None
        return super().send_head()
    def end_headers(self):
        for rule in VERCEL["headers"]:
            if rule["source"] == "/(.*)" or (rule["source"] == "/(.*).html" and self.path.split("?")[0].endswith(".html")):
                for h in rule["headers"]: self.send_header(h["key"], h["value"])
        super().end_headers()

srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(H, directory=ROOT))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{port}"
failures, notes = [], []

with sync_playwright() as p:
    b = p.chromium.launch(**({"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}))
    # 1) archivos internos NO deben ser servibles
    ctx = b.new_context(); page = ctx.new_page()
    for f in ["supabase-schema.sql", "GUIA-ACCESO-ADMIN-V70.txt", "MIGRACION-V5-20261010-01-FISCAL-AGENT-RESULT.sql", "SECURITY.md", "package.json", "package-lock.json", "BUILD-METADATA.json", "fiscal-agent/src/agent.mjs", "supabase/config.toml", "tests/shared/shared-helpers.test.mjs"]:
        r = page.request.get(f"{base}/{f}")
        if r.status != 404:
            failures.append(f"SERVIBLE (debería ser 404): /{f} -> {r.status}")
    ctx.close()
    # 2) cada página, cada idioma
    for lang in LANGS:
        for pg in PAGES:
            ctx = b.new_context(viewport={"width": 390, "height": 844}, locale=lang)
            ctx.add_init_script("try{for(const k of ['rincon_colombiano_customer_language','rincon_colombiano_app_language']){localStorage.setItem(k,%s)}}catch(e){}" % json.dumps(lang))
            page = ctx.new_page()
            errs, csp = [], []
            page.on("pageerror", lambda e, errs=errs: errs.append(str(e)[:200]))
            def on_console(m, csp=csp):
                t = m.text
                if "Content Security Policy" in t or "Content-Security-Policy" in t: csp.append(t[:220])
            page.on("console", on_console)
            # sin internet: las peticiones externas se cortan (los fallos de red son esperables)
            page.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
            resp = page.goto(f"{base}/{pg}", wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            if resp.status != 200: failures.append(f"[{lang}] {pg}: HTTP {resp.status}")
            body = page.inner_text("body") if page.query_selector("body") else ""
            if len(body.strip()) < 20: failures.append(f"[{lang}] {pg}: página vacía")
            for e in errs: failures.append(f"[{lang}] {pg}: excepción JS: {e}")
            real_csp = [c for c in csp if "Report-Only" not in c and "report-only" not in c.lower() and "[Report Only]" not in c]
            for c in real_csp: failures.append(f"[{lang}] {pg}: CSP ACTIVA bloquea: {c}")
            for c in csp:
                if c not in real_csp: notes.append(f"[{lang}] {pg}: CSP Report-Only: {c[:160]}")
            ctx.close()
    # 3) CSP: el script inline AUTORIZADO por hash corre; uno NO autorizado queda bloqueado
    enforced = next(h["value"] for r in VERCEL["headers"] for h in r["headers"] if h["key"] == "Content-Security-Policy")
    ctx = b.new_context(); page = ctx.new_page()
    blocked = []
    page.on("console", lambda m: blocked.append(m.text) if "Content Security Policy" in m.text else None)
    page.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
    page.goto(f"{base}/centro-integraciones.html", wait_until="domcontentloaded"); page.wait_for_timeout(1200)
    cards = page.locator("#provider-list article").count()
    if cards != 5 or blocked:
        failures.append(f"CSP: el script inline autorizado por hash NO se ejecutó correctamente (tarjetas={cards}, violaciones={len(blocked)})")
    page2 = ctx.new_page(); viol = []
    page2.on("console", lambda m: viol.append(m.text) if "Content Security Policy" in m.text else None)
    page2.route("http://csp.test/x", lambda r: r.fulfill(status=200, content_type="text/html",
        headers={"Content-Security-Policy": enforced}, body="<html><body><script>window.__pwned=1</script><p id=ok>ok</p></body></html>"))
    page2.goto("http://csp.test/x"); page2.wait_for_timeout(500)
    if page2.evaluate("window.__pwned === 1"): failures.append("CSP: un script inline NO autorizado SE EJECUTÓ (la CSP no protege)")
    if not any("inline" in v.lower() for v in viol): failures.append("CSP: no se registró la violación esperada del script inline no autorizado")
    ctx.close()
    notes.append("CSP verificada: hash autorizado ejecuta; inline no autorizado bloqueado")
    b.close()

print(f"Páginas x idiomas: {len(PAGES)} x {len(LANGS)}")
for n in sorted(set(notes))[:15]: print("NOTA   ", n)
if failures:
    for f in failures: print("FALLO  ", f)
    sys.exit(1)
print("browser-smoke: OK")
