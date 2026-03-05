import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Node, Edge, Transform } from '../types';
import type { SearchMode } from '../SearchBar';
import type { LayoutConfig } from './layout';
import { yearOf } from '../utils';


export class TimelineThreeRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private canvas: HTMLCanvasElement;
  private enableBloom: boolean = false; // Bloom disabled by default for performance

  // Scene objects (disposed on cleanup)
  private backgroundMesh?: THREE.Mesh;
  private gridLines?: THREE.LineSegments;
  private baselineGroup?: THREE.Group;
  private cometMesh?: THREE.Mesh;
  private cometParticles?: THREE.Points;
  private starsGroup?: THREE.Group;
  private edgesGroup?: THREE.Group;
  private constellationLines?: THREE.LineSegments;

  // Background animation state
  private lastRenderTime = performance.now();
  private bgScrollSpeed = { x: 0.00003, y: 0.00002 };
  private bgParallax = 0.1; // fraction of camera movement

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    
    // Scene setup
    this.scene = new THREE.Scene();
    
    // Use pure black background (nebula will be a mesh behind everything)
    this.scene.background = new THREE.Color(0x000000);
    
    // Create background mesh with nebula texture (low opacity, behind everything)
    this.createBackgroundMesh(width, height);
    
    // Subtle grid overlay for composition
    this.createGridOverlay(width, height, 80);
    
    // Orthographic camera (2D-like view, but with 3D capabilities)
    const aspect = width / height;
    this.camera = new THREE.OrthographicCamera(
      -width / 2, width / 2,
      height / 2, -height / 2,
      0.1, 10000
    );
    this.camera.position.z = 1000;
    this.camera.up.set(0, -1, 0); // Invert Y axis (canvas coordinates)
    // Sort objects by renderOrder for proper layering
    this.camera.layers.enableAll();
    
    // WebGL renderer with performance-optimized settings
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false, // Opaque for better performance
      antialias: false, // Disabled for better performance
      powerPreference: 'high-performance',
      precision: 'mediump', // Medium precision for better performance
      logarithmicDepthBuffer: false, // Disabled for better performance
      stencil: false, // Disable stencil buffer (not needed)
      depth: true, // Keep depth buffer for 3D objects
    });
    
    // Disable automatic clearing - we control when to render
    this.renderer.autoClear = false;
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Lower pixel ratio for better performance and consistent sizes
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Post-processing disabled by default for better performance
    // Can be re-enabled via enablePostProcessing() if needed
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Output pass only (no bloom for better performance)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
    
    // Ambient lighting (subtle, for PBR materials)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    // Directional light from left (sun direction for comet)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(-1000, 0, 500);
    this.scene.add(directionalLight);
  }

  resize(width: number, height: number) {
    const aspect = width / height;
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    
    // Update background mesh size on resize
    if (this.backgroundMesh) {
      this.scene.remove(this.backgroundMesh);
      if (this.backgroundMesh.material instanceof THREE.MeshBasicMaterial) {
        this.backgroundMesh.material.map?.dispose();
        this.backgroundMesh.material.dispose();
      }
      this.backgroundMesh.geometry.dispose();
    }
    this.createBackgroundMesh(width, height);

    // Update grid overlay size
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.LineBasicMaterial).dispose();
      this.gridLines = undefined;
    }
    this.createGridOverlay(width, height, 80);
  }

  applyTransform(transform: Transform, canvasWidth: number, height: number) {
    // Apply pan/zoom transform
    // Store base dimensions
    const baseWidth = canvasWidth;
    const baseHeight = height;
    
    // Scale: adjust camera bounds
    const scale = transform.scale;
    const scaledWidth = baseWidth / scale;
    const scaledHeight = baseHeight / scale;
    
    this.camera.left = -scaledWidth / 2;
    this.camera.right = scaledWidth / 2;
    this.camera.top = scaledHeight / 2;
    this.camera.bottom = -scaledHeight / 2;
    this.camera.updateProjectionMatrix();
    
    // Pan: adjust camera position (offset is in screen pixels, convert to world)
    // In orthographic, screen offset = world offset / scale
    this.camera.position.x = -transform.offsetX / scale;
    this.camera.position.y = transform.offsetY / scale;
    this.camera.updateMatrixWorld();
  }

  render(context: { transform: Transform; canvasWidth: number; height: number }) {
    // Update transform
    this.applyTransform(context.transform, context.canvasWidth, context.height);
    
    // Background parallax + subtle texture scroll
    const now = performance.now();
    const dt = Math.min(50, now - this.lastRenderTime); // clamp to avoid jumps
    this.lastRenderTime = now;
    if (this.backgroundMesh && this.backgroundMesh.material instanceof THREE.MeshBasicMaterial) {
      const mat = this.backgroundMesh.material;
      const map = mat.map;
      if (map) {
        map.offset.x += this.bgScrollSpeed.x * dt;
        map.offset.y += this.bgScrollSpeed.y * dt;
      }
      // Parallax (moves a fraction of the camera movement)
      this.backgroundMesh.position.x = this.camera.position.x * this.bgParallax;
      this.backgroundMesh.position.y = this.camera.position.y * this.bgParallax;
    }
    
    // Grid follows the camera (no parallax)
    if (this.gridLines) {
      this.gridLines.position.x = this.camera.position.x;
      this.gridLines.position.y = this.camera.position.y;
    }
    
    // Sort objects by renderOrder before rendering
    this.scene.children.sort((a, b) => (a.renderOrder || 0) - (b.renderOrder || 0));
    
    // Render directly without post-processing for better performance
    // Use composer only if bloom is enabled (currently disabled)
    if (this.enableBloom) {
      this.composer.render();
    } else {
      // Direct rendering is faster - no post-processing overhead
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  clearScene() {
    // Remove all timeline objects (but keep background mesh and grid)
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.traverse((child) => {
      if (child.userData.isTimelineObject && child !== this.backgroundMesh && child !== this.gridLines) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      this.scene.remove(obj);
    });
    
    this.baselineGroup = undefined;
    this.cometMesh = undefined;
    this.cometParticles = undefined;
    this.starsGroup = undefined;
    this.edgesGroup = undefined;
    this.constellationLines = undefined;
  }
  
  /**
   * Creates a background mesh with nebula texture at very low opacity (0.2).
   * This mesh is positioned behind all other objects (renderOrder: -1000).
   * The mesh follows camera pan/zoom to stay as a true background.
   */
  private createBackgroundMesh(width: number, height: number): void {
    // Create large plane covering entire viewport (with extra padding for zoom/pan)
    // Use larger size to ensure it covers viewport even when zoomed/panned
    const geometry = new THREE.PlaneGeometry(width * 4, height * 4);
    
    // Create nebula texture (simplified, no white clouds)
    const texture = this.createNebulosaTexture(width, height);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.offset.set(0, 0);
    texture.repeat.set(1, 1);
    
    // Material with low opacity (0.2) - subtle background
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.2, // Very subtle background as requested
      depthWrite: false, // Don't write to depth buffer (always behind)
      depthTest: false, // Don't test depth (always visible)
    });
    
    this.backgroundMesh = new THREE.Mesh(geometry, material);
    // Position at camera plane (z=0) so it moves with camera
    this.backgroundMesh.position.set(0, 0, -1);
    this.backgroundMesh.renderOrder = -1000; // Render first (behind everything)
    this.backgroundMesh.userData.isBackground = true; // Mark as background (not timeline object)
    
    // Make background mesh follow camera (parent to camera or update position in render)
    this.scene.add(this.backgroundMesh);
  }

  /**
   * Creates a subtle grid overlay to help composition and scale perception.
   */
  private createGridOverlay(width: number, height: number, cell: number): void {
    const halfW = width * 2; // larger than viewport to cover during pan
    const halfH = height * 2;
    const vertices: number[] = [];

    // Vertical lines
    for (let x = -halfW; x <= halfW; x += cell) {
      vertices.push(x, -halfH, 0, x, halfH, 0);
    }
    // Horizontal lines
    for (let y = -halfH; y <= halfH; y += cell) {
      vertices.push(-halfW, y, 0, halfW, y, 0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x0a2a33, // dark cyan
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });

    this.gridLines = new THREE.LineSegments(geometry, material);
    this.gridLines.renderOrder = 25; // behind edges/stars, above baseline glow
    this.gridLines.userData.isBackground = true; // don't remove on clearScene
    this.scene.add(this.gridLines);
  }

  /**
   * Creates a procedural nebula texture for background.
   * This texture will be applied to a mesh with low opacity (0.2) to create a subtle space background.
   */
  private createNebulosaTexture(width: number, height: number): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1024, width);
    canvas.height = Math.max(1024, height);
    const ctx = canvas.getContext('2d')!;
    
    // Base: deep space black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Layer 1: Deep space stars (very faint, scattered) - minimal to avoid interference
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Layer 2: Nebula core (Orion-like) - purple/blue (more subtle, no white blobs)
    const nebulaGradient1 = ctx.createRadialGradient(width * 0.3, height * 0.4, 0, width * 0.3, height * 0.4, width * 0.8);
    nebulaGradient1.addColorStop(0, 'rgba(80,60,120,0.15)'); // Softer purple core
    nebulaGradient1.addColorStop(0.4, 'rgba(60,90,150,0.1)'); // Softer blue transition
    nebulaGradient1.addColorStop(0.7, 'rgba(30,50,100,0.05)'); // Softer darker blue
    nebulaGradient1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebulaGradient1;
    ctx.fillRect(0, 0, width, height);
    
    // Layer 3: Second nebula (red/orange like Carina) - opposite side (more subtle)
    const nebulaGradient2 = ctx.createRadialGradient(width * 0.7, height * 0.6, 0, width * 0.7, height * 0.6, width * 0.7);
    nebulaGradient2.addColorStop(0, 'rgba(150,80,60,0.12)'); // Softer orange-red core
    nebulaGradient2.addColorStop(0.4, 'rgba(120,70,100,0.08)'); // Softer pink transition
    nebulaGradient2.addColorStop(0.7, 'rgba(90,40,70,0.04)'); // Softer darker red
    nebulaGradient2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebulaGradient2;
    ctx.fillRect(0, 0, width, height);
    
    // Layer 5: Star field removed - these are handled by the interactive stars (Three.js Points)
    // Background texture should be minimal to not interfere with interactive elements
    
    // Add minimal noise/grain (very subtle)
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Very subtle grain
      const grain = (Math.random() - 0.5) * 1.5;
      data[i] = Math.max(0, Math.min(255, data[i] + grain)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain)); // B
    }
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    // Asynchronously load actual NASA image as replacement (for future enhancement)
    // This would use a NASA public domain image URL
    // Example: https://www.nasa.gov/sites/default/files/styles/full_width/public/thumbnails/image/hubble_nebula.jpg
    // For now, the procedural texture provides a realistic base
    
    return texture;
  }

  // Load actual NASA texture asynchronously (call after initial render to avoid lag)
  async loadNASABackground(width: number, height: number): Promise<void> {
    try {
      // Use NASA's public domain images - Hubble Deep Field or Nebula images
      // NASA images are public domain and can be used freely
      // Using Wikimedia Commons hosting of NASA images for reliability
      
      // Option 1: Hubble Ultra Deep Field (most stars)
      // Option 2: Orion Nebula (colorful)
      // Option 3: Carina Nebula (dramatic colors)
      
      // Using a composited NASA image with multiple layers
      const nasaImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/2014_Hubble_Ultra_Deep_Field_%28full_resolution%29.png';
      
      const loader = new THREE.TextureLoader();
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          nasaImageUrl,
          (tex) => {
            // Adjust texture to fit canvas
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            // Crop/scale to fit
            tex.offset.set(0, 0);
            tex.repeat.set(1, 1);
            tex.anisotropy = 4; // Better quality
            resolve(tex);
          },
          undefined,
          (err) => reject(err)
        );
      });
      
      // Blend NASA image with procedural texture for best of both worlds
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      // Draw NASA image first (faded)
      const nasaCanvas = document.createElement('canvas');
      nasaCanvas.width = width;
      nasaCanvas.height = height;
      const nasaCtx = nasaCanvas.getContext('2d')!;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Draw NASA image scaled and cropped
        nasaCtx.drawImage(img, 0, 0, width, height);
        
        // Composite with procedural texture (30% NASA, 70% procedural)
        ctx.globalAlpha = 0.3;
        ctx.drawImage(nasaCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
        
        // Draw procedural texture on top (70%)
        const proceduralTexture = this.createNebulosaTexture(width, height);
        if (proceduralTexture.image && proceduralTexture.image instanceof HTMLImageElement) {
          ctx.drawImage(proceduralTexture.image, 0, 0);
        } else if (proceduralTexture.image && proceduralTexture.image instanceof HTMLCanvasElement) {
          ctx.drawImage(proceduralTexture.image, 0, 0);
        }
        
        // Update background mesh texture instead of scene.background
        if (this.backgroundMesh && this.backgroundMesh.material instanceof THREE.MeshBasicMaterial) {
          if (this.backgroundMesh.material.map) {
            this.backgroundMesh.material.map.dispose();
          }
          const finalTexture = new THREE.Texture(canvas);
          finalTexture.needsUpdate = true;
          this.backgroundMesh.material.map = finalTexture;
          this.backgroundMesh.material.needsUpdate = true;
        }
      };
      
      img.src = nasaImageUrl;
      
    } catch (e) {
      console.warn('Failed to load NASA background, using procedural texture:', e);
      // Keep procedural texture if NASA image fails to load
    }
  }

  dispose() {
    this.clearScene();
    
    // Dispose background mesh
    if (this.backgroundMesh) {
      this.scene.remove(this.backgroundMesh);
      if (this.backgroundMesh.material instanceof THREE.MeshBasicMaterial) {
        this.backgroundMesh.material.map?.dispose();
        this.backgroundMesh.material.dispose();
      }
      this.backgroundMesh.geometry.dispose();
      this.backgroundMesh = undefined;
    }

    // Dispose grid
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.LineBasicMaterial).dispose();
      this.gridLines = undefined;
    }
    
    if (this.scene.background instanceof THREE.Texture) {
      (this.scene.background as THREE.Texture).dispose();
    }
    this.renderer.dispose();
    this.composer.dispose();
    // Clear cache when renderer is disposed
    if (typeof window !== 'undefined' && (window as any).clearTimelineCache) {
      (window as any).clearTimelineCache();
    }
  }
}

