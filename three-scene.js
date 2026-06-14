/**
 * js/three-scene.js - Three.js 3D Habitat Viewer for PureFlow
 * Creates interactive 3D visualization of space habitat modules
 * Three.js r128 loaded via CDN (global THREE available)
 */

// ========== GLOBALS ==========
let scene, camera, renderer;
let habitatGroup;
let starField;
let stormLight = null;
let stormParticles = null;
let stormActive = false;
let isUserInteracting = false;
let cameraAzimuth = 0;
let cameraElevation = 0.5;
let cameraDistance = 12;
let mouseX = 0;
let mouseY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let wireframeGroup = null;
let shieldRings = [];
let connectorTubes = [];
let hubModule = null;
let rotatingMachinery = null;

// Module positions relative to hub
const modulePositions = {
    crew_quarters: [
        { pos: { x: 2.5, y: 1.2, z: 2.5 }, angle: 45 },
        { pos: { x: -1.8, y: 1.2, z: 3.2 }, angle: 120 },
        { pos: { x: 2.8, y: 1.2, z: -2.0 }, angle: -30 },
        { pos: { x: -2.5, y: 1.2, z: -2.8 }, angle: -120 }
    ],
    eclss_bay: { x: -4.5, y: 0, z: 0 },
    greenhouse: { x: 4.5, y: 0, z: 0 },
    storm_shelter: { x: 0, y: 3.8, z: 0 },
    science_lab: { x: 0, y: 0, z: -5.5 },
    airlock: { x: 3.5, y: -0.8, z: 3.5 }
};

// ========== INITIALIZATION ==========

/**
 * Initialize Three.js scene, camera, renderer
 */
function initThreeScene() {
    const container = document.getElementById('three-canvas-container');
    if (!container) {
        console.error('Three.js container not found');
        return;
    }
    
    // Get container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x020814, 1);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = null; // Transparent, CSS background shows through
    scene.fog = new THREE.FogExp2(0x020814, 0.003);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    updateCameraPosition();
    
    // Setup lighting
    setupLighting();
    
    // Create starfield
    createStarfield();
    
    // Create habitat group
    habitatGroup = new THREE.Group();
    scene.add(habitatGroup);
    
    // Create ground grid (reference)
    const gridHelper = new THREE.GridHelper(30, 20, 0x00C2FF, 0x2A4070);
    gridHelper.position.y = -2;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.2;
    scene.add(gridHelper);
    
    // Add subtle axis helper for debugging (optional, hidden by default)
    // const axesHelper = new THREE.AxesHelper(5);
    // axesHelper.material.transparent = true;
    // axesHelper.material.opacity = 0.1;
    // scene.add(axesHelper);
    
    // Create initial hub
    createHubModule();
    
    // Setup event listeners
    setupEventListeners(container);
    
    // Start animation loop
    animate();
    
    console.log('Three.js scene initialized');
}

/**
 * Setup lighting for the scene
 */
function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x0a1428, 0.4);
    scene.add(ambientLight);
    
    // Directional light (cyan tint from above)
    const directionalLight = new THREE.DirectionalLight(0x00C2FF, 1.2);
    directionalLight.position.set(5, 8, 5);
    directionalLight.castShadow = true;
    directionalLight.receiveShadow = false;
    scene.add(directionalLight);
    
    // Point light (gold/warm from side - sun simulation)
    const sunLight = new THREE.PointLight(0xFFB020, 0.8);
    sunLight.position.set(-8, 4, -4);
    scene.add(sunLight);
    
    // Hemisphere light for subtle fill
    const hemiLight = new THREE.HemisphereLight(0x050F24, 0x020814, 0.3);
    scene.add(hemiLight);
    
    // Fill light from below
    const fillLight = new THREE.PointLight(0x0D2655, 0.4);
    fillLight.position.set(0, -3, 0);
    scene.add(fillLight);
}

/**
 * Create starfield background particles
 */
function createStarfield() {
    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const vertices = [];
    
    for (let i = 0; i < count; i++) {
        // Random points in a sphere radius 80
        const radius = 60 + Math.random() * 30;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);
        
        vertices.push(x, y, z);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.12,
        transparent: true,
        opacity: 0.7
    });
    
    starField = new THREE.Points(geometry, material);
    scene.add(starField);
}

/**
 * Create central hub module
 */
function createHubModule() {
    if (hubModule) {
        habitatGroup.remove(hubModule);
    }
    
    const group = new THREE.Group();
    
    // Main cylinder
    const geometry = new THREE.CylinderGeometry(1.8, 1.8, 3.5, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0x0A2048,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x001133,
        emissiveIntensity: 0.1
    });
    const cylinder = new THREE.Mesh(geometry, material);
    cylinder.castShadow = true;
    cylinder.receiveShadow = false;
    group.add(cylinder);
    
    // Wireframe overlay
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00C2FF });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Top dome
    const domeGeo = new THREE.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
        color: 0x0D2655,
        metalness: 0.5,
        roughness: 0.2,
        transparent: true,
        opacity: 0.7
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 1.8;
    group.add(dome);
    
    // Hub ring
    const ringGeo = new THREE.TorusGeometry(1.9, 0.08, 32, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x38E8FF, emissive: 0x00C2FF, emissiveIntensity: 0.3 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);
    
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -1.2;
    group.add(ring2);
    
    group.position.set(0, 0, 0);
    hubModule = group;
    habitatGroup.add(hubModule);
}

/**
 * Create crew quarters modules (spherical)
 * @param {number} count - Number of crew quarters to create
 */
function createCrewQuarters(count) {
    const positions = modulePositions.crew_quarters.slice(0, count);
    const group = new THREE.Group();
    
    positions.forEach((pos, idx) => {
        const geometry = new THREE.SphereGeometry(1.2, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x071838,
            metalness: 0.6,
            roughness: 0.4,
            emissive: 0x002244,
            emissiveIntensity: 0.05
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(pos.pos.x, pos.pos.y, pos.pos.z);
        sphere.castShadow = true;
        
        // Add wireframe
        const edges = new THREE.EdgesGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00C2FF });
        const wireframe = new THREE.LineSegments(edges, wireframeMat);
        sphere.add(wireframe);
        
        // Add window glow
        const windowGlow = new THREE.PointLight(0x38E8FF, 0.3, 3);
        windowGlow.position.set(0.8, 0.5, 0.8);
        sphere.add(windowGlow);
        
        group.add(sphere);
        
        // Create connector tube
        createConnectorTube({ x: 0, y: 0, z: 0 }, pos.pos, group);
    });
    
    return group;
}

/**
 * Create ECLSS bay module with rotating machinery
 */
function createECLSSModule() {
    const group = new THREE.Group();
    const position = modulePositions.eclss_bay;
    
    // Main box
    const geometry = new THREE.BoxGeometry(2.2, 1.8, 2.2);
    const material = new THREE.MeshStandardMaterial({
        color: 0x0D2655,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x004466,
        emissiveIntensity: 0.08
    });
    const box = new THREE.Mesh(geometry, material);
    box.castShadow = true;
    group.add(box);
    
    // Bright cyan wireframe
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x38E8FF });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Rotating machinery (inner cylinder)
    const machineryGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.2, 16);
    const machineryMat = new THREE.MeshStandardMaterial({
        color: 0x00C2FF,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x0088AA,
        emissiveIntensity: 0.3
    });
    const machinery = new THREE.Mesh(machineryGeo, machineryMat);
    machinery.position.y = 0;
    group.add(machinery);
    rotatingMachinery = machinery;
    
    // Add vents
    const ventGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x5A7BA8 });
    const vents = [-0.8, 0.8];
    vents.forEach(x => {
        const vent = new THREE.Mesh(ventGeo, ventMat);
        vent.position.set(x, 0.6, 1.1);
        group.add(vent);
    });
    
    group.position.set(position.x, position.y, position.z);
    return group;
}

/**
 * Create greenhouse module with glass material and plants
 */
function createGreenhouse() {
    const group = new THREE.Group();
    const position = modulePositions.greenhouse;
    
    // Glass cylinder
    const geometry = new THREE.CylinderGeometry(1.5, 1.5, 2.2, 24);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00E5A0,
        metalness: 0.1,
        roughness: 0.2,
        transparent: true,
        opacity: 0.35,
        emissive: 0x00AA66,
        emissiveIntensity: 0.05
    });
    const glass = new THREE.Mesh(geometry, material);
    glass.castShadow = true;
    group.add(glass);
    
    // Wireframe
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x00E5A0 });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Plants (small green spheres)
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x38E8AA, emissive: 0x00AA66, emissiveIntensity: 0.2 });
    const plantPositions = [
        { x: 0.5, y: -0.5, z: 0.5 }, { x: -0.5, y: -0.5, z: 0.5 },
        { x: 0.5, y: -0.5, z: -0.5 }, { x: -0.5, y: -0.5, z: -0.5 },
        { x: 0, y: -0.2, z: 0.8 }, { x: 0.7, y: -0.3, z: 0 }
    ];
    
    plantPositions.forEach(pos => {
        const plant = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), plantMat);
        plant.position.set(pos.x, pos.y, pos.z);
        group.add(plant);
    });
    
    // Top glow
    const topLight = new THREE.PointLight(0x00E5A0, 0.4, 4);
    topLight.position.set(0, 1.2, 0);
    group.add(topLight);
    
    group.position.set(position.x, position.y, position.z);
    return group;
}

/**
 * Create storm shelter with animated shield rings
 */
function createStormShelter() {
    const group = new THREE.Group();
    const position = modulePositions.storm_shelter;
    
    // Dome sphere
    const geometry = new THREE.SphereGeometry(1.8, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0x1A3A6B,
        metalness: 0.7,
        roughness: 0.4,
        emissive: 0x002244,
        emissiveIntensity: 0.1
    });
    const dome = new THREE.Mesh(geometry, material);
    dome.castShadow = true;
    group.add(dome);
    
    // Gold wireframe
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0xFFB020 });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Shield rings (animated)
    const ringGeo = new THREE.TorusGeometry(2.0, 0.08, 32, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xFFB020, emissive: 0xFF6020, emissiveIntensity: 0.4 });
    
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -0.5;
    group.add(ring1);
    
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.z = Math.PI / 3;
    ring2.rotation.x = Math.PI / 4;
    ring2.position.y = 0;
    group.add(ring2);
    
    const ring3 = new THREE.Mesh(ringGeo, ringMat);
    ring3.rotation.z = -Math.PI / 3;
    ring3.rotation.x = -Math.PI / 4;
    ring3.position.y = 0.5;
    group.add(ring3);
    
    shieldRings = [ring1, ring2, ring3];
    
    group.position.set(position.x, position.y, position.z);
    return group;
}

/**
 * Create science lab with antenna
 */
function createScienceLab() {
    const group = new THREE.Group();
    const position = modulePositions.science_lab;
    
    // Main box
    const geometry = new THREE.BoxGeometry(2.5, 1.8, 2.5);
    const material = new THREE.MeshStandardMaterial({
        color: 0x0A2048,
        metalness: 0.75,
        roughness: 0.25,
        emissive: 0x331166,
        emissiveIntensity: 0.05
    });
    const box = new THREE.Mesh(geometry, material);
    box.castShadow = true;
    group.add(box);
    
    // Violet wireframe
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x9B59FF });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Antenna
    const antennaBase = new THREE.CylinderGeometry(0.15, 0.25, 0.4, 8);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x38E8FF });
    const base = new THREE.Mesh(antennaBase, antennaMat);
    base.position.set(0, 1.1, 0);
    group.add(base);
    
    const antennaRod = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    const rod = new THREE.Mesh(antennaRod, antennaMat);
    rod.position.set(0, 1.7, 0);
    group.add(rod);
    
    const antennaBall = new THREE.SphereGeometry(0.12, 8, 8);
    const ball = new THREE.Mesh(antennaBall, antennaMat);
    ball.position.set(0, 2.3, 0);
    group.add(ball);
    
    group.position.set(position.x, position.y, position.z);
    return group;
}

/**
 * Create airlock module
 */
function createAirlock() {
    const group = new THREE.Group();
    const position = modulePositions.airlock;
    
    const geometry = new THREE.BoxGeometry(1.6, 1.4, 1.6);
    const material = new THREE.MeshStandardMaterial({
        color: 0x071838,
        metalness: 0.6,
        roughness: 0.5
    });
    const box = new THREE.Mesh(geometry, material);
    box.castShadow = true;
    group.add(box);
    
    const edges = new THREE.EdgesGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ color: 0x5A7BA8 });
    const wireframe = new THREE.LineSegments(edges, wireframeMat);
    group.add(wireframe);
    
    // Door indicator
    const doorLight = new THREE.PointLight(0x38E8FF, 0.5, 2);
    doorLight.position.set(0, 0, 0.9);
    group.add(doorLight);
    
    group.position.set(position.x, position.y, position.z);
    return group;
}

/**
 * Create connector tube between two points
 */
function createConnectorTube(from, to, parentGroup) {
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    const geometry = new THREE.CylinderGeometry(0.25, 0.25, length, 8);
    const material = new THREE.MeshStandardMaterial({
        color: 0x2A4070,
        metalness: 0.5,
        roughness: 0.6
    });
    const tube = new THREE.Mesh(geometry, material);
    
    const center = start.clone().add(end).multiplyScalar(0.5);
    tube.position.copy(center);
    tube.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
    );
    
    parentGroup.add(tube);
    connectorTubes.push(tube);
}

/**
 * Render all habitat modules based on current selection
 * @param {Array} modules - Array of module IDs
 */
function renderHabitatModules(modules) {
    // Clear existing modules (keep hub)
    while (habitatGroup.children.length > 0) {
        const child = habitatGroup.children[0];
        if (child === hubModule) {
            break;
        }
        habitatGroup.remove(child);
    }
    
    connectorTubes = [];
    shieldRings = [];
    rotatingMachinery = null;
    
    // Count crew quarters
    let crewCount = 0;
    
    // Add modules
    modules.forEach(moduleId => {
        let moduleGroup = null;
        
        switch (moduleId) {
            case 'crew_quarters':
                crewCount++;
                break;
            case 'eclss_bay':
                moduleGroup = createECLSSModule();
                break;
            case 'greenhouse':
                moduleGroup = createGreenhouse();
                break;
            case 'storm_shelter':
                moduleGroup = createStormShelter();
                break;
            case 'science_lab':
                moduleGroup = createScienceLab();
                break;
            case 'airlock':
                moduleGroup = createAirlock();
                break;
        }
        
        if (moduleGroup) {
            habitatGroup.add(moduleGroup);
        }
    });
    
    // Add crew quarters after counting
    if (crewCount > 0) {
        const crewGroup = createCrewQuarters(Math.min(crewCount, 4));
        habitatGroup.add(crewGroup);
    }
}

/**
 * Apply storm effect to the scene
 * @param {boolean} active - Whether storm is active
 */
function applyStormEffect(active) {
    stormActive = active;
    
    if (active) {
        // Remove existing storm light if any
        if (stormLight) scene.remove(stormLight);
        
        // Add pulsing red storm light
        stormLight = new THREE.PointLight(0xFF2D55, 1.5, 35);
        stormLight.position.set(0, 2, 0);
        scene.add(stormLight);
        
        // Create particle burst
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        
        for (let i = 0; i < particleCount; i++) {
            const radius = 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            positions.push(x, y, z);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        const material = new THREE.PointsMaterial({
            color: 0xFF2D55,
            size: 0.08,
            transparent: true,
            opacity: 0.8
        });
        
        if (stormParticles) scene.remove(stormParticles);
        stormParticles = new THREE.Points(geometry, material);
        scene.add(stormParticles);
        
        // Change hub wireframe to red
        if (hubModule) {
            hubModule.children.forEach(child => {
                if (child.isLineSegments) {
                    child.material.color.setHex(0xFF2D55);
                }
            });
        }
        
    } else {
        // Remove storm effects
        if (stormLight) scene.remove(stormLight);
        if (stormParticles) scene.remove(stormParticles);
        stormLight = null;
        stormParticles = null;
        
        // Restore hub wireframe color
        if (hubModule) {
            hubModule.children.forEach(child => {
                if (child.isLineSegments) {
                    child.material.color.setHex(0x00C2FF);
                }
            });
        }
    }
}

// ========== CAMERA CONTROLS ==========

/**
 * Update camera position based on azimuth, elevation, and distance
 */
function updateCameraPosition() {
    const x = Math.sin(cameraAzimuth) * Math.cos(cameraElevation) * cameraDistance;
    const y = Math.sin(cameraElevation) * cameraDistance;
    const z = Math.cos(cameraAzimuth) * Math.cos(cameraElevation) * cameraDistance;
    
    camera.position.set(x, y + 2, z);
    camera.lookAt(0, 0, 0);
}

/**
 * Setup mouse and touch event listeners for manual orbit controls
 */
function setupEventListeners(container) {
    // Mouse down
    container.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isUserInteracting = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            container.style.cursor = 'grabbing';
        }
    });
    
    // Mouse move
    window.addEventListener('mousemove', (e) => {
        if (isUserInteracting) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            cameraAzimuth += deltaX * 0.008;
            cameraElevation += deltaY * 0.008;
            
            // Clamp elevation to prevent flipping
            cameraElevation = Math.max(0.2, Math.min(1.2, cameraElevation));
            
            updateCameraPosition();
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });
    
    // Mouse up
    window.addEventListener('mouseup', () => {
        isUserInteracting = false;
        container.style.cursor = 'grab';
    });
    
    // Wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraDistance -= e.deltaY * 0.01;
        cameraDistance = Math.max(5, Math.min(25, cameraDistance));
        updateCameraPosition();
    });
    
    // Touch events for mobile
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isUserInteracting = true;
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
        }
    });
    
    window.addEventListener('touchmove', (e) => {
        if (isUserInteracting && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - lastMouseX;
            const deltaY = e.touches[0].clientY - lastMouseY;
            
            cameraAzimuth += deltaX * 0.008;
            cameraElevation += deltaY * 0.008;
            cameraElevation = Math.max(0.2, Math.min(1.2, cameraElevation));
            
            updateCameraPosition();
            
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
        }
    });
    
    window.addEventListener('touchend', () => {
        isUserInteracting = false;
    });
    
    container.style.cursor = 'grab';
}

// ========== RESIZE HANDLER ==========
window.addEventListener('resize', () => {
    const container = document.getElementById('three-canvas-container');
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;
    
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

// ========== ANIMATION LOOP ==========
function animate() {
    requestAnimationFrame(animate);
    
    // Auto-rotate when not interacting (gentle)
    if (!isUserInteracting) {
        cameraAzimuth += 0.002;
        updateCameraPosition();
    }
    
    // Rotate starfield slowly
    if (starField) {
        starField.rotation.y += 0.0002;
        starField.rotation.x += 0.0001;
    }
    
    // Animate rotating machinery in ECLSS
    if (rotatingMachinery) {
        rotatingMachinery.rotation.y += 0.02;
        rotatingMachinery.rotation.x = Math.sin(Date.now() * 0.003) * 0.2;
    }
    
    // Animate shield rings
    if (shieldRings.length > 0) {
        shieldRings.forEach((ring, idx) => {
            ring.rotation.z += 0.01;
            ring.rotation.x += 0.005;
            // Pulse intensity
            if (ring.material) {
                const intensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
                ring.material.emissiveIntensity = intensity;
            }
        });
    }
    
    // Storm light pulsing
    if (stormActive && stormLight) {
        const intensity = 1.5 + Math.sin(Date.now() * 0.008) * 1.2;
        stormLight.intensity = intensity;
        
        // Animate storm particles
        if (stormParticles) {
            stormParticles.rotation.y += 0.02;
            stormParticles.rotation.x += 0.01;
        }
    }
    
    renderer.render(scene, camera);
}

// ========== EXPORTS ==========
window.threeScene = {
    renderHabitatModules,
    applyStormEffect
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThreeScene);
} else {
    initThreeScene();
}