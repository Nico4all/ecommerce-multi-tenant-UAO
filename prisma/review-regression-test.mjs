import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import mariadb from 'mariadb';

registerHooks({resolve(specifier,context,nextResolve){if(specifier==='server-only')return {url:new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,shortCircuit:true};return nextResolve(specifier,context);}});
const {privateResponse}=await import('../src/lib/server/private-response.ts');
const {wompiReturnLocation}=await import('../src/lib/server/wompi-return.ts');
const {paymentState}=await import('../src/components/orders/payment-state.tsx');
let checks=0;
const check=async(label,fn)=>{await fn();checks++;console.log('OK '+label);};

await check('redirecciones 302/303 conservan Location sin modificar cabeceras inmutables',async()=>{
 for(const status of [302,303]){const original=Response.redirect('https://example.com/callback',status);assert.throws(()=>original.headers.set('Cache-Control','private'));const secured=privateResponse(original);assert.equal(secured.status,status);assert.equal(secured.headers.get('location'),'https://example.com/callback');assert.match(secured.headers.get('cache-control'),/private.*no-store/);assert(secured.headers.get('vary').includes('Host'));assert.equal(original.headers.get('cache-control'),null);}
});
await check('respuestas JSON/stream conservan cuerpo, estado y cookies separadas',async()=>{
 const headers=new Headers({'Content-Type':'application/json',Vary:'Accept-Encoding'});headers.append('Set-Cookie','first=one; Path=/; HttpOnly');headers.append('Set-Cookie','second=two; Path=/');
 const response=privateResponse(new Response('{"ok":true}',{status:201,headers}));assert.equal(response.status,201);assert.deepEqual(response.headers.getSetCookie(),headers.getSetCookie());assert(response.headers.get('vary').includes('Accept-Encoding'));assert.deepEqual(await response.json(),{ok:true});
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('contenido'));controller.close();}});assert.equal(await privateResponse(new Response(stream)).text(),'contenido');assert.equal(privateResponse(new Response(null,{status:204})).status,204);
});
await check('retorno Wompi usa el resultado verificado y no confunde cobro aprobado con cancelación',async()=>{
 const order={code:'VLP-REVIEW',status:'CANCELLED'};
 assert.equal(wompiReturnLocation({status:'APPROVED'},order),'/checkout/success/VLP-REVIEW');
 assert.equal(wompiReturnLocation({status:'DECLINED'},order),'/checkout/success/VLP-REVIEW?pago=rechazado');
 for(const status of ['PENDING','ERROR','VOIDED'])assert.equal(wompiReturnLocation({status},order),'/checkout/success/VLP-REVIEW');
 assert.equal(wompiReturnLocation({status:'DECLINED'},{...order,status:'PAID'}),'/checkout/success/VLP-REVIEW');assert.equal(wompiReturnLocation(null,null),'/orders?pago=sin-confirmar');
});
await check('un parámetro de rechazo no sustituye pagos cobrados, devueltos ni historial de cobro',async()=>{
 const order={status:'CANCELLED',paymentMethod:'WOMPI',declined:true};
 for(const paymentStatus of ['COMPLETED','REFUNDED',null,undefined])assert.equal(paymentState({...order,paymentStatus}).key,'cancelled');
 assert.equal(paymentState({...order,paymentStatus:'FAILED',events:[{status:'PAID'}]}).key,'cancelled');
 const failed=paymentState({...order,paymentStatus:'FAILED'});assert.equal(failed.key,'declined');assert(!failed.detail.includes('No se te cobró nada'));
 assert.equal(paymentState({...order,paymentMethod:'COD',paymentStatus:'FAILED'}).key,'cancelled');assert.equal(paymentState({status:'PENDING',paymentMethod:'COD'}).key,'on-delivery');
});

if(!process.argv.includes('--unit')){
 const url=new URL(process.env.DATABASE_URL??'');assert(process.argv.includes('--local-copy'));assert(/^\/integration_rehearsal_[a-z0-9_]+$/.test(url.pathname));assert(['database','localhost','127.0.0.1'].includes(url.hostname));assert.notEqual(process.env.NODE_ENV,'production');
 const db=await mariadb.createConnection({host:url.hostname,port:Number(url.port||3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1)});
 const host='losprimos.localhost:3100';
 function request(target,{body,cookie}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:3000,path:target,method:body?'POST':'GET',headers:{host,'content-type':'application/json',...(cookie?{cookie}:{})},timeout:60000},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>{let data;try{data=JSON.parse(text).data;}catch{}resolve({status:res.statusCode,headers:res.headers,text,data});});});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Timeout')));req.end(body?JSON.stringify(body):undefined);});}
 try{
  for(let attempt=0;attempt<40;attempt++){try{if((await request('/api/products')).status===200)break;}catch{}if(attempt===39)throw Error('Runtime no disponible');await new Promise(resolve=>setTimeout(resolve,500));}
  await check('HTTP preserva cookie de sesión y usa el estado persistido en pedido cancelado',async()=>{
   const login=await request('/api/auth/login',{body:{email:'admin@admin.com',password:'admin123'}});assert.equal(login.status,200);const cookie=login.headers['set-cookie'].map(c=>c.split(';')[0]).find(c=>c.startsWith('vlp_session='));assert(cookie);const run=randomUUID();
   for(const paymentStatus of ['COMPLETED','FAILED']){
    const id=`review-${paymentStatus}-${run}`;
    await db.query("INSERT INTO orders (id,storeId,code,userId,status,email,phone,shippingName,street,city,state,zip,country,subtotal,total,createdAt,updatedAt) VALUES (?,'store-original',?,'demo-platform-admin','CANCELLED','admin@admin.com','0000000','Ensayo revisión','Ensayo','Ensayo','Ensayo','000','Colombia',100,100,NOW(),NOW())",[id,id]);
    await db.query("INSERT INTO payments (id,storeId,orderId,method,status,amount,createdAt) VALUES (?,'store-original',?,'WOMPI',?,100,NOW())",['payment-'+id,id,paymentStatus]);
    const detail=await request('/api/orders/'+id,{cookie});assert.equal(detail.status,200);assert.equal(detail.data.paymentStatus,paymentStatus);
    const page=await request(`/checkout/success/${id}?pago=rechazado`,{cookie});assert.equal(page.status,200);assert(!page.text.includes('No se te cobró nada'));const heading=page.text.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]?.replace(/<[^>]+>/g,'');assert.equal(heading,paymentStatus==='COMPLETED'?'Este pedido quedó cancelado':'No pudimos procesar tu pago');
   }
  });
 }finally{await db.end();}
}
console.log(`${checks} grupos de regresión correctos; sin credenciales OAuth ni cobros.`);
