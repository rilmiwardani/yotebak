import React from 'react';

export default function AnagramBoard({ gameState }) {
  const { anagramWords, scrambledWord, targetWord } = gameState;

  // Fallback if anagramWords is not populated (backward compatibility)
  const words = (anagramWords && anagramWords.length > 0)
    ? anagramWords
    : [{
        id: 1,
        targetWord: targetWord || '',
        scrambledWord: scrambledWord || '',
        solved: gameState.status === 'won',
        winner: gameState.winner
      }];

  const totalCount = words.length;
  const solvedCount = words.filter(w => w.solved).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 'fit-content' }}>
      
      {/* Header Info */}
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
          <span style={{ fontSize: '1.2rem' }}>🧩</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>
            Susun Kata Ini!
          </h2>
        </div>
        <div style={{ 
          backgroundColor: solvedCount === totalCount ? '#2b8a3e' : '#2563eb', 
          color: 'white', 
          fontSize: '0.85rem', 
          fontWeight: '800', 
          padding: '0.2rem 0.65rem', 
          borderRadius: '999px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}>
          {solvedCount} / {totalCount} Tertebak
        </div>
      </div>

      {/* Rows Container - Sizing IDENTIK 100% dengan WordleBoard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {words.map((item, idx) => {
          const displayLetters = (item.solved ? item.targetWord : item.scrambledWord).split('');

          return (
            <div 
              key={item.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              {/* Letter Tiles - Ukuran, font, dan shadow sama persis dengan Wordle (4rem x 4rem, font 2.6rem) */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {displayLetters.map((letter, i) => (
                  <div
                    key={i}
                    className={item.solved ? 'flip-animate' : ''}
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
                      color: 'white',
                      backgroundColor: item.solved ? 'var(--wordle-correct)' : '#2563eb',
                      borderRadius: '8px',
                      animationDelay: item.solved ? `${i * 0.08}s` : '0s',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>

              {/* Winner Profile or Animated Status on Right Side (Ukuran avatar 4rem x 4rem sama persis dengan Wordle) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px' }}>
                {item.solved && item.winner ? (
                  <>
                    <img 
                      src={item.winner.profilePic} 
                      alt="pfp" 
                      style={{ 
                        width: '4rem', 
                        height: '4rem', 
                        borderRadius: '8px', 
                        border: '2px solid white', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)', 
                        objectFit: 'cover',
                        flexShrink: 0
                      }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ 
                        fontWeight: '800', 
                        color: 'white', 
                        fontSize: '1.2rem', 
                        maxWidth: '120px', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        textShadow: '1px 1px 3px rgba(0,0,0,0.9)' 
                      }}>
                        {item.winner.nickname}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        color: '#4ade80', 
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)' 
                      }}>
                        ✅ Tertebak
                      </span>
                    </div>
                  </>
                ) : (
                  <div 
                    className="chat-prompt-animated"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.45rem',
                      height: '4rem',
                      padding: '0 0.9rem',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', display: 'inline-block' }}>💬</span>
                    <span style={{ 
                      color: '#ffffff', 
                      fontSize: '0.95rem', 
                      fontWeight: '800',
                      letterSpacing: '0.02em',
                      textShadow: '1px 1px 3px rgba(0,0,0,0.9)'
                    }}>
                      Ketik di chat
                    </span>
                    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', marginLeft: '2px' }}>
                      <span className="dot-1" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                      <span className="dot-2" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                      <span className="dot-3" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                    </span>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
