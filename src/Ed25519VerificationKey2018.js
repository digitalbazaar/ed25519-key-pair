/*!
 * Copyright (c) 2018-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const env = require('./env');
const forge = require('node-forge');
const {pki: {ed25519}, util: {binary: {base58}}} = forge;
const util = require('./util');
const {LDVerifierKeyPair} = require('crypto-ld');

const SUITE_ID = 'Ed25519VerificationKey2018';

class Ed25519VerificationKey2018 extends LDVerifierKeyPair {
  /* eslint-disable max-len */
  /**
   * An implementation of
   * [Ed25519 Signature 2018]{@link https://w3c-dvcg.github.io/lds-ed25519-2018/}
   * for
   * [jsonld-signatures.]{@link https://github.com/digitalbazaar/jsonld-signatures}
   * @example
   * > const privateKeyBase58 =
   *   '3Mmk4UzTRJTEtxaKk61LxtgUxAa2Dg36jF6VogPtRiKvfpsQWKPCLesKSV182RMmvM'
   *   + 'JKk6QErH3wgdHp8itkSSiF';
   * > const options = {
   *   publicKeyBase58: 'GycSSui454dpYRKiFdsQ5uaE8Gy3ac6dSMPcAoQsk8yq',
   *   privateKeyBase58
   * };
   * > const EDKey = new Ed25519VerificationKey2018(options);
   * > EDKey
   * Ed25519VerificationKey2018 { ...
   * @param {object} options - Options hashmap.
   * @param {string} options.publicKeyBase58 - Base58 encoded Public Key
   *   (unencoded is 32-bytes).
   * @param {string} [options.privateKeyBase58] - Base58 Private Key
   *   (unencoded is 64-bytes).
   */
  /* eslint-enable */
  constructor(options = {}) {
    super(options);
    this.type = SUITE_ID;
    this.publicKeyBase58 = options.publicKeyBase58;
    if(!this.publicKeyBase58) {
      throw new TypeError('The "publicKeyBase58" property is required.');
    }
    this.privateKeyBase58 = options.privateKeyBase58;
    if(this.controller && !this.id) {
      this.id = `${this.controller}#${this.fingerprint()}`;
    }
  }
  /**
   * Returns the Base58 encoded public key.
   * @readonly
   *
   * @returns {string} The Base58 encoded public key.
   */
  get publicKey() {
    return this.publicKeyBase58;
  }
  /**
   * Returns the Base58 encoded private key.
   * @readonly
   *
   * @returns {string} The Base58 encoded private key.
   */
  get privateKey() {
    return this.privateKeyBase58;
  }

  /**
   * Creates an instance of LDKeyPair from a key fingerprint.
   * Note: Only key types that use their full public key in the fingerprint
   * are supported (so, currently, only 'ed25519').
   *
   * @param {string} fingerprint
   * @returns {LDKeyPair}
   * @throws Unsupported Fingerprint Type.
   */
  static fromFingerprint({fingerprint}) {
    // skip leading `z` that indicates base58 encoding
    const buffer = base58.decode(fingerprint.substr(1));

    // buffer is: 0xed 0x01 <public key bytes>
    if(buffer[0] === 0xed && buffer[1] === 0x01) {
      return new Ed25519VerificationKey2018({
        publicKeyBase58: base58.encode(buffer.slice(2))
      });
    }

    throw new Error(`Unsupported Fingerprint Type: ${fingerprint}`);
  }

  /**
   * Generates a KeyPair with an optional deterministic seed.
   * @example
   * > const keyPair = await Ed25519VerificationKey2018.generate();
   * > keyPair
   * Ed25519VerificationKey2018 { ...
   * @param {object} [options={}] - See LDKeyPair
   * docstring for full list.
   * @param {Uint8Array|Buffer} [options.seed] -
   * a 32-byte array seed for a deterministic key.
   *
   * @returns {Promise<Ed25519VerificationKey2018>} Generates a key pair.
   */
  static async generate(options = {}) {
    if(env.nodejs && require('semver').gte(process.version, '12.0.0')) {
      const bs58 = require('bs58');
      const {
        asn1, ed25519: {privateKeyFromAsn1, publicKeyFromAsn1},
        util: {ByteBuffer}
      } = forge;
      const {promisify} = require('util');
      const {createPublicKey, generateKeyPair} = require('crypto');
      const publicKeyEncoding = {format: 'der', type: 'spki'};
      const privateKeyEncoding = {format: 'der', type: 'pkcs8'};
      // if no seed provided, generate a random key
      if(!('seed' in options)) {
        const generateKeyPairAsync = promisify(generateKeyPair);
        const {publicKey, privateKey} = await generateKeyPairAsync('ed25519', {
          publicKeyEncoding, privateKeyEncoding
        });
        const publicKeyBytes = publicKeyFromAsn1(
          asn1.fromDer(new ByteBuffer(publicKey)));
        const {privateKeyBytes} = privateKeyFromAsn1(
          asn1.fromDer(new ByteBuffer(privateKey)));

        return new Ed25519VerificationKey2018({
          publicKeyBase58: bs58.encode(publicKeyBytes),
          // private key is the 32 byte private key + 32 byte public key
          privateKeyBase58: bs58.encode(Buffer.concat(
            [privateKeyBytes, publicKeyBytes])),
          ...options
        });
      }
      // create a key from the provided seed
      const {seed} = options;
      let seedBytes;
      if(seed instanceof Uint8Array || Buffer.isBuffer(seed)) {
        seedBytes = Buffer.from(seed);
      }
      if(!(Buffer.isBuffer(seedBytes) && seedBytes.length === 32)) {
        throw new TypeError('`seed` must be a 32 byte Buffer or Uint8Array.');
      }
      const _privateKey = require('./ed25519PrivateKeyNode12');

      // create a node private key
      const privateKey = _privateKey.create({seedBytes});

      // create a node public key from the private key
      const publicKey = createPublicKey(privateKey);

      // export the keys and extract key bytes from the exported DERs
      const publicKeyBytes = publicKeyFromAsn1(
        asn1.fromDer(new ByteBuffer(publicKey.export(publicKeyEncoding))));
      const {privateKeyBytes} = privateKeyFromAsn1(
        asn1.fromDer(new ByteBuffer(privateKey.export(privateKeyEncoding))));

      return new Ed25519VerificationKey2018({
        publicKeyBase58: bs58.encode(publicKeyBytes),
        // private key is the 32 byte private key + 32 byte public key
        privateKeyBase58: bs58.encode(Buffer.concat(
          [privateKeyBytes, publicKeyBytes])),
        ...options
      });
    }

    const generateOptions = {};
    if('seed' in options) {
      generateOptions.seed = options.seed;
    }
    const {publicKey, privateKey} = ed25519.generateKeyPair(generateOptions);
    return new Ed25519VerificationKey2018({
      publicKeyBase58: base58.encode(publicKey),
      privateKeyBase58: base58.encode(privateKey),
      ...options
    });
  }
  /**
   * Creates an Ed25519 Key Pair from an existing serialized key pair.
   * @example
   * > const keyPair = await Ed25519VerificationKey2018.from({
   *     controller: 'did:ex:1234',
   *     type: 'Ed25519VerificationKey2018',
   *     publicKeyBase58,
   *     privateKeyBase58
   *   });
   *
   * @returns {Promise<Ed25519VerificationKey2018>} An Ed25519 Key Pair.
   */
  static async from(options) {
    return new Ed25519VerificationKey2018(options);
  }

  /* eslint-disable max-len */
  /**
   * Returns a signer object for use with
   * [jsonld-signatures]{@link https://github.com/digitalbazaar/jsonld-signatures}.
   * @example
   * > const signer = keyPair.signer();
   * > signer
   * { sign: [AsyncFunction: sign] }
   * > signer.sign({data});
   *
   * @returns {{sign: Function}} A signer for the json-ld block.
   */
  /* eslint-enable */
  signer() {
    return ed25519SignerFactory(this);
  }

  /* eslint-disable max-len */
  /**
   * Returns a verifier object for use with
   * [jsonld-signatures]{@link https://github.com/digitalbazaar/jsonld-signatures}.
   * @example
   * > const verifier = keyPair.verifier();
   * > verifier
   * { verify: [AsyncFunction: verify] }
   * > verifier.verify(key);
   *
   * @returns {{verify: Function}} Used to verify jsonld-signatures.
   */
  /* eslint-enable */
  verifier() {
    return ed25519VerifierFactory(this);
  }

  /* eslint-disable max-len */
  /**
   * Adds a public key base to a public key node.
   * @example
   * > keyPair.addEncodedPublicKey({});
   * { publicKeyBase58: 'GycSSui454dpYRKiFdsQ5uaE8Gy3ac6dSMPcAoQsk8yq' }
   * @param {Object} publicKeyNode - The public key node in a jsonld-signature.
   * @param {string} publicKeyNode.publicKeyBase58 - Base58 Public Key for
   * [jsonld-signatures]{@link https://github.com/digitalbazaar/jsonld-signatures}.
   *
   * @returns {{verify: Function}} A PublicKeyNode in a block.
   */
  /* eslint-enable */
  addPublicKey(publicKeyNode) {
    publicKeyNode.publicKeyBase58 = this.publicKeyBase58;
    return publicKeyNode;
  }

  /**
   * Adds an encrypted private key to the KeyPair.
   * @param {Object} keyNode - A plain object.
   *
   * @return {Object} The keyNode with an encrypted private key attached.
   */
  async addPrivateKey(keyNode) {
    keyNode.privateKeyBase58 = this.privateKeyBase58;
    return keyNode;
  }

  /**
   * Generates and returns a multiformats encoded
   * ed25519 public key fingerprint (for use with cryptonyms, for example).
   * @see https://github.com/multiformats/multicodec
   *
   * @param {string} publicKeyBase58 - The base58 encoded public key material.
   *
   * @returns {string} The fingerprint.
   */
  static fingerprintFromPublicKey({publicKeyBase58}) {
    // ed25519 cryptonyms are multicodec encoded values, specifically:
    // (multicodec ed25519-pub 0xed01 + key bytes)
    const pubkeyBytes = util.base58Decode({
      decode: base58.decode,
      keyMaterial: publicKeyBase58,
      type: 'public'
    });
    const buffer = new Uint8Array(2 + pubkeyBytes.length);
    buffer[0] = 0xed;
    buffer[1] = 0x01;
    buffer.set(pubkeyBytes, 2);
    // prefix with `z` to indicate multi-base base58btc encoding
    return `z${base58.encode(buffer)}`;
  }

  /**
   * Generates and returns a multiformats encoded
   * ed25519 public key fingerprint (for use with cryptonyms, for example).
   * @see https://github.com/multiformats/multicodec
   *
   * @returns {string} The fingerprint.
   */
  fingerprint() {
    const {publicKeyBase58} = this;
    return Ed25519VerificationKey2018.fingerprintFromPublicKey({publicKeyBase58});
  }

  /**
   * Tests whether the fingerprint was
   * generated from a given key pair.
   * @example
   * > edKeyPair.verifyFingerprint('z2S2Q6MkaFJewa');
   * {valid: true};
   * @param {string} fingerprint - A Base58 public key.
   *
   * @returns {Object} An object indicating valid is true or false.
   */
  verifyFingerprint(fingerprint) {
    // fingerprint should have `z` prefix indicating
    // that it's multi-base encoded
    if(!(typeof fingerprint === 'string' && fingerprint[0] === 'z')) {
      return {
        error: new Error('`fingerprint` must be a multibase encoded string.'),
        valid: false
      };
    }
    let fingerprintBuffer;
    try {
      fingerprintBuffer = util.base58Decode({
        decode: base58.decode,
        keyMaterial: fingerprint.slice(1),
        type: `fingerprint's`
      });
    } catch(e) {
      return {error: e, valid: false};
    }
    let publicKeyBuffer;
    try {
      publicKeyBuffer = util.base58Decode({
        decode: base58.decode,
        keyMaterial: this.publicKeyBase58,
        type: 'public'
      });
    } catch(e) {
      return {error: e, valid: false};
    }

    // validate the first two multicodec bytes 0xed01
    const valid = fingerprintBuffer.slice(0, 2).toString('hex') === 'ed01' &&
      publicKeyBuffer.equals(fingerprintBuffer.slice(2));
    if(!valid) {
      return {
        error: new Error('The fingerprint does not match the public key.'),
        valid: false
      };
    }
    return {valid};
  }
}

/**
 * @ignore
 * Returns an object with an async sign function.
 * The sign function is bound to the KeyPair
 * and then returned by the KeyPair's signer method.
 * @param {Ed25519VerificationKey2018} key - A key par instance.
 * @example
 * > const mySigner = ed25519SignerFactory(edKeyPair);
 * > await mySigner.sign({data})
 *
 * @returns {{sign: Function}} An object with an async function sign
 * using the private key passed in.
 */
function ed25519SignerFactory(key) {
  if(!key.privateKeyBase58) {
    return {
      async sign() {
        throw new Error('No private key to sign with.');
      }
    };
  }

  if(env.nodejs && require('semver').gte(process.version, '12.0.0')) {
    const bs58 = require('bs58');
    const privateKeyBytes = util.base58Decode({
      decode: bs58.decode,
      keyMaterial: key.privateKeyBase58,
      type: 'private'
    });

    const _privateKey = require('./ed25519PrivateKeyNode12');
    // create a Node private key
    const privateKey = _privateKey.create({privateKeyBytes});
    const {sign} = require('crypto');

    return {
      async sign({data}) {
        const signature = sign(
          null, Buffer.from(data.buffer, data.byteOffset, data.length),
          privateKey);
        return signature;
      }
    };
  }

  // browser implementation
  const privateKey = util.base58Decode({
    decode: base58.decode,
    keyMaterial: key.privateKeyBase58,
    type: 'private'
  });
  return {
    async sign({data}) {
      return ed25519.sign({message: data, privateKey});
    }
  };
}

/**
 * @ignore
 * Returns an object with an async verify function.
 * The verify function is bound to the KeyPair
 * and then returned by the KeyPair's verifier method.
 * @param {Ed25519VerificationKey2018} key - An Ed25519VerificationKey2018.
 * @example
 * > const myVerifier = ed25519Verifier(edKeyPair);
 * > await myVerifier.verify({data, signature});
 *
 * @returns {{verify: Function}} An async verifier specific
 * to the key passed in.
 */
function ed25519VerifierFactory(key) {
  if(env.nodejs && require('semver').gte(process.version, '12.0.0')) {
    const bs58 = require('bs58');
    const publicKeyBytes = util.base58Decode({
      decode: bs58.decode,
      keyMaterial: key.publicKeyBase58,
      type: 'public'
    });
    const _publicKey = require('./ed25519PublicKeyNode12');
    // create a Node public key
    const publicKey = _publicKey.create({publicKeyBytes});
    const {verify} = require('crypto');
    return {
      async verify({data, signature}) {
        return verify(
          null, Buffer.from(data.buffer, data.byteOffset, data.length),
          publicKey, signature);
      }
    };
  }

  // browser implementation
  const publicKey = util.base58Decode({
    decode: base58.decode,
    keyMaterial: key.publicKeyBase58,
    type: 'public'
  });
  return {
    async verify({data, signature}) {
      return ed25519.verify({message: data, signature, publicKey});
    }
  };
}

Ed25519VerificationKey2018.suite = SUITE_ID;

module.exports = {
  Ed25519VerificationKey2018
};
