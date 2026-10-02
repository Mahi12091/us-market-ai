'use client';

import { useEffect } from 'react';

export default function StockError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[US Market AI] Stock page runtime error:', error);
  }, [error]);

  return (
    <main style={{ minHeight: '70vh', padding: '48px 20px', background: '#f8fafc' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 8px 30px rgba(15,23,42,.08)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#dc2626', marginBottom: 8 }}>
          STOCK PAGE ERROR
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: 26, color: '#0f172a' }}>
          Stock research page could not load
        </h1>
        <p style={{ margin: '0 0 20px', color: '#475569', lineHeight: 1.6 }}>
          The deployment is running, but this stock route hit a runtime error. Use the diagnostic details below so the exact failing part can be fixed.
        </p>

        {error?.digest ? (
          <div style={{ marginBottom: 14, padding: 14, background: '#f1f5f9', borderRadius: 10 }}>
            <strong style={{ display: 'block', marginBottom: 5, color: '#0f172a' }}>Error digest</strong>
            <code style={{ wordBreak: 'break-all', color: '#334155' }}>{error.digest}</code>
          </div>
        ) : null}

        <div style={{ marginBottom: 20, padding: 14, background: '#fef2f2', borderRadius: 10, overflow: 'auto' }}>
          <strong style={{ display: 'block', marginBottom: 5, color: '#991b1b' }}>Error</strong>
          <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#7f1d1d' }}>
            {error?.message || 'Unknown runtime error'}
          </code>
        </div>

        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{ border: 0, borderRadius: 10, padding: '11px 18px', background: '#1769e0', color: '#fff', fontWeight: 700 }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
