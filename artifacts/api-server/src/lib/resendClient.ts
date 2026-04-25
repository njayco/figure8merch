// Resend client (Replit connector). See `resend` integration blueprint.
import { Resend } from "resend";

interface ResendConnectionSettings {
  api_key?: string;
  from_email?: string;
}

interface ResendConnectionItem {
  settings: ResendConnectionSettings;
}

let cachedConnection: ResendConnectionItem | null = null;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }
  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME not set");
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const data = (await res.json()) as { items?: ResendConnectionItem[] };
  const item = data.items?.[0];
  if (!item || !item.settings.api_key || !item.settings.from_email) {
    throw new Error("Resend not connected");
  }
  cachedConnection = item;
  return { apiKey: item.settings.api_key, fromEmail: item.settings.from_email };
}

// Always fetch a fresh client; tokens may rotate.
export async function getUncachableResendClient(): Promise<{
  client: Resend;
  fromEmail: string;
}> {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export function isResendConfigured(): boolean {
  // Cheap synchronous check used to avoid spamming logs in tests/dev.
  return Boolean(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
      (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL),
  );
}

export function getCachedFromEmail(): string | null {
  return cachedConnection?.settings.from_email ?? null;
}
