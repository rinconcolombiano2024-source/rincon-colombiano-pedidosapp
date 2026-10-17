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
      // Only the gateway's final successful claim may release work to a device.
      // A contradictory error body must never trigger printing or masquerade as idle.
      if (res.status !== 200 || Object.hasOwn(data, "error") ||
        (Object.hasOwn(data, "ok") && data.ok !== true) ||
        !Object.hasOwn(data, "operation") || (data.operation !== null &&
        (typeof data.operation !== "object" || Array.isArray(data.operation))))
        throw new GatewayError("INVALID_GATEWAY_RESPONSE", res.status);
    } else if (data.ok !== true || Object.hasOwn(data, "error")) {
      throw new GatewayError("INVALID_GATEWAY_ACK", res.status);
    }
    return data;
  }
  return {
    async claim(claimToken) {
      // A successful 200 response with operation:null is the ONLY idle signal.
      // HTTP 409 is also returned for CLAIM_FAILED and PAYLOAD_TENANT_MISMATCH:
      // suppressing it as idle would hide fiscal server failures indefinitely.
      const { operation } = await call({ action: "claim", claimToken });
      if (operation === null) return null;
      const id = operation.operation_id ?? operation.operationId;
      if ((Object.hasOwn(operation, "operation_id") && Object.hasOwn(operation, "operationId") && operation.operation_id !== operation.operationId) ||
        typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
        !operation.fiscal_payload || typeof operation.fiscal_payload !== "object" || Array.isArray(operation.fiscal_payload)) {
        throw new GatewayError("INVALID_CLAIM_OPERATION", 200);
      }
      return operation;
    },
    sending: (operationId, claimToken) => call({ action: "sending", operationId, claimToken }),
    result: (operationId, claimToken, outcome, result) => call({ action: "result", operationId, claimToken, outcome, result }),
  };
}
