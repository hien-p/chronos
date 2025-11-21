import { webcrypto } from 'node:crypto';

// Polyfill window.crypto for Node.js environment
if (!global.window) {
    global.window = { crypto: webcrypto };
}

const EncryptionService = {
    async generateKey() {
        return window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    },

    async encrypt(data, key) {
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

    async decrypt(encryptedData, iv, key) {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encryptedData
        );

        return new TextDecoder().decode(decryptedBuffer);
    },

    async exportKey(key) {
        const exported = await window.crypto.subtle.exportKey("jwk", key);
        return JSON.stringify(exported);
    }
};

async function runTest() {
    console.log("Starting EncryptionService Test...");
    const start = Date.now();

    try {
        console.log("[1/4] Generating Key...");
        const key = await EncryptionService.generateKey();
        console.log("✓ Key Generated");

        const secret = "This is a test secret for Chronos";
        console.log(`[2/4] Encrypting payload: "${secret}"...`);
        const { encrypted, iv } = await EncryptionService.encrypt(secret, key);
        console.log(`✓ Encrypted (Size: ${encrypted.length} bytes)`);

        console.log("[3/4] Exporting Key...");
        const exportedKey = await EncryptionService.exportKey(key);
        console.log("✓ Key Exported");

        console.log("[4/4] Decrypting verification...");
        const decrypted = await EncryptionService.decrypt(encrypted, iv, key);

        if (decrypted === secret) {
            console.log(`✓ Decryption Successful: "${decrypted}"`);
            console.log(`\nTotal Time: ${Date.now() - start}ms`);
            console.log("STATUS: PASS");
        } else {
            console.error("Mismatch!");
            console.log("STATUS: FAIL");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

runTest();
