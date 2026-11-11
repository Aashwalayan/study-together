import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';

// Placeholder art built from boxes and capsules so the seating logic can be
// developed first. To use a real model, load a .glb with drei's useGLTF and
// render it in place of <Room /> and <Avatar /> (see README).

const hueFor = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
};

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]}>
        <planeGeometry args={[16, 18]} />
        <meshStandardMaterial color="#b9a487" />
      </mesh>
      <mesh position={[0, 2.5, -3.7]}>
        <boxGeometry args={[16, 5, 0.2]} />
        <meshStandardMaterial color="#e7e2d6" />
      </mesh>
      <mesh position={[0, 2.3, -3.55]}>
        <boxGeometry args={[6.5, 2.2, 0.08]} />
        <meshStandardMaterial color="#27403a" />
      </mesh>
      <mesh position={[-8, 2.5, 4]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
      <mesh position={[8, 2.5, 4]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#d8d2c4" />
      </mesh>
    </group>
  );
}

// Avatars face -z (towards the board). While the timer is in a focus phase
// the head tips down, and during a break it looks up.
function Avatar({ occupant, isMe, phase, bubble }) {
  const hue = hueFor(occupant.userId);
  const body = `hsl(${hue} 55% 48%)`;
  return (
    <group position={[0, 0.5, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.22, 0.45, 4, 12]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <group position={[0, 1.12, 0]} rotation={[phase === 'focus' ? -0.4 : 0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#e8c4a0" />
        </mesh>
        <mesh position={[0, -0.02, -0.2]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshStandardMaterial color="#d3a67e" />
        </mesh>
      </group>
      <Html position={[0, 1.65, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="avatar-tag">
          {bubble && <div className="bubble">{bubble}</div>}
          <div className={isMe ? 'name me' : 'name'}>{isMe ? `${occupant.name} (you)` : occupant.name}</div>
        </div>
      </Html>
    </group>
  );
}

function Seat({ seat, occupant, isMine, canSit, phase, bubble, onSit }) {
  const [hovered, setHovered] = useState(false);
  const [x, , z] = seat.position;

  let color = '#8a6a49';
  if (isMine) color = '#5fae7a';
  else if (hovered && canSit) color = '#d2a56b';

  return (
    <group position={[x, 0, z]}>
      {/* bench */}
      <mesh
        position={[0, 0.45, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (canSit) onSit(seat.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (canSit) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        <boxGeometry args={[1.1, 0.1, 0.55]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.9, 0.4, 0.4]} />
        <meshStandardMaterial color="#6b523a" />
      </mesh>
      {/* desk in front of the bench */}
      <mesh position={[0, 0.85, -0.85]}>
        <boxGeometry args={[1.3, 0.07, 0.6]} />
        <meshStandardMaterial color="#c9b08a" />
      </mesh>
      <mesh position={[0, 0.42, -0.85]}>
        <boxGeometry args={[1.2, 0.8, 0.06]} />
        <meshStandardMaterial color="#a88c66" />
      </mesh>
      {occupant && <Avatar occupant={occupant} isMe={isMine} phase={phase} bubble={bubble} />}
    </group>
  );
}

export default function ClassroomScene({ seats, occupants, myUserId, bubbles, phase, onSit }) {
  const bySeat = new Map(occupants.filter((o) => o.seatId).map((o) => [o.seatId, o]));

  return (
    <Canvas camera={{ position: [0, 6.5, 14], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#cfd8d4']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 8]} intensity={1.1} />
      <Room />
      {seats.map((seat) => {
        const occupant = bySeat.get(seat.id);
        return (
          <Seat
            key={seat.id}
            seat={seat}
            occupant={occupant}
            isMine={occupant?.userId === myUserId}
            canSit={!occupant}
            phase={phase}
            bubble={occupant ? bubbles[occupant.userId] : null}
            onSit={onSit}
          />
        );
      })}
      <OrbitControls
        target={[0, 1.2, 3]}
        enablePan={false}
        minDistance={4}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
