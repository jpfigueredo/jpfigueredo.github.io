# 🚀 Plano de Migração: Canvas 2D → Three.js

## Objetivo

Migrar a timeline de Canvas 2D para **Three.js** para alcançar qualidade visual de nível **Skyrim** mantendo performance e bundle size razoáveis.

---

## 📋 Fase 1: Setup Inicial (1-2 horas)

### 1.1 Instalar Dependências

```bash
cd web
yarn add three
yarn add -D @types/three
```

### 1.2 Criar Renderer Three.js Básico

Criar `web/src/components/timeline/engine/three-renderer.ts`:

```typescript
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class TimelineThreeRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent
    
    // Orthographic camera (2D-like, mas com profundidade)
    const aspect = width / height;
    this.camera = new THREE.OrthographicCamera(
      -width / 2, width / 2,
      height / 2, -height / 2,
      0.1, 1000
    );
    this.camera.position.z = 100;
    
    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Post-processing pipeline (para bloom, glow, atmosfera)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    // Bloom pass para glow atmosférico (estilo Skyrim)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);
    
    // Output pass (tone mapping, etc.)
    this.composer.addPass(new OutputPass());
  }

  resize(width: number, height: number) {
    const aspect = width / height;
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
    this.composer.dispose();
  }
}
```

---

## 📋 Fase 2: Cometa com Qualidade Skyrim (2-3 horas)

### 2.1 Criar Material PBR para Cometa

```typescript
// web/src/components/timeline/engine/comet-three.ts
import * as THREE from 'three';
import { TextureLoader } from 'three';

export class CometThree {
  private mesh: THREE.Mesh;
  private tailParticles: THREE.Points;
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene, x: number, y: number, time: number) {
    this.scene = scene;
    
    // Geometry: esfera com mais detalhes (32x32 segments)
    const geometry = new THREE.SphereGeometry(4.5, 32, 32);
    
    // Material PBR (Physically Based Rendering) - estilo Skyrim
    const loader = new TextureLoader();
    
    // Criar texturas programaticamente ou carregar
    const cometMaterial = new THREE.MeshStandardMaterial({
      // Base color: marrom escuro/carvão
      color: new THREE.Color(0x2a1e14),
      
      // Normal map para relevo/superfície irregular (opcional, pode gerar proceduralmente)
      // normalMap: loader.load('/textures/comet-normal.jpg'),
      
      // Roughness: superfície rochosa não polida
      roughness: 0.85,
      metalness: 0.1,
      
      // Emissive: brilho interno/quente (lado iluminado pelo sol)
      emissive: new THREE.Color(0xffaa44),
      emissiveIntensity: 0.3,
      
      // Ambiente
      envMapIntensity: 0.5
    });
    
    this.mesh = new THREE.Mesh(geometry, cometMaterial);
    this.mesh.position.set(x, -y, 0); // Inverter Y para coordenadas canvas
    
    // Adicionar ao scene
    scene.add(this.mesh);
    
    // Cauda de partículas (ion tail + dust tail)
    this.createParticleTail(x, y);
  }
  
  private createParticleTail(x: number, y: number) {
    const particleCount = 100;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    // Ion tail particles (azul/ciano, menores, retos)
    for (let i = 0; i < particleCount / 2; i++) {
      const t = i / (particleCount / 2);
      positions[i * 3] = x + 140 * t; // Horizontal (futuro)
      positions[i * 3 + 1] = -y + (Math.random() - 0.5) * 8; // Pequeno spread vertical
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
      
      // Cor azul/ciano
      colors[i * 3] = 0.6;     // R
      colors[i * 3 + 1] = 0.8; // G
      colors[i * 3 + 2] = 1.0; // B
      
      sizes[i] = 1.5 + Math.random() * 1.0;
    }
    
    // Dust tail particles (amarelo/branco, maiores, curvas)
    for (let i = particleCount / 2; i < particleCount; i++) {
      const t = (i - particleCount / 2) / (particleCount / 2);
      const curve = -18 * t * t; // Curva para cima
      positions[i * 3] = x + 120 * t;
      positions[i * 3 + 1] = -y + curve + (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      
      // Cor amarelo/branco
      colors[i * 3] = 1.0;     // R
      colors[i * 3 + 1] = 0.95; // G
      colors[i * 3 + 2] = 0.8; // B
      
      sizes[i] = 2.0 + Math.random() * 2.0;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Material de partículas
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending, // Glow effect
      sizeAttenuation: true
    });
    
    this.tailParticles = new THREE.Points(geometry, material);
    scene.add(this.tailParticles);
  }
  
  update(time: number) {
    // Animar partículas (movimento, fade, etc.)
    const positions = this.tailParticles.geometry.attributes.position.array as Float32Array;
    const colors = this.tailParticles.geometry.attributes.color.array as Float32Array;
    
    for (let i = 0; i < positions.length / 3; i++) {
      // Animar posição das partículas (movimento horizontal)
      const speed = 0.5;
      positions[i * 3] += speed * Math.sin(time + i) * 0.1;
      
      // Animar cor (fade out ao longe)
      const distance = (i / (positions.length / 3)) * 1.2;
      const alpha = Math.max(0, 1 - distance);
      colors[i * 3 + 3] = alpha; // Usar alpha no material
    }
    
    this.tailParticles.geometry.attributes.position.needsUpdate = true;
    this.tailParticles.geometry.attributes.color.needsUpdate = true;
    
    // Rotação sutil do núcleo
    this.mesh.rotation.y += 0.001;
  }
  
  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.tailParticles.geometry.dispose();
    (this.tailParticles.material as THREE.Material).dispose();
    this.scene.remove(this.mesh);
    this.scene.remove(this.tailParticles);
  }
}
```

### 2.2 Integrar no Renderer Principal

```typescript
// Modificar renderer.ts para usar Three.js quando disponível
import { TimelineThreeRenderer } from './three-renderer';
import { CometThree } from './comet-three';

// Adicionar flag para escolher renderer
const USE_THREEJS = true;

if (USE_THREEJS) {
  const threeRenderer = new TimelineThreeRenderer(canvas, width, height);
  const comet = new CometThree(threeRenderer.scene, endX, baselineY, time);
  // ... resto da timeline ainda em Canvas 2D ou migrar gradualmente
}
```

---

## 📋 Fase 3: Estrelas com Glow Realista (2-3 horas)

### 3.1 Sistema de Estrelas Three.js

```typescript
// web/src/components/timeline/engine/stars-three.ts
import * as THREE from 'three';

export class StarsThree {
  private stars: THREE.Points;
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene, nodes: Node[], positions: Map<number, {x: number, y: number}>) {
    this.scene = scene;
    
    const starCount = nodes.length;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    
    nodes.forEach((node, i) => {
      const pos = positions.get(i);
      if (!pos) return;
      
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = -pos.y; // Inverter Y
      positions[i * 3 + 2] = 0;
      
      // Cor baseada no tipo/tags
      if (node.tags?.includes('ai')) {
        colors[i * 3] = 0.0;     // Cyan
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0;     // White
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }
      
      sizes[i] = 4 + Math.random() * 2;
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Material com glow (usando shader custom ou AdditiveBlending)
    const material = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      // Shader custom para glow circular (opcional)
    });
    
    this.stars = new THREE.Points(geometry, material);
    scene.add(this.stars);
  }
  
  update(selectedIndex: number | null) {
    // Destacar estrela selecionada (aumentar size, glow)
    const sizes = this.stars.geometry.attributes.size.array as Float32Array;
    
    // Reset todos
    for (let i = 0; i < sizes.length; i++) {
      sizes[i] = 4 + Math.random() * 2;
    }
    
    // Destacar selecionada
    if (selectedIndex !== null) {
      sizes[selectedIndex] = 12; // Muito maior
    }
    
    this.stars.geometry.attributes.size.needsUpdate = true;
  }
}
```

---

## 📋 Fase 4: Baseline/Timeline com Qualidade (1-2 horas)

### 4.1 Timeline como Mesh 3D

```typescript
// Baseline como linha 3D com glow
const baselineGeometry = new THREE.BufferGeometry();
const points = [
  new THREE.Vector3(startX, -baselineY, 0),
  new THREE.Vector3(endX, -baselineY, 0)
];
baselineGeometry.setFromPoints(points);

// Material com gradiente e glow
const baselineMaterial = new THREE.LineBasicMaterial({
  color: 0x00f0ff,
  linewidth: 2,
  transparent: true,
  opacity: 0.8
});

// Criar linha com gradiente custom (shader)
const baseline = new THREE.Line(baselineGeometry, baselineMaterial);
scene.add(baseline);
```

---

## 📊 Estimativa de Implementação

| Fase | Tempo | Complexidade | Impacto Visual |
|------|-------|--------------|----------------|
| Setup Three.js | 1-2h | ⭐⭐ | - |
| Cometa PBR | 2-3h | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Estrelas Glow | 2-3h | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Baseline 3D | 1-2h | ⭐⭐ | ⭐⭐⭐ |
| Post-processing | 1h | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Total** | **7-11h** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Resultado Esperado

Após a migração, você terá:

1. ✅ **Cometa**: Material PBR realista com normal maps, emissive glow, partículas avançadas
2. ✅ **Estrelas**: Glow realista com bloom, cores dinâmicas, tamanhos variáveis
3. ✅ **Timeline**: Linha com gradiente suave, glow atmosférico
4. ✅ **Atmosfera**: Post-processing (bloom, tone mapping) para qualidade cinematográfica
5. ✅ **Performance**: 60 FPS mantido, bundle ~600KB adicional

---

## 🚀 Quick Start: Prova de Conceito

Para testar rapidamente, podemos criar um componente isolado do cometa em Three.js e integrá-lo ao canvas 2D atual, mantendo a timeline em Canvas 2D por enquanto.

Isso permite:
- ✅ Validar qualidade visual
- ✅ Testar performance
- ✅ Migração incremental (sem quebrar funcionalidades)
- ✅ Comparar lado a lado (Canvas 2D vs Three.js)

