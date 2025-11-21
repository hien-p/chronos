import { motion } from 'framer-motion';
import { HeartPulse, Lock, Clock, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

const features = [
    {
        title: "Autonomous Keep-Alive",
        description: "Smart contracts monitor your heartbeat. If you go silent, the protocol activates.",
        icon: HeartPulse,
        className: "md:col-span-2",
        tech: "Move / Sui Clock"
    },
    {
        title: "Encrypted Vaults",
        description: "Data is encrypted client-side before ever touching the chain.",
        icon: Lock,
        className: "md:col-span-1",
        tech: "AES-256-GCM"
    },
    {
        title: "Time-Locked Secrets",
        description: "Set precise intervals for liveness checks. From 1 minute to 100 years.",
        icon: Clock,
        className: "md:col-span-1",
        tech: "Epoch Timestamp"
    },
    {
        title: "Trustless Release",
        description: "No central authority. The code guarantees release upon condition failure.",
        icon: ShieldCheck,
        className: "md:col-span-2",
        tech: "Smart Contract"
    },
];

export default function FeatureGrid() {
    return (
        <section id="features" className="py-24 px-4 max-w-7xl mx-auto">
            <div className="mb-16">
                <h2 className="font-heading text-4xl md:text-6xl font-bold mb-6">
                    PROTOCOL <span className="text-neon-purple">ARCHITECTURE</span>
                </h2>
                <div className="h-1 w-24 bg-neon-purple" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {features.map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className={clsx(
                            "group relative p-8 glass-panel rounded-3xl overflow-hidden hover:border-neon-blue/50 transition-colors duration-500",
                            feature.className
                        )}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <span className="font-mono text-xs text-neon-blue border border-neon-blue/30 px-2 py-1 rounded-full">
                                {feature.tech}
                            </span>
                        </div>

                        <div className="mb-6 p-3 bg-white/5 w-fit rounded-xl group-hover:bg-neon-blue/20 group-hover:text-neon-blue transition-colors duration-500">
                            <feature.icon className="w-8 h-8" />
                        </div>

                        <h3 className="font-heading text-2xl font-bold mb-3 group-hover:text-neon-blue transition-colors">
                            {feature.title}
                        </h3>
                        <p className="font-mono text-sm text-gray-400 leading-relaxed">
                            {feature.description}
                        </p>

                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue to-neon-purple transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
