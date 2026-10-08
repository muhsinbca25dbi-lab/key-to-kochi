import * as THREE from 'three';

export function initThreeScene(containerElement) {
  if (!containerElement) return null;

  // Check WebGL support
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.warn('WebGL not supported, falling back to CSS background');
      return null;
    }
  } catch (e) {
    return null;
  }

  const width = containerElement.clientWidth || window.innerWidth;
  const height = containerElement.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a0f);
  scene.fog = new THREE.FogExp2(0x080a0f, 0.015);

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 18, 48);
  camera.lookAt(0, 6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  containerElement.innerHTML = '';
  containerElement.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x1a2233, 1.2);
  scene.add(ambientLight);

  const moonLight = new THREE.DirectionalLight(0x60a5fa, 0.8);
  moonLight.position.set(30, 60, 40);
  scene.add(moonLight);

  // Golden architectural spotlights
  const goldLight1 = new THREE.PointLight(0xd4af37, 2.5, 60);
  goldLight1.position.set(-15, 12, 10);
  scene.add(goldLight1);

  const goldLight2 = new THREE.PointLight(0xf59e0b, 2.2, 55);
  goldLight2.position.set(18, 10, -5);
  scene.add(goldLight2);

  // Ground plane (Dark landscape with water channel)
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0c1017,
    roughness: 0.85,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Waterway (Representing Kochi Backwaters / Marine Drive canal)
  const waterGeo = new THREE.PlaneGeometry(35, 160);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x071e2e,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-35, 0.05, 0);
  scene.add(water);

  // Roads
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.7 });
  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(12, 140), roadMat);
  road1.rotation.x = -Math.PI / 2;
  road1.position.set(0, 0.08, 0);
  scene.add(road1);

  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(140, 10), roadMat);
  road2.rotation.x = -Math.PI / 2;
  road2.position.set(0, 0.07, 10);
  scene.add(road2);

  // Road markings
  const roadLineMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, opacity: 0.6, transparent: true });
  for (let z = -65; z < 65; z += 10) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4), roadLineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.1, z);
    scene.add(dash);
  }

  // Building Materials
  const bldgMatDark = new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: 0.4, metalness: 0.3 });
  const bldgMatCharcoal = new THREE.MeshStandardMaterial({ color: 0x1a2234, roughness: 0.5, metalness: 0.2 });
  const bldgMatModern = new THREE.MeshStandardMaterial({ color: 0x222c42, roughness: 0.3, metalness: 0.5 });
  const windowLitMatGold = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const windowLitMatWarm = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const windowLitMatBlue = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.6 }); // Terracotta tile Kerala roof

  const buildingsGroup = new THREE.Group();
  scene.add(buildingsGroup);

  // Modern Apartments & Towers
  const towerConfigs = [
    { x: -16, z: -15, w: 10, h: 28, d: 9, mat: bldgMatModern },
    { x: 18, z: -20, w: 12, h: 36, d: 11, mat: bldgMatDark },
    { x: 26, z: -5, w: 9, h: 24, d: 8, mat: bldgMatCharcoal },
    { x: -18, z: 25, w: 11, h: 22, d: 9, mat: bldgMatDark },
    { x: 20, z: 28, w: 10, h: 30, d: 10, mat: bldgMatModern },
    { x: -24, z: -35, w: 13, h: 42, d: 12, mat: bldgMatModern },
    { x: 8, z: -40, w: 14, h: 46, d: 12, mat: bldgMatDark },
    { x: 34, z: -30, w: 11, h: 34, d: 10, mat: bldgMatCharcoal }
  ];

  towerConfigs.forEach(t => {
    const geo = new THREE.BoxGeometry(t.w, t.h, t.d);
    const mesh = new THREE.Mesh(geo, t.mat);
    mesh.position.set(t.x, t.h / 2, t.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    buildingsGroup.add(mesh);

    // Glowing window grids on towers
    const rows = Math.floor(t.h / 2.5);
    const cols = Math.floor(t.w / 2.5);
    for (let r = 2; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // randomly light some windows
        if (Math.random() > 0.45) {
          const winMat = Math.random() > 0.3 ? windowLitMatGold : (Math.random() > 0.5 ? windowLitMatWarm : windowLitMatBlue);
          const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), winMat);
          winMesh.position.set(
            t.x - (t.w / 2) + 1.2 + c * 2.2,
            r * 2.5,
            t.z + (t.d / 2) + 0.05
          );
          buildingsGroup.add(winMesh);
        }
      }
    }

    // Modern glass terrace accent on top
    const topAccent = new THREE.Mesh(
      new THREE.BoxGeometry(t.w * 0.8, 1.2, t.d * 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.8 })
    );
    topAccent.position.set(t.x, t.h + 0.6, t.z);
    buildingsGroup.add(topAccent);
  });

  // Kerala Style Pitched Roof Houses (Traditional & contemporary Kerala homes)
  const houseConfigs = [
    { x: -14, z: 8, w: 6, h: 4.5, d: 6 },
    { x: 12, z: 8, w: 7, h: 5, d: 6.5 },
    { x: 14, z: 18, w: 6.5, h: 4.8, d: 6 },
    { x: -14, z: 18, w: 7, h: 5, d: 7 }
  ];

  houseConfigs.forEach(h => {
    // Base walls
    const base = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), bldgMatCharcoal);
    base.position.set(h.x, h.h / 2, h.z);
    buildingsGroup.add(base);

    // Pitched pyramid roof
    const roofGeo = new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.75, 3.2, 4);
    const roof = new THREE.Mesh(roofGeo, roofTileMat);
    roof.position.set(h.x, h.h + 1.6, h.z);
    roof.rotation.y = Math.PI / 4;
    buildingsGroup.add(roof);

    // Warm entrance light
    const porchLight = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), windowLitMatGold);
    porchLight.position.set(h.x, 2, h.z + h.d / 2 + 0.2);
    buildingsGroup.add(porchLight);
  });

  // Trees and Greenery (Tropical Palm Trees + Canopy)
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.9 });
  const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });

  function createPalmTree(x, z) {
    const group = new THREE.Group();
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 6, 6), palmTrunkMat);
    trunk.position.y = 3;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    group.add(trunk);

    // Crown of fronds
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 4), palmFrondMat);
      frond.position.set(Math.cos(angle) * 1.2, 5.8, Math.sin(angle) * 1.2);
      frond.rotation.x = Math.PI / 2.6;
      frond.rotation.y = angle;
      group.add(frond);
    }
    group.position.set(x, 0, z);
    return group;
  }

  // Plant trees along roads and parks
  const treePositions = [
    [-6, 4], [-6, 12], [-6, 20], [-6, -8], [-6, -20],
    [6, 4], [6, 12], [6, 20], [6, -8], [6, -18],
    [-20, 2], [-22, 10], [-25, 18], [-28, 25],
    [24, 6], [26, 14], [28, 22]
  ];

  treePositions.forEach(([tx, tz]) => {
    scene.add(createPalmTree(tx, tz));
  });

  // Animated Car Light Trails
  const carLightGeo = new THREE.BoxGeometry(0.35, 0.2, 1.8);
  const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
  const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const cars = [];
  for (let i = 0; i < 10; i++) {
    const isHeadingNorth = i % 2 === 0;
    const mesh = new THREE.Mesh(carLightGeo, isHeadingNorth ? headLightMat : tailLightMat);
    const carX = isHeadingNorth ? -2.2 : 2.2;
    const speed = 0.25 + Math.random() * 0.2;
    mesh.position.set(carX, 0.3, (Math.random() - 0.5) * 100);
    scene.add(mesh);
    cars.push({ mesh, speed, isHeadingNorth });
  }

  // Floating Golden Particles (Atmospheric Kerala dust & fireflies)
  const particleCount = 180;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePos[i] = (Math.random() - 0.5) * 90;
    particlePos[i + 1] = 1 + Math.random() * 35;
    particlePos[i + 2] = (Math.random() - 0.5) * 90;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xf59e0b,
    size: 0.45,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });
  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // Parallax & Camera Controls
  let mouseX = 0;
  let mouseY = 0;
  let targetCamX = 0;
  let targetCamY = 18;
  const startTime = performance.now();
  let isVisible = true;

  function onMouseMove(e) {
    const normX = (e.clientX / window.innerWidth) * 2 - 1;
    const normY = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseX = normX * 8;
    mouseY = normY * 4;
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });

  // Handle Resize
  function onResize() {
    if (!containerElement) return;
    const newW = containerElement.clientWidth || window.innerWidth;
    const newH = containerElement.clientHeight || window.innerHeight;
    camera.aspect = newW / newH;
    camera.updateProjectionMatrix();
    renderer.setSize(newW, newH);
  }
  window.addEventListener('resize', onResize);

  // Intersection observer to pause rendering when hero is scrolled out of view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
    });
  }, { threshold: 0.05 });
  observer.observe(containerElement);

  // Animation Loop
  let reqId;
  function animate() {
    reqId = requestAnimationFrame(animate);
    if (!isVisible) return;

    const elapsedTime = (performance.now() - startTime) * 0.001;

    // Slow cinematic drift + mouse lerp
    targetCamX = Math.sin(elapsedTime * 0.15) * 6 + mouseX;
    targetCamY = 18 + Math.cos(elapsedTime * 0.1) * 2 + mouseY;

    camera.position.x += (targetCamX - camera.position.x) * 0.03;
    camera.position.y += (targetCamY - camera.position.y) * 0.03;
    camera.lookAt(0, 5, 0);

    // Animate cars
    cars.forEach(car => {
      if (car.isHeadingNorth) {
        car.mesh.position.z -= car.speed;
        if (car.mesh.position.z < -60) car.mesh.position.z = 60;
      } else {
        car.mesh.position.z += car.speed;
        if (car.mesh.position.z > 60) car.mesh.position.z = -60;
      }
    });

    // Animate floating particles
    const positions = particleSystem.geometry.attributes.position.array;
    for (let i = 1; i < particleCount * 3; i += 3) {
      positions[i] += Math.sin(elapsedTime + i) * 0.015;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;

    // Subtle water pulse
    waterMat.opacity = 0.8 + Math.sin(elapsedTime * 1.5) * 0.08;

    renderer.render(scene, camera);
  }

  animate();

  return {
    destroy: () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
      renderer.dispose();
      if (containerElement && renderer.domElement) {
        containerElement.removeChild(renderer.domElement);
      }
    }
  };
}
