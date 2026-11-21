import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import mariadb from 'mariadb';

// Ensayo explícito: jamás apuntar este runner a una base de producción.
const url=new URL(process.env.DATABASE_URL??'');
assert(process.argv.includes('--local-demo'));
assert(['database','localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/multitienda_demo');
assert.notEqual(process.env.NODE_ENV,'production');
const db=await mariadb.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),decimalAsNumber:true,bigIntAsNumber:true});
const hosts=['losprimos.localhost:3100','fruvalle.localhost:3100'];
const names=['Variedades Los Primos','Frutas del Valle'];
const adminEmails=['admin@variedades.com','admin@fruvalle.com'];
const products=['demo-0-termo','demo-1-aguacate'];
const run=randomUUID().slice(0,8),cookies=[],codes=[];
let checks=0,approvedCode;
const check=async(label,fn)=>{await fn();console.log('OK '+label);checks++;};
function request(index,target,{method='GET',body,cookie,headers={},raw}={}){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:Number(process.env.PORT||3000),path:target,method,headers:{host:typeof index==='number'?hosts[index]:index,'content-type':'application/json',...(cookie?{cookie}:{}),...headers},timeout:60000},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let data;try{data=JSON.parse(text).data;}catch{}resolve({status:res.statusCode,headers:res.headers,text,data});});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('HTTP timeout')));req.end(raw??(body===undefined?undefined:JSON.stringify(body)));
 });
}
async function api(index,target,expected=200,options={}){let r;for(let retry=0;retry<4;retry++){r=await request(index,target,options);if(target!=='/api/webhooks/wompi'||r.status!==503||retry===3)break;console.log('Proveedor temporalmente no disponible: reintento acotado del webhook');await new Promise(resolve=>setTimeout(resolve,1000));}assert.equal(r.status,expected,`${target}: ${r.status} ${r.text.slice(0,400)}`);return r;}
const post=(body,cookie)=>({method:'POST',body,cookie});
const stock=async()=> (await db.query('SELECT id,stock FROM product_variants WHERE id IN (?,?) ORDER BY id',products.map(p=>p+'-variant'))).map(r=>({...r}));
const purchase=(index,method='COD')=>({method,contact:{name:`Comprador ensayo ${run}`,email:`buyer-${run}@example.com`,phone:'3000000000'},shipping:{street:'Dirección de prueba local',city:'Cali',state:'Valle del Cauca',zip:'760001',country:'Colombia'},discountCode:'BIENVENIDA',storeId:index?'store-original':'store-frutas-del-valle',total:1});
async function add(index,cookie){return api(index,'/api/cart/items',201,post({productId:products[index],variantId:products[index]+'-variant',qty:1},cookie));}
try{
 await check('contexto, catálogo A/B concurrente, slug coincidente y SEO aislado',async()=>{
  const responses=await Promise.all(Array.from({length:12},(_,n)=>api(n%2,'/api/products/seleccion-del-dia')));
  for(const [n,r]of responses.entries()){assert.equal(r.data.product.id,products[n%2]);assert.match(r.headers['cache-control'],/no-store/);}
  for(const i of [0,1]){const sitemap=await api(i,'/sitemap.xml');assert(sitemap.text.includes(hosts[i]));assert(!sitemap.text.includes(hosts[1-i]));const page=await api(i,'/');assert(page.text.includes(names[i]));assert(!page.text.includes(`<title>${names[1-i]}`));for(const key of ['WOMPI_PRIVATE_KEY','WOMPI_INTEGRITY_SECRET','WOMPI_EVENTS_SECRET','SMTP_PASS'])assert(!page.text.includes(process.env[key]),'Configuración sensible en HTML');}
  await api('unknown.invalid','/api/products',404);await api('unknown.invalid','/login',404);
 });
 await check('login con contraseña, roles de membresía y Google inactivo',async()=>{
  for(const i of [0,1]){const r=await api(i,'/api/auth/login',200,post({email:adminEmails[i],password:'admin123'}));assert.equal(r.data.role,'ADMIN');const cookie=r.headers['set-cookie'].map(x=>x.split(';')[0]).find(x=>x.startsWith('vlp_session='));assert(cookie);cookies.push(cookie);await api(i,'/api/admin/products',200,{cookie});await api(1-i,'/api/admin/products',403,{cookie});await api(i,'/api/auth/google',503);}
 });
 await check('carrito y favoritos separados con el mismo usuario; IDs ajenos rechazados',async()=>{
  for(const i of [0,1]){await add(i,cookies[0]);const before=await api(i,'/api/cart',200,{cookie:cookies[0]});assert(before.data.lines.every(l=>l.product.id===products[i]));const foreign=await request(i,'/api/cart/items',post({productId:products[1-i],variantId:products[1-i]+'-variant',qty:1},cookies[0]));assert([400,404].includes(foreign.status));assert.equal((await api(i,'/api/cart',200,{cookie:cookies[0]})).text,before.text);await api(i,'/api/wishlist',200,post({productId:products[i]},cookies[0]));const wish=await api(i,'/api/wishlist',200,{cookie:cookies[0]});assert(!wish.text.includes(products[1-i]));const bad=await request(i,'/api/wishlist',post({productId:products[1-i]},cookies[0]));assert([400,404].includes(bad.status));}
 });
 await check('cupones por tienda y ownership administrativo GET/POST/PATCH/DELETE',async()=>{
  const coupon=`SOLO-${run.toUpperCase()}`;await api(1,'/api/admin/discounts',201,post({code:coupon,type:'PERCENT',value:5},cookies[1]));await api(0,'/api/discounts/validate',400,post({code:coupon,subtotal:100000},cookies[0]));
  const product={name:'Artículo de ensayo',slug:`integration-${run}`,brand:'Ensayo local',categorySlug:'vida-diaria',price:1000,stock:1,status:'DRAFT'};
  for(const method of ['GET','PATCH','DELETE'])await api(0,'/api/admin/products/'+products[1],404,{method,cookie:cookies[0],...(method==='PATCH'?{body:product}:{})});
  await api(0,'/api/admin/products',404,post({...product,categorySlug:'frutas'},cookies[0]));
  const own=await api(0,'/api/admin/products',201,post(product,cookies[0]));assert(own.data.id);await api(0,'/api/admin/products/'+own.data.id,200,{method:'PATCH',body:{...product,name:'Artículo de ensayo actualizado'},cookie:cookies[0]});
  console.log('Artículo DRAFT creado para revisión de borrado: '+own.data.id);
 });
 await check('checkout COD A/B: stock, descuento, pedidos y exportación segregados',async()=>{
  const before=await stock();
  for(const i of [0,1]){const r=await api(i,'/api/checkout',201,post(purchase(i),cookies[0]));codes.push(r.data.code);assert.equal(typeof r.data.total,'number');assert(r.data.total>1);await api(i,'/api/orders/'+r.data.code,200,{cookie:cookies[0]});await api(1-i,'/api/orders/'+r.data.code,404,{cookie:cookies[0]});const current=await stock();assert.equal(current[i].stock,before[i].stock-1);if(!i)assert.equal(current[1].stock,before[1].stock);}
  assert.notEqual(codes[0],codes[1]);
  for(const i of [0,1]){const csv=await api(i,'/api/admin/orders/export',200,{cookie:cookies[i]});assert(csv.text.includes(codes[i]));assert(!csv.text.includes(codes[1-i]));const foreign=(await db.query('SELECT id FROM orders WHERE code=?',[codes[1-i]]))[0];await api(i,'/api/admin/orders/export?ids='+foreign.id,404,{cookie:cookies[i]});}
 });
 await check('subida de imagen y lectura cerrada para otra tienda',async()=>{
  const image=await readFile('prisma/seed-data/demo-images/termo.png');const boundary='integration-'+run;
  const raw=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="preset"\r\n\r\nproduct\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="integration.png"\r\nContent-Type: image/png\r\n\r\n`),image,Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const r=await api(0,'/api/admin/uploads',201,{method:'POST',cookie:cookies[0],headers:{'content-type':'multipart/form-data; boundary='+boundary},raw});const location=new URL(r.data.url);assert.equal(location.host,hosts[0]);assert(location.pathname.startsWith('/api/uploads/stores/'));await api(0,location.pathname);await api(1,location.pathname,404);
 });
 if(process.argv.includes('--sandbox')){
  assert(process.env.WOMPI_PUBLIC_KEY?.startsWith('pub_test_'));assert(process.env.WOMPI_PRIVATE_KEY?.startsWith('prv_test_'));assert(process.env.WOMPI_EVENTS_SECRET?.startsWith('test_events_'));
  const base='https://sandbox.wompi.co/v1';
  async function provider(target,body){let r;for(let retry=0;retry<4;retry++){try{r=await fetch(base+target,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-merchant-public-key':process.env.WOMPI_PUBLIC_KEY,Authorization:`Bearer ${process.env.WOMPI_PRIVATE_KEY}`},...(body?{body:JSON.stringify(body)}:{})});break;}catch(error){if(retry===3||!['ENOTFOUND','EAI_AGAIN'].includes(error.cause?.code))throw error;await new Promise(resolve=>setTimeout(resolve,1000));}}const data=await r.json();if(!r.ok)throw Error(`Sandbox ${target} HTTP ${r.status} ${JSON.stringify(data.error??data).slice(0,300)}`);return data.data;}
  for(const i of [0,1])await check(`Wompi sandbox ${i?'rechazado B':'aprobado A'}, firma y repetición idempotente`,async()=>{
   const merchant=await provider('/merchants/info');
   const cookie=cookies[i];await add(i,cookie);const before=await stock();const checkout=await api(i,'/api/checkout',201,post(purchase(i,'WOMPI'),cookie));const redirect=new URL(checkout.data.redirectUrl),params=redirect.searchParams;assert.equal(new URL(params.get('redirect-url')).origin,`http://${hosts[i]}`);
   const transaction=await provider('/transactions',{acceptance_token:merchant.presigned_acceptance.acceptance_token,accept_personal_auth:merchant.presigned_personal_data_auth.acceptance_token,amount_in_cents:Number(params.get('amount-in-cents')),currency:'COP',customer_email:'sandbox-test@example.com',reference:params.get('reference'),signature:params.get('signature:integrity'),payment_method:{type:'NEQUI',phone_number:i?'3992222222':'3991111111'}});
   let actual=transaction;for(let attempt=0;attempt<30&&actual.status==='PENDING';attempt++){await new Promise(r=>setTimeout(r,1000));actual=await provider('/transactions/'+transaction.id);}
   assert.equal(actual.status,i?'DECLINED':'APPROVED');
   const signed=(tx)=>{const timestamp=Math.floor(Date.now()/1000),properties=['transaction.id','transaction.status','transaction.amount_in_cents'];return {event:'transaction.updated',environment:'test',timestamp,data:{transaction:tx},signature:{properties,checksum:createHash('sha256').update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`).digest('hex')}};};
   const event=signed(actual);await api('unknown.invalid','/api/webhooks/wompi',401,post({...event,signature:{...event.signature,checksum:'0'.repeat(64)}}));await api('unknown.invalid','/api/webhooks/wompi',409,post(signed({...actual,amount_in_cents:actual.amount_in_cents+1})));
   await api('unknown.invalid','/api/webhooks/wompi',200,post(event));
   if(!i)approvedCode=checkout.data.code;
   const state=async()=>({payment:(await db.query('SELECT p.status,p.gatewayTransactionId,o.status AS orderStatus FROM payments p JOIN orders o ON p.orderId=o.id WHERE o.code=?',[checkout.data.code]))[0],events:await db.query('SELECT e.status FROM order_status_events e JOIN orders o ON e.orderId=o.id WHERE o.code=? ORDER BY e.createdAt',[checkout.data.code]),stock:await stock(),logs:await db.query('SELECT id FROM email_logs WHERE orderId=(SELECT id FROM orders WHERE code=?)',[checkout.data.code])});
   const first=await state();assert.equal(first.payment.orderStatus,i?'CANCELLED':'PAID');assert.equal(first.payment.status,i?'FAILED':'COMPLETED');assert.equal(first.stock[i].stock,before[i].stock-(i?0:1));assert.equal(first.stock[1-i].stock,before[1-i].stock);await Promise.all([0,1,2].map(()=>api('unknown.invalid','/api/webhooks/wompi',200,post(event))));assert.deepEqual(await state(),first);
   console.log(`Sandbox ${actual.id}: ${actual.status}; ${checkout.data.code}; evento reenviado por HTTP local con consulta autenticada al proveedor`);
  });
 }
 await check('recuperación y notificaciones SMTP capturadas por tienda',async()=>{
  for(const i of [0,1])await api(i,'/api/auth/password/forgot',200,post({email:adminEmails[i]}));
  const inbox=await (await fetch('http://mailpit:8025/api/v1/messages')).json();assert(inbox.messages.length>=4);
  for(const i of [0,1]){const item=inbox.messages.find(m=>m.Subject.includes('contraseña')&&m.Subject.includes(names[i]));assert(item,'Correo de recuperación '+names[i]);const mail=await (await fetch('http://mailpit:8025/api/v1/message/'+item.ID)).json();assert(!mail.HTML.includes(names[1-i]));assert(mail.HTML.includes(hosts[i]));assert.equal(mail.To[0].Address,adminEmails[i]);const token=mail.HTML.match(/token=([a-f0-9]{64})/)?.[1];assert(token);await api(1-i,'/api/auth/password/reset',400,post({token,password:'admin123'}));await api(i,'/api/auth/password/reset',200,post({token,password:'admin123'}));await api(i,'/api/auth/password/reset',400,post({token,password:'admin123'}));await api(i,'/api/auth/login',200,post({email:adminEmails[i],password:'admin123'}));}
  const confirmation=inbox.messages.find(m=>m.Subject.startsWith('Recibimos tu pedido')&&m.Subject.includes(approvedCode??codes[0]));assert(confirmation,'Confirmación de pedido capturada');const mail=await(await fetch('http://mailpit:8025/api/v1/message/'+confirmation.ID)).json();assert(mail.HTML.includes('http://'+hosts[0]));assert(!mail.HTML.includes(names[1]));
 });
 console.log(`Integración: ${checks} grupos correctos. Datos únicamente en multitienda_demo; SMTP local; Google inactivo.`);
}finally{await db.end();}
