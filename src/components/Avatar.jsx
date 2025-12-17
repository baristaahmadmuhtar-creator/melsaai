/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float, Sparkles, Icosahedron } from "@react-three/drei";
import * as THREE from "three";

export default function Avatar({ isThinking, isDarkMode }) {
  const coreRef = useRef();
  const shellRef = useRef();
  const cageRef = useRef();
  
  // --- CONFIG WARNA (Palette Premium) ---
  // Menggunakan useMemo agar object tidak dibuat ulang setiap render
  const colors = useMemo(() => ({
    dark: {
      core: new THREE.Color("#ff0040"), // Merah Deep
      shell: new THREE.Color("#6600cc"), // Ungu Royal
      emissive: new THREE.Color("#ff0055"),
      sparkle: "#ff99cc"
    },
    light: {
      core: new THREE.Color("#ff3377"), // Pink Hot
      shell: new THREE.Color("#00ccff"), // Cyan Electric
      emissive: new THREE.Color("#ff99aa"),
      sparkle: "#0099ff"
    }
  }), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    
    // 1. Tentukan Target Warna berdasarkan Mode
    const target = isDarkMode ? colors.dark : colors.light;

    // 2. Animasi Denyut Jantung (Heartbeat Pulse)
    // Saat berpikir (isThinking), detak lebih cepat & intens
    const pulseSpeed = isThinking ? 4 : 1.2;
    const pulseAmp = isThinking ? 0.2 : 0.05;
    const scalePulse = 1 + Math.sin(t * pulseSpeed) * pulseAmp;

    // --- ANIMASI CORE (INTI) ---
    if (coreRef.current) {
      coreRef.current.scale.setScalar(scalePulse); // Scale seragam x,y,z
      coreRef.current.rotation.y += delta * 0.5;
      
      // Lerp (Linear Interpolation) Warna agar transisi halus
      coreRef.current.material.color.lerp(target.core, 0.05);
      coreRef.current.material.emissive.lerp(target.emissive, 0.05);
      
      // Intensitas cahaya naik saat berpikir
      const targetIntensity = isThinking ? 3.5 : 1.5;
      coreRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        coreRef.current.material.emissiveIntensity,
        targetIntensity,
        0.1
      );
    }

    // --- ANIMASI SHELL (LUAR) ---
    if (shellRef.current) {
      // Rotasi berlawanan arah jam
      shellRef.current.rotation.x = Math.sin(t * 0.2) * 0.5;
      shellRef.current.rotation.y += delta * 0.2;
      
      shellRef.current.material.color.lerp(target.shell, 0.05);
      
      // Distorsi menjadi sangat "cair" saat berpikir
      const targetDistort = isThinking ? 0.6 : 0.3;
      const targetSpeed = isThinking ? 4 : 1.5;
      
      shellRef.current.material.distort = THREE.MathUtils.lerp(shellRef.current.material.distort, targetDistort, 0.05);
      shellRef.current.material.speed = THREE.MathUtils.lerp(shellRef.current.material.speed, targetSpeed, 0.05);
    }

    // --- ANIMASI CAGE (JARING WIREFRAME) ---
    if (cageRef.current) {
      // Berputar cepat secara diagonal
      cageRef.current.rotation.z -= delta * 0.2;
      cageRef.current.rotation.x += delta * 0.1;
      
      // Efek bernafas pada wireframe
      const cageScale = 1.3 + Math.sin(t * 0.5) * 0.05;
      cageRef.current.scale.setScalar(cageScale);
    }
  });

  return (
    <Float 
      floatIntensity={1} 
      rotationIntensity={0.5} 
      speed={2} 
      floatingRange={[-0.2, 0.2]}
    >
      <group position={[0, 0, 0]} scale={1.8}>
        
        {/* 1. CORE: Inti Panas & Bercahaya (High Quality Glass) */}
        <Sphere ref={coreRef} args={[0.45, 64, 64]}>
          <meshPhysicalMaterial
            roughness={0}           // Sangat licin
            metalness={0.2}         
            transmission={0.5}      // Setengah transparan (kaca)
            thickness={2}           // Ketebalan kaca
            clearcoat={1}           // Lapisan pelindung mengkilap
            clearcoatRoughness={0}
            toneMapped={false}      // Agar warna emissive benar-benar menyala (neon)
          />
        </Sphere>

        {/* 2. SHELL: Lapisan Cairan Distorsi */}
        <Sphere ref={shellRef} args={[0.7, 64, 64]}>
          <MeshDistortMaterial
            roughness={0.2}
            metalness={0.9}          // Seperti logam cair (mercury/ferrofluid)
            radius={1}
            transparent={true}
            opacity={0.35}           // Transparan agar Core terlihat
            side={THREE.DoubleSide}
          />
        </Sphere>

        {/* 3. TECH CAGE: Icosahedron Wireframe (Kesan Cyberpunk/Hacker) */}
        <Icosahedron ref={cageRef} args={[0.85, 0]}>
          <meshBasicMaterial 
            color={isDarkMode ? "#ff00ff" : "#00ffff"} 
            wireframe 
            transparent 
            opacity={0.15} 
          />
        </Icosahedron>

        {/* 4. PARTIKEL: Debu Energi di Sekitar Avatar */}
        <Sparkles 
          count={isThinking ? 80 : 40} // Lebih banyak partikel saat berpikir
          scale={2.5} 
          size={isThinking ? 4 : 2} 
          speed={isThinking ? 1 : 0.4} 
          opacity={0.6}
          color={isDarkMode ? colors.dark.sparkle : colors.light.sparkle}
          noise={0.5}
        />

        {/* Point Light Internal untuk Highlight Dramatis */}
        <pointLight 
          position={[1, 1, 1]} 
          intensity={2} 
          color={isDarkMode ? "#ff0055" : "#00ccff"} 
          distance={3} 
        />

      </group>
    </Float>
  );
}