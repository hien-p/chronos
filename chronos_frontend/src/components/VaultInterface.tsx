
import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSignPersonalMessage, ConnectButton } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Activity, Shield, Clock, Upload, Lock, Unlock, Loader2, Download, Settings, RefreshCw, User, FileText, X, Key } from 'lucide-react';
import clsx from 'clsx';
import { WalrusService } from '../services/walrus';
import { EncryptionService } from '../services/encryption';
import { DoomsdayClock } from './DoomsdayClock';
import { HeartbeatEKG } from './HeartbeatEKG';
import { WalrusShatter } from './WalrusShatter';
import { SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { normalizeSuiAddress } from '@mysten/sui/utils';

export default function VaultInterface() {
    const account = useCurrentAccount();
    console.log('Current PACKAGE_ID:', PACKAGE_ID);
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

    const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'incoming'>('create');

    // Form State
    const [recipient, setRecipient] = useState('0x915c2d19ee5fde257693f25e6c2cabb04c25e7ae03932817d52e122258c88ddb');
    const [secret, setSecret] = useState('');
    const [payloadType, setPayloadType] = useState<'text' | 'file'>('text');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [heartbeatInterval, setHeartbeatInterval] = useState('600000');
    const [sentinels, setSentinels] = useState<string[]>([]);
    const [newSentinel, setNewSentinel] = useState('');
    const [sentinelInterval, setSentinelInterval] = useState('300000'); // Default 5 mins (half of default heartbeat)
    // const [lastCreatedId, setLastCreatedId] = useState<string | null>(null); // Removed as unused in new UI
    const [isDeploying, setIsDeploying] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Decrypt Modal State
    const [decryptedSecret, setDecryptedSecret] = useState<string | Blob | null>(null);
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
        options: { showContent: true, showType: true }
    });

    const filteredMyVaults = myVaults?.filter(v => v.data?.type?.startsWith(PACKAGE_ID));

    // Event Query State - Incoming (Recipient) Vaults
    const incomingVaultIds = vaultEvents?.data
        .filter((event) => {
            const json = event.parsedJson as any;
            const isRecipient = json?.recipient === account?.address;
            // Check if user is in the sentinels list (if it exists)
            const normalizedMyAddress = account?.address ? normalizeSuiAddress(account.address) : '';
            const normalizedSentinels = json?.sentinels?.map((s: string) => normalizeSuiAddress(s)) || [];
            const isSentinel = normalizedSentinels.includes(normalizedMyAddress);

            return isRecipient || isSentinel;
        })
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

    const filteredIncomingVaults = incomingVaults?.filter(v => v.data?.type?.startsWith(PACKAGE_ID));

    const fillDemoSimple = () => {
        setRecipient(account?.address || '');
        setSecret('This is a simple demo secret for the vault.');
        setHeartbeatInterval('60000'); // 1 minute
        setSentinelInterval('300000'); // 5 mins default
        setSentinels([]);
        setNotification({ message: 'Demo Preset: Simple (No Sentinels) Loaded', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
    };

    const fillDemoProtected = () => {
        setRecipient(account?.address || '');
        setSecret('This is a protected demo secret with sentinels.');
        setHeartbeatInterval('60000'); // 1 minute
        setSentinelInterval('30000'); // 30 seconds for demo
        // Add current user as sentinel for immediate verification
        const demoSentinels = ['0x0000000000000000000000000000000000000000000000000000000000000000'];
        if (account?.address) {
            demoSentinels.push(account.address);
        }
        setSentinels(demoSentinels);
        setNotification({ message: 'Demo Preset: Protected (You are now a Sentinel)', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
    };



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
                    tx.pure.u64(BigInt(sentinelInterval)),
                    tx.pure.vector('address', sentinels),
                    tx.object('0x6'),
                ],
            });

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: () => {
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
                        alert(`Transaction Failed: ${err.message} `);
                        setIsDeploying(false);
                        setStatusMessage('');
                    }
                }
            );
        } catch (error: any) {
            console.error('Deployment Error:', error);
            alert(`Deployment Failed: ${error.message || JSON.stringify(error)} `);
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
                    setNotification({ message: `Release Failed: ${err.message} `, type: 'error' });
                    setTimeout(() => setNotification(null), 5000);
                }
            }
        );
    };

    const decryptVault = async (vaultId: string) => {
        try {
            if (!account) {
                alert('Please connect your wallet first');
                return;
            }
            setIsDecrypting(true);
            const vault = filteredIncomingVaults?.find(v => v.data?.objectId === vaultId);
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


            let policyIdBytes: Uint8Array;
            if (Array.isArray(fields.encrypted_key)) {
                policyIdBytes = new Uint8Array(fields.encrypted_key);
            } else if (typeof fields.encrypted_key === 'string') {
                // Handle hex string (with or without 0x) or base64? 
                // Usually Move vector<u8> comes as string if it's valid utf8, but our key is hex.
                // If it starts with 0x, it's hex.
                const hex = fields.encrypted_key.startsWith('0x') ? fields.encrypted_key.slice(2) : fields.encrypted_key;
                policyIdBytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
            } else {
                console.error('Unknown key format');
                alert('Unknown key format');
                return;
            }


            // 3. Create Session Key
            // setStatusMessage('Initializing Secure Session...'); // setStatusMessage is not available in this scope? It is.
            // Wait, setStatusMessage is state.

            const sessionKey = await SessionKey.create({
                address: account!.address,
                packageId: PACKAGE_ID,
                ttlMin: 10,
                suiClient: new SuiClient({ url: getFullnodeUrl('testnet') })
            });

            // 4. Sign Session Request
            // setStatusMessage('Awaiting Biometric Auth...');
            const message = sessionKey.getPersonalMessage();
            const { signature } = await signPersonalMessage({ message: message });
            sessionKey.setPersonalMessageSignature(signature);

            // 5. Build Transaction for SEAL Approval
            // setStatusMessage('Verifying Access Control...');

            const tx = new Transaction();
            tx.setSender(account.address);

            // Fetch object details to get the initial shared version
            const vaultObj = await new SuiClient({ url: getFullnodeUrl('testnet') }).getObject({
                id: vaultId,
                options: { showOwner: true }
            });

            const initialSharedVersion = (vaultObj.data?.owner as any)?.Shared?.initial_shared_version;


            if (!initialSharedVersion) {
                console.error('Could not fetch initial shared version');
                alert('Error: Could not fetch vault version');
                return;
            }

            tx.moveCall({
                target: `${PACKAGE_ID}::chronos::seal_approve`,
                arguments: [
                    tx.pure.vector('u8', Array.from(policyIdBytes)),
                    tx.object(vaultId),
                    tx.object('0x6')
                ]
            });



            // Debug: Dry Run to verify transaction validity on-chain
            try {
                // Build full transaction for dry run
                tx.setSender(account.address);
                const dryRunTxBytes = await tx.build({ client: new SuiClient({ url: getFullnodeUrl('testnet') }) });
                const dryRunResult = await new SuiClient({ url: getFullnodeUrl('testnet') }).dryRunTransactionBlock({ transactionBlock: dryRunTxBytes });


                if (dryRunResult.effects.status.status === 'failure') {
                    console.error('Dry Run Failed:', dryRunResult.effects.status.error);
                    alert(`Dry Run Failed: ${dryRunResult.effects.status.error} `);
                    return;
                }
            } catch (e) {
                console.error('Dry Run Error:', e);
            }

            // Build PTB for SEAL (no sender, only kind)
            const txForSeal = new Transaction();
            txForSeal.moveCall({
                target: `${PACKAGE_ID}::chronos::seal_approve`,
                arguments: [
                    txForSeal.pure.vector('u8', Array.from(policyIdBytes)),
                    txForSeal.object(vaultId), // Let builder resolve shared object
                    txForSeal.object('0x6')
                ]
            });

            const txBytes = await txForSeal.build({
                client: new SuiClient({ url: getFullnodeUrl('testnet') }),
                onlyTransactionKind: true
            });


            // 6. Decrypt
            // setStatusMessage('Decrypting Payload...');
            const decryptedBytes = await EncryptionService.decrypt(encryptedBytes, sessionKey, txBytes);

            // Check for PDF Magic Bytes (%PDF)
            const isPdf = decryptedBytes[0] === 0x25 && decryptedBytes[1] === 0x50 && decryptedBytes[2] === 0x44 && decryptedBytes[3] === 0x46;

            let decryptedContent: string | Blob;
            if (isPdf) {
                decryptedContent = new Blob([decryptedBytes as any], { type: 'application/pdf' });
            } else {
                decryptedContent = new TextDecoder().decode(decryptedBytes);
            }

            setDecryptedSecret(decryptedContent);
            setIsDecrypting(false);
        } catch (error: any) {
            console.error('Decryption failed:', error);
            alert(`Decryption failed: ${error.message} `);
            setIsDecrypting(false);
        }
    };



    if (!account) {
        return (
            <div className="w-full bg-black border border-red-900/30 rounded-3xl overflow-hidden min-h-[600px] flex flex-col items-center justify-center relative shadow-2xl p-8">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="border border-red-900/50 bg-red-950/10 p-12 rounded-xl flex flex-col items-center text-center max-w-md relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-600/50 animate-scanline"></div>
                    <h2 className="font-mono text-3xl md:text-4xl font-bold text-red-600 tracking-widest mb-2 animate-pulse">ACCESS DENIED</h2>
                    <div className="h-px w-full bg-red-900/50 my-4" />
                    <p className="font-mono text-red-400 text-sm tracking-[0.2em] mb-8 uppercase">Biometric Signature Required</p>

                    <div className="flex flex-col gap-4 items-center">
                        <p className="font-mono text-xs text-red-500/70">Connect wallet to proceed</p>
                        <ConnectButton className="!bg-red-900/20 !text-red-500 !border !border-red-500/50 !font-mono hover:!bg-red-900/40 transition-colors" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section id="vaults" className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto flex items-center justify-center">
            <div className="scanline" />
            <WalrusShatter isUploading={isDeploying} />

            <div className="w-full bg-[#09090b] border border-white/10 rounded-3xl overflow-hidden min-h-[800px] flex flex-col md:flex-row relative shadow-2xl">

                {/* Top Light Leak / Glow Effect - Intensified */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_40px_rgba(59,130,246,0.8)] z-20 opacity-70"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-blue-600/25 blur-[80px] pointer-events-none z-0 mix-blend-screen"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-32 bg-cyan-400/15 blur-[40px] pointer-events-none z-0"></div>

                {/* Sidebar */}
                <div className="w-full md:w-64 bg-[#09090b] border-r border-white/5 p-6 flex flex-col gap-6 relative z-10">
                    {/* Sidebar Bottom Fade/Blur */}
                    <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent pointer-events-none z-20"></div>

                    <div className="mb-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 flex items-center justify-center">
                                <img
                                    src="/chronos_logo.svg"
                                    alt="Chronos Logo"
                                    className="w-full h-full animate-[spin_10s_linear_infinite]"
                                />
                            </div>
                            <h1 className="font-sans text-xl font-bold text-white tracking-wide">CHRONOS</h1>
                        </div>
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest pl-1">Terminal v2.0</div>
                    </div>

                    <nav className="flex flex-col gap-2">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === 'create'
                                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
                                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                            )}
                        >
                            <Plus className="w-4 h-4" /> Initialize
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === 'manage'
                                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
                                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                            )}
                        >
                            <Activity className="w-4 h-4" /> Active Nodes
                        </button>
                        <button
                            onClick={() => setActiveTab('incoming')}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                activeTab === 'incoming'
                                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/5"
                                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                            )}
                        >
                            <Download className="w-4 h-4" /> Incoming
                            {(incomingVaults?.length || 0) > 0 && (
                                <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {incomingVaults?.length}
                                </span>
                            )}
                        </button>
                    </nav>

                    <div className="mt-4">
                        <h3 className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-3 pl-2">Recent Activity</h3>
                        <div className="space-y-1">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="group flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                                    <div className={`w - 1.5 h - 1.5 rounded - full ${i === 0 ? 'bg-green-500' : 'bg-gray-600'} group - hover: scale - 125 transition - transform`}></div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 group-hover:text-gray-300">Protocol {8080 + i}</span>
                                        <span className="text-[10px] text-gray-600">2m ago</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto relative z-30">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                    0x
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-medium text-white truncate">
                                        {account ? `${account.address.slice(0, 6)}...${account.address.slice(-4)} ` : 'Not Connected'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <div className={`w - 1.5 h - 1.5 rounded - full ${account ? 'bg-green-500' : 'bg-red-500'} `}></div>
                                        {account ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                            <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-black/20 hover:bg-black/40 text-xs text-gray-400 hover:text-white transition-all border border-white/5">
                                <Settings className="w-3 h-3" /> System Settings
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 bg-[#05060a] relative overflow-hidden">

                    <AnimatePresence mode="wait">
                        {activeTab === 'create' ? (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="h-full flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex justify-between items-center w-full">
                                        <h2 className="font-mono text-2xl font-bold text-white tracking-wider">Initialize Protocol</h2>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={fillDemoSimple}
                                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
                                            >
                                                DEMO: SIMPLE
                                            </button>
                                            <button
                                                onClick={fillDemoProtected}
                                                className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-mono text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                DEMO: PROTECTED
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-gray-400 hover:text-white transition-colors"><RefreshCw className="w-5 h-5" /></button>
                                        <button className="p-2 text-gray-400 hover:text-white transition-colors"><User className="w-5 h-5" /></button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                                    {/* Left Column: The Form */}
                                    <div className="lg:col-span-2 space-y-6">

                                        {/* Step 1: Payload */}
                                        <div className="bg-[#09090b] rounded-2xl p-1 overflow-hidden border border-white/5">
                                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                                    <Upload className="w-4 h-4 text-blue-500" />
                                                    Confidential Payload
                                                </h3>
                                                <div className="flex bg-black/20 rounded-lg p-1">
                                                    <button
                                                        onClick={() => setPayloadType('text')}
                                                        className={clsx(
                                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                                            payloadType === 'text' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                                        )}
                                                    >
                                                        Text
                                                    </button>
                                                    <button
                                                        onClick={() => setPayloadType('file')}
                                                        className={clsx(
                                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                                            payloadType === 'file' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                                        )}
                                                    >
                                                        File
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-4">
                                                {payloadType === 'text' ? (
                                                    <textarea
                                                        value={secret}
                                                        onChange={(e) => setSecret(e.target.value)}
                                                        rows={6}
                                                        className="w-full bg-[#05060a] border border-white/5 rounded-xl p-4 font-mono text-sm focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-gray-300 placeholder-gray-700 resize-none"
                                                        placeholder="Enter sensitive data to encrypt..."
                                                    />
                                                ) : (
                                                    <div className="relative w-full h-40 bg-[#05060a] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center hover:border-blue-500/30 transition-all group/dropzone">
                                                        <input
                                                            type="file"
                                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                        />
                                                        {selectedFile ? (
                                                            <div className="flex flex-col items-center gap-2 z-0">
                                                                <FileText className="w-8 h-8 text-blue-500" />
                                                                <span className="text-xs font-medium text-white">{selectedFile.name}</span>
                                                                <span className="text-[10px] text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedFile(null);
                                                                    }}
                                                                    className="z-20 mt-2 text-[10px] text-red-500 hover:text-red-400 flex items-center gap-1"
                                                                >
                                                                    <X className="w-3 h-3" /> Remove
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-gray-600 group-hover/dropzone:text-gray-400 transition-colors">
                                                                <Upload className="w-8 h-8 mb-2 opacity-50" />
                                                                <span className="text-xs font-medium">Drop file or click to upload</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Step 2: Configuration */}
                                        <div className="grid grid-cols-1 gap-6">

                                            {/* Recipient Section */}
                                            <div className="bg-[#09090b] rounded-2xl p-1 overflow-hidden border border-white/5">
                                                <div className="p-4 border-b border-white/5">
                                                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                                        <User className="w-4 h-4 text-blue-500" />
                                                        Designate Recipient
                                                    </h3>
                                                </div>
                                                <div className="p-4">
                                                    <div className="relative bg-[#05060a] border border-white/5 rounded-xl flex items-center overflow-hidden group focus-within:border-blue-500/30 transition-colors">
                                                        <div className="pl-4 pr-3 py-4 border-r border-white/5 bg-white/[0.02] flex-shrink-0">
                                                            <Key className="w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={recipient}
                                                            onChange={(e) => setRecipient(e.target.value)}
                                                            placeholder="0x..."
                                                            className="flex-1 min-w-0 bg-transparent border-none py-3 px-4 text-sm text-white font-mono focus:ring-0 placeholder-gray-700"
                                                            spellCheck={false}
                                                        />
                                                        <div className="pr-4 flex items-center gap-2 pointer-events-none">
                                                            <div className={`h - 1.5 w - 1.5 rounded - full ${recipient ? 'bg-green-500' : 'bg-red-500'} `}></div>
                                                            <span className={`text - [10px] font - bold tracking - wider uppercase ${recipient ? 'text-green-500' : 'text-red-500'} `}>
                                                                {recipient ? 'Verified' : 'Invalid'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Heartbeat & Sentinels Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Heartbeat */}
                                                <div className="bg-[#09090b] rounded-2xl p-4 border border-white/5">
                                                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-4">
                                                        <Clock className="w-4 h-4 text-blue-500" />
                                                        Heartbeat
                                                    </h3>
                                                    <div className="flex items-end gap-2 mb-4">
                                                        <span className="text-3xl font-bold text-white">
                                                            {Math.floor(parseInt(heartbeatInterval) / 1000)}
                                                        </span>
                                                        <span className="text-sm text-gray-500 mb-1">seconds</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="10000"
                                                        max="600000"
                                                        step="1000"
                                                        value={heartbeatInterval}
                                                        onChange={(e) => setHeartbeatInterval(e.target.value)}
                                                        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                                    />
                                                </div>

                                                {/* Sentinels */}
                                                <div className="bg-[#09090b] rounded-2xl p-4 border border-white/5">
                                                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-4">
                                                        <Shield className="w-4 h-4 text-blue-500" />
                                                        Sentinels
                                                    </h3>
                                                    <div className="flex gap-2 mb-3">
                                                        <input
                                                            type="text"
                                                            value={newSentinel}
                                                            onChange={(e) => setNewSentinel(e.target.value)}
                                                            placeholder="Add 0x..."
                                                            className="flex-1 bg-[#05060a] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500/30 focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (newSentinel && !sentinels.includes(newSentinel)) {
                                                                    setSentinels([...sentinels, newSentinel]);
                                                                    setNewSentinel('');
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all text-xs font-medium"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                                                        {sentinels.map((sentinel, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-[#05060a] px-2 py-1.5 rounded border border-white/5">
                                                                <span className="font-mono text-[10px] text-gray-400 truncate w-24">{sentinel}</span>
                                                                <button onClick={() => setSentinels(sentinels.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                            </div>
                                                        ))}
                                                        {sentinels.length === 0 && <div className="text-[10px] text-gray-600 italic text-center">No sentinels</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={createVault}
                                            disabled={!recipient || (payloadType === 'text' ? !secret : !selectedFile) || isDeploying}
                                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 font-medium py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                        >
                                            {isDeploying ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    {statusMessage || 'Processing...'}
                                                </>
                                            ) : (
                                                <>
                                                    <Shield className="w-5 h-5" />
                                                    Initialize Protocol
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Right Column: Visualizer & Logs */}
                                    <div className="bg-[#09090b] border border-white/5 rounded-2xl p-6 flex flex-col">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-medium text-gray-300">Simulation</h3>
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                        </div>

                                        {/* Visualizer Box */}
                                        <div className="flex-1 border border-white/5 rounded-xl bg-[#05060a] relative overflow-hidden mb-6 flex items-center justify-center group min-h-[200px]">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50"></div>

                                            {/* Clean, minimal circles */}
                                            <div className="absolute w-32 h-32 border border-blue-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                                            <div className="absolute w-24 h-24 border border-dashed border-blue-500/30 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>

                                            <div className="text-center z-10">
                                                <Lock className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                                                <div className="text-xs text-blue-400 font-medium tracking-wide">SEAL ENCRYPTION</div>
                                                <div className="text-[10px] text-gray-600 mt-1">Ready to secure</div>
                                            </div>
                                        </div>

                                        {/* Logs */}
                                        <div className="h-48 bg-[#05060a] border border-white/5 rounded-xl p-4 font-mono text-[10px] space-y-2 overflow-y-auto text-gray-400">
                                            <div className="flex gap-2">
                                                <span className="text-blue-500">➜</span>
                                                <span>System initialized.</span>
                                            </div>
                                            {isDeploying && (
                                                <div className="flex gap-2">
                                                    <span className="text-blue-500">➜</span>
                                                    <span className="text-white">{statusMessage}</span>
                                                </div>
                                            )}
                                            {!isDeploying && (
                                                <div className="flex gap-2 opacity-50">
                                                    <span className="text-gray-600">➜</span>
                                                    <span>Waiting for input...</span>
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
                                    {filteredMyVaults?.map((obj) => {
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
                                                                </a >
                                                            </div >
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
                                                        </div >
                                                    </div >

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
                                                </div >
                                            </div >
                                        );
                                    })}
                                    {
                                        (!myVaults || myVaults.length === 0) && (
                                            <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                                                <p className="text-gray-500 font-mono mb-4">NO ACTIVE NODES DETECTED</p>
                                                <button onClick={() => setActiveTab('create')} className="text-neon-cyan font-mono text-sm hover:underline">INITIALIZE NEW PROTOCOL</button>
                                            </div>
                                        )
                                    }
                                </div >
                            </motion.div >
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
                                    {filteredIncomingVaults?.map((obj) => {
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
                                                            {(() => {
                                                                const normalizedMyAddress = account?.address ? normalizeSuiAddress(account.address) : '';
                                                                const normalizedSentinels = fields.sentinels?.map((s: string) => normalizeSuiAddress(s)) || [];
                                                                const isSentinel = normalizedSentinels.includes(normalizedMyAddress);
                                                                return isSentinel ? (
                                                                    <div className="ml-auto bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-1 rounded border border-yellow-500/20 flex items-center gap-1">
                                                                        <Shield className="w-3 h-3" />
                                                                        SENTINEL WATCH
                                                                    </div>
                                                                ) : null;
                                                            })()}

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

                                                    <div className="w-full md:w-64 flex flex-col gap-2">
                                                        {isExpired ? (
                                                            <>
                                                                <button
                                                                    onClick={() => decryptVault(obj.data?.objectId!)}
                                                                    disabled={isDecrypting}
                                                                    className="w-full px-4 py-2 bg-transparent border border-white/20 rounded-lg text-xs font-mono text-white hover:bg-white/10 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                                                                >
                                                                    {isDecrypting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                                                                    Decrypt & View
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {(() => {
                                                                    // Check for Sentinel Warning
                                                                    const sentinelInterval = Number(fields.sentinel_interval);
                                                                    // Warning starts at: lastHeartbeat + sentinelInterval
                                                                    // Warning ends at: lastHeartbeat + interval (Release Time)
                                                                    const warningTime = lastHeartbeat + sentinelInterval;
                                                                    const isWarning = Date.now() > warningTime && Date.now() < releaseTime;

                                                                    if (isWarning) {
                                                                        return (
                                                                            <div className="w-full py-4 bg-neon-red/10 border border-neon-red animate-pulse text-neon-red font-bold font-mono tracking-widest rounded-xl text-center flex flex-col items-center justify-center gap-1">
                                                                                <span className="text-xs">WARNING</span>
                                                                                <span className="text-[10px]">CHECK-IN REQUIRED</span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <div className="w-full py-4 bg-neon-amber/5 border border-neon-amber/20 text-neon-amber/50 font-bold font-mono tracking-widest rounded-xl text-center cursor-not-allowed">
                                                                            AWAITING RELEASE
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </>
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
                    </AnimatePresence >

                    {/* Decrypt Modal */}
                    {
                        decryptedSecret && (
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

                                    <div className="bg-black/60 border border-white/10 rounded-xl p-8 mb-8 max-h-[600px] overflow-y-auto custom-scrollbar flex flex-col gap-4">
                                        {decryptedSecret instanceof Blob ? (
                                            <>
                                                <div className="w-full h-[500px] bg-white rounded-lg overflow-hidden">
                                                    <iframe
                                                        src={URL.createObjectURL(decryptedSecret)}
                                                        className="w-full h-full"
                                                        title="Decrypted PDF"
                                                    />
                                                </div>
                                                <div className="flex justify-center">
                                                    <a
                                                        href={URL.createObjectURL(decryptedSecret)}
                                                        download="decrypted_secret.pdf"
                                                        className="px-6 py-3 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-mono font-bold rounded-lg hover:bg-neon-cyan hover:text-black transition-all flex items-center gap-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        DOWNLOAD PDF
                                                    </a>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <pre className="font-mono text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{decryptedSecret}</pre>
                                                <div className="flex justify-center mt-4">
                                                    <button
                                                        onClick={() => {
                                                            const blob = new Blob([decryptedSecret as string], { type: 'text/plain' });
                                                            const url = URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = 'decrypted_secret.txt';
                                                            a.click();
                                                            URL.revokeObjectURL(url);
                                                        }}
                                                        className="px-6 py-3 bg-white/10 border border-white/20 text-white font-mono font-bold rounded-lg hover:bg-white hover:text-black transition-all flex items-center gap-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        DOWNLOAD TEXT
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setDecryptedSecret(null)}
                                        className="w-full py-4 bg-white text-black font-bold font-mono tracking-widest rounded-xl hover:bg-neon-cyan transition-colors"
                                    >
                                        CLOSE TERMINAL
                                    </button>
                                </motion.div>
                            </div>
                        )
                    }
                </div >
            </div >

            {/* Notification Toast */}
            <AnimatePresence>
                {
                    notification && (
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
                    )
                }
            </AnimatePresence >
        </section >
    );
}
