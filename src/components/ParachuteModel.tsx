export function ParachuteModel({ held = false }: { held?: boolean }) {
  return (
    <group name="parachute-canopy" position={held ? [0, 0.1, 0] : [0, 2.45, 0]} scale={held ? 0.35 : 1}>
      {[-2, -1, 0, 1, 2].map((panel) => (
        <mesh key={panel} position={[panel * 0.42, -Math.abs(panel) * 0.12, 0]} rotation={[0, 0, panel * 0.1]}>
          <boxGeometry args={[0.44, 0.12, 1.25]} />
          <meshLambertMaterial color={panel % 2 === 0 ? '#d94b45' : '#f0eadc'} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.64, -0.76, -0.38]} rotation={[0, 0, side * 0.24]}><boxGeometry args={[0.025, 1.5, 0.025]} /><meshLambertMaterial color="#d7d0bc" /></mesh>
          <mesh position={[side * 0.64, -0.76, 0.38]} rotation={[0, 0, side * 0.24]}><boxGeometry args={[0.025, 1.5, 0.025]} /><meshLambertMaterial color="#d7d0bc" /></mesh>
        </group>
      ))}
    </group>
  );
}
