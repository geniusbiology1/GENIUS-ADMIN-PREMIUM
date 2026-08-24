export async function derivePin(pin,saltHex){
 const enc=new TextEncoder();
 const salt=saltHex?new Uint8Array(saltHex.match(/.{1,2}/g).map(x=>parseInt(x,16))):crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',enc.encode(String(pin)),{name:'PBKDF2'},false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);
 return {salt:[...salt].map(x=>x.toString(16).padStart(2,'0')).join(''),hash:[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
export async function verifyPin(pin,hash,salt){if(!hash)return false;const r=await derivePin(pin,salt);return r.hash===hash}
