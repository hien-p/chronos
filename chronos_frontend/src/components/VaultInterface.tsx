import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Copy, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { WalrusService } from '../services/walrus';
import { EncryptionService } from '../services/encryption';

export default function VaultInterface() {
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

    // Form State
    const [recipient, setRecipient] = useState('0x915c2d19ee5fde257693f25e6c2cabb04c25e7ae03932817d52e122258c88ddb');
    const [secret, setSecret] = useState('');
    const [interval, setInterval] = useState('60000');
    const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
    const [isDeploying, setIsDeploying] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Event Query State
    const { data: vaultEvents, refetch: refetchEvents } = useSuiClientQuery(
        'queryEvents',
        {
            query: { MoveModule: { package: PACKAGE_ID, module: 'chronos' } },
            limit: 50,
            order: 'descending',
        },
        { enabled: !!account, refetchInterval: 5000 }
    );

    const myVaultIds = vaultEvents?.data
        .filter((event) => (event.parsedJson as any)?.creator === account?.address)
        .map((event) => (event.parsedJson as any)?.id) || [];

    const { data: myVaults, refetch: refetchMyVaults } = useSuiClientQuery(
        'multiGetObjects',
        { ids: myVaultIds, options: { showContent: true, showType: true } },
        { enabled: myVaultIds.length > 0 }
    );

    const createVault = async () => {
        if (!account) return;
        setIsDeploying(true);
        setLastCreatedId(null);

        try {
            // 1. Encrypt Data
            setStatusMessage('Encrypting Payload (SEAL/AES)...');
            const key = await EncryptionService.generateKey();
            const { encrypted, iv } = await EncryptionService.encrypt(secret, key);
            const exportedKey = await EncryptionService.exportKey(key);

            // 2. Upload to Walrus
            setStatusMessage('Uploading to Walrus Decentralized Storage...');
            const blobId = await WalrusService.uploadBlob(encrypted);
            console.log('Walrus Blob ID:', blobId);

            // 3. Prepare On-Chain Payload
            const payloadMetadata = JSON.stringify({
                walrusBlobId: blobId,
                iv: Array.from(iv),
                key: exportedKey
            });
            const payloadBytes = new TextEncoder().encode(payloadMetadata);

            setStatusMessage('Signing Transaction...');
            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::chronos::create_vault`,
                arguments: [
                    tx.pure.address(recipient),
                    tx.pure.vector('u8', Array.from(payloadBytes)),
                    tx.pure.u64(BigInt(interval)),
                    tx.object('0x6'),
                ],
            });

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        setStatusMessage('Vault Deployed Successfully!');
                        const createdObjects = (result as any).effects?.created || [];
                        const createdId = createdObjects.find((item: any) => item.owner?.Shared)?.reference?.objectId;
                        if (createdId) {
                            setLastCreatedId(createdId);
                            setTimeout(() => { refetchEvents(); refetchMyVaults(); }, 1000);
                        }
                        setIsDeploying(false);
                    },
                    onError: (err) => {
                        alert(`Transaction Failed: ${err.message}`);
                        setIsDeploying(false);
                        setStatusMessage('');
                    }
                }
            );
        } catch (error: any) {
            alert(`Deployment Failed: ${error.message}`);
            setIsDeploying(false);
            setStatusMessage('');
        }
    };

    const sendHeartbeat = (vaultId: string) => {
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::chronos::keep_alive`,
            arguments: [tx.object(vaultId), tx.object('0x6')],
        });
        signAndExecute({ transaction: tx }, { onSuccess: () => { alert('Heartbeat Sent!'); refetchMyVaults(); } });
    };

    const triggerRelease = (vaultId: string) => {
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::chronos::trigger_release`,
            arguments: [tx.object(vaultId), tx.object('0x6')],
        });
        signAndExecute({ transaction: tx }, { onSuccess: () => alert('Release Triggered!') });
    };

    if (!account) {
        return (
            <div className="flex justify-center py-20">
                <div className="glass-panel p-8 rounded-2xl text-center max-w-md">
                    <h3 className="font-heading text-2xl font-bold mb-4">ACCESS RESTRICTED</h3>
                    <p className="font-mono text-gray-400 mb-6">Connect your wallet to interact with the Chronos Protocol.</p>
                </div>
            </div>
        )
    }

    return (
        <section id="vaults" className="py-20 px-4 max-w-6xl mx-auto">
            <div className="glass-panel rounded-3xl overflow-hidden min-h-[600px] flex flex-col md:flex-row">
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-black/20 border-r border-glass-border p-6 flex flex-col gap-2">
                    <h3 className="font-heading text-xl font-bold mb-6 px-2">COMMAND CENTER</h3>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={clsx(
                            "flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-sm transition-all",
                            activeTab === 'create' ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30" : "text-gray-400 hover:bg-white/5"
                        )}
                    >
                        <Plus className="w-4 h-4" /> Initialize
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={clsx(
                            "flex items-center gap-3 px-4 py-3 rounded-xl font-mono text-sm transition-all",
                            activeTab === 'manage' ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30" : "text-gray-400 hover:bg-white/5"
                        )}
                    >
                        <RefreshCw className="w-4 h-4" /> Active Vaults
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-blue/50 to-transparent opacity-20" />

                    <AnimatePresence mode="wait">
                        {activeTab === 'create' ? (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="max-w-2xl mx-auto"
                            >
                                <h2 className="font-heading text-3xl font-bold mb-8">INITIALIZE NEW VAULT</h2>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="font-mono text-xs text-neon-blue uppercase tracking-widest">Recipient Address</label>
                                        <input
                                            type="text"
                                            value={recipient}
                                            onChange={(e) => setRecipient(e.target.value)}
                                            className="w-full bg-black/40 border border-glass-border rounded-xl p-4 font-mono text-sm focus:border-neon-blue focus:outline-none transition-colors"
                                            placeholder="0x..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs text-neon-blue uppercase tracking-widest">Secret Payload</label>
                                        <textarea
                                            value={secret}
                                            onChange={(e) => setSecret(e.target.value)}
                                            rows={4}
                                            className="w-full bg-black/40 border border-glass-border rounded-xl p-4 font-mono text-sm focus:border-neon-blue focus:outline-none transition-colors"
                                            placeholder="Enter sensitive data..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="font-mono text-xs text-neon-blue uppercase tracking-widest">Heartbeat Interval (ms)</label>
                                        <input
                                            type="number"
                                            value={interval}
                                            onChange={(e) => setInterval(e.target.value)}
                                            className="w-full bg-black/40 border border-glass-border rounded-xl p-4 font-mono text-sm focus:border-neon-blue focus:outline-none transition-colors"
                                        />
                                    </div>

                                    <button
                                        onClick={createVault}
                                        disabled={!recipient || !secret || isDeploying}
                                        className="w-full py-4 bg-neon-blue text-black font-bold font-heading uppercase tracking-wider rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
                                    >
                                        {isDeploying ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {statusMessage || 'Processing...'}
                                            </>
                                        ) : (
                                            'Deploy Vault Contract'
                                        )}
                                    </button>

                                    {lastCreatedId && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-xl mt-6"
                                        >
                                            <p className="font-mono text-xs text-neon-blue mb-2">DEPLOYMENT SUCCESSFUL</p>
                                            <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg">
                                                <code className="text-xs text-gray-300">{lastCreatedId}</code>
                                                <button onClick={() => navigator.clipboard.writeText(lastCreatedId)} className="text-neon-blue hover:text-white">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="manage"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="font-heading text-3xl font-bold">ACTIVE VAULTS</h2>
                                    <button onClick={() => { refetchEvents(); refetchMyVaults(); }} className="p-2 hover:bg-white/5 rounded-lg">
                                        <RefreshCw className="w-5 h-5 text-neon-blue" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {myVaults?.map((obj) => {
                                        const content = obj.data?.content as any;
                                        const fields = content?.fields;
                                        if (!fields) return null;

                                        const lastHeartbeat = Number(fields.last_heartbeat);
                                        const interval = Number(fields.interval);
                                        const releaseTime = lastHeartbeat + interval;
                                        const isExpired = Date.now() > releaseTime;

                                        return (
                                            <div key={obj.data?.objectId} className="p-6 bg-black/40 border border-glass-border rounded-xl hover:border-neon-blue/30 transition-colors group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={clsx("w-2 h-2 rounded-full", isExpired ? "bg-red-500 animate-pulse" : "bg-green-500")} />
                                                            <span className="font-mono text-xs text-gray-400">{obj.data?.objectId.slice(0, 8)}...</span>
                                                        </div>
                                                        <h4 className="font-heading font-bold text-lg">Vault Protocol</h4>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => sendHeartbeat(obj.data?.objectId!)} className="px-4 py-2 bg-white/5 hover:bg-neon-blue hover:text-black border border-glass-border rounded-lg font-mono text-xs transition-all">
                                                            SEND HEARTBEAT
                                                        </button>
                                                        {isExpired && (
                                                            <button onClick={() => triggerRelease(obj.data?.objectId!)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-lg font-mono text-xs transition-all">
                                                                RELEASE
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 font-mono text-xs text-gray-500">
                                                    <div>
                                                        <p className="mb-1">RECIPIENT</p>
                                                        <p className="text-gray-300">{fields.recipient.slice(0, 6)}...{fields.recipient.slice(-4)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="mb-1">STATUS</p>
                                                        <p className={isExpired ? "text-red-400" : "text-green-400"}>
                                                            {isExpired ? "EXPIRED - RELEASE READY" : "ACTIVE - MONITORING"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!myVaults || myVaults.length === 0) && (
                                        <div className="text-center py-12 text-gray-500 font-mono">No active vaults found.</div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
}
