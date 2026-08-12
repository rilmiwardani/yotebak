import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';

const RESTART_DELAY = 10;

export default function WinCard({ show, winner, word, mode, onExited }) {
  const [render, setRender] = useState(show);
  const [isLeaving, setIsLeaving] = useState(false);
  const [countdown, setCountdown] = useState(RESTART_DELAY);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (show) {
      // Delay agar papan Wordle selesai melakukan animasi flip huruf terakhir dulu
      const timer = setTimeout(() => {
        setRender(true);
        setIsLeaving(false);
        setCountdown(RESTART_DELAY);
      }, mode === 'wordle' ? 1000 : 200);
      return () => clearTimeout(timer);
    } else {
      setIsLeaving(true);
      // Tunggu hingga animasi CSS transisi fade out selesai (600ms) baru hilangkan dari DOM
      const timer = setTimeout(() => {
        setRender(false);
        if (onExited) onExited();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [show, mode, onExited]);

  // Countdown timer (uses Date.now() to be immune to browser throttling)
  const startTimeRef = useRef(null);
  useEffect(() => {
    if (!render || isLeaving) return;

    startTimeRef.current = Date.now();
    setCountdown(RESTART_DELAY);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(RESTART_DELAY - elapsed, 0);
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [render, isLeaving]);

  useEffect(() => {
    if (!render || !canvasRef.current || isLeaving) return;

    // Inisialisasi konfeti lokal agar hanya memantul di area kanvas ini saja
    const myConfetti = confetti.create(canvasRef.current, {
      resize: true,
      useWorker: true
    });

    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      myConfetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.85 }
      });
      myConfetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.85 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, [render, isLeaving]);

  if (!render) return null;

  const isMultiWord = word && word.includes(',');
  const wordList = isMultiWord ? word.split(',').map(w => w.trim()).filter(Boolean) : [word];

  return (
    <div className={`win-card-overlay ${isLeaving ? 'leaving' : ''}`}>
      {/* Kanvas lokal berada di atas kartu kemenangan agar konfeti terlihat jelas */}
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          zIndex: 10
        }} 
      />
      
      <div style={{ 
        zIndex: 2, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100%', 
        height: '100%', 
        gap: isMultiWord ? '0.5rem' : '0.7rem' 
      }}>
        {/* Title */}
        <h2 style={{ 
          fontSize: isMultiWord ? '1.5rem' : '1.75rem', 
          color: '#166534', 
          fontWeight: '800', 
          letterSpacing: '-0.02em', 
          margin: 0 
        }}>
          {isMultiWord ? '🧩 Semua Kata Tertebak!' : '🎉 Tepat Sekali!'}
        </h2>
        
        {/* Secret Words Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kata Rahasia:
          </span>
          
          {isMultiWord ? (
            /* Multi-word Anagram: Ultra-Compact Pills */
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '0.35rem', 
              justifyContent: 'center', 
              maxWidth: '320px',
              padding: '0.2rem'
            }}>
              {wordList.map((w, idx) => (
                <div 
                  key={idx}
                  style={{
                    backgroundColor: 'var(--wordle-correct)',
                    color: '#ffffff',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    textShadow: '0px 1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                  {w}
                </div>
              ))}
            </div>
          ) : (
            /* Single Word (Wordle or 1-word Anagram): Clean Letter Tiles */
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
              {(wordList[0] || '').split('').map((letter, i) => (
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
                    backgroundColor: 'var(--wordle-correct)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                    textShadow: '0px 1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                  {letter}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Winner Profile */}
        {winner && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem' }}>
            <img 
              src={winner.profilePic} 
              alt="Winner Profile" 
              style={{ 
                width: isMultiWord ? '60px' : '75px', 
                height: isMultiWord ? '60px' : '75px', 
                borderRadius: '12px', 
                border: '2.5px solid white', 
                boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
                objectFit: 'cover'
              }} 
            />
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
                {isMultiWord ? 'MVP Ronde' : 'Pemenang'}
              </span>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '800', 
                color: '#1f2937', 
                margin: 0, 
                maxWidth: '180px', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {winner.nickname}
              </h3>
            </div>
          </div>
        )}

        {/* Countdown Progress Bar */}
        <div style={{ width: '100%', maxWidth: '240px', marginTop: '0.3rem' }}>
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.25rem', fontWeight: '600' }}>
            Game baru dalam {countdown}s...
          </p>
          <div style={{
            width: '100%',
            height: '5px',
            backgroundColor: '#e5e7eb',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(countdown / RESTART_DELAY) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              transition: 'width 1s linear',
              borderRadius: '3px'
            }} />
          </div>
        </div>

      </div>
    </div>
  );
}
