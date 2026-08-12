import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function AdminDashboard() {
  const [roomInput, setRoomInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [tikFinityConnected, setTikFinityConnected] = useState(false);
  const [anagramRows, setAnagramRows] = useState(3);

  const peerRef = useRef(null);
  const connsRef = useRef([]);

  // Generate a brand new unique room code every time the page loads
  useEffect(() => {
    const randCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomInput(randCode);
  }, []);

  const handleConnect = (e) => {
    e.preventDefault();
    const targetRoom = roomInput.trim();
    if (!targetRoom || connecting) return;

    setConnecting(true);
    setRoomCode(targetRoom);
    localStorage.setItem('wordle_room_code', targetRoom);

    // Initialize PeerJS Client
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('Dashboard Peer open. Connecting to all overlay instances for room:', targetRoom);
      
      const targetHosts = [
        `overlay-game-${targetRoom}`,
        `overlay-game-${targetRoom}-wordle`,
        `overlay-game-${targetRoom}-anagram`
      ];

      connsRef.current = [];

      targetHosts.forEach((hostId) => {
        const conn = peer.connect(hostId, { reliable: true });

        conn.on('open', () => {
          console.log(`Connected to Overlay host: ${hostId}`);
          if (!connsRef.current.some(c => c.peer === hostId)) {
            connsRef.current.push(conn);
          }
          setConnected(true);
          setConnecting(false);
        });

        conn.on('data', (data) => {
          if (data.type === 'gameState') {
            setGameState(data.state);
            if (data.state.anagramRows) {
              setAnagramRows(data.state.anagramRows);
            }
          } else if (data.type === 'tikFinityStatus') {
            setTikFinityConnected(data.connected);
          }
        });

        conn.on('close', () => {
          connsRef.current = connsRef.current.filter(c => c.peer !== hostId);
          if (connsRef.current.length === 0) {
            setConnected(false);
          }
        });

        conn.on('error', (err) => {
          console.warn(`Connection error on ${hostId}:`, err);
          connsRef.current = connsRef.current.filter(c => c.peer !== hostId);
          if (connsRef.current.length === 0) {
            setConnected(false);
          }
        });
      });

      // Timeout safety for connection
      setTimeout(() => {
        setConnecting(false);
      }, 4000);
    });

    peer.on('disconnected', () => {
      console.log('Dashboard peer disconnected from signaling server. Reconnecting...');
      if (!peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS Client error:', err);
      handleDisconnect();
    });
  };

  const handleDisconnect = () => {
    connsRef.current.forEach(c => {
      try { c.close(); } catch (_) {}
    });
    connsRef.current = [];

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
      anagramRows: (mode === 'anagram' || mode === 'dual') ? anagramRows : undefined
    });
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
  const urlCombined = currentRoom ? `${origin}/overlay?room=${currentRoom}` : '';
  const urlWordle = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=wordle` : '';
  const urlAnagram = currentRoom ? `${origin}/overlay?room=${currentRoom}&view=anagram` : '';

  return (
    <div style={{ padding: '2rem', maxWidth: '850px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.9rem', fontWeight: 'bold' }}>🎮 Dashboard TikFinity Wordle & Anagram (Serverless P2P)</h1>
      
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
                Putuskan Koneksi
              </button>
            )}
          </form>

          {/* PILIHAN URL OVERLAY OBS (Bisa Gabungan atau Terpisah) */}
          {currentRoom && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <p style={{ fontWeight: '700', marginBottom: '0.6rem', color: '#1f2937' }}>
                🔗 Pilihan URL Browser Source untuk OBS:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {/* 1. Gabungan */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', minWidth: '170px' }}>
                    1. Gabungan (Sesuai Mode):
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlCombined} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#f9fafb', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlCombined, 'combined')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'combined' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>

                {/* 2. Khusus Wordle */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', minWidth: '170px', color: '#166534' }}>
                    2. Khusus Wordle Saja:
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

                {/* 3. Khusus Anagram */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', minWidth: '170px', color: '#6b21a8' }}>
                    3. Khusus Anagram Saja:
                  </span>
                  <input 
                    type="text" 
                    readOnly 
                    value={urlAnagram} 
                    style={{ padding: '0.4rem 0.6rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#faf5ff', fontSize: '0.85rem' }} 
                    onClick={(e) => e.target.select()}
                  />
                  <button 
                    onClick={() => copySpecificUrl(urlAnagram, 'anagram')} 
                    style={{ padding: '0.4rem 0.8rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {copiedKey === 'anagram' ? 'Disalin! ✅' : 'Copy URL'}
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                💡 <em>Tip: Gunakan <strong>URL Wordle Saja</strong> dan <strong>URL Anagram Saja</strong> sebagai 2 Browser Source terpisah di OBS agar Anda bisa bebas menggeser, memperbesar, dan mengatur posisi kedua papan secara mandiri!</em>
              </p>
            </div>
          )}

          {connected && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <p style={{ color: 'green', fontWeight: 'bold', fontSize: '0.9rem' }}>
                🟢 Terhubung ke OBS (Kamar: {roomCode}) - {connsRef.current.length} Overlay Aktif
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
                background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)', 
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
                style={{ flex: 1, padding: '0.8rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}>
                🟪 Mulai Anagram Saja
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '1rem' }}>📏 Baris Wordle di Layar:</label>
            <select 
              value={gameState?.maxRows || 6} 
              onChange={handleMaxRowsChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '1rem' }}
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '1rem' }}>📝 Jumlah Baris Kata Anagram (1–6 Kata):</label>
            <select 
              value={gameState?.anagramRows || anagramRows} 
              onChange={handleAnagramRowsChange}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', fontSize: '1rem' }}
            >
              <option value={1}>1 Kata (Single)</option>
              <option value={2}>2 Kata</option>
              <option value={3}>3 Kata (Default)</option>
              <option value={4}>4 Kata</option>
              <option value={5}>5 Kata</option>
              <option value={6}>6 Kata (Maksimal)</option>
            </select>
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🧪 Tes Tebak (Simulasi Admin)</h3>
            <form onSubmit={handleSendGuess} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder={gameState?.mode === 'dual' ? "Tebak Wordle (5 huruf) atau kata Anagram..." : (gameState?.mode === 'wordle' ? "Tebak kata (5 huruf)..." : "Tebak salah satu kata anagram...")} 
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
                    ? 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)' 
                    : (gameState.mode === 'wordle' ? '#10b981' : '#8b5cf6')
                }}>
                  {gameState.mode === 'dual' ? '🔥 DUAL (WORDLE + ANAGRAM)' : gameState.mode?.toUpperCase()}
                </span>
              </div>
              
              {/* WORDLE STATUS BLOCK */}
              {(gameState.mode === 'wordle' || gameState.mode === 'dual') && (
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
              {(gameState.mode === 'anagram' || gameState.mode === 'dual') && (
                <div style={{ padding: '0.8rem', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <strong style={{ color: '#5b21b6' }}>🟪 Anagram:</strong>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold', 
                      color: gameState.anagramStatus === 'won' ? '#16a34a' : '#7c3aed' 
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
                            (Acak: <strong style={{ color: '#8b5cf6', textTransform: 'uppercase' }}>{item.scrambledWord}</strong>)
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

            </div>
          ) : (
            <p>Masukkan Kode Kamar dan hubungkan ke OBS untuk melihat status permainan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
