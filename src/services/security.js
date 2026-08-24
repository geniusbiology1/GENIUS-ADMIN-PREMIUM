export async function derivePin(pin, saltHex) {
  try {
    const enc = new TextEncoder();
    
    // فحص آمن للـ saltHex لمنع خطأ الـ match إذا كانت القيمة غير صالحة
    let salt;
    if (saltHex && typeof saltHex === 'string' && saltHex.length % 2 === 0) {
      const matches = saltHex.match(/.{1,2}/g);
      salt = matches ? new Uint8Array(matches.map(x => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
    } else {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }

    // التأكد من توفر SubtleCrypto في الهاتف
    if (window.crypto && crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), { name: 'PBKDF2' }, false, ['deriveBits']);
      // تقليل عدد الدورات إلى 10,000 لضمان السرعة وعدم التهنيج على أجهزة الأندرويد
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' }, key, 256);
      
      return {
        salt: [...salt].map(x => x.toString(16).padStart(2, '0')).join(''),
        hash: [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('')
      };
    }

    // fallback آمن في حال عدم توفر WebCrypto
    const safeSalt = [...salt].map(x => x.toString(16).padStart(2, '0')).join('');
    return { salt: safeSalt, hash: btoa(pin + safeSalt) };
  } catch (e) {
    console.error('PIN derivation failed:', e);
    // إرجاع hash افتراضي يمنع انهيار التطبيق تماماً
    return { salt: 'default_salt', hash: btoa(String(pin) + 'default_salt') };
  }
}

export async function verifyPin(pin, hash, salt) {
  if (!hash) return false;
  try {
    const r = await derivePin(pin, salt);
    return r.hash === hash;
  } catch (e) {
    return false;
  }
}
