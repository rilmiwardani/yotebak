import React, { useState, useEffect, useRef } from 'react';

export default function LeaderboardBoard({ 
  gameState, 
  type = 'wordle', // 'wordle' | 'anagram' | 'longwordle' | 'all'
  customTitle = null, 
  customIcon = null,
  customAccent = null
}) {
  const maxLeaderboardRows = gameState?.maxLeaderboardRows || 10;
  const limit = Math.min(Math.max(Number(maxLeaderboardRows) || 10, 1), 20);

  // Select appropriate leaderboard array based on type
  let playersList = [];
  if (type === 'wordle') {
    playersList = gameState?.wordleLeaderboard || [];
  } else if (type === 'anagram') {
    playersList = gameState?.anagramLeaderboard || [];
  } else if (type === 'longwordle') {
    playersList = gameState?.longWordleLeaderboard || [];
  } else if (type === 'longanagram') {
    playersList = gameState?.longAnagramLeaderboard || [];
  } else {
    playersList = gameState?.leaderboard || gameState?.wordleLeaderboard || [];
  }

  const displayedPlayers = playersList.slice(0, limit);

  // Visual Theme per game type
  const isWordle = type === 'wordle';
  const isAnagram = type === 'anagram';
  const isLongWordle = type === 'longwordle';
  const isLongAnagram = type === 'longanagram';

  const defaultIcon = isWordle ? '📝' : (isAnagram ? '🟦' : (isLongWordle ? '✨' : (isLongAnagram ? '🧩' : '🏆')));
  const defaultTitle = isWordle ? 'Top Wordle' : (isAnagram ? 'Top Anagram' : (isLongWordle ? 'Top Long Wordle' : (isLongAnagram ? 'Top Long Anagram' : 'Top Pemenang')));
  const defaultAccent = isWordle ? '#16a34a' : (isAnagram ? '#2563eb' : (isLongWordle ? '#7c3aed' : (isLongAnagram ? '#4f46e5' : '#f59e0b')));

  const icon = customIcon || defaultIcon;
  const title = customTitle || defaultTitle;
  const accent = customAccent || defaultAccent;

  // Track previous ranks and points to trigger overtake/rank-up animations
  const prevRankMapRef = useRef({});
  const [animatedPlayers, setAnimatedPlayers] = useState({});

  useEffect(() => {
    const newAnimated = {};
    displayedPlayers.forEach((player, currentRank) => {
      const prevRank = prevRankMapRef.current[player.nickname];
      const prevPoints = prevRankMapRef.current[`${player.nickname}_pts`];

      if (prevRank !== undefined) {
        if (currentRank < prevRank || (player.points > prevPoints)) {
          newAnimated[player.nickname] = true;
        }
      }
      prevRankMapRef.current[player.nickname] = currentRank;
      prevRankMapRef.current[`${player.nickname}_pts`] = player.points;
    });

    if (Object.keys(newAnimated).length > 0) {
      setAnimatedPlayers(newAnimated);
      const timer = setTimeout(() => {
        setAnimatedPlayers({});
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [playersList, limit]);

  // Clean, minimalist rank styling
  const getRankStyle = (rank) => {
    if (rank === 0) {
      return {
        bg: '#f59e0b',
        color: '#ffffff',
        text: '1',
        border: '1px solid #fef08a'
      };
    }
    if (rank === 1) {
      return {
        bg: '#64748b',
        color: '#ffffff',
        text: '2',
        border: '1px solid #cbd5e1'
      };
    }
    if (rank === 2) {
      return {
        bg: '#b45309',
        color: '#ffffff',
        text: '3',
        border: '1px solid #fed7aa'
      };
    }
    return {
      bg: 'rgba(255, 255, 255, 0.15)',
      color: '#ffffff',
      text: `${rank + 1}`,
      border: '1px solid rgba(255, 255, 255, 0.2)'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '290px' }}>
      
      {/* Header Info (Sleek Glassmorphism Header) */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'rgba(255, 255, 255, 0.92)', 
        padding: '0.45rem 0.85rem', 
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>
            {title}
          </h2>
        </div>
        <div style={{ 
          backgroundColor: accent, 
          color: 'white', 
          fontSize: '0.75rem', 
          fontWeight: '800', 
          padding: '0.2rem 0.55rem', 
          borderRadius: '999px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}>
          {displayedPlayers.length} / {limit}
        </div>
      </div>

      {/* Leaderboard Players List (Minimalist & Compact) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {displayedPlayers.length > 0 ? (
          displayedPlayers.map((player, idx) => {
            const rankStyle = getRankStyle(idx);
            const isRankUp = animatedPlayers[player.nickname];

            return (
              <div 
                key={player.nickname || idx}
                className={`leaderboard-row-animated ${isRankUp ? 'leaderboard-rank-up' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.3rem 0.6rem',
                  backgroundColor: isRankUp 
                    ? (isWordle ? 'rgba(22, 163, 74, 0.45)' : (isAnagram ? 'rgba(37, 99, 235, 0.45)' : (isLongWordle ? 'rgba(124, 58, 237, 0.45)' : 'rgba(245, 158, 11, 0.4)')))
                    : (idx === 0 ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.7)'),
                  borderRadius: '6px',
                  border: isRankUp 
                    ? `2px solid ${accent}` 
                    : (idx === 0 ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)'),
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transform: isRankUp ? 'scale(1.02)' : 'scale(1)'
                }}
              >
                {/* Left Section: Rank Badge + Avatar + Nickname */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                  {/* Clean Rank Number */}
                  <div style={{
                    minWidth: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '4px',
                    backgroundColor: rankStyle.bg,
                    color: rankStyle.color,
                    border: rankStyle.border,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    flexShrink: 0
                  }}>
                    {rankStyle.text}
                  </div>

                  {/* Avatar */}
                  <img 
                    src={player.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.nickname)}&background=2563eb&color=fff`} 
                    alt="pfp"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.nickname)}&background=2563eb&color=fff`;
                    }}
                    style={{
                      width: '1.85rem',
                      height: '1.85rem',
                      borderRadius: '5px',
                      border: idx === 0 ? '1.5px solid #fbbf24' : '1.5px solid white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />

                  {/* Nickname */}
                  <span style={{
                    fontWeight: '800',
                    color: 'white',
                    fontSize: '0.88rem',
                    maxWidth: '120px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.95)'
                  }}>
                    {player.nickname}
                  </span>
                </div>

                {/* Right Section: Clean Points Badge (Tanpa icon berlebihan) */}
                <div 
                  className={isRankUp ? 'score-badge-pop' : ''}
                  style={{
                    backgroundColor: idx === 0 ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    border: idx === 0 ? '1px solid #fef08a' : '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  {player.points || 0} Pts
                </div>

              </div>
            );
          })
        ) : (
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <p style={{ color: 'white', fontSize: '0.8rem', fontWeight: '700', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', margin: 0 }}>
              Belum ada pemenang {isWordle ? 'Wordle' : (isAnagram ? 'Anagram' : (isLongWordle ? 'Long Wordle' : ''))}.<br />
              <span style={{ fontSize: '0.72rem', color: isWordle ? '#86efac' : (isAnagram ? '#93c5fd' : (isLongWordle ? '#c4b5fd' : '#fde68a')) }}>Tebak kata di live chat!</span>
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
