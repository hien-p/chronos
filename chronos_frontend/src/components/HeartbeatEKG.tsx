import { useEffect, useRef } from 'react';

interface HeartbeatEKGProps {
    status: 'steady' | 'erratic' | 'flatline';
}

export const HeartbeatEKG = ({ status }: HeartbeatEKGProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const points: number[] = [];
        const width = canvas.width;
        const height = canvas.height;
        const centerY = height / 2;

        const draw = () => {
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, width, height);

            ctx.beginPath();
            ctx.strokeStyle = status === 'flatline' ? '#ff003c' : status === 'erratic' ? '#ffb800' : '#00f3ff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.strokeStyle;

            // Generate next point
            let y = centerY;
            if (status !== 'flatline') {
                const time = Date.now() / (status === 'erratic' ? 100 : 500);
                const beat = Math.sin(time) > 0.8 ? (Math.random() - 0.5) * 50 : 0;
                y += beat;
            }

            points.push(y);
            if (points.length > width) points.shift();

            // Draw line
            ctx.moveTo(0, points[0]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(i, points[i]);
            }
            ctx.stroke();

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => cancelAnimationFrame(animationFrameId);
    }, [status]);

    return (
        <canvas
            ref={canvasRef}
            width={300}
            height={100}
            className="w-full h-24 bg-black/20 rounded-lg border border-white/5"
        />
    );
};
