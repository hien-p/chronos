import { useEffect, useRef } from 'react';

const MatrixBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        // Characters to drop: 0, 1, and some time-related letters
        const chars = "01CHRONOSTIMEAIXY";
        const fontSize = 14;
        const columns = Math.floor(canvas.width / fontSize);

        // Array of drops - one per column
        const drops: number[] = [];
        for (let x = 0; x < columns; x++) {
            drops[x] = Math.random() * height; // Start at random heights
        }

        const draw = () => {
            // Semi-transparent black to create trail effect
            ctx.fillStyle = "rgba(2, 2, 3, 0.05)";
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#1d4ed8"; // Blue text (matches the CSS variable)
            ctx.font = fontSize + "px monospace";

            // Re-calculate columns if width changed significantly (though resize handles canvas size, drops array needs care)
            // For simplicity in this loop we just use current drops length, but ideally we'd resize drops array on resize.
            // Let's just stick to the simple version for now or update columns in resize.

            for (let i = 0; i < drops.length; i++) {
                // Random character
                const text = chars.charAt(Math.floor(Math.random() * chars.length));

                // Draw the character
                // Vary opacity for depth
                const opacity = Math.random();
                if (opacity > 0.8) {
                    ctx.fillStyle = "#60a5fa"; // Lighter blue highlight
                } else {
                    ctx.fillStyle = "#172554"; // Dark blue fade
                }

                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                // Reset drop to top randomly after it has crossed screen
                if (drops[i] * fontSize > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }

                // Increment Y coordinate
                drops[i]++;
            }
        };

        const intervalId = setInterval(draw, 50);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Dynamic Background Canvas (Matrix/Code effect) */}
            <canvas ref={canvasRef} className="absolute inset-0 opacity-30" />

            {/* Noise Overlay */}
            <div className="absolute inset-0 opacity-[0.05] z-10" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
            }}></div>

            {/* Bottom Glow */}
            <div className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] z-0" style={{
                background: 'radial-gradient(circle, rgba(29, 78, 216, 0.15) 0%, rgba(0,0,0,0) 70%)'
            }}></div>
        </div>
    );
};

export default MatrixBackground;
