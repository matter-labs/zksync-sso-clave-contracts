import { decode } from 'cbor-web';
import { Buffer } from 'buffer';
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';

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

/**
 * Return 2 32byte words for the R & S for the EC2 signature, 0 l-trimmed
 * @param signature 
 * @returns r & s bytes sequentially
 */
export function unwrapEC2Signature(signature: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  const parsedSignature = AsnParser.parse(signature, ECDSASigValue);
  console.log("parsedSignature", parsedSignature);
  let rBytes = new Uint8Array(parsedSignature.r);
  let sBytes = new Uint8Array(parsedSignature.s);

  if (shouldRemoveLeadingZero(rBytes)) {
    rBytes = rBytes.slice(1);
  }

  if (shouldRemoveLeadingZero(sBytes)) {
    sBytes = sBytes.slice(1);
  }

  return {
    r: rBytes,
    s: sBytes,
  }
}

/**
 * Determine if the DER-specific `00` byte at the start of an ECDSA signature byte sequence
 * should be removed based on the following logic:
 *
 * "If the leading byte is 0x0, and the the high order bit on the second byte is not set to 0,
 * then remove the leading 0x0 byte"
 */
function shouldRemoveLeadingZero(bytes: Uint8Array): boolean {
  return bytes[0] === 0x0 && (bytes[1] & (1 << 7)) !== 0;
}