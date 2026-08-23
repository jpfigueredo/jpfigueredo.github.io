import { motion, AnimatePresence } from 'framer-motion';
import type { Trail, TrailNode, Source } from '../types';
import { connections } from '../domain/graph';

function ctaFor(s: Source): { label: string; href: string; kind: string } | null {
  if (s.sourceType === 'free' && s.url) {
    return { label: 'Ler fonte oficial', href: s.url, kind: 'free' };
  }
  if (s.url) {
    return { label: 'Ver na fonte', href: s.url, kind: 'retail' };
  }
  if (s.query) {
    // sem tag de afiliado ainda — vem por config (ADR-0008)
    return {
      label: 'Adquirir na Amazon',
      href: `https://www.amazon.com.br/s?k=${encodeURIComponent(s.query)}`,
      kind: 'retail',
    };
  }
  return null;
}

export function NodeModal({
  node,
  trail,
  onClose,
  onNavigate,
}: {
  node: TrailNode | null;
  trail: Trail;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const label = (id: string) => trail.nodes.find((n) => n.id === id)?.label ?? id;
  const conn = node ? connections(node.id, trail) : { references: [], referencedBy: [] };

  return (
    <AnimatePresence>
      {node ? (
        <motion.div
          className="scrim"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <button className="modal__close" onClick={onClose} aria-label="Fechar">
              ✕
            </button>

            <div className="modal__head">
              <span className="modal__year">{node.year}</span>
              <h2 className="modal__title">{node.label}</h2>
              {node.author ? <p className="modal__author">{node.author}</p> : null}
              {node.tags ? (
                <div className="modal__tags">
                  {node.tags.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {conn.references.length + conn.referencedBy.length > 0 ? (
              <div className="modal__section">
                <h3>Nesta trilha</h3>
                {conn.references.length > 0 ? (
                  <p className="modal__conn">
                    <span className="modal__conn-label">Vem de:</span>{' '}
                    {conn.references.map((id) => (
                      <button key={id} className="link" onClick={() => onNavigate(id)}>
                        {label(id)}
                      </button>
                    ))}
                  </p>
                ) : null}
                {conn.referencedBy.length > 0 ? (
                  <p className="modal__conn">
                    <span className="modal__conn-label">Leva a:</span>{' '}
                    {conn.referencedBy.map((id) => (
                      <button key={id} className="link" onClick={() => onNavigate(id)}>
                        {label(id)}
                      </button>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="modal__section">
              <h3>Fontes</h3>
              <div className="modal__sources">
                {node.sources.map((s, i) => {
                  const cta = ctaFor(s);
                  return (
                    <div key={i} className="source">
                      <span className={`tag tag--${s.sourceType === 'free' ? 'free' : 'retail'}`}>
                        {s.sourceType === 'free' ? 'fonte livre' : 'adquirir'}
                      </span>
                      {s.note ? <span className="source__note">{s.note}</span> : null}
                      {cta ? (
                        <a
                          className={`btn btn--${cta.kind}`}
                          href={cta.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {cta.label}
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
