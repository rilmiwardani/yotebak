import React, { useEffect, useState } from 'react';

export default function TimeoutCard({ show, word, onExited }) {
  const [render, setRender] = useState(show);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (show) {
      setRender(true);
      setIsLeaving(false);
    } else {
      setIsLeaving(true);
      const timer = setTimeout(() => {
        setRender(false);
        if (onExited) onExited();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [show, onExited]);

  if (!render) return null;

  return (
    <div className={`win-card-overlay ${isLeaving ? 'leaving' : ''}`} style={{ border: '3px solid rgba(239, 68, 68, 0.4)' }}>
      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: '1.2rem' }}>
        <h2 style={{ fontSize: '2rem', color: '#ef4444', fontWeight: '800', tracking: '-0.02em', margin: 0, animation: 'pulse-text 1.5s infinite' }}>
          WAKTU HABIS!
        </h2>
        
        <div>
          <span style={{ fontSize: '0.9rem', color: '#6b7280', display: 'block', marginBottom: '0.4rem', textAlign: 'center' }}>
            Kata rahasia yang benar:
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
            {word.split('').map((letter, i) => (
              <div 
                key={i}
                style={{
                  width: '3.2rem',
                  height: '3.2rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '2rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  color: 'white',
                  backgroundColor: '#ef4444',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  textShadow: '0px 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: '600' }}>
          Game baru akan segera dimulai...
        </p>
      </div>
    </div>
  );
}
