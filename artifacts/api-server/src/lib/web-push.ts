import { env as cloudflareEnv } from "cloudflare:workers";
type PushSubscriptionData = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

const runtimeEnv = cloudflareEnv as unknown as Record<string, string | undefined>;
function getEnv(name: string) { return runtimeEnv[name] ?? process.env[name] ?? ""; }

const encoder = new TextEncoder();

function decode(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function encode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function toBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function hkdfInfo(label: string, ...context: Uint8Array[]): Uint8Array {
  return concat(encoder.encode(label), new Uint8Array([0]), ...context);
}
async function hkdfBits(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, bits: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toBuffer(ikm), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt:toBuffer(salt),info:toBuffer(info)}, key, bits));
}
async function encryptPayload(payload: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  if (payload.length > 3993) throw new Error("Push payload too large");
  const clientPublic = decode(p256dh);
  const authSecret = decode(auth);
  if (clientPublic.length !== 65 || clientPublic[0] !== 4) throw new Error("Invalid p256dh key");
  if (authSecret.length < 16) throw new Error("Invalid auth secret");
  const serverKeys = await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"}, true, ["deriveBits"]);
  const clientKey = await crypto.subtle.importKey("raw", toBuffer(clientPublic), {name:"ECDH",namedCurve:"P-256"}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:clientKey}, serverKeys.privateKey, 256));
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const ikm = await hkdfBits(shared, authSecret, hkdfInfo("WebPush: info", clientPublic, serverPublic), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmKey = await crypto.subtle.importKey("raw", toBuffer(ikm), "HKDF", false, ["deriveKey"]);
  const cek = await crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:toBuffer(salt),info:toBuffer(hkdfInfo("Content-Encoding: aes128gcm"))}, ikmKey, {name:"AES-GCM",length:128}, false, ["encrypt"]);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({name:"HKDF",hash:"SHA-256",salt:toBuffer(salt),info:toBuffer(hkdfInfo("Content-Encoding: nonce"))}, ikmKey, 96));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:toBuffer(nonce)}, cek, toBuffer(concat(payload,new Uint8Array([2])))));
  const header = new Uint8Array(86);
  header.set(salt,0);
  new DataView(header.buffer).setUint32(16,4096,false);
  header[20]=65;
  header.set(serverPublic,21);
  return concat(header,ciphertext);
}
async function createVapidJwt(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const url = new URL(endpoint);
  const publicBytes = decode(publicKey);
  const privateBytes = decode(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) throw new Error("Invalid VAPID keys");
  const key = await crypto.subtle.importKey("jwk",{kty:"EC",crv:"P-256",x:encode(publicBytes.slice(1,33)),y:encode(publicBytes.slice(33)),d:encode(privateBytes)},{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const now = Math.floor(Date.now()/1000);
  const segment = (value: unknown) => encode(encoder.encode(JSON.stringify(value)));
  const unsigned = `${segment({typ:"JWT",alg:"ES256"})}.${segment({aud:`${url.protocol}//${url.host}`,exp:now+43200,sub:subject})}`;
  const signature = new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,toBuffer(encoder.encode(unsigned))));
  return `${unsigned}.${encode(signature)}`;
}
async function sendOne(subscription: PushSubscriptionData, payload: PushPayload): Promise<boolean> {
  const publicKey = getEnv("VAPID_PUBLIC_KEY");
  const privateKey = getEnv("VAPID_PRIVATE_KEY");
  const subject = getEnv("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) throw new Error("Push notifications are not configured");
  const encrypted = await encryptPayload(encoder.encode(JSON.stringify(payload)),subscription.keys.p256dh,subscription.keys.auth);
  const jwt = await createVapidJwt(subscription.endpoint,publicKey,privateKey,subject);
  const response = await fetch(subscription.endpoint,{method:"POST",headers:{Authorization:`vapid t=${jwt}, k=${publicKey}`,"Content-Encoding":"aes128gcm","Content-Type":"application/octet-stream",TTL:"86400",Urgency:"high"},body:toBuffer(encrypted)});
  if(response.status===404||response.status===410)return false;
  if(!response.ok)throw new Error(`Push service returned ${response.status}`);
  return true;
}
export async function sendPushToUser(userId:number,payload:PushPayload):Promise<number>{
  let delivered=0;
  const {deleteRows,eq,selectRows}=await import("./supabase");
  const subscriptions=await selectRows("push_subscriptions",{filters:[eq("userId",userId)],limit:100});
  for(const row of subscriptions){
    try{
      const ok=await sendOne({endpoint:String(row.endpoint),keys:{p256dh:String(row.p256dh),auth:String(row.auth)}},payload);
      if(ok)delivered+=1;else await deleteRows("push_subscriptions",[eq("endpoint",String(row.endpoint))]);
    }catch(error){console.error("[YUNIKO PUSH] delivery failed",error);}
  }
  return delivered;
}
