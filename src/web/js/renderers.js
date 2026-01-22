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
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export const RenderMode = {
  CUBES: 'cubes',
  PARTICLES: 'particles',
  MARCHING_CUBES: 'marchingCubes',
  VOLUMETRIC: 'volumetric'
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
    this.aliveEdges = null;
    this.brightEdges = null;
    this.gridHelper = null;

    this.cellScale = 1.0;
    this.cubeGeometry = null;
    this.outlineGeometry = null;
    this.aliveMaterial = null;
    this.interiorMaterial = null;
    this.decayMaterial = null;
    this.edgesMaterial = null;
    this.brightEdgeMaterial = null;
    this.showOutlines = true;
    this.showBrightEdges = true;

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

    // Edge outline material - dark outline using inverted hull technique
    this.edgesMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.85
    });

    // Bright edge material - thin lines with vertex colors, distance-scaled
    this.brightEdgeMaterial = new LineMaterial({
      color: 0xffffff,
      linewidth: 1,
      vertexColors: true,
      dashed: false,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });
  }

  setWireframe(enabled) {
    if (this.aliveMaterial) this.aliveMaterial.wireframe = enabled;
    if (this.interiorMaterial) this.interiorMaterial.wireframe = enabled;
    if (this.decayMaterial) this.decayMaterial.wireframe = enabled;
  }

  setOutlines(enabled) {
    this.showOutlines = enabled;
    if (this.aliveEdges) this.aliveEdges.visible = enabled;
  }

  createGeometry(cellScale) {
    if (this.cubeGeometry) {
      this.cubeGeometry.dispose();
    }
    if (this.outlineGeometry) {
      this.outlineGeometry.dispose();
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

    // Create outline geometry - slightly larger for inverted hull technique
    const outlineScale = cellScale * 1.06;
    this.outlineGeometry = new THREE.BoxGeometry(outlineScale, outlineScale, outlineScale);

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
    if (this.aliveEdges) {
      this.aliveEdges.geometry = this.outlineGeometry;
    }

    // Update corner offsets for bright edge highlights
    this.updateCornerOffsets();
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

    // Outline mesh - slightly larger dark cubes rendered on back side (inverted hull)
    this.aliveEdges = new THREE.InstancedMesh(this.outlineGeometry, this.edgesMaterial, this.maxInstances);
    this.aliveEdges.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.aliveEdges.visible = this.showOutlines;
    this.aliveEdges.renderOrder = -1; // Render outlines first, behind main cubes
    this.scene.add(this.aliveEdges);

    // Bright edge lines - 12 edges per cube
    this.createBrightEdges();
  }

  createBrightEdges() {
    // 12 edges per cube, 2 vertices per edge = 24 vertices per cube
    const maxVertices = this.maxInstances * 24;

    // Arrays for storing data
    this.edgePositions = new Float32Array(maxVertices * 3);
    this.edgeColors = new Float32Array(maxVertices * 3);
    this.edgeCornerOffsets = new Float32Array(maxVertices * 3);
    this.edgeVertexCount = 0;

    // Create geometry - will be updated each frame
    this.edgeGeometry = new LineSegmentsGeometry();
    this.brightEdges = new LineSegments2(this.edgeGeometry, this.brightEdgeMaterial);
    this.brightEdges.frustumCulled = false;
    this.brightEdges.visible = this.showBrightEdges;
    this.scene.add(this.brightEdges);

    // Pre-compute corner offsets (relative to cube center) - 8 corners indexed 0-7
    this.updateCornerOffsets();

    // Define the 12 edges as pairs of corner indices
    // Corner indices: 0=(-,-,-), 1=(-,-,+), 2=(-,+,-), 3=(-,+,+), 4=(+,-,-), 5=(+,-,+), 6=(+,+,-), 7=(+,+,+)
    this.edgeIndices = [
      // Bottom face edges (y = -)
      [0, 1], [1, 5], [5, 4], [4, 0],
      // Top face edges (y = +)
      [2, 3], [3, 7], [7, 6], [6, 2],
      // Vertical edges connecting bottom to top
      [0, 2], [1, 3], [4, 6], [5, 7]
    ];
  }

  // Compute edge colors based on camera position (fills this.edgeColors array)
  computeEdgeColors() {
    if (!this.camera || this.edgeVertexCount === 0) return;

    const camPos = this.camera.position;
    const vertexCount = this.edgeVertexCount;

    // Distance-based fade parameters (match cube lighting feel)
    const nearDist = 20;
    const farDist = 150;

    for (let i = 0; i < vertexCount; i++) {
      const vi = i * 3;

      const vx = this.edgePositions[vi];
      const vy = this.edgePositions[vi + 1];
      const vz = this.edgePositions[vi + 2];
      const cx = this.edgeCornerOffsets[vi];
      const cy = this.edgeCornerOffsets[vi + 1];
      const cz = this.edgeCornerOffsets[vi + 2];

      const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const vdx = camPos.x - vx, vdy = camPos.y - vy, vdz = camPos.z - vz;
      const vdLen = Math.sqrt(vdx * vdx + vdy * vdy + vdz * vdz);
      const dot = (cx * vdx + cy * vdy + cz * vdz) / (cLen * vdLen);

      // Facing edges are bright (1.0), away edges are dim (0.05)
      const t = Math.max(0, dot);
      const facingIntensity = 0.05 + t * 0.95;

      // Distance-based fade - edges fade out with distance like cube lighting
      const distT = Math.max(0, Math.min(1, (vdLen - nearDist) / (farDist - nearDist)));
      const distFade = 1.0 - distT * 0.85; // Fade to 15% at far distance

      const intensity = facingIntensity * distFade;

      this.edgeColors[vi] = intensity;
      this.edgeColors[vi + 1] = intensity;
      this.edgeColors[vi + 2] = intensity;
    }
  }

  // Update edge colors based on current camera position (call every frame)
  updateBrightEdgeColors() {
    if (!this.brightEdges || !this.camera || this.edgeVertexCount === 0) return;

    // Scale line width based on camera distance - thinner when zoomed out
    const camDist = this.camera.position.length();
    const baseWidth = 1.0;
    const minWidth = 0.2;
    const maxDist = 150;
    const minDist = 25;
    const t = Math.max(0, Math.min(1, (camDist - minDist) / (maxDist - minDist)));
    const lineWidth = baseWidth * (1 - t * 0.8); // Scale down to 20% at max distance
    this.brightEdgeMaterial.linewidth = Math.max(minWidth, lineWidth);

    // Compute new colors based on camera position
    this.computeEdgeColors();

    // Recreate geometry with updated colors (LineSegmentsGeometry doesn't support in-place color updates)
    if (this.edgeGeometry) {
      this.edgeGeometry.dispose();
    }

    this.edgeGeometry = new LineSegmentsGeometry();
    const positions = this.edgePositions.slice(0, this.edgeVertexCount * 3);
    const colors = this.edgeColors.slice(0, this.edgeVertexCount * 3);
    this.edgeGeometry.setPositions(positions);
    this.edgeGeometry.setColors(colors);
    this.brightEdges.geometry = this.edgeGeometry;
  }

  updateCornerOffsets() {
    const halfScale = this.cellScale * 0.5;
    this.cornerOffsets = [
      [-halfScale, -halfScale, -halfScale], // 0
      [-halfScale, -halfScale,  halfScale], // 1
      [-halfScale,  halfScale, -halfScale], // 2
      [-halfScale,  halfScale,  halfScale], // 3
      [ halfScale, -halfScale, -halfScale], // 4
      [ halfScale, -halfScale,  halfScale], // 5
      [ halfScale,  halfScale, -halfScale], // 6
      [ halfScale,  halfScale,  halfScale]  // 7
    ];
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

  setCamera(camera) {
    this.camera = camera;
  }

  update(gridData, size, maxState, displayMode, worldCenter) {
    if (!this.aliveMesh || !this.interiorMesh || !this.decayMesh) return;

    // Reset edge vertex count at start of update
    this.edgeVertexCount = 0;

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
    let vertexIndex = 0;

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
      const px = x + ox;
      const py = y + oy;
      const pz = z + oz;
      matrix.setPosition(px, py, pz);

      if (state === maxState) {
        if (isSurface) {
          if (aliveIndex < maxInstances) {
            this.aliveMesh.setMatrixAt(aliveIndex, matrix);
            // Set outline at same position (geometry is already larger)
            if (this.aliveEdges && this.showOutlines) {
              this.aliveEdges.setMatrixAt(aliveIndex, matrix);
            }

            // Add 12 edge lines for this cube (24 vertices)
            if (this.brightEdges && this.showBrightEdges && vertexIndex + 24 <= this.edgePositions.length / 3) {
              for (let e = 0; e < 12; e++) {
                const [c1, c2] = this.edgeIndices[e];
                const corner1 = this.cornerOffsets[c1];
                const corner2 = this.cornerOffsets[c2];

                // First vertex
                let vi = vertexIndex * 3;
                this.edgePositions[vi] = px + corner1[0];
                this.edgePositions[vi + 1] = py + corner1[1];
                this.edgePositions[vi + 2] = pz + corner1[2];
                this.edgeCornerOffsets[vi] = corner1[0];
                this.edgeCornerOffsets[vi + 1] = corner1[1];
                this.edgeCornerOffsets[vi + 2] = corner1[2];
                vertexIndex++;

                // Second vertex
                vi = vertexIndex * 3;
                this.edgePositions[vi] = px + corner2[0];
                this.edgePositions[vi + 1] = py + corner2[1];
                this.edgePositions[vi + 2] = pz + corner2[2];
                this.edgeCornerOffsets[vi] = corner2[0];
                this.edgeCornerOffsets[vi + 1] = corner2[1];
                this.edgeCornerOffsets[vi + 2] = corner2[2];
                vertexIndex++;
              }
            }
            aliveIndex++;
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

    // Update outline mesh
    if (this.aliveEdges) {
      this.aliveEdges.count = aliveIndex;
      this.aliveEdges.instanceMatrix.needsUpdate = true;
    }

    // Update bright edge lines - recreate geometry for reliable updates
    if (this.brightEdges) {
      this.edgeVertexCount = vertexIndex;

      if (vertexIndex > 0) {
        // Dispose old geometry
        if (this.edgeGeometry) {
          this.edgeGeometry.dispose();
        }

        // Create new geometry with current positions
        this.edgeGeometry = new LineSegmentsGeometry();
        const positions = this.edgePositions.slice(0, vertexIndex * 3);
        this.edgeGeometry.setPositions(positions);

        // Compute and set colors based on camera
        this.computeEdgeColors();
        const colors = this.edgeColors.slice(0, vertexIndex * 3);
        this.edgeGeometry.setColors(colors);

        // Assign new geometry to mesh
        this.brightEdges.geometry = this.edgeGeometry;
      }
    }

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
    if (this.aliveEdges) this.aliveEdges.visible = visible && this.showOutlines;
    if (this.brightEdges) this.brightEdges.visible = visible && this.showBrightEdges;
    if (this.gridHelper) this.gridHelper.visible = visible;
  }

  setBrightEdges(enabled) {
    this.showBrightEdges = enabled;
    if (this.brightEdges) this.brightEdges.visible = enabled;
  }

  resize(width, height) {
    // Update LineMaterial resolution for proper line width scaling
    if (this.brightEdgeMaterial) {
      this.brightEdgeMaterial.resolution.set(width, height);
    }
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
    if (this.aliveEdges) {
      this.scene.remove(this.aliveEdges);
      this.aliveEdges.dispose();
      this.aliveEdges = null;
    }
    if (this.brightEdges) {
      this.scene.remove(this.brightEdges);
      this.edgeGeometry?.dispose();
      this.brightEdges = null;
      this.edgeGeometry = null;
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
    if (this.outlineGeometry) {
      this.outlineGeometry.dispose();
      this.outlineGeometry = null;
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
    if (this.edgesMaterial) {
      this.edgesMaterial.dispose();
      this.edgesMaterial = null;
    }
    if (this.brightEdgeMaterial) {
      this.brightEdgeMaterial.dispose();
      this.brightEdgeMaterial = null;
    }
  }
}

// ============================================================
// PARTICLE RENDERER
// ============================================================

export const ParticleStyle = {
  DEFAULT: 'default',
  CLOUDS: 'clouds'
};

export class ParticleRenderer {
  constructor(scene, maxParticles) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.style = ParticleStyle.DEFAULT;

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
          float alpha = smoothstep(0.5, 0.1, r) * opacity;
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

  setStyle(style) {
    this.style = style;
    // Adjust material for cloud style
    if (style === ParticleStyle.CLOUDS) {
      this.material.uniforms.opacity.value = 0.6;
      this.material.blending = THREE.NormalBlending;
    } else {
      this.material.uniforms.opacity.value = 0.35;
      this.material.blending = THREE.NormalBlending;
    }
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

      // Color and size based on style, state, and surface detection
      if (this.style === ParticleStyle.CLOUDS) {
        // Cloud style - white/gray fluffy particles
        const brightness = isSurface ? 1.0 : 0.7;
        const variation = Math.random() * 0.1; // Slight variation
        this.colors[idx * 3] = brightness - variation;
        this.colors[idx * 3 + 1] = brightness - variation;
        this.colors[idx * 3 + 2] = brightness;
        this.sizes[idx] = isSurface ? 8.0 + Math.random() * 4 : 4.0 + Math.random() * 2;
      } else if (state === maxState) {
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
// VOLUMETRIC CLOUD RENDERER (Raymarching)
// ============================================================

export class VolumetricCloudRenderer {
  constructor(scene, gridSize = 50) {
    this.scene = scene;
    this.gridSize = gridSize;

    // Create 3D texture for grid data
    this.texture3D = null;
    this.textureData = null;

    // Create box geometry that encompasses the grid
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // Raymarching shader
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uVolume: { value: null },
        uGridSize: { value: gridSize },
        uSteps: { value: 64 },
        uDensity: { value: 1.0 },
        uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
        uLightColor: { value: new THREE.Vector3(1.0, 0.95, 0.9) },
        uAmbient: { value: new THREE.Vector3(0.6, 0.7, 0.9) },
        uCameraPos: { value: new THREE.Vector3() },
        uInvModelMatrix: { value: new THREE.Matrix4() }
      },
      vertexShader: `
        varying vec3 vWorldPos;

        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler3D uVolume;
        uniform float uGridSize;
        uniform int uSteps;
        uniform float uDensity;
        uniform vec3 uLightDir;
        uniform vec3 uLightColor;
        uniform vec3 uAmbient;
        uniform vec3 uCameraPos;
        uniform mat4 uInvModelMatrix;

        varying vec3 vWorldPos;

        // Ray-box intersection
        vec2 intersectBox(vec3 orig, vec3 dir, vec3 boxMin, vec3 boxMax) {
          vec3 invDir = 1.0 / dir;
          vec3 t0 = (boxMin - orig) * invDir;
          vec3 t1 = (boxMax - orig) * invDir;
          vec3 tmin = min(t0, t1);
          vec3 tmax = max(t0, t1);
          float tNear = max(max(tmin.x, tmin.y), tmin.z);
          float tFar = min(min(tmax.x, tmax.y), tmax.z);
          return vec2(tNear, tFar);
        }

        float sampleDensity(vec3 pos) {
          if (any(lessThan(pos, vec3(0.0))) || any(greaterThan(pos, vec3(1.0)))) {
            return 0.0;
          }
          return texture(uVolume, pos).r;
        }

        void main() {
          vec3 rayDir = normalize(vWorldPos - uCameraPos);

          // Transform to local [0,1] space using precomputed inverse
          vec3 localOrigin = (uInvModelMatrix * vec4(uCameraPos, 1.0)).xyz + 0.5;
          vec3 localDir = normalize((uInvModelMatrix * vec4(rayDir, 0.0)).xyz);

          vec2 t = intersectBox(localOrigin, localDir, vec3(0.0), vec3(1.0));
          if (t.x > t.y || t.y < 0.0) discard;

          t.x = max(t.x, 0.0);
          float stepSize = (t.y - t.x) / float(uSteps);

          vec3 pos = localOrigin + localDir * t.x;
          vec3 step = localDir * stepSize;

          float transmittance = 1.0;
          vec3 color = vec3(0.0);

          for (int i = 0; i < 64; i++) {
            if (i >= uSteps) break;

            float density = sampleDensity(pos) * uDensity;

            if (density > 0.01) {
              // Simple lighting - sample toward light
              float lightDensity = 0.0;
              vec3 lightPos = pos;
              for (int j = 0; j < 6; j++) {
                lightPos += uLightDir * 0.05;
                lightDensity += sampleDensity(lightPos) * 0.15;
              }

              float lightTransmit = exp(-lightDensity * 2.0);
              vec3 luminance = uLightColor * lightTransmit + uAmbient * (1.0 - lightTransmit * 0.5);

              color += transmittance * density * luminance * stepSize * 12.0;
              transmittance *= exp(-density * stepSize * 6.0);

              if (transmittance < 0.01) break;
            }

            pos += step;
          }

          if (transmittance > 0.995) discard;

          gl_FragColor = vec4(color, 1.0 - transmittance);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.invModelMatrix = new THREE.Matrix4();

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    this.initTexture(gridSize);
  }

  initTexture(gridSize) {
    this.gridSize = gridSize;
    const size = gridSize;
    this.textureData = new Uint8Array(size * size * size);

    this.texture3D = new THREE.Data3DTexture(this.textureData, size, size, size);
    this.texture3D.format = THREE.RedFormat;
    this.texture3D.type = THREE.UnsignedByteType;
    this.texture3D.minFilter = THREE.LinearFilter;
    this.texture3D.magFilter = THREE.LinearFilter;
    this.texture3D.wrapS = THREE.ClampToEdgeWrapping;
    this.texture3D.wrapT = THREE.ClampToEdgeWrapping;
    this.texture3D.wrapR = THREE.ClampToEdgeWrapping;
    this.texture3D.needsUpdate = true;

    this.material.uniforms.uVolume.value = this.texture3D;
    this.material.uniforms.uGridSize.value = gridSize;
  }

  update(gridData, gridSize, maxState, worldCenter, camera) {
    if (gridSize !== this.gridSize) {
      this.initTexture(gridSize);
    }

    // Copy grid data to texture (normalize to 0-255)
    const size2 = gridSize * gridSize;
    for (let i = 0; i < gridData.length; i++) {
      // Remap: grid uses x*size2 + y*size + z, texture uses x + y*size + z*size2
      const gz = i % gridSize;
      const gy = ((i / gridSize) | 0) % gridSize;
      const gx = (i / size2) | 0;
      const texIdx = gx + gy * gridSize + gz * size2;
      this.textureData[texIdx] = gridData[i] > 0 ? Math.floor((gridData[i] / maxState) * 255) : 0;
    }
    this.texture3D.needsUpdate = true;

    // Update camera position for raymarching
    if (camera) {
      this.material.uniforms.uCameraPos.value.copy(camera.position);
    }

    // Position and scale mesh
    this.mesh.position.set(worldCenter.x, worldCenter.y, worldCenter.z);
    this.mesh.scale.set(gridSize, gridSize, gridSize);

    // Update inverse model matrix for raymarching
    this.mesh.updateMatrixWorld();
    this.invModelMatrix.copy(this.mesh.matrixWorld).invert();
    this.material.uniforms.uInvModelMatrix.value.copy(this.invModelMatrix);
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.material.dispose();
    }
    if (this.texture3D) {
      this.texture3D.dispose();
    }
  }
}

// ============================================================
// MARCHING CUBES RENDERER
// ============================================================

export class MarchingCubesRenderer {
  constructor(scene, resolution = 40) {
    this.scene = scene;
    this.resolution = resolution;

    // Organic iridescent material
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x00ddaa,
      roughness: 0.2,
      metalness: 0.3,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide
    });

    // MarchingCubes(resolution, material, enableUvs, enableColors, maxPolyCount)
    // Higher poly count needed for precise cell-accurate rendering
    this.effect = new MarchingCubes(resolution, this.material, false, false, 500000);
    this.effect.isolation = 50;
    this.effect.visible = true;
    this.scene.add(this.effect);

    this.gridSize = 50;
    this.smoothing = true; // Enable field smoothing for organic look
  }

  // Check if cell is on the surface (has a dead neighbor)
  isSurfaceCell(idx, data, size, state) {
    if (state === 0) return false;
    const size2 = size * size;
    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = (idx / size2) | 0;

    // Check 6 direct neighbors for any dead/lower state
    const neighbors = [
      [x - 1, y, z], [x + 1, y, z],
      [x, y - 1, z], [x, y + 1, z],
      [x, y, z - 1], [x, y, z + 1]
    ];

    for (const [nx, ny, nz] of neighbors) {
      // Boundary counts as surface
      if (nx < 0 || nx >= size || ny < 0 || ny >= size || nz < 0 || nz >= size) {
        return true;
      }
      const neighborIdx = nx * size2 + ny * size + nz;
      if (data[neighborIdx] < state) return true;
    }
    return false;
  }

  update(gridData, gridSize, maxState, worldCenter) {
    this.gridSize = gridSize;

    // Cap resolution for performance - smoothing makes up for lower res
    const effectiveRes = Math.min(gridSize, 40);
    if (effectiveRes !== this.resolution) {
      this.resolution = effectiveRes;
    }

    // Initialize and reset the marching cubes field
    this.effect.init(this.resolution);
    // In MarchingCubes: field < isolation = "inside" (solid), field >= isolation = "outside" (empty)
    // We want alive cells to be solid (inside) and dead cells to be empty (outside)
    this.effect.isolation = 50;
    this.effect.reset();

    const field = this.effect.field;
    const mcSize = this.effect.size;
    const mcSize2 = mcSize * mcSize;

    // Scale factor from grid to marching cubes resolution
    const scale = mcSize / gridSize;
    const gridSize2 = gridSize * gridSize;

    // Initialize all cells as "outside" (empty) - field value above isolation
    for (let i = 0; i < field.length; i++) {
      field[i] = 100; // Above isolation(50), so "outside"
    }

    // Mark alive cells as "inside" (solid) - field value below isolation
    for (let i = 0; i < gridData.length; i++) {
      const state = gridData[i];
      if (state === 0) continue;

      // Grid coordinates
      const gz = i % gridSize;
      const gy = ((i / gridSize) | 0) % gridSize;
      const gx = (i / gridSize2) | 0;

      // Map to marching cubes field coordinates
      const mcx = Math.floor(gx * scale);
      const mcy = Math.floor(gy * scale);
      const mcz = Math.floor(gz * scale);

      // Bounds check
      if (mcx >= mcSize || mcy >= mcSize || mcz >= mcSize) continue;

      // Set field value: alive cells are "inside" (below isolation)
      const fieldIdx = mcx + mcy * mcSize + mcz * mcSize2;
      field[fieldIdx] = 0; // Below isolation(50), so "inside"
    }

    // Smoothing pass - blur the field for organic rounded edges
    if (this.smoothing) {
      this.smoothField(field, mcSize);
    }

    // CRITICAL: Must call update() to generate the mesh geometry
    this.effect.update();

    // Position and scale to match grid coordinates
    const halfGrid = gridSize / 2;
    this.effect.position.set(
      worldCenter.x - halfGrid,
      worldCenter.y - halfGrid,
      worldCenter.z - halfGrid
    );
    this.effect.scale.set(gridSize, gridSize, gridSize);
  }

  // Fast separable blur - 3 passes of 1D blur (9 samples vs 27)
  smoothField(field, size) {
    const size2 = size * size;
    const temp = new Float32Array(field.length);

    // X-axis pass
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 1; x < size - 1; x++) {
          const idx = x + y * size + z * size2;
          temp[idx] = (field[idx - 1] + field[idx] + field[idx + 1]) / 3;
        }
      }
    }

    // Y-axis pass
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        for (let y = 1; y < size - 1; y++) {
          const idx = x + y * size + z * size2;
          field[idx] = (temp[idx - size] + temp[idx] + temp[idx + size]) / 3;
        }
      }
    }

    // Z-axis pass
    temp.set(field);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (let z = 1; z < size - 1; z++) {
          const idx = x + y * size + z * size2;
          field[idx] = (temp[idx - size2] + temp[idx] + temp[idx + size2]) / 3;
        }
      }
    }
  }

  setIsoLevel(level) {
    this.effect.isolation = level;
  }

  setSmoothing(enabled) {
    this.smoothing = enabled;
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
    this.volumetricRenderer = null;

    this.gridSize = 50;
    this.cellScale = 1.0;
    this.camera = null; // Need camera ref for volumetric
  }

  init(gridSize) {
    this.gridSize = gridSize;
    const totalCells = gridSize * gridSize * gridSize;
    const maxInstances = Math.min(totalCells, this.maxInstances);

    // Create cube renderer by default
    this.cubeRenderer = new CubeRenderer(this.scene, maxInstances);
    this.cubeRenderer.setupGridHelper(gridSize);
    if (this.camera) {
      this.cubeRenderer.setCamera(this.camera);
    }
  }

  setRenderMode(mode) {
    // Hide all renderers
    if (this.cubeRenderer) this.cubeRenderer.setVisible(false);
    if (this.particleRenderer) this.particleRenderer.setVisible(false);
    if (this.marchingCubesRenderer) this.marchingCubesRenderer.setVisible(false);
    if (this.volumetricRenderer) this.volumetricRenderer.setVisible(false);

    this.currentMode = mode;

    // Create and show the selected renderer
    switch (mode) {
      case RenderMode.CUBES:
        if (!this.cubeRenderer) {
          const totalCells = this.gridSize * this.gridSize * this.gridSize;
          const maxInstances = Math.min(totalCells, this.maxInstances);
          this.cubeRenderer = new CubeRenderer(this.scene, maxInstances);
          this.cubeRenderer.setupGridHelper(this.gridSize);
          if (this.camera) {
            this.cubeRenderer.setCamera(this.camera);
          }
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
        if (!this.marchingCubesRenderer) {
          const resolution = Math.min(this.gridSize, 40);
          this.marchingCubesRenderer = new MarchingCubesRenderer(this.scene, resolution);
        }
        this.marchingCubesRenderer.setVisible(true);
        break;

      case RenderMode.VOLUMETRIC:
        if (!this.volumetricRenderer) {
          this.volumetricRenderer = new VolumetricCloudRenderer(this.scene, this.gridSize);
        }
        this.volumetricRenderer.setVisible(true);
        break;
    }
  }

  setCamera(camera) {
    this.camera = camera;
    if (this.cubeRenderer) {
      this.cubeRenderer.setCamera(camera);
    }
  }

  setCellScale(scale) {
    this.cellScale = scale;
    if (this.cubeRenderer) {
      this.cubeRenderer.createGeometry(scale);
    }
  }

  setParticleStyle(style) {
    if (this.particleRenderer) {
      this.particleRenderer.setStyle(style);
    }
  }

  setWireframe(enabled) {
    if (this.cubeRenderer) {
      this.cubeRenderer.setWireframe(enabled);
    }
  }

  setOutlines(enabled) {
    if (this.cubeRenderer) {
      this.cubeRenderer.setOutlines(enabled);
    }
  }

  setBrightEdges(enabled) {
    if (this.cubeRenderer) {
      this.cubeRenderer.setBrightEdges(enabled);
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

      case RenderMode.VOLUMETRIC:
        if (this.volumetricRenderer) {
          this.volumetricRenderer.update(gridData, size, maxState, worldCenter, this.camera);
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

  resizeWindow(width, height) {
    // Update line material resolution for proper line widths
    if (this.cubeRenderer) {
      this.cubeRenderer.resize(width, height);
    }
  }

  // Update camera-facing edge highlights (call every frame)
  updateEdgeHighlights() {
    if (this.currentMode === RenderMode.CUBES && this.cubeRenderer) {
      this.cubeRenderer.updateBrightEdgeColors();
    }
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
    if (this.volumetricRenderer) {
      this.volumetricRenderer.dispose();
      this.volumetricRenderer = null;
    }
  }
}
