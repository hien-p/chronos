
// Placeholder for SEAL Homomorphic Encryption
// Currently using AES-GCM for demonstration purposes until WASM is available.

export const EncryptionService = {
    /**
     * Generates a random key for AES-GCM.
     * In a real SEAL implementation, this would generate BFV keys.
     */
    async generateKey(): Promise<CryptoKey> {
        return window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    },

    /**
     * Encrypts string data.
     * @param data The plaintext string
     * @param key The CryptoKey (simulating public key)
     * @returns Promise<{ data: Uint8Array, iv: Uint8Array }> Encrypted data and IV
     */
    async encrypt(data: string, key: CryptoKey): Promise<{ encrypted: Uint8Array, iv: Uint8Array }> {
        const encodedData = new TextEncoder().encode(data);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedData
        );

        return {
            encrypted: new Uint8Array(encryptedBuffer),
            iv: iv
        };
    },

    /**
     * Decrypts data.
     * @param encryptedData The encrypted Uint8Array
     * @param iv The initialization vector
     * @param key The CryptoKey (simulating private key)
     * @returns Promise<string> The decrypted string
     */
    async decrypt(encryptedData: Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<string> {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv as unknown as BufferSource
            },
            key,
            encryptedData as unknown as BufferSource
        );

        return new TextDecoder().decode(decryptedBuffer);
    },

    /**
     * Helper to export key to string (for storage/transfer simulation)
     */
    async exportKey(key: CryptoKey): Promise<string> {
        const exported = await window.crypto.subtle.exportKey("jwk", key);
        return JSON.stringify(exported);
    },

    /**
     * Helper to import key from string
     */
    async importKey(keyStr: string): Promise<CryptoKey> {
        const jwk = JSON.parse(keyStr);
        return window.crypto.subtle.importKey(
            "jwk",
            jwk,
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }
};
