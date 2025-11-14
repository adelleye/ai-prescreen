// Cross-platform WebCrypto helpers without importing Node core modules.
// This avoids bundler issues with "node:" scheme and keeps the module safe to import in the browser.

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle is not available in this environment');
  }
  return subtle;
}

function getRandomValues(length: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('WebCrypto getRandomValues is not available in this environment');
  }
  return c.getRandomValues(new Uint8Array(length));
}

function base64ToBytes(b64: string): Uint8Array {
  // Browser path
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node path (Buffer is available on Node globals)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NodeBuffer = (globalThis as any).Buffer as any;
  if (NodeBuffer) {
    return new Uint8Array(NodeBuffer.from(b64, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

function bytesToBase64(bytes: Uint8Array): string {
  // Browser path
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      const code = bytes[i] ?? 0;
      binary += String.fromCharCode(code);
    }
    return btoa(binary);
  }
  // Node path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NodeBuffer = (globalThis as any).Buffer as any;
  if (NodeBuffer) {
    return NodeBuffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

export async function importAesGcmKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  return getSubtle().importKey('raw', raw as unknown as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptPII(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = getRandomValues(12);
  const encoder = new TextEncoder();
  const cipher = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext) as unknown as BufferSource,
  );
  const cipherBytes = new Uint8Array(cipher as ArrayBuffer);
  const packed = new Uint8Array(iv.length + cipherBytes.length);
  packed.set(iv, 0);
  packed.set(cipherBytes, iv.length);
  return bytesToBase64(packed);
}

export async function decryptPII(key: CryptoKey, ciphertextB64: string): Promise<string> {
  const packed = base64ToBytes(ciphertextB64);
  if (packed.length < 13) {
    throw new Error('Invalid ciphertext');
  }
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const plaintext = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipher as unknown as BufferSource,
  );
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
