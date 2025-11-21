

export default function Footer() {
    return (
        <footer className="relative pt-32 pb-12 px-4 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="border-t border-glass-border mb-12" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
                    <div>
                        <h2 className="font-heading text-5xl md:text-7xl font-bold mb-8 leading-none">
                            SECURE THE <br />
                            <span className="text-neon-blue">FUTURE</span>
                        </h2>
                        <p className="font-mono text-gray-400 max-w-md">
                            Chronos is an open-source public good deployed on the Sui Network.
                            Built for permanence.
                        </p>
                    </div>

                    <div className="flex flex-col justify-end items-start md:items-end gap-4 font-mono text-sm">
                        <a href="#" className="hover:text-neon-blue transition-colors">GITHUB</a>
                        <a href="#" className="hover:text-neon-blue transition-colors">DOCUMENTATION</a>
                        <a href="#" className="hover:text-neon-blue transition-colors">CONTRACT</a>
                        <a href="#" className="hover:text-neon-blue transition-colors">TWITTER</a>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-end gap-4 font-mono text-xs text-gray-500">
                    <div>
                        © 2025 CHRONOS PROTOCOL
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        OPERATIONAL
                    </div>
                </div>
            </div>

            {/* Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-neon-blue/10 blur-[100px] -z-10 pointer-events-none" />
        </footer>
    );
}
