'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Build } from '@/lib/types';
import BuildCard from './BuildCard';
import BuildModal from './BuildModal';

/**
 * Client-side gallery: fetches builds from the public API, provides search,
 * renders the card grid, and manages the detail modal.
 */
export default function Gallery() {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Build | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/builds')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setBuilds(Array.isArray(data.builds) ? data.builds : []);
      })
      .catch(() => {
        if (alive) setError('Could not load builds. Please try again.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!builds) return [];
    const q = query.trim().toLowerCase();
    if (!q) return builds;
    return builds.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.gamepasses.some((g) => g.toLowerCase().includes(q)),
    );
  }, [builds, query]);

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <span className="icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, Build ID, category, gamepass…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="count-pill">
          {builds ? `${filtered.length} build${filtered.length === 1 ? '' : 's'}` : '…'}
        </span>
      </div>

      {error ? (
        <div className="empty">
          <div className="big">⚠️</div>
          {error}
        </div>
      ) : builds === null ? (
        <div className="loading">
          <div className="spinner" />
          Loading builds…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="big">🏠</div>
          {query ? 'No builds match your search.' : 'No builds have been added yet.'}
        </div>
      ) : (
        <div className="grid">
          {filtered.map((b) => (
            <BuildCard key={b.id} build={b} onOpen={setSelected} />
          ))}
        </div>
      )}

      {selected ? <BuildModal build={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
