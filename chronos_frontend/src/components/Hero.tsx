import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useCurrentAccount } from '@mysten/dapp-kit';


export default function Hero() {
    const account = useCurrentAccount();
    return (
        <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-4 pt-20">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="mb-10"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-neon-blue/20 blur-[100px] rounded-full animate-pulse"></div>
                    <img
                        src="/chronos_logo.svg"
                        alt="Chronos Logo"
                        className="relative w-64 h-64 md:w-96 md:h-96 object-contain drop-shadow-[0_0_50px_rgba(0,243,255,0.8)] animate-[spin_20s_linear_infinite]"
                    />
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="mb-6"
            >
                <span className="px-4 py-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 text-neon-blue font-mono text-xs tracking-widest uppercase backdrop-blur-md">
                    System Online • Sui Network
                </span>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="font-heading font-bold text-6xl md:text-8xl lg:text-9xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 mb-8 max-w-5xl mx-auto leading-[0.9]"
            >
                IMMORTALIZE <br />
                <span className="text-stroke-neon">YOUR LEGACY</span>
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="font-mono text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-12 leading-relaxed"
            >
                A decentralized dead man's switch ensuring your digital assets and secrets survive you.
                Automated, trustless, and unstoppable.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
            >
                <a
                    href="#vaults"
                    onClick={() => {
                        if (!account) {
                            // If not connected, we still let it scroll (since we added the ID to the access denied section),
                            // but we also show an alert to guide the user.
                            alert("Please connect your wallet to initialize a vault.");
                        }
                    }}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-neon-blue text-black font-bold font-heading text-lg tracking-wide uppercase rounded-none hover:bg-white transition-all duration-300"
                >
                    Initialize Vault
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    <div className="absolute inset-0 border border-neon-blue translate-x-1 translate-y-1 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform" />
                </a>
            </motion.div>
        </section>
    );
}
