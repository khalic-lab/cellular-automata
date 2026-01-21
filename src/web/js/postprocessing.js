/**
 * postprocessing.js - Post-Processing Effects Manager
 *
 * Contains:
 * - PostEffect enum
 * - PostProcessingManager class with bloom, SSAO, and FXAA
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const PostEffect = {
  NONE: 'none',
  BLOOM: 'bloom',
  SSAO: 'ssao',
  BLOOM_SSAO: 'bloom+ssao'
};

export class PostProcessingManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create effect composer
    this.composer = new EffectComposer(renderer);

    // Render pass (always first)
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.5,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    this.bloomPass.enabled = false;

    // SSAO pass
    this.ssaoPass = new SSAOPass(scene, camera, width, height);
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.005;
    this.ssaoPass.maxDistance = 0.1;
    this.ssaoPass.enabled = false;

    // FXAA pass (antialiasing - always at the end)
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
    this.fxaaPass.enabled = true;

    // Output pass (for correct color space)
    this.outputPass = new OutputPass();

    this.currentEffect = PostEffect.NONE;

    // Build initial pass chain
    this.rebuildPassChain();
  }

  rebuildPassChain() {
    // Clear all passes except render pass
    this.composer.passes = [];
    this.composer.addPass(this.renderPass);

    // Add effect passes based on current setting
    switch (this.currentEffect) {
      case PostEffect.BLOOM:
        this.bloomPass.enabled = true;
        this.ssaoPass.enabled = false;
        this.composer.addPass(this.bloomPass);
        break;

      case PostEffect.SSAO:
        this.bloomPass.enabled = false;
        this.ssaoPass.enabled = true;
        this.composer.addPass(this.ssaoPass);
        break;

      case PostEffect.BLOOM_SSAO:
        this.bloomPass.enabled = true;
        this.ssaoPass.enabled = true;
        this.composer.addPass(this.ssaoPass);
        this.composer.addPass(this.bloomPass);
        break;

      case PostEffect.NONE:
      default:
        this.bloomPass.enabled = false;
        this.ssaoPass.enabled = false;
        break;
    }

    // Always add FXAA at the end (before output)
    this.composer.addPass(this.fxaaPass);
    this.composer.addPass(this.outputPass);
  }

  setEffect(effect) {
    if (this.currentEffect === effect) return;
    this.currentEffect = effect;
    this.rebuildPassChain();
  }

  getEffect() {
    return this.currentEffect;
  }

  // Bloom settings
  setBloomStrength(strength) {
    this.bloomPass.strength = strength;
  }

  getBloomStrength() {
    return this.bloomPass.strength;
  }

  setBloomRadius(radius) {
    this.bloomPass.radius = radius;
  }

  getBloomRadius() {
    return this.bloomPass.radius;
  }

  setBloomThreshold(threshold) {
    this.bloomPass.threshold = threshold;
  }

  getBloomThreshold() {
    return this.bloomPass.threshold;
  }

  // SSAO settings
  setSSAORadius(radius) {
    this.ssaoPass.kernelRadius = radius;
  }

  getSSAORadius() {
    return this.ssaoPass.kernelRadius;
  }

  setSSAOMinDistance(distance) {
    this.ssaoPass.minDistance = distance;
  }

  setSSAOMaxDistance(distance) {
    this.ssaoPass.maxDistance = distance;
  }

  // FXAA toggle
  setFXAAEnabled(enabled) {
    this.fxaaPass.enabled = enabled;
  }

  // Render
  render() {
    this.composer.render();
  }

  // Handle resize
  resize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.ssaoPass.setSize(width, height);
    this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
  }

  // Check if any effect is active
  hasActiveEffect() {
    return this.currentEffect !== PostEffect.NONE;
  }

  // Direct renderer access for when no effects are needed
  renderDirect() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer.passes.forEach(pass => {
      if (pass.dispose) pass.dispose();
    });
  }
}
