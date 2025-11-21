import { motion } from 'framer-motion';
import { Activity, Shield, AlertTriangle, Zap, Database } from 'lucide-react';
import clsx from 'clsx';

const features = [
    {
        title: "The Human Operator",
        subtitle: "The Single Point of Failure",
        description: "When people pursue self-sovereignty, they unintentionally create a catastrophic risk: if the human disappears, forgets, or loses access, everything they control becomes permanently inaccessible. $140B+ is currently lost in this 'black hole'.",
        icon: AlertTriangle,
        className: "md:col-span-2 md:row-span-2 bg-gradient-to-br from-red-900/20 to-black border-red-500/30",
        iconColor: "text-red-500",
        tech: "Problem Statement"
    },
    {
        title: "Passive Liveness",
        subtitle: "The Solution",
        description: "A cryptographic heartbeat verifies you are still 'alive' without trusting anyone. If you go silent, the protocol activates automatically.",
        icon: Zap,
        className: "md:col-span-1 md:row-span-2 bg-gradient-to-br from-neon-blue/10 to-black border-neon-blue/30",
        iconColor: "text-neon-blue",
        tech: "Core Logic"
    },
    {
        title: "The Vault",
        subtitle: "Walrus + SEAL",
        description: "Data is encrypted client-side and sharded across decentralized nodes. Publicly stored, but mathematically invisible.",
        icon: Database,
        className: "md:col-span-1 md:row-span-1",
        iconColor: "text-purple-400",
        tech: "Storage Layer"
    },
    {
        title: "The Pulse",
        subtitle: "Sui Smart Contracts",
        description: "Manages the 'Time-Lock' state. Validates heartbeats and triggers the release only when conditions are met.",
        icon: Activity,
        className: "md:col-span-1 md:row-span-1",
        iconColor: "text-green-400",
        tech: "Control Plane"
    },
    {
        title: "The Sentinels",
        subtitle: "Guardians",
        description: "Designated trusted wallets receive an early warning before public release, allowing for intervention.",
        icon: Shield,
        className: "md:col-span-1 md:row-span-1",
        iconColor: "text-yellow-400",
        tech: "Security Layer"
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
                {features.map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className={clsx(
                            "group relative p-8 rounded-3xl overflow-hidden border transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl",
                            feature.className || "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                    >
                        {/* Background Glow */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <div className={clsx("p-3 rounded-xl bg-white/5", feature.iconColor)}>
                                    <feature.icon className="w-8 h-8" />
                                </div>
                                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500 border border-white/10 px-2 py-1 rounded-full">
                                    {feature.tech}
                                </span>
                            </div>

                            <div className="mt-auto">
                                <h4 className="font-mono text-xs text-gray-500 mb-2 uppercase tracking-wider">
                                    {feature.subtitle}
                                </h4>
                                <h3 className="font-heading text-2xl md:text-3xl font-bold mb-4 text-white group-hover:text-neon-blue transition-colors">
                                    {feature.title}
                                </h3>
                                <p className="font-sans text-gray-400 leading-relaxed text-sm md:text-base">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
