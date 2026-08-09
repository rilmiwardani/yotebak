import React from 'react';

export default function AnagramBoard({ gameState }) {
  const { scrambledWord, guesses } = gameState;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', marginTop: '2rem' }}>
      
      <div style={{ backgroundColor: 'white', padding: '1rem 2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-color)', marginBottom: '1rem', textAlign: 'center' }}>Susun Kata Ini!</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {scrambledWord.split('').map((letter, i) => (
            <div 
              key={i}
              style={{
                width: '5rem',
                height: '5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '3.6rem',
                fontWeight: '800',
                textShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)',
                textTransform: 'uppercase',
                color: 'white',
                backgroundColor: '#8b5cf6', // Pastel purple
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              {letter}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
