/*
 * Copyright (c) 2018-2020 Digital Bazaar, Inc. All rights reserved.
 */

const fromHexString = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

const DER_PRIVATE_KEY_PREFIX = fromHexString(
  '302e020100300506032b657004220420');

const DER_PUBLIC_KEY_PREFIX = fromHexString('302a300506032b6570032100');

const combineTypedArrays = (first, second) => {
  const newArray = new Uint8Array(first.length + second.length);
  newArray.set(first);
  newArray.set(second, first.length);
  return newArray;
};

/**
 * Wraps Base58 decoding operations in
 * order to provide consistent error messages.
 * @ignore
 * @example
 * > const pubkeyBytes = _base58Decode({
 *    decode: base58.decode,
 *    keyMaterial: this.publicKeyBase58,
 *    type: 'public'
 *   });
 * @param {object} options - The decoder options.
 * @param {Function} options.decode - The decode function to use.
 * @param {string} options.keyMaterial - The Base58 encoded
 * key material to decode.
 * @param {string} options.type - A description of the
 * key material that will be included
 * in an error message (e.g. 'public', 'private').
 *
 * @returns {object} - The decoded bytes. The data structure for the bytes is
 *   determined by the provided decode function.
 */
export function base58Decode({decode, keyMaterial, type}) {
  let bytes;
  try {
    bytes = decode(keyMaterial);
  } catch(e) {
    console.error(e);
    // do nothing
    // the bs58 implementation throws, forge returns undefined
    // this helper throws when no result is produced
  }
  if(bytes === undefined) {
    throw new TypeError(`The ${type} key material must be Base58 encoded.`);
  }
  return bytes;
}

export function privateKeyDerEncode({privateKeyBytes, seedBytes}) {
  if(!(privateKeyBytes || seedBytes)) {
    throw new TypeError('`privateKeyBytes` or `seedBytes` is required.');
  }
  if(!privateKeyBytes && !(seedBytes instanceof Uint8Array &&
    seedBytes.length === 32)) {
    throw new TypeError('`seedBytes` must be a 32 byte Buffer.');
  }
  if(!seedBytes && !(privateKeyBytes instanceof Uint8Array &&
    privateKeyBytes.length === 64)) {
    throw new TypeError('`privateKeyBytes` must be a 64 byte Buffer.');
  }
  let p;
  if(seedBytes) {
    p = seedBytes;
  } else {
    // extract the first 32 bytes of the 64 byte private key representation
    p = privateKeyBytes.slice(0, 32);
  }
  return combineTypedArrays(DER_PRIVATE_KEY_PREFIX, p);
}

export function publicKeyDerEncode({publicKeyBytes}) {
  if(!(publicKeyBytes instanceof Uint8Array && publicKeyBytes.length === 32)) {
    throw new TypeError('`publicKeyBytes` must be a 32 byte Buffer.');
  }
  return combineTypedArrays(DER_PUBLIC_KEY_PREFIX, publicKeyBytes);
}
