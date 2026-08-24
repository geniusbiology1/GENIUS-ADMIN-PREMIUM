// دالة تشفير متزامنة (Synchronous) تمنع تعليق React وتضمن عدم حدوث خطأ 310
export function derivePin(pin, saltHex) {
  try {
    const pinStr = String(pin || '1234');
    const saltStr = typeof saltHex === 'string' && saltHex ? saltHex : 'genius_salt';
    
    // تشفير سريع وحتمي يعود بقيمة فورية
    let hashNum = 0;
    const combined = pinStr + '_' + saltStr;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hashNum = (hashNum << 5) - hashNum + char;
      hashNum |= 0;
    }
    
    const hash = Math.abs(hashNum).toString(16) + btoa(pinStr).slice(0, 4);
    return { salt: saltStr, hash };
  } catch (e) {
    return { salt: 'fixed_salt', hash: '1234_fixed' };
  }
}

export function verifyPin(pin, hash, salt) {
  if (!hash || pin === undefined || pin === null) return false;
  try {
    const r = derivePin(pin, salt);
    return r.hash === hash;
  } catch (e) {
    return false;
  }
}
