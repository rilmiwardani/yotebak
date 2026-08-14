import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function AdminDashboard() {
  const [roomInput, setRoomInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedHosts, setConnectedHosts] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [guessInput, setGuessInput] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [tikFinityConnected, setTikFinityConnected] = useState(false);
  const [anagramRows, setAnagramRows] = useState(3);
  const [wordLength, setWordLength] = useState(5);
  const [longWordLength, setLongWordLength] = useState(10);
  const [longAnagramRows, setLongAnagramRows] = useState(3);

  const peerRef = useRef(null);
  const connsRef = useRef([]); // Store array of connections to all active overlays in the room

  // Auto load saved room code from localStorage on mount
  useEffect(() => {
    const savedRoom = localStorage.getItem('wordle_room_code');
    if (savedRoom) {
      setRoomInput(savedRoom);
    }
  }, []);

  const handleConnect = (e) => {
    if (e) e.preventDefault();
    const targetRoom = roomInput.trim();
    if (!targetRoom || connecting) return;

    // Reset previous state and destroy old peer to ensure clean one-click connection
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) {}
      peerRef.current = null;
    }
    connsRef.current = [];
    setConnectedHosts([]);

    setConnecting(true);
    setRoomCode(targetRoom);
    localStorage.setItem('wordle_room_code', targetRoom);

    // Initialize PeerJS Client
    const peer = new Peer();
    peerRef.current = peer;

    const targetHosts = [
      `overlay-game-${targetRoom}`,
      `overlay-game-${targetRoom}-wordle`,
      `overlay-game-${targetRoom}-anagram`,
      `overlay-game-${targetRoom}-longwordle`,
      `overlay-game-${targetRoom}-longanagram`,
      `overlay-game-${targetRoom}-leaderboard`,
      `overlay-game-${targetRoom}-leaderboard-wordle`,
      `overlay-game-${targetRoom}-leaderboard-anagram`,
      `overlay-game-${targetRoom}-leaderboard-longwordle`,
      `overlay-game-${targetRoom}-leaderboard-longanagram`
    ];

    const connectToHost = (hostId) => {
      if (!peer || peer.destroyed || connsRef.current.some(c => c.peer === hostId && c.open)) return;

      try {
        const conn = peer.connect(hostId, { reliable: true });

        conn.on('open', () => {
          console.log(`Connected to Overlay host: ${hostId}`);
          if (!connsRef.current.some(c => c.peer === hostId)) {
            connsRef.current.push(conn);
          }
          setConnectedHosts(prev => [...new Set([...prev, hostId])]);
          setConnected(true);
          setConnecting(false);
        });

        conn.on('data', (data) => {
          if (data.type === 'gameState') {
            setGameState(data.state);
            if (data.state.anagramRows) {
              setAnagramRows(data.state.anagramRows);
            }
            
            // RELAY state to all OTHER connected overlays so they sync live (fix for isolated OBS browser sources)
            connsRef.current.forEach(c => {
              if (c.peer !== hostId && c.open) {
                c.send({ type: 'gameState', state: data.state });
              }
            });
          } else if (data.type === 'tikFinityStatus') {
            setTikFinityConnected(data.connected);
          }
        });

        conn.on('close', () => {
          connsRef.current = connsRef.current.filter(c => c.peer !== hostId);
          setConnectedHosts(prev => prev.filter(id => id !== hostId));
          if (connsRef.current.length === 0) {
            setConnected(false);
          }
        });

        conn.on('error', () => {
          connsRef.current = connsRef.current.filter(c => c.peer !== hostId);
          setConnectedHosts(prev => prev.filter(id => id !== hostId));
        });
      } catch (_) {}
    };

    peer.on('open', () => {
      console.log('Dashboard Peer open. Connecting to overlay instances for room:', targetRoom);
      targetHosts.forEach(hostId => connectToHost(hostId));

      // Stop spinner after 2.5s
      setTimeout(() => {
        setConnecting(false);
      }, 2500);
    });

    peer.on('disconnected', () => {
      console.log('Dashboard peer disconnected from signaling server. Reconnecting...');
      if (!peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS Client error:', err);
    });
  };

  const handleDisconnect = () => {
    connsRef.current.forEach(c => {
      try { c.close(); } catch (_) {}
    });
    connsRef.current = [];
    setConnectedHosts([]);

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) {}
    }
    peerRef.current = null;
    setConnected(false);
    setConnecting(false);
    setGameState(null);
  };

  // Broadcast message to all connected overlay instances
  const broadcastToOverlays = (msg) => {
    let sentCount = 0;
    connsRef.current.forEach(conn => {
      if (conn && conn.open) {
        conn.send(msg);
        sentCount++;
      }
    });
    return sentCount;
  };

  const handleStartGame = (mode) => {
    broadcastToOverlays({ 
      type: 'startGame', 
      mode,
      wordLength: (mode === 'longwordle' || mode === 'longanagram') ? longWordLength : wordLength,
      longWordLength: longWordLength,
      anagramRows: (mode === 'anagram' || mode === 'dual') ? anagramRows : undefined,
      longAnagramRows: mode === 'longanagram' ? longAnagramRows : undefined
    });
  };

  const handleLongWordLengthChange = (e) => {
    const val = parseInt(e.target.value);
    setLongWordLength(val);
    broadcastToOverlays({ type: 'updateLongWordLength', longWordLength: val });
  };

  const handleLongWordleMaxRowsChange = (e) => {
    const val = parseInt(e.target.value);
    broadcastToOverlays({ type: 'updateLongWordleMaxRows', maxRows: val });
  };

  const handleLongAnagramRowsChange = (e) => {
    const val = parseInt(e.target.value);
    setLongAnagramRows(val);
    broadcastToOverlays({ type: 'updateLongAnagramRows', longAnagramRows: val });
  };

  const handleSendGuess = (e) => {
    e.preventDefault();
    if (!guessInput.trim()) return;
    broadcastToOverlays({ type: 'adminGuess', guess: guessInput });
    setGuessInput('');
  };

  const handleMaxRowsChange = (e) => {
    const val = parseInt(e.target.value);
    broadcastToOverlays({ type: 'updateMaxRows', maxRows: val });
  };

  const handleAnagramRowsChange = (e) => {
    const val = parseInt(e.target.value);
    setAnagramRows(val);
    broadcastToOverlays({ type: 'updateAnagramRows', anagramRows: val });
  };

  const handleLeaderboardLimitChange = (e) => {
    const val = parseInt(e.target.value);
    broadcastToOverlays({ type: 'updateLeaderboardLimit', limit: val });
  };

  const handleResetLeaderboardConfirm = (target = 'all') => {
    const label = target === 'wordle' 
      ? 'Leaderboard WORDLE' 
      : (target === 'anagram' 
        ? 'Leaderboard ANAGRAM' 
        : (target === 'longwordle'
          ? 'Leaderboard LONG WORDLE'
          : (target === 'longanagram'
            ? 'Leaderboard LONG ANAGRAM'
            : 'SEMUA Leaderboard (Wordle, Anagram, Long Wordle, & Long Anagram)')));
    if (window.confirm(`⚠️ Yakin ingin mereset data ${label}? Poin kemenangan pemain akan dihapus.`)) {
      broadcastToOverlays({ type: 'resetLeaderboard', target });
    }
  };

  const copySpecificUrl = (url, key) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(''), 2000);
        })
        .catch((err) => {
          console.warn('Gagal clipboard API, mencoba fallback:', err);
          fallbackCopy(url, key);
        });
    } else {
      fallbackCopy(url, key);
    }
  };

  const fallbackCopy = (text, key) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedKey(key);
    } catch (err) {
      console.error('Fallback salin gagal:', err);
    }
    document.body.removeChild(textArea);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const currentRoom = roomInput.trim();
  const origin = window.location.origin;
  
  // Game URLs
  const urlCombined = currentRoom ? `${origin}/overlay?room=${currentRoom}` : '';
  const urlWordle = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=wordle` : '';
  const urlAnagram = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=anagram` : '';
  const urlLongWordle = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=longwordle` : '';
  const urlLongAnagram = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=longanagram` : '';
  
  // Separate Leaderboard URLs
  const urlLeaderboardWordle = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=leaderboard-wordle` : '';
  const urlLeaderboardAnagram = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=leaderboard-anagram` : '';
  const urlLeaderboardLongWordle = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=leaderboard-longwordle` : '';
  const urlLeaderboardLongAnagram = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=leaderboard-longanagram` : '';
  const urlLeaderboardBoth = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=leaderboard` : '';

  // Helper: check if a specific overlay host is actively connected
  const isHostActive = (suffix) => {
    const fullId = `overlay-game-${currentRoom}${suffix ? `-${suffix}` : ''}`;
    return connectedHosts.includes(fullId);
  };

  const activeCount = connectedHosts.length;

  return (
    <div style={{ padding: '2rem', maxWidth: '940px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.9rem', fontWeight: 'bold' }}>🎮 Dashboard TikFinity Games (Wordle, Anagram, Long Wordle & Long Anagram)</h1>
      
      {/* Connection Panel */}
      <div style={{ padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <div>
          <form onSubmit={handleConnect} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600' }}>Kode Kamar (Room Code):</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Masukkan nama live/kode unik Anda..." 
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  style={{ padding: '0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', fontSize: '1rem' }}
                  disabled={connected || connecting}
                />
                {!connected && !connecting && (
                  <button 
                    type="button"
                    onClick={() => setRoomInput(Math.random().toString(36).substring(2, 10).toUpperCase())}
                    style={{ padding: '0.6rem 1rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Acak Baru
                  </button>
                )}
              </div>
            </div>
            {!connected ? (
              <button 
                type="submit" 
                style={{ 
                  padding: '0.6rem 1.5rem', 
                  background: connecting ? '#9ca3af' : '#10b981', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: (connecting || !roomInput.trim()) ? 'default' : 'pointer', 
                  fontWeight: 'bold', 
                  fontSize: '1rem',
                  height: '42px'
                }}
                disabled={connecting || !roomInput.trim()}
              >
                {connecting ? 'Menghubungkan...' : 'Hubungkan ke OBS'}
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleDisconnect}
                style={{ 
                  padding: '0.6rem 1.5rem', 
                  background: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold', 
                  fontSize: '1rem',
                  height: '42px'
                }}
              >
                Putus Koneksi
              </button>
            )}
          </form>

          {/* Opsi URL Browser Source Terpisah / Gabungan */}
          {currentRoom && (
            <div style={{ marginTop: '1.2rem', padding: '1.1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                  🔗 Daftar URL Browser Source untuk OBS:
                </strong>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: '800', 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '999px',
                  backgroundColor: activeCount > 0 ? '#dcfce7' : '#f1f5f9',
                  color: activeCount > 0 ? '#15803d' : '#64748b',
                  border: activeCount > 0 ? '1px solid #86efac' : '1px solid #e2e8f0'
                }}>
                  {activeCount > 0 ? `🟢 ${activeCount} Overlay Terbuka di OBS` : '⚪ Belum ada Overlay di OBS'}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                
                {/* 1. Game Wordle Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#15803d' }}>
                    1. 🟩 Game Wordle Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('wordle') ? '#dcfce7' : '#f1f5f9',
                    color: isHostActive('wordle') ? '#15803d' : '#94a3b8',
                    border: isHostActive('wordle') ? '1px solid #86efac' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('wordle') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlWordle} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#f0fdf4', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlWordle, 'wordle')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'wordle' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 2. Game Anagram Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#1e40af' }}>
                    2. 🟦 Game Anagram Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('anagram') ? '#dbeafe' : '#f1f5f9',
                    color: isHostActive('anagram') ? '#1d4ed8' : '#94a3b8',
                    border: isHostActive('anagram') ? '1px solid #93c5fd' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('anagram') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlAnagram} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#eff6ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlAnagram, 'anagram')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'anagram' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 3. Leaderboard Wordle Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#166534' }}>
                    3. 🏆 Leaderboard Wordle Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('leaderboard-wordle') ? '#dcfce7' : '#f1f5f9',
                    color: isHostActive('leaderboard-wordle') ? '#15803d' : '#94a3b8',
                    border: isHostActive('leaderboard-wordle') ? '1px solid #86efac' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('leaderboard-wordle') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLeaderboardWordle} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#f0fdf4', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLeaderboardWordle, 'lb_wordle')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'lb_wordle' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 4. Leaderboard Anagram Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#1d4ed8' }}>
                    4. 🏆 Leaderboard Anagram Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('leaderboard-anagram') ? '#dbeafe' : '#f1f5f9',
                    color: isHostActive('leaderboard-anagram') ? '#1d4ed8' : '#94a3b8',
                    border: isHostActive('leaderboard-anagram') ? '1px solid #93c5fd' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('leaderboard-anagram') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLeaderboardAnagram} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#eff6ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLeaderboardAnagram, 'lb_anagram')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'lb_anagram' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 5. Dua Leaderboard Berdampingan */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#b45309' }}>
                    5. 🏆 Kedua Leaderboard (Berdampingan):
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('leaderboard') ? '#fef3c7' : '#f1f5f9',
                    color: isHostActive('leaderboard') ? '#b45309' : '#94a3b8',
                    border: isHostActive('leaderboard') ? '1px solid #fde68a' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('leaderboard') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLeaderboardBoth} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#fffbeb', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLeaderboardBoth, 'lb_both')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'lb_both' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 6. Game Gabungan */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#475569' }}>
                    6. 🎮 Game Gabungan (Wordle + Anagram):
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('') ? '#f1f5f9' : '#f1f5f9',
                    color: isHostActive('') ? '#334155' : '#94a3b8',
                    border: isHostActive('') ? '1px solid #cbd5e1' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlCombined} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#fff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlCombined, 'combined')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'combined' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 7. Game Long Wordle Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#6d28d9' }}>
                    7. 🟪 Game Long Wordle Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('longwordle') ? '#f3e8ff' : '#f1f5f9',
                    color: isHostActive('longwordle') ? '#7c3aed' : '#94a3b8',
                    border: isHostActive('longwordle') ? '1px solid #d8b4fe' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('longwordle') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLongWordle} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#faf5ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLongWordle, 'longwordle')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'longwordle' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 8. Leaderboard Long Wordle Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#5b21b6' }}>
                    8. 🏆 Leaderboard Long Wordle:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('leaderboard-longwordle') ? '#f3e8ff' : '#f1f5f9',
                    color: isHostActive('leaderboard-longwordle') ? '#7c3aed' : '#94a3b8',
                    border: isHostActive('leaderboard-longwordle') ? '1px solid #d8b4fe' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('leaderboard-longwordle') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLeaderboardLongWordle} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#faf5ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLeaderboardLongWordle, 'lb_longwordle')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#6d28d9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'lb_longwordle' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 9. Game Long Anagram Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#4338ca' }}>
                    9. 🧩 Game Long Anagram Saja:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('longanagram') ? '#eef2ff' : '#f1f5f9',
                    color: isHostActive('longanagram') ? '#4f46e5' : '#94a3b8',
                    border: isHostActive('longanagram') ? '1px solid #c7d2fe' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('longanagram') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLongAnagram} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#eef2ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLongAnagram, 'longanagram')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'longanagram' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 10. Leaderboard Long Anagram Saja */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', minWidth: '220px', color: '#3730a3' }}>
                    10. 🏆 Leaderboard Long Anagram:
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: '800', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px',
                    minWidth: '100px',
                    textAlign: 'center',
                    backgroundColor: isHostActive('leaderboard-longanagram') ? '#eef2ff' : '#f1f5f9',
                    color: isHostActive('leaderboard-longanagram') ? '#4f46e5' : '#94a3b8',
                    border: isHostActive('leaderboard-longanagram') ? '1px solid #c7d2fe' : '1px solid #e2e8f0'
                  }}>
                    {isHostActive('leaderboard-longanagram') ? '🟢 Aktif di OBS' : '⚪ Belum Aktif'}
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlLeaderboardLongAnagram} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#eef2ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlLeaderboardLongAnagram, 'lb_longanagram')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#4338ca', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'lb_longanagram' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

              </div>

              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', marginBottom: 0 }}>
                💡 <em>Badge hijau 🟢 menunjukkan Browser Source yang sedang aktif dibuka di OBS Anda.</em>
              </p>
            </div>
          )}

          {connected && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <p style={{ color: 'green', fontWeight: 'bold', fontSize: '0.9rem' }}>
                🟢 Terhubung ke OBS (Kamar: {roomCode}) - {activeCount} Overlay Terdeteksi
              </p>
              <p style={{ color: tikFinityConnected ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {tikFinityConnected ? '🟢 TikFinity Terhubung' : '🔴 TikFinity Tidak Terhubung'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Control Panel (Only visible when connected) */}
      <div style={{ display: 'flex', gap: '1.5rem', opacity: connected ? 1 : 0.5, pointerEvents: connected ? 'auto' : 'none' }}>
        <div style={{ flex: 1, padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Kontrol Game</h2>
          
          <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
            <button 
              onClick={() => handleStartGame('dual')}
              style={{ 
                padding: '1.1rem', 
                background: 'linear-gradient(135deg, #10b981 0%, #2563eb 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '1.15rem', 
                fontWeight: '800',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                transition: 'transform 0.1s'
              }}>
              🔥 Mulai Mode Dual (Wordle + Anagram Bersamaan)
            </button>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button 
                onClick={() => handleStartGame('wordle')}
                style={{ flex: 1, padding: '0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}>
                🟩 Mulai Wordle Saja
              </button>
              <button 
                onClick={() => handleStartGame('anagram')}
                style={{ flex: 1, padding: '0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}>
                🟦 Mulai Anagram Saja
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button 
                onClick={() => handleStartGame('longwordle')}
                style={{ 
                  flex: 1,
                  padding: '0.85rem', 
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontSize: '0.95rem', 
                  fontWeight: '800',
                  boxShadow: '0 3px 8px rgba(124, 58, 237, 0.25)'
                }}>
                🟪 Long Wordle Saja
              </button>
              <button 
                onClick={() => handleStartGame('longanagram')}
                style={{ 
                  flex: 1,
                  padding: '0.85rem', 
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontSize: '0.95rem', 
                  fontWeight: '800',
                  boxShadow: '0 3px 8px rgba(79, 70, 229, 0.25)'
                }}>
                🧩 Long Anagram Saja
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem' }}>📏 Panjang Kata Wordle Biasa (Jumlah Huruf):</label>
            <select 
              value={wordLength} 
              onChange={(e) => setWordLength(parseInt(e.target.value))}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={5}>5 Huruf</option>
              <option value={6}>6 Huruf</option>
              <option value={7}>7 Huruf</option>
            </select>
          </div>

          <div style={{ marginTop: '1.2rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem', color: '#6d28d9' }}>🟪/🧩 Panjang Kata Long Wordle & Long Anagram (10–15 Huruf):</label>
            <select 
              value={gameState?.longWordLength || longWordLength} 
              onChange={handleLongWordLengthChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #c4b5fd', background: '#faf5ff', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={10}>10 Huruf (4.420 Kata)</option>
              <option value={11}>11 Huruf (3.198 Kata)</option>
              <option value={12}>12 Huruf (2.214 Kata)</option>
              <option value={13}>13 Huruf (1.480 Kata)</option>
              <option value={14}>14 Huruf (886 Kata)</option>
              <option value={15}>15 Huruf (519 Kata)</option>
            </select>
          </div>

          <div style={{ marginTop: '1.2rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem' }}>📏 Baris Wordle di Layar:</label>
            <select 
              value={gameState?.maxRows || 6} 
              onChange={handleMaxRowsChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={3}>3 Baris</option>
              <option value={4}>4 Baris</option>
              <option value={5}>5 Baris</option>
              <option value={6}>6 Baris</option>
              <option value={7}>7 Baris</option>
              <option value={8}>8 Baris</option>
              <option value={10}>10 Baris</option>
            </select>
          </div>

          <div style={{ marginTop: '1.2rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem' }}>📝 Jumlah Baris Kata Anagram Biasa (1–6 Kata):</label>
            <select 
              value={gameState?.anagramRows || anagramRows} 
              onChange={handleAnagramRowsChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={1}>1 Kata (Single)</option>
              <option value={2}>2 Kata</option>
              <option value={3}>3 Kata (Default)</option>
              <option value={4}>4 Kata</option>
              <option value={5}>5 Kata</option>
              <option value={6}>6 Kata (Maksimal)</option>
            </select>
          </div>

          <div style={{ marginTop: '1.2rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem', color: '#4338ca' }}>🧩 Jumlah Baris Kata Long Anagram (1–6 Kata):</label>
            <select 
              value={gameState?.longAnagramRows || longAnagramRows} 
              onChange={handleLongAnagramRowsChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #c7d2fe', background: '#eef2ff', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={1}>1 Kata (Single)</option>
              <option value={2}>2 Kata</option>
              <option value={3}>3 Kata (Default)</option>
              <option value={4}>4 Kata</option>
              <option value={5}>5 Kata</option>
              <option value={6}>6 Kata (Maksimal)</option>
            </select>
          </div>

          {/* LEADERBOARD CONTROLS */}
          <div style={{ marginTop: '1.2rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem' }}>🏆 Jumlah Baris Leaderboard (Maks 20):</label>
            <select 
              value={gameState?.maxLeaderboardRows || 10} 
              onChange={handleLeaderboardLimitChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '0.95rem' }}
            >
              <option value={3}>3 Teratas</option>
              <option value={5}>5 Teratas</option>
              <option value={8}>8 Teratas</option>
              <option value={10}>10 Teratas (Default)</option>
              <option value={15}>15 Teratas</option>
              <option value={20}>20 Teratas (Maksimal)</option>
            </select>

            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.8rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  onClick={() => handleResetLeaderboardConfirm('wordle')}
                  style={{ flex: 1, minWidth: '100px', padding: '0.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                >
                  🔄 Reset Wordle
                </button>
                <button 
                  type="button"
                  onClick={() => handleResetLeaderboardConfirm('anagram')}
                  style={{ flex: 1, minWidth: '100px', padding: '0.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                >
                  🔄 Reset Anagram
                </button>
                <button 
                  type="button"
                  onClick={() => handleResetLeaderboardConfirm('longwordle')}
                  style={{ flex: 1, minWidth: '100px', padding: '0.5rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                >
                  🔄 Reset Long Wordle
                </button>
                <button 
                  type="button"
                  onClick={() => handleResetLeaderboardConfirm('longanagram')}
                  style={{ flex: 1, minWidth: '100px', padding: '0.5rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                >
                  🔄 Reset Long Anagram
                </button>
              </div>
              <button 
                type="button"
                onClick={() => handleResetLeaderboardConfirm('all')}
                style={{ width: '100%', padding: '0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
              >
                ⚠️ Reset Semua Poin Leaderboard (Wordle, Anagram, Long Wordle, & Long Anagram)
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.2rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🧪 Tes Tebak (Simulasi Admin)</h3>
            <form onSubmit={handleSendGuess} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder={
                  gameState?.mode === 'longwordle' 
                    ? `Tebak Long Wordle (${gameState?.longWordLength || 10} huruf)...` 
                    : (gameState?.mode === 'longanagram'
                      ? `Tebak salah satu kata Long Anagram (${gameState?.longWordLength || 10} huruf)...`
                      : (gameState?.mode === 'dual' 
                        ? `Tebak Wordle (${gameState?.wordLength || 5} huruf) atau kata Anagram...` 
                        : (gameState?.mode === 'wordle' 
                          ? `Tebak kata (${gameState?.wordLength || 5} huruf)...` 
                          : "Tebak salah satu kata anagram...")))
                } 
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                style={{ padding: '0.5rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Kirim
              </button>
            </form>
          </div>
        </div>

        <div style={{ flex: 1, padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1rem' }}>📊 Status Saat Ini</h2>
          {gameState ? (
            <div>
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>Mode Aktif:</strong>
                <span style={{ 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '6px', 
                  color: 'white', 
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  background: gameState.mode === 'dual' 
                    ? 'linear-gradient(135deg, #10b981 0%, #2563eb 100%)' 
                    : (gameState.mode === 'longwordle' ? '#7c3aed' : (gameState.mode === 'longanagram' ? '#4f46e5' : (gameState.mode === 'wordle' ? '#10b981' : '#2563eb')))
                }}>
                  {gameState.mode === 'dual' ? '🔥 DUAL (WORDLE + ANAGRAM)' : (gameState.mode === 'longwordle' ? '🟪 LONG WORDLE' : (gameState.mode === 'longanagram' ? '🧩 LONG ANAGRAM' : gameState.mode?.toUpperCase()))}
                </span>
              </div>
              
              {/* LONG WORDLE STATUS BLOCK */}
              {gameState.mode === 'longwordle' && (
                <div style={{ padding: '0.8rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ color: '#6d28d9' }}>🟪 Long Wordle ({gameState.longWordLength || 10} Huruf):</strong>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      color: gameState.longWordleStatus === 'won' ? '#16a34a' : '#7c3aed' 
                    }}>
                      {gameState.longWordleStatus === 'won' ? '✅ Selesai (Won)' : '🎮 Sedang Berlangsung'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem' }}>Kata Target: <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#7c3aed' }}>{gameState.longWordleTargetWord || gameState.targetWord}</span></p>
                  <p style={{ fontSize: '0.9rem' }}>Tebakan Masuk: <strong>{gameState.longWordleGuesses?.length || (gameState.mode === 'longwordle' ? gameState.guesses?.length : 0) || 0}</strong></p>
                  {gameState.longWordleWinner && (
                    <p style={{ fontSize: '0.85rem', color: '#6d28d9', marginTop: '0.2rem' }}>
                      Pemenang: <strong>{gameState.longWordleWinner.nickname}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* LONG ANAGRAM STATUS BLOCK */}
              {gameState.mode === 'longanagram' && (
                <div style={{ padding: '0.8rem', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ color: '#4338ca' }}>🧩 Long Anagram ({gameState.longWordLength || 10} Huruf):</strong>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      color: gameState.longAnagramStatus === 'won' ? '#16a34a' : '#4f46e5' 
                    }}>
                      {gameState.longAnagramStatus === 'won' 
                        ? '✅ Semua Tertebak' 
                        : `🎮 ${gameState.longAnagramWords?.filter(w => w.solved).length || 0} / ${gameState.longAnagramWords?.length || 1} Tertebak`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                    {(gameState.longAnagramWords || []).map((item, idx) => (
                      <div key={idx} style={{ 
                        padding: '0.4rem 0.6rem', 
                        borderRadius: '4px', 
                        background: item.solved ? '#e6f4ea' : 'white', 
                        border: item.solved ? '1px solid #c3e6cb' : '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem'
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#6b7280', marginRight: '0.3rem' }}>#{idx + 1}</span>
                          <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: item.solved ? '#2b8a3e' : '#1f2937' }}>
                            {item.targetWord}
                          </span>
                          <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            (Acak: <strong style={{ color: '#4f46e5', textTransform: 'uppercase' }}>{item.scrambledWord}</strong>)
                          </span>
                        </div>
                        <div>
                          {item.solved ? (
                            <span style={{ fontSize: '0.75rem', color: '#2b8a3e', fontWeight: 'bold' }}>
                              ✅ {item.winner?.nickname || 'Tertebak'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold' }}>
                              ⏳ Belum
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WORDLE STATUS BLOCK */}
              {gameState.mode !== 'longwordle' && gameState.mode !== 'longanagram' && (
                <div style={{ padding: '0.8rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ color: '#166534' }}>🟩 Wordle:</strong>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      color: gameState.wordleStatus === 'won' ? '#16a34a' : '#2563eb' 
                    }}>
                      {gameState.wordleStatus === 'won' ? '✅ Selesai (Won)' : '🎮 Sedang Berlangsung'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem' }}>Kata Target: <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#15803d' }}>{gameState.targetWord}</span></p>
                  <p style={{ fontSize: '0.9rem' }}>Tebakan Masuk: <strong>{gameState.guesses?.length || 0}</strong></p>
                  {gameState.wordleWinner && (
                    <p style={{ fontSize: '0.85rem', color: '#166534', marginTop: '0.2rem' }}>
                      Pemenang: <strong>{gameState.wordleWinner.nickname}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* ANAGRAM STATUS BLOCK */}
              {gameState.mode !== 'longwordle' && gameState.mode !== 'longanagram' && (
                <div style={{ padding: '0.8rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ color: '#1e40af' }}>🟦 Anagram:</strong>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      color: gameState.anagramStatus === 'won' ? '#16a34a' : '#2563eb' 
                    }}>
                      {gameState.anagramStatus === 'won' 
                        ? '✅ Semua Tertebak' 
                        : `🎮 ${gameState.anagramWords?.filter(w => w.solved).length || 0} / ${gameState.anagramWords?.length || 1} Tertebak`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                    {(gameState.anagramWords || []).map((item, idx) => (
                      <div key={idx} style={{ 
                        padding: '0.4rem 0.6rem', 
                        borderRadius: '4px', 
                        background: item.solved ? '#e6f4ea' : 'white', 
                        border: item.solved ? '1px solid #c3e6cb' : '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.85rem'
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#6b7280', marginRight: '0.3rem' }}>#{idx + 1}</span>
                          <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: item.solved ? '#2b8a3e' : '#1f2937' }}>
                            {item.targetWord}
                          </span>
                          <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            (Acak: <strong style={{ color: '#2563eb', textTransform: 'uppercase' }}>{item.scrambledWord}</strong>)
                          </span>
                        </div>
                        <div>
                          {item.solved ? (
                            <span style={{ fontSize: '0.75rem', color: '#2b8a3e', fontWeight: 'bold' }}>
                              ✅ {item.winner?.nickname || 'Tertebak'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold' }}>
                              ⏳ Belum
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LIVE LEADERBOARD PREVIEWS */}
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem' }}>
                {gameState.mode === 'longwordle' ? (
                  /* LONG WORDLE LEADERBOARD PREVIEW */
                  <div style={{ flex: 1, padding: '0.7rem', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <strong style={{ color: '#6d28d9', fontSize: '0.82rem' }}>🟪 Top Long Wordle:</strong>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#7c3aed' }}>
                        {gameState.longWordleLeaderboard?.length || 0} Pemain
                      </span>
                    </div>
                    {(gameState.longWordleLeaderboard || []).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '130px', overflowY: 'auto' }}>
                        {(gameState.longWordleLeaderboard || []).slice(0, 5).map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 'bold' }}>{idx === 0 ? '🥇' : `#${idx+1}`} {p.nickname}</span>
                            <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{p.points} Pts</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.75rem', color: '#6d28d9', margin: 0 }}>Belum ada pemenang.</p>
                    )}
                  </div>
                ) : gameState.mode === 'longanagram' ? (
                  /* LONG ANAGRAM LEADERBOARD PREVIEW */
                  <div style={{ flex: 1, padding: '0.7rem', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <strong style={{ color: '#4338ca', fontSize: '0.82rem' }}>🧩 Top Long Anagram:</strong>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4f46e5' }}>
                        {gameState.longAnagramLeaderboard?.length || 0} Pemain
                      </span>
                    </div>
                    {(gameState.longAnagramLeaderboard || []).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '130px', overflowY: 'auto' }}>
                        {(gameState.longAnagramLeaderboard || []).slice(0, 5).map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: 'bold' }}>{idx === 0 ? '🥇' : `#${idx+1}`} {p.nickname}</span>
                            <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{p.points} Pts</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.75rem', color: '#4338ca', margin: 0 }}>Belum ada pemenang.</p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* WORDLE LEADERBOARD PREVIEW */}
                    <div style={{ flex: 1, padding: '0.7rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <strong style={{ color: '#166534', fontSize: '0.82rem' }}>🟩 Top Wordle:</strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#15803d' }}>
                          {gameState.wordleLeaderboard?.length || 0} Pemain
                        </span>
                      </div>
                      {(gameState.wordleLeaderboard || []).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '130px', overflowY: 'auto' }}>
                          {(gameState.wordleLeaderboard || []).slice(0, 5).map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                              <span style={{ fontWeight: 'bold' }}>{idx === 0 ? '🥇' : `#${idx+1}`} {p.nickname}</span>
                              <span style={{ color: '#15803d', fontWeight: 'bold' }}>{p.points} Pts</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: '#166534', margin: 0 }}>Belum ada pemenang.</p>
                      )}
                    </div>

                    {/* ANAGRAM LEADERBOARD PREVIEW */}
                    <div style={{ flex: 1, padding: '0.7rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <strong style={{ color: '#1e40af', fontSize: '0.82rem' }}>🟦 Top Anagram:</strong>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#1d4ed8' }}>
                          {gameState.anagramLeaderboard?.length || 0} Pemain
                        </span>
                      </div>
                      {(gameState.anagramLeaderboard || []).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '130px', overflowY: 'auto' }}>
                          {(gameState.anagramLeaderboard || []).slice(0, 5).map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                              <span style={{ fontWeight: 'bold' }}>{idx === 0 ? '🥇' : `#${idx+1}`} {p.nickname}</span>
                              <span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>{p.points} Pts</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: '#1e40af', margin: 0 }}>Belum ada pemenang.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* POOL TRACKING PROGRESS */}
              <div style={{ padding: '0.6rem 0.8rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                    📚 Pool Kata Digunakan:
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: (gameState.mode === 'longwordle' || gameState.mode === 'longanagram') ? '#7c3aed' : '#2563eb' }}>
                    {(gameState.mode === 'longwordle' || gameState.mode === 'longanagram') ? `${gameState.longPoolPlayed || 0} / ${gameState.longPoolTotal || 4420}` : `${gameState.poolPlayed || 0} / ${gameState.poolTotal || 1958}`} Kata
                  </span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min((((gameState.mode === 'longwordle' || gameState.mode === 'longanagram') ? (gameState.longPoolPlayed || 0) : (gameState.poolPlayed || 0)) / ((gameState.mode === 'longwordle' || gameState.mode === 'longanagram') ? (gameState.longPoolTotal || 4420) : (gameState.poolTotal || 1958))) * 100, 100)}%`,
                    height: '100%',
                    backgroundColor: (gameState.mode === 'longwordle' || gameState.mode === 'longanagram') ? '#7c3aed' : '#2563eb',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.35rem', marginBottom: 0 }}>
                  ✨ <em>Kata target tidak akan pernah diulang sampai seluruh pool kata habis.</em>
                </p>
              </div>

            </div>
          ) : (
            <p>Masukkan Kode Kamar dan hubungkan ke OBS untuk melihat status permainan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
