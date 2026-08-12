import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import WordleBoard from '../components/WordleBoard';
import AnagramBoard from '../components/AnagramBoard';
import WinCard from '../components/WinCard';
import TimeoutCard from '../components/TimeoutCard';

export default function Overlay() {
  // Game state (Wordle & Anagram & Dual Mode)
  const [gameState, setGameState] = useState({
    mode: 'wordle', // 'wordle' | 'anagram' | 'dual'
    // Wordle state
    targetWord: 'buku',
    guesses: [],
    wordleStatus: 'playing', // 'playing' | 'won'
    wordleWinner: null,
    maxRows: 6,
    // Anagram state
    scrambledWord: '',
    anagramWords: [],
    anagramStatus: 'playing', // 'playing' | 'won'
    anagramWinner: null,
    anagramRows: 3,
    // Status fallback
    status: 'playing',
    winner: null,
  });

  const [wordleWinState, setWordleWinState] = useState({ show: false, winner: null, word: '' });
  const [anagramWinState, setAnagramWinState] = useState({ show: false, winner: null, word: '' });
  const [timeoutState, setTimeoutState] = useState({ show: false, word: '' });

  // TikFinity connection status
  const tikFinityConnectedRef = useRef(false);

  // Auto-restart: timestamps for Wordle and Anagram
  const RESTART_DELAY_MS = 10000;
  const wordleEndedAtRef = useRef(null);
  const anagramEndedAtRef = useRef(null);

  // Word databases
  const targetWordsRef = useRef([]);
  const validWordsSetRef = useRef(new Set());
  const playedWordsRef = useRef(new Set());

  // WebRTC refs
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const [roomCode, setRoomCode] = useState('');
  const [viewType, setViewType] = useState('all'); // 'all' | 'wordle' | 'anagram'

  // Keep refs of gameState to avoid closure stale state
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Robust auto-restart for single and dual modes (immune to background tab throttling)
  useEffect(() => {
    // Wordle end tracking
    if (gameState.mode === 'wordle' || gameState.mode === 'dual') {
      if (gameState.wordleStatus === 'won') {
        if (!wordleEndedAtRef.current) wordleEndedAtRef.current = Date.now();
      } else {
        wordleEndedAtRef.current = null;
      }
    }

    // Anagram end tracking
    if (gameState.mode === 'anagram' || gameState.mode === 'dual') {
      if (gameState.anagramStatus === 'won') {
        if (!anagramEndedAtRef.current) anagramEndedAtRef.current = Date.now();
      } else {
        anagramEndedAtRef.current = null;
      }
    }

    const checkRestart = setInterval(() => {
      const now = Date.now();

      if (wordleEndedAtRef.current && (now - wordleEndedAtRef.current >= RESTART_DELAY_MS)) {
        wordleEndedAtRef.current = null;
        if (gameStateRef.current.mode === 'dual') {
          restartWordlePart();
        } else if (gameStateRef.current.mode === 'wordle') {
          initGame('wordle');
        }
      }

      if (anagramEndedAtRef.current && (now - anagramEndedAtRef.current >= RESTART_DELAY_MS)) {
        anagramEndedAtRef.current = null;
        if (gameStateRef.current.mode === 'dual') {
          restartAnagramPart();
        } else if (gameStateRef.current.mode === 'anagram') {
          initGame('anagram');
        }
      }
    }, 1000);

    return () => clearInterval(checkRestart);
  }, [gameState.mode, gameState.wordleStatus, gameState.anagramStatus]);

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

        playedWordsRef.current = loadPlayedWords();
        console.log(`Loaded ${targets.length} target words (${playedWordsRef.current.size} previously played) and ${validSet.size} valid words.`);
        
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
    const view = (query.get('view') || query.get('type') || 'all').toLowerCase();
    setRoomCode(room);
    setViewType(view);

    const viewSuffix = view === 'wordle' ? '-wordle' : (view === 'anagram' ? '-anagram' : '');
    const peerId = `overlay-game-${room}${viewSuffix}`;
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
          initGame(data.mode, data.word, null, data.anagramRows);
        } else if (data.type === 'adminGuess') {
          handleChat({
            comment: data.guess,
            nickname: 'Host',
            profilePictureUrl: 'https://ui-avatars.com/api/?name=Host&background=0D8ABC&color=fff'
          });
        } else if (data.type === 'updateMaxRows') {
          setGameState(prev => {
            const newState = { ...prev, maxRows: data.maxRows };
            gameStateRef.current = newState;
            broadcastState(newState);
            return newState;
          });
        } else if (data.type === 'updateAnagramRows') {
          setGameState(prev => {
            const newState = { ...prev, anagramRows: data.anagramRows };
            gameStateRef.current = newState;
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

  // Broadcast state changes to all connected Admin Peers
  const broadcastState = (state) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'gameState', state });
      }
    });
  };

  // Persistence helpers for played words pool
  const loadPlayedWords = () => {
    try {
      const saved = localStorage.getItem('yotebak_played_words');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      }
    } catch (_) {}
    return new Set();
  };

  const savePlayedWords = (set) => {
    try {
      localStorage.setItem('yotebak_played_words', JSON.stringify(Array.from(set)));
    } catch (_) {}
  };

  // Draw a guaranteed unique non-repeated target word until all pool words are exhausted
  const drawTargetWord = (targets = targetWordsRef.current) => {
    if (!targets || targets.length === 0) return 'segar';

    let available = targets.filter(w => !playedWordsRef.current.has(w));

    // If all words in the pool have been played, reset the pool!
    if (available.length === 0) {
      console.log(`[WordPool] Semua ${targets.length} kata telah dimainkan! Mereset pool kata dari awal.`);
      playedWordsRef.current.clear();
      savePlayedWords(playedWordsRef.current);
      available = [...targets];
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    playedWordsRef.current.add(picked);
    savePlayedWords(playedWordsRef.current);

    console.log(`[WordPool] Kata terpilih: "${picked}" | Progres Pool: ${playedWordsRef.current.size} / ${targets.length} kata`);
    return picked;
  };

  // Get a random hint word for "Kata Lalu" (does NOT consume from the target pool)
  const getRandomHintWord = (targets = targetWordsRef.current) => {
    if (!targets || targets.length === 0) return 'makan';
    return targets[Math.floor(Math.random() * targets.length)];
  };

  // Helper: Scramble word (ensures scrambled is different from word)
  const scrambleWord = (word) => {
    const arr = word.split('');
    let scrambled = word;
    let attempts = 0;
    while (scrambled === word && attempts < 10) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      scrambled = arr.join('');
      attempts++;
    }
    return scrambled;
  };

  // Helper: Generate list of anagram words with guaranteed non-repetition
  const generateAnagramWords = (targets, count) => {
    const chosenWords = [];
    while (chosenWords.length < count) {
      const picked = drawTargetWord(targets);
      if (!chosenWords.includes(picked)) {
        chosenWords.push(picked);
      }
    }
    return chosenWords.map((w, idx) => ({
      id: idx + 1,
      targetWord: w,
      scrambledWord: scrambleWord(w),
      solved: false,
      winner: null,
    }));
  };

  // Initialize Game (Wordle, Anagram, or Dual)
  const initGame = (mode, specificWord = null, overrideTargets = null, anagramCount = null) => {
    const targets = overrideTargets || targetWordsRef.current;
    const lastTargetWord = gameStateRef.current ? gameStateRef.current.targetWord : null;
    const oldMaxRows = gameStateRef.current ? (gameStateRef.current.maxRows || 6) : 6;
    const count = anagramCount || (gameStateRef.current ? (gameStateRef.current.anagramRows || 3) : 3);
    const validAnagramRows = Math.min(Math.max(Number(count) || 3, 1), 6);

    const wordleWord = specificWord ? specificWord.toLowerCase() : drawTargetWord(targets);
    const firstGuess = (lastTargetWord && lastTargetWord.length === 5) ? lastTargetWord : getRandomHintWord(targets);
    const anagramList = generateAnagramWords(targets, validAnagramRows);

    const newGameState = {
      mode: mode,
      // Wordle fields
      targetWord: wordleWord,
      guesses: (mode === 'wordle' || mode === 'dual') ? [{
        word: firstGuess,
        user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=4ca371&color=fff' }
      }] : [],
      wordleStatus: 'playing',
      wordleWinner: null,
      maxRows: oldMaxRows,
      // Anagram fields
      scrambledWord: anagramList[0]?.scrambledWord || '',
      anagramWords: anagramList,
      anagramStatus: 'playing',
      anagramWinner: null,
      anagramRows: validAnagramRows,
      // Pool tracking fields
      poolPlayed: playedWordsRef.current.size,
      poolTotal: targets.length || 1958,
      // Fallback overall status
      status: 'playing',
      winner: null,
    };

    gameStateRef.current = newGameState;
    setGameState(newGameState);
    setWordleWinState({ show: false, winner: null, word: '' });
    setAnagramWinState({ show: false, winner: null, word: '' });
    setTimeoutState({ show: false, word: '' });
    broadcastState(newGameState);
  };

  // Restart only Wordle section during Dual Mode
  const restartWordlePart = () => {
    const targets = targetWordsRef.current;
    const lastWordleWord = gameStateRef.current ? gameStateRef.current.targetWord : null;
    const newWord = drawTargetWord(targets);
    const firstGuess = (lastWordleWord && lastWordleWord.length === 5) ? lastWordleWord : getRandomHintWord(targets);

    setGameState(prev => {
      const updated = {
        ...prev,
        targetWord: newWord,
        guesses: [{
          word: firstGuess,
          user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=4ca371&color=fff' }
        }],
        wordleStatus: 'playing',
        wordleWinner: null,
        poolPlayed: playedWordsRef.current.size,
      };
      gameStateRef.current = updated;
      broadcastState(updated);
      return updated;
    });
    setWordleWinState({ show: false, winner: null, word: '' });
  };

  // Restart only Anagram section during Dual Mode
  const restartAnagramPart = () => {
    const targets = targetWordsRef.current;
    const validRows = gameStateRef.current?.anagramRows || 3;
    const anagramList = generateAnagramWords(targets, validRows);

    setGameState(prev => {
      const updated = {
        ...prev,
        scrambledWord: anagramList[0]?.scrambledWord || '',
        anagramWords: anagramList,
        anagramStatus: 'playing',
        anagramWinner: null,
        poolPlayed: playedWordsRef.current.size,
      };
      gameStateRef.current = updated;
      broadcastState(updated);
      return updated;
    });
    setAnagramWinState({ show: false, winner: null, word: '' });
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
    const parts = chatText.split(/\s+/);
    for (const part of parts) {
      if (part.length === 5 && checkWordleGuess(part)) {
        return part;
      }
    }

    for (const part of parts) {
      const cleaned = sanitize(part);
      if (cleaned.length === 5 && checkWordleGuess(cleaned)) {
        return cleaned;
      }
    }

    const fullCleaned = sanitize(chatText);
    if (fullCleaned.length === 5 && checkWordleGuess(fullCleaned)) {
      return fullCleaned;
    }

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
    if (chatText === targetWord) return targetWord;

    const parts = chatText.split(/\s+/);
    for (const part of parts) {
      if (part === targetWord) return targetWord;
      const cleaned = sanitize(part);
      if (cleaned === targetWord) return targetWord;
    }

    const fullCleaned = sanitize(chatText);
    if (fullCleaned === targetWord) return targetWord;

    if (fullCleaned.length > targetWord.length) {
      for (let i = 0; i <= fullCleaned.length - targetWord.length; i++) {
        const sub = fullCleaned.substring(i, i + targetWord.length);
        if (sub === targetWord) return targetWord;
      }
    }

    return '';
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
        // Just let onclose handle reconnect
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

  // Handle comment event (Simultaneous routing for Dual Mode)
  const handleChat = (data) => {
    const state = gameStateRef.current;
    const chatText = (data.comment || data.text || '').trim().toLowerCase();
    const user = {
      nickname: data.nickname || data.uniqueId || 'User',
      profilePic: data.profilePictureUrl || 'https://ui-avatars.com/api/?name=User'
    };

    let updatedState = { ...state };
    let stateChanged = false;

    // 1. Process Anagram
    if ((state.mode === 'anagram' || state.mode === 'dual') && (state.anagramStatus !== 'won')) {
      const anagramWords = state.anagramWords || [];
      let solvedWordIndex = -1;

      for (let i = 0; i < anagramWords.length; i++) {
        if (!anagramWords[i].solved) {
          const matched = extractAnagramGuess(chatText, anagramWords[i].targetWord);
          if (matched) {
            solvedWordIndex = i;
            break;
          }
        }
      }

      if (solvedWordIndex !== -1) {
        const updatedAnagramWords = anagramWords.map((w, idx) => {
          if (idx === solvedWordIndex) {
            return { ...w, solved: true, winner: user };
          }
          return w;
        });

        const allSolved = updatedAnagramWords.every(w => w.solved);
        const newAnagramStatus = allSolved ? 'won' : 'playing';

        updatedState = {
          ...updatedState,
          anagramWords: updatedAnagramWords,
          anagramStatus: newAnagramStatus,
          anagramWinner: allSolved ? user : updatedState.anagramWinner,
        };
        stateChanged = true;

        if (allSolved) {
          const allTargetWords = updatedAnagramWords.map(w => w.targetWord).join(', ');
          setAnagramWinState({ show: true, winner: user, word: allTargetWords });
        }
      }
    }

    // 2. Process Wordle
    if ((state.mode === 'wordle' || state.mode === 'dual') && (state.wordleStatus !== 'won')) {
      const guessStr = extractGuess(chatText);

      if (guessStr) {
        const newGuesses = [...(updatedState.guesses || []), { word: guessStr, user }];
        let newWordleStatus = updatedState.wordleStatus;
        let wordleWinner = updatedState.wordleWinner;

        if (guessStr === updatedState.targetWord) {
          newWordleStatus = 'won';
          wordleWinner = user;
        }

        updatedState = {
          ...updatedState,
          guesses: newGuesses,
          wordleStatus: newWordleStatus,
          wordleWinner: wordleWinner,
        };
        stateChanged = true;

        if (newWordleStatus === 'won') {
          setWordleWinState({ show: true, winner: user, word: updatedState.targetWord });
        }
      }
    }

    if (stateChanged) {
      // Overall status update for backward compatibility
      if (updatedState.mode === 'wordle') {
        updatedState.status = updatedState.wordleStatus;
        updatedState.winner = updatedState.wordleWinner;
      } else if (updatedState.mode === 'anagram') {
        updatedState.status = updatedState.anagramStatus;
        updatedState.winner = updatedState.anagramWinner;
      } else if (updatedState.mode === 'dual') {
        updatedState.status = (updatedState.wordleStatus === 'won' && updatedState.anagramStatus === 'won') ? 'won' : 'playing';
        updatedState.winner = updatedState.wordleWinner || updatedState.anagramWinner;
      }

      gameStateRef.current = updatedState;
      setGameState(updatedState);
      broadcastState(updatedState);
    }
  };

  const showWordle = viewType === 'wordle' || (viewType === 'all' && (gameState.mode === 'wordle' || gameState.mode === 'dual'));
  const showAnagram = viewType === 'anagram' || (viewType === 'all' && (gameState.mode === 'anagram' || gameState.mode === 'dual'));

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', padding: '1.5rem', overflow: 'hidden' }}>
      {/* Koneksi Peer Indicator (hanya terlihat jika di luar OBS / butuh debug) */}
      <div style={{ position: 'absolute', top: 5, right: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
        Kamar: {roomCode} {viewType !== 'all' ? `(Khusus ${viewType.toUpperCase()})` : (gameState.mode === 'dual' ? '(Mode Dual)' : '')}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '2.5rem', 
        alignItems: 'flex-start', 
        flexWrap: 'wrap',
        width: 'fit-content' 
      }}>
        
        {/* WORDLE BOARD */}
        {showWordle && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <WordleBoard gameState={gameState} />

            {wordleWinState.winner && (
              <WinCard 
                show={wordleWinState.show}
                winner={wordleWinState.winner} 
                word={wordleWinState.word} 
                mode="wordle" 
                onExited={() => setWordleWinState((prev) => ({ ...prev, winner: null }))}
              />
            )}
          </div>
        )}

        {/* ANAGRAM BOARD */}
        {showAnagram && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <AnagramBoard gameState={gameState} />

            {anagramWinState.winner && (
              <WinCard 
                show={anagramWinState.show}
                winner={anagramWinState.winner} 
                word={anagramWinState.word} 
                mode="anagram" 
                onExited={() => setAnagramWinState((prev) => ({ ...prev, winner: null }))}
              />
            )}
          </div>
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
