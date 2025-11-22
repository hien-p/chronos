import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WalrusShatterProps {
    isUploading: boolean;
    onComplete?: () => void;
}

export const WalrusShatter = ({ isUploading, onComplete }: WalrusShatterProps) => {
    const [stage, setStage] = useState<'idle' | 'shatter' | 'encrypt' | 'disperse'>('idle');

    const [shards, setShards] = useState<{ x: number, y: number }[]>([]);

    useEffect(() => {
        // Use setTimeout to avoid synchronous state update warning and ensure purity
        const timer = setTimeout(() => {
            setShards([...Array(12)].map(() => ({
                x: (Math.random() - 0.5) * 500,
                y: (Math.random() - 0.5) * 500,
            })));
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isUploading) {
            // Use setTimeout to avoid synchronous state update warning
            const t1 = setTimeout(() => setStage('shatter'), 0);
            const t2 = setTimeout(() => setStage('encrypt'), 1000);
            const t3 = setTimeout(() => setStage('disperse'), 2000);
            const t4 = setTimeout(() => {
                setStage('idle');
                if (onComplete) onComplete();
            }, 3500);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
                clearTimeout(t4);
            };
        }
    }, [isUploading, onComplete]);

    if (stage === 'idle') return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
            <div className="relative w-64 h-64">
                {/* Central File Icon */}
                {stage === 'shatter' && (
                    <motion.div
                        initial={{ scale: 1 }}
                        animate={{ scale: [1, 1.2, 0], opacity: [1, 1, 0] }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="w-20 h-24 bg-white/10 border-2 border-neon-cyan rounded-lg flex items-center justify-center">
                            <span className="font-mono text-xs text-neon-cyan">FILE</span>
                        </div>
                    </motion.div>
                )}

                {/* Encryption Lock */}
                {stage === 'encrypt' && (
                    <motion.div
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute inset-0 flex items-center justify-center text-neon-cyan"
                    >
                        <Lock className="w-24 h-24 drop-shadow-[0_0_15px_rgba(0,243,255,0.5)]" />
                    </motion.div>
                )}

                {/* Shards Dispersing */}
                {stage === 'disperse' && (
                    <>
                        {shards.map((shard, i) => (
                            <motion.div
                                key={i}
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                animate={{
                                    x: shard.x,
                                    y: shard.y,
                                    opacity: 0,
                                    scale: 0
                                }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute top-1/2 left-1/2 w-4 h-4 bg-neon-cyan/50 border border-neon-cyan rounded-sm"
                            />
                        ))}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute bottom-0 left-0 right-0 text-center"
                        >
                            <div className="font-mono text-xs text-neon-cyan tracking-widest">DISPERSING TO WALRUS NODES</div>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
};
