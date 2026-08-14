import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import WordleBoard from '../components/WordleBoard';
import AnagramBoard from '../components/AnagramBoard';
import LongWordleBoard from '../components/LongWordleBoard';
import LongAnagramBoard from '../components/LongAnagramBoard';
import LeaderboardBoard from '../components/LeaderboardBoard';
import WinCard from '../components/WinCard';
import TimeoutCard from '../components/TimeoutCard';

export default function Overlay() {
  // Persistence helpers for Wordle, Anagram, Long Wordle, & Long Anagram Leaderboards
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

  const loadLongWordleLeaderboard = () => {
    try {
      const saved = localStorage.getItem('yotebak_leaderboard_longwordle');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  };

  const saveLongWordleLeaderboard = (data) => {
    try {
      localStorage.setItem('yotebak_leaderboard_longwordle', JSON.stringify(data));
    } catch (_) {}
  };

  const loadLongAnagramLeaderboard = () => {
    try {
      const saved = localStorage.getItem('yotebak_leaderboard_longanagram');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  };

  const saveLongAnagramLeaderboard = (data) => {
    try {
      localStorage.setItem('yotebak_leaderboard_longanagram', JSON.stringify(data));
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

  // Game state (Wordle & Anagram & Long Wordle & Long Anagram & Separate Leaderboards)
  const [gameState, setGameState] = useState({
    mode: 'dual', // 'wordle' | 'anagram' | 'dual' | 'longwordle' | 'longanagram'
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
    // Long Wordle state
    longWordleTargetWord: 'abstinensi',
    longWordleGuesses: [{
      word: 'abstinensi',
      user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=7c3aed&color=fff' }
    }],
    longWordleStatus: 'playing', // 'playing' | 'won'
    longWordleWinner: null,
    longWordLength: 10,
    longWordleMaxRows: 6,
    // Long Anagram state
    longAnagramWords: [],
    longAnagramStatus: 'playing', // 'playing' | 'won'
    longAnagramWinner: null,
    longAnagramRows: 3,
    // Separate Leaderboards
    wordleLeaderboard: loadWordleLeaderboard(),
    anagramLeaderboard: loadAnagramLeaderboard(),
    longWordleLeaderboard: loadLongWordleLeaderboard(),
    longAnagramLeaderboard: loadLongAnagramLeaderboard(),
    maxLeaderboardRows: loadMaxLeaderboardRows(),
    // Status fallback
    status: 'playing',
    winner: null,
  });

  const [wordleWinState, setWordleWinState] = useState({ show: false, winner: null, word: '' });
  const [anagramWinState, setAnagramWinState] = useState({ show: false, winner: null, word: '' });
  const [longWordleWinState, setLongWordleWinState] = useState({ show: false, winner: null, word: '' });
  const [longAnagramWinState, setLongAnagramWinState] = useState({ show: false, winner: null, word: '' });
  const [timeoutState, setTimeoutState] = useState({ show: false, word: '' });

  // TikFinity connection status
  const tikFinityConnectedRef = useRef(false);

  // Auto-restart: timestamps for Wordle, Anagram, Long Wordle, and Long Anagram
  const RESTART_DELAY_MS = 10000;
  const wordleEndedAtRef = useRef(null);
  const anagramEndedAtRef = useRef(null);
  const longWordleEndedAtRef = useRef(null);
  const longAnagramEndedAtRef = useRef(null);

  const targetWordsRef = useRef([]);
  const validWordsSetRef = useRef(new Set());
  const playedWordsRef = useRef(new Set());
  const currentWordLengthRef = useRef(5);

  const longWordlistDataRef = useRef({});
  const targetLongWordsRef = useRef([]);
  const validLongWordsSetRef = useRef(new Set());
  const playedLongWordsRef = useRef(new Set());
  const currentLongWordLengthRef = useRef(10);

  // WebRTC refs & Local Broadcast Channel for seamless multi-overlay sync
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);
  const broadcastChannelRef = useRef(null);
  const [roomCode, setRoomCode] = useState('');
  const [viewType, setViewType] = useState('all'); // 'all' | 'wordle' | 'anagram' | 'longwordle' | 'longanagram' | 'leaderboard'

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

  // Record win helper for Long Wordle
  const recordLongWordleWin = (user, currentState) => {
    if (!user || !user.nickname || user.nickname === 'Host' || user.nickname === 'Last Word' || user.nickname === 'Kata Lalu') {
      return currentState.longWordleLeaderboard || [];
    }

    const currentList = currentState.longWordleLeaderboard || loadLongWordleLeaderboard();
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
        profilePic: user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanNick)}&background=7c3aed&color=fff`,
        points: 1,
        lastWinAt: Date.now()
      });
    }

    list.sort((a, b) => (b.points - a.points) || (b.lastWinAt - a.lastWinAt));
    saveLongWordleLeaderboard(list);
    return list;
  };

  // Record win helper for Long Anagram
  const recordLongAnagramWin = (user, currentState) => {
    if (!user || !user.nickname || user.nickname === 'Host' || user.nickname === 'Last Word' || user.nickname === 'Kata Lalu') {
      return currentState.longAnagramLeaderboard || [];
    }

    const currentList = currentState.longAnagramLeaderboard || loadLongAnagramLeaderboard();
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
        profilePic: user.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanNick)}&background=4f46e5&color=fff`,
        points: 1,
        lastWinAt: Date.now()
      });
    }

    list.sort((a, b) => (b.points - a.points) || (b.lastWinAt - a.lastWinAt));
    saveLongAnagramLeaderboard(list);
    return list;
  };

  // Reset leaderboard helper
  const handleResetLeaderboard = (target = 'all') => {
    let newWordle = gameStateRef.current?.wordleLeaderboard || [];
    let newAnagram = gameStateRef.current?.anagramLeaderboard || [];
    let newLongWordle = gameStateRef.current?.longWordleLeaderboard || [];
    let newLongAnagram = gameStateRef.current?.longAnagramLeaderboard || [];

    if (target === 'wordle' || target === 'all') {
      saveWordleLeaderboard([]);
      newWordle = [];
    }
    if (target === 'anagram' || target === 'all') {
      saveAnagramLeaderboard([]);
      newAnagram = [];
    }
    if (target === 'longwordle' || target === 'all') {
      saveLongWordleLeaderboard([]);
      newLongWordle = [];
    }
    if (target === 'longanagram' || target === 'all') {
      saveLongAnagramLeaderboard([]);
      newLongAnagram = [];
    }

    setGameState(prev => {
      const updated = { 
        ...prev, 
        wordleLeaderboard: newWordle, 
        anagramLeaderboard: newAnagram,
        longWordleLeaderboard: newLongWordle,
        longAnagramLeaderboard: newLongAnagram
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

    // Long Wordle end tracking & Win Screen Trigger
    if (gameState.longWordleStatus === 'won') {
      if (!longWordleEndedAtRef.current) {
        longWordleEndedAtRef.current = Date.now();
        setLongWordleWinState({
          show: true,
          winner: gameState.longWordleWinner,
          word: gameState.longWordleTargetWord
        });
      }
    } else {
      longWordleEndedAtRef.current = null;
      setLongWordleWinState(prev => prev.show ? { ...prev, show: false } : prev);
    }

    // Long Anagram end tracking & Win Screen Trigger
    if (gameState.longAnagramStatus === 'won') {
      if (!longAnagramEndedAtRef.current) {
        longAnagramEndedAtRef.current = Date.now();
        const allTargetWords = (gameState.longAnagramWords || []).map(w => w.targetWord).join(', ');
        setLongAnagramWinState({
          show: true,
          winner: gameState.longAnagramWinner,
          word: allTargetWords
        });
      }
    } else {
      longAnagramEndedAtRef.current = null;
      setLongAnagramWinState(prev => prev.show ? { ...prev, show: false } : prev);
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

      // Long Wordle restarts independently
      if (longWordleEndedAtRef.current && (now - longWordleEndedAtRef.current >= RESTART_DELAY_MS)) {
        longWordleEndedAtRef.current = null;
        restartLongWordlePart();
      }

      // Long Anagram restarts independently
      if (longAnagramEndedAtRef.current && (now - longAnagramEndedAtRef.current >= RESTART_DELAY_MS)) {
        longAnagramEndedAtRef.current = null;
        restartLongAnagramPart();
      }
    }, 1000);

    return () => clearInterval(checkRestart);
  }, [gameState.wordleStatus, gameState.anagramStatus, gameState.longWordleStatus, gameState.longAnagramStatus, gameState.wordleWinner, gameState.anagramWinner, gameState.longWordleWinner, gameState.longAnagramWinner, gameState.targetWord, gameState.anagramWords, gameState.longWordleTargetWord, gameState.longAnagramWords]);

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

  const loadPlayedLongWords = () => {
    try {
      const saved = localStorage.getItem('yotebak_played_long_words');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          return new Set(arr);
        }
      }
    } catch (_) {}
    return new Set();
  };

  const savePlayedLongWords = (set) => {
    try {
      localStorage.setItem('yotebak_played_long_words', JSON.stringify(Array.from(set)));
    } catch (_) {}
  };

  const loadWords = async (length = 5) => {
    try {
      const suffix = length === 5 ? '' : `_${length}`;
      const targetRes = await fetch(`/target_words_id${suffix}.txt`);
      const targetText = await targetRes.text();
      const targets = targetText.split('\n')
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length === length);
      targetWordsRef.current = targets;

      const validRes = await fetch(`/valid_words_id${suffix}.txt`);
      const validText = await validRes.text();
      const valids = validText.split('\n')
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length === length);
      
      const validSet = new Set(valids);
      targets.forEach(w => validSet.add(w));
      validWordsSetRef.current = validSet;

      playedWordsRef.current = loadPlayedWords();
      currentWordLengthRef.current = length;
      console.log(`Loaded ${targets.length} target words (length ${length}) and ${validSet.size} valid words.`);
      return targets;
    } catch (err) {
      console.error("Failed to load word files:", err);
      return [];
    }
  };

  const loadLongWords = async (length = 10) => {
    try {
      let data = longWordlistDataRef.current;
      if (!data || Object.keys(data).length === 0) {
        const res = await fetch('/wordlist.json');
        data = await res.json();
        longWordlistDataRef.current = data;
      }

      const validSet = new Set();
      Object.values(data).forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(w => validSet.add(w.trim().toLowerCase()));
        }
      });
      validLongWordsSetRef.current = validSet;

      let targetLen = length;
      if (targetLen === 'random' || targetLen === 0) {
        const availableLens = [10, 11, 12, 13, 14, 15];
        targetLen = availableLens[Math.floor(Math.random() * availableLens.length)];
      }

      const key = String(targetLen);
      const targets = (data[key] || []).map(w => w.trim().toLowerCase());
      targetLongWordsRef.current = targets;
      playedLongWordsRef.current = loadPlayedLongWords();
      currentLongWordLengthRef.current = targetLen;

      console.log(`Loaded ${targets.length} Long Wordle target words (length ${targetLen}) and ${validSet.size} total valid long words.`);
      return targets;
    } catch (err) {
      console.error("Failed to load wordlist.json:", err);
      return [];
    }
  };

  // 1. Fetch word list files and synchronize initial game state
  useEffect(() => {
    document.body.classList.add('bg-magenta');
    const query = new URLSearchParams(window.location.search);
    const room = query.get('room') || 'default_room';

    const initialize = async () => {
      let initialLength = 5;
      let initialLongLength = 10;
      let existingState = null;
      try {
        const saved = localStorage.getItem(`yotebak_active_game_${room}`);
        if (saved) {
          existingState = JSON.parse(saved);
          if (existingState && existingState.wordLength) {
            initialLength = existingState.wordLength;
          } else if (existingState && existingState.targetWord) {
            initialLength = existingState.targetWord.length;
          }
          if (existingState && existingState.longWordLength) {
            initialLongLength = existingState.longWordLength;
          }
        }
      } catch (_) {}

      const targets = await loadWords(initialLength);
      const longTargets = await loadLongWords(initialLongLength);

      const view = (query.get('view') || query.get('type') || 'all').toLowerCase();
      if (existingState && (existingState.targetWord || existingState.longWordleTargetWord || existingState.longAnagramWords?.length > 0)) {
        console.log("Synchronized with active room game state:", existingState.targetWord || existingState.longWordleTargetWord);
        gameStateRef.current = { ...existingState, wordLength: initialLength, longWordLength: initialLongLength };
        setGameState(gameStateRef.current);
      } else if (view === 'longwordle') {
        initGame('longwordle', null, longTargets, null, initialLongLength);
      } else if (view === 'longanagram') {
        initGame('longanagram', null, longTargets, null, initialLongLength);
      } else {
        initGame('dual', null, targets, null, initialLength);
      }
    };

    initialize();

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
    else if (view === 'longwordle') viewSuffix = '-longwordle';
    else if (view === 'longanagram') viewSuffix = '-longanagram';
    else if (view === 'leaderboard-wordle' || view === 'leaderboard_wordle') viewSuffix = '-leaderboard-wordle';
    else if (view === 'leaderboard-anagram' || view === 'leaderboard_anagram') viewSuffix = '-leaderboard-anagram';
    else if (view === 'leaderboard-longwordle' || view === 'leaderboard_longwordle') viewSuffix = '-leaderboard-longwordle';
    else if (view === 'leaderboard-longanagram' || view === 'leaderboard_longanagram') viewSuffix = '-leaderboard-longanagram';
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

      conn.on('data', async (data) => {
        if (data.type === 'startGame') {
          if (data.mode === 'longwordle') {
            const length = data.longWordLength || 10;
            let targets = targetLongWordsRef.current;
            if (length !== currentLongWordLengthRef.current || !targets || !targets.length) {
              targets = await loadLongWords(length);
            }
            initGame('longwordle', data.word, targets, null, length);
          } else if (data.mode === 'longanagram') {
            const length = data.longWordLength || 10;
            let targets = targetLongWordsRef.current;
            if (length !== currentLongWordLengthRef.current || !targets || !targets.length) {
              targets = await loadLongWords(length);
            }
            initGame('longanagram', data.word, targets, data.longAnagramRows || data.anagramRows, length);
          } else {
            const length = data.wordLength || 5;
            let targets = targetWordsRef.current;
            if (length !== currentWordLengthRef.current) {
              targets = await loadWords(length);
            }
            initGame(data.mode, data.word, targets, data.anagramRows, length);
          }
        } else if (data.type === 'updateLongWordLength') {
          const length = data.longWordLength || 10;
          const targets = await loadLongWords(length);
          const currentMode = gameStateRef.current?.mode;
          if (currentMode === 'longanagram') {
            initGame('longanagram', null, targets, gameStateRef.current?.longAnagramRows, length);
          } else {
            initGame('longwordle', null, targets, null, length);
          }
        } else if (data.type === 'updateLongWordleMaxRows') {
          setGameState(prev => {
            const newState = { ...prev, longWordleMaxRows: data.maxRows };
            gameStateRef.current = newState;
            broadcastState(newState);
            return newState;
          });
        } else if (data.type === 'updateLongAnagramRows') {
          setGameState(prev => {
            const newState = { ...prev, longAnagramRows: data.longAnagramRows };
            gameStateRef.current = newState;
            broadcastState(newState);
            return newState;
          });
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

  // Helper: Scramble word (ensures no letter is visually in its original position)
  const scrambleWord = (word) => {
    const originalArr = word.split('');
    let scrambledArr = [...originalArr];
    let attempts = 0;
    
    // Check if any letter visually remains in the same spot
    const hasOriginalPosition = (arr) => {
      for (let i = 0; i < word.length; i++) {
        if (arr[i] === word[i]) return true;
      }
      return false;
    };

    // Attempt up to 50 times to get a perfect derangement
    while (attempts < 50) {
      for (let i = scrambledArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scrambledArr[i], scrambledArr[j]] = [scrambledArr[j], scrambledArr[i]];
      }
      
      if (!hasOriginalPosition(scrambledArr)) {
        return scrambledArr.join('');
      }
      attempts++;
    }

    // Fallback: Just ensure the overall word isn't exactly the original word
    let fallbackScrambled = word;
    attempts = 0;
    while (fallbackScrambled === word && attempts < 10) {
      for (let i = scrambledArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scrambledArr[i], scrambledArr[j]] = [scrambledArr[j], scrambledArr[i]];
      }
      fallbackScrambled = scrambledArr.join('');
      attempts++;
    }
    
    return fallbackScrambled;
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

  // Draw a guaranteed unique non-repeated target word for Long Wordle & Long Anagram
  const drawLongTargetWord = (targets = targetLongWordsRef.current) => {
    if (!targets || targets.length === 0) return 'abstinensi';

    let available = targets.filter(w => !playedLongWordsRef.current.has(w));
    if (available.length === 0) {
      console.log(`[LongWordPool] Semua ${targets.length} kata telah dimainkan! Mereset pool kata dari awal.`);
      playedLongWordsRef.current.clear();
      savePlayedLongWords(playedLongWordsRef.current);
      available = [...targets];
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    playedLongWordsRef.current.add(picked);
    savePlayedLongWords(playedLongWordsRef.current);

    console.log(`[LongWordPool] Kata terpilih: "${picked}" | Progres Pool: ${playedLongWordsRef.current.size} / ${targets.length} kata`);
    return picked;
  };

  // Helper: Generate list of Long Anagram words with guaranteed non-repetition
  const generateLongAnagramWords = (targets = targetLongWordsRef.current, count = 3) => {
    const chosenWords = [];
    while (chosenWords.length < count) {
      const picked = drawLongTargetWord(targets);
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

  // Get a random hint word for Long Wordle "Last Word"
  const getRandomLongHintWord = (targets = targetLongWordsRef.current) => {
    if (!targets || targets.length === 0) return 'abstinensi';
    return targets[Math.floor(Math.random() * targets.length)];
  };

  // Initialize Game (Wordle, Anagram, Dual, Long Wordle, or Long Anagram)
  const initGame = (mode, specificWord = null, overrideTargets = null, anagramCount = null, overrideLength = null) => {
    const currentState = gameStateRef.current || {};
    
    if (mode === 'longwordle') {
      const longLen = overrideLength || currentState.longWordLength || 10;
      const targets = overrideTargets || targetLongWordsRef.current;
      const longWord = specificWord ? specificWord.toLowerCase() : drawLongTargetWord(targets);
      const lastLongWord = currentState.longWordleTargetWord;
      const firstGuess = (lastLongWord && lastLongWord.length === longLen) 
        ? lastLongWord 
        : getRandomLongHintWord(targets);

      const newGameState = {
        ...currentState,
        mode: 'longwordle',
        longWordLength: longLen,
        longWordleTargetWord: longWord,
        longWordleGuesses: [{
          word: firstGuess,
          user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=7c3aed&color=fff' }
        }],
        longWordleStatus: 'playing',
        longWordleWinner: null,
        longWordleMaxRows: currentState.longWordleMaxRows || 6,
        longPoolPlayed: playedLongWordsRef.current.size,
        longPoolTotal: targets.length || 4420,
      };

      gameStateRef.current = newGameState;
      setGameState(newGameState);
      setLongWordleWinState({ show: false, winner: null, word: '' });
      setTimeoutState({ show: false, word: '' });
      broadcastState(newGameState);
      return;
    }

    if (mode === 'longanagram') {
      const longLen = overrideLength || currentState.longWordLength || 10;
      const targets = overrideTargets || targetLongWordsRef.current;
      const count = anagramCount || (currentState.longAnagramRows || 3);
      const validRows = Math.min(Math.max(Number(count) || 3, 1), 6);
      const longAnagramList = generateLongAnagramWords(targets, validRows);

      const newGameState = {
        ...currentState,
        mode: 'longanagram',
        longWordLength: longLen,
        longAnagramWords: longAnagramList,
        longAnagramStatus: 'playing',
        longAnagramWinner: null,
        longAnagramRows: validRows,
        longPoolPlayed: playedLongWordsRef.current.size,
        longPoolTotal: targets.length || 4420,
      };

      gameStateRef.current = newGameState;
      setGameState(newGameState);
      setLongAnagramWinState({ show: false, winner: null, word: '' });
      setTimeoutState({ show: false, word: '' });
      broadcastState(newGameState);
      return;
    }

    const targets = overrideTargets || targetWordsRef.current;
    const wordLength = overrideLength || currentState.wordLength || 5;
    
    const oldMaxRows = currentState.maxRows || 6;
    const count = anagramCount || (currentState.anagramRows || 3);
    const validAnagramRows = Math.min(Math.max(Number(count) || 3, 1), 6);

    const isResetWordle = mode === 'wordle' || mode === 'dual' || !currentState.targetWord;
    const isResetAnagram = mode === 'anagram' || mode === 'dual' || !currentState.anagramWords || currentState.anagramWords.length === 0;

    const wordleWord = isResetWordle 
      ? (specificWord ? specificWord.toLowerCase() : drawTargetWord(targets))
      : currentState.targetWord;

    const lastWordleWord = currentState.targetWord;
    const firstGuess = (lastWordleWord && lastWordleWord.length === wordLength) ? lastWordleWord : getRandomHintWord(targets);

    const wordleGuesses = isResetWordle
      ? [{ word: firstGuess, user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=4ca371&color=fff' } }]
      : currentState.guesses;

    const anagramList = isResetAnagram
      ? generateAnagramWords(targets, validAnagramRows)
      : currentState.anagramWords;

    const longWordleGuesses = (currentState.longWordleGuesses && currentState.longWordleGuesses.length > 0)
      ? currentState.longWordleGuesses
      : [{
          word: getRandomLongHintWord(targetLongWordsRef.current),
          user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=7c3aed&color=fff' }
        }];

    const newGameState = {
      ...currentState,
      mode: mode,
      wordLength: wordLength,
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
      // Long Wordle fields seed
      longWordleGuesses: longWordleGuesses,
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
    const currentState = gameStateRef.current;
    const targets = targetWordsRef.current;
    const wordLength = currentState.wordLength || 5;

    const wordleWord = drawTargetWord(targets);
    const lastWordleWord = currentState.targetWord;
    const firstGuess = (lastWordleWord && lastWordleWord.length === wordLength) ? lastWordleWord : getRandomHintWord(targets);

    setGameState(prev => {
      const updated = {
        ...prev,
        targetWord: wordleWord,
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

  // Restart strictly only Long Wordle section
  const restartLongWordlePart = () => {
    const currentState = gameStateRef.current;
    const targets = targetLongWordsRef.current;
    const wordLength = currentState.longWordLength || 10;

    const longWord = drawLongTargetWord(targets);
    const lastLongWord = currentState.longWordleTargetWord;
    const firstGuess = (lastLongWord && lastLongWord.length === wordLength) ? lastLongWord : getRandomLongHintWord(targets);

    setGameState(prev => {
      const updated = {
        ...prev,
        longWordleTargetWord: longWord,
        longWordleGuesses: [{
          word: firstGuess,
          user: { nickname: 'Last Word', profilePic: 'https://ui-avatars.com/api/?name=Last+Word&background=7c3aed&color=fff' }
        }],
        longWordleStatus: 'playing',
        longWordleWinner: null,
        longPoolPlayed: playedLongWordsRef.current.size,
      };
      gameStateRef.current = updated;
      broadcastState(updated);
      return updated;
    });
    setLongWordleWinState({ show: false, winner: null, word: '' });
  };

  // Restart strictly only Long Anagram section
  const restartLongAnagramPart = () => {
    const currentState = gameStateRef.current;
    const targets = targetLongWordsRef.current;
    const validRows = currentState?.longAnagramRows || 3;
    const longAnagramList = generateLongAnagramWords(targets, validRows);

    setGameState(prev => {
      const updated = {
        ...prev,
        longAnagramWords: longAnagramList,
        longAnagramStatus: 'playing',
        longAnagramWinner: null,
        longPoolPlayed: playedLongWordsRef.current.size,
      };
      gameStateRef.current = updated;
      broadcastState(updated);
      return updated;
    });
    setLongAnagramWinState({ show: false, winner: null, word: '' });
  };

  // Sanitize helper
  const sanitize = (text) => {
    return text.replace(/[^a-zA-Z]/g, '').toLowerCase();
  };

  // Extract N-letter valid guess from chat text
  const extractGuess = (chatText) => {
    const length = currentWordLengthRef.current || 5;
    const directWord = sanitize(chatText);
    if (directWord.length === length && validWordsSetRef.current.has(directWord)) {
      return directWord;
    }

    const words = chatText.split(/\s+/);
    for (const w of words) {
      const cleaned = sanitize(w);
      if (cleaned.length === length && validWordsSetRef.current.has(cleaned)) {
        return cleaned;
      }
    }

    const compactText = sanitize(chatText);
    if (compactText.length >= length) {
      for (let i = 0; i <= compactText.length - length; i++) {
        const sub = compactText.substring(i, i + length);
        if (validWordsSetRef.current.has(sub)) {
          return sub;
        }
      }
    }

    return '';
  };

  // Extract Long Wordle guess from chat text
  const extractLongWordleGuess = (chatText, length = 10) => {
    const directWord = sanitize(chatText);
    if (directWord.length === length && (validLongWordsSetRef.current.has(directWord) || /^[a-z]+$/.test(directWord))) {
      return directWord;
    }

    const words = chatText.split(/\s+/);
    for (const w of words) {
      const cleaned = sanitize(w);
      if (cleaned.length === length && (validLongWordsSetRef.current.has(cleaned) || /^[a-z]+$/.test(cleaned))) {
        return cleaned;
      }
    }

    const compactText = sanitize(chatText);
    if (compactText.length >= length) {
      for (let i = 0; i <= compactText.length - length; i++) {
        const sub = compactText.substring(i, i + length);
        if (validLongWordsSetRef.current.has(sub)) {
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

  // Extract Long Anagram answer from chat text
  const extractLongAnagramGuess = (chatText, targetWord) => {
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

  // Handle comment event (Simultaneous routing for all active modes)
  const handleChat = (data) => {
    const state = gameStateRef.current;
    const chatText = (data.comment || data.text || '').trim().toLowerCase();
    
    // Create a unique signature for this chat event to prevent double-processing in multi-overlay setups
    const timeBucket = Math.floor(Date.now() / 2000);
    const rawNick = data.nickname || data.uniqueId || 'User';
    const chatSignature = `${rawNick}-${chatText}-${timeBucket}`;

    const processedChats = state.lastProcessedChats || [];
    if (processedChats.includes(chatSignature)) {
      return; // Already processed by another overlay instance that synced the state
    }

    const user = {
      nickname: rawNick,
      profilePic: data.profilePictureUrl || 'https://ui-avatars.com/api/?name=User'
    };

    let updatedState = { ...state };
    let stateChanged = false;

    // 1. Process Standard Anagram
    if (state.anagramStatus !== 'won' && (state.mode === 'anagram' || state.mode === 'dual' || viewType === 'anagram')) {
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
      }
    }

    // 2. Process Standard Wordle
    if (state.wordleStatus !== 'won' && (state.mode === 'wordle' || state.mode === 'dual' || viewType === 'wordle')) {
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
      }
    }

    // 3. Process Long Wordle
    if (state.longWordleStatus !== 'won' && (state.mode === 'longwordle' || viewType === 'longwordle' || isViewAll)) {
      const longLen = state.longWordLength || state.longWordleTargetWord?.length || 10;
      const guessStr = extractLongWordleGuess(chatText, longLen);

      if (guessStr) {
        const newGuesses = [...(updatedState.longWordleGuesses || []), { word: guessStr, user }];
        let newStatus = updatedState.longWordleStatus;
        let winner = updatedState.longWordleWinner;

        if (guessStr === updatedState.longWordleTargetWord) {
          newStatus = 'won';
          winner = user;

          // Add win points to Long Wordle Leaderboard
          const updatedLongLB = recordLongWordleWin(user, updatedState);
          updatedState.longWordleLeaderboard = updatedLongLB;
        }

        updatedState = {
          ...updatedState,
          longWordleGuesses: newGuesses,
          longWordleStatus: newStatus,
          longWordleWinner: winner,
        };
        stateChanged = true;
      }
    }

    // 4. Process Long Anagram
    if (state.longAnagramStatus !== 'won' && (state.mode === 'longanagram' || viewType === 'longanagram' || isViewAll)) {
      const longAnagramWords = state.longAnagramWords || [];
      let solvedWordIndex = -1;

      for (let i = 0; i < longAnagramWords.length; i++) {
        if (!longAnagramWords[i].solved) {
          const matched = extractLongAnagramGuess(chatText, longAnagramWords[i].targetWord);
          if (matched) {
            solvedWordIndex = i;
            break;
          }
        }
      }

      if (solvedWordIndex !== -1) {
        const updatedLongAnagramWords = longAnagramWords.map((w, idx) => {
          if (idx === solvedWordIndex) {
            return { ...w, solved: true, winner: user };
          }
          return w;
        });

        const allSolved = updatedLongAnagramWords.every(w => w.solved);
        
        let roundMvp = user;
        if (allSolved) {
          const scores = {};
          updatedLongAnagramWords.forEach(w => {
            if (w.winner && w.winner.nickname) {
              const nick = w.winner.nickname;
              scores[nick] = (scores[nick] || 0) + 1;
            }
          });
          
          let maxScore = scores[user.nickname] || 0;
          
          for (const w of updatedLongAnagramWords) {
            if (w.winner && w.winner.nickname) {
              const nick = w.winner.nickname;
              if (scores[nick] > maxScore) {
                maxScore = scores[nick];
                roundMvp = w.winner;
              }
            }
          }
        }
        
        const newStatus = allSolved ? 'won' : 'playing';

        // Add win points to Long Anagram Leaderboard
        const updatedLongAnagramLB = recordLongAnagramWin(user, updatedState);

        updatedState = {
          ...updatedState,
          longAnagramWords: updatedLongAnagramWords,
          longAnagramStatus: newStatus,
          longAnagramWinner: allSolved ? roundMvp : updatedState.longAnagramWinner,
          longAnagramLeaderboard: updatedLongAnagramLB,
        };
        stateChanged = true;
      }
    }

    if (stateChanged) {
      // Keep only the last 20 chat signatures to avoid memory bloat
      const newProcessedChats = [chatSignature, ...processedChats].slice(0, 20);
      updatedState.lastProcessedChats = newProcessedChats;

      gameStateRef.current = updatedState;
      setGameState(updatedState);
      broadcastState(updatedState);
    }
  };

  // View Routing logic
  const isViewAll = viewType === 'all';
  const showWordle = viewType === 'wordle' || (isViewAll && (gameState.mode === 'wordle' || gameState.mode === 'dual'));
  const showAnagram = viewType === 'anagram' || (isViewAll && (gameState.mode === 'anagram' || gameState.mode === 'dual'));
  const showLongWordle = viewType === 'longwordle' || (isViewAll && gameState.mode === 'longwordle');
  const showLongAnagram = viewType === 'longanagram' || (isViewAll && gameState.mode === 'longanagram');
  
  const showWordleLeaderboard = viewType === 'leaderboard-wordle' || viewType === 'leaderboard_wordle' || ((viewType === 'leaderboard' || viewType === 'leaderboards') && gameState.mode !== 'longwordle' && gameState.mode !== 'longanagram');
  const showAnagramLeaderboard = viewType === 'leaderboard-anagram' || viewType === 'leaderboard_anagram' || ((viewType === 'leaderboard' || viewType === 'leaderboards') && gameState.mode !== 'longwordle' && gameState.mode !== 'longanagram');
  const showLongWordleLeaderboard = viewType === 'leaderboard-longwordle' || viewType === 'leaderboard_longwordle' || ((viewType === 'leaderboard' || viewType === 'leaderboards') && gameState.mode === 'longwordle');
  const showLongAnagramLeaderboard = viewType === 'leaderboard-longanagram' || viewType === 'leaderboard_longanagram' || ((viewType === 'leaderboard' || viewType === 'leaderboards') && gameState.mode === 'longanagram');

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', padding: '1.5rem', overflow: 'hidden' }}>
      {/* Koneksi Peer Indicator (hanya terlihat jika di luar OBS / butuh debug) */}
      <div style={{ position: 'absolute', top: 5, right: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
        Kamar: {roomCode} {viewType !== 'all' ? `(Khusus ${viewType.toUpperCase()})` : (gameState.mode === 'dual' ? '(Mode Dual)' : (gameState.mode === 'longwordle' ? '(Long Wordle)' : (gameState.mode === 'longanagram' ? '(Long Anagram)' : '')))}
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

        {/* LONG WORDLE BOARD */}
        {showLongWordle && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LongWordleBoard gameState={gameState} />

            {longWordleWinState.winner && (
              <WinCard 
                show={longWordleWinState.show}
                winner={longWordleWinState.winner} 
                word={longWordleWinState.word} 
                mode="longwordle" 
                onExited={() => setLongWordleWinState((prev) => ({ ...prev, winner: null }))}
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

        {/* LONG ANAGRAM BOARD */}
        {showLongAnagram && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LongAnagramBoard gameState={gameState} />

            {longAnagramWinState.winner && (
              <WinCard 
                show={longAnagramWinState.show}
                winner={longAnagramWinState.winner} 
                word={longAnagramWinState.word} 
                mode="longanagram" 
                onExited={() => setLongAnagramWinState((prev) => ({ ...prev, winner: null }))}
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

        {/* LONG WORDLE LEADERBOARD */}
        {showLongWordleLeaderboard && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LeaderboardBoard gameState={gameState} type="longwordle" />
          </div>
        )}

        {/* LONG ANAGRAM LEADERBOARD */}
        {showLongAnagramLeaderboard && (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            <LeaderboardBoard gameState={gameState} type="longanagram" />
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
