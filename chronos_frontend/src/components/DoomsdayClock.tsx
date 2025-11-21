import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface DoomsdayClockProps {
    lastHeartbeat: number;
    interval: number;
    onExpire?: () => void;
}

export const DoomsdayClock = ({ lastHeartbeat, interval, onExpire }: DoomsdayClockProps) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [status, setStatus] = useState<'safe' | 'warning' | 'critical' | 'dead'>('safe');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const deadline = lastHeartbeat + interval;
            const remaining = Math.max(0, deadline - now);

            setTimeLeft(remaining);

            // Determine status based on percentage remaining
            const percentage = (remaining / interval) * 100;

            if (remaining <= 0) {
                setStatus('dead');
                if (onExpire) onExpire();
            } else if (percentage < 25) {
                setStatus('critical');
            } else if (percentage < 50) {
                setStatus('warning');
            } else {
                setStatus('safe');
            }

        }, 100); // Update frequently for smooth milliseconds

        return () => clearInterval(timer);
    }, [lastHeartbeat, interval, onExpire]);

    // Format time as HH:MM:SS:ms
    const formatTime = (ms: number) => {
        if (ms <= 0) return "00:00:00:00";
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const centis = Math.floor((ms % 1000) / 10);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${centis.toString().padStart(2, '0')}`;
    };

    const getColor = () => {
        switch (status) {
            case 'safe': return 'text-neon-cyan';
            case 'warning': return 'text-neon-amber';
            case 'critical': return 'text-neon-red animate-pulse';
            case 'dead': return 'text-gray-500 line-through';
            default: return 'text-white';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-sm">
            <div className="text-xs font-mono text-gray-400 mb-2 tracking-[0.2em]">DOOMSDAY CLOCK</div>
            <motion.div
                key={status}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={clsx("font-mono text-3xl md:text-4xl font-bold tracking-wider tabular-nums", getColor())}
                style={{ textShadow: status === 'dead' ? 'none' : '0 0 20px currentColor' }}
            >
                {formatTime(timeLeft)}
            </motion.div>
            <div className={clsx("mt-3 text-xs font-bold tracking-widest uppercase", getColor())}>
                STATUS: {status === 'dead' ? 'FLATLINE' : status}
            </div>
        </div>
    );
};
