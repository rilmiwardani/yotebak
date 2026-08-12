import React, { useState, useEffect, useRef } from 'react';

export default function LeaderboardBoard({ 
  gameState, 
  type = 'wordle', // 'wordle' | 'anagram' | 'all'
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
  } else {
    playersList = gameState?.leaderboard || gameState?.wordleLeaderboard || [];
  }

  const displayedPlayers = playersList.slice(0, limit);

  // Visual Theme per game type
  const isWordle = type === 'wordle';
  const isAnagram = type === 'anagram';

  const defaultIcon = isWordle ? '🟩' : (isAnagram ? '🟦' : '🏆');
  const defaultTitle = isWordle ? 'Top Wordle' : (isAnagram ? 'Top Anagram' : 'Top Pemenang');
  const defaultAccent = isWordle ? '#16a34a' : (isAnagram ? '#2563eb' : '#f59e0b');

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
        // If rank improved (overtake) or points increased
        if (currentRank < prevRank || (player.points > prevPoints)) {
          newAnimated[player.nickname] = true;
        }
      }
      // Update memory
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

  // Rank badge styling helper
  const getRankBadge = (rank) => {
    if (rank === 0) {
      return {
        bg: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
        color: '#ffffff',
        border: '1px solid #fef08a',
        icon: '🥇',
        text: '1',
        shadow: '0 2px 6px rgba(245, 158, 11, 0.4)'
      };
    }
    if (rank === 1) {
      return {
        bg: 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)',
        color: '#ffffff',
        border: '1px solid #f1f5f9',
        icon: '🥈',
        text: '2',
        shadow: '0 2px 6px rgba(100, 116, 139, 0.3)'
      };
    }
    if (rank === 2) {
      return {
        bg: 'linear-gradient(135deg, #f97316 0%, #b45309 100%)',
        color: '#ffffff',
        border: '1px solid #fed7aa',
        icon: '🥉',
        text: '3',
        shadow: '0 2px 6px rgba(180, 83, 9, 0.3)'
      };
    }
    return {
      bg: '#334155',
      color: '#cbd5e1',
      border: '1px solid rgba(255,255,255,0.15)',
      icon: null,
      text: `#${rank + 1}`,
      shadow: '0 1px 3px rgba(0,0,0,0.2)'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '320px' }}>
      
      {/* Header Info (Compact Matching Style) */}
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
        marginBottom: '0.15rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '1.2rem' }}>{icon}</span>
          <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1f2937', margin: 0 }}>
            {title}
          </h2>
        </div>
        <div style={{ 
          backgroundColor: accent, 
          color: 'white', 
          fontSize: '0.8rem', 
          fontWeight: '800', 
          padding: '0.2rem 0.6rem', 
          borderRadius: '999px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}>
          {displayedPlayers.length} / {limit} Peringkat
        </div>
      </div>

      {/* Leaderboard Players List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {displayedPlayers.length > 0 ? (
          displayedPlayers.map((player, idx) => {
            const badge = getRankBadge(idx);
            const isRankUp = animatedPlayers[player.nickname];

            return (
              <div 
                key={player.nickname || idx}
                className={`leaderboard-row-animated ${isRankUp ? 'leaderboard-rank-up' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.65rem',
                  backgroundColor: isRankUp 
                    ? (isWordle ? 'rgba(22, 163, 74, 0.4)' : (isAnagram ? 'rgba(37, 99, 235, 0.4)' : 'rgba(245, 158, 11, 0.35)'))
                    : (idx === 0 ? 'rgba(30, 41, 59, 0.75)' : 'rgba(15, 23, 42, 0.65)'),
                  borderRadius: '8px',
                  border: isRankUp 
                    ? `2px solid ${accent}` 
                    : (idx === 0 ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)'),
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                  transform: isRankUp ? 'scale(1.02)' : 'scale(1)'
                }}
              >
                {/* Left Section: Rank + Avatar + Nickname */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  {/* Rank Badge */}
                  <div style={{
                    minWidth: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '6px',
                    background: badge.bg,
                    color: badge.color,
                    border: badge.border,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: badge.icon ? '0.9rem' : '0.8rem',
                    fontWeight: '800',
                    boxShadow: badge.shadow,
                    flexShrink: 0
                  }}>
                    {badge.icon || badge.text}
                  </div>

                  {/* Avatar */}
                  <img 
                    src={player.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.nickname)}&background=2563eb&color=fff`} 
                    alt="avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.nickname)}&background=2563eb&color=fff`;
                    }}
                    style={{
                      width: '2.1rem',
                      height: '2.1rem',
                      borderRadius: '6px',
                      border: idx === 0 ? '2px solid #fbbf24' : '1.5px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />

                  {/* Nickname */}
                  <span style={{
                    fontWeight: '800',
                    color: 'white',
                    fontSize: '0.92rem',
                    maxWidth: '125px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: '1px 1px 3px rgba(0,0,0,0.95)'
                  }}>
                    {player.nickname}
                  </span>
                </div>

                {/* Right Section: Score Badge */}
                <div 
                  className={isRankUp ? 'score-badge-pop' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    backgroundColor: idx === 0 ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '800',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                    border: idx === 0 ? '1px solid #fef08a' : '1px solid rgba(255,255,255,0.25)'
                  }}
                >
                  <span>⭐</span>
                  <span>{player.points || 0} Pts</span>
                </div>

              </div>
            );
          })
        ) : (
          <div style={{
            padding: '1.2rem',
            textAlign: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}>
            <p style={{ color: 'white', fontSize: '0.85rem', fontWeight: '700', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', margin: 0 }}>
              {icon} Belum ada pemenang {isWordle ? 'Wordle' : (isAnagram ? 'Anagram' : '')}.<br />
              <span style={{ fontSize: '0.75rem', color: isWordle ? '#86efac' : '#93c5fd' }}>Yuk mulai tebak kata di live chat!</span>
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
