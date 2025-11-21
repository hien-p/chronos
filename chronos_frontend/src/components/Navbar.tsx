import { ConnectButton } from '@mysten/dapp-kit';
import { motion } from 'framer-motion';


export default function Navbar() {
    return (
        <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
        >
            <div className="glass-panel rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <img src="/chronos_logo.svg" alt="Chronos" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-heading font-bold text-xl tracking-tighter text-white">
                        CHRONOS
                    </span>
                </div>

                <div className="hidden md:flex items-center gap-8 font-mono text-sm text-gray-400">
                    <a href="#features" className="hover:text-neon-blue transition-colors">FEATURES</a>
                    <a href="#vaults" className="hover:text-neon-blue transition-colors">VAULTS</a>
                    <a href="#about" className="hover:text-neon-blue transition-colors">PROTOCOL</a>
                </div>

                <div>
                    <ConnectButton className="!bg-neon-blue/10 !text-neon-blue !border !border-neon-blue/30 !rounded-full !px-6 !py-2 !font-mono !text-xs hover:!bg-neon-blue/20 hover:!shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all" />
                </div>
            </div>
        </motion.nav>
    );
}
