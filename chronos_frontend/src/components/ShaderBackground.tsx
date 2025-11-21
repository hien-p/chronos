import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector2 } from 'three';

const FragmentShader = `
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;

varying vec2 vUv;

// Noise function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vec2 st = gl_FragCoord.xy / uResolution.xy;
    st.x *= uResolution.x / uResolution.y;
    
    vec2 mouse = uMouse / uResolution.xy;
    
    float t = uTime * 0.2;
    
    // Create flowing waves
    float n = noise(st * 3.0 + t);
    float n2 = noise(st * 6.0 - t * 1.5);
    
    // Interactive ripple
    float dist = distance(st, mouse);
    float ripple = sin(dist * 20.0 - uTime * 2.0) * exp(-dist * 4.0);
    
    // Color mixing
    vec3 color1 = vec3(0.01, 0.01, 0.02); // Deep obsidian
    vec3 color2 = vec3(0.05, 0.0, 0.1);   // Dark purple
    vec3 color3 = vec3(0.0, 0.1, 0.2);    // Dark cyan
    
    vec3 finalColor = mix(color1, color2, n);
    finalColor = mix(finalColor, color3, n2 * 0.5);
    finalColor += vec3(0.2, 0.4, 1.0) * ripple * 0.2; // Blue glow on interaction
    
    // Vignette
    float vignette = 1.0 - length(vUv - 0.5) * 1.5;
    finalColor *= vignette;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const VertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GradientMesh = () => {
    const mesh = useRef<any>(null);
    const mousePosition = useRef(new Vector2(0, 0));

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uResolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
            uMouse: { value: new Vector2(0, 0) },
        }),
        []
    );

    useFrame((state) => {
        const { clock, mouse } = state;
        if (mesh.current) {
            mesh.current.material.uniforms.uTime.value = clock.getElapsedTime();
            // Smooth mouse movement
            mousePosition.current.lerp(new Vector2(mouse.x * window.innerWidth, mouse.y * window.innerHeight), 0.1);
            mesh.current.material.uniforms.uMouse.value = mousePosition.current;
        }
    });

    return (
        <mesh ref={mesh} scale={[10, 10, 1]}>
            <planeGeometry args={[2, 2]} />
            <shaderMaterial
                fragmentShader={FragmentShader}
                vertexShader={VertexShader}
                uniforms={uniforms}
            />
        </mesh>
    );
};

export default function ShaderBackground() {
    return (
        <div className="fixed inset-0 -z-10">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <GradientMesh />
            </Canvas>
        </div>
    );
}
