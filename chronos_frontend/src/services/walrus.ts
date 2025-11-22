// Walrus Aggregator Endpoints (Testnet)
const PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export const WalrusService = {
    /**
     * Uploads data to Walrus and returns the Blob ID.
     * @param data The data to upload (Uint8Array)
     * @returns Promise<string> The Blob ID
     */
    async uploadBlob(data: Uint8Array): Promise<string> {
        try {
            const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=5`, {
                method: 'PUT',
                body: data as unknown as BodyInit,
            });

            if (!response.ok) {
                throw new Error(`Walrus Upload Failed: ${response.statusText}`);
            }

            const result = await response.json();

            // The response structure depends on the aggregator version, 
            // typically it returns a 'newlyCreated' or 'alreadyCertified' object containing the blobId.
            const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId;

            if (!blobId) {
                throw new Error('Invalid response from Walrus: No Blob ID found');
            }

            return blobId;
        } catch (error) {
            console.error('WalrusService Error:', error);
            throw error;
        }
    },

    /**
     * Reads a blob from Walrus by ID.
     * @param blobId The Blob ID
     * @returns Promise<Uint8Array> The blob data
     */
    async readBlob(blobId: string): Promise<Uint8Array> {
        try {

            // Correct path is /v1/blobs/<blob_id>
            const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`, {
                method: 'GET',
            });

            if (!response.ok) {

                console.error(`Walrus Read Error: ${response.status} ${response.statusText}`);
                throw new Error(`Walrus Read Failed: ${response.statusText} (${response.status})`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        } catch (error) {
            console.error('WalrusService Error:', error);
            throw error;
        }
    }
};
