import { fromArrayBuffer, toArrayBuffer } from "@hexagon/base64";
import { decodePartialCBOR } from "@levischuck/tiny-cbor";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import { bigintToBuf, bufToBigint } from "bigint-conversion";
import { assert } from "chai";
import * as hre from "hardhat";
import { Wallet } from "zksync-ethers";

import { PasskeyValidator, PasskeyValidator__factory } from "../typechain-types";
import { getWallet, LOCAL_RICH_WALLETS, RecordedResponse } from "./utils";

/**
 * Decode from a Base64URL-encoded string to an ArrayBuffer. Best used when converting a
 * credential ID from a JSON string to an ArrayBuffer, like in allowCredentials or
 * excludeCredentials.
 *
 * @param buffer Value to decode from base64
 * @param to (optional) The decoding to use, in case it's desirable to decode from base64 instead
 */
export function toBuffer(
  base64urlString: string,
  from: "base64" | "base64url" = "base64url",
): Uint8Array {
  const _buffer = toArrayBuffer(base64urlString, from === "base64url");
  return new Uint8Array(_buffer);
}

async function deployValidator(
  wallet: Wallet,
): Promise<PasskeyValidator> {
  const deployer: Deployer = new Deployer(hre, wallet);
  const passkeyValidatorArtifact = await deployer.loadArtifact(
    "PasskeyValidator",
  );

  const validator = await deployer.deploy(passkeyValidatorArtifact, []);
  return PasskeyValidator__factory.connect(await validator.getAddress(), wallet);
}

/**
 * COSE Keys
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#key-common-parameters
 * https://www.iana.org/assignments/cose/cose.xhtml#key-type-parameters
 */
export enum COSEKEYS {
  kty = 1,
  alg = 3,
  crv = -1,
  x = -2,
  y = -3,
  n = -1,
  e = -2,
}

/**
 * COSE Key Types
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#key-type
 */
export enum COSEKTY {
  OKP = 1,
  EC = 2,
  RSA = 3,
}

/**
 * COSE Algorithms
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#algorithms
 */
export enum COSEALG {
  ES256 = -7,
  EdDSA = -8,
  ES384 = -35,
  ES512 = -36,
  PS256 = -37,
  PS384 = -38,
  PS512 = -39,
  ES256K = -47,
  RS256 = -257,
  RS384 = -258,
  RS512 = -259,
  RS1 = -65535,
}

/**
 * COSE Curves
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#elliptic-curves
 */
export enum COSECRV {
  P256 = 1,
  P384 = 2,
  P521 = 3,
  ED25519 = 6,
  SECP256K1 = 8,
}

export type COSEPublicKey = {
  // Getters
  get(key: COSEKEYS.kty): COSEKTY | undefined;
  get(key: COSEKEYS.alg): COSEALG | undefined;
  // Setters
  set(key: COSEKEYS.kty, value: COSEKTY): void;
  set(key: COSEKEYS.alg, value: COSEALG): void;
};

export function decodeFirst<Type>(input: Uint8Array): Type {
  // Make a copy so we don't mutate the original
  const _input = new Uint8Array(input);
  const decoded = decodePartialCBOR(_input, 0) as [Type, number];

  const [first] = decoded;

  return first;
}

export function fromBuffer(
  buffer: Uint8Array,
  to: "base64" | "base64url" = "base64url",
): string {
  return fromArrayBuffer(buffer, to === "base64url");
}

async function getPublicKey(publicPasskey: Uint8Array): Promise<[string, string]> {
  const cosePublicKey = decodeFirst<Map<number, unknown>>(publicPasskey);
  const x = cosePublicKey.get(COSEKEYS.x) as Uint8Array;
  const y = cosePublicKey.get(COSEKEYS.y) as Uint8Array;

  return ["0x" + Buffer.from(x).toString("hex"), "0x" + Buffer.from(y).toString("hex")];
}

/**
 * Combine multiple Uint8Arrays into a single Uint8Array
 */
export function concat(arrays: Uint8Array[]): Uint8Array {
  let pointer = 0;
  const totalLength = arrays.reduce((prev, curr) => prev + curr.length, 0);

  const toReturn = new Uint8Array(totalLength);

  arrays.forEach((arr) => {
    toReturn.set(arr, pointer);
    pointer += arr.length;
  });

  return toReturn;
}

/**
 * Return 2 32byte words for the R & S for the EC2 signature, 0 l-trimmed
 * @param signature
 * @returns r & s bytes sequentially
 */
export function unwrapEC2Signature(signature: Uint8Array): [Uint8Array, Uint8Array] {
  const parsedSignature = AsnParser.parse(signature, ECDSASigValue);
  let rBytes = new Uint8Array(parsedSignature.r);
  let sBytes = new Uint8Array(parsedSignature.s);

  if (shouldRemoveLeadingZero(rBytes)) {
    rBytes = rBytes.slice(1);
  }

  if (shouldRemoveLeadingZero(sBytes)) {
    sBytes = sBytes.slice(1);
  }

  return [rBytes, normalizeS(sBytes)];
}

// normalize s (to prevent signature malleability)
function normalizeS(sBuf: Uint8Array): Uint8Array {
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
 * Returns hash digest of the given data, using the given algorithm when provided. Defaults to using
 * SHA-256.
 */
export async function toHash(
  data: Uint8Array | string,
): Promise<Uint8Array> {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  }

  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

async function rawVerify(
  passkeyValidator: PasskeyValidator,
  authenticatorData: string,
  clientData: string,
  b64SignedChallange: string,
  publicKeyEs256Bytes: Uint8Array) {
  const authDataBuffer = toBuffer(authenticatorData);
  const clientDataHash = await toHash(toBuffer(clientData));
  const hashedData = await toHash(concat([authDataBuffer, clientDataHash]));
  const rs = unwrapEC2Signature(toBuffer(b64SignedChallange));
  const publicKeys = await getPublicKey(publicKeyEs256Bytes);
  return await passkeyValidator.rawVerify(hashedData, rs, publicKeys);
}

describe("Passkey validation", function () {
  const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  const ethersResponse = new RecordedResponse("test/signed-challenge.json");

  it("should verify passkey", async function () {
    const passkeyValidator = await deployValidator(wallet);

    // 37 bytes
    const authenticatorData = "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ";
    const clientData = "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ";
    const b64SignedChallange = "MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A";

    // this is a binary object formatted by @simplewebauthn that contains the alg type and public key
    const publicKeyEs256Bytes = new Uint8Array([
      165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 167, 69,
      109, 166, 67, 163, 110, 143, 71, 60, 77, 232, 220, 7,
      121, 156, 141, 24, 71, 28, 210, 116, 124, 90, 115, 166,
      213, 190, 89, 4, 216, 128, 34, 88, 32, 193, 67, 151,
      85, 245, 24, 139, 246, 220, 204, 228, 76, 247, 65, 179,
      235, 81, 41, 196, 37, 216, 117, 201, 244, 128, 8, 73,
      37, 195, 20, 194, 9,
    ]);
    const verifyMessage = await rawVerify(
      passkeyValidator,
      authenticatorData, clientData, b64SignedChallange, publicKeyEs256Bytes);

    assert(verifyMessage == true, "valid sig");
  });

  it("should verify other test passkey data", async function () {
    const passkeyValidator = await deployValidator(wallet);

    const verifyMessage = await rawVerify(
      passkeyValidator,
      ethersResponse.authenticatorData,
      ethersResponse.clientData,
      ethersResponse.b64SignedChallenge,
      ethersResponse.passkeyBytes);

    assert(verifyMessage == true, "test sig is valid");
  });

  it("should fail when signature is bad", async function () {
    const passkeyValidator = await deployValidator(wallet);

    const b64SignedChallenge = "MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A";
    const verifyMessage = await rawVerify(
      passkeyValidator,
      ethersResponse.authenticatorData,
      ethersResponse.clientData,
      b64SignedChallenge,
      ethersResponse.passkeyBytes);

    assert(verifyMessage == false, "bad sig should be false");
  });
});
