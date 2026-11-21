import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import mariadb from 'mariadb';
import bcrypt from 'bcryptjs';

const url=new URL(process.env.DATABASE_URL??'');
const smoke=process.argv.includes('--smoke');
assert(process.argv.includes('--local-demo'));
assert.notEqual(process.env.NODE_ENV,'production');
assert(['database','localhost','127.0.0.1'].includes(url.hostname));
assert(smoke?url.pathname==='/multitienda_demo':/^\/integration_rehearsal_[a-z0-9_]+$/.test(url.pathname));
const db=await mariadb.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1)});
const hosts=['losprimos.localhost:3100','fruvalle.localhost:3100'];
const emails=['admin@variedades.com','admin@fruvalle.com'];
const globalId='demo-platform-admin';
const cookies=[];
let checks=0;
const check=async(label,fn)=>{await fn();checks++;console.log('OK '+label);};
function request(index,target,{method='GET',body,cookie,headers={}}={}){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:3000,path:target,method,headers:{host:typeof index==='number'?hosts[index]:index,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},timeout:60000},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{let data;try{data=JSON.parse(text).data;}catch{}resolve({status:res.statusCode,headers:res.headers,text,data});});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Timeout')));req.end(body===undefined?undefined:JSON.stringify(body));
 });
}
async function api(index,target,status=200,options={}){const r=await request(index,target,options);assert.equal(r.status,status,`${target}: ${r.status} ${r.text.slice(0,300)}`);return r;}
const sessionCookie=r=>r.headers['set-cookie']?.map(c=>c.split(';')[0]).find(c=>c.startsWith('vlp_session='));
async function login(index,email,status=200){const result=await api(index,'/api/auth/login',status,{method:'POST',body:{email,password:'admin123'}});return {...result,cookie:sessionCookie(result)};}
try{
 await check('tres cuentas, hashes válidos y permiso de plataforma separado',async()=>{
  for(const [id,email,role]of [['demo-admin-0',emails[0],'NONE'],['demo-admin-1',emails[1],'NONE'],[globalId,'admin@admin.com','ADMIN']]){
   const [u]=await db.query('SELECT id,email,role,platformRole,passwordHash FROM users WHERE id=?',[id]);assert.equal(u.email,email);assert.equal(u.platformRole,role);assert.equal(u.role,'CUSTOMER');assert(await bcrypt.compare('admin123',u.passwordHash));
  }
  assert.equal((await db.query('SELECT id FROM users WHERE email IN (?,?)',['e08-admin-a@variedadeslosprimos.com','e08-admin-b@variedadeslosprimos.com'])).length,0);
 });
 await check('administradores de tienda limitados a su comercio',async()=>{
  for(const i of [0,1]){const result=await login(i,emails[i]);assert.equal(result.data.role,'ADMIN');assert(result.cookie);cookies.push(result.cookie);await api(i,'/api/admin/products',200,{cookie:result.cookie});await api(1-i,'/api/admin/products',403,{cookie:result.cookie});}
  for(const [i,email]of ['e08-admin-a@variedadeslosprimos.com','e08-admin-b@variedadeslosprimos.com'].entries())await login(i,email,401);
 });
 let globalCookie;
 await check('administrador global en ambos paneles con catálogo aún segregado',async()=>{
  globalCookie=(await login(0,'admin@admin.com')).cookie;assert(globalCookie);
  for(const i of [0,1]){
   const products=await api(i,'/api/admin/products',200,{cookie:globalCookie});assert(products.text.includes(i?'demo-1-aguacate':'demo-0-termo'));assert(!products.text.includes(i?'demo-0-termo':'demo-1-aguacate'));
   await api(i,'/admin',200,{cookie:globalCookie});
   await api(i,'/api/admin/products/'+(i?'demo-0-termo':'demo-1-aguacate'),404,{cookie:globalCookie,headers:{'x-store-id':i?'store-original':'store-frutas-del-valle'}});
  }
  await api('unknown.invalid','/api/admin/products',404,{cookie:globalCookie});
  assert.equal((await login(1,'admin@admin.com')).data.role,'ADMIN');
 });
 if(!smoke){
  await check('un rol global ADMIN heredado y campos enviados por cliente no otorgan plataforma',async()=>{
   const result=await api(0,'/api/auth/register',201,{method:'POST',body:{name:'Ensayo de permisos',email:`permissions-${randomUUID()}@example.com`,password:'admin123',acceptedTerms:true,role:'ADMIN',platformRole:'ADMIN'}});
   const id=result.data.id,cookie=sessionCookie(result);assert.equal(result.data.role,'CUSTOMER');
   const [row]=await db.query('SELECT platformRole FROM users WHERE id=?',[id]);assert.equal(row.platformRole,'NONE');
   await db.query("UPDATE users SET role='ADMIN' WHERE id=?",[id]);
   await api(0,'/api/admin/products',403,{cookie});await api(1,'/api/admin/products',401,{cookie});
  });
  await check('el panel de tienda no concede plataforma ni altera la cuenta global',async()=>{
   const result=await api(0,'/api/admin/users',201,{method:'POST',cookie:cookies[0],body:{name:'Administrador de ensayo',email:`shop-admin-${randomUUID()}@example.com`,password:'admin123',role:'ADMIN',platformRole:'ADMIN'}});
   const [row]=await db.query('SELECT platformRole FROM users WHERE id=?',[result.data.id]);assert.equal(row.platformRole,'NONE');
   await api(0,`/api/admin/users/${globalId}`,403,{method:'PATCH',cookie:cookies[0],body:{name:'Administrador de plataforma',email:'admin@admin.com',role:'CUSTOMER',status:'INACTIVE'}});
   await api(0,`/api/admin/users/${globalId}`,403,{method:'DELETE',cookie:cookies[0]});
   const [global]=await db.query('SELECT platformRole,status FROM users WHERE id=?',[globalId]);assert.equal(global.platformRole,'ADMIN');assert.equal(global.status,'ACTIVE');
  });
  await check('revocar permiso en servidor invalida privilegios del JWT existente',async()=>{
   // Solo se permite este ensayo mutable en una copia reservada, nunca en demo activa.
   await db.query("UPDATE users SET platformRole='NONE' WHERE id=?",[globalId]);
   try{for(const i of [0,1])await api(i,'/api/admin/products',403,{cookie:globalCookie});}
   finally{await db.query("UPDATE users SET platformRole='ADMIN' WHERE id=?",[globalId]);}
   for(const i of [0,1])await api(i,'/api/admin/products',200,{cookie:globalCookie});
  });
 }
 console.log(`${checks} grupos correctos; contraseñas y permisos comprobados sin exponer hashes.`);
}finally{await db.end();}
