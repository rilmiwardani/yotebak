import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import WordleBoard from '../components/WordleBoard';
import AnagramBoard from '../components/AnagramBoard';
import LeaderboardBoard from '../components/LeaderboardBoard';
import WinCard from '../components/WinCard';
import TimeoutCard from '../components/TimeoutCard';

export default function Overlay() {
  // Persistence helpers for Wordle & Anagram Leaderboards
  const loadWordleLeaderboard = () => {
    try {
      const saved = localStorage.getItem('yotebak_leaderboard_wordle');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  };

  const saveWordleLeaderboard = (data) => {
    try {
      localStorage.setItem('yotebak_leaderboard_wordle', JSON.stringify(data));
    } catch (_) {}
  };

  const loadAnagramLeaderboard = () => {
    try {
      const saved = localStorage.getItem('yotebak_leaderboard_anagram');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  };

  const saveAnagramLeaderboard = (data) => {
    try {
      localStorage.setItem('yotebak_leaderboard_anagram', JSON.stringify(data));
    } catch (_) {}
  };

  const loadMaxLeaderboardRows = () => {
    try {
      const saved = localStorage.getItem('yotebak_max_leaderboard_rows');
      if (saved) return Number(saved) || 10;
    } catch (_) {}
    return 10;
  };

  const saveMaxLeaderboardRows = (limit) => {
    try {
      localStorage.setItem('yotebak_max_leaderboard_rows', String(limit));
    } catch (_) {}
  };

  // Game state (Wordle & Anagram & Dual Mode & 2 Separate Leaderboards)
  const [gameState, setGameState] = useState({
    mode: 'dual', // 'wordle' | 'anagram' | 'dual'
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
    // Two Separate Leaderboards
    wordleLeaderboard: loadWordleLeaderboard(),
    anagramLeaderboard: loadAnagramLeaderboard(),
    maxLeaderboardRows: loadMaxLeaderboardRows(),
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

  // WebRTC refs & Local Broadcast Channel for seamless multi-overlay sync
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const broadcastChannelRef = useRef(null);
  const [roomCode, setRoomCode] = useState('');
  const [viewType, setViewType] = useState('all'); // 'all' | 'wordle' | 'anagram' | 'leaderboard' | 'leaderboard-wordle' | 'leaderboard-anagram'

  // Keep refs of gameState to avoid closure stale state
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Record win helper for Wordle
  const recordWordleWin = (user, currentState) => {
    if (!user || !user.nickname || user.nickname === 'Host' || user.nickname === 'Last Word' || user.nickname === 'Kata Lalu') {
      return currentState.wordleLeaderboard || [];
    }

    const currentList = currentState.wordleLeaderboard || loadWordleLeaderboard();
    const list = [...currentList];
    const cleanNick = user.nickname.trim();
    const existingIdx = list.findIndex(p => (p.nickname || '').toLowerCase() === cleanNick.toLowerCase());

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        points: (list[existingIdx].points || 0) + 1,
        profilePic: user.profilePic || list[existingIdx].profilePic,
        lastWinAt: Date.now()
      };
    } else {
      list.push({
        nickname: cleanNick,
        profilePic: user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanNick)}&background=10b981&color=fff`,
        points: 1,
        lastWinAt: Date.now()
      });
    }

    list.sort((a, b) => (b.points - a.points) || (b.lastWinAt - a.lastWinAt));
    saveWordleLeaderboard(list);
    return list;
  };

  // Record win helper for Anagram
  const recordAnagramWin = (user, currentState) => {
    if (!user || !user.nickname || user.nickname === 'Host' || user.nickname === 'Last Word' || user.nickname === 'Kata Lalu') {
      return currentState.anagramLeaderboard || [];
    }

    const currentList = currentState.anagramLeaderboard || loadAnagramLeaderboard();
    const list = [...currentList];
    const cleanNick = user.nickname.trim();
    const existingIdx = list.findIndex(p => (p.nickname || '').toLowerCase() === cleanNick.toLowerCase());

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        points: (list[existingIdx].points || 0) + 1,
        profilePic: user.profilePic || list[existingIdx].profilePic,
        lastWinAt: Date.now()
      };
    } else {
      list.push({
        nickname: cleanNick,
        profilePic: user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanNick)}&background=2563eb&color=fff`,
        points: 1,
        lastWinAt: Date.now()
      });
    }

    list.sort((a, b) => (b.points - a.points) || (b.lastWinAt - a.lastWinAt));
    saveAnagramLeaderboard(list);
    return list;
  };

  // Reset leaderboard helper
  const handleResetLeaderboard = (target = 'all') => {
    let newWordle = gameStateRef.current?.wordleLeaderboard || [];
    let newAnagram = gameStateRef.current?.anagramLeaderboard || [];

    if (target === 'wordle' || target === 'all') {
      saveWordleLeaderboard([]);
      newWordle = [];
    }
    if (target === 'anagram' || target === 'all') {
      saveAnagramLeaderboard([]);
      newAnagram = [];
    }

    setGameState(prev => {
      const updated = { 
        ...prev, 
        wordleLeaderboard: newWordle, 
        anagramLeaderboard: newAnagram 
      };
      gameStateRef.current = updated;
      broadcastState(updated);
      return updated;
    });
  };

  // Independent auto-restart and Win Overlay trigger: Reactive to ALL state changes (local & remote)
  useEffect(() => {
    // Wordle end tracking & Win Screen Trigger
    if (gameState.wordleStatus === 'won') {
      if (!wordleEndedAtRef.current) {
        wordleEndedAtRef.current = Date.now();
        setWordleWinState({
          show: true,
          winner: gameState.wordleWinner,
          word: gameState.targetWord
        });
      }
    } else {
      wordleEndedAtRef.current = null;
      setWordleWinState(prev => prev.show ? { ...prev, show: false } : prev);
    }

    // Anagram end tracking & Win Screen Trigger
    if (gameState.anagramStatus === 'won') {
      if (!anagramEndedAtRef.current) {
        anagramEndedAtRef.current = Date.now();
        const allTargetWords = (gameState.anagramWords || []).map(w => w.targetWord).join(', ');
        setAnagramWinState({
          show: true,
          winner: gameState.anagramWinner,
          word: allTargetWords
        });
      }
    } else {
      anagramEndedAtRef.current = null;
      setAnagramWinState(prev => prev.show ? { ...prev, show: false } : prev);
    }

    const checkRestart = setInterval(() => {
      const now = Date.now();

      // Wordle restarts independently
      if (wordleEndedAtRef.current && (now - wordleEndedAtRef.current >= RESTART_DELAY_MS)) {
        wordleEndedAtRef.current = null;
        restartWordlePart();
      }

      // Anagram restarts independently
      if (anagramEndedAtRef.current && (now - anagramEndedAtRef.current >= RESTART_DELAY_MS)) {
        anagramEndedAtRef.current = null;
        restartAnagramPart();
      }
    }, 1000);

    return () => clearInterval(checkRestart);
  }, [gameState.wordleStatus, gameState.anagramStatus, gameState.wordleWinner, gameState.anagramWinner, gameState.targetWord, gameState.anagramWords]);

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

  // 1. Fetch word list files and synchronize initial game state
  useEffect(() => {
    document.body.classList.add('bg-magenta');
    const query = new URLSearchParams(window.location.search);
    const room = query.get('room') || 'default_room';

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
        
        // Synchronize with existing active game state if one already exists in localStorage
        let existingState = null;
        try {
          const saved = localStorage.getItem(`yotebak_active_game_${room}`);
          if (saved) {
            existingState = JSON.parse(saved);
          }
        } catch (_) {}

        if (existingState && existingState.targetWord && existingState.anagramWords && existingState.anagramWords.length > 0) {
          console.log("Synchronized with active room game state:", existingState.targetWord);
          gameStateRef.current = existingState;
          setGameState(existingState);
        } else {
          // Initialize fresh dual game
          initGame('dual', null, targets);
        }
      } catch (err) {
        console.error("Failed to load word files:", err);
      }
    };

    loadWords();

    return () => {
      document.body.classList.remove('bg-magenta');
    };
  }, []);

  // 2. Initialize PeerJS (Host) and BroadcastChannel
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const room = query.get('room') || 'default_room';
    const view = (query.get('view') || query.get('type') || 'all').toLowerCase();
    setRoomCode(room);
    setViewType(view);

    // Setup local BroadcastChannel for 0ms multi-overlay sync on the same machine
    try {
      const channel = new BroadcastChannel(`yotebak_sync_${room}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'gameState') {
          const newState = event.data.state;
          gameStateRef.current = newState;
          setGameState(newState);
        }
      };
    } catch (_) {}

    let viewSuffix = '';
    if (view === 'wordle') viewSuffix = '-wordle';
    else if (view === 'anagram') viewSuffix = '-anagram';
    else if (view === 'leaderboard-wordle' || view === 'leaderboard_wordle') viewSuffix = '-leaderboard-wordle';
    else if (view === 'leaderboard-anagram' || view === 'leaderboard_anagram') viewSuffix = '-leaderboard-anagram';
    else if (view === 'leaderboard' || view === 'leaderboards') viewSuffix = '-leaderboard';

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
        } else if (data.type === 'resetLeaderboard') {
          handleResetLeaderboard(data.target || 'all');
        } else if (data.type === 'updateLeaderboardLimit') {
          const limit = Math.min(Math.max(Number(data.limit) || 10, 1), 20);
          saveMaxLeaderboardRows(limit);
          setGameState(prev => {
            const newState = { ...prev, maxLeaderboardRows: limit };
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
      if (broadcastChannelRef.current) {
        try { broadcastChannelRef.current.close(); } catch (_) {}
      }
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

  // Broadcast state changes to all connected Admin Peers AND other local Overlay instances
  const broadcastState = (state) => {
    const query = new URLSearchParams(window.location.search);
    const room = query.get('room') || 'default_room';

    try {
      localStorage.setItem(`yotebak_active_game_${room}`, JSON.stringify(state));
    } catch (_) {}

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'gameState', state });
      } catch (_) {}
    }

    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'gameState', state });
      }
    });
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

  // Get a random hint word for "Last Word" (does NOT consume from the target pool)
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
    const currentState = gameStateRef.current || {};
    
    const oldMaxRows = currentState.maxRows || 6;
    const count = anagramCount || (currentState.anagramRows || 3);
    const validAnagramRows = Math.min(Math.max(Number(count) || 3, 1), 6);

    const isResetWordle = mode === 'wordle' || mode === 'dual' || !currentState.targetWord;
    const isResetAnagram = mode === 'anagram' || mode === 'dual' || !currentState.anagramWords || currentState.anagramWords.length === 0;

    const wordleWord = isResetWordle 
      ? (specificWord ? specificWord.toLowerCase() : drawTargetWord(targets))
      : currentState.targetWord;

    const lastWordleWord = currentState.targetWord;
    const firstGuess = (lastWordleWord && lastWordleWord.length === 5) ? lastWordleWord : getRandomHintWord(targets);

    const wordleGuesses = isResetWordle
      ? [{ word: firstGuess, user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=4ca371&color=fff' } }]
      : currentState.guesses;

    const anagramList = isResetAnagram
      ? generateAnagramWords(targets, validAnagramRows)
      : currentState.anagramWords;

    const newGameState = {
      ...currentState,
      mode: mode,
      // Wordle fields
      targetWord: wordleWord,
      guesses: wordleGuesses,
      wordleStatus: isResetWordle ? 'playing' : currentState.wordleStatus,
      wordleWinner: isResetWordle ? null : currentState.wordleWinner,
      maxRows: oldMaxRows,
      // Anagram fields
      scrambledWord: anagramList[0]?.scrambledWord || '',
      anagramWords: anagramList,
      anagramStatus: isResetAnagram ? 'playing' : currentState.anagramStatus,
      anagramWinner: isResetAnagram ? null : currentState.anagramWinner,
      anagramRows: validAnagramRows,
      // Pool tracking fields
      poolPlayed: playedWordsRef.current.size,
      poolTotal: targets.length || 1958,
    };

    gameStateRef.current = newGameState;
    setGameState(newGameState);
    
    if (isResetWordle) setWordleWinState({ show: false, winner: null, word: '' });
    if (isResetAnagram) setAnagramWinState({ show: false, winner: null, word: '' });
    setTimeoutState({ show: false, word: '' });
    
    broadcastState(newGameState);
  };

  // Restart strictly only Wordle section - Anagram is 100% UNTOUCHED!
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

  // Restart strictly only Anagram section - Wordle is 100% UNTOUCHED!
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

  // Sanitize helper
  const sanitize = (text) => {
    return text.replace(/[^a-zA-Z]/g, '').toLowerCase();
  };

  // Extract 5-letter valid guess from chat text
  const extractGuess = (chatText) => {
    const directWord = sanitize(chatText);
    if (directWord.length === 5 && validWordsSetRef.current.has(directWord)) {
      return directWord;
    }

    const words = chatText.split(/\s+/);
    for (const w of words) {
      const cleaned = sanitize(w);
      if (cleaned.length === 5 && validWordsSetRef.current.has(cleaned)) {
        return cleaned;
      }
    }

    const compactText = sanitize(chatText);
    if (compactText.length >= 5) {
      for (let i = 0; i <= compactText.length - 5; i++) {
        const sub = compactText.substring(i, i + 5);
        if (validWordsSetRef.current.has(sub)) {
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

  // 3. Connect to local TikFinity WebSocket (Continuous Reconnect without limit)
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isMounted = true;

    const connectTikFinity = () => {
      if (!isMounted) return;

      try {
        // Use 127.0.0.1 explicitly to avoid Windows IPv6 resolution issues with localhost
        ws = new WebSocket('ws://127.0.0.1:21213/');
      } catch (e) {
        tikFinityConnectedRef.current = false;
        broadcastTikFinityStatus(false);
        if (isMounted) reconnectTimeout = setTimeout(connectTikFinity, 3000);
        return;
      }

      ws.onopen = () => {
        if (!isMounted) return;
        console.log('✅ Connected to TikFinity local WebSocket (ws://127.0.0.1:21213/)');
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
        reconnectTimeout = setTimeout(connectTikFinity, 3000);
      };

      ws.onerror = () => {
        try {
          if (ws) ws.close();
        } catch (_) {}
      };
    };

    connectTikFinity();

    return () => {
      isMounted = false;
      if (ws) {
        try { ws.close(); } catch (_) {}
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
    if (state.anagramStatus !== 'won') {
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
        
        let roundMvp = user;
        if (allSolved) {
          const scores = {};
          updatedAnagramWords.forEach(w => {
            if (w.winner && w.winner.nickname) {
              const nick = w.winner.nickname;
              scores[nick] = (scores[nick] || 0) + 1;
            }
          });
          
          let maxScore = scores[user.nickname] || 0;
          
          for (const w of updatedAnagramWords) {
            if (w.winner && w.winner.nickname) {
              const nick = w.winner.nickname;
              if (scores[nick] > maxScore) {
                maxScore = scores[nick];
                roundMvp = w.winner;
              }
            }
          }
        }
        
        const newAnagramStatus = allSolved ? 'won' : 'playing';

        // Add win points to Anagram Leaderboard
        const updatedAnagramLeaderboard = recordAnagramWin(user, updatedState);

        updatedState = {
          ...updatedState,
          anagramWords: updatedAnagramWords,
          anagramStatus: newAnagramStatus,
          anagramWinner: allSolved ? roundMvp : updatedState.anagramWinner,
          anagramLeaderboard: updatedAnagramLeaderboard,
        };
        stateChanged = true;

        if (allSolved) {
          // Win screen triggered reactively via useEffect
        }
      }
    }

    // 2. Process Wordle
    if (state.wordleStatus !== 'won') {
      const guessStr = extractGuess(chatText);

      if (guessStr) {
        const newGuesses = [...(updatedState.guesses || []), { word: guessStr, user }];
        let newWordleStatus = updatedState.wordleStatus;
        let wordleWinner = updatedState.wordleWinner;

        if (guessStr === updatedState.targetWord) {
          newWordleStatus = 'won';
          wordleWinner = user;

          // Add win points to Wordle Leaderboard
          const updatedWordleLeaderboard = recordWordleWin(user, updatedState);
          updatedState.wordleLeaderboard = updatedWordleLeaderboard;
        }

        updatedState = {
          ...updatedState,
          guesses: newGuesses,
          wordleStatus: newWordleStatus,
          wordleWinner: wordleWinner,
        };
        stateChanged = true;

        if (newWordleStatus === 'won') {
          // Win screen triggered reactively via useEffect
        }
      }
    }

    if (stateChanged) {
      gameStateRef.current = updatedState;
      setGameState(updatedState);
      broadcastState(updatedState);
    }
  };

  // View Routing logic
  const isViewAll = viewType === 'all';
  const showWordle = viewType === 'wordle' || (isViewAll && (gameState.mode === 'wordle' || gameState.mode === 'dual'));
  const showAnagram = viewType === 'anagram' || (isViewAll && (gameState.mode === 'anagram' || gameState.mode === 'dual'));
  
  const showWordleLeaderboard = viewType === 'leaderboard-wordle' || viewType === 'leaderboard_wordle' || viewType === 'leaderboard' || viewType === 'leaderboards';
  const showAnagramLeaderboard = viewType === 'leaderboard-anagram' || viewType === 'leaderboard_anagram' || viewType === 'leaderboard' || viewType === 'leaderboards';

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

        {/* WORDLE LEADERBOARD */}
        {showWordleLeaderboard && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LeaderboardBoard gameState={gameState} type="wordle" />
          </div>
        )}

        {/* ANAGRAM LEADERBOARD */}
        {showAnagramLeaderboard && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LeaderboardBoard gameState={gameState} type="anagram" />
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
