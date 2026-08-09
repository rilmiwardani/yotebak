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

  return (
    <div className={`win-card-overlay ${isLeaving ? 'leaving' : ''}`}>
      {/* Kanvas lokal berada di atas kartu kemenangan (zIndex: 10) agar konfeti terlihat jelas */}
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
      
      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: '0.8rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#3f8c5c', fontWeight: '800', tracking: '-0.02em', margin: 0 }}>
          Tepat Sekali!
        </h2>
        
        <div>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '0.4rem' }}>
            Kata rahasia:
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
            {word.split('').map((letter, i) => (
              <div 
                key={i}
                style={{
                  width: '3rem',
                  height: '3rem',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '1.8rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  color: 'white',
                  backgroundColor: 'var(--wordle-correct)',
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
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem' }}>
          <img 
            src={winner.profilePic} 
            alt="Winner Profile" 
            style={{ 
              width: '95px', 
              height: '95px', 
              borderRadius: '16px', 
              border: '3px solid white', 
              boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
              objectFit: 'cover'
            }} 
          />
          <div>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pemenang
            </span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1f2937', marginTop: '0.05rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {winner.nickname}
            </h3>
          </div>
        </div>

        {/* Countdown Bar */}
        <div style={{ width: '100%', maxWidth: '280px', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginBottom: '0.3rem' }}>
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
