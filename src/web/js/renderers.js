/**
 * renderers.js - 3D Rendering Modes for Cellular Automata
 *
 * Contains:
 * - RenderMode enum
 * - CubeRenderer - Instanced mesh rendering (default)
 * - ParticleRenderer - Particle cloud rendering
 * - MarchingCubesRenderer - Smooth surface rendering
 */

import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

export const RenderMode = {
  CUBES: 'cubes',
  PARTICLES: 'particles',
  MARCHING_CUBES: 'marchingCubes'
};

// ============================================================
// CUBE RENDERER (Instanced Mesh)
// ============================================================

export class CubeRenderer {
  constructor(scene, maxInstances) {
    this.scene = scene;
    this.maxInstances = maxInstances;

    this.aliveMesh = null;
    this.interiorMesh = null;
    this.decayMesh = null;
    this.gridHelper = null;

    this.cellScale = 0.85;
    this.cubeGeometry = null;
    this.aliveMaterial = null;
    this.interiorMaterial = null;
    this.decayMaterial = null;

    this.createMaterials();
    this.createGeometry(this.cellScale);
    this.createMeshes();
  }

  createMaterials() {
    // Surface alive - uses vertex colors for face shading
    this.aliveMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ddaa,
      vertexColors: true
    });

    // Interior alive - very dark cyan
    this.interiorMaterial = new THREE.MeshLambertMaterial({
      color: 0x002222,
      emissive: 0x001111,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.3
    });

    // Decay material - muted warm gradient
    this.decayMaterial = new THREE.MeshLambertMaterial({
      color: 0x664422,
      emissive: 0x331100,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.3
    });
  }

  createGeometry(cellScale) {
    if (this.cubeGeometry) {
      this.cubeGeometry.dispose();
    }

    this.cellScale = cellScale;
    this.cubeGeometry = new THREE.BoxGeometry(cellScale, cellScale, cellScale);

    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z (6 faces, 4 verts each = 24 verts)
    const faceShades = [
      0.8, 0.8, 0.8, 0.8,  // +X right - medium
      0.6, 0.6, 0.6, 0.6,  // -X left - darker
      1.0, 1.0, 1.0, 1.0,  // +Y top - brightest
      0.5, 0.5, 0.5, 0.5,  // -Y bottom - darkest
      0.9, 0.9, 0.9, 0.9,  // +Z front - medium-bright
      0.7, 0.7, 0.7, 0.7,  // -Z back - medium-dark
    ];

    const colors = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) {
      colors[i * 3] = faceShades[i];
      colors[i * 3 + 1] = faceShades[i];
      colors[i * 3 + 2] = faceShades[i];
    }
    this.cubeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Update meshes if they exist
    if (this.aliveMesh) {
      this.aliveMesh.geometry = this.cubeGeometry;
    }
    if (this.interiorMesh) {
      this.interiorMesh.geometry = this.cubeGeometry;
    }
    if (this.decayMesh) {
      this.decayMesh.geometry = this.cubeGeometry;
    }
  }

  createMeshes() {
    this.aliveMesh = new THREE.InstancedMesh(this.cubeGeometry, this.aliveMaterial, this.maxInstances);
    this.aliveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.aliveMesh);

    this.interiorMesh = new THREE.InstancedMesh(this.cubeGeometry, this.interiorMaterial, this.maxInstances);
    this.interiorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.interiorMesh);

    this.decayMesh = new THREE.InstancedMesh(this.cubeGeometry, this.decayMaterial, this.maxInstances);
    this.decayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.decayMesh);
  }

  setupGridHelper(gridSize) {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
    }

    const boxGeom = new THREE.BoxGeometry(gridSize, gridSize, gridSize);
    const edgesGeom = new THREE.EdgesGeometry(boxGeom);
    this.gridHelper = new THREE.LineSegments(
      edgesGeom,
      new THREE.LineBasicMaterial({ color: 0x3a3a5a, linewidth: 1 })
    );
    this.scene.add(this.gridHelper);
    boxGeom.dispose();
  }

  isSurfaceCell(idx, data, size) {
    const state = data[idx];
    if (state === 0) return false;
    const size2 = size * size;
    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = (idx / size2) | 0;

    const neighbors = [
      [x-1, y, z], [x+1, y, z],
      [x, y-1, z], [x, y+1, z],
      [x, y, z-1], [x, y, z+1]
    ];

    for (const [nx, ny, nz] of neighbors) {
      const wx = ((nx % size) + size) % size;
      const wy = ((ny % size) + size) % size;
      const wz = ((nz % size) + size) % size;
      const neighborState = data[wx * size2 + wy * size + wz];
      if (neighborState < state) return true;
    }
    return false;
  }

  getDecayColor(state, maxState) {
    const t = (state - 1) / Math.max(maxState - 1, 1);
    return new THREE.Color().setRGB(1.0, t * 0.8, 0);
  }

  update(gridData, size, maxState, displayMode, worldCenter) {
    if (!this.aliveMesh || !this.interiorMesh || !this.decayMesh) return;

    const matrix = new THREE.Matrix4();
    const halfSize = size / 2;
    const size2 = size * size;
    const data = gridData;
    const total = data.length;
    const ox = worldCenter.x - halfSize + 0.5;
    const oy = worldCenter.y - halfSize + 0.5;
    const oz = worldCenter.z - halfSize + 0.5;
    const maxInstances = this.maxInstances;
    let aliveIndex = 0;
    let interiorIndex = 0;
    let decayIndex = 0;

    for (let idx = 0; idx < total; idx++) {
      const state = data[idx];
      if (state === 0) continue;

      const isSurface = this.isSurfaceCell(idx, data, size);
      if (displayMode === 'shell' && !isSurface) {
        continue;
      }

      const z = idx % size;
      const y = ((idx / size) | 0) % size;
      const x = (idx / size2) | 0;
      matrix.setPosition(x + ox, y + oy, z + oz);

      if (state === maxState) {
        if (isSurface) {
          if (aliveIndex < maxInstances) {
            this.aliveMesh.setMatrixAt(aliveIndex++, matrix);
          }
        } else {
          if (interiorIndex < maxInstances) {
            this.interiorMesh.setMatrixAt(interiorIndex++, matrix);
          }
        }
      } else {
        if (decayIndex < maxInstances) {
          this.decayMesh.setMatrixAt(decayIndex, matrix);
          this.decayMesh.setColorAt(decayIndex, this.getDecayColor(state, maxState));
          decayIndex++;
        }
      }
    }

    this.aliveMesh.count = aliveIndex;
    this.aliveMesh.instanceMatrix.needsUpdate = true;

    this.interiorMesh.count = interiorIndex;
    this.interiorMesh.instanceMatrix.needsUpdate = true;

    this.decayMesh.count = decayIndex;
    this.decayMesh.instanceMatrix.needsUpdate = true;
    if (this.decayMesh.instanceColor) {
      this.decayMesh.instanceColor.needsUpdate = true;
    }

    if (this.gridHelper) {
      this.gridHelper.position.set(worldCenter.x, worldCenter.y, worldCenter.z);
    }
  }

  setVisible(visible) {
    if (this.aliveMesh) this.aliveMesh.visible = visible;
    if (this.interiorMesh) this.interiorMesh.visible = visible;
    if (this.decayMesh) this.decayMesh.visible = visible;
    if (this.gridHelper) this.gridHelper.visible = visible;
  }

  dispose() {
    if (this.aliveMesh) {
      this.scene.remove(this.aliveMesh);
      this.aliveMesh.dispose();
      this.aliveMesh = null;
    }
    if (this.interiorMesh) {
      this.scene.remove(this.interiorMesh);
      this.interiorMesh.dispose();
      this.interiorMesh = null;
    }
    if (this.decayMesh) {
      this.scene.remove(this.decayMesh);
      this.decayMesh.dispose();
      this.decayMesh = null;
    }
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
      this.gridHelper = null;
    }
    if (this.cubeGeometry) {
      this.cubeGeometry.dispose();
      this.cubeGeometry = null;
    }
    if (this.aliveMaterial) {
      this.aliveMaterial.dispose();
      this.aliveMaterial = null;
    }
    if (this.interiorMaterial) {
      this.interiorMaterial.dispose();
      this.interiorMaterial = null;
    }
    if (this.decayMaterial) {
      this.decayMaterial.dispose();
      this.decayMaterial = null;
    }
  }
}

// ============================================================
// PARTICLE RENDERER
// ============================================================

export class ParticleRenderer {
  constructor(scene, maxParticles) {
    this.scene = scene;
    this.maxParticles = maxParticles;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.sizes = new Float32Array(maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: 4.0 },
        opacity: { value: 0.35 }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3 vColor;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          float alpha = smoothstep(0.5, 0.3, r) * opacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  isSurfaceCell(idx, data, size, state) {
    if (state === 0) return false;
    const size2 = size * size;
    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = (idx / size2) | 0;

    // Check 6 direct neighbors
    const neighbors = [
      [x-1, y, z], [x+1, y, z],
      [x, y-1, z], [x, y+1, z],
      [x, y, z-1], [x, y, z+1]
    ];

    for (const [nx, ny, nz] of neighbors) {
      const wx = ((nx % size) + size) % size;
      const wy = ((ny % size) + size) % size;
      const wz = ((nz % size) + size) % size;
      const neighborState = data[wx * size2 + wy * size + wz];
      if (neighborState < state) return true;
    }
    return false;
  }

  update(gridData, size, maxState, displayMode, worldCenter) {
    const halfSize = size / 2;
    const size2 = size * size;
    let idx = 0;

    for (let i = 0; i < gridData.length; i++) {
      const state = gridData[i];
      if (state === 0) continue;

      if (idx >= this.maxParticles) break;

      const z = i % size;
      const y = ((i / size) | 0) % size;
      const x = (i / size2) | 0;

      const isSurface = this.isSurfaceCell(i, gridData, size, state);

      // Skip interior cells in shell mode
      if (displayMode === 'shell' && !isSurface) continue;

      this.positions[idx * 3] = x - halfSize + worldCenter.x;
      this.positions[idx * 3 + 1] = y - halfSize + worldCenter.y;
      this.positions[idx * 3 + 2] = z - halfSize + worldCenter.z;

      // Color and size based on state AND surface detection
      if (state === maxState) {
        if (isSurface) {
          // Surface alive - bright cyan, large
          this.colors[idx * 3] = 0;
          this.colors[idx * 3 + 1] = 1.0;
          this.colors[idx * 3 + 2] = 0.8;
          this.sizes[idx] = 6.0;
        } else {
          // Interior alive - dim cyan, small
          this.colors[idx * 3] = 0;
          this.colors[idx * 3 + 1] = 0.3;
          this.colors[idx * 3 + 2] = 0.25;
          this.sizes[idx] = 2.0;
        }
      } else {
        // Decaying - yellow to red gradient
        const t = state / maxState;
        if (isSurface) {
          this.colors[idx * 3] = 1.0;
          this.colors[idx * 3 + 1] = t * 0.8;
          this.colors[idx * 3 + 2] = 0;
          this.sizes[idx] = 4.0 + t * 2.0;
        } else {
          this.colors[idx * 3] = 0.4;
          this.colors[idx * 3 + 1] = t * 0.3;
          this.colors[idx * 3 + 2] = 0;
          this.sizes[idx] = 1.5;
        }
      }
      idx++;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.setDrawRange(0, idx);
  }

  setVisible(visible) {
    if (this.points) this.points.visible = visible;
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.material.dispose();
      this.points = null;
    }
  }
}

// ============================================================
// MARCHING CUBES RENDERER
// ============================================================

export class MarchingCubesRenderer {
  constructor(scene, resolution = 32) {
    this.scene = scene;
    this.resolution = resolution;

    // Smooth shaded material for organic look
    this.material = new THREE.MeshStandardMaterial({
      color: 0x00ddaa,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // MarchingCubes(resolution, material, enableUvs, enableColors, maxPolyCount)
    this.effect = new MarchingCubes(resolution, this.material, false, false, 200000);
    this.effect.isolation = 80;
    this.effect.visible = true;
    this.scene.add(this.effect);

    this.gridSize = 50;
  }

  update(gridData, gridSize, maxState, worldCenter) {
    this.gridSize = gridSize;

    // Initialize and reset the marching cubes field
    this.effect.init(this.resolution);
    this.effect.isolation = 80;
    this.effect.reset();

    const size2 = gridSize * gridSize;

    // Count alive cells
    let aliveCount = 0;
    for (let i = 0; i < gridData.length; i++) {
      if (gridData[i] > 0) aliveCount++;
    }

    if (aliveCount === 0) return;

    // Scale factor: map grid coordinates to [0,1] range for MarchingCubes
    const invSize = 1.0 / gridSize;

    // Ball parameters - smaller strength so balls blend nicely
    // Each ball creates a small contribution, overlapping balls merge
    const baseStrength = 0.6 / Math.max(1, Math.cbrt(aliveCount / 100));
    const subtract = 12;

    // Add metaballs for each alive cell
    for (let i = 0; i < gridData.length; i++) {
      const state = gridData[i];
      if (state === 0) continue;

      const z = i % gridSize;
      const y = ((i / gridSize) | 0) % gridSize;
      const x = (i / size2) | 0;

      // Normalized coordinates [0, 1]
      const nx = (x + 0.5) * invSize;
      const ny = (y + 0.5) * invSize;
      const nz = (z + 0.5) * invSize;

      // Strength based on cell state
      const strength = baseStrength * (state / maxState);
      this.effect.addBall(nx, ny, nz, strength, subtract);
    }

    // CRITICAL: Must call update() to generate the mesh geometry
    this.effect.update();

    // Position and scale to match grid coordinates
    // MarchingCubes generates geometry in [0,1] space, scale to grid size
    const halfGrid = gridSize / 2;
    this.effect.position.set(
      worldCenter.x - halfGrid,
      worldCenter.y - halfGrid,
      worldCenter.z - halfGrid
    );
    this.effect.scale.set(gridSize, gridSize, gridSize);

    console.log('[MarchingCubes] Generated', this.effect.count, 'triangles for', aliveCount, 'cells');
  }

  setIsoLevel(level) {
    this.effect.isolation = level;
  }

  setColor(color) {
    this.material.color.set(color);
  }

  setVisible(visible) {
    if (this.effect) this.effect.visible = visible;
  }

  dispose() {
    if (this.effect) {
      this.scene.remove(this.effect);
      this.effect = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  }
}

// ============================================================
// RENDER MANAGER
// ============================================================

export class RenderManager {
  constructor(scene, maxInstances) {
    this.scene = scene;
    this.maxInstances = maxInstances;
    this.currentMode = RenderMode.CUBES;

    this.cubeRenderer = null;
    this.particleRenderer = null;
    this.marchingCubesRenderer = null;

    this.gridSize = 50;
    this.cellScale = 0.85;
  }

  init(gridSize) {
    this.gridSize = gridSize;
    const totalCells = gridSize * gridSize * gridSize;
    const maxInstances = Math.min(totalCells, this.maxInstances);

    // Create cube renderer by default
    this.cubeRenderer = new CubeRenderer(this.scene, maxInstances);
    this.cubeRenderer.setupGridHelper(gridSize);
  }

  setRenderMode(mode) {
    console.log('[RenderManager] setRenderMode:', mode);

    // Hide all renderers
    if (this.cubeRenderer) this.cubeRenderer.setVisible(false);
    if (this.particleRenderer) this.particleRenderer.setVisible(false);
    if (this.marchingCubesRenderer) this.marchingCubesRenderer.setVisible(false);

    this.currentMode = mode;

    // Create and show the selected renderer
    switch (mode) {
      case RenderMode.CUBES:
        if (!this.cubeRenderer) {
          const totalCells = this.gridSize * this.gridSize * this.gridSize;
          const maxInstances = Math.min(totalCells, this.maxInstances);
          this.cubeRenderer = new CubeRenderer(this.scene, maxInstances);
          this.cubeRenderer.setupGridHelper(this.gridSize);
        }
        this.cubeRenderer.setVisible(true);
        break;

      case RenderMode.PARTICLES:
        if (!this.particleRenderer) {
          const totalCells = this.gridSize * this.gridSize * this.gridSize;
          const maxParticles = Math.min(totalCells, this.maxInstances);
          this.particleRenderer = new ParticleRenderer(this.scene, maxParticles);
        }
        this.particleRenderer.setVisible(true);
        break;

      case RenderMode.MARCHING_CUBES:
        console.log('[RenderManager] Creating/showing MarchingCubes renderer');
        if (!this.marchingCubesRenderer) {
          const resolution = Math.min(64, this.gridSize);
          this.marchingCubesRenderer = new MarchingCubesRenderer(this.scene, resolution);
        }
        this.marchingCubesRenderer.setVisible(true);
        console.log('[RenderManager] MarchingCubes visible:', this.marchingCubesRenderer.effect?.visible);
        break;
    }
  }

  setCellScale(scale) {
    this.cellScale = scale;
    if (this.cubeRenderer) {
      this.cubeRenderer.createGeometry(scale);
    }
  }

  update(gridData, size, maxState, displayMode, worldCenter) {
    switch (this.currentMode) {
      case RenderMode.CUBES:
        if (this.cubeRenderer) {
          this.cubeRenderer.update(gridData, size, maxState, displayMode, worldCenter);
        }
        break;

      case RenderMode.PARTICLES:
        if (this.particleRenderer) {
          this.particleRenderer.update(gridData, size, maxState, displayMode, worldCenter);
        }
        break;

      case RenderMode.MARCHING_CUBES:
        if (this.marchingCubesRenderer) {
          this.marchingCubesRenderer.update(gridData, size, maxState, worldCenter);
        }
        break;
    }
  }

  resize(gridSize) {
    this.gridSize = gridSize;

    // Dispose and recreate renderers at new size
    this.dispose();
    this.init(gridSize);
    this.setRenderMode(this.currentMode);
  }

  getMeshCount() {
    // Return total visible cell count from active renderer
    switch (this.currentMode) {
      case RenderMode.CUBES:
        if (this.cubeRenderer) {
          return (this.cubeRenderer.aliveMesh?.count ?? 0) +
                 (this.cubeRenderer.interiorMesh?.count ?? 0) +
                 (this.cubeRenderer.decayMesh?.count ?? 0);
        }
        break;
      case RenderMode.PARTICLES:
        if (this.particleRenderer) {
          return this.particleRenderer.geometry?.drawRange?.count ?? 0;
        }
        break;
      case RenderMode.MARCHING_CUBES:
        // For marching cubes, return estimated cell count
        // (this is an approximation as MC uses metaballs)
        return 0;
    }
    return 0;
  }

  dispose() {
    if (this.cubeRenderer) {
      this.cubeRenderer.dispose();
      this.cubeRenderer = null;
    }
    if (this.particleRenderer) {
      this.particleRenderer.dispose();
      this.particleRenderer = null;
    }
    if (this.marchingCubesRenderer) {
      this.marchingCubesRenderer.dispose();
      this.marchingCubesRenderer = null;
    }
  }
}
