import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import { bigintToBuf, bufToBigint } from "bigint-conversion";
import { Buffer } from "buffer";
import { type Address, encodeAbiParameters, type Hex, toHex } from "viem";

enum COSEKEYS {
  kty = 1, // Key Type
  alg = 3, // Algorithm
  crv = -1, // Curve for EC keys
  x = -2, // X coordinate for EC keys
  y = -3, // Y coordinate for EC keys
}

type COSEPublicKeyMap = Map<COSEKEYS, number | Buffer>;

// Encode an integer in CBOR format
function encodeInt(int: number): Buffer {
  if (int >= 0 && int <= 23) {
    // Small positive integer (0–23)
    return Buffer.from([int]);
  } else if (int >= 24 && int <= 255) {
    // 1-byte positive integer
    return Buffer.from([0x18, int]);
  } else if (int >= 256 && int <= 65535) {
    // 2-byte positive integer
    const buf = Buffer.alloc(3);
    buf[0] = 0x19;
    buf.writeUInt16BE(int, 1);
    return buf;
  } else if (int < 0 && int >= -24) {
    // Small negative integer (-1 to -24)
    return Buffer.from([0x20 - (int + 1)]);
  } else if (int < -24 && int >= -256) {
    // 1-byte negative integer
    return Buffer.from([0x38, -int - 1]);
  } else if (int < -256 && int >= -65536) {
    // 2-byte negative integer
    const buf = Buffer.alloc(3);
    buf[0] = 0x39;
    buf.writeUInt16BE(-int - 1, 1);
    return buf;
  } else {
    throw new Error("Unsupported integer range");
  }
}

// Encode a byte array in CBOR format
function encodeBytes(bytes: Buffer): Buffer {
  if (bytes.length <= 23) {
    return Buffer.concat([Buffer.from([0x40 + bytes.length]), bytes]); // Byte array with small length
  } else if (bytes.length < 256) {
    return Buffer.concat([Buffer.from([0x58, bytes.length]), bytes]); // Byte array with 1-byte length prefix
  } else {
    throw new Error("Unsupported byte array length");
  }
}

// Encode a map in CBOR format
function encodeMap(map: COSEPublicKeyMap): Buffer {
  const encodedItems: Buffer[] = [];

  // CBOR map header, assuming the map size fits within small integer encoding
  const mapHeader = 0xA0 | map.size;
  encodedItems.push(Buffer.from([mapHeader]));

  map.forEach((value, key) => {
    // Encode the key
    encodedItems.push(encodeInt(key));

    // Encode the value based on its type (Buffer or number)
    if (Buffer.isBuffer(value)) {
      encodedItems.push(encodeBytes(value));
    } else {
      encodedItems.push(encodeInt(value));
    }
  });

  return Buffer.concat(encodedItems);
}

function decodeMap(buffer: Buffer): COSEPublicKeyMap {
  const map = new Map<COSEKEYS, number | Buffer>();
  let offset = 1; // Start after the map header

  const mapHeader = buffer[0];
  const mapSize = mapHeader & 0x1F; // Number of pairs

  for (let i = 0; i < mapSize; i++) {
    const [key, keyLength] = decodeInt(buffer, offset);
    offset += keyLength;

    const [value, valueLength] = decodeValue(buffer, offset);
    offset += valueLength;

    map.set(key as COSEKEYS, value);
  }

  return map;
}

function decodeInt(buffer: Buffer, offset: number): [number, number] {
  const intByte = buffer[offset];

  if (intByte < 24) {
    // Small positive integer (0–23)
    return [intByte, 1];
  } else if (intByte === 0x18) {
    // 1-byte unsigned integer
    return [buffer[offset + 1], 2];
  } else if (intByte === 0x19) {
    // 2-byte unsigned integer
    return [buffer.readUInt16BE(offset + 1), 3];
  } else if (intByte >= 0x20 && intByte <= 0x37) {
    // Small negative integer (-1 to -24)
    return [-(intByte - 0x20) - 1, 1];
  } else if (intByte === 0x38) {
    // 1-byte negative integer
    return [-1 - buffer[offset + 1], 2];
  } else if (intByte === 0x39) {
    // 2-byte negative integer
    return [-1 - buffer.readUInt16BE(offset + 1), 3];
  } else {
    throw new Error("Unsupported integer format");
  }
}

function decodeBytes(buffer: Buffer, offset: number): [Buffer, number] {
  const lengthByte = buffer[offset];
  if (lengthByte >= 0x40 && lengthByte <= 0x57) {
    const length = lengthByte - 0x40;
    return [buffer.slice(offset + 1, offset + 1 + length), length + 1];
  } else if (lengthByte === 0x58) { // Byte array with 1-byte length prefix
    const length = buffer[offset + 1];
    return [buffer.slice(offset + 2, offset + 2 + length), length + 2];
  } else {
    throw new Error("Unsupported byte format");
  }
}

function decodeValue(buffer: Buffer, offset: number): [number | Buffer, number] {
  const type = buffer[offset];
  if (type >= 0x40 && type <= 0x5F) { // Byte array
    return decodeBytes(buffer, offset);
  } else {
    return decodeInt(buffer, offset);
  }
}

export const getPublicKeyBytesFromPasskeySignature = (publicPasskey: Uint8Array): [Buffer, Buffer] => {
  const cosePublicKey = decodeMap(Buffer.from(publicPasskey)); // Decodes CBOR-encoded COSE key
  const x = cosePublicKey.get(COSEKEYS.x) as Buffer;
  const y = cosePublicKey.get(COSEKEYS.y) as Buffer;

  return [Buffer.from(x), Buffer.from(y)];
};

export const getPasskeySignatureFromPublicKeyBytes = (coordinates: [Hex, Hex]): Uint8Array => {
  const [xHex, yHex] = coordinates;
  const x = Buffer.from(xHex.slice(2), "hex");
  const y = Buffer.from(yHex.slice(2), "hex");

  const cosePublicKey: COSEPublicKeyMap = new Map();
  cosePublicKey.set(COSEKEYS.kty, 2); // Type 2 for EC keys
  cosePublicKey.set(COSEKEYS.alg, -7); // -7 for ES256 algorithm
  cosePublicKey.set(COSEKEYS.crv, 1); // Curve ID (1 for P-256)
  cosePublicKey.set(COSEKEYS.x, x);
  cosePublicKey.set(COSEKEYS.y, y);

  const encodedPublicKey = encodeMap(cosePublicKey);
  return new Uint8Array(encodedPublicKey);
};

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
  };
}

/**
 * Normalizes the 's' value of an ECDSA signature to prevent signature malleability.
 *
 * @param {Uint8Array} sBuf - The 's' value of the signature as a Uint8Array.
 * @returns {Uint8Array} The normalized 's' value as a Uint8Array.
 *
 * @description
 * This function implements the process of normalizing the 's' value in an ECDSA signature.
 * It ensures that the 's' value is always in the lower half of the curve's order,
 * which helps prevent signature malleability attacks.
 *
 * The function uses the curve order 'n' for secp256k1:
 * n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
 *
 * If 's' is greater than half of 'n', it is subtracted from 'n' to get the lower value.
 */
export function normalizeS(sBuf: Uint8Array): Uint8Array {
  const n = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
  const halfN = n / BigInt(2);
  const sNumber: bigint = bufToBigint(sBuf);

  if (sNumber / halfN) {
    return new Uint8Array(bigintToBuf(n - sNumber));
  } else {
    return sBuf;
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

function toArrayBuffer(data: string, isUrl: boolean) {
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

export function passkeyHashSignatureResponseFormat(
  passkeyResponse: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  },
  contracts: {
    passkey: Address;
  },
) {
  const signature = unwrapEC2Signature(base64UrlToUint8Array(passkeyResponse.signature));
  const fatSignature = encodeAbiParameters(
    [
      { type: "bytes" }, // authData
      { type: "bytes" }, // clientDataJson
      { type: "bytes32[2]" }, // signature (two elements)
    ],
    [
      toHex(base64UrlToUint8Array(passkeyResponse.authenticatorData)),
      toHex(base64UrlToUint8Array(passkeyResponse.clientDataJSON)),
      [toHex(signature.r), toHex(signature.s)],
    ],
  );
  const fullFormattedSig = encodeAbiParameters(
    [
      { type: "bytes" }, // fat signature
      { type: "address" }, // validator address
      { type: "bytes[]" }, // validator data
    ],
    [
      fatSignature,
      contracts.passkey,
      ["0x"], // FIXME: this is assuming there are no other hooks
    ],
  );

  return fullFormattedSig;
}
