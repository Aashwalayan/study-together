import { useMemo, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// A procedural classroom: everything is built from simple shapes in code, so
// there are no model files to load. Seat positions come from the server
// (server/src/utils/seats.js); this file only decides how things look.
//
// Layout: the board is on the back wall (negative z), students sit at
// positive z and face -z. The windows are on the left wall, the door is on
// the right wall.

const Z0 = -3.6; // inner face of the back wall
const Z1 = 13; // front edge of the floor
const FLOOR_D = Z1 - Z0;
const FLOOR_CZ = (Z0 + Z1) / 2;
const SHADOW = { castShadow: true, receiveShadow: true };


// Camera rules: the camera and its focus point can never leave the room.
const MARGIN = 0.7; // how close the camera may get to a wall
const CAM_LIMITS = { x: [-8 + MARGIN, 8 - MARGIN], y: [0.6, 4.4], z: [Z0 + MARGIN, Z1 - MARGIN] };
const TARGET_LIMITS = { x: CAM_LIMITS.x, y: [0.4, 2.5], z: CAM_LIMITS.z };
const START_CAMERA = [0, 3.8, 12.2];
const START_TARGET = [0, 1.2, 3];
const WALK_SPEED = 4; // units per second (doubled while holding Shift)
const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];

const SKIN = ['#f1c7a5', '#e0ac82', '#c68863', '#a2663f', '#7a4a2c', '#f6d9bd'];
const HAIR = ['#1d1a18', '#3b2a20', '#6b4423', '#a8742f', '#c9a063', '#8a3b2a', '#2a2f3a'];
const PANTS = ['#2f3b52', '#3d3d3d', '#5b4a3a', '#33473f', '#4a3a55'];
const BOOKS = ['#b5483c', '#3c6fb5', '#d9a441', '#4f8a5b', '#7a4fa0', '#c9c2b0', '#2f4858'];

const hashOf = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

// Small helper so the many box-shaped objects stay readable
function Box({ args, position, rotation, color, shadow = false, ...rest }) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      {...(shadow ? SHADOW : { receiveShadow: true })}
      {...rest}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Window({ z }) {
  const frame = '#f3efe4';
  return (
    <group position={[-7.97, 2.7, z]}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 1.9]} />
        <meshBasicMaterial color="#cfe9ff" toneMapped={false} />
      </mesh>
      <Box args={[0.1, 0.1, 2.4]} position={[0.02, 1.0, 0]} color={frame} />
      <Box args={[0.1, 0.1, 2.4]} position={[0.02, -1.0, 0]} color={frame} />
      <Box args={[0.1, 2.1, 0.1]} position={[0.02, 0, 1.15]} color={frame} />
      <Box args={[0.1, 2.1, 0.1]} position={[0.02, 0, -1.15]} color={frame} />
      <Box args={[0.05, 1.9, 0.05]} position={[0.02, 0, 0]} color={frame} />
      <Box args={[0.05, 0.05, 2.2]} position={[0.02, 0, 0]} color={frame} />
      <Box args={[0.22, 0.07, 2.6]} position={[0.1, -1.08, 0]} color={frame} />
    </group>
  );
}

function Door() {
  return (
    <group position={[7.95, 0, 11]}>
      <Box args={[0.1, 3.2, 1.7]} position={[0, 1.6, 0]} color="#5a4330" />
      <Box args={[0.08, 3.0, 1.4]} position={[-0.04, 1.5, 0]} color="#8b6b47" />
      <Box args={[0.04, 1.0, 0.9]} position={[-0.09, 1.9, 0]} color="#7d5f3f" />
      <mesh position={[-0.1, 1.4, 0.5]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#c9b36a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Board() {
  const z = Z0 + 0.05;
  const lines = [2.8, 2.2, 3.1, 1.6];
  return (
    <group>
      <Box args={[6.5, 2.2, 0.06]} position={[0, 2.3, z]} color="#27403a" />
      <Box args={[6.7, 0.1, 0.1]} position={[0, 3.45, z]} color="#8a6a49" />
      <Box args={[6.7, 0.1, 0.1]} position={[0, 1.15, z]} color="#8a6a49" />
      <Box args={[0.1, 2.4, 0.1]} position={[-3.3, 2.3, z]} color="#8a6a49" />
      <Box args={[0.1, 2.4, 0.1]} position={[3.3, 2.3, z]} color="#8a6a49" />
      <Box args={[6.5, 0.05, 0.16]} position={[0, 1.1, z + 0.06]} color="#7a5c3d" />
      {/* chalk writing */}
      {lines.map((w, i) => (
        <mesh key={w} position={[-3 + w / 2, 3.1 - i * 0.28, z + 0.035]}>
          <boxGeometry args={[w, 0.03, 0.01]} />
          <meshBasicMaterial color="#dfe8e2" />
        </mesh>
      ))}
      <mesh position={[2.2, 2.0, z + 0.035]}>
        <torusGeometry args={[0.4, 0.015, 8, 32]} />
        <meshBasicMaterial color="#dfe8e2" />
      </mesh>
      {/* chalk and eraser on the tray */}
      <Box args={[0.3, 0.07, 0.1]} position={[-1.2, 1.17, z + 0.06]} color="#4a4a4a" />
      <Box args={[0.1, 0.02, 0.02]} position={[0.4, 1.14, z + 0.06]} color="#f4f4f4" />
    </group>
  );
}

function Clock() {
  return (
    <group position={[4.6, 4.0, Z0 + 0.03]}>
      <mesh>
        <circleGeometry args={[0.4, 32]} />
        <meshStandardMaterial color="#f7f5ee" />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <ringGeometry args={[0.4, 0.45, 32]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
      <group rotation={[0, 0, Math.PI / 3]}>
        <mesh position={[0, 0.1, 0.01]}>
          <boxGeometry args={[0.03, 0.2, 0.01]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      </group>
      <group rotation={[0, 0, -Math.PI / 3]}>
        <mesh position={[0, 0.15, 0.015]}>
          <boxGeometry args={[0.02, 0.3, 0.01]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      </group>
    </group>
  );
}

function Bookshelf() {
  const shelves = [0.075, 1.025, 2.025];
  return (
    <group position={[6.3, 0, Z0 + 0.27]}>
      <Box args={[0.05, 3.05, 0.45]} position={[-1.2, 1.5, 0]} color="#7a5c3d" shadow />
      <Box args={[0.05, 3.05, 0.45]} position={[1.2, 1.5, 0]} color="#7a5c3d" shadow />
      <Box args={[2.4, 3.0, 0.03]} position={[0, 1.5, -0.2]} color="#6b4f33" />
      {[0.025, 1, 2, 3].map((y) => (
        <Box key={y} args={[2.4, 0.05, 0.45]} position={[0, y, 0]} color="#7a5c3d" shadow />
      ))}
      {shelves.map((base, s) =>
        Array.from({ length: 9 }, (_, i) => {
          const h = 0.5 + ((i * 37 + s * 17) % 30) / 100;
          const w = 0.12 + ((i * 13 + s * 7) % 8) / 100;
          return (
            <Box
              key={`${s}-${i}`}
              args={[w, h, 0.3]}
              position={[-1.05 + i * 0.26, base + h / 2, 0]}
              color={BOOKS[(i + s * 3) % BOOKS.length]}
              shadow
            />
          );
        })
      )}
    </group>
  );
}

function TeacherDesk() {
  return (
    <group position={[-5.6, 0, -2.4]}>
      <Box args={[2.2, 0.08, 0.9]} position={[0, 0.8, 0]} color="#8a6a49" shadow />
      <Box args={[0.06, 0.76, 0.8]} position={[-1.05, 0.38, 0]} color="#6b523a" shadow />
      <Box args={[0.06, 0.76, 0.8]} position={[1.05, 0.38, 0]} color="#6b523a" shadow />
      <Box args={[2.0, 0.5, 0.04]} position={[0, 0.5, -0.4]} color="#6b523a" shadow />
      {/* laptop */}
      <Box args={[0.5, 0.02, 0.34]} position={[0.3, 0.85, 0.05]} color="#9aa3a8" shadow />
      <Box args={[0.5, 0.32, 0.02]} position={[0.3, 1.0, -0.12]} rotation={[-0.25, 0, 0]} color="#4a5258" shadow />
      {/* chair behind the desk */}
      <Box args={[0.5, 0.06, 0.5]} position={[-0.3, 0.5, -0.9]} color="#3d4a52" shadow />
      <Box args={[0.5, 0.5, 0.06]} position={[-0.3, 0.8, -1.15]} color="#3d4a52" shadow />
      <Box args={[0.06, 0.47, 0.06]} position={[-0.3, 0.24, -0.9]} color="#2b3238" shadow />
    </group>
  );
}

function Room() {
  const floorboards = useMemo(() => Array.from({ length: 15 }, (_, i) => -7 + i), []);
  const sunPatches = [1, 5, 9];
  const panels = [-4.5, 0, 4.5].flatMap((x) => [2, 8].map((z) => [x, z]));

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, FLOOR_CZ]} receiveShadow>
        <planeGeometry args={[16, FLOOR_D]} />
        <meshStandardMaterial color="#b98f62" roughness={0.9} />
      </mesh>
      {floorboards.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.003, FLOOR_CZ]}>
          <planeGeometry args={[0.02, FLOOR_D]} />
          <meshBasicMaterial color="#a07a52" />
        </mesh>
      ))}

      {/* rug in front of the board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -1.9]} receiveShadow>
        <planeGeometry args={[6.6, 2.1]} />
        <meshStandardMaterial color="#d8c08a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.9]} receiveShadow>
        <planeGeometry args={[6.2, 1.7]} />
        <meshStandardMaterial color="#8c3b3b" />
      </mesh>

      {/* walls with a painted lower band and a chair rail */}
      <Box args={[16.4, 5, 0.2]} position={[0, 2.5, Z0 - 0.1]} color="#ece6d8" />
      <Box args={[0.2, 5, FLOOR_D + 0.2]} position={[-8.1, 2.5, FLOOR_CZ - 0.1]} color="#e6e0d0" />
      <Box args={[0.2, 5, FLOOR_D + 0.2]} position={[8.1, 2.5, FLOOR_CZ - 0.1]} color="#e6e0d0" />
      <Box args={[16.4, 5, 0.2]} position={[0, 2.5, Z1 + 0.1]} color="#ece6d8" />
      <Box args={[16, 1, 0.05]} position={[0, 0.5, Z0 + 0.025]} color="#7f9a8f" />
      <Box args={[0.05, 1, FLOOR_D]} position={[-7.975, 0.5, FLOOR_CZ]} color="#7f9a8f" />
      <Box args={[0.05, 1, FLOOR_D]} position={[7.975, 0.5, FLOOR_CZ]} color="#7f9a8f" />
      <Box args={[16, 0.06, 0.08]} position={[0, 1.03, Z0 + 0.04]} color="#f5f1e6" />
      <Box args={[0.08, 0.06, FLOOR_D]} position={[-7.96, 1.03, FLOOR_CZ]} color="#f5f1e6" />
      <Box args={[0.08, 0.06, FLOOR_D]} position={[7.96, 1.03, FLOOR_CZ]} color="#f5f1e6" />

      {/* ceiling: single-sided, so it disappears when the camera is above it */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, FLOOR_CZ]}>
        <planeGeometry args={[16, FLOOR_D]} />
        <meshStandardMaterial color="#f4f1e8" />
      </mesh>
      {panels.map(([x, z]) => (
        <mesh key={`${x}-${z}`} rotation={[Math.PI / 2, 0, 0]} position={[x, 4.98, z]}>
          <planeGeometry args={[2.4, 0.6]} />
          <meshBasicMaterial color="#fffbe6" toneMapped={false} />
        </mesh>
      ))}

      {/* windows on the left wall, with sunlight patches on the floor */}
      {sunPatches.map((z) => (
        <group key={z}>
          <Window z={z} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5.0, 0.02, z + 0.4]}>
            <planeGeometry args={[2.0, 2.4]} />
            <meshBasicMaterial color="#fff3c4" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Door />
      <Board />
      <Clock />
      <Bookshelf />
      <TeacherDesk />
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

// A capsule stretched between two points, used for arms and shins
function Limb({ from, to, radius = 0.05, color }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    return { position: a.add(b).multiplyScalar(0.5).toArray(), quaternion: q, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion} {...SHADOW}>
      <capsuleGeometry args={[radius, Math.max(length - radius * 2, 0.01), 4, 10]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

// Positions are relative to the top of the bench. The student faces -z.
// While the timer is in a focus phase the head tips down towards the book;
// during a break it looks up.
function Avatar({ occupant, isMe, phase, bubble }) {
  const look = useMemo(() => {
    const h = hashOf(occupant.userId);
    return {
      skin: SKIN[h % SKIN.length],
      hair: HAIR[Math.floor(h / 7) % HAIR.length],
      pants: PANTS[Math.floor(h / 13) % PANTS.length],
      shirt: `hsl(${h % 360} 50% 46%)`,
      longHair: Math.floor(h / 17) % 3 === 0,
    };
  }, [occupant.userId]);
  const { skin, hair, pants, shirt, longHair } = look;

  const sides = [-1, 1];
  const mat = (color) => <meshStandardMaterial color={color} roughness={0.8} />;

  return (
    <group position={[0, 0.5, 0]}>
      {/* torso and hips */}
      <mesh position={[0, 0.4, 0]} scale={[1.3, 1, 0.85]} {...SHADOW}>
        <capsuleGeometry args={[0.16, 0.28, 4, 12]} />
        {mat(shirt)}
      </mesh>
      <mesh position={[0, 0.1, -0.02]} {...SHADOW}>
        <boxGeometry args={[0.38, 0.14, 0.3]} />
        {mat(pants)}
      </mesh>

      {sides.map((s) => (
        <group key={s}>
          {/* legs: thigh forward over the bench, shin hanging to the floor */}
          <mesh position={[s * 0.1, 0.1, -0.22]} {...SHADOW}>
            <boxGeometry args={[0.15, 0.14, 0.44]} />
            {mat(pants)}
          </mesh>
          <Limb from={[s * 0.1, 0.1, -0.42]} to={[s * 0.1, -0.42, -0.46]} radius={0.065} color={pants} />
          <mesh position={[s * 0.1, -0.46, -0.52]} {...SHADOW}>
            <boxGeometry args={[0.14, 0.08, 0.24]} />
            {mat('#2a2a2a')}
          </mesh>
          {/* arms: shoulder, elbow, then hand resting on the desk */}
          <Limb from={[s * 0.27, 0.6, 0]} to={[s * 0.3, 0.4, -0.3]} radius={0.055} color={shirt} />
          <Limb from={[s * 0.3, 0.4, -0.3]} to={[s * 0.17, 0.43, -0.62]} radius={0.05} color={shirt} />
          <mesh position={[s * 0.17, 0.43, -0.62]} {...SHADOW}>
            <sphereGeometry args={[0.05, 10, 10]} />
            {mat(skin)}
          </mesh>
        </group>
      ))}

      {/* open notebook on the desk */}
      <mesh position={[0, 0.39, -0.85]} {...SHADOW}>
        <boxGeometry args={[0.46, 0.012, 0.32]} />
        {mat(shirt)}
      </mesh>
      <mesh position={[0, 0.4, -0.85]} {...SHADOW}>
        <boxGeometry args={[0.42, 0.02, 0.28]} />
        {mat('#f4efe3')}
      </mesh>

      {/* neck and head */}
      <mesh position={[0, 0.68, 0]} {...SHADOW}>
        <cylinderGeometry args={[0.05, 0.055, 0.1, 10]} />
        {mat(skin)}
      </mesh>
      <group position={[0, 0.72, 0]} rotation={[phase === 'focus' ? -0.35 : 0, 0, 0]}>
        <group position={[0, 0.2, 0]}>
          <mesh {...SHADOW}>
            <sphereGeometry args={[0.17, 20, 16]} />
            {mat(skin)}
          </mesh>
          <mesh position={[0, 0.02, 0.012]} {...SHADOW}>
            <sphereGeometry args={[0.18, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            {mat(hair)}
          </mesh>
          <mesh position={[0, longHair ? -0.1 : 0, 0.11]} {...SHADOW}>
            <boxGeometry args={[0.3, longHair ? 0.4 : 0.22, 0.1]} />
            {mat(hair)}
          </mesh>
          {sides.map((s) => (
            <mesh key={s} position={[s * 0.06, 0, -0.158]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#1c1c1c" />
            </mesh>
          ))}
          <mesh position={[0, -0.03, -0.17]} {...SHADOW}>
            <boxGeometry args={[0.04, 0.05, 0.04]} />
            {mat(skin)}
          </mesh>
        </group>
      </group>

      <Html position={[0, 1.4, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
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

  const legs = [
    [-0.45, -0.18],
    [0.45, -0.18],
    [-0.45, 0.18],
    [0.45, 0.18],
  ];

  return (
    <group position={[x, 0, z]}>
      {/* bench: the top is the click target */}
      <Box
        args={[1.1, 0.08, 0.5]}
        position={[0, 0.46, 0]}
        color={color}
        shadow
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
      />
      {legs.map(([lx, lz]) => (
        <Box key={`${lx}${lz}`} args={[0.06, 0.42, 0.06]} position={[lx, 0.21, lz]} color="#6b523a" shadow />
      ))}

      {/* desk in front of the bench */}
      <Box args={[1.3, 0.07, 0.6]} position={[0, 0.85, -0.85]} color="#c9b08a" shadow />
      <Box args={[0.05, 0.82, 0.5]} position={[-0.6, 0.41, -0.85]} color="#a88c66" shadow />
      <Box args={[0.05, 0.82, 0.5]} position={[0.6, 0.41, -0.85]} color="#a88c66" shadow />
      <Box args={[1.2, 0.4, 0.04]} position={[0, 0.55, -1.08]} color="#a88c66" shadow />

      {hovered && canSit && (
        <Html position={[0, 1.0, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
          <div
            style={{
              background: '#e0a94a',
              color: '#1b1608',
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Sit here
          </div>
        </Html>
      )}

      {occupant && <Avatar occupant={occupant} isMe={isMine} phase={phase} bubble={bubble} />}
    </group>
  );
}

const clamp = (v, [min, max]) => Math.min(max, Math.max(min, v));
const within = (v, [min, max]) => v >= min && v <= max;

// Moves the camera with WASD and enforces the room limits every frame, no
// matter what moved the camera (WASD, orbiting or zooming).
function CameraRig({ controlsRef }) {
  const camera = useThree((state) => state.camera);
  const pressed = useRef(new Set());
  const forward = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    // Never steal keys while the user is typing in the chat box
    const isTyping = (e) => {
      const el = e.target;
      return (
        el instanceof HTMLElement &&
        (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      );
    };
    const down = (e) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (MOVE_CODES.includes(e.code)) pressed.current.add(e.code);
    };
    const up = (e) => pressed.current.delete(e.code);
    const clear = () => pressed.current.clear();

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const keys = pressed.current;
    const forwardInput = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const sideInput = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);

    if (forwardInput || sideInput) {
      // Walk on the floor plane, relative to where the camera is looking
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      move.set(0, 0, 0).addScaledVector(forward, forwardInput);
      move.x += -forward.z * sideInput;
      move.z += forward.x * sideInput;
      const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
      move.normalize().multiplyScalar(WALK_SPEED * (fast ? 2 : 1) * Math.min(delta, 0.1));

      // Move the camera and its focus point together. An axis is blocked if
      // either would leave the room, which makes you slide along walls.
      ['x', 'z'].forEach((axis) => {
        const nextCamera = camera.position[axis] + move[axis];
        const nextTarget = controls.target[axis] + move[axis];
        if (within(nextCamera, CAM_LIMITS[axis]) && within(nextTarget, TARGET_LIMITS[axis])) {
          camera.position[axis] = nextCamera;
          controls.target[axis] = nextTarget;
        }
      });
    }

    // Hard limits, applied after OrbitControls has handled orbit and zoom
    camera.position.set(
      clamp(camera.position.x, CAM_LIMITS.x),
      clamp(camera.position.y, CAM_LIMITS.y),
      clamp(camera.position.z, CAM_LIMITS.z)
    );
    controls.target.set(
      clamp(controls.target.x, TARGET_LIMITS.x),
      clamp(controls.target.y, TARGET_LIMITS.y),
      clamp(controls.target.z, TARGET_LIMITS.z)
    );
    camera.lookAt(controls.target);
  });

  return null;
}

export default function ClassroomScene({ seats, occupants, myUserId, bubbles, phase, onSit }) {
  const controlsRef = useRef(null);
  const bySeat = new Map(occupants.filter((o) => o.seatId).map((o) => [o.seatId, o]));

  return (
    <Canvas shadows camera={{ position: START_CAMERA, fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={['#cfd8d4']} />
      <hemisphereLight args={['#fff6e5', '#9a8a74', 0.9]} />
      {/* sunlight from the window side; the only light that casts shadows */}
      <directionalLight
        position={[-9, 8, 5]}
        intensity={1.7}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
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
        ref={controlsRef}
        target={START_TARGET}
        enablePan={false}
        minDistance={2}
        maxDistance={14}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
      />
      <CameraRig controlsRef={controlsRef} />
    </Canvas>
  );
}