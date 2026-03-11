/**
 * Create and sign a Panaudia ticket with TypeScript/Node.js.
 * Run with: npx tsx create_ticket.mts
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const privatePem = fs.readFileSync('private.pem', 'utf-8');
const privateKey = await importPKCS8(privatePem, 'EdDSA');

const ticket = await new SignJWT({
  iss: 'my-app',
  aud: 'space_df8c7a85-0702-45e9-a626-a1c147eafce9',
  jti: crypto.randomUUID(),
  preferred_username: 'Paul',
  panaudia: {
    gain: 1.5,
    priority: true,
    attrs: { colour: '00aaff' },
  },
})
  .setProtectedHeader({ typ: 'JWT', alg: 'EdDSA', crv: 'Ed25519' })
  .setIssuedAt()
  .sign(privateKey);

console.log(ticket);
