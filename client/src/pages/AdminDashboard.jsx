import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function AdminDashboard() {
  const [roomInput, setRoomInput] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [tikFinityConnected, setTikFinityConnected] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);

  // Generate a brand new unique room code every time the page loads
  useEffect(() => {
    const randCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setRoomInput(randCode);
  }, []);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!roomInput.trim() || connecting) return;

    setConnecting(true);
    setRoomCode(roomInput.trim());
    localStorage.setItem('wordle_room_code', roomInput.trim());

    // Initialize PeerJS Client
    // We let PeerJS generate a random Peer ID for the dashboard
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', () => {
      console.log('Dashboard Peer open. Connecting to overlay host...');
      const hostId = `overlay-game-${roomInput.trim()}`;
      const conn = peer.connect(hostId, { reliable: true });
      connRef.current = conn;

      conn.on('open', () => {
        setConnected(true);
        setConnecting(false);
        console.log('Connected to Overlay Peer host!');
      });

      conn.on('data', (data) => {
        if (data.type === 'gameState') {
          setGameState(data.state);
        } else if (data.type === 'tikFinityStatus') {
          setTikFinityConnected(data.connected);
        }
      });

      conn.on('close', () => {
        handleDisconnect();
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        handleDisconnect();
      });
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
    if (connRef.current) connRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    connRef.current = null;
    peerRef.current = null;
    setConnected(false);
    setConnecting(false);
    setGameState(null);
  };

  const handleStartGame = (mode) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'startGame', mode });
    }
  };

  const handleSendGuess = (e) => {
    e.preventDefault();
    if (!guessInput.trim() || !connRef.current || !connRef.current.open) return;
    connRef.current.send({ type: 'adminGuess', guess: guessInput });
    setGuessInput('');
  };

  const handleMaxRowsChange = (e) => {
    const val = parseInt(e.target.value);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ type: 'updateMaxRows', maxRows: val });
    }
  };

  const copyUrl = () => {
    const targetRoom = roomInput.trim();
    if (!targetRoom) return;
    const url = `${window.location.origin}/overlay?room=${targetRoom}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopyStatus('Disalin!');
          setTimeout(() => setCopyStatus(''), 2000);
        })
        .catch((err) => {
          console.warn('Gagal dengan clipboard API, mencoba fallback:', err);
          fallbackCopy(url);
        });
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyStatus('Disalin!');
    } catch (err) {
      console.error('Fallback salin gagal:', err);
      setCopyStatus('Gagal!');
    }
    document.body.removeChild(textArea);
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '2rem', fontWeight: 'bold' }}>🎮 Dashboard TikFinity Wordle & Anagram (Serverless P2P)</h1>
      
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

          {/* Selalu tampilkan URL Overlay untuk memudahkan menyalin URL sebelum konek */}
          {roomInput.trim() && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <p style={{ fontWeight: '500', minWidth: '160px' }}>Overlay URL untuk OBS:</p>
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}/overlay?room=${roomInput.trim()}`} 
                style={{ padding: '0.5rem', flex: 1, borderRadius: '4px', border: '1px solid #ccc', background: '#f3f4f6', cursor: 'pointer' }} 
                onClick={(e) => e.target.select()}
              />
              <button onClick={copyUrl} style={{ padding: '0.5rem 1rem', background: '#38bdf8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                {copyStatus || 'Copy URL'}
              </button>
            </div>
          )}

          {connected && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <p style={{ color: 'green', fontWeight: 'bold', fontSize: '0.9rem' }}>
                🟢 Terhubung ke OBS (Kamar: {roomCode})
              </p>
              <p style={{ color: tikFinityConnected ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {tikFinityConnected ? '🟢 TikFinity Terhubung' : '🔴 TikFinity Tidak Terhubung'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Control Panel (Only visible when connected) */}
      <div style={{ display: 'flex', gap: '2rem', opacity: connected ? 1 : 0.5, pointerEvents: connected ? 'auto' : 'none' }}>
        <div style={{ flex: 1, padding: '1.5rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1rem' }}>⚙️ Kontrol Game</h2>
          
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button 
              onClick={() => handleStartGame('wordle')}
              style={{ padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>
              Mulai Wordle Baru (Acak)
            </button>
            <button 
              onClick={() => handleStartGame('anagram')}
              style={{ padding: '1rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}>
              Mulai Anagram Baru (Acak)
            </button>
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

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🧪 Tes Tebak (Simulasi Admin)</h3>
            <form onSubmit={handleSendGuess} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder={gameState?.mode === 'wordle' ? "Tebak kata (5 huruf)..." : "Tebak kata..."} 
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
              <p><strong>Mode:</strong> {gameState.mode.toUpperCase()}</p>
              <p><strong>Kata Target:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#2b8a3e' }}>{gameState.targetWord}</span></p>
              {gameState.mode === 'anagram' && <p><strong>Huruf Acak:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{gameState.scrambledWord}</span></p>}
              <p><strong>Status Game:</strong> {
                gameState.status === 'won' ? <span style={{ color: 'green', fontWeight: 'bold' }}>Selesai (Won)</span> : 'Bermain'
              }</p>
              <p><strong>Total Tebakan:</strong> {gameState.guesses.length}</p>
              {gameState.winner && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#e6f4ea', border: '1px solid #c3e6cb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={gameState.winner.profilePic} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="winner" />
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Pemenang:</p>
                    <p style={{ fontWeight: 'bold', color: '#1f2937' }}>{gameState.winner.nickname}</p>
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
