/**
 * Web Crypto API primitives for End-to-End Encryption (E2EE)
 * AES-256-GCM symmetric encryption with ECDH (P-256) key agreement
 * and PBKDF2 passphrase key derivation.
 */

// Helper: Uint8Array <-> Base64
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate ECDH Key Pair (P-256)
export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Export public key to base64 raw string
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

// Import raw base64 public key
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

// Derive AES-GCM 256-bit symmetric session key via ECDH
export async function deriveSharedKey(
  localPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: remotePublicKey,
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Derive AES-GCM key from room password using PBKDF2
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt = 'peer-to-peer-e2ee-room-salt-2026'
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt string or byte buffer
export async function encryptData(
  data: string | Uint8Array | ArrayBuffer,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  let encoded: Uint8Array;
  if (typeof data === 'string') {
    encoded = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    encoded = data;
  } else {
    encoded = new Uint8Array(data);
  }

  // Generate 96-bit (12-byte) cryptographically random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}

// Decrypt ciphertext with IV
export async function decryptData(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    key,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}

// Decrypt and decode string
export async function decryptString(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const bytes = await decryptData(ciphertextBase64, ivBase64, key);
  return new TextDecoder().decode(bytes);
}

// Compute SHA-256 checksum for file verification
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate cryptographic fingerprint (like Signal / WhatsApp key fingerprints)
export async function generateFingerprint(base64PublicKey: string): Promise<string> {
  const buffer = new TextEncoder().encode(base64PublicKey);
  const hash = await computeSha256(buffer);
  // Format as 4 groups of 4 hex chars: ABCD-1234-EF56-7890
  return hash.slice(0, 16).toUpperCase().match(/.{1,4}/g)?.join(' ') || hash.slice(0, 16);
}

// SAS (Short Authentication String) Emojis for quick visual MITM verification
const SAS_EMOJIS = [
  '🛡️', '⚡', '🔐', '🚀', '🔑', '💎', '🪐', '🌊',
  '🦅', '🎯', '🌟', '🔥', '⚓', '🍀', '🛰️', '🔮'
];

export async function generateSas(pubKeyA: string, pubKeyB: string): Promise<{ emojis: string[]; code: string }> {
  const combined = [pubKeyA, pubKeyB].sort().join('::');
  const hash = await computeSha256(new TextEncoder().encode(combined));
  
  // Pick 4 emojis based on hex digits
  const emojis = [
    SAS_EMOJIS[parseInt(hash.slice(0, 2), 16) % SAS_EMOJIS.length],
    SAS_EMOJIS[parseInt(hash.slice(2, 4), 16) % SAS_EMOJIS.length],
    SAS_EMOJIS[parseInt(hash.slice(4, 6), 16) % SAS_EMOJIS.length],
    SAS_EMOJIS[parseInt(hash.slice(6, 8), 16) % SAS_EMOJIS.length],
  ];

  // 6-digit numeric verification code
  const codeNum = (parseInt(hash.slice(0, 8), 16) % 900000) + 100000;

  return { emojis, code: codeNum.toString() };
}
