import { decode } from 'cbor-web';
import { Buffer } from 'buffer';

enum COSEKEYS {
  kty = 1,  // Key Type
  alg = 3,  // Algorithm
  crv = -1, // Curve for EC keys
  x = -2,   // X coordinate for EC keys
  y = -3,   // Y coordinate for EC keys
  n = -1,   // Modulus for RSA keys
  e = -2,   // Exponent for RSA keys
}

export const getPublicKeyBytesFromPasskeySignature = async (publicPasskey: Uint8Array) => {
  const cosePublicKey = await decode(publicPasskey); // Decodes CBOR-encoded COSE key
  const x = cosePublicKey.get(COSEKEYS.x);
  const y = cosePublicKey.get(COSEKEYS.y);

  return Buffer.concat([Buffer.from(x), Buffer.from(y)]);
}