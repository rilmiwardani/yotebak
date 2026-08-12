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

  // Adaptive size based on row count so 1-6 rows always look balanced
  const getRowDimensions = () => {
    if (totalCount === 1) return { tileSize: '4.5rem', fontSize: '3.0rem', gap: '0.6rem', rowGap: '1rem', avatarSize: '4.5rem', nameSize: '1.2rem' };
    if (totalCount === 2) return { tileSize: '4.0rem', fontSize: '2.6rem', gap: '0.5rem', rowGap: '0.8rem', avatarSize: '4.0rem', nameSize: '1.15rem' };
    if (totalCount <= 4) return { tileSize: '3.4rem', fontSize: '2.2rem', gap: '0.4rem', rowGap: '0.6rem', avatarSize: '3.4rem', nameSize: '1.1rem' };
    return { tileSize: '2.85rem', fontSize: '1.8rem', gap: '0.35rem', rowGap: '0.5rem', avatarSize: '2.85rem', nameSize: '0.95rem' };
  };

  const dim = getRowDimensions();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: 'fit-content' }}>
      
      {/* Header Info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255, 255, 255, 0.92)', 
        padding: '0.5rem 1.2rem', 
        borderRadius: '12px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🧩</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>
            Susun Kata Ini!
          </h2>
        </div>
        <div style={{ 
          backgroundColor: solvedCount === totalCount ? '#2b8a3e' : '#8b5cf6', 
          color: 'white', 
          fontSize: '0.85rem', 
          fontWeight: '800', 
          padding: '0.25rem 0.75rem', 
          borderRadius: '999px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}>
          {solvedCount} / {totalCount} Tertebak
        </div>
      </div>

      {/* Rows Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: dim.rowGap }}>
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
              {/* Row Number Badge */}
              <div style={{
                width: '1.8rem',
                height: '1.8rem',
                borderRadius: '50%',
                backgroundColor: item.solved ? '#2b8a3e' : '#8b5cf6',
                color: 'white',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '0.85rem',
                fontWeight: '800',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                flexShrink: 0
              }}>
                {idx + 1}
              </div>

              {/* Letter Tiles */}
              <div style={{ display: 'flex', gap: dim.gap }}>
                {displayLetters.map((letter, i) => (
                  <div
                    key={i}
                    className={item.solved ? 'flip-animate' : ''}
                    style={{
                      width: dim.tileSize,
                      height: dim.tileSize,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: dim.fontSize,
                      fontWeight: '800',
                      textShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)',
                      textTransform: 'uppercase',
                      color: 'white',
                      backgroundColor: item.solved ? 'var(--wordle-correct)' : '#8b5cf6',
                      borderRadius: '8px',
                      animationDelay: item.solved ? `${i * 0.08}s` : '0s',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>

              {/* Winner Profile or Status on Right Side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px' }}>
                {item.solved && item.winner ? (
                  <>
                    <img 
                      src={item.winner.profilePic} 
                      alt="pfp" 
                      style={{ 
                        width: dim.avatarSize, 
                        height: dim.avatarSize, 
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
                        fontSize: dim.nameSize, 
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
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.4rem',
                    padding: '0.3rem 0.6rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.85)', 
                      fontSize: '0.8rem', 
                      fontWeight: '600',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                    }}>
                      💬 Ketik di chat...
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
