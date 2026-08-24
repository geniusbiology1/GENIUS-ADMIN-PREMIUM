export async function sha256(text){
 const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function makeBackupEnvelope(data,{version='5.1.0',academicYearId=null}={}){
 const raw=JSON.stringify(data);
 return {app:'GENIUS ADMIN',backupFormat:'GENIUS_ADMIN_BACKUP',version,schemaVersion:data.schemaVersion,createdAt:new Date().toISOString(),academicYearId,checksum:await sha256(raw),data};
}
export async function verifyBackupEnvelope(payload){
 if(payload?.app!=='GENIUS ADMIN'||payload?.backupFormat!=='GENIUS_ADMIN_BACKUP'||!payload?.data)throw new Error('INVALID_BACKUP');
 const raw=JSON.stringify(payload.data),actual=await sha256(raw);
 if(payload.checksum!==actual)throw new Error('BACKUP_CHECKSUM_MISMATCH');
 return true;
}
