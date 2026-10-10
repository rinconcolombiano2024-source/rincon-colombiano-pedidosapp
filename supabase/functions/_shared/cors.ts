// CORS con lista de orígenes permitidos en lugar de "*".
// Configurable con el secreto RC_ALLOWED_ORIGINS (lista separada por comas).
// Las peticiones sin cabecera Origin (servidor a servidor, webhooks) pasan sin cambios.

const DEFAULT_ORIGINS = [
  "https://rincon-colombiano-pedidosapp.vercel.app",
  "https://localhost", // app Android (Capacitor, androidScheme=https)
  "capacitor://localhost", // app iOS (Capacitor)
];

type EnvGetter = (name: string) => string | undefined;

function defaultEnv(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno;
  return d?.env.get(name);
}

export function allowedOrigins(env: EnvGetter = defaultEnv): Set<string> {
  const out = new Set<string>(DEFAULT_ORIGINS);
  for (const raw of String(env("RC_ALLOWED_ORIGINS") ?? "").split(",")) {
    const v = raw.trim().replace(/\/+$/, "");
    if (v) out.add(v);
  }
  if (env("RC_ALLOW_LOCALHOST_DEV") === "1") {
    out.add("http://localhost:3000");
    out.add("http://localhost:5173");
    out.add("http://127.0.0.1:3000");
  }
  return out;
}

export function withCors(
  handler: (request: Request) => Response | Promise<Response>,
  env: EnvGetter = defaultEnv,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const allowed = origin ? allowedOrigins(env).has(origin) : false;

    if (origin && !allowed) {
      return new Response(null, { status: 403 });
    }

    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.delete("access-control-allow-origin");
    if (origin && allowed) {
      headers.set("access-control-allow-origin", origin);
      headers.append("vary", "Origin");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
