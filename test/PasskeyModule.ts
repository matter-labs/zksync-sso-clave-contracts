import { fromArrayBuffer, toArrayBuffer } from "@hexagon/base64";
import { decodePartialCBOR } from "@levischuck/tiny-cbor";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ECDSASigValue } from "@peculiar/asn1-ecc";
import { AsnParser } from "@peculiar/asn1-schema";
import { bigintToBuf, bufToBigint } from "bigint-conversion";
import { assert } from "chai";
import * as hre from "hardhat";
import { Wallet } from "zksync-ethers";

import { WebAuthValidator, WebAuthValidator__factory } from "../typechain-types";
import { getWallet, LOCAL_RICH_WALLETS, RecordedResponse } from "./utils";
import { AbiCoder } from "ethers";
import { base64UrlToUint8Array } from "zksync-sso/utils";
import { encodeAbiParameters, toHex } from "viem";

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

// Helper function to convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function deployValidator(
  wallet: Wallet,
): Promise<WebAuthValidator> {
  const deployer: Deployer = new Deployer(hre, wallet);
  const passkeyValidatorArtifact = await deployer.loadArtifact(
    "WebAuthValidator",
  );

  const validator = await deployer.deploy(passkeyValidatorArtifact, []);
  return WebAuthValidator__factory.connect(await validator.getAddress(), wallet);
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

const r1KeygenParams: EcKeyGenParams = {
  name: "ECDSA",
  namedCurve: "P-256",
};

const r1KeyParams: EcdsaParams =
{
  name: "ECDSA",
  hash: { name: "SHA-256" },
}
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

async function getCrpytoKeyFromBytes(publicPasskeyXyBytes: Uint8Array<ArrayBufferLike>[]): Promise<CryptoKey> {
  const recordedPubkeyXBytes = publicPasskeyXyBytes[0];
  const recordedPubkeyYBytes = publicPasskeyXyBytes[1];
  const rawRecordedKeyMaterial = new Uint8Array(65); // 1 byte for prefix, 32 bytes for x, 32 bytes for y
  rawRecordedKeyMaterial[0] = 0x04; // Uncompressed format prefix
  rawRecordedKeyMaterial.set(recordedPubkeyXBytes, 1);
  rawRecordedKeyMaterial.set(recordedPubkeyYBytes, 33);
  const importedKeyMaterial = await crypto.subtle.importKey("raw", rawRecordedKeyMaterial, r1KeygenParams, false, ["verify"]);
  return importedKeyMaterial;
}

async function getRawPublicKeyFromWebAuthN(publicPasskey: Uint8Array): Promise<[Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>]> {
  const cosePublicKey = decodeFirst<Map<number, unknown>>(publicPasskey);
  const x = cosePublicKey.get(COSEKEYS.x) as Uint8Array;
  const y = cosePublicKey.get(COSEKEYS.y) as Uint8Array;

  return [x, y];
}

// Expects simple-webauthn public key format
async function getPublicKey(publicPasskey: Uint8Array): Promise<[string, string]> {
  const [x, y] = await getRawPublicKeyFromWebAuthN(publicPasskey);
  return ["0x" + Buffer.from(x).toString("hex"), "0x" + Buffer.from(y).toString("hex")];
}

async function getRawPublicKeyFromCrpyto(cryptoKeyPair: CryptoKeyPair) {
  const keyMaterial = await crypto.subtle.exportKey("raw", cryptoKeyPair.publicKey);
  return [new Uint8Array(keyMaterial.slice(1, 33)), new Uint8Array(keyMaterial.slice(33, 65))];
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

// Generate an ECDSA key pair with the P-256 curve (secp256r1)
async function generateES256R1Key() {
  return await crypto.subtle.generateKey(
    r1KeygenParams,
    false,
    ["sign", "verify"]
  );
}

async function signStringWithR1Key(privateKey: CryptoKey, messageBuffer: Uint8Array<ArrayBufferLike>) {
  const signatureBytes = await crypto.subtle.sign(
    r1KeyParams,
    privateKey,
    messageBuffer
  );

  // Check for SEQUENCE marker (0x30) for DER encoding
  if (signatureBytes[0] !== 0x30) {
    if (signatureBytes.byteLength != 64) {
      console.log("no idea what format this is")
      return null;
    }
    return {
      r: new Uint8Array(signatureBytes.slice(0, 32)),
      s: new Uint8Array(signatureBytes.slice(32)),
      signature: new Uint8Array(signatureBytes),
    };
  }

  const totalLength = signatureBytes[1];

  if (signatureBytes[2] !== 0x02) {
    console.log("No r marker")
    return null;
  }

  const rLength = signatureBytes[3];

  if (signatureBytes[4 + rLength] !== 0x02) {
    console.log("No s marker")
    return null;
  }

  const sLength = signatureBytes[5 + rLength];

  if (totalLength !== rLength + sLength + 4) {
    console.log("unexpected data")
    return null;
  }

  const r = new Uint8Array(signatureBytes.slice(4, 4 + rLength));
  const s = new Uint8Array(signatureBytes.slice(4 + rLength + 1, 4 + rLength + 1 + sLength));

  return { r, s, signature: new Uint8Array(signatureBytes) };
}

async function verifySignatureWithR1Key(
  messageBuffer: Uint8Array<ArrayBufferLike>,
  signatureArray: Uint8Array<ArrayBufferLike>[],
  publicKeyBytes: Uint8Array<ArrayBufferLike>[]) {

  const publicKey = await getCrpytoKeyFromBytes(publicKeyBytes)
  const verification = await crypto.subtle.verify(
    r1KeyParams,
    publicKey,
    concat(signatureArray),
    messageBuffer
  );

  return verification;
}

function encodeFatSignature(
  passkeyResponse: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  },
  contracts: {
    passkey: string;
  },
) {
  const signature = unwrapEC2Signature(base64UrlToUint8Array(passkeyResponse.signature));
  return encodeAbiParameters(
    [
      { type: "bytes" }, // authData
      { type: "bytes" }, // clientDataJson
      { type: "bytes32[2]" }, // signature (two elements)
    ],
    [
      toHex(base64UrlToUint8Array(passkeyResponse.authenticatorData)),
      toHex(base64UrlToUint8Array(passkeyResponse.clientDataJSON)),
      [toHex(signature[0]), toHex(signature[1])],
    ],
  );
}

async function rawVerify(
  passkeyValidator: WebAuthValidator,
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

describe.only("Passkey validation", function () {
  const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  const ethersResponse = new RecordedResponse("test/signed-challenge.json");
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

  it("should save a passkey", async function () {
    const passkeyValidator = await deployValidator(wallet);

    const publicKeys = await getPublicKey(publicKeyEs256Bytes);
    const initData = new AbiCoder().encode(["bytes32[2]", "string"], [publicKeys, "http://localhost:5173"]);
    const createdKey = await passkeyValidator.init(initData);
    const keyRecipt = await createdKey.wait();
    assert(keyRecipt?.status == 1, "key was saved");
  })

  it("should add a second validation key", async function () {
    const passkeyValidator = await deployValidator(wallet);

    const publicKeys = await getPublicKey(publicKeyEs256Bytes);
    const initData = new AbiCoder().encode(["bytes32[2]", "string"], [publicKeys, "http://localhost:5173"]);
    await passkeyValidator.init(initData);
    const duplicateCreatedKey = await passkeyValidator.addValidationKey(initData);
    const keyRecipt = await duplicateCreatedKey.wait();
    assert(keyRecipt?.status == 1, "key was saved");
  })

  it("should validate signature", async function () {
    const passkeyValidator = await deployValidator(wallet);

    const publicKeys = await getPublicKey(ethersResponse.passkeyBytes);
    const fatSignature = encodeFatSignature({
      authenticatorData: ethersResponse.authenticatorData,
      clientDataJSON: ethersResponse.clientData,
      signature: ethersResponse.b64SignedChallenge
    }, { passkey: publicKeys[0] });

    const initData = new AbiCoder().encode(["bytes32[2]", "string"], [publicKeys, "http://localhost:5173"]);
    await passkeyValidator.init(initData);

    // get the signature from the same place the checker gets it
    const clientDataJson = JSON.parse(new TextDecoder().decode(ethersResponse.clientDataBuffer));
    const signatureData = base64UrlToUint8Array(clientDataJson['challenge'])

    const createdKey = await passkeyValidator.validateSignature(signatureData, fatSignature);
    assert(createdKey, "invalid sig");
  })

  it("should verify passkey", async function () {
    const passkeyValidator = await deployValidator(wallet);

    // 37 bytes
    const authenticatorData = "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ";
    const clientData = "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ";
    const b64SignedChallange = "MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A";

    const verifyMessage = await rawVerify(
      passkeyValidator,
      authenticatorData, clientData, b64SignedChallange, publicKeyEs256Bytes);

    assert(verifyMessage == true, "valid sig");
  });

  // fully expand the raw validation to compare step by step
  it("should sign with new data", async function () {
    const passkeyValidator = await deployValidator(wallet);
    const hashedData = await toHash(concat([toBuffer(ethersResponse.authenticatorData), await toHash(toBuffer(ethersResponse.clientData))]));
    const recordedSignature = toBuffer(ethersResponse.b64SignedChallenge);
    const [recordedR, recordedS] = unwrapEC2Signature(recordedSignature);
    const [recordedX, recordedY] = await getRawPublicKeyFromWebAuthN(ethersResponse.passkeyBytes);

    // try to compare the signature with the one generated by the browser
    const generatedR1Key = await generateES256R1Key();
    assert(generatedR1Key != null, "no key was generated");
    const [generatedX, generatedY] = await getRawPublicKeyFromCrpyto(generatedR1Key);

    const generatedSignature = await signStringWithR1Key(generatedR1Key.privateKey, hashedData);
    assert(generatedSignature != null, "no signature was generated");

    const offChainGeneratedVerified = await verifySignatureWithR1Key(hashedData, [generatedSignature.r, generatedSignature.s], [generatedX, generatedY]);
    const onChainGeneratedVerified = await passkeyValidator.rawVerify(hashedData, [generatedSignature.r, generatedSignature.s], [generatedX, generatedY]);
    const offChainRecordedVerified = await verifySignatureWithR1Key(hashedData, [recordedR, recordedS], [recordedX, recordedY]);
    const onChainRecordedVerified = await passkeyValidator.rawVerify(hashedData, [recordedR, recordedS], [recordedX, recordedY]);

    console.log("offChainGeneratedVerified", [generatedSignature.r, generatedSignature.s], [generatedX, generatedY]);
    console.log("offChainRecordedVerified ", [recordedR, recordedS], [recordedX, recordedY])
    console.log("onChainRecordedVerified", [recordedR, recordedS], [recordedX, recordedY])
    console.log("onChainGeneratedVerified", [generatedSignature.r, generatedSignature.s], [generatedX, generatedY]);

    console.log("recorded on-chain, verified on-chain", onChainRecordedVerified);
    console.log("recorded on-chain, verified off-chain", offChainRecordedVerified);
    console.log("created off-chain, verified off-chain", offChainGeneratedVerified);
    console.log("created off-chain, verified on-chain", onChainGeneratedVerified);

    assert(onChainRecordedVerified, "on-chain recording self-check");
    assert(offChainGeneratedVerified, "generated self-check");
    assert(onChainGeneratedVerified, "verify generated sig on chain");
    assert(offChainRecordedVerified, "verify recorded sig off chain");
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
