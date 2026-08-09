import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import WordleBoard from '../components/WordleBoard';
import AnagramBoard from '../components/AnagramBoard';
import WinCard from '../components/WinCard';
import TimeoutCard from '../components/TimeoutCard';

export default function Overlay() {
  // Game state (Wordle & Anagram)
  const [gameState, setGameState] = useState({
    mode: 'wordle',
    targetWord: 'buku',
    scrambledWord: '',
    guesses: [],
    status: 'playing',
    winner: null,
    maxRows: 6,
  });

  const [winState, setWinState] = useState({ show: false, winner: null, word: '', mode: '' });
  const [timeoutState, setTimeoutState] = useState({ show: false, word: '' });

  // TikFinity connection status
  const tikFinityConnectedRef = useRef(false);

  // Auto-restart: track when game ended (using real timestamp, not setTimeout)
  const RESTART_DELAY_MS = 10000;
  const endedAtRef = useRef(null);

  // Word databases
  const targetWordsRef = useRef([]);
  const validWordsSetRef = useRef(new Set());
  const playedWordsRef = useRef(new Set());

  // WebRTC refs
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const [roomCode, setRoomCode] = useState('');

  // Keep refs of gameState, playedWords, etc. to avoid closure stale state in async callbacks
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Robust auto-restart: uses Date.now() to check real elapsed time
  // This is immune to browser timer throttling in background tabs / embedded browsers
  useEffect(() => {
    if (gameState.status !== 'won' && gameState.status !== 'lost') {
      endedAtRef.current = null;
      return;
    }

    // Record the timestamp when game ended (only once)
    if (!endedAtRef.current) {
      endedAtRef.current = Date.now();
    }

    const checkRestart = setInterval(() => {
      if (!endedAtRef.current) {
        clearInterval(checkRestart);
        return;
      }
      const elapsed = Date.now() - endedAtRef.current;
      if (elapsed >= RESTART_DELAY_MS) {
        clearInterval(checkRestart);
        endedAtRef.current = null;
        initGame(gameStateRef.current.mode);
      }
    }, 1000);

    return () => clearInterval(checkRestart);
  }, [gameState.status, gameState.targetWord]);

  // 1. Fetch word list files
  useEffect(() => {
    document.body.classList.add('bg-magenta');

    const loadWords = async () => {
      try {
        const targetRes = await fetch('/target_words_id.txt');
        const targetText = await targetRes.text();
        const targets = targetText.split('\n')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length === 5);
        targetWordsRef.current = targets;

        const validRes = await fetch('/valid_words_id.txt');
        const validText = await validRes.text();
        const valids = validText.split('\n')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length === 5);
        
        const validSet = new Set(valids);
        targets.forEach(w => validSet.add(w));
        validWordsSetRef.current = validSet;

        console.log(`Loaded ${targets.length} target words and ${validSet.size} valid words.`);
        
        // Start first game
        initGame('wordle', null, targets);
      } catch (err) {
        console.error("Failed to load word files:", err);
      }
    };

    loadWords();

    return () => {
      document.body.classList.remove('bg-magenta');
    };
  }, []);

  // 2. Initialize PeerJS (Host)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const room = query.get('room') || 'default_room';
    setRoomCode(room);

    const peerId = `overlay-game-${room}`;
    const peer = new Peer(peerId);
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('Peer registered with ID:', id);
    });

    peer.on('connection', (conn) => {
      console.log('Admin Dashboard connected:', conn.peer);
      connectionsRef.current.push(conn);

      conn.on('open', () => {
        // Send current state + TikFinity status
        conn.send({ type: 'gameState', state: gameStateRef.current });
        conn.send({ type: 'tikFinityStatus', connected: tikFinityConnectedRef.current });
      });

      conn.on('data', (data) => {
        if (data.type === 'startGame') {
          initGame(data.mode, data.word);
        } else if (data.type === 'adminGuess') {
          handleChat({
            comment: data.guess,
            nickname: 'Host',
            profilePictureUrl: 'https://ui-avatars.com/api/?name=Host&background=0D8ABC&color=fff'
          });
        } else if (data.type === 'updateMaxRows') {
          setGameState(prev => {
            const newState = { ...prev, maxRows: data.maxRows };
            broadcastState(newState);
            return newState;
          });
        }
      });

      conn.on('close', () => {
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });

      conn.on('error', (err) => {
        console.error('Peer connection error:', err);
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected from signaling server. Attempting to reconnect...');
      if (!peer.destroyed) {
        peer.reconnect();
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err.type, err);
    });

    return () => {
      peer.destroy();
    };
  }, []);

  // Broadcast TikFinity status to all admin peers
  const broadcastTikFinityStatus = (connected) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'tikFinityStatus', connected });
      }
    });
  };

  // 3. Connect to local TikFinity WebSocket (with retry limits)
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let isMounted = true;

    const connectTikFinity = () => {
      if (!isMounted || retryCount >= MAX_RETRIES) {
        if (retryCount >= MAX_RETRIES) {
          console.log('TikFinity: Max reconnect attempts reached. TikFinity tidak tersedia (ini normal jika bukan di komputer lokal).');
          tikFinityConnectedRef.current = false;
          broadcastTikFinityStatus(false);
        }
        return;
      }

      try {
        ws = new WebSocket('ws://localhost:21213/');
      } catch (e) {
        console.log('TikFinity: WebSocket constructor failed, skipping.');
        tikFinityConnectedRef.current = false;
        broadcastTikFinityStatus(false);
        return;
      }

      ws.onopen = () => {
        console.log('Connected to TikFinity local WebSocket');
        retryCount = 0;
        tikFinityConnectedRef.current = true;
        broadcastTikFinityStatus(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'chat') {
            handleChat(parsed.data);
          }
        } catch (e) {
          console.error('Error parsing TikFinity message:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        tikFinityConnectedRef.current = false;
        broadcastTikFinityStatus(false);
        retryCount++;
        const delay = Math.min(5000 * Math.pow(1.5, retryCount - 1), 30000);
        console.log(`TikFinity connection closed. Retry ${retryCount}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
        reconnectTimeout = setTimeout(connectTikFinity, delay);
      };

      ws.onerror = () => {
        // Just let onclose handle the reconnect
      };
    };

    connectTikFinity();

    return () => {
      isMounted = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Broadcast state changes to all connected Admin Peers
  const broadcastState = (state) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'gameState', state });
      }
    });
  };

  // Helper: Pick random word
  const pickRandomWord = (targets = targetWordsRef.current) => {
    if (targets.length === 0) return 'segar';
    let available = targets.filter(w => !playedWordsRef.current.has(w));
    if (available.length === 0) {
      playedWordsRef.current.clear();
      available = targets;
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    playedWordsRef.current.add(picked);
    return picked;
  };

  // Helper: Scramble word
  const scrambleWord = (word) => {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  };

  // Initialize Game
  const initGame = (mode, specificWord = null, overrideTargets = null) => {
    const targets = overrideTargets || targetWordsRef.current;
    const lastTargetWord = gameStateRef.current ? gameStateRef.current.targetWord : null;
    const word = specificWord ? specificWord.toLowerCase() : pickRandomWord(targets);
    const oldMaxRows = gameStateRef.current ? (gameStateRef.current.maxRows || 6) : 6;

    const newGameState = {
      mode: mode,
      targetWord: word,
      scrambledWord: mode === 'anagram' ? scrambleWord(word) : '',
      guesses: [],
      status: 'playing',
      winner: null,
      maxRows: oldMaxRows,
    };

    if (mode === 'wordle') {
      const firstGuess = (lastTargetWord && lastTargetWord.length === 5) ? lastTargetWord : pickRandomWord(targets);
      newGameState.guesses.push({
        word: firstGuess,
        user: { nickname: 'Kata Lalu', profilePic: 'https://ui-avatars.com/api/?name=Lalu&background=4ca371&color=fff' }
      });
    }

    setGameState(newGameState);
    setWinState({ show: false, winner: null, word: '', mode: '' });
    setTimeoutState({ show: false, word: '' });
    broadcastState(newGameState);
  };

  // Check word validity
  const checkWordleGuess = (guessStr) => {
    if (guessStr.length !== 5) return false;
    if (!validWordsSetRef.current.has(guessStr)) return false;
    return true;
  };

  // Sanitize text: strip all non-alphabetic characters
  const sanitize = (text) => text.replace(/[^a-zA-Z]/g, '').toLowerCase();

  // Extract a valid 5-letter word from chat text (with TikTok bypass handling)
  const extractGuess = (chatText) => {
    // Strategy 1: Exact 5-letter word from space-separated parts
    // Handles: "makan", "makan bang", "coba makan yuk"
    const parts = chatText.split(/\s+/);
    for (const part of parts) {
      if (part.length === 5 && checkWordleGuess(part)) {
        return part;
      }
    }

    // Strategy 2: Clean each individual part (remove dots/symbols within a word)
    // Handles: ".MAKAN", "MA.KAN", "M.A.K.A.N", "makan!", "makan."
    for (const part of parts) {
      const cleaned = sanitize(part);
      if (cleaned.length === 5 && checkWordleGuess(cleaned)) {
        return cleaned;
      }
    }

    // Strategy 3: Clean the ENTIRE text (strip all non-alpha)
    // Handles: "MA KAN", "M A K A N", "MA. KAN"
    const fullCleaned = sanitize(chatText);
    if (fullCleaned.length === 5 && checkWordleGuess(fullCleaned)) {
      return fullCleaned;
    }

    // Strategy 4: Sliding window on cleaned text (find valid 5-letter substring)
    // Handles: "halo makan", "cobamakanyuk" (after cleaning)
    if (fullCleaned.length > 5) {
      for (let i = 0; i <= fullCleaned.length - 5; i++) {
        const sub = fullCleaned.substring(i, i + 5);
        if (checkWordleGuess(sub)) {
          return sub;
        }
      }
    }

    return '';
  };

  // Extract anagram answer from chat text (with TikTok bypass handling)
  const extractAnagramGuess = (chatText, targetWord) => {
    // Strategy 1: Direct match
    if (chatText === targetWord) return targetWord;

    // Strategy 2: Match from space-separated parts
    const parts = chatText.split(/\s+/);
    for (const part of parts) {
      if (part === targetWord) return targetWord;
      const cleaned = sanitize(part);
      if (cleaned === targetWord) return targetWord;
    }

    // Strategy 3: Clean entire text
    const fullCleaned = sanitize(chatText);
    if (fullCleaned === targetWord) return targetWord;

    // Strategy 4: Sliding window
    if (fullCleaned.length > targetWord.length) {
      for (let i = 0; i <= fullCleaned.length - targetWord.length; i++) {
        const sub = fullCleaned.substring(i, i + targetWord.length);
        if (sub === targetWord) return targetWord;
      }
    }

    return '';
  };

  // Handle comment event
  const handleChat = (data) => {
    const state = gameStateRef.current;
    if (state.status !== 'playing') return;

    const chatText = (data.comment || data.text || '').trim().toLowerCase();
    const user = {
      nickname: data.nickname || data.uniqueId || 'User',
      profilePic: data.profilePictureUrl || 'https://ui-avatars.com/api/?name=User'
    };

    if (state.mode === 'wordle') {
      const guessStr = extractGuess(chatText);

      if (guessStr) {
        const newGuesses = [...state.guesses, { word: guessStr, user }];
        let newStatus = state.status;
        let winner = state.winner;

        if (guessStr === state.targetWord) {
          newStatus = 'won';
          winner = user;
        }

        const updatedState = { ...state, guesses: newGuesses, status: newStatus, winner };
        gameStateRef.current = updatedState; // Immediate sync update to prevent fast-chat race conditions
        setGameState(updatedState);
        broadcastState(updatedState);

        if (newStatus === 'won') {
          setWinState({ show: true, winner, word: state.targetWord, mode: state.mode });
        }
      }
    } else if (state.mode === 'anagram') {
      const matched = extractAnagramGuess(chatText, state.targetWord);
      if (matched) {
        const updatedState = { ...state, status: 'won', winner: user };
        gameStateRef.current = updatedState; // Immediate sync update
        setGameState(updatedState);
        broadcastState(updatedState);
        setWinState({ show: true, winner: user, word: state.targetWord, mode: state.mode });
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', padding: '2rem', overflow: 'hidden' }}>
      {/* Koneksi Peer Indicator (hanya terlihat jika di luar OBS / butuh debug) */}
      <div style={{ position: 'absolute', top: 5, right: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
        Kamar: {roomCode}
      </div>

      <div style={{ position: 'relative', width: 'fit-content', minHeight: '420px' }}>
        {gameState.mode === 'wordle' && (
          <WordleBoard gameState={gameState} />
        )}

        {gameState.mode === 'anagram' && (
          <AnagramBoard gameState={gameState} />
        )}

        {winState.winner && (
          <WinCard 
            show={winState.show}
            winner={winState.winner} 
            word={winState.word} 
            mode={winState.mode} 
            onExited={() => setWinState((prev) => ({ ...prev, winner: null }))}
          />
        )}

        {timeoutState.show && (
          <TimeoutCard 
            show={timeoutState.show}
            word={timeoutState.word} 
            onExited={() => setTimeoutState((prev) => ({ ...prev, show: false }))}
          />
        )}
      </div>
    </div>
  );
}
