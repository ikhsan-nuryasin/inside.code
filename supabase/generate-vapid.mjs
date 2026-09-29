import { webcrypto } from 'node:crypto';

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const privateKey = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const rawPublic = new Uint8Array([
  0x04,
  ...Buffer.from(publicKey.x, 'base64url'),
  ...Buffer.from(publicKey.y, 'base64url'),
]);

console.log('VAPID_PUBLIC_JWK=' + JSON.stringify(publicKey));
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(privateKey));
console.log('VITE_VAPID_PUBLIC_KEY=' + b64url(rawPublic));
console.log('VAPID_SUBJECT=mailto:admin@example.com');
