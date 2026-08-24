let plugins={};
export async function native(){
  if(plugins.loaded)return plugins;
  try{plugins.app=await import('@capacitor/app')}catch{}
  try{plugins.haptics=await import('@capacitor/haptics')}catch{}
  try{plugins.share=await import('@capacitor/share')}catch{}
  try{plugins.filesystem=await import('@capacitor/filesystem')}catch{}
  try{plugins.keyboard=await import('@capacitor/keyboard')}catch{}
  try{plugins.statusBar=await import('@capacitor/status-bar')}catch{}
  try{plugins.notifications=await import('@capacitor/local-notifications')}catch{}
  plugins.loaded=true;return plugins;
}
export async function haptic(style='LIGHT'){try{const p=await native();await p.haptics?.Haptics?.impact({style:p.haptics.Style?.[style]||style});}catch{try{navigator.vibrate?.(18)}catch{}}}
export async function shareText(title,text){try{const p=await native();if(p.share?.Share){const c=await p.share.Share.canShare();if(c.value)return p.share.Share.share({title,text});}}catch{};if(navigator.share)try{return navigator.share({title,text})}catch{};return false}
export async function writeTextFile(fileName,text){const p=await native();if(!p.filesystem?.Filesystem)throw new Error('FILESYSTEM_UNAVAILABLE');await p.filesystem.Filesystem.writeFile({path:fileName,data:btoa(unescape(encodeURIComponent(text))),directory:p.filesystem.Directory.Documents,recursive:true});const r=await p.filesystem.Filesystem.getUri({path:fileName,directory:p.filesystem.Directory.Documents});return r.uri}
export async function shareFile(uri,title='GENIUS ADMIN Backup'){const p=await native();if(p.share?.Share)return p.share.Share.share({title,files:[uri]});throw new Error('SHARE_UNAVAILABLE')}
export async function configureNative(){const p=await native();try{await p.statusBar?.StatusBar?.setOverlaysWebView({overlay:true})}catch{}try{await p.keyboard?.Keyboard?.setAccessoryBarVisible({isVisible:false})}catch{} }

export async function scanBarcode(){const m=await import('./services/scanner/nativeScanner');return m.scanGENIUSID()}
