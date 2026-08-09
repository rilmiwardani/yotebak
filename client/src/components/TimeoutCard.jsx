import React, { useEffect, useState } from 'react';

const RESTART_DELAY = 10;

export default function TimeoutCard({ show, word, onExited }) {
  const [render, setRender] = useState(show);
  const [isLeaving, setIsLeaving] = useState(false);
  const [countdown, setCountdown] = useState(RESTART_DELAY);

  useEffect(() => {
    if (show) {
      setRender(true);
      setIsLeaving(false);
      setCountdown(RESTART_DELAY);
    } else {
      setIsLeaving(true);
      const timer = setTimeout(() => {
        setRender(false);
        if (onExited) onExited();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [show, onExited]);

  // Countdown timer
  useEffect(() => {
    if (!render || isLeaving) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [render, isLeaving]);

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

        {/* Countdown Bar */}
        <div style={{ width: '100%', maxWidth: '280px', marginTop: '0.3rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.3rem', fontWeight: '600' }}>
            Game baru dalam {countdown}s...
          </p>
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#e5e7eb',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(countdown / RESTART_DELAY) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #f43f5e, #e11d48)',
              transition: 'width 1s linear',
              borderRadius: '3px'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
