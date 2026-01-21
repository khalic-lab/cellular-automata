# Point Cloud and Marching Cubes Implementation Plan

## Overview

Add two new rendering modes to `src/web/viewer3d.html`:
1. **Point Cloud** - Render cells as glowing points with bloom effect
2. **Marching Cubes** - Render smooth isosurface mesh from cell data

## File to Modify

`src/web/viewer3d.html` - All changes in single HTML file

---

## Part 1: Point Cloud Rendering

### 1.1 UI Changes

Update Display Mode dropdown to include Point Cloud option:
```html
<select id="displayMode">
  <option value="all">Cubes - All Cells</option>
  <option value="shell">Cubes - Shell Only</option>
  <option value="pointcloud">Point Cloud</option>
</select>
```

### 1.2 Point Cloud Setup

Create a `THREE.Points` object with `THREE.BufferGeometry`:

```javascript
let pointCloud = null;
let pointPositions = null;
let pointColors = null;

function setupPointCloud() {
  const totalCells = gridSize * gridSize * gridSize;
  const maxPoints = Math.min(totalCells, MAX_RENDER_INSTANCES);

  // Pre-allocate buffers
  pointPositions = new Float32Array(maxPoints * 3);
  pointColors = new Float32Array(maxPoints * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });

  pointCloud = new THREE.Points(geometry, material);
  pointCloud.visible = false;
  scene.add(pointCloud);
}
```

### 1.3 Point Cloud Update Function

```javascript
function updatePointCloud() {
  if (!pointCloud) return;

  const halfSize = gridSize / 2;
  const size = gridSize;
  const size2 = size * size;
  const data = currentGrid.data;
  const total = data.length;
  const ox = worldCenter.x - halfSize + 0.5;
  const oy = worldCenter.y - halfSize + 0.5;
  const oz = worldCenter.z - halfSize + 0.5;
  let pointIndex = 0;

  for (let idx = 0; idx < total; idx++) {
    const state = data[idx];
    if (state === 0) continue;

    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = (idx / size2) | 0;

    const i3 = pointIndex * 3;
    pointPositions[i3] = x + ox;
    pointPositions[i3 + 1] = y + oy;
    pointPositions[i3 + 2] = z + oz;

    // Color based on state
    if (state === maxState) {
      // Alive - cyan
      pointColors[i3] = 0.0;
      pointColors[i3 + 1] = 0.87;
      pointColors[i3 + 2] = 0.67;
    } else {
      // Decaying - yellow to red gradient
      const t = state / maxState;
      pointColors[i3] = 1.0;
      pointColors[i3 + 1] = t * 0.8;
      pointColors[i3 + 2] = 0.0;
    }

    pointIndex++;
  }

  // Update geometry
  pointCloud.geometry.attributes.position.needsUpdate = true;
  pointCloud.geometry.attributes.color.needsUpdate = true;
  pointCloud.geometry.setDrawRange(0, pointIndex);
}
```

### 1.4 Display Mode Switching

Update `updateVisualization()` to switch between rendering modes:

```javascript
function updateVisualization() {
  if (displayMode === 'pointcloud') {
    // Hide cube meshes
    aliveMesh.visible = false;
    interiorMesh.visible = false;
    decayMesh.visible = false;
    pointCloud.visible = true;
    // Hide marching cubes if present
    if (marchingCubesMesh) marchingCubesMesh.visible = false;
    updatePointCloud();
  } else {
    // Show cube meshes
    aliveMesh.visible = true;
    interiorMesh.visible = true;
    decayMesh.visible = true;
    pointCloud.visible = false;
    if (marchingCubesMesh) marchingCubesMesh.visible = false;
    updateMesh();
  }
}
```

---

## Part 2: Marching Cubes Rendering

### 2.1 UI Changes

Add Marching Cubes option to Display Mode dropdown:
```html
<select id="displayMode">
  <option value="all">Cubes - All Cells</option>
  <option value="shell">Cubes - Shell Only</option>
  <option value="pointcloud">Point Cloud</option>
  <option value="marching">Smooth Surface (Marching Cubes)</option>
</select>
```

### 2.2 Marching Cubes Implementation

Three.js has `MarchingCubes` in addons. Import and use it:

```javascript
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

let marchingCubesMesh = null;

function setupMarchingCubes() {
  // MarchingCubes takes resolution and material
  const resolution = Math.min(gridSize, 64); // Cap resolution for performance

  const material = new THREE.MeshPhongMaterial({
    color: 0x00ddaa,
    specular: 0x111111,
    shininess: 30,
    flatShading: false,
    side: THREE.DoubleSide
  });

  marchingCubesMesh = new MarchingCubes(resolution, material, false, true);
  marchingCubesMesh.position.set(worldCenter.x, worldCenter.y, worldCenter.z);
  marchingCubesMesh.scale.set(gridSize, gridSize, gridSize);
  marchingCubesMesh.visible = false;
  scene.add(marchingCubesMesh);
}

function updateMarchingCubes() {
  if (!marchingCubesMesh) return;

  const size = gridSize;
  const resolution = marchingCubesMesh.resolution;
  const data = currentGrid.data;

  marchingCubesMesh.reset();

  // Add balls (metaballs) at each alive cell position
  const scale = resolution / size;
  const strength = 0.5;
  const subtract = 10;

  for (let idx = 0; idx < data.length; idx++) {
    const state = data[idx];
    if (state === 0) continue;

    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = ((idx / (size * size)) | 0);

    // Normalize to 0-1 range for MarchingCubes
    const nx = x / size;
    const ny = y / size;
    const nz = z / size;

    // Strength based on state
    const s = (state / maxState) * strength;
    marchingCubesMesh.addBall(nx, ny, nz, s, subtract);
  }

  marchingCubesMesh.position.set(worldCenter.x, worldCenter.y, worldCenter.z);
}
```

**Note:** The MarchingCubes class from Three.js is a metaball renderer. For large grids (50³+), this will be slow. An alternative is to implement a simpler isosurface extraction using a custom marching cubes algorithm that operates directly on the grid data.

### 2.3 Alternative: Custom Isosurface Mesh

For better performance, generate a mesh from the grid data using a lookup-table-based marching cubes:

```javascript
// Import or inline a marching cubes lookup table implementation
// Generate BufferGeometry directly from grid data

function generateIsosurfaceMesh() {
  // Sample the grid at lower resolution if needed
  // Generate triangles using marching cubes algorithm
  // Return THREE.BufferGeometry
}
```

Given complexity, will start with the Three.js MarchingCubes addon which works well for smaller grids (up to ~30³), and note performance limitations for larger grids.

---

## Implementation Order

1. Add Point Cloud rendering mode (simpler, no new imports needed)
2. Test Point Cloud with various presets and grid sizes
3. Add Marching Cubes rendering mode
4. Test Marching Cubes with smaller grids
5. Add performance warning for large grids with Marching Cubes

---

## Verification

```bash
# Run E2E tests (point cloud won't affect existing tests since cubes are default)
bun run test:e2e

# Manual testing checklist:
# 1. Point Cloud mode - cells render as glowing dots
# 2. Point Cloud colors - alive cyan, decaying yellow->red gradient
# 3. Point Cloud with bloom - points should glow
# 4. Marching Cubes mode - smooth blobby surface
# 5. Mode switching - clean transition between modes
# 6. Grid size changes - all modes reinitialize correctly
# 7. Performance - point cloud should be fast, marching cubes slower on large grids
```

---

## Files Modified

- `src/web/viewer3d.html` - Add display mode options, point cloud setup/update, marching cubes setup/update
