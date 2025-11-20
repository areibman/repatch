export function logAudit(event: string, payload: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.info("[audit]", JSON.stringify(entry));
}

