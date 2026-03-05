# 🚀 Guia de Performance e Arquitetura - Three.js e Visualizações Web

## 🎯 Melhorias Recentes Implementadas

### ✅ Performance
- **Inicialização Progressiva**: Objetos criados em múltiplos frames (5 frames) para evitar lag inicial
- **Object Pooling**: Reutilização de objetos Three.js (não recria a cada frame)
- **Throttling de FPS**: Loop de animação limitado a 60 FPS
- **requestIdleCallback**: Primeira renderização usa idle time do browser
- **Bloom Reduzido**: Post-processing mais leve (strength: 0.8, radius: 0.3)

### ✅ Seleção de Nós
- **Raycaster Melhorado**: Hit testing preciso com fallback manual
- **Hit Radius Generoso**: 15px para facilitar clique
- **Prevenção de Pan**: Não inicia pan se clicando em nó

### ✅ Fundo Realista
- **Textura Procedural**: Base criada programaticamente (instantânea)
- **Imagens NASA**: Carregamento assíncrono após primeiro render (Hubble Deep Field)
- **Blend Realista**: 30% NASA + 70% procedural para melhor qualidade
- **Camadas Astronômicas**: Estrelas distantes, nebulosas, nuvens de gás, granulação

## 📚 Referências de Estudo Essenciais

### 1. Performance WebGL/Three.js (Obrigatório)

#### **Three.js Oficial**
- **Performance Tips**: https://threejs.org/manual/#en/fundamentals/performance
  - ✅ Como otimizar geometrias
  - ✅ Object pooling
  - ✅ Instanced rendering
  - ✅ Frustum culling
  - ✅ Texture optimization

#### **WebGL Performance (Base)**
- **WebGL Best Practices**: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
  - ✅ Minimizar draw calls
  - ✅ Buffer management
  - ✅ Shader optimization

#### **Three.js Advanced Techniques**
- **Three.js Examples**: https://threejs.org/examples/
  - Buscar exemplos com "instanced", "performance", "optimization"
  - Exemplos práticos de técnicas avançadas

#### **Artigos Especializados**
1. **"Optimizing 3D Graphics for the Web"** (Google I/O)
   - Buscar: "google webgl optimization"
   - Foco em: draw calls, batching, instancing

2. **"Three.js Performance Patterns"** (Discrete Structures)
   - Buscar: "three.js performance patterns site:discretegames.com"
   - Object pooling, geometry reuse

3. **"WebGL Insights"** (Livro - capítulos gratuitos online)
   - Buscar: "webgl insights book"
   - Técnicas avançadas de otimização

### 2. Arquitetura de Software para Performance

#### **Patterns de Performance**
- **Object Pool Pattern**: Reutilizar objetos em vez de criar/destruir
  - Referência: "Game Programming Patterns" (gratuito online)
  - Capítulo: Object Pool
  
- **Data-Oriented Design (DOD)**:
  - Buscar: "data oriented design web performance"
  - Organizar dados para cache efficiency

- **Lazy Loading & Code Splitting**:
  - Vite: https://vitejs.dev/guide/features.html#async-chunk-loading-optimization
  - React lazy loading

#### **Separação de Serviços (Backend/Frontend)**

##### **Quando Separar:**
✅ **SIM, separar quando:**
- Processamento pesado (análise de dados, IA, busca semântica)
- Dados grandes que precisam agregação/filtragem
- Cache complexo (Redis, etc.)
- Autenticação/autorização
- Rate limiting

❌ **NÃO separar quando:**
- Renderização visual (Three.js roda no cliente)
- Interações UI simples
- Dados pequenos (< 1MB)
- Visualizações puramente client-side

##### **Arquitetura Recomendada para Seu Caso:**

```
┌─────────────────────────────────────────┐
│  Frontend (React + Three.js)           │
│  - Renderização visual (GPU)           │
│  - Interações UI                       │
│  - Timeline rendering                  │
└──────────────┬──────────────────────────┘
               │ HTTP/REST ou GraphQL
               ▼
┌─────────────────────────────────────────┐
│  BFF (Backend for Frontend)            │
│  - Busca semântica (OpenSearch)        │
│  - Agregação de dados                  │
│  - Cache de fontes primárias           │
│  - Validação de links                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Database (PostgreSQL)                 │
│  - Nodes, edges, metadados             │
└─────────────────────────────────────────┘
```

**Por que esta arquitetura:**
- ✅ Frontend focado em **renderização** (GPU-bound, não CPU)
- ✅ BFF faz **processamento pesado** (busca, agregação)
- ✅ Separação clara de responsabilidades
- ✅ Performance: frontend leve, backend escalável

### 3. Otimização de Renderização Three.js

#### **Checklist de Otimização:**

```typescript
// ✅ 1. Object Pooling (JÁ IMPLEMENTADO)
// Reutilizar objetos em vez de criar/destruir

// ✅ 2. Geometry Reuse
const sharedGeometry = new THREE.SphereGeometry(4, 16, 16);
// Reusar para múltiplos objetos

// ✅ 3. Material Reuse
const sharedMaterial = new THREE.PointsMaterial({ /* ... */ });
// Reusar para múltiplos objetos

// ✅ 4. Instanced Rendering (PARA MUITOS OBJETOS)
const instancedMesh = new THREE.InstancedMesh(
  geometry, 
  material, 
  nodeCount
);
// Renderiza 1000+ objetos em 1 draw call

// ✅ 5. Frustum Culling (automático no Three.js)
// Só renderiza o que está visível

// ✅ 6. LOD (Level of Detail)
// Modelos mais simples quando distantes

// ✅ 7. Texture Optimization
// - Compressão (Basis Universal, KTX2)
// - Mipmaps automáticos
// - Formatos apropriados (WebP, AVIF)

// ✅ 8. Draw Call Batching
// Minimizar número de draw calls
// Combinar meshes quando possível
```

### 4. Monitoramento de Performance

#### **Ferramentas:**

1. **Chrome DevTools Performance Tab**
   - Profile rendering
   - Identify bottlenecks
   - Frame rate analysis

2. **Stats.js** (Three.js)
   ```bash
   yarn add stats.js
   ```
   ```typescript
   import Stats from 'stats.js';
   const stats = new Stats();
   document.body.appendChild(stats.dom);
   
   function animate() {
     stats.begin();
     renderer.render(scene, camera);
     stats.end();
     requestAnimationFrame(animate);
   }
   ```

3. **WebGPU Inspector** (futuro)
   - Para migração WebGPU

4. **Lighthouse** (Performance audits)
   - Core Web Vitals
   - Bundle size analysis

### 5. Code Splitting & Lazy Loading

#### **Vite Code Splitting:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-postprocessing': [
            'three/examples/jsm/postprocessing/EffectComposer.js',
            'three/examples/jsm/postprocessing/UnrealBloomPass.js'
          ],
          'three-helpers': [
            'three/examples/jsm/helpers/*'
          ]
        }
      }
    }
  }
});
```

**Benefícios:**
- Three.js carregado apenas quando necessário
- Post-processing carregado sob demanda
- Reduz bundle inicial

### 6. Arquitetura de Separação de Serviços

#### **Decisão: Separar ou Não?**

**Para SEU caso (timeline interativa):**

##### ✅ **NÃO separar (manter tudo no frontend):**
- ✅ Renderização visual (Three.js roda na GPU do cliente)
- ✅ Dados pequenos (7 nodes no seed.json)
- ✅ Interações em tempo real
- ✅ Melhor latência (sem round-trip para servidor)

**EXCETO para:**
- Busca semântica (quando dataset crescer > 100 nodes)
- Validação de links (background job)
- Agregação de estatísticas complexas

##### ✅ **SIM separar (BFF) quando:**
- Dataset > 100 nodes (busca precisa ser server-side)
- Busca semântica com OpenSearch/Elasticsearch
- Validação de links em background
- Analytics e métricas

#### **Arquitetura Híbrida Recomendada:**

```
┌─────────────────────────────────────────────────┐
│  Frontend (React + Three.js)                   │
│  - Renderização visual                         │
│  - Interações (pan, zoom, hover)               │
│  - Dataset pequeno (< 100 nodes): client-side  │
│  - Dataset grande (> 100): busca no BFF        │
└──────────────┬──────────────────────────────────┘
               │
               │ (apenas quando necessário)
               ▼
┌─────────────────────────────────────────────────┐
│  BFF (Go/Java)                                 │
│  - Busca semântica (OpenSearch)                │
│  - Validação de links (background)             │
│  - Agregação de dados                          │
│  - Cache Redis                                 │
└─────────────────────────────────────────────────┘
```

### 7. Referências Específicas de Estudo

#### **Livros Recomendados:**

1. **"Real-Time Rendering"** (Möller, Haines, Hoffman)
   - Capítulos 19-21: Optimization
   - Capítulo 22: Graphics Hardware
   - **Onde:** Bibliotecas acadêmicas, Google Books preview

2. **"WebGL Programming Guide"** (Matsuda, Lea)
   - Capítulo 15: Performance Optimization
   - **Onde:** O'Reilly Learning, bibliotecas

3. **"Game Programming Patterns"** (Nystrom) - GRATUITO
   - https://gameprogrammingpatterns.com/
   - Pattern: Object Pool, Data Locality

#### **Cursos Online:**

1. **Three.js Journey** (Bruno Simon)
   - https://threejs-journey.com/
   - Seção: Performance Optimization
   - **Custo:** ~$95 (mas vale muito a pena)

2. **WebGL Fundamentals** (Gregg Tavares) - GRATUITO
   - https://webglfundamentals.org/
   - Performance tips e best practices

3. **MDN WebGL Tutorial**
   - https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial
   - Fundamentos + performance

#### **Artigos Técnicos:**

1. **"Optimizing WebGL Applications"** (Intel Developer Zone)
   - Buscar: "intel webgl optimization"
   - Foco em: mobile performance

2. **"Three.js Performance Tips"** (Various blogs)
   - Buscar: "three.js performance tips site:medium.com"
   - Artigos práticos da comunidade

3. **"WebGPU vs WebGL"** (preparação futura)
   - https://webgpufundamentals.org/
   - Próximo passo após dominar WebGL

### 8. Técnicas Específicas para Seu Caso

#### **Otimizações Já Implementadas:**
✅ Object pooling (cache de objetos)
✅ Geometry reuse
✅ Material reuse
✅ Reduced particle count
✅ Limited constellation connections

#### **Próximas Otimizações a Implementar:**

##### **A. Instanced Rendering para Estrelas**
```typescript
// Para 100+ estrelas, use InstancedMesh
const instancedStars = new THREE.InstancedMesh(
  starGeometry,
  starMaterial,
  nodeCount
);

// Update positions via matrix
for (let i = 0; i < nodeCount; i++) {
  const matrix = new THREE.Matrix4();
  matrix.setPosition(starPositions[i]);
  instancedStars.setMatrixAt(i, matrix);
}
instancedStars.instanceMatrix.needsUpdate = true;
```
**Benefício:** 1000 estrelas = 1 draw call (vs 1000 draw calls)

##### **B. Frustum Culling Manual**
```typescript
// Só renderizar estrelas visíveis
const frustum = new THREE.Frustum();
frustum.setFromProjectionMatrix(camera.projectionMatrix);
// Filtrar objetos fora do frustum
```

##### **C. LOD (Level of Detail)**
```typescript
// Estrelas distantes: menor resolução
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);    // < 100 unidades
lod.addLevel(mediumDetailMesh, 50);  // < 200 unidades
lod.addLevel(lowDetailMesh, 100);    // >= 200 unidades
```

##### **D. Texture Atlasing**
```typescript
// Combinar múltiplas texturas em uma (atlas)
// Reduz texture switches
```

##### **E. Occlusion Culling**
```typescript
// Não renderizar objetos ocultos por outros
// Usar THREE.Occlusion (experimental)
```

### 9. Separação de Serviços: Análise de Trade-offs

#### **Performance GUI vs Backend:**

| Aspecto | Tudo no Frontend | Frontend + BFF |
|---------|------------------|----------------|
| **Latência UI** | 0ms (instantâneo) | +50-200ms (network) |
| **Renderização** | GPU (rápida) | GPU (rápida) |
| **Busca Complexa** | Lenta (JS single-threaded) | Rápida (backend paralelo) |
| **Escalabilidade** | Limitada (cliente) | Ilimitada (servidor) |
| **Custo** | $0 (GitHub Pages) | $10-50/mês (Cloud Run) |

#### **Recomendação para Seu Caso:**

**Fase Atual (< 100 nodes):**
- ✅ **Manter tudo no frontend**
- ✅ Otimizar Three.js
- ✅ Usar client-side search (MiniSearch/Lunr)

**Fase Futura (> 100 nodes):**
- ✅ **Adicionar BFF** para:
  - Busca semântica (OpenSearch)
  - Validação de links (background jobs)
  - Analytics

**Arquitetura Escalonável:**
```
Frontend (React + Three.js)
  ├─ Dataset pequeno: client-side rendering
  ├─ Dataset grande: fetch do BFF + client-side rendering
  └─ Interações: sempre client-side (GPU)

BFF (Go/Java + OpenSearch)
  ├─ Busca semântica
  ├─ Validação de links (async)
  └─ Agregação de dados
```

### 10. Plano de Aprendizado Recomendado

#### **Semana 1-2: Fundamentos**
1. Ler "Three.js Performance Tips" (oficial)
2. Estudar WebGL Best Practices (MDN)
3. Implementar Stats.js para monitorar FPS
4. Aplicar object pooling no código atual

#### **Semana 3-4: Técnicas Avançadas**
1. Estudar Instanced Rendering
2. Implementar LOD para estrelas
3. Otimizar texturas (compression, atlasing)
4. Aplicar frustum culling manual

#### **Semana 5-6: Arquitetura**
1. Ler "Game Programming Patterns" (Object Pool, Data Locality)
2. Estudar code splitting com Vite
3. Decidir sobre separação de serviços
4. Implementar lazy loading se necessário

#### **Semana 7-8: Produção**
1. Profile com Chrome DevTools
2. Otimizar bundle size
3. Implementar métricas de performance
4. Testar em dispositivos móveis

### 11. Recursos Adicionais

#### **Comunidades:**
- **Three.js Discourse**: https://discourse.threejs.org/
  - Perguntas de performance
  - Exemplos da comunidade

- **WebGL Slack**: Buscar "webgl slack"
  - Discussões técnicas

- **r/threejs** (Reddit)
  - Dicas e truques

#### **Ferramentas:**
- **glTF Inspector**: https://gltf-viewer.donmccurdy.com/
  - Analisar modelos 3D

- **WebGL Inspector** (Chrome Extension)
  - Debugging WebGL

- **RenderDoc**: Para análise profunda (desktop)

### 12. Referências NASA para Fundos Astronômicos

#### **Imagens Públicas da NASA (Domínio Público):**

1. **NASA Image and Video Library**
   - URL: https://images.nasa.gov/
   - Buscar: "nebula", "hubble deep field", "galaxy"
   - **Licença**: Domínio público (livre para uso comercial)

2. **Hubble Space Telescope Images**
   - URL: https://hubblesite.org/
   - Galeria de imagens em alta resolução
   - Exemplos:
     - Hubble Ultra Deep Field: https://hubblesite.org/image/3882
     - Orion Nebula: https://hubblesite.org/image/3981
     - Carina Nebula: https://hubblesite.org/image/3865

3. **Wikimedia Commons (NASA)**
   - URL: https://commons.wikimedia.org/wiki/Category:NASA_images
   - Imagens hospedadas e otimizadas
   - Exemplo usado: Hubble Ultra Deep Field 2014

#### **Como Usar Imagens da NASA:**

```typescript
// Exemplo de carregamento
const nasaImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/2014_Hubble_Ultra_Deep_Field_%28full_resolution%29.png';

const loader = new THREE.TextureLoader();
loader.load(nasaImageUrl, (texture) => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  scene.background = texture;
});
```

**Importante:**
- ✅ Todas as imagens da NASA são **domínio público**
- ✅ Pode usar comercialmente sem atribuição (mas é ético dar crédito)
- ✅ Use CORS habilitado ou proxy se necessário
- ✅ Carregue assincronamente após primeiro render para evitar lag

#### **Alternativas para Fundos Astronômicos:**

1. **Procedural Generation** (atual)
   - Vantagem: Sem latência de rede
   - Desvantagem: Menos realista que fotos reais

2. **NASA API** (futuro)
   - https://api.nasa.gov/
   - Permite buscar imagens dinamicamente
   - Requer API key (gratuita)

3. **Shaders Customizados**
   - GLSL shaders para nebulosas procedurais
   - Mais performance que texturas grandes
   - Exemplo: Noise-based nebula shader

### 13. Decisões Arquiteturais: Checklist

#### **Quando Separar Serviços?**

✅ **SIM, se:**
- [ ] Dataset > 100 nodes (busca precisa de backend)
- [ ] Processamento pesado (IA, análise)
- [ ] Validação de links em background
- [ ] Analytics complexas
- [ ] Rate limiting necessário

❌ **NÃO, se:**
- [x] Dataset < 100 nodes (atual: 7 nodes)
- [x] Renderização visual (GPU-bound)
- [x] Interações em tempo real
- [x] Performance UI crítica

#### **Para Seu Caso Específico:**

**Agora (< 100 nodes):**
- ✅ Tudo no frontend
- ✅ Otimizar Three.js
- ✅ Code splitting opcional

**Futuro (> 100 nodes):**
- ✅ Adicionar BFF para busca
- ✅ Frontend continua renderizando
- ✅ BFF faz processamento pesado

---

## 🎯 Próximos Passos Imediatos

1. **Monitorar Performance:**
   ```bash
   yarn add stats.js
   ```
   Adicionar Stats.js para ver FPS em tempo real

2. **Profile no Chrome:**
   - Abrir DevTools → Performance
   - Gravar interação
   - Identificar bottlenecks

3. **Otimizar Texturas:**
   - Reduzir tamanho de texturas
   - Usar formatos comprimidos

4. **Implementar Instanced Rendering:**
   - Para estrelas quando > 50 nodes
   - Reduz draw calls drasticamente

5. **Lazy Load Post-Processing:**
   - Carregar bloom apenas se necessário
   - Code split Three.js

---

**TL;DR:** 
- **Performance:** Foque em Three.js optimization (object pooling, instancing, LOD)
- **Arquitetura:** Mantenha frontend agora, adicione BFF quando dataset crescer
- **Estudo:** Comece com Three.js oficial docs + "Game Programming Patterns" (gratuito)

