/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

export default function Avatar({ isThinking, isDarkMode }) {
  const coreRef = useRef();
  const outerRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Animasi Denyut Jantung (Pulsing)
    // Saat berpikir, denyutnya lebih cepat dan tegang
    const pulseSpeed = isThinking ? 3 : 1.5;
    const pulseIntensity = isThinking ? 0.15 : 0.08;
    const scale = 1 + Math.sin(t * pulseSpeed) * pulseIntensity;

    if (coreRef.current) {
      coreRef.current.scale.set(scale, scale, scale);
      // Rotasi pelan agar terlihat dinamis
      coreRef.current.rotation.z = t * 0.2;
    }

    if (outerRef.current) {
      // Lapisan luar bergerak berlawanan arah dan lebih lambat
      outerRef.current.rotation.y = t * -0.3;
      outerRef.current.rotation.z = t * 0.1;
      
      // Ubah warna distorsi sedikit berdasarkan waktu agar terlihat mengalir
      const material = outerRef.current.material;
      if (material.uniforms) {
         material.uniforms.time.value = t;
      }
    }
  });

  // Warna Aura Berdasarkan Mode (Tetap bernuansa nafsu: Merah/Ungu/Pink)
  const coreColor = isDarkMode ? "#ff0055" : "#ff3377"; // Merah Neon Gelap / Pink Terang
  const outerColor = isDarkMode ? "#bd00ff" : "#aa00ff"; // Ungu Neon / Ungu Terang
  const glowEmissive = isDarkMode ? "#550011" : "#ffcccc"; // Pendaran dalam

  return (
    <Float floatIntensity={0.5} rotationIntensity={0.2} speed={2}>
      <group position={[0, 0, 0]} scale={1.8}>
        
        {/* --- INTI ENERGI (CORE) --- */}
        {/* Bola dalam yang padat dan panas */}
        <Sphere ref={coreRef} args={[0.5, 64, 64]}>
          <meshPhysicalMaterial
            color={coreColor}
            emissive={glowEmissive} // Bercahaya dari dalam
            emissiveIntensity={isThinking ? 2 : 1}
            roughness={0.1}
            metalness={0.8}
            clearcoat={1}
            thickness={2}
            transmission={0.2} // Sedikit transparan
          />
        </Sphere>

        {/* --- AURA LUAR YANG MENGALIR (DISTORTED SHELL) --- */}
        {/* Lapisan luar yang bergejolak seperti cairan atau asap */}
        <Sphere ref={outerRef} args={[0.7, 64, 64]}>
          <MeshDistortMaterial
            color={outerColor}
            emissive={outerColor}
            emissiveIntensity={0.5}
            // Kecepatan dan kekuatan distorsi (efek meleleh/cair)
            speed={isThinking ? 3 : 1.5} 
            distort={isThinking ? 0.5 : 0.3} 
            radius={1}
            transparent
            opacity={0.4} // Transparan agar inti terlihat
            side={THREE.DoubleSide}
          />
        </Sphere>

        {/* --- PARTIKEL CAHAYA HALUS (Opsional, menambah kesan magis) --- */}
        <mesh scale={1.2}>
           <sphereGeometry args={[0.8, 32, 32]}/>
           <meshBasicMaterial color={outerColor} transparent opacity={0.05} wireframe />
        </mesh>

      </group>
    </Float>
  );
}