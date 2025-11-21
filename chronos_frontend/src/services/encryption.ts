import { SealClient, SessionKey, EncryptedObject } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHEX } from '@mysten/bcs';

// Testnet Key Servers (from docs)
// NOTE: These only work if the contract is deployed on Testnet.
const KEY_SERVERS = [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
];

export const EncryptionService = {
    /**
     * Encrypts data using SEAL.
     */
    async encrypt(data: string | Uint8Array, policyId: string, packageId: string): Promise<Uint8Array> {
        console.log('EncryptionService.encrypt called with:', { dataLength: data.length, policyId, packageId });
        console.log('Types:', { policyIdType: typeof policyId, packageIdType: typeof packageId });

        // Default to Testnet for SEAL interaction (Localnet won't work with real SEAL nodes)
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

        const client = new SealClient({
            suiClient,
            serverConfigs: KEY_SERVERS.map(id => ({ objectId: id, weight: 1 })),
            verifyKeyServers: false
        });

        // Pass hex strings directly (SealClient expects strings, not Uint8Array)
        // Ensure 0x prefix
        const normalizedPackageId = packageId.startsWith('0x') ? packageId : `0x${packageId}`;
        const normalizedPolicyId = policyId.startsWith('0x') ? policyId : `0x${policyId}`;

        const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;

        const { encryptedObject } = await client.encrypt({
            threshold: 1, // 1-of-N for simplicity/demo
            packageId: normalizedPackageId,
            id: normalizedPolicyId,
            data: payload
        });

        // encryptedObject is already a Uint8Array (from client.d.ts)
        return encryptedObject;
    },

    /**
     * Decrypts data using SEAL.
     */
    async decrypt(
        encryptedBytes: Uint8Array,
        sessionKey: SessionKey,
        txBytes: Uint8Array
    ): Promise<string> {
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

        const client = new SealClient({
            suiClient,
            serverConfigs: KEY_SERVERS.map(id => ({ objectId: id, weight: 1 })),
            verifyKeyServers: false
        });

        const decryptedBytes = await client.decrypt({
            data: encryptedBytes,
            sessionKey,
            txBytes,
        });

        return new TextDecoder().decode(decryptedBytes);
    },

    /**
     * Generates a random 32-byte ID for the SEAL policy.
     */
    generatePolicyId(): string {
        const bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};
