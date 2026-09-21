import * as THREE from "three";

// Retro-futuristic articulated brass-and-energy structure that performs the
// "weave" narrative transition when the woven 2D menu is used.
export function createLoomMaster() {
  const group = new THREE.Group();
  group.name = "LoomMaster";

  const brass = new THREE.MeshStandardMaterial({
    color: 0xb08d57,
    metalness: 0.92,
    roughness: 0.28,
    emissive: 0x1a0f00,
    emissiveIntensity: 0.15,
  });

  const darkBrass = new THREE.MeshStandardMaterial({
    color: 0x6b5334,
    metalness: 0.85,
    roughness: 0.4,
  });

  // Dark mode lights this as lit metal against a black room. Over a white page
  // the same material reads as a black silhouette that swallows the copy
  // behind it, so light mode swaps it for pale, mostly-transparent glass.
  // depthWrite goes off with it: without that, the near half of a ring
  // occludes the far half and the "glass" looks like flat cut-out plastic.
  const METAL = {
    brass: { color: 0xb08d57, metalness: 0.92, roughness: 0.28, opacity: 1, transparent: false, depthWrite: true },
    darkBrass: { color: 0x6b5334, metalness: 0.85, roughness: 0.4, opacity: 1, transparent: false, depthWrite: true },
  };
  const GLASS = {
    brass: { color: 0xe6ebfa, metalness: 0.12, roughness: 0.08, opacity: 0.22, transparent: true, depthWrite: false },
    darkBrass: { color: 0xd6ddf1, metalness: 0.1, roughness: 0.16, opacity: 0.18, transparent: true, depthWrite: false },
  };

  // Pedestal
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(14, 20, 26, 12), darkBrass);
  pedestal.position.y = -34;
  group.add(pedestal);

  // Concentric rotating rings, each on its own pivot for independent spin.
  const ringPivots = [];
  const ringRadii = [46, 66, 88];
  ringRadii.forEach((radius, i) => {
    const pivot = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.6, 10, 48), brass);
    ring.rotation.x = Math.PI / 2 + i * 0.35;
    pivot.add(ring);
    pivot.rotation.z = i * 0.6;
    group.add(pivot);
    ringPivots.push(pivot);
  });

  // Energy core.
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a6bff,
    emissive: 0x8a6bff,
    emissiveIntensity: 2.2,
    metalness: 0.1,
    roughness: 0.15,
    transparent: true,
    opacity: 0.92,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 2), coreMaterial);
  group.add(core);

  const coreLight = new THREE.PointLight(0x8a6bff, 6, 420, 2);
  core.add(coreLight);

  // Articulated arms: shoulder -> forearm -> hand, each a pivot chain so
  // joint rotations can be tweened during the "select data threads" phase.
  const arms = [];
  const handMaterials = [];
  const armCount = 4;
  for (let i = 0; i < armCount; i++) {
    const shoulderPivot = new THREE.Group();
    const angle = (i / armCount) * Math.PI * 2;
    shoulderPivot.position.set(Math.cos(angle) * 20, 6, Math.sin(angle) * 20);
    shoulderPivot.rotation.y = -angle;

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, 34, 8), brass);
    upperArm.position.y = 17;
    upperArm.rotation.x = Math.PI / 2.4;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, 30, 14);
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.4, 30, 8), darkBrass);
    forearm.position.y = 15;
    elbowPivot.add(forearm);

    const handPivot = new THREE.Group();
    handPivot.position.y = 30;
    elbowPivot.add(handPivot);

    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a6bff,
      emissive: 0x5eead4,
      emissiveIntensity: 1.4,
      metalness: 0.3,
      roughness: 0.2,
    });
    handMaterials.push(handMaterial);
    const hand = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 6), handMaterial);
    hand.rotation.x = Math.PI;
    handPivot.add(hand);

    group.add(shoulderPivot);
    arms.push({ shoulderPivot, elbowPivot, handPivot, restShoulderX: shoulderPivot.rotation.x });
  }

  group.userData.ringPivots = ringPivots;
  group.userData.arms = arms;
  group.userData.core = core;
  group.userData.coreLight = coreLight;
  group.userData.coreMaterial = coreMaterial;

  let lightTheme = false;

  function applyPreset(material, preset) {
    material.color.setHex(preset.color);
    material.metalness = preset.metalness;
    material.roughness = preset.roughness;
    material.opacity = preset.opacity;
    material.transparent = preset.transparent;
    material.depthWrite = preset.depthWrite;
    material.needsUpdate = true;
  }

  group.userData.setTheme = (light) => {
    lightTheme = light;
    const set = light ? GLASS : METAL;
    applyPreset(brass, set.brass);
    applyPreset(darkBrass, set.darkBrass);

    // The emissive core is a hot violet lamp — glare on black, a magenta blob
    // over white. It stays lit but drops to a tint.
    coreMaterial.transparent = true;
    coreMaterial.opacity = light ? 0.3 : 0.92;
    coreMaterial.depthWrite = !light;
    coreMaterial.needsUpdate = true;

    handMaterials.forEach((mat) => {
      mat.transparent = light;
      mat.opacity = light ? 0.45 : 1;
      mat.depthWrite = !light;
      mat.emissiveIntensity = light ? 0.5 : 1.4;
      mat.needsUpdate = true;
    });
  };

  // Idle animation + "activation" pose (0 = dormant, 1 = fully woven/active).
  group.userData.update = (time, activation) => {
    ringPivots.forEach((pivot, i) => {
      const speed = 0.12 + i * 0.05 + activation * 0.6;
      pivot.rotation.z += speed * 0.016;
      pivot.rotation.x = Math.sin(time * 0.3 + i) * 0.15 * (1 + activation);
    });

    core.rotation.y += 0.006 + activation * 0.02;
    core.rotation.x += 0.003;
    const pulse = 1 + Math.sin(time * 2.2) * 0.06 * (0.4 + activation);
    core.scale.setScalar(pulse * (0.9 + activation * 0.35));
    // Both are rewritten every frame, so the theme has to be folded in here or
    // setTheme's values are gone by the next tick.
    const glare = lightTheme ? 0.28 : 1;
    coreMaterial.emissiveIntensity = (1.6 + activation * 3.2 + Math.sin(time * 3.0) * 0.3) * glare;
    coreLight.intensity = (4 + activation * 10) * glare;

    arms.forEach((arm, i) => {
      const reach = activation;
      arm.shoulderPivot.rotation.x = arm.restShoulderX - reach * 0.9;
      arm.elbowPivot.rotation.x = -reach * 1.1 + Math.sin(time * 1.6 + i) * 0.08 * reach;
      arm.handPivot.rotation.z = Math.sin(time * 2.4 + i * 1.3) * 0.5 * reach;
    });
  };

  return group;
}
