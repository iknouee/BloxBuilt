'use client';

import type { Build } from '@/lib/types';
import { formatCash, formatBlockbux } from '@/lib/format';

/**
 * A single build card in the gallery grid. Matches the reference design:
 * cover image, a gamepass-count badge, name, short description, cash + B$ price.
 */
export default function BuildCard({
  build,
  onOpen,
}: {
  build: Build;
  onOpen: (b: Build) => void;
}) {
  const cover = build.images[0];
  const gpCount = build.gamepasses.length;

  return (
    <article
      className="card"
      onClick={() => onOpen(build)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(build);
        }
      }}
    >
      <div className="card-img">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={build.name} loading="lazy" />
        ) : (
          <div className="placeholder">🏠</div>
        )}
        {gpCount > 0 ? (
          <span className="badge-gp">
            {gpCount} Gamepass{gpCount === 1 ? '' : 'es'}
          </span>
        ) : null}
      </div>
      <div className="card-body">
        <h3>{build.name}</h3>
        {build.description ? <p className="desc">{build.description}</p> : <p className="desc" />}
        <div className="price-cash">{formatCash(build.cashPrice)}</div>
        <div className="price-bbx">{formatBlockbux(build.blockbux)}</div>
      </div>
    </article>
  );
}
