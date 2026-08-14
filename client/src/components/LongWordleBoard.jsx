import React from 'react';

const getTileDimensions = (len) => {
  if (len <= 10) return { size: '2.8rem', gap: '0.35rem', font: '1.7rem', avatarSize: '3.2rem', nickMaxWidth: '120px' };
  if (len === 11) return { size: '2.6rem', gap: '0.3rem', font: '1.55rem', avatarSize: '3.0rem', nickMaxWidth: '110px' };
  if (len === 12) return { size: '2.4rem', gap: '0.28rem', font: '1.45rem', avatarSize: '2.8rem', nickMaxWidth: '100px' };
  if (len === 13) return { size: '2.2rem', gap: '0.25rem', font: '1.35rem', avatarSize: '2.6rem', nickMaxWidth: '90px' };
  if (len === 14) return { size: '2.05rem', gap: '0.22rem', font: '1.25rem', avatarSize: '2.4rem', nickMaxWidth: '85px' };
  return { size: '1.9rem', gap: '0.2rem', font: '1.15rem', avatarSize: '2.2rem', nickMaxWidth: '80px' };
};

export default function LongWordleBoard({ gameState }) {
  // Support both longWordle fields or standard fields when in isolated long wordle mode
  const guesses = gameState.longWordleGuesses || (gameState.mode === 'longwordle' ? gameState.guesses : []) || [];
  const targetWord = gameState.longWordleTargetWord || (gameState.mode === 'longwordle' ? gameState.targetWord : '') || 'abstinensi';
  const maxRows = gameState.longWordleMaxRows || gameState.maxRows || 6;
  
  const wordLength = targetWord.length || 10;
  const dims = getTileDimensions(wordLength);

  const rows = [];

  // Tampilkan sejumlah maxRows tebakan terakhir
  const visibleGuesses = guesses.length > maxRows 
    ? guesses.slice(-maxRows) 
    : guesses;

  // Balik urutan agar tebakan terbaru selalu di baris paling atas
  const reversedGuesses = [...visibleGuesses].reverse();

  for (let i = 0; i < maxRows; i++) {
    if (i < reversedGuesses.length) {
      rows.push(
        <CompletedRow 
          key={i} 
          guess={reversedGuesses[i]} 
          targetWord={targetWord} 
          isLatest={i === 0}
          dims={dims}
        />
      );
    } else {
      rows.push(<EmptyRow key={i} length={wordLength} dims={dims} />);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: 'fit-content' }}>
      {/* Header Info Long Wordle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255, 255, 255, 0.92)', 
        padding: '0.5rem 0.9rem', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.6)',
        marginBottom: '0.2rem',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.2rem' }}>✨</span>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#5b21b6', margin: 0 }}>
            Long Wordle ({wordLength} Huruf)
          </h2>
        </div>

        {/* Indikator Warna Mini Horizontal Compact */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.45rem',
          backgroundColor: '#f3f4f6',
          padding: '0.2rem 0.55rem', 
          borderRadius: '999px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--wordle-correct)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#374151' }}>Tepat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--wordle-present)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#374151' }}>Ada</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--wordle-absent)', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#374151' }}>Salah</span>
          </div>
        </div>
      </div>

      {rows}
    </div>
  );
}

function CompletedRow({ guess, targetWord, isLatest, dims }) {
  const letters = guess.word.split('');
  
  // Wordle letter status matching logic
  let targetArr = targetWord.split('');
  const status = new Array(letters.length).fill('absent');

  // First pass: correct spot
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === targetArr[i]) {
      status[i] = 'correct';
      targetArr[i] = null;
    }
  }

  // Second pass: present elsewhere
  for (let i = 0; i < letters.length; i++) {
    if (status[i] === 'absent' && targetArr.includes(letters[i])) {
      status[i] = 'present';
      targetArr[targetArr.indexOf(letters[i])] = null;
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: dims.gap }}>
        {letters.map((letter, i) => (
          <div 
            key={i}
            className={isLatest ? 'flip-animate' : ''}
            style={{
              width: dims.size,
              height: dims.size,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: dims.font,
              fontWeight: '800',
              textShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)',
              textTransform: 'uppercase',
              color: 'var(--word-text)',
              backgroundColor: `var(--wordle-${status[i]})`,
              borderRadius: '6px',
              animationDelay: `${i * 0.06}s`,
              boxShadow: '0 3px 5px rgba(0,0,0,0.1)'
            }}
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Profil User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <img 
          src={guess.user.profilePic} 
          alt="pfp" 
          style={{ 
            width: dims.avatarSize, 
            height: dims.avatarSize, 
            borderRadius: '6px', 
            border: '2px solid white', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)', 
            objectFit: 'cover',
            flexShrink: 0
          }} 
        />
        <span style={{ 
          fontWeight: '800', 
          color: 'white', 
          fontSize: '1rem', 
          maxWidth: dims.nickMaxWidth, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          textShadow: '1px 1px 3px rgba(0,0,0,0.9)' 
        }}>
          {guess.user.nickname}
        </span>
      </div>
    </div>
  );
}

function EmptyRow({ length, dims }) {
  const boxes = Array.from({ length });
  return (
    <div style={{ display: 'flex', gap: dims.gap }}>
      {boxes.map((_, i) => (
        <div 
          key={i}
          style={{
            width: dims.size,
            height: dims.size,
            backgroundColor: 'var(--wordle-empty)',
            borderRadius: '6px',
          }}
        />
      ))}
    </div>
  );
}
