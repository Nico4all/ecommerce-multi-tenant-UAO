import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import mariadb from 'mariadb';

const url=new URL(process.env.DATABASE_URL??''),smoke=process.argv.includes('--smoke');
assert(process.argv.includes('--local-demo'));
assert.notEqual(process.env.NODE_ENV,'production');
assert(['database','localhost','127.0.0.1'].includes(url.hostname));
assert(smoke?url.pathname==='/multitienda_demo':/^\/integration_rehearsal_[a-z0-9_]+$/.test(url.pathname));
const db=await mariadb.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),bigIntAsNumber:true,dateStrings:true});
const hosts=['losprimos.localhost:3100','fruvalle.localhost:3100'],run=randomUUID().slice(0,8);
let checks=0,globalCookie,shopCookie;
const check=async(label,fn)=>{await fn();checks++;console.log('OK '+label);};
function request(host,target,{method='GET',body,cookie,origin=`http://${host}`}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:3000,path:target,method,headers:{host,'content-type':'application/json',...(cookie?{cookie}:{}),...(origin?{origin}:{})},timeout:60000},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{let data;try{data=JSON.parse(text).data;}catch{}resolve({status:res.statusCode,headers:res.headers,text,data});});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Timeout')));req.end(body===undefined?undefined:JSON.stringify(body));});}
async function api(host,target,status=200,options={}){const r=await request(host,target,options);assert.equal(r.status,status,`${target}: ${r.status} ${r.text.slice(0,300)}`);return r;}
const post=(body,cookie=globalCookie)=>({method:'POST',body,cookie});
async function login(host,email){const r=await api(host,'/api/auth/login',200,post({email,password:'admin123'},undefined));return {...r,cookie:r.headers['set-cookie'].map(c=>c.split(';')[0]).find(c=>c.startsWith('vlp_session='))};}
const input=(tag,ownerMode='new')=>({name:`Comercio ensayo ${run} ${tag}`,slug:`comercio-${run}-${tag}`,origin:`http://comercio-${run}-${tag}.localhost:3100`,ownerMode,ownerEmail:ownerMode==='new'?`owner-${run}-${tag}@example.com`:'admin@variedades.com',...(ownerMode==='new'?{ownerName:'Propietario de ensayo',ownerPassword:'admin123'}:{})});
const count=async table=>Number((await db.query('SELECT COUNT(*) AS total FROM '+table))[0].total);
async function snapshot(){const tables=await db.query('SELECT TABLE_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND COLUMN_NAME=?',[url.pathname.slice(1),'storeId']);const state={};for(const {name}of tables){assert(/^[a-z_]+$/.test(name));state[name]=(await db.query('SELECT * FROM `'+name+'` WHERE storeId IN (?,?)',['store-original','store-frutas-del-valle'])).map(row=>JSON.stringify(row)).sort();}state.stores=(await db.query('SELECT * FROM stores WHERE id IN (?,?)',['store-original','store-frutas-del-valle'])).map(row=>JSON.stringify(row)).sort();return state;}
try{
 for(let attempt=0;attempt<40;attempt++){try{if((await request(hosts[0],'/api/products')).status===200)break;}catch{}if(attempt===39)throw Error('Runtime no disponible');await new Promise(resolve=>setTimeout(resolve,500));}
 const before=await snapshot();
 await check('plataforma accesible solo con permiso global y sesión actual',async()=>{
  await api(hosts[0],'/api/platform/stores',401);
  const global=await login(hosts[0],'admin@admin.com');globalCookie=global.cookie;assert.equal(global.data.platformAdmin,true);
  const shop=await login(hosts[0],'admin@variedades.com');shopCookie=shop.cookie;assert.equal(shop.data.platformAdmin,false);
  await api(hosts[0],'/api/platform/stores',403,{cookie:shopCookie});await api(hosts[0],'/api/platform/stores',403,post(input('denied'),shopCookie));
  const list=await api(hosts[0],'/api/platform/stores',200,{cookie:globalCookie});assert(list.data.stores.some(s=>s.id==='store-original'));assert(list.data.stores.some(s=>s.id==='store-frutas-del-valle'));assert(!/password|smtp|wompi/i.test(list.text));assert.match(list.headers['cache-control'],/no-store/);
  const page=await api(hosts[0],'/platform',200,{cookie:globalCookie});assert(page.text.includes('Nuevo comercio'));assert(page.text.includes('Administración de plataforma'));
  await api('unknown.invalid','/api/platform/stores',404,{cookie:globalCookie});
 });
 if(!smoke){
  await check('origen, URL y confirmación del dominio validados sin efectos parciales',async()=>{
   const stores=await count('stores'),users=await count('users');
   await api(hosts[0],'/api/platform/stores',403,{...post(input('origin')),origin:'https://unknown.invalid'});
   await api(hosts[0],'/api/platform/stores',403,{...post(input('missing')),origin:null});
   for(const origin of ['http://127.0.0.1:3100','https://localhost','http://commerce.invalid','https://shop.invalid/path','https://user:pass@shop.invalid'])await api(hosts[0],'/api/platform/stores',400,post({...input('url'),origin}));
   await api(hosts[0],'/api/platform/stores',400,post({...input('active'),active:true,domainVerified:false}));
   await api(hosts[0],'/api/platform/stores',400,post({...input('spoof'),platformRole:'ADMIN'}));
   assert.equal(await count('stores'),stores);assert.equal(await count('users'),users);
  });
  let created;
  await check('alta atómica de comercio pendiente con propietario y catálogo vacío',async()=>{
   const result=await api(hosts[0],'/api/platform/stores',201,post(input('draft')));created=result.data;assert.equal(created.active,false);assert.equal(created.domains[0].verified,false);assert.equal(created.origin,null);assert(!/password|smtp|wompi/i.test(result.text));
   const [member]=await db.query('SELECT m.role,u.platformRole FROM store_memberships m JOIN users u ON u.id=m.userId WHERE m.storeId=?',[created.id]);assert.equal(member.role,'OWNER');assert.equal(member.platformRole,'NONE');
   await api(new URL(input('draft').origin).host,'/api/products',404);
   const stores=await count('stores'),users=await count('users');
   await api(hosts[0],'/api/platform/stores',409,post({...input('collision'),origin:'http://losprimos.localhost:3100'}));
   await api(hosts[0],'/api/platform/stores',409,post({...input('taken'),ownerEmail:'admin@variedades.com'}));
   assert.equal(await count('stores'),stores);assert.equal(await count('users'),users);
  });
  await check('activación explícita, dominio propio y administración de la nueva tienda',async()=>{
   const original=(await db.query('SELECT id FROM store_domains WHERE storeId=? LIMIT 1',['store-original']))[0];
   await api(hosts[0],`/api/platform/stores/${created.id}/activate`,404,post({domainId:original.id,confirmDomain:true}));
   await api(hosts[0],`/api/platform/stores/${created.id}/activate`,400,post({domainId:created.domains[0].id,confirmDomain:false}));
   await api(hosts[0],`/api/platform/stores/${created.id}/activate`,403,post({domainId:created.domains[0].id,confirmDomain:true},shopCookie));
   const result=await api(hosts[0],`/api/platform/stores/${created.id}/activate`,200,post({domainId:created.domains[0].id,confirmDomain:true}));assert.equal(result.data.active,true);assert.equal(result.data.origin,input('draft').origin);
   const host=new URL(result.data.origin).host,owner=await login(host,input('draft').ownerEmail);assert.equal(owner.data.role,'ADMIN');assert.equal(owner.data.platformAdmin,false);
   assert.deepEqual((await api(host,'/api/admin/products',200,{cookie:owner.cookie})).data,[]);assert.deepEqual((await api(host,'/api/cart',200,{cookie:owner.cookie})).data.lines,[]);
   await api(host,'/api/platform/stores',403,{cookie:owner.cookie});await api(host,'/api/admin/products/demo-0-termo',404,{cookie:owner.cookie});
   const page=await api(host,'/');assert(page.text.includes(created.name));assert(!page.text.includes('Termo Brisa'));
  });
  await check('vincular identidad existente exige selección explícita y conserva credenciales',async()=>{
   const [before]=await db.query('SELECT * FROM users WHERE email=?',['admin@variedades.com']);
   await api(hosts[0],'/api/platform/stores',400,post({...input('password','existing'),ownerPassword:'otra12345'}));
   const result=await api(hosts[0],'/api/platform/stores',201,post({...input('linked','existing'),origin:`http://COMERCIO-${run}-LINKED.localhost.:3100`,domainVerified:true,active:true}));assert.equal(result.data.origin,input('linked','existing').origin);
   const [after]=await db.query('SELECT * FROM users WHERE email=?',['admin@variedades.com']);assert.deepEqual(after,before);
   const account=await login(new URL(result.data.origin).host,'admin@variedades.com');assert.equal(account.data.role,'ADMIN');assert.equal(account.data.platformAdmin,false);
  });
  await check('creación concurrente no duplica comercios ni modifica tiendas existentes',async()=>{
   const stores=await count('stores'),users=await count('users');const payload={...input('race','existing'),ownerEmail:'admin@admin.com'};
   const responses=await Promise.all([0,1].map(()=>request(hosts[0],'/api/platform/stores',post(payload))));assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);assert.equal(await count('stores'),stores+1);assert.equal(await count('users'),users);
   assert.deepEqual(await snapshot(),before);
  });
  await check('revocación del permiso global bloquea incluso un JWT previamente válido',async()=>{
   await db.query("UPDATE users SET platformRole='NONE' WHERE id='demo-platform-admin'");
   try{await api(hosts[0],'/api/platform/stores',403,{cookie:globalCookie});await api(hosts[0],'/api/platform/stores',403,post(input('revoked')));}
   finally{await db.query("UPDATE users SET platformRole='ADMIN' WHERE id='demo-platform-admin'");}
   await api(hosts[0],'/api/platform/stores',200,{cookie:globalCookie});
  });
 }
 console.log(`${checks} grupos correctos: alta y administración de plataforma, con aislamiento comercial.`);
}finally{await db.end();}
