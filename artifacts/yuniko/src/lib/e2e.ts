const DB="yuniko-e2e",STORE="identity";
type I={deviceId:string;publicKey:string;privateKey:CryptoKeyPair};
type DeviceTarget={deviceId:string;publicKey:string};
function enc(a:ArrayBuffer|Uint8Array){let s="";for(const b of new Uint8Array(a))s+=String.fromCharCode(b);return btoa(s)}function dec(s:string){const x=atob(s),a=new Uint8Array(x.length);for(let i=0;i<x.length;i++)a[i]=x.charCodeAt(i);return a}
function open(){return new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
export async function deviceInfo(){const d=await open();const old=await new Promise<I|null>((ok,no)=>{const r=d.transaction(STORE,"readonly").objectStore(STORE).get("me");r.onsuccess=()=>ok(r.result??null);r.onerror=()=>no(r.error)});if(old)return old;const k=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveKey"]),v={deviceId:crypto.randomUUID(),publicKey:JSON.stringify(await crypto.subtle.exportKey("jwk",k.publicKey)),privateKey:k};await new Promise<void>((ok,no)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).put(v,"me");t.oncomplete=()=>ok();t.onerror=()=>no(t.error)});return v}
async function key(other:string){const i=await deviceInfo(),p=await crypto.subtle.importKey("jwk",JSON.parse(other),{name:"ECDH",namedCurve:"P-256"},false,[]);return crypto.subtle.deriveKey({name:"ECDH",public:p},i.privateKey.privateKey,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
export async function encryptForPublicKey(other:string,text:string){const k=await key(other),iv=crypto.getRandomValues(new Uint8Array(12)),c=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(text));return "enc1."+enc(iv)+"."+enc(c)}
export async function encryptForDevices(targets:DeviceTarget[],text:string){
  const me=await deviceInfo();
  const unique=Array.from(new Map(targets.filter(t=>t?.deviceId&&t?.publicKey).map(t=>[t.deviceId,t])).values());
  if(!unique.length)throw new Error("No encryption devices available");
  const items=await Promise.all(unique.map(async target=>({deviceId:target.deviceId,ciphertext:await encryptForPublicKey(target.publicKey,text)})));
  return "enc2."+enc(new TextEncoder().encode(JSON.stringify({v:2,senderDeviceId:me.deviceId,senderPublicKey:me.publicKey,items})));
}
export async function decryptFromPublicKey(other:string|string[]|null|undefined,text:string){
  if(!text.startsWith("enc1.")&&!text.startsWith("enc2."))return text;
  if(text.startsWith("enc2.")){
    const raw=new TextDecoder().decode(dec(text.slice(5)));
    const envelope=JSON.parse(raw) as {v?:number;senderPublicKey?:string;items?:{deviceId:string;ciphertext:string}[]};
    if(envelope.v!==2||!envelope.senderPublicKey||!Array.isArray(envelope.items))throw new Error("Invalid encrypted message");
    const me=await deviceInfo(),item=envelope.items.find(entry=>entry.deviceId===me.deviceId);
    if(!item)throw new Error("Message is not addressed to this device");
    return decryptFromPublicKey(envelope.senderPublicKey,item.ciphertext);
  }
  const candidates=(Array.isArray(other)?other:[other]).filter((value):value is string=>Boolean(value));
  let lastError:unknown=null;
  for(const candidate of candidates){
    try{
      const p=text.split(".");
      if(p.length!==3)throw new Error("Invalid encrypted message");
      const k=await key(candidate),v=await crypto.subtle.decrypt({name:"AES-GCM",iv:dec(p[1])},k,dec(p[2]));
      return new TextDecoder().decode(v);
    }catch(error){lastError=error}
  }
  throw lastError instanceof Error?lastError:new Error("Unable to decrypt message");
}