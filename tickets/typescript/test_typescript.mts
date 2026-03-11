/**
 * Verify TypeScript/Node.js ticket creation and signing.
 * Run with: npx tsx test_typescript.mts
 */

import * as crypto from 'node:crypto';
import { SignJWT, importPKCS8, importSPKI, jwtVerify, decodeProtectedHeader, decodeJwt } from 'jose';

// --- Step 1: Generate keys ---

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

console.log('Keys generated OK');

// --- Step 2: Create and sign ticket ---

const josePrivateKey = await importPKCS8(privatePem, 'EdDSA');

const jti = crypto.randomUUID();
const spaceId = 'space_df8c7a85-0702-45e9-a626-a1c147eafce9';

const ticket = await new SignJWT({
  iss: 'test-verify',
  aud: spaceId,
  jti: jti,
  preferred_username: 'TestUser',
  panaudia: {
    gain: 1.5,
    attenuation: 2.0,
    priority: true,
    subspaces: ['a1b2c3d4-0000-0000-0000-000000000001'],
    attrs: { colour: '00aaff' },
  },
})
  .setProtectedHeader({ typ: 'JWT', alg: 'EdDSA', crv: 'Ed25519' })
  .setIssuedAt()
  .sign(josePrivateKey);

console.log(`Ticket created OK (${ticket.length} chars)`);

// --- Step 3: Verify ---

const parts = ticket.split('.');
if (parts.length !== 3) throw new Error(`Expected 3 parts, got ${parts.length}`);

// Decode header
const header = decodeProtectedHeader(ticket);
if (header.typ !== 'JWT') throw new Error(`typ: ${header.typ}`);
if (header.alg !== 'EdDSA') throw new Error(`alg: ${header.alg}`);
if (header.crv !== 'Ed25519') throw new Error(`crv: ${header.crv}`);
console.log(`Header OK: ${JSON.stringify(header)}`);

// Decode payload
const payload = decodeJwt(ticket);
if (payload.iss !== 'test-verify') throw new Error(`iss: ${payload.iss}`);
if (payload.aud !== spaceId) throw new Error(`aud: ${payload.aud}`);
if (payload.jti !== jti) throw new Error(`jti: ${payload.jti}`);
if ((payload as any).preferred_username !== 'TestUser') throw new Error(`preferred_username: ${(payload as any).preferred_username}`);
if (typeof payload.iat !== 'number') throw new Error(`iat not a number: ${payload.iat}`);

const panaudia = (payload as any).panaudia;
if (panaudia.gain !== 1.5) throw new Error(`gain: ${panaudia.gain}`);
if (panaudia.attenuation !== 2.0) throw new Error(`attenuation: ${panaudia.attenuation}`);
if (panaudia.priority !== true) throw new Error(`priority: ${panaudia.priority}`);
if (panaudia.subspaces[0] !== 'a1b2c3d4-0000-0000-0000-000000000001') throw new Error(`subspaces: ${panaudia.subspaces}`);
if (panaudia.attrs.colour !== '00aaff') throw new Error(`attrs.colour: ${panaudia.attrs.colour}`);
console.log('Payload OK: all claims verified');

// Verify signature with public key
const josePublicKey = await importSPKI(publicPem, 'EdDSA');
await jwtVerify(ticket, josePublicKey, { audience: spaceId });
console.log('Signature verified OK with public key');

console.log('\n=== TYPESCRIPT: ALL TESTS PASSED ===');
