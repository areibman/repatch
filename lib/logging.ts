type LogPayload = Record<string, unknown>;

function emitStructuredLog(
  namespace: string,
  event: string,
  payload: LogPayload = {}
) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  if (process.env.NODE_ENV === "production") {
    console.info(`[${namespace}]`, JSON.stringify(entry));
    return;
  }

  console.info(`[${namespace}]`, entry);
}

export function logAudit(event: string, payload: LogPayload) {
  emitStructuredLog("audit", event, payload);
}

export function logAuthEvent(event: string, payload: LogPayload = {}) {
  emitStructuredLog("auth", event, payload);
}

