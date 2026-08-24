import {all,get,put,del} from '../../db.js';
export const repository=store=>({list:()=>all(store),get:id=>get(store,id),save:row=>put(store,row),remove:id=>del(store,id)});
export const repositories={
 students:repository('students'),
 groups:repository('groups'),
 sessions:repository('sessions'),
 payments:repository('payments'),
 expenses:repository('expenses'),
 notifications:repository('notifications')
};
