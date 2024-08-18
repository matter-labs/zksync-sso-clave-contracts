/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) 2018-2023 Coinbase, Inc. <https://www.coinbase.com/>

import type { Address } from 'viem';
import { standardErrors } from '../error/index.js';
import { HexString, IntNumber } from './index.js';

const INT_STRING_REGEX = /^[0-9]*$/;
const HEXADECIMAL_STRING_REGEX = /^[a-f0-9]*$/;

export function hexStringFromIntNumber(num: IntNumber): HexString {
  return HexString(`0x${BigInt(num).toString(16)}`);
}

export function has0xPrefix(str: string): boolean {
  return str.startsWith('0x') || str.startsWith('0X');
}

export function strip0x(hex: string): string {
  if (has0xPrefix(hex)) {
    return hex.slice(2);
  }
  return hex;
}

export function isHexString(hex: unknown): hex is HexString {
  if (typeof hex !== 'string') {
    return false;
  }
  const s = strip0x(hex).toLowerCase();
  return HEXADECIMAL_STRING_REGEX.test(s);
}

export function ensureHexString(hex: unknown, includePrefix = false): HexString {
  if (typeof hex === 'string') {
    const s = strip0x(hex).toLowerCase();
    if (HEXADECIMAL_STRING_REGEX.test(s)) {
      return HexString(includePrefix ? `0x${s}` : s);
    }
  }
  throw standardErrors.rpc.invalidParams(`"${String(hex)}" is not a hexadecimal string`);
}

export function ensureEvenLengthHexString(hex: unknown, includePrefix = false): HexString {
  let h = ensureHexString(hex, false);
  if (h.length % 2 === 1) {
    h = HexString(`0${h}`);
  }
  return includePrefix ? HexString(`0x${h}`) : h;
}

export function ensureIntNumber(num: unknown): IntNumber {
  if (typeof num === 'number' && Number.isInteger(num)) {
    return IntNumber(num);
  }
  if (typeof num === 'string') {
    if (INT_STRING_REGEX.test(num)) {
      return IntNumber(Number(num));
    }
    if (isHexString(num)) {
      return IntNumber(Number(BigInt(ensureEvenLengthHexString(num, true))));
    }
  }
  throw standardErrors.rpc.invalidParams(`Not an integer: ${String(num)}`);
}

export function getFavicon(): string | null {
  const el =
    document.querySelector('link[sizes="192x192"]') ||
    document.querySelector('link[sizes="180x180"]') ||
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]');

  const { protocol, host } = document.location;
  const href = el ? el.getAttribute('href') : null;
  if (!href || href.startsWith('javascript:') || href.startsWith('vbscript:')) {
    return null;
  }
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:')) {
    return href;
  }
  if (href.startsWith('//')) {
    return protocol + href;
  }
  return `${protocol}//${host}${href}`;
}

export function areAddressArraysEqual(arr1: Address[], arr2: Address[]): boolean {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}
