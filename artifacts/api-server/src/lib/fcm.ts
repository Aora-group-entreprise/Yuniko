import { env as cloudflareEnv } from "cloudflare:workers";

type FcmPayload = { title: string; body?: string; url?: string; tag?: string };
type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function getEnv(name: string) {
  return runtimeEnv[name] ?? process.env[name] ?? "";
}

function encodeBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64(value: string) {
  const normalized = value.replace(/\s/g, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function pemToDer(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  return decodeBase64(base64);
}

async function getAccessToken(account: ServiceAccount) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = encodeBase64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(account.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  ));
  const assertion = unsigned + "." + encodeBase64Url(signature);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(assertion),
  });
  if (!tokenResponse.ok) throw new Error("FCM OAuth token request failed: " + tokenResponse.status);
  const tokenData = await tokenResponse.json() as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw new Error("FCM OAuth response did not contain an access token");
  cachedAccessToken = {
    value: tokenData.access_token,
    expiresAt: Date.now() + Math.max(60, Number(tokenData.expires_in ?? 3600) - 60) * 1000,
  };
  return tokenData.access_token;
}

export async function sendFcmToUser(userId: number, payload: FcmPayload): Promise<number> {
  const serviceAccountRaw = getEnv("FCM_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountRaw) return 0;

  let account: ServiceAccount;
  try {
    account = JSON.parse(serviceAccountRaw) as ServiceAccount;
  } catch {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("FCM service account is incomplete");
  }

  const { deleteRows, eq, selectRows } = await import("./supabase");
  const tokens = await selectRows("mobile_push_tokens", {
    filters: [eq("userId", userId)],
    limit: 100,
  });
  if (!tokens.length) return 0;

  const accessToken = await getAccessToken(account);
  let delivered = 0;

  for (const row of tokens) {
    const token = String(row.token ?? "");
    if (!token) continue;

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body ?? "",
          },
          data: {
            url: payload.url ?? "/notifications",
            tag: payload.tag ?? "yuniko",
          },
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "yuniko",
              sound: "default",
            },
          },
        },
      }),
    });

    if (response.ok) {
      delivered += 1;
      continue;
    }

    const body = await response.text();
    if (response.status === 404 || response.status === 400 || body.includes("UNREGISTERED") || body.includes("INVALID_ARGUMENT")) {
      await deleteRows("mobile_push_tokens", [eq("token", token)]);
      continue;
    }
    console.error("[YUNIKO PUSH] FCM returned", response.status, body.slice(0, 500));
  }

  return delivered;
}
