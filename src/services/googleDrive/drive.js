const API='https://www.googleapis.com/drive/v3';
const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
async function req(url,options={}){const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${options.accessToken}`,...options.headers}});if(!r.ok)throw new Error(`GOOGLE_DRIVE_${r.status}`);return r.json();}
export async function ensureBackupFolder(accessToken,name='GENIUS ADMIN BACKUPS'){
 const q=`name='${name.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
 const found=await req(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,{accessToken});
 if(found.files?.[0])return found.files[0];
 return req(`${API}/files?fields=id,name`,{method:'POST',accessToken,headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder'})});
}
export async function uploadBackup({accessToken,fileName,json,folderId}){
 if(!accessToken)throw new Error('GOOGLE_ACCESS_TOKEN_REQUIRED');
 const metadata={name:fileName,mimeType:'application/json',...(folderId?{parents:[folderId]}:{})};
 const boundary=`genius_${Date.now()}`;
 const body=[`--${boundary}`,'Content-Type: application/json; charset=UTF-8','',JSON.stringify(metadata),`--${boundary}`,'Content-Type: application/json','',json,`--${boundary}--`].join('\r\n');
 return req(`${UPLOAD}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`,{method:'POST',accessToken,headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
}
export async function listBackups(accessToken,folderId){
 if(!folderId)return [];
 const q=`'${folderId}' in parents and trashed=false`;
 const r=await req(`${API}/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,webViewLink)`,{accessToken});
 return r.files||[];
}
export async function downloadBackup(accessToken,fileId){
 const r=await fetch(`${API}/files/${fileId}?alt=media`,{headers:{Authorization:`Bearer ${accessToken}`}});
 if(!r.ok)throw new Error(`GOOGLE_DRIVE_${r.status}`);
 return r.text();
}
export async function deleteBackup(accessToken,fileId){return req(`${API}/files/${fileId}`,{method:'DELETE',accessToken});}
