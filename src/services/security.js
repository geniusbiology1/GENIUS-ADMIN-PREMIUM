export async function derivePin(pin, saltHex) {
  try {
    const enc = new TextEncoder();
    const saltStr = saltHex && typeof saltHex === 'string' ? saltHex : 'genius_default_salt';
    
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(saltStr), iterations: 1000, hash: 'SHA-256' }, key, 256);
      const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return { salt: saltStr, hash };
    }
    
    return { salt: saltStr, hash: btoa(String(pin) + saltStr) };
  } catch (e) {
    console.error('Crypto error fallback:', e);
    return { salt: 'fixed_salt', hash: btoa(String(pin) + 'fixed_salt') };
  }
}

export async function verifyPin(pin, hash, salt) {
  if (!hash || pin === undefined || pin === null) return false;
  try {
    const r = await derivePin(pin, salt);
    return r.hash === hash;
  } catch (e) {
    return false;
  }
}
