/** Cliente HTTP de la pasarela fiscal. Solo conoce el token del dispositivo, nunca la service_role key. */
export class GatewayError extends Error {
  constructor(code, status) { super(code); this.name = "GatewayError"; this.code = code; this.status = status; }
}

export function createGatewayClient({ url, deviceId, deviceToken, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
    throw new GatewayError("INSECURE_GATEWAY_URL", 0);
  }
  async function call(payload) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${deviceToken}`, "x-device-id": deviceId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data = {};
    try { data = await res.json(); } catch { /* cuerpo vacío */ }
    if (!res.ok) throw new GatewayError(data?.error ?? "GATEWAY_ERROR", res.status);
    return data;
  }
  return {
    async claim(claimToken) {
      try { return (await call({ action: "claim", claimToken })).operation ?? null; }
      catch (e) { if (e instanceof GatewayError && e.status === 409) return null; throw e; }
    },
    sending: (operationId, claimToken) => call({ action: "sending", operationId, claimToken }),
    result: (operationId, claimToken, outcome, result) => call({ action: "result", operationId, claimToken, outcome, result }),
  };
}
