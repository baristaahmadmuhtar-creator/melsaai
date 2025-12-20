/* eslint-disable react/prop-types */
/* eslint-disable react/no-unknown-property */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, Torus, Octahedron, Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

export default function Avatar({ isThinking }) {
  const coreRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const outerRef = useRef();
  
  // Theme: MELSA AI (Lime & Dark Tech)
  const colors = useMemo(() => ({
    core: new THREE.Color("#ccff00"), // Acid Lime
    dark: new THREE.Color("#050505"),
    accent: new THREE.Color("#ffffff")
  }), []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const speed = isThinking ? 5 : 1;

    // 1. CORE PULSE (Jantung)
    if (coreRef.current) {
      // Skala berdenyut
      const pulse = 1 + Math.sin(t * (isThinking ? 8 : 2)) * 0.05;
      coreRef.current.scale.setScalar(pulse);
      
      // Intensitas cahaya naik saat mikir
      coreRef.current.material.emissiveIntensity = isThinking ? 4 : 1.5;
    }

    // 2. RINGS ROTATION (Giroskop)
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.5 * speed;
      ring1Ref.current.rotation.y += delta * 0.2 * speed;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= delta * 0.3 * speed;
      ring2Ref.current.rotation.z += delta * 0.6 * speed;
    }

    // 3. OUTER SHELL (Pelindung)
    if (outerRef.current) {
      outerRef.current.rotation.y += delta * 0.1;
      // Efek 'breathing' pada wireframe
      outerRef.current.scale.setScalar(1.5 + Math.sin(t * 0.5) * 0.05);
    }
  });

  return (
    <Float floatIntensity={1} rotationIntensity={0.5} speed={2}>
      <group scale={1.6}>
        
        {/* A. INTELLECT CORE (Bola Bersinar) */}
        <Sphere ref={coreRef} args={[0.5, 32, 32]}>
          <meshStandardMaterial 
            color="#000" 
            emissive={colors.core} 
            emissiveIntensity={2} 
            toneMapped={false}
            roughness={0.2}
          />
        </Sphere>

        {/* B. GYROSCOPE RINGS (Mekanik) */}
        <Torus ref={ring1Ref} args={[0.7, 0.02, 16, 100]}>
          <meshStandardMaterial color="#333" metalness={1} roughness={0} />
        </Torus>
        
        <Torus ref={ring2Ref} args={[0.9, 0.03, 16, 100]}>
          <meshStandardMaterial color="#ccff00" metalness={0.8} roughness={0.2} emissive="#ccff00" emissiveIntensity={0.5}/>
        </Torus>

        {/* C. DATA FIELD (Partikel) */}
        <Sparkles 
          count={isThinking ? 150 : 60} 
          scale={3.5} 
          size={isThinking ? 3 : 1.5} 
          speed={0.4} 
          opacity={0.6}
          color={colors.core}
        />

        {/* D. OUTER DATA CAGE (Wireframe) */}
        <Octahedron ref={outerRef} args={[1, 0]}>
           <meshBasicMaterial wireframe color="#444" transparent opacity={0.3} />
        </Octahedron>

        {/* LIGHTING */}
        <pointLight position={[0, 0, 0]} intensity={2} color={colors.core} distance={5} />
        <ambientLight intensity={0.5} />
      </group>
    </Float>
  );
}