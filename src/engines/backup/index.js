export {sha256,makeBackupEnvelope,verifyBackupEnvelope} from '../../services/backup/checksum.js';
export const backupFilename=(date=new Date())=>`GENIUS_ADMIN_BACKUP_${date.toISOString().slice(0,10)}_${date.toTimeString().slice(0,5).replace(':','-')}.json`;
