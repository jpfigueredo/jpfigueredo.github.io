import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';

export type TechCategory = 'frontend' | 'backend' | 'infra' | 'data' | 'mobile';

export type Tech = {
  id: string;
  name: string;
  category: TechCategory;
  description: string;
  tags: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
};

// Static data (BFF fallback)
const TECH_DATA: Tech[] = [
  { id: 'react', name: 'React', category: 'frontend', description: 'Biblioteca declarativa para UIs reativas com component model e virtual DOM.', tags: ['ui', 'hooks', 'jsx', 'typescript'], level: 'advanced', icon: '⚛️' },
  { id: 'angular', name: 'Angular', category: 'frontend', description: 'Framework completo com DI, Signals, Reactive Forms e standalone components.', tags: ['ui', 'typescript', 'rxjs', 'signals'], level: 'intermediate', icon: '🅰' },
  { id: 'typescript', name: 'TypeScript', category: 'frontend', description: 'Superset do JavaScript com tipagem estática, interfaces e generics.', tags: ['types', 'tooling'], level: 'advanced', icon: '📘' },
  { id: 'vite', name: 'Vite', category: 'frontend', description: 'Build tool ultrarrápida com HMR nativo para módulos ES.', tags: ['build', 'tooling'], level: 'intermediate', icon: '⚡' },
  { id: 'rust', name: 'Rust', category: 'backend', description: 'Linguagem de sistemas com ownership model — performance sem GC.', tags: ['systems', 'performance', 'axum'], level: 'intermediate', icon: '🦀' },
  { id: 'go', name: 'Go', category: 'backend', description: 'Linguagem concisa e concorrente da Google, ideal para APIs e microserviços.', tags: ['concurrency', 'http', 'goroutines'], level: 'intermediate', icon: '🐹' },
  { id: 'node', name: 'Node.js', category: 'backend', description: 'Runtime JavaScript para servidores com event loop não-bloqueante.', tags: ['javascript', 'npm', 'express'], level: 'advanced', icon: '🟢' },
  { id: 'kotlin', name: 'Kotlin', category: 'backend', description: 'Kotlin + Spring Boot com coroutines, null-safety e data classes.', tags: ['jvm', 'coroutines', 'spring'], level: 'intermediate', icon: '🎯' },
  { id: 'docker', name: 'Docker', category: 'infra', description: 'Containerização de aplicações com Dockerfile e docker-compose.', tags: ['containers', 'devops'], level: 'advanced', icon: '🐳' },
  { id: 'kubernetes', name: 'Kubernetes', category: 'infra', description: 'Orquestração de containers em escala com pods, services e deployments.', tags: ['orchestration', 'cloud'], level: 'beginner', icon: '☸️' },
  { id: 'github-actions', name: 'GitHub Actions', category: 'infra', description: 'CI/CD nativo do GitHub com workflows YAML e marketplace de actions.', tags: ['ci', 'cd', 'automation'], level: 'advanced', icon: '🔄' },
  { id: 'cloudflare', name: 'Cloudflare Workers', category: 'infra', description: 'Edge computing serverless com V8 runtime, sem cold starts.', tags: ['edge', 'serverless', 'wasm'], level: 'intermediate', icon: '🌐' },
  { id: 'kafka', name: 'Apache Kafka', category: 'data', description: 'Plataforma de streaming distribuído com topics, partitions e consumer groups.', tags: ['streaming', 'distributed', 'messaging'], level: 'beginner', icon: '📨' },
  { id: 'postgresql', name: 'PostgreSQL', category: 'data', description: 'RDBMS open-source com JSONB, full-text search e extensões poderosas.', tags: ['sql', 'database', 'json'], level: 'intermediate', icon: '🐘' },
];

@Injectable({ providedIn: 'root' })
export class TechService {
  constructor(private http: HttpClient) {}

  getTechs(bffUrl?: string): Observable<Tech[]> {
    if (bffUrl) {
      return this.http.get<Tech[]>(`${bffUrl}/api/techs`).pipe(
        catchError(() => of(TECH_DATA))
      );
    }
    return of(TECH_DATA);
  }

  readonly categories = signal<TechCategory[]>(['frontend', 'backend', 'infra', 'data', 'mobile']);
}
