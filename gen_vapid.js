const c=require('node:crypto').webcrypto;
(async()=>{const k=await c.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);
const j=await c.subtle.exportKey('jwk',k.privateKey);
const pub=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url');
console.log('VAPID_PUBLIC='+pub);console.log('VAPID_PRIVATE='+j.d);})();
