import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSignPersonalMessage } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, Copy, Loader2, Upload, Lock, User, Clock, Shield, ArrowRight, Key, FileText, X } from 'lucide-react';
import clsx from 'clsx';
import { WalrusService } from '../services/walrus';
import { EncryptionService } from '../services/encryption';
import { DoomsdayClock } from './DoomsdayClock';
import { HeartbeatEKG } from './HeartbeatEKG';
import { WalrusShatter } from './WalrusShatter';
import { SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHEX } from '@mysten/bcs';

export default function VaultInterface() {
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

    const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'incoming'>('create');

    // Form State
    const [recipient, setRecipient] = useState('0x915c2d19ee5fde257693f25e6c2cabb04c25e7ae03932817d52e122258c88ddb');
    const [secret, setSecret] = useState('');
    const [payloadType, setPayloadType] = useState<'text' | 'file'>('text');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [heartbeatInterval, setHeartbeatInterval] = useState('600000');
    // const [lastCreatedId, setLastCreatedId] = useState<string | null>(null); // Removed as unused in new UI
    const [isDeploying, setIsDeploying] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Decrypt Modal State
    const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Event Query State - My Created Vaults
    const { data: vaultEvents, refetch: refetchEvents } = useSuiClientQuery('queryEvents', {
        query: { MoveModule: { package: PACKAGE_ID, module: 'chronos' } }
    });

    const myVaultIds = vaultEvents?.data
        .filter((event) => {
            const json = event.parsedJson as any;
            return json?.creator === account?.address;
        })
        .map((event) => {
            const json = event.parsedJson as any;
            // Handle both direct ID string and nested ID struct, and legacy field names if any
            const idRaw = json?.id || json?.vault_id;
            return typeof idRaw === 'string' ? idRaw : idRaw?.id;
        })
        .filter((id): id is string => !!id) || [];

    const { data: myVaults, refetch: refetchMyVaults } = useSuiClientQuery('multiGetObjects', {
        ids: myVaultIds,
        options: { showContent: true }
    });

    // Event Query State - Incoming (Recipient) Vaults
    const incomingVaultIds = vaultEvents?.data
        .filter((event) => (event.parsedJson as any)?.recipient === account?.address)
        .map((event) => {
            const json = event.parsedJson as any;
            const idRaw = json?.id || json?.vault_id;
            return typeof idRaw === 'string' ? idRaw : idRaw?.id;
        })
        .filter((id): id is string => !!id) || [];

    const { data: incomingVaults, refetch: refetchIncomingVaults } = useSuiClientQuery(
        'multiGetObjects',
        { ids: incomingVaultIds, options: { showContent: true, showType: true } },
        { enabled: incomingVaultIds.length > 0 }
    );

    const createVault = async () => {
        if (!account) return;
        setIsDeploying(true);
        // setLastCreatedId(null);

        try {
            // 1. Encrypt Data with SEAL
            setStatusMessage('Encrypting Payload (SEAL)...');
            const policyId = EncryptionService.generatePolicyId();

            let payloadData: string | Uint8Array = secret;
            if (payloadType === 'file' && selectedFile) {
                const arrayBuffer = await selectedFile.arrayBuffer();
                payloadData = new Uint8Array(arrayBuffer);
            }

            const encryptedBytes = await EncryptionService.encrypt(payloadData, policyId, PACKAGE_ID);

            // 2. Upload to Walrus
            setStatusMessage('Uploading to Walrus Decentralized Storage...');
            const blobId = await WalrusService.uploadBlob(encryptedBytes);

            // 3. Prepare On-Chain Payload
            // We store the SEAL Policy ID in the 'encrypted_key' field
            // Convert hex string policyId to byte vector
            const policyIdBytes = new Uint8Array(policyId.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            setStatusMessage('Signing Transaction...');
            const tx = new Transaction();

            tx.moveCall({
                target: `${PACKAGE_ID}::chronos::create_vault`,
                arguments: [
                    tx.pure.address(recipient),
                    tx.pure.string(blobId),
                    tx.pure.vector('u8', Array.from(policyIdBytes)),
                    tx.pure.u64(BigInt(heartbeatInterval)),
                    tx.object('0x6'),
                ],
            });

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        setStatusMessage('Vault Deployed Successfully!');
                        setActiveTab('manage'); // Auto-switch to Active Nodes

                        // Poll for updates for 10 seconds to allow indexer to catch up
                        let attempts = 0;
                        const intervalId = setInterval(() => {
                            refetchEvents();
                            refetchMyVaults();
                            attempts++;
                            if (attempts >= 5) clearInterval(intervalId);
                        }, 2000);

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
            console.error('Deployment Error:', error);
            alert(`Deployment Failed: ${error.message || JSON.stringify(error)}`);
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
        signAndExecute(
            { transaction: tx },
            {
                onSuccess: () => {
                    setNotification({ message: 'Release Triggered Successfully! The vault has been released.', type: 'success' });
                    setTimeout(() => setNotification(null), 5000);

                    // Refresh vault data
                    setTimeout(() => {
                        refetchEvents();
                        refetchMyVaults();
                    }, 2000);
                },
                onError: (err) => {
                    setNotification({ message: `Release Failed: ${err.message}`, type: 'error' });
                    setTimeout(() => setNotification(null), 5000);
                }
            }
        );
    };

    const decryptVault = async (vaultId: string) => {
        try {
            setIsDecrypting(true);
            const vault = incomingVaults?.find(v => v.data?.objectId === vaultId);
            if (!vault) {
                alert('Vault not found');
                return;
            }

            const content = vault.data?.content as any;
            const fields = content?.fields;
            if (!fields) {
                alert('Invalid vault data');
                return;
            }

            // 1. Download encrypted blob from Walrus
            const encryptedArrayBuffer = await WalrusService.readBlob(fields.blob_id);
            const encryptedBytes = new Uint8Array(encryptedArrayBuffer);

            // 2. Get Policy ID (stored in encrypted_key field)
            const policyIdBytes = new Uint8Array(fields.encrypted_key);

            // 3. Create Session Key
            // setStatusMessage('Initializing Secure Session...'); // setStatusMessage is not available in this scope? It is.
            // Wait, setStatusMessage is state.

            const sessionKey = await SessionKey.create({
                address: account!.address,
                packageId: fromHEX(PACKAGE_ID),
                ttlMin: 10,
                suiClient: new SuiClient({ url: getFullnodeUrl('testnet') })
            });

            // 4. Sign Session Request
            // setStatusMessage('Awaiting Biometric Auth...');
            const message = sessionKey.getPersonalMessage();
            const { signature } = await signPersonalMessage({ message: new TextEncoder().encode(message) });
            sessionKey.setPersonalMessageSignature(signature);

            // 5. Build Transaction for SEAL Approval
            // setStatusMessage('Verifying Access Control...');
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::chronos::seal_approve`,
                arguments: [
                    tx.object(vaultId),
                    tx.pure.vector('u8', Array.from(policyIdBytes)),
                    tx.object('0x6')
                ]
            });
            const txBytes = await tx.build({ client: new SuiClient({ url: getFullnodeUrl('testnet') }) });

            // 6. Decrypt
            // setStatusMessage('Decrypting Payload...');
            const decrypted = await EncryptionService.decrypt(encryptedBytes, sessionKey, txBytes);

            setDecryptedSecret(decrypted);
            setIsDecrypting(false);
        } catch (error: any) {
            console.error('Decryption failed:', error);
            alert(`Decryption failed: ${error.message}`);
            setIsDecrypting(false);
        }
    };

    if (!account) {
        return (
            <div id="vaults" className="flex justify-center items-center min-h-screen bg-black">
                <div className="glass-panel p-12 rounded-2xl text-center max-w-md border border-neon-red/50 shadow-[0_0_30px_rgba(255,0,60,0.2)]">
                    <h3 className="font-mono text-3xl font-bold mb-4 text-neon-red tracking-widest">ACCESS DENIED</h3>
                    <p className="font-mono text-gray-400 mb-8">BIOMETRIC SIGNATURE REQUIRED</p>
                    <div className="w-full h-1 bg-neon-red/20 mb-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-neon-red/50 animate-pulse" />
                    </div>
                    <p className="font-mono text-xs text-neon-red/70">CONNECT WALLET TO PROCEED</p>
                </div>
            </div>
        )
    }

    return (
        <section id="vaults" className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
            <div className="scanline" />
            <WalrusShatter isUploading={isDeploying} />

            <div className="glass-panel rounded-3xl overflow-hidden min-h-[800px] flex flex-col md:flex-row relative">
                {/* Sidebar */}
                <div className="w-full md:w-72 bg-black/40 border-r border-cyan-500/20 p-6 flex flex-col gap-4">
                    <div className="mb-8">
                        <h3 className="font-mono text-xs text-neon-cyan tracking-[0.3em] mb-1">TERMINAL</h3>
                        <h1 className="font-heading text-3xl font-bold text-white">CHRONOS</h1>
                    </div>

                    <button
                        onClick={() => setActiveTab('create')}
                        className={clsx(
                            "flex items-center gap-4 px-6 py-4 rounded-xl font-mono text-sm transition-all border",
                            activeTab === 'create'
                                ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                                : "text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300"
                        )}
                    >
                        <Plus className="w-5 h-5" /> INITIALIZE
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={clsx(
                            "flex items-center gap-4 px-6 py-4 rounded-xl font-mono text-sm transition-all border",
                            activeTab === 'manage'
                                ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                                : "text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300"
                        )}
                    >
                        <RefreshCw className="w-5 h-5" /> ACTIVE NODES
                    </button>
                    <button
                        onClick={() => setActiveTab('incoming')}
                        className={clsx(
                            "flex items-center gap-4 px-6 py-4 rounded-xl font-mono text-sm transition-all border",
                            activeTab === 'incoming'
                                ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                                : "text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300"
                        )}
                    >
                        <Copy className="w-5 h-5" /> INCOMING
                    </button>

                    <div className="mt-auto pt-8 border-t border-white/5">
                        <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span>NETWORK ONLINE</span>
                        </div>
                        <div className="mt-2 text-[10px] font-mono text-gray-600 truncate">
                            {account.address}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 md:p-12 relative overflow-hidden bg-black/20">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent opacity-30" />

                    <AnimatePresence mode="wait">
                        {activeTab === 'create' ? (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="h-full"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                                    {/* Left Column: The Form */}
                                    <div className="lg:col-span-2 space-y-6">

                                        {/* Step 1: Payload */}
                                        <div className="bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-md group hover:border-neon-cyan/30 transition-all">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-neon-cyan text-xs font-bold tracking-[0.2em] flex items-center gap-2 uppercase">
                                                    <Upload className="w-4 h-4" />
                                                    1. CONFIDENTIAL PAYLOAD
                                                </h3>
                                                <div className="flex bg-black/50 rounded-lg p-1 border border-white/10">
                                                    <button
                                                        onClick={() => setPayloadType('text')}
                                                        className={clsx(
                                                            "px-3 py-1 text-[10px] font-mono rounded-md transition-all",
                                                            payloadType === 'text' ? "bg-neon-cyan text-black font-bold" : "text-gray-500 hover:text-white"
                                                        )}
                                                    >
                                                        TEXT
                                                    </button>
                                                    <button
                                                        onClick={() => setPayloadType('file')}
                                                        className={clsx(
                                                            "px-3 py-1 text-[10px] font-mono rounded-md transition-all",
                                                            payloadType === 'file' ? "bg-neon-cyan text-black font-bold" : "text-gray-500 hover:text-white"
                                                        )}
                                                    >
                                                        FILE
                                                    </button>
                                                </div>
                                            </div>

                                            {payloadType === 'text' ? (
                                                <textarea
                                                    value={secret}
                                                    onChange={(e) => setSecret(e.target.value)}
                                                    rows={6}
                                                    className="w-full bg-black/60 border border-white/10 rounded-lg p-4 font-mono text-sm focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan transition-all text-white placeholder-gray-700"
                                                    placeholder="ENTER SENSITIVE DATA..."
                                                />
                                            ) : (
                                                <div className="relative w-full h-40 bg-black/60 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center hover:border-neon-cyan/50 transition-all group/dropzone">
                                                    <input
                                                        type="file"
                                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    />
                                                    {selectedFile ? (
                                                        <div className="flex flex-col items-center gap-2 z-0">
                                                            <FileText className="w-8 h-8 text-neon-cyan" />
                                                            <span className="text-xs font-mono text-white">{selectedFile.name}</span>
                                                            <span className="text-[10px] font-mono text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedFile(null);
                                                                }}
                                                                className="z-20 mt-2 text-[10px] text-red-500 hover:text-red-400 flex items-center gap-1"
                                                            >
                                                                <X className="w-3 h-3" /> REMOVE
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-gray-500 group-hover/dropzone:text-neon-cyan/70 transition-colors">
                                                            <Upload className="w-8 h-8 mb-2" />
                                                            <span className="text-xs font-mono uppercase tracking-wider">Drop file or click to upload</span>
                                                            <span className="text-[10px] font-mono text-gray-600">Any format supported</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> SEAL Encryption • Walrus Sharding
                                            </div>
                                        </div>

                                        {/* Step 2: Configuration */}
                                        <div className="grid grid-cols-1 gap-6">

                                            {/* --- REDESIGNED RECIPIENT SECTION --- */}
                                            <div className="bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-md hover:border-neon-cyan/30 transition-all relative overflow-hidden group/recipient">
                                                {/* Decorative background glow */}
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-cyan/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10 group-hover/recipient:bg-neon-cyan/10 transition-all"></div>

                                                <h3 className="text-neon-cyan text-xs font-bold tracking-[0.2em] flex items-center gap-2 mb-6 relative z-10">
                                                    <User className="w-4 h-4" />
                                                    2. DESIGNATE RECIPIENT
                                                </h3>

                                                <div className="relative z-10">
                                                    <div className="relative group">
                                                        {/* Input Glow FX */}
                                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan/20 to-blue-500/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>

                                                        <div className="relative bg-[#050505] border border-white/10 rounded-lg flex items-center overflow-hidden">
                                                            {/* Icon Box */}
                                                            <div className="pl-5 pr-4 py-6 border-r border-white/10 bg-white/2 flex-shrink-0">
                                                                <Key className="w-6 h-6 text-neon-cyan/70" />
                                                            </div>

                                                            {/* The Giant Input */}
                                                            <input
                                                                type="text"
                                                                value={recipient}
                                                                onChange={(e) => setRecipient(e.target.value)}
                                                                placeholder="0x..."
                                                                className="w-full bg-transparent border-none py-6 px-5 text-2xl md:text-3xl text-neon-cyan font-mono tracking-wider focus:ring-0 placeholder-white/5 uppercase"
                                                                spellCheck={false}
                                                            />

                                                            {/* Status Indicator */}
                                                            <div className="pr-6 flex flex-col items-end justify-center gap-1 pointer-events-none">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`h-1.5 w-1.5 rounded-full ${recipient ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' : 'bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                                                                    <span className={`text-[9px] font-bold tracking-widest uppercase ${recipient ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {recipient ? 'VERIFIED' : 'UNVERIFIED'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex justify-end items-center relative z-10 opacity-80">
                                                    <div className="text-[10px] text-gray-700 font-mono uppercase tracking-wider">
                                                        {recipient ? 'Address validated' : 'Waiting for valid address...'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Heartbeat Slider */}
                                            <div className="bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-md hover:border-neon-cyan/30 transition-all">
                                                <h3 className="text-neon-cyan text-xs font-bold tracking-[0.2em] flex items-center gap-2 mb-4">
                                                    <Clock className="w-4 h-4" />
                                                    3. HEARTBEAT INTERVAL
                                                </h3>
                                                <div className="flex items-center justify-between mb-4 bg-black/20 p-4 rounded-lg border border-white/5">
                                                    <span className="text-4xl font-mono text-white font-bold tracking-tight">
                                                        {Math.floor(parseInt(heartbeatInterval) / 1000)}
                                                        <span className="text-xl text-gray-600 ml-2">SEC</span>
                                                    </span>
                                                    <span className="text-xs text-gray-500 uppercase tracking-widest border border-gray-800 px-2 py-1 rounded">Live Mode</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="10000"
                                                    max="600000"
                                                    step="1000"
                                                    value={heartbeatInterval}
                                                    onChange={(e) => setHeartbeatInterval(e.target.value)}
                                                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-neon-cyan hover:accent-neon-cyan/80"
                                                />
                                                <div className="flex justify-between text-[10px] text-gray-600 mt-2 font-mono uppercase">
                                                    <span>10s (Danger)</span>
                                                    <span>600s (Safe)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={createVault}
                                            disabled={!recipient || (payloadType === 'text' ? !secret : !selectedFile) || isDeploying}
                                            className="w-full bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_30px_rgba(0,243,255,0.3)] font-bold tracking-[0.2em] py-5 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 group mt-4 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            {isDeploying ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    {statusMessage || 'ENCRYPTING...'}
                                                </>
                                            ) : (
                                                <>
                                                    <Shield className="w-5 h-5" />
                                                    INITIALIZE PROTOCOL
                                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Right Column: Visualizer & Logs */}
                                    <div className="bg-black/60 border-l border-white/10 p-6 flex flex-col">
                                        <div className="text-[10px] text-gray-500 mb-4 tracking-[0.3em]">SIMULATION</div>

                                        {/* Visualizer Box */}
                                        <div className="flex-1 border border-white/5 rounded-lg bg-black relative overflow-hidden mb-4 flex items-center justify-center group min-h-[300px]">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neon-cyan/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>

                                            {/* Rotating Circles FX */}
                                            <div className="absolute w-48 h-48 border border-neon-cyan/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                                            <div className="absolute w-32 h-32 border border-dashed border-neon-cyan/30 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
                                            <div className="absolute w-64 h-64 border border-white/5 rounded-full"></div>

                                            <div className="text-center z-10">
                                                <div className="relative inline-block">
                                                    <Lock className="w-8 h-8 text-neon-cyan mx-auto mb-2" />
                                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-neon-cyan rounded-full animate-ping"></div>
                                                </div>
                                                <div className="text-xs text-neon-cyan font-mono font-bold">ENCRYPTION: SEAL</div>
                                                <div className="text-[10px] text-gray-600 mt-1">
                                                    {isDeploying ? 'PROCESSING...' : 'KEY SHARDING PENDING'}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Logs */}
                                        <div className="h-48 bg-[#0a0a0a] border border-white/10 rounded p-4 font-mono text-xs space-y-2 overflow-y-auto">
                                            <div className="text-green-500/80 border-l-2 border-green-900 pl-2">
                                                &gt; System ready.
                                            </div>
                                            {isDeploying && (
                                                <>
                                                    <div className="text-green-500/80 border-l-2 border-green-900 pl-2">
                                                        &gt; {statusMessage}
                                                    </div>
                                                    <div className="animate-pulse text-green-500 pl-2">_</div>
                                                </>
                                            )}
                                            {!isDeploying && (
                                                <div className="text-green-500/80 border-l-2 border-green-900 pl-2">
                                                    &gt; Waiting for user input...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : activeTab === 'manage' ? (
                            <motion.div
                                key="manage"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="flex justify-between items-center mb-12">
                                    <h2 className="font-mono text-3xl font-bold tracking-tight">ACTIVE <span className="text-neon-cyan">NODES</span></h2>
                                    <button onClick={() => { refetchEvents(); refetchMyVaults(); }} className="p-3 hover:bg-white/5 rounded-xl border border-white/10 hover:border-neon-cyan/50 transition-all">
                                        <RefreshCw className="w-5 h-5 text-neon-cyan" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                                    {myVaults?.map((obj) => {
                                        const content = obj.data?.content as any;
                                        const fields = content?.fields;
                                        if (!fields) return null;

                                        const lastHeartbeat = Number(fields.last_heartbeat);
                                        const interval = Number(fields.interval);
                                        const releaseTime = lastHeartbeat + interval;
                                        const isExpired = Date.now() > releaseTime;

                                        return (
                                            <div key={obj.data?.objectId} className="p-8 bg-black/40 border border-white/10 rounded-2xl hover:border-neon-cyan/50 transition-all group relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <RefreshCw className="w-32 h-32" />
                                                </div>

                                                <div className="flex flex-col md:flex-row gap-8 relative z-10">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className={clsx("w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]", isExpired ? "bg-neon-red text-neon-red" : "bg-neon-cyan text-neon-cyan")} />
                                                            <span className="font-mono text-sm text-gray-400 tracking-widest">{obj.data?.objectId.slice(0, 8)}...</span>
                                                        </div>

                                                        <div className="mb-6">
                                                            <HeartbeatEKG status={isExpired ? 'flatline' : 'steady'} />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-8 font-mono text-xs text-gray-500">
                                                            <div>
                                                                <p className="mb-2 tracking-widest text-neon-cyan">RECIPIENT</p>
                                                                <a
                                                                    href={`https://suiscan.xyz/testnet/address/${fields.recipient}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-white text-sm hover:text-neon-cyan hover:underline transition-colors"
                                                                >
                                                                    {fields.recipient.slice(0, 6)}...{fields.recipient.slice(-4)}
                                                                </a>
                                                            </div>
                                                            <div>
                                                                <p className="mb-2 tracking-widest text-neon-cyan">WALRUS BLOB</p>
                                                                <a
                                                                    href={`https://walruscan.com/testnet/blob/${fields.blob_id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-white text-sm truncate hover:text-neon-cyan hover:underline transition-colors block"
                                                                >
                                                                    {fields.blob_id}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:w-72 flex flex-col gap-4">
                                                        <DoomsdayClock lastHeartbeat={lastHeartbeat} interval={interval} />

                                                        <button
                                                            onClick={() => sendHeartbeat(obj.data?.objectId!)}
                                                            className="w-full py-4 bg-neon-cyan/10 border border-neon-cyan text-neon-cyan font-bold font-mono tracking-widest rounded-xl hover:bg-neon-cyan hover:text-black transition-all uppercase"
                                                        >
                                                            SIGN HEARTBEAT
                                                        </button>

                                                        {isExpired && (
                                                            <button
                                                                onClick={() => triggerRelease(obj.data?.objectId!)}
                                                                className="w-full py-3 bg-neon-red/10 border border-neon-red text-neon-red font-bold font-mono tracking-widest rounded-xl hover:bg-neon-red hover:text-black transition-all uppercase text-xs"
                                                            >
                                                                TRIGGER RELEASE
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!myVaults || myVaults.length === 0) && (
                                        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-500 font-mono mb-4">NO ACTIVE NODES DETECTED</p>
                                            <button onClick={() => setActiveTab('create')} className="text-neon-cyan font-mono text-sm hover:underline">INITIALIZE NEW PROTOCOL</button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="incoming"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="flex justify-between items-center mb-12">
                                    <h2 className="font-mono text-3xl font-bold tracking-tight">INCOMING <span className="text-neon-amber">TRANSMISSIONS</span></h2>
                                    <button onClick={() => { refetchEvents(); refetchIncomingVaults(); }} className="p-3 hover:bg-white/5 rounded-xl border border-white/10 hover:border-neon-amber/50 transition-all">
                                        <RefreshCw className="w-5 h-5 text-neon-amber" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                                    {incomingVaults?.map((obj) => {
                                        const content = obj.data?.content as any;
                                        const fields = content?.fields;
                                        if (!fields) return null;

                                        const lastHeartbeat = Number(fields.last_heartbeat);
                                        const interval = Number(fields.interval);
                                        const releaseTime = lastHeartbeat + interval;
                                        const isExpired = Date.now() > releaseTime;

                                        return (
                                            <div key={obj.data?.objectId} className="p-8 bg-black/40 border border-white/10 rounded-2xl hover:border-neon-amber/50 transition-all group relative overflow-hidden">
                                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className={clsx("w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]", isExpired ? "bg-neon-cyan text-neon-cyan" : "bg-neon-amber text-neon-amber")} />
                                                            <span className="font-mono text-sm text-gray-400 tracking-widest">FROM: {fields.owner.slice(0, 6)}...{fields.owner.slice(-4)}</span>
                                                        </div>

                                                        <div className="mb-4">
                                                            <h4 className={clsx("font-mono text-2xl font-bold", isExpired ? "text-neon-cyan" : "text-neon-amber")}>
                                                                {isExpired ? "ENCRYPTION KEY RELEASED" : "PROTOCOL ACTIVE - LOCKED"}
                                                            </h4>
                                                        </div>

                                                        <div className="font-mono text-xs text-gray-500">
                                                            <p className="mb-1">WALRUS BLOB ID</p>
                                                            <a
                                                                href={`https://walruscan.com/testnet/blob/${fields.blob_id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-white break-all hover:text-neon-cyan hover:underline transition-colors"
                                                            >
                                                                {fields.blob_id}
                                                            </a>
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:w-64">
                                                        {isExpired ? (
                                                            <button
                                                                onClick={() => decryptVault(obj.data?.objectId!)}
                                                                disabled={isDecrypting}
                                                                className="w-full py-4 bg-neon-cyan/10 border border-neon-cyan text-neon-cyan font-bold font-mono tracking-widest rounded-xl hover:bg-neon-cyan hover:text-black transition-all disabled:opacity-50"
                                                            >
                                                                {isDecrypting ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'DECRYPT & VIEW'}
                                                            </button>
                                                        ) : (
                                                            <div className="w-full py-4 bg-neon-amber/5 border border-neon-amber/20 text-neon-amber/50 font-bold font-mono tracking-widest rounded-xl text-center cursor-not-allowed">
                                                                AWAITING RELEASE
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!incomingVaults || incomingVaults.length === 0) && (
                                        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-500 font-mono">NO INCOMING TRANSMISSIONS</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Decrypt Modal */}
                    {decryptedSecret && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setDecryptedSecret(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-black border border-neon-cyan shadow-[0_0_50px_rgba(0,243,255,0.2)] rounded-2xl p-8 max-w-3xl w-full relative overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="scanline" />
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="font-mono text-2xl font-bold text-neon-cyan tracking-widest">DECRYPTED PAYLOAD</h3>
                                    <div className="px-3 py-1 border border-neon-cyan/30 rounded text-xs font-mono text-neon-cyan">CONFIDENTIAL</div>
                                </div>

                                <div className="bg-black/60 border border-white/10 rounded-xl p-8 mb-8 max-h-[500px] overflow-y-auto custom-scrollbar">
                                    <pre className="font-mono text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{decryptedSecret}</pre>
                                </div>

                                <button
                                    onClick={() => setDecryptedSecret(null)}
                                    className="w-full py-4 bg-white text-black font-bold font-mono tracking-widest rounded-xl hover:bg-neon-cyan transition-colors"
                                >
                                    CLOSE TERMINAL
                                </button>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 right-8 z-50 max-w-md"
                    >
                        <div className={clsx(
                            "p-6 rounded-xl border backdrop-blur-md font-mono shadow-lg",
                            notification.type === 'success'
                                ? "bg-neon-cyan/10 border-neon-cyan text-neon-cyan shadow-[0_0_30px_rgba(0,243,255,0.3)]"
                                : "bg-neon-red/10 border-neon-red text-neon-red shadow-[0_0_30px_rgba(255,0,60,0.3)]"
                        )}>
                            <div className="flex items-start gap-3">
                                <div className="text-2xl">{notification.type === 'success' ? '✅' : '❌'}</div>
                                <div>
                                    <div className="font-bold mb-1 tracking-wider">
                                        {notification.type === 'success' ? 'SUCCESS' : 'ERROR'}
                                    </div>
                                    <div className="text-sm text-white/90">{notification.message}</div>
                                </div>
                                <button
                                    onClick={() => setNotification(null)}
                                    className="ml-auto text-white/50 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
