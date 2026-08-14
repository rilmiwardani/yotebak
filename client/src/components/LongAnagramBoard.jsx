import React from 'react';

const getTileDimensions = (len) => {
  if (len <= 10) return { size: '2.8rem', gap: '0.35rem', font: '1.7rem', avatarSize: '3.2rem', nickMaxWidth: '120px' };
  if (len === 11) return { size: '2.6rem', gap: '0.3rem', font: '1.55rem', avatarSize: '3.0rem', nickMaxWidth: '110px' };
  if (len === 12) return { size: '2.4rem', gap: '0.28rem', font: '1.45rem', avatarSize: '2.8rem', nickMaxWidth: '100px' };
  if (len === 13) return { size: '2.2rem', gap: '0.25rem', font: '1.35rem', avatarSize: '2.6rem', nickMaxWidth: '90px' };
  if (len === 14) return { size: '2.05rem', gap: '0.22rem', font: '1.25rem', avatarSize: '2.4rem', nickMaxWidth: '85px' };
  return { size: '1.9rem', gap: '0.2rem', font: '1.15rem', avatarSize: '2.2rem', nickMaxWidth: '80px' };
};

export default function LongAnagramBoard({ gameState }) {
  const words = (gameState.longAnagramWords && gameState.longAnagramWords.length > 0)
    ? gameState.longAnagramWords
    : (gameState.mode === 'longanagram' && gameState.anagramWords && gameState.anagramWords.length > 0)
      ? gameState.anagramWords
      : [{
          id: 1,
          targetWord: 'abstinensi',
          scrambledWord: 'sinabetnis',
          solved: false,
          winner: null
        }];

  const totalCount = words.length;
  const solvedCount = words.filter(w => w.solved).length;
  const sampleWord = words[0]?.targetWord || 'abstinensi';
  const wordLength = sampleWord.length || 10;
  const dims = getTileDimensions(wordLength);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: 'fit-content' }}>
      
      {/* Header Info Long Anagram */}
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
        marginBottom: '0.2rem',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🧩</span>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#3730a3', margin: 0 }}>
            Long Anagram ({wordLength} Huruf)
          </h2>
        </div>
        <div style={{ 
          backgroundColor: solvedCount === totalCount ? '#2b8a3e' : '#4f46e5', 
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

      {/* Rows Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: dims.gap }}>
        {words.map((item, idx) => {
          const displayLetters = (item.solved ? item.targetWord : item.scrambledWord).split('');

          return (
            <div 
              key={item.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              {/* Letter Tiles */}
              <div style={{ display: 'flex', gap: dims.gap }}>
                {displayLetters.map((letter, i) => (
                  <div
                    key={i}
                    className={item.solved ? 'flip-animate' : ''}
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
                      color: 'white',
                      backgroundColor: item.solved ? 'var(--wordle-correct)' : '#4f46e5',
                      borderRadius: '6px',
                      animationDelay: item.solved ? `${i * 0.06}s` : '0s',
                      boxShadow: '0 3px 5px rgba(0,0,0,0.12)'
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>

              {/* Winner Profile or Animated Status on Right Side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '130px' }}>
                {item.solved && item.winner ? (
                  <>
                    <img 
                      src={item.winner.profilePic} 
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
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ 
                        fontWeight: '800', 
                        color: 'white', 
                        fontSize: '0.95rem', 
                        maxWidth: dims.nickMaxWidth, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        textShadow: '1px 1px 3px rgba(0,0,0,0.9)' 
                      }}>
                        {item.winner.nickname}
                      </span>
                      <span style={{ 
                        fontSize: '0.7rem', 
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
                      gap: '0.35rem',
                      height: dims.avatarSize,
                      padding: '0 0.65rem',
                      borderRadius: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', display: 'inline-block' }}>💬</span>
                    <span style={{ 
                      color: '#ffffff', 
                      fontSize: '0.8rem', 
                      fontWeight: '800', 
                      letterSpacing: '0.02em',
                      textShadow: '1px 1px 3px rgba(0,0,0,0.9)' 
                    }}>
                      Ketik di chat
                    </span>
                    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center', marginLeft: '2px' }}>
                      <span className="dot-1" style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                      <span className="dot-2" style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                      <span className="dot-3" style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
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
