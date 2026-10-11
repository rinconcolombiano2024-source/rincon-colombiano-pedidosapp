/** Cliente HTTP de la pasarela fiscal. Solo conoce el token del dispositivo, nunca la service_role key. */
export class GatewayError extends Error {
  constructor(code, status) { super(code); this.name = "GatewayError"; this.code = code; this.status = status; }
}

export function createGatewayClient({ url, deviceId, deviceToken, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  let target;
  try { target = new URL(url); } catch { throw new GatewayError("INSECURE_GATEWAY_URL", 0); }
  if (target.username || target.password || target.hash
    || !(target.protocol === "https:" || (target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname)))) {
    throw new GatewayError("INSECURE_GATEWAY_URL", 0);
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || typeof fetchImpl !== "function")
    throw new GatewayError("INVALID_GATEWAY_CONFIG", 0);
  async function call(payload) {
    const res = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${deviceToken}`, "x-device-id": deviceId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data;
    try { data = await res.json(); } catch { throw new GatewayError("INVALID_GATEWAY_RESPONSE", res.status); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new GatewayError("INVALID_GATEWAY_RESPONSE", res.status);
    if (!res.ok) throw new GatewayError(data?.error ?? "GATEWAY_ERROR", res.status);
    if (payload.action === "claim") {
      if (!Object.hasOwn(data, "operation") || (data.operation !== null &&
        (typeof data.operation !== "object" || Array.isArray(data.operation))))
        throw new GatewayError("INVALID_GATEWAY_RESPONSE", res.status);
    } else if (data.ok !== true || Object.hasOwn(data, "error")) {
      throw new GatewayError("INVALID_GATEWAY_ACK", res.status);
    }
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
