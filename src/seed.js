import {uid,today} from './db';
export {uid,today};
export const defaultData={
 settings:[{id:'main',name:'GENIUS BIOLOGY',teacher:'د. علاء عبد الجواد شتا',subject:'الأحياء',phone:'01066994986',pin:'1234',pinHash:'',pinSalt:'',theme:'dark',accent:'#FF0000',autoLockMinutes:15,soundEnabled:true,hapticEnabled:true,notificationsEnabled:true,autoBackupMode:'MANUAL',autoBackupAfterChanges:20,backupRetention:5,driveClientId:'',driveFolderId:'',idPrefix:'GB'}],
 academicYears:[{id:'ay27',name:'2026 - 2027',shortCode:'27',start:'2026-08-01',end:'2027-07-31',current:true}],
 branches:[{id:'br1',name:'سمنود'},{id:'br2',name:'الناصرية'},{id:'br3',name:'أبو صير'},{id:'br4',name:'منية سمنود'}],
 dictionaries:[
  {id:'grades',name:'الصفوف',values:['الصف الثالث الثانوي','الصف الثاني الثانوي','الصف الأول الثانوي']},
  {id:'groupTypes',name:'أنواع المجموعات',values:['سنتر','أونلاين','برايفيت']},
  {id:'studentStatuses',name:'حالات الطلاب',values:['نشط','موقوف','مؤرشف']},
  {id:'paymentMethods',name:'طرق الدفع',values:['نقدي','تحويل','Instapay','محفظة']},
  {id:'expenseCategories',name:'تصنيفات المصروفات',values:['طباعة','إيجار','مرتبات','مواصلات','معدات','تسويق','أخرى']},
  {id:'bookTypes',name:'أنواع الكتب',values:['مذكرة','كتاب خارجي','ملزمة','هدية']},
  {id:'examTypes',name:'أنواع الامتحانات',values:['اختبار حصة','اختبار باب','اختبار شامل','مراجعة']},
  {id:'levels',name:'مستويات الطالب',values:['ممتاز','جيد جدًا','جيد','يحتاج متابعة']},
  {id:'bookStatuses',name:'حالات الكتب',values:['غير مدفوع وغير مستلم','مستلم غير مدفوع','مدفوع ولم يستلم','مدفوع ومستلم']},
  {id:'discountPresets',name:'نسب الخصم الجاهزة',values:['10','25','50','100']},
  {id:'holidayReasons',name:'أسباب إجازة الحصص',values:['عطلة رسمية','إجازة عيد','ظرف طارئ','امتحانات المدرسة','أخرى']}
 ],
 groups:[
  {id:'g1',code:'270001',name:'3 ث سمنود 1',branchId:'br1',academicYearId:'ay27',grade:'الصف الثالث الثانوي',subject:'الأحياء',type:'سنتر',status:'ACTIVE',maxStudents:50,pricingModel:'MONTHLY',price:350,startMode:'ACADEMIC_START',startDate:'2026-08-01',whatsapp1:'',whatsapp2:'',schedule:[{day:'الأحد',start:'17:00',end:'18:30'},{day:'الثلاثاء',start:'17:00',end:'18:30'}]},
  {id:'g2',code:'270002',name:'3 ث سمنود 2',branchId:'br1',academicYearId:'ay27',grade:'الصف الثالث الثانوي',subject:'الأحياء',type:'سنتر',status:'ACTIVE',maxStudents:50,pricingModel:'MONTHLY',price:350,startMode:'ACADEMIC_START',startDate:'2026-08-01',whatsapp1:'',whatsapp2:'',schedule:[{day:'الاثنين',start:'17:00',end:'18:30'},{day:'الأربعاء',start:'17:00',end:'18:30'}]}
 ],
 students:[{id:'s1',code:'270003',name:'أحمد محمد محمود',grade:'الصف الثالث الثانوي',subject:'الأحياء',academicYearId:'ay27',groupId:'g1',branchId:'br1',status:'نشط',studentPhone:'',parentName:'ولي الأمر',parentPhone:'01012345678',joinDate:'2026-08-01',price:350,discountType:'NONE',discountValue:0,level:'جيد',notes:'',createdAt:new Date().toISOString()}],
 sessions:[],attendance:[],exams:[],grades:[],books:[],studentBooks:[],payments:[],expenses:[],activities:[],notifications:[],followups:[]
};
