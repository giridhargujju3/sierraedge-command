export interface InviteEmailResult {
  ok?: boolean;
  delivered?: boolean;
  reason?: string;
  error?: string;
}

export function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@gmail\.com$/i.test(normalizeEmail(value));
}

export function createInviteUrl(origin: string, token: string) {
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function getInviteDeliveryMessage(result?: InviteEmailResult | null) {
  if (!result) {
    return "Unable to send invitation email";
  }

  if (result.delivered || result.ok === true) {
    return "";
  }

  if (typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }

  if (typeof result.reason === "string" && result.reason.trim()) {
    return result.reason.trim();
  }

  return "Unable to send invitation email";
}
