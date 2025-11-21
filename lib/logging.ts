export function logAudit(event: string, payload: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.info("[audit]", JSON.stringify(entry));
}

export function maskEmail(email?: string | null) {
  if (!email) {
    return "unknown";
  }

  const [localPart, domain] = email.split("@");
  if (!domain) {
    return "unknown";
  }

  if (!localPart || localPart.length <= 2) {
    return `${localPart ?? ""}*@${domain}`;
  }

  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}***${last}@${domain}`;
}

