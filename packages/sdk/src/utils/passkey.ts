import { toHex } from 'viem';
import { decode } from 'cbor-web';
import { Buffer } from 'buffer';
import { AsnParser } from '@peculiar/asn1-schema';
import { ECDSASigValue } from '@peculiar/asn1-ecc';
import { bigintToBuf, bufToBigint } from 'bigint-conversion';

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
	
  return toHex(Buffer.concat([Buffer.from(x), Buffer.from(y)]));
}

/**
 * Return 2 32byte words for the R & S for the EC2 signature, 0 l-trimmed
 * @param signature 
 * @returns r & s bytes sequentially
 */
export function unwrapEC2Signature(signature: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  const parsedSignature = AsnParser.parse(signature, ECDSASigValue);
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
    s: normalizeS(sBytes),
  }
}


// normalize s (to prevent signature mallebility)
function normalizeS(sBuf: Uint8Array): Uint8Array {
    const n = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551');
    const halfN = n / BigInt(2);
    const sNumber: bigint = bufToBigint(sBuf);

    if (sNumber / halfN) {
        return new Uint8Array(bigintToBuf(n - sNumber))
    } else {
        return sBuf
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

/**
 * Decode from a Base64URL-encoded string to an ArrayBuffer. Best used when converting a
 * credential ID from a JSON string to an ArrayBuffer, like in allowCredentials or
 * excludeCredentials.
 *
 * @param buffer Value to decode from base64
 * @param to (optional) The decoding to use, in case it's desirable to decode from base64 instead
 */
export function base64UrlToUint8Array(base64urlString: string, isUrl: boolean = true): Uint8Array {
  const _buffer = toArrayBuffer(base64urlString, isUrl);
  return new Uint8Array(_buffer);
}

function toArrayBuffer (data: string, isUrl: boolean) {
	const 
		// Regular base64 characters
		chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",

		// Base64url characters
		charsUrl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",

		genLookup = (target: string) => {
			const lookupTemp = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
			const len = chars.length;
			for (let i = 0; i < len; i++) {
				lookupTemp[target.charCodeAt(i)] = i;
			}
			return lookupTemp;
		},
	  
		// Use a lookup table to find the index.
		lookup = genLookup(chars),
		lookupUrl = genLookup(charsUrl); 

	const 
			len = data.length;
		let bufferLength = data.length * 0.75,
			i,
			p = 0,
			encoded1,
			encoded2,
			encoded3,
			encoded4;

		if (data[data.length - 1] === "=") {
			bufferLength--;
			if (data[data.length - 2] === "=") {
				bufferLength--;
			}
		}

		const 
			arraybuffer = new ArrayBuffer(bufferLength),
			bytes = new Uint8Array(arraybuffer),
			target = isUrl ? lookupUrl : lookup;

		for (i = 0; i < len; i += 4) {
			encoded1 = target[data.charCodeAt(i)];
			encoded2 = target[data.charCodeAt(i + 1)];
			encoded3 = target[data.charCodeAt(i + 2)];
			encoded4 = target[data.charCodeAt(i + 3)];

			bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
			bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
			bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
		}

		return arraybuffer;
};