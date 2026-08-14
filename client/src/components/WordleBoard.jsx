import React from 'react';

export default function WordleBoard({ gameState }) {
  const { guesses, targetWord, maxRows = 6 } = gameState;
  const wordLength = targetWord.length;

  const rows = [];

  // Tampilkan hanya sejumlah maxRows tebakan terakhir untuk scrolling tak terbatas
  const visibleGuesses = guesses.length > maxRows 
    ? guesses.slice(-maxRows) 
    : guesses;

  // Balik urutan agar tebakan terbaru selalu berada di baris paling atas (Row 1)
  const reversedGuesses = [...visibleGuesses].reverse();

  for (let i = 0; i < maxRows; i++) {
    if (i < reversedGuesses.length) {
      rows.push(
        <CompletedRow 
          key={i} 
          guess={reversedGuesses[i]} 
          targetWord={targetWord} 
          isLatest={i === 0} // Baris teratas (index 0) adalah yang terbaru, sehingga ter-trigger animasi flip
        />
      );
    } else {
      rows.push(<EmptyRow key={i} length={wordLength} />);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 'fit-content' }}>
      {/* Header Info Wordle (Horizontal Compact & Identik dengan Anagram) */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255, 255, 255, 0.92)', 
        padding: '0.5rem 1rem', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.6)',
        marginBottom: '0.2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📝</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>
            Tebak {wordLength} Huruf
          </h2>
        </div>

        {/* Indikator Warna Mini Horizontal Compact */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          backgroundColor: '#f3f4f6',
          padding: '0.2rem 0.6rem',
          borderRadius: '999px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--wordle-correct)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151' }}>Tepat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--wordle-present)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151' }}>Ada</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: 'var(--wordle-absent)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151' }}>Salah</span>
          </div>
        </div>
      </div>

      {rows}
    </div>
  );
}

function CompletedRow({ guess, targetWord, isLatest }) {
  const letters = guess.word.split('');
  
  // Basic Wordle logic for coloring
  // To be accurate we need to handle multiple letters, but simplified here for overlay
  let targetArr = targetWord.split('');
  const status = new Array(letters.length).fill('absent');

  // First pass: correct
  for(let i=0; i<letters.length; i++) {
    if (letters[i] === targetArr[i]) {
      status[i] = 'correct';
      targetArr[i] = null;
    }
  }

  // Second pass: present
  for(let i=0; i<letters.length; i++) {
    if (status[i] === 'absent' && targetArr.includes(letters[i])) {
      status[i] = 'present';
      targetArr[targetArr.indexOf(letters[i])] = null;
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {letters.map((letter, i) => (
          <div 
            key={i}
            className={isLatest ? 'flip-animate' : ''}
            style={{
              width: '4rem',
              height: '4rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '2.6rem',
              fontWeight: '800',
              textShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)',
              textTransform: 'uppercase',
              color: 'var(--word-text)',
              backgroundColor: `var(--wordle-${status[i]})`,
              borderRadius: '8px',
              animationDelay: `${i * 0.1}s`,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Profil User (Tanpa gaya pil, warna putih kontras untuk OBS) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <img src={guess.user.profilePic} alt="pfp" style={{ width: '4rem', height: '4rem', borderRadius: '8px', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', objectFit: 'cover' }} />
        <span style={{ fontWeight: '800', color: 'white', fontSize: '1.2rem', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
          {guess.user.nickname}
        </span>
      </div>
    </div>
  );
}

function EmptyRow({ length }) {
  const boxes = Array.from({ length });
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {boxes.map((_, i) => (
        <div 
          key={i}
          style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: 'var(--wordle-empty)',
            borderRadius: '8px',
          }}
        />
      ))}
    </div>
  );
}
