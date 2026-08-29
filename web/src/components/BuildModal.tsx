'use client';

import { useEffect, useState } from 'react';
import type { Build } from '@/lib/types';
import { formatCash, formatBlockbux, timeAgo } from '@/lib/format';

/**
 * Build detail modal. Mirrors the reference: header with title + close, left
 * column (uploader, price box, Copy ID, category, description, gamepasses),
 * right column (image gallery with thumbnails).
 */
export default function BuildModal({ build, onClose }: { build: Build; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const images = build.images.length ? build.images : [];
  const mainImg = images[active] ?? images[0];

  async function copyId() {
    try {
      await navigator.clipboard.writeText(build.id);
    } catch {
      // Fallback for older browsers.
      const ta = document.createElement('textarea');
      ta.value = build.id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const initials = (build.uploader || 'B').slice(0, 1).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{build.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Left column */}
          <div>
            <div className="uploader">
              {build.uploaderAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={build.uploaderAvatar} alt={build.uploader} />
              ) : (
                <div className="avatar">{initials}</div>
              )}
              <div>
                <div className="who">{build.uploader}</div>
                <div className="when">Uploaded {timeAgo(build.createdAt)}</div>
              </div>
            </div>

            <div className="price-box">
              <div className="pr">
                <span className="k">Cash Price</span>
                <span className="price-cash">{formatCash(build.cashPrice)}</span>
              </div>
              <div className="pr">
                <span className="k">Blockbux</span>
                <span className="price-bbx">{formatBlockbux(build.blockbux)}</span>
              </div>
            </div>

            <button
              className={`btn btn-primary copy-id ${copied ? 'copied' : ''}`}
              onClick={copyId}
            >
              {copied ? '✓ Copied' : '⧉ Copy ID'}
            </button>

            {build.category ? (
              <>
                <div className="section-title">Build Category</div>
                <div className="muted">{build.category}</div>
              </>
            ) : null}

            {build.description ? (
              <>
                <div className="section-title">Description</div>
                <div className="muted">{build.description}</div>
              </>
            ) : null}

            {build.gamepasses.length ? (
              <>
                <div className="section-title">Required Gamepasses</div>
                <div className="gp-grid">
                  {build.gamepasses.map((gp) => (
                    <div className="gp-item" key={gp}>
                      {gp}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Right column: gallery */}
          <div>
            <div className="gallery-main">
              {mainImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainImg} alt={build.name} />
              ) : (
                <div className="placeholder" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
                  🏠
                </div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="thumbs">
                {images.map((img, i) => (
                  <button
                    key={img}
                    className={`thumb ${i === active ? 'active' : ''}`}
                    onClick={() => setActive(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`${build.name} ${i + 1}`} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
