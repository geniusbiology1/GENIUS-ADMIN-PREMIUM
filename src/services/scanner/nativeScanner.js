let mod;
async function plugin(){if(!mod)mod=await import('@capacitor-mlkit/barcode-scanning');return mod.BarcodeScanner;}
export async function requestCamera(){const Scanner=await plugin();return Scanner.requestPermissions();}
export async function isScannerSupported(){try{const Scanner=await plugin();return (await Scanner.isSupported()).supported}catch{return false}}
export async function scanGENIUSID(){
 const Scanner=await plugin();
 const permission=await Scanner.checkPermissions();
 if(permission.camera!=='granted')await Scanner.requestPermissions();
 const {barcodes}=await Scanner.scan({formats:['QR_CODE','CODE_128'],autoZoom:true});
 const value=barcodes?.[0]?.rawValue||barcodes?.[0]?.displayValue||'';
 return value.trim();
}
export async function stopScanner(){try{const Scanner=await plugin();await Scanner.stopScan()}catch{}}
