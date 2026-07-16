import * as THREE from 'three';

export type DemoPieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type DemoColor = 'white' | 'black';

const GOLD = 0xc9a227;
const GOLD_EMISSIVE = 0x3a2500;
const HALO_COLOR = 0xffb84d;

function stoneMaterial(color: DemoColor): THREE.MeshStandardMaterial {
  return color === 'white'
    ? new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.75, metalness: 0.05 })
    : new THREE.MeshStandardMaterial({
        color: 0x5b4d70,
        roughness: 0.45,
        metalness: 0.15,
        emissive: 0x2a1c3a,
        emissiveIntensity: 0.55,
      });
}

function goldMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: GOLD,
    roughness: 0.28,
    metalness: 0.9,
    emissive: GOLD_EMISSIVE,
    emissiveIntensity: 0.6,
  });
}

function haloMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: HALO_COLOR,
    emissive: HALO_COLOR,
    emissiveIntensity: 1.4,
    roughness: 0.4,
    metalness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
}

function base(color: DemoColor): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 16), stoneMaterial(color));
  mesh.position.y = 0.06;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function goldRing(radius: number, tube: number, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 24), goldMaterial());
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function robe(color: DemoColor, topRadius: number, bottomRadius: number, height: number, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, height, 12), stoneMaterial(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function thornCrown(y: number, count: number, radius: number, spikeHeight: number): THREE.Group {
  const group = new THREE.Group();
  const mat = goldMaterial();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, spikeHeight, 6), mat);
    spike.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    spike.rotation.z = Math.cos(angle) * 0.5;
    spike.rotation.x = -Math.sin(angle) * 0.5;
    spike.castShadow = true;
    group.add(spike);
  }
  return group;
}

/** Tall pointed conical hood — the Nazareno "capirote" silhouette central to Blasphemous's iconography. */
function capirote(color: DemoColor, y: number, height: number, radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 10), stoneMaterial(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

interface PieceHandles {
  group: THREE.Group;
  halo?: THREE.Mesh;
  glowParts: THREE.Mesh[];
}

export function buildPiece(type: DemoPieceType, color: DemoColor): PieceHandles {
  const group = new THREE.Group();
  const glowParts: THREE.Mesh[] = [];
  group.add(base(color));

  switch (type) {
    case 'pawn': {
      group.add(robe(color, 0.1, 0.22, 0.5, 0.37));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), stoneMaterial(color));
      head.position.y = 0.68;
      head.castShadow = true;
      group.add(head);
      group.add(thornCrown(0.74, 5, 0.09, 0.09));
      break;
    }
    case 'knight': {
      // Deliberately un-hooded, angular horse-head silhouette so it reads instantly
      // against the bishop's smooth conical hood at a glance.
      const bodyMesh = robe(color, 0.13, 0.24, 0.46, 0.35);
      group.add(bodyMesh);

      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.15), stoneMaterial(color));
      neck.position.set(0, 0.64, 0.01);
      neck.rotation.x = -0.4;
      neck.castShadow = true;
      group.add(neck);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.34), stoneMaterial(color));
      head.position.set(0, 0.9, 0.17);
      head.rotation.x = -0.55;
      head.castShadow = true;
      group.add(head);

      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.14), stoneMaterial(color));
      snout.position.set(0, 0.83, 0.36);
      snout.rotation.x = -0.55;
      snout.castShadow = true;
      group.add(snout);

      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 6), goldMaterial());
      ear.position.set(0, 1.04, 0.05);
      ear.rotation.x = 0.25;
      ear.castShadow = true;
      group.add(ear);

      const mane = goldRing(0.15, 0.02, 0.6);
      group.add(mane);
      glowParts.push(mane);
      break;
    }
    case 'bishop': {
      group.add(robe(color, 0.11, 0.25, 0.75, 0.5));
      group.add(capirote(color, 1.05, 0.7, 0.16));
      const ring = goldRing(0.18, 0.022, 0.72);
      group.add(ring);
      glowParts.push(ring);
      break;
    }
    case 'rook': {
      const tower = robe(color, 0.26, 0.28, 0.6, 0.42);
      group.add(tower);
      const crenelPositions = [0, 1, 2, 3, 4, 5];
      crenelPositions.forEach((i) => {
        const angle = (i / crenelPositions.length) * Math.PI * 2;
        const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), stoneMaterial(color));
        crenel.position.set(Math.cos(angle) * 0.22, 0.78, Math.sin(angle) * 0.22);
        crenel.castShadow = true;
        group.add(crenel);
      });
      const band = goldRing(0.27, 0.02, 0.62);
      group.add(band);
      glowParts.push(band);
      break;
    }
    case 'queen': {
      group.add(robe(color, 0.1, 0.26, 0.95, 0.6));
      const shoulder = goldRing(0.2, 0.03, 0.95);
      group.add(shoulder);
      glowParts.push(shoulder);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), stoneMaterial(color));
      head.position.y = 1.14;
      head.castShadow = true;
      group.add(head);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 28), haloMaterial());
      halo.position.y = 1.32;
      halo.rotation.x = Math.PI / 2.4;
      group.add(halo);
      glowParts.push(halo);
      return { group, halo, glowParts };
    }
    case 'king': {
      group.add(robe(color, 0.11, 0.27, 1.05, 0.65));
      const shoulder = goldRing(0.21, 0.032, 1.02);
      group.add(shoulder);
      glowParts.push(shoulder);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), stoneMaterial(color));
      head.position.y = 1.26;
      head.castShadow = true;
      group.add(head);
      group.add(thornCrown(1.4, 7, 0.12, 0.14));
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 32), haloMaterial());
      halo.position.y = 1.5;
      halo.rotation.x = Math.PI / 2.4;
      group.add(halo);
      glowParts.push(halo);
      return { group, halo, glowParts };
    }
  }

  return { group, glowParts };
}
