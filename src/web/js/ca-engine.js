/**
 * ca-engine.js - Core Cellular Automata Engine
 *
 * Contains:
 * - Grid class for managing CA state
 * - Initialization functions (random, blob)
 * - Neighborhood generation (Moore, von Neumann)
 * - Rule creation and evaluation
 * - Optimized stepping functions
 * - Web Worker code generation
 * - WebGL compute shader implementation
 */

// ============================================================
// GRID CLASS
// ============================================================

function computeStrides(dimensions) {
  const strides = new Array(dimensions.length);
  let stride = 1;
  for (let i = dimensions.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= dimensions[i];
  }
  return strides;
}

export class Grid {
  constructor(dimensions) {
    this.dimensions = [...dimensions];
    this.strides = computeStrides(dimensions);
    this.size = dimensions.reduce((prod, dim) => prod * dim, 1);
    this.data = new Uint8Array(this.size);
  }

  index(coord) {
    let idx = 0;
    for (let i = 0; i < coord.length; i++) {
      idx += coord[i] * this.strides[i];
    }
    return idx;
  }

  wrap(coord) {
    const wrapped = new Array(coord.length);
    for (let i = 0; i < coord.length; i++) {
      wrapped[i] = ((coord[i] % this.dimensions[i]) + this.dimensions[i]) % this.dimensions[i];
    }
    return wrapped;
  }

  get(coord) {
    return this.data[this.index(coord)];
  }

  set(coord, value) {
    this.data[this.index(coord)] = value;
  }

  clone() {
    const copy = new Grid(this.dimensions);
    copy.data.set(this.data);
    return copy;
  }

  countPopulation() {
    let count = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.data[i] > 0) count++;
    }
    return count;
  }
}

// ============================================================
// INITIALIZATION FUNCTIONS
// ============================================================

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next: () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    }
  };
}

export function initializeRandom(grid, density, { next }) {
  for (let i = 0; i < grid.size; i++) {
    grid.data[i] = next() < density ? 1 : 0;
  }
}

// Position-based hash random (matches williamyang98's approach)
function positionHash(x, y, z, seed) {
  const a = x * 12.9898 + y * 78.233 + z * 3.2345;
  const b = Math.sin(a * seed) * 43758.5453;
  return b - Math.floor(b);
}

export function initializeBlob(grid, density, radiusCells, cellMaxState, { next }, shape = 'sphere') {
  const dims = grid.dimensions;
  const size = dims[0];
  const size2 = size * size;

  grid.data.fill(0);

  const center = dims.map(d => Math.floor(d / 2));
  const seed = next() * 1000 + 1;

  if (radiusCells <= 0) {
    for (let x = 0; x < dims[0]; x++) {
      for (let y = 0; y < dims[1]; y++) {
        for (let z = 0; z < dims[2]; z++) {
          if (positionHash(x, y, z, seed) < density) {
            const idx = x * size2 + y * size + z;
            grid.data[idx] = cellMaxState;
          }
        }
      }
    }
    return;
  }

  const radiusSq = radiusCells * radiusCells;
  const r = radiusCells;
  const phi = (1 + Math.sqrt(5)) / 2;

  function insideConvexHull(px, py, pz, faces, vertices) {
    for (const face of faces) {
      const v0 = vertices[face[0]];
      const v1 = vertices[face[1]];
      const v2 = vertices[face[2]];
      const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
      const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
      const n = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0]
      ];
      const dot = (px - v0[0]) * n[0] + (py - v0[1]) * n[1] + (pz - v0[2]) * n[2];
      if (dot > 0.001) return false;
    }
    return true;
  }

  const tetraVerts = [
    [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]
  ].map(v => v.map(c => c * r / Math.sqrt(3)));
  const tetraFaces = [[0,1,2], [0,2,3], [0,3,1], [1,3,2]];

  const octaVerts = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
  ].map(v => v.map(c => c * r));
  const octaFaces = [
    [0,2,4], [0,4,3], [0,3,5], [0,5,2],
    [1,4,2], [1,3,4], [1,5,3], [1,2,5]
  ];

  const icosaVerts = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ].map(v => { const l = Math.sqrt(1 + phi*phi); return v.map(c => c * r / l); });
  const icosaFaces = [
    [0,1,8], [0,8,4], [0,4,5], [0,5,9], [0,9,1],
    [1,6,8], [8,6,10], [8,10,4], [4,10,2], [4,2,5],
    [5,2,11], [5,11,9], [9,11,7], [9,7,1], [1,7,6],
    [3,6,7], [3,7,11], [3,11,2], [3,2,10], [3,10,6]
  ];

  const dodecaVerts = [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    [0, phi, 1/phi], [0, phi, -1/phi], [0, -phi, 1/phi], [0, -phi, -1/phi],
    [1/phi, 0, phi], [-1/phi, 0, phi], [1/phi, 0, -phi], [-1/phi, 0, -phi],
    [phi, 1/phi, 0], [phi, -1/phi, 0], [-phi, 1/phi, 0], [-phi, -1/phi, 0]
  ].map(v => { const l = Math.sqrt(3); return v.map(c => c * r / l); });
  const dodecaFaces = [
    [0,16,2,12,13], [0,13,4,8,16], [0,8,9,1,16], [1,9,5,15,14],
    [1,14,3,17,16], [2,17,3,11,10], [2,10,6,13,12], [4,13,6,19,18],
    [4,18,5,9,8], [5,18,19,7,15], [6,10,11,7,19], [3,14,15,7,11]
  ].map(f => [f[0], f[1], f[2]]);

  for (let x = 0; x < dims[0]; x++) {
    for (let y = 0; y < dims[1]; y++) {
      for (let z = 0; z < dims[2]; z++) {
        const dx = x - center[0];
        const dy = y - center[1];
        const dz = z - center[2];

        let inRegion;
        if (shape === 'cube') {
          inRegion = Math.abs(dx) <= r && Math.abs(dy) <= r && Math.abs(dz) <= r;
        } else if (shape === 'tetrahedron') {
          inRegion = insideConvexHull(dx, dy, dz, tetraFaces, tetraVerts);
        } else if (shape === 'octahedron') {
          inRegion = insideConvexHull(dx, dy, dz, octaFaces, octaVerts);
        } else if (shape === 'icosahedron') {
          inRegion = insideConvexHull(dx, dy, dz, icosaFaces, icosaVerts);
        } else if (shape === 'dodecahedron') {
          inRegion = insideConvexHull(dx, dy, dz, dodecaFaces, dodecaVerts);
        } else {
          inRegion = dx * dx + dy * dy + dz * dz <= radiusSq;
        }

        if (inRegion && positionHash(x, y, z, seed) < density) {
          const idx = x * size2 + y * size + z;
          grid.data[idx] = cellMaxState;
        }
      }
    }
  }
}

// ============================================================
// NEIGHBORHOOD GENERATION
// ============================================================

export function generateNeighborhood(dimensions, { type, range = 1 }) {
  const ndim = dimensions.length;
  const offsets = [];

  function isValidNeighbor(offset, type, range) {
    if (type === 'moore') {
      const chebyshev = Math.max(...offset.map(Math.abs));
      return chebyshev <= range;
    }
    const manhattan = offset.reduce((sum, v) => sum + Math.abs(v), 0);
    return manhattan <= range;
  }

  function generate(current, dim) {
    if (dim === ndim) {
      const isOrigin = current.every(v => v === 0);
      if (!isOrigin && isValidNeighbor(current, type, range)) {
        offsets.push([...current]);
      }
      return;
    }
    for (let offset = -range; offset <= range; offset++) {
      current[dim] = offset;
      generate(current, dim + 1);
    }
  }

  generate(new Array(ndim).fill(0), 0);
  return offsets;
}

export function getMaxNeighbors(dimensions, type, range) {
  const ndim = dimensions.length;
  if (type === 'moore') {
    return Math.pow(2 * range + 1, ndim) - 1;
  }
  if (range === 1) {
    return 2 * ndim;
  }
  let count = 0;
  const temp = new Array(ndim).fill(0);
  function countOffsets(dim) {
    if (dim === ndim) {
      const manhattan = temp.reduce((sum, v) => sum + Math.abs(v), 0);
      const isOrigin = temp.every(v => v === 0);
      if (!isOrigin && manhattan <= range) count++;
      return;
    }
    for (let offset = -range; offset <= range; offset++) {
      temp[dim] = offset;
      countOffsets(dim + 1);
    }
  }
  countOffsets(0);
  return count;
}

// ============================================================
// RULE CREATION
// ============================================================

export function createRule(birth, survival, maxNeighbors) {
  return {
    birth: new Set(birth),
    survival: new Set(survival),
    maxNeighbors
  };
}

export function shouldCellBeAlive({ birth, survival }, currentState, neighborCount) {
  if (currentState === 1) {
    return survival.has(neighborCount);
  }
  return birth.has(neighborCount);
}

// ============================================================
// OPTIMIZED STEPPING
// ============================================================

export function computeNeighborIndexDeltas(neighborhood, strides) {
  const deltas = new Int32Array(neighborhood.length);
  for (let n = 0; n < neighborhood.length; n++) {
    let delta = 0;
    for (let d = 0; d < strides.length; d++) {
      delta += neighborhood[n][d] * strides[d];
    }
    deltas[n] = delta;
  }
  return deltas;
}

export function createRuleLookups(birthSet, survivalSet, maxNeighbors) {
  const birth = new Uint8Array(maxNeighbors + 1);
  const survival = new Uint8Array(maxNeighbors + 1);
  for (const b of birthSet) birth[b] = 1;
  for (const s of survivalSet) survival[s] = 1;
  return { birth, survival };
}

export function createNeighborOffsets(neighborhood) {
  const offsets = new Int8Array(neighborhood.length * 3);
  for (let n = 0; n < neighborhood.length; n++) {
    offsets[n * 3] = neighborhood[n][0];
    offsets[n * 3 + 1] = neighborhood[n][1];
    offsets[n * 3 + 2] = neighborhood[n][2];
  }
  return offsets;
}

export function stepGridOptimized(currData, nextData, size, deltas, neighborOffsets, birth, survival, maxState) {
  const size2 = size * size;
  const total = size * size2;
  const numNeighbors = deltas.length;

  for (let idx = 0; idx < total; idx++) {
    const z = idx % size;
    const y = ((idx / size) | 0) % size;
    const x = (idx / size2) | 0;

    const isEdge = x === 0 || x === size - 1 ||
                   y === 0 || y === size - 1 ||
                   z === 0 || z === size - 1;

    let count = 0;
    if (isEdge) {
      for (let n = 0; n < numNeighbors; n++) {
        const ox = neighborOffsets[n * 3];
        const oy = neighborOffsets[n * 3 + 1];
        const oz = neighborOffsets[n * 3 + 2];

        const nx = ((x + ox) % size + size) % size;
        const ny = ((y + oy) % size + size) % size;
        const nz = ((z + oz) % size + size) % size;

        if (currData[nx * size2 + ny * size + nz] === maxState) count++;
      }
    } else {
      for (let n = 0; n < numNeighbors; n++) {
        if (currData[idx + deltas[n]] === maxState) count++;
      }
    }

    const currState = currData[idx];
    if (currState === 0) {
      nextData[idx] = birth[count] ? maxState : 0;
    } else if (currState === maxState) {
      nextData[idx] = survival[count] ? maxState : maxState - 1;
    } else {
      nextData[idx] = currState - 1;
    }
  }
}

// ============================================================
// WEB WORKER
// ============================================================

const workerCode = `
  let gridSize, size2, total;
  let currentData, nextData;
  let neighborDeltas, neighborOffsets;
  let birthLookup, survivalLookup;
  let maxState = 15;

  self.onmessage = function(e) {
    const { type, payload } = e.data;
    switch (type) {
      case 'init':
        initWorker(payload);
        break;
      case 'step':
        performStep();
        break;
      case 'reset':
        resetGrid(payload);
        break;
      case 'setRule':
        updateRule(payload);
        break;
    }
  };

  function initWorker(data) {
    gridSize = data.gridSize;
    size2 = gridSize * gridSize;
    total = size2 * gridSize;
    currentData = new Uint8Array(data.gridData);
    nextData = new Uint8Array(total);
    neighborDeltas = new Int32Array(data.deltas);
    neighborOffsets = new Int8Array(data.offsets);
    birthLookup = new Uint8Array(data.birth);
    survivalLookup = new Uint8Array(data.survival);
    maxState = data.maxState || 15;
    self.postMessage({ type: 'ready' });
  }

  function resetGrid(data) {
    currentData = new Uint8Array(data.gridData);
    nextData = new Uint8Array(total);
    if (data.maxState !== undefined) maxState = data.maxState;
    self.postMessage({ type: 'resetComplete' });
  }

  function updateRule(data) {
    birthLookup = new Uint8Array(data.birth);
    survivalLookup = new Uint8Array(data.survival);
    if (data.maxState !== undefined) maxState = data.maxState;
    self.postMessage({ type: 'ruleUpdated' });
  }

  function performStep() {
    const size = gridSize;
    const deltas = neighborDeltas;
    const offsets = neighborOffsets;
    const numNeighbors = deltas.length;
    const birth = birthLookup;
    const survival = survivalLookup;
    const currData = currentData;
    const nxtData = nextData;
    const mState = maxState;

    for (let idx = 0; idx < total; idx++) {
      const z = idx % size;
      const y = ((idx / size) | 0) % size;
      const x = (idx / size2) | 0;

      const isEdge = x === 0 || x === size - 1 ||
                     y === 0 || y === size - 1 ||
                     z === 0 || z === size - 1;

      let count = 0;
      if (isEdge) {
        for (let n = 0; n < numNeighbors; n++) {
          const ox = offsets[n * 3];
          const oy = offsets[n * 3 + 1];
          const oz = offsets[n * 3 + 2];

          const nx = ((x + ox) % size + size) % size;
          const ny = ((y + oy) % size + size) % size;
          const nz = ((z + oz) % size + size) % size;

          if (currData[nx * size2 + ny * size + nz] === mState) count++;
        }
      } else {
        for (let n = 0; n < numNeighbors; n++) {
          if (currData[idx + deltas[n]] === mState) count++;
        }
      }

      const currState = currData[idx];
      if (currState === 0) {
        nxtData[idx] = birth[count] ? mState : 0;
      } else if (currState === mState) {
        nxtData[idx] = survival[count] ? mState : mState - 1;
      } else {
        nxtData[idx] = currState - 1;
      }
    }

    const temp = currentData;
    currentData = nextData;
    nextData = temp;

    const buffer = currentData.buffer.slice(0);
    self.postMessage({ type: 'stepComplete', data: new Uint8Array(buffer) }, [buffer]);
  }
`;

export function createCAWorker() {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

// ============================================================
// WEBGL COMPUTE
// ============================================================

const webglVertexShader = `#version 300 es
  in vec2 aPosition;
  out vec2 vTexCoord;
  void main() {
    vTexCoord = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const webglFragmentShader = `#version 300 es
  precision highp float;
  precision highp int;

  uniform sampler2D uState;
  uniform int uGridSize;
  uniform int uTexWidth;
  uniform int uBirthMask;
  uniform int uSurvivalMask;
  uniform int uMaxState;

  in vec2 vTexCoord;
  out vec4 fragColor;

  ivec2 gridToTex(ivec3 pos, int size, int texWidth) {
    int linearIdx = pos.x * size * size + pos.y * size + pos.z;
    return ivec2(linearIdx % texWidth, linearIdx / texWidth);
  }

  int getCell(ivec3 pos, int size, int texWidth, int maxState) {
    ivec3 wrapped = ivec3(
      (pos.x % size + size) % size,
      (pos.y % size + size) % size,
      (pos.z % size + size) % size
    );
    ivec2 texPos = gridToTex(wrapped, size, texWidth);
    float val = texelFetch(uState, texPos, 0).r;
    return int(val * float(maxState) + 0.5);
  }

  void main() {
    int size = uGridSize;
    int texWidth = uTexWidth;
    int maxState = uMaxState;

    ivec2 texPos = ivec2(gl_FragCoord.xy);
    int linearIdx = texPos.y * texWidth + texPos.x;

    int total = size * size * size;
    if (linearIdx >= total) {
      fragColor = vec4(0.0);
      return;
    }

    int z = linearIdx % size;
    int y = (linearIdx / size) % size;
    int x = linearIdx / (size * size);
    ivec3 pos = ivec3(x, y, z);

    int count = 0;
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        for (int dz = -1; dz <= 1; dz++) {
          if (dx == 0 && dy == 0 && dz == 0) continue;
          int neighborState = getCell(pos + ivec3(dx, dy, dz), size, texWidth, maxState);
          if (neighborState == maxState) count++;
        }
      }
    }

    int current = getCell(pos, size, texWidth, maxState);
    int nextState;

    if (current == 0) {
      bool birth = ((uBirthMask >> count) & 1) == 1;
      nextState = birth ? maxState : 0;
    } else if (current == maxState) {
      bool survive = ((uSurvivalMask >> count) & 1) == 1;
      nextState = survive ? maxState : maxState - 1;
    } else {
      nextState = current - 1;
    }

    float outVal = float(nextState) / float(maxState);
    fragColor = vec4(outVal, 0.0, 0.0, 1.0);
  }
`;

export class WebGLCACompute {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2');
    this.initialized = false;
    this.gridSize = 0;
    this.texWidth = 0;
    this.texHeight = 0;
    this.maxState = 1;
    this.program = null;
    this.textures = [null, null];
    this.framebuffers = [null, null];
    this.currentTexIndex = 0;
  }

  init(gridSize, birthSet, survivalSet, maxState = 1) {
    const gl = this.gl;
    if (!gl) return false;

    this.gridSize = gridSize;
    this.maxState = maxState;
    const total = gridSize * gridSize * gridSize;

    const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    this.texWidth = Math.min(maxTexSize, Math.pow(2, Math.ceil(Math.log2(Math.sqrt(total)))));
    this.texHeight = Math.ceil(total / this.texWidth);

    if (this.texHeight > maxTexSize) {
      console.warn(`Grid ${gridSize}³ exceeds WebGL texture limits`);
      return false;
    }

    this.canvas.width = this.texWidth;
    this.canvas.height = this.texHeight;
    gl.viewport(0, 0, this.texWidth, this.texHeight);

    this.program = this.createProgram(webglVertexShader, webglFragmentShader);
    if (!this.program) return false;

    for (let i = 0; i < 2; i++) {
      this.textures[i] = this.createTexture();
      this.framebuffers[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
    }

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, 'aPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uGridSize'), gridSize);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexWidth'), this.texWidth);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uMaxState'), maxState);

    this.setRule(birthSet, survivalSet);

    this.initialized = true;
    return true;
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  createTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this.texWidth, this.texHeight, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  setRule(birthSet, survivalSet) {
    const gl = this.gl;
    if (!this.program) return;

    let birthMask = 0;
    let survivalMask = 0;
    for (const b of birthSet) birthMask |= (1 << b);
    for (const s of survivalSet) survivalMask |= (1 << s);

    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uBirthMask'), birthMask);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uSurvivalMask'), survivalMask);
  }

  setMaxState(maxState) {
    const gl = this.gl;
    this.maxState = maxState;
    if (!this.program) return;
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uMaxState'), maxState);
  }

  uploadGrid(gridData) {
    const gl = this.gl;
    const total = this.gridSize * this.gridSize * this.gridSize;
    const maxState = this.maxState;

    const texData = new Uint8Array(this.texWidth * this.texHeight);
    for (let i = 0; i < total; i++) {
      texData[i] = Math.round((gridData[i] / maxState) * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentTexIndex]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.texWidth, this.texHeight, gl.RED, gl.UNSIGNED_BYTE, texData);
  }

  step() {
    const gl = this.gl;
    const nextTexIndex = 1 - this.currentTexIndex;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[nextTexIndex]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentTexIndex]);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uState'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.currentTexIndex = nextTexIndex;
  }

  readGrid(targetData) {
    const gl = this.gl;
    const total = this.gridSize * this.gridSize * this.gridSize;
    const maxState = this.maxState;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.currentTexIndex]);
    const texData = new Uint8Array(this.texWidth * this.texHeight * 4);
    gl.readPixels(0, 0, this.texWidth, this.texHeight, gl.RGBA, gl.UNSIGNED_BYTE, texData);

    for (let i = 0; i < total; i++) {
      targetData[i] = Math.round((texData[i * 4] / 255) * maxState);
    }
  }

  dispose() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    for (let i = 0; i < 2; i++) {
      if (this.textures[i]) gl.deleteTexture(this.textures[i]);
      if (this.framebuffers[i]) gl.deleteFramebuffer(this.framebuffers[i]);
    }
    this.initialized = false;
  }
}

// ============================================================
// RULE PRESETS
// ============================================================

export const RULE_PRESETS = {
  'amoeba': {
    survival: [9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    birth: [5,6,7,12,13,15],
    states: 16,
    init: { radiusCells: 8, density: 0.5 }
  },
  '445': {
    survival: [4],
    birth: [4],
    states: 5,
    init: { radiusCells: 15, density: 0.15 }
  },
  'builder': {
    survival: [6, 9],
    birth: [4, 6, 8, 9],
    states: 10,
    init: { radiusCells: 7, density: 0.3 }
  },
  'crystal': {
    survival: [0,1,2,3,4,5,6],
    birth: [1, 3],
    states: 2,
    neighborhood: 'von-neumann',
    init: { radiusCells: 1, density: 1.0 }
  },
  'crystal2': {
    survival: [1, 2, 3],
    birth: [1, 2, 3],
    states: 5,
    neighborhood: 'von-neumann',
    init: { radiusCells: 1, density: 1.0 }
  },
  'clouds': {
    survival: [13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    birth: [13,14,17,18,19],
    states: 2,
    init: { radiusCells: 0, density: 0.5 }
  },
  'slow-decay': {
    survival: [8,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    birth: [13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    states: 5,
    init: { radiusCells: 0, density: 0.5 }
  },
  'spiky': {
    survival: [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    birth: [4, 12, 13, 15],
    states: 10,
    init: { radiusCells: 7, density: 0.4 }
  },
  'ripple': {
    survival: [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26],
    birth: [4, 12, 13, 15],
    states: 10,
    init: { radiusCells: 10, density: 0.5, shape: 'cube', recommendedGridSize: 50 }
  },
  'coral': {
    survival: [5, 6, 7, 8],
    birth: [6, 7, 9, 12],
    states: 4,
    init: { radiusCells: 6, density: 0.35 }
  },
  'pyroclastic': {
    survival: [4, 5, 6, 7],
    birth: [6, 7, 8],
    states: 10,
    init: { radiusCells: 5, density: 0.2 }
  },
  '678': {
    survival: [6, 7, 8],
    birth: [6, 7, 8],
    states: 3,
    init: { radiusCells: 5, density: 0.35 }
  }
};
