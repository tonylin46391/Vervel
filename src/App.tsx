/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, 
  BarChart2, 
  Volume2, 
  ChevronRight,
  ChevronDown,
  RotateCcw,
  X,
  TrendingUp,
  Circle,
  LogIn,
  LogOut,
  User as UserIcon,
  XCircle,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { 
  vocabularySpellingList8, 
  vocabularySpellingList9, 
  vocabularySpellingList10, 
  vocabularySpellingList13, 
  vocabularyIS08, 
  vocabularyIS09,
  vocabularyDE07, 
  vocabularyDE08,
  vocabularyVocabulary2,
  vocabulary303RS01,
  vocabulary303IS01,
  vocabulary303DE01,
  vocabulary303IS03,
  vocabulary303RS02,
  vocabulary303MA01,
  vocabulary303DE02,
  vocabulary303RS03,
  vocabularyUnit3SpellingWords,
  vocabularyAdjToAdv, 
  VocabularyItem 
} from './data/vocabulary';
import { getKKPhonetic } from './data/phonetics';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  signInWithGoogleRedirect, 
  checkRedirectResult, 
  logout, 
  firebaseConfig 
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Tutor from './components/Tutor';
import { LoginModal } from './components/LoginModal';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

// Firestore Error Handler
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to speak text
const speak = (text: string, lang: string = 'en-US') => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
};

const SET_LABELS: Record<number, string> = {
  1: 'Spelling 12',
  2: 'Spelling 11',
  3: 'Spelling 10',
  4: 'vocabulary_1',
  5: 'IS_08',
  6: 'DE_07',
  7: '形容詞轉副詞',
  8: 'IS_09',
  9: 'DE_08',
  10: 'Vocabulary_2',
  11: '303_RS_01',
  12: '303_IS_01',
  13: '303_DE_01',
  14: '303_IS_03',
  15: '303_RS_02_Vc',
  16: '303_MA_01',
  17: '303_DE_02',
  18: '303_RS_03_Vc',
  19: 'Unit3-Spelling Words'
};

const getSetData = (setId: number): VocabularyItem[] => {
  switch (setId) {
    case 1: return vocabularySpellingList8;
    case 2: return vocabularySpellingList9;
    case 3: return vocabularySpellingList10;
    case 4: return vocabularySpellingList13;
    case 5: return vocabularyIS08;
    case 6: return vocabularyDE07;
    case 7: return vocabularyAdjToAdv;
    case 8: return vocabularyIS09;
    case 9: return vocabularyDE08;
    case 10: return vocabularyVocabulary2;
    case 11: return vocabulary303RS01;
    case 12: return vocabulary303IS01;
    case 13: return vocabulary303DE01;
    case 14: return vocabulary303IS03;
    case 15: return vocabulary303RS02;
    case 16: return vocabulary303MA01;
    case 17: return vocabulary303DE02;
    case 18: return vocabulary303RS03;
    case 19: return vocabularyUnit3SpellingWords;
    default: return vocabularySpellingList8;
  }
};

export default function App() {
  const [tutorMode, setTutorMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isInitialSyncRef = useRef(true);

  // Student Identity & Login Modal state
  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem('vocabulary_studentName') || '';
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const previousUserRef = useRef<User | null>(null);

  // Check redirect login result on mount
  useEffect(() => {
    checkRedirectResult()
      .then((result) => {
        if (result?.user) {
          showToast(`歡迎回來，${result.user.displayName || '使用者'}！`, 'success');
        }
      })
      .catch((error: any) => {
        console.error("Redirect login result error:", error);
        handleAuthError(error);
      });
  }, []);

  // Manual Sync Function
  const forceSyncFromCloud = async () => {
    if (!user) return;
    setIsSyncingManual(true);
    try {
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        if (data.currentSet) {
          setCurrentSet(data.currentSet);
          const targetData = getSetData(data.currentSet);
          const setKey = `set_${data.currentSet}`;
          if (data.progress && data.progress[setKey]) {
            const bStart = data.progress[setKey].batchStartIndex || 0;
            const cIndex = data.progress[setKey].currentIndex || 0;
            setBatchStartIndex(Math.min(Math.max(0, bStart), Math.max(0, targetData.length - 1)));
            setCurrentIndex(Math.min(Math.max(0, cIndex), Math.max(0, targetData.length - 1)));
          }
        }
      }
      const statsSnap = await getDocs(collection(db, 'users', user.uid, 'wordStats'));
      const cloudWordStats: Record<string, { c: number, t: number }> = {};
      statsSnap.forEach(d => {
        const docData = d.data();
        cloudWordStats[d.id] = { c: docData.c || 0, t: docData.t || 0 };
      });
      setWordStats(prev => ({ ...prev, ...cloudWordStats }));
      setLastSyncTime(new Date());
    } catch (e) {
      console.error("Manual sync failed:", e);
    } finally {
      setIsSyncingManual(false);
    }
  };
  
  // Initialize state from localStorage if available
  const [currentSet, setCurrentSet] = useState<number>(() => {
    const saved = localStorage.getItem('vocabulary_currentSet');
    return saved ? parseInt(saved, 10) || 1 : 1;
  });
  
  const [batchStartIndex, setBatchStartIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearStatsConfirm, setShowClearStatsConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [wordStats, setWordStats] = useState<Record<string, { c: number, t: number }>>({});
  const [history, setHistory] = useState<Array<{ date: string, type: string, score: string }>>([]);
  const [orderedData, setOrderedData] = useState<VocabularyItem[]>(() => {
    const saved = localStorage.getItem('vocabulary_currentSet');
    const setId = saved ? parseInt(saved, 10) || 1 : 1;
    return getSetData(setId);
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Initial Local Load
  useEffect(() => {
    const savedStats = localStorage.getItem('vocabulary_wordStats');
    if (savedStats) setWordStats(JSON.parse(savedStats));
    
    const savedHistory = localStorage.getItem('vocabulary_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedSet = localStorage.getItem('vocabulary_currentSet') || '1';
    const savedBatchStart = localStorage.getItem(`vocabulary_batchStartIndex_${savedSet}`);
    const savedCurrentIndex = localStorage.getItem(`vocabulary_currentIndex_${savedSet}`);
    
    setBatchStartIndex(savedBatchStart ? parseInt(savedBatchStart) : 0);
    setCurrentIndex(savedCurrentIndex ? parseInt(savedCurrentIndex) : (savedBatchStart ? parseInt(savedBatchStart) : 0));
  }, []);

  // Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeStats: (() => void) | null = null;
    let unsubscribeHistory: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Cleanup previous listeners
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeStats) unsubscribeStats();
      if (unsubscribeHistory) unsubscribeHistory();

      if (currentUser) {
        setIsLoadingFirestore(true);
        isInitialSyncRef.current = true;

        // 1. Listen to User Profile (Current Set & Progress)
        unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log("Cloud profile updated:", data);
            
            // Only sync currentSet and progress automatically if:
            // 1. It's the initial load OR
            // 2. The user is on the "stats" page (not actively practicing)
            const shouldSyncProgress = isInitialSyncRef.current || showStats;

            if (data.currentSet && shouldSyncProgress) {
              setCurrentSet(data.currentSet);
              const setKey = `set_${data.currentSet}`;
              if (data.progress && data.progress[setKey]) {
                const cloudBatchStart = data.progress[setKey].batchStartIndex || 0;
                const cloudCurrentIndex = data.progress[setKey].currentIndex || 0;
                
                setBatchStartIndex(cloudBatchStart);
                setCurrentIndex(cloudCurrentIndex);
              }
            }
          }
          if (isInitialSyncRef.current) {
            setIsLoadingFirestore(false);
            isInitialSyncRef.current = false;
          }
        }, (error) => {
          console.error("User profile sync error:", error);
          setIsLoadingFirestore(false);
          isInitialSyncRef.current = false;
        });

        // 2. Listen to Word Stats (Real-time sync)
        unsubscribeStats = onSnapshot(collection(db, 'users', currentUser.uid, 'wordStats'), (snapshot) => {
          console.log(`Cloud stats update: ${snapshot.size} words`);
          setLastSyncTime(new Date());
          
          const cloudWordStats: Record<string, { c: number, t: number }> = {};
          snapshot.forEach(doc => {
            const d = doc.data();
            cloudWordStats[doc.id] = { c: d.c || 0, t: d.t || 0 };
          });
          
          // Overwrite local state with cloud data to properly reflect deletions
          setWordStats(cloudWordStats);
        }, (error) => {
          console.error("Word stats sync error:", error);
        });

        // 3. Listen to History
        const historyQuery = query(
          collection(db, 'users', currentUser.uid, 'history'), 
          orderBy('createdAt', 'desc'), 
          limit(10)
        );
        unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
          const cloudHistory: any[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            cloudHistory.push({
              date: data.date,
              type: data.type,
              score: data.score
            });
          });
          // Always set state from cloud to ensure deletions are reflected
          setHistory(cloudHistory);
        }, (error) => {
          console.error("History sync error:", error);
        });

      } else {
        setIsLoadingFirestore(false);
        isInitialSyncRef.current = false;
        // Only clear local state if a previously authenticated user explicitly logged out
        if (previousUserRef.current !== null) {
          setWordStats({});
          setHistory([]);
          setStats({ correct: 0, total: 0 });
          localStorage.removeItem('vocabulary_wordStats');
          localStorage.removeItem('vocabulary_history');
        }
      }
      previousUserRef.current = currentUser;
    });

    return () => {
      authUnsubscribe();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeStats) unsubscribeStats();
      if (unsubscribeHistory) unsubscribeHistory();
    };
  }, []);

  // Sync Progress when Set changes (Internal to the application flow)
  useEffect(() => {
    if (user && !isInitialSyncRef.current && !isLoadingFirestore) {
      const loadProgress = async () => {
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            const setKey = `set_${currentSet}`;
            
            // 1. If cloud has different active set, update cloud to current local choice
            if (data.currentSet !== currentSet) {
              await setDoc(doc(db, 'users', user.uid), { 
                currentSet,
                updatedAt: serverTimestamp() 
              }, { merge: true });
            }

            // 2. Load progress for this specific set
            if (data.progress && data.progress[setKey]) {
              setBatchStartIndex(data.progress[setKey].batchStartIndex || 0);
              setCurrentIndex(data.progress[setKey].currentIndex || 0);
            } else {
              // Reset to local if no cloud progress for this set
              const savedBatchStart = localStorage.getItem(`vocabulary_batchStartIndex_${currentSet}`);
              const savedCurrentIndex = localStorage.getItem(`vocabulary_currentIndex_${currentSet}`);
              setBatchStartIndex(savedBatchStart ? parseInt(savedBatchStart) : 0);
              setCurrentIndex(savedCurrentIndex ? parseInt(savedCurrentIndex) : 0);
            }
          }
        } catch (error) {
          console.error("Progress fetch error:", error);
        }
      };
      loadProgress();
    }
  }, [user, currentSet]);

  // Load set data when currentSet changes
  useEffect(() => {
    const data = getSetData(currentSet);
    
    setOrderedData(data);
    localStorage.setItem('vocabulary_currentSet', currentSet.toString());

    // Only switch using local if NOT logged in or NOT in initial load
    if (!user && !isInitialSyncRef.current) {
      const savedBatchStart = localStorage.getItem(`vocabulary_batchStartIndex_${currentSet}`);
      const savedCurrentIndex = localStorage.getItem(`vocabulary_currentIndex_${currentSet}`);
      const bStart = savedBatchStart ? parseInt(savedBatchStart, 10) : 0;
      const cIndex = savedCurrentIndex ? parseInt(savedCurrentIndex, 10) : 0;
      setBatchStartIndex(Math.min(Math.max(0, isNaN(bStart) ? 0 : bStart), Math.max(0, data.length - 1)));
      setCurrentIndex(Math.min(Math.max(0, isNaN(cIndex) ? 0 : cIndex), Math.max(0, data.length - 1)));
    }
    
    setUserInput('');
    setIsCorrect(null);
    setShowStats(false);
    setStats({ correct: 0, total: 0 });
  }, [currentSet, user]);

  // Save to localStorage when stats or history change
  useEffect(() => {
    // ALWAYS save, even if empty, so reset works
    localStorage.setItem('vocabulary_wordStats', JSON.stringify(wordStats));
  }, [wordStats]);

  useEffect(() => {
    localStorage.setItem('vocabulary_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(`vocabulary_batchStartIndex_${currentSet}`, batchStartIndex.toString());
  }, [batchStartIndex, currentSet]);

  useEffect(() => {
    localStorage.setItem(`vocabulary_currentIndex_${currentSet}`, currentIndex.toString());
  }, [currentIndex, currentSet]);

  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, orderedData.length - 1));
  const currentWord = orderedData[safeCurrentIndex] || orderedData[0] || {
    word: '',
    translation: '',
    definitionEn: '',
    definitionCn: '',
    sentenceEn: '',
    sentenceCn: ''
  };

  const handleCheck = () => {
    const rawInput = inputRef.current ? inputRef.current.value : userInput;
    if (!rawInput.trim() || !currentWord.word) {
      inputRef.current?.focus();
      return;
    }
    
    const target = currentWord.word.toLowerCase().trim();
    const input = rawInput.toLowerCase().trim().replace(/\s+/g, ' ');
    const correct = input === target || 
      (target === 'absorbed' && input === 'absorb') ||
      (target === 'absorb' && input === 'absorbed') ||
      (target === 'peanuts' && input === 'peanut') ||
      (target === 'potato chips' && input === 'potato chip') ||
      (target === 'omelet' && input === 'omelette') ||
      (target === 'blue bird' && (input === 'bluebird' || input === 'blue bord')) ||
      (target === 'pond weed' && input === 'pondweed') ||
      (target === 'sun' && input === 'the sun') ||
      (target === 'cats' && input === 'cat') ||
      (target === 'foxes' && input === 'fox') ||
      (target === 'weeds' && input === 'weed') ||
      (target === 'crops' && input === 'crop') ||
      (target === 'pests' && input === 'pest') ||
      (target === 'vats' && input === 'vat') ||
      (target === 'vat' && input === 'vats') ||
      (target === 'machine' && input === 'machines') ||
      (target === 'machines' && input === 'machine') ||
      (target === 'neighbor' && input === 'neighbour') ||
      (target === 'greenhouse' && input === 'green house') ||
      (target === 'trapezoid' && (input === 'trapezium' || input === 'trapezoids' || input === 'trapeziums')) ||
      (target === 'right angle' && (input === 'rightangle' || input === 'right-angle' || input === 'right angles')) ||
      (target === 'acute angle' && (input === 'acuteangle' || input === 'acute-angle' || input === 'acute angles')) ||
      (target === 'obtuse angle' && (input === 'obtuseangle' || input === 'obtuse-angle' || input === 'obtuse angles')) ||
      (target === 'right triangle' && (input === 'righttriangle' || input === 'right-triangle' || input === 'right triangles')) ||
      (target === 'rhombus' && (input === 'rhombuses' || input === 'rhombi')) ||
      (target === 'quadrilateral' && input === 'quadrilaterals') ||
      (target === 'parallelogram' && input === 'parallelograms') ||
      (target === 'kite' && input === 'kites') ||
      (target === 'angle' && input === 'angles') ||
      (target === 'square' && input === 'squares') ||
      (target === 'rectangle' && input === 'rectangles') ||
      (target === 'park' && input === 'parks') ||
      (target === 'movie theater' && (input === 'movie theatre' || input === 'cinema' || input === 'movie theatres' || input === 'movie theaters')) ||
      (target === 'supermarket' && input === 'supermarkets') ||
      (target === 'post office' && input === 'post offices') ||
      (target === 'department store' && input === 'department stores') ||
      (target === 'library' && input === 'libraries') ||
      (target === 'shop' && (input === 'shops' || input === 'shopping')) ||
      (target === 'watch a movie' && (input === 'watch a film' || input === 'watching a movie' || input === 'watch movie' || input === 'watch movies')) ||
      (target === 'borrow books' && (input === 'borrow a book' || input === 'borrow book' || input === 'borrowing books')) ||
      (target === 'mail letters' && (input === 'mail a letter' || input === 'mail letter' || input === 'mailing letters' || input === 'send letters' || input === 'post letters')) ||
      (target === 'buy groceries' && (input === 'buying groceries' || input === 'buy grocery' || input === 'buying grocery')) ||
      (target === 'kick a ball' && (input === 'kicking a ball' || input === 'kick ball' || input === 'kick the ball')) ||
      (target === 'confesses' && input === 'confess') ||
      (target === 'carves' && input === 'carve') ||
      (target === 'fetches' && input === 'fetch') ||
      (target === 'tumbles' && input === 'tumble') ||
      (target === 'recycled' && input === 'recycle') ||
      (target === 'forage' && (input === 'forages' || input === 'foraging')) ||
      (target === 'ignore' && (input === 'ignores' || input === 'ignored')) ||
      (target === 'crochet' && (input === 'crochets' || input === 'crocheted')) ||
      (target === 'slurp' && (input === 'slurps' || input === 'slurped')) ||
      (target === 'windmill' && input === 'windmills') ||
      (target === 'lighthouse' && input === 'lighthouses') ||
      (target === 'harbormaster' && (input === 'harbor master' || input === 'harbormasters')) ||
      (target === 'secondhand' && (input === 'second-hand' || input === 'second hand')) ||
      (target === 'fisherman' && input === 'fishermen') ||
      (target === 'blueberry' && input === 'blueberries') ||
      (target === 'wheelchair' && input === 'wheelchairs') ||
      (target === 'firehouse' && input === 'firehouses') ||
      (target === 'brainstorm' && (input === 'brainstorms' || input === 'brainstorming')) ||
      (target === 'hammerhead' && input === 'hammerheads') ||
      (target === 'scarecrow' && input === 'scarecrows');
    
    setUserInput(rawInput);
    setIsCorrect(correct);
    
    // Update session stats
    setStats(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1
    }));

    // Update per-word stats
    const currentWordKey = currentWord.word;
    const prevStat = wordStats[currentWordKey] || { c: 0, t: 0 };
    const newStat = {
      c: prevStat.c + (correct ? 1 : 0),
      t: prevStat.t + 1
    };
    
    setWordStats(prev => ({ ...prev, [currentWordKey]: newStat }));

    // Sync to Cloud
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'wordStats', currentWordKey), {
        ...newStat,
        word: currentWordKey,
        updatedAt: serverTimestamp()
      }).then(() => setLastSyncTime(new Date()))
        .catch(e => console.error("Cloud sync error (stats):", e));
    }

    if (correct) {
      speak("Correct!");
    } else {
      speak("Incorrect. The word is " + currentWord.word);
    }

    // Keep focus so pressing Enter again immediately proceeds to next question
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleNext = () => {
    const isEndOfBatch = (currentIndex === batchStartIndex + 2) || (currentIndex === orderedData.length - 1);
    
    if (!isEndOfBatch) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setIsCorrect(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // End of batch - record history if this was a fresh batch attempt
      const historyLabel = SET_LABELS[currentSet] || `Set ${currentSet}`;
      const newHistory = [
        { 
          date: new Date().toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), 
          type: historyLabel,
          score: `${stats.correct + (isCorrect ? 1 : 0)} / ${stats.total + 1}`
        },
        ...history
      ].slice(0, 10); // Keep last 10
      setHistory(newHistory);
      localStorage.setItem('vocabulary_history', JSON.stringify(newHistory));
      
      // Sync History and Progress to Cloud
      if (user) {
        const historyItem = newHistory[0];
        setDoc(doc(collection(db, 'users', user.uid, 'history')), {
          ...historyItem,
          createdAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/history`));

        const setKey = `set_${currentSet}`;
        setDoc(doc(db, 'users', user.uid), {
          currentSet,
          progress: {
            [setKey]: {
              batchStartIndex,
              currentIndex
            }
          },
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
      
      setShowStats(true);
    }
  };

  const handleReset = () => {
    const allCorrect = stats.correct === stats.total && stats.total > 0;
    let nextBatchStart = batchStartIndex;
    
    if (allCorrect) {
      // Move to next 3 words
      nextBatchStart += 3;
      if (nextBatchStart >= orderedData.length) {
        nextBatchStart = 0; // Loop back to start
      }
    } else {
      // Repeat the same batch
      nextBatchStart = batchStartIndex;
    }
    
    setBatchStartIndex(nextBatchStart);
    setCurrentIndex(nextBatchStart);

    // Sync Progress to Cloud
    if (user) {
      const setKey = `set_${currentSet}`;
      setDoc(doc(db, 'users', user.uid), {
        currentSet,
        progress: {
          [setKey]: {
            batchStartIndex: nextBatchStart,
            currentIndex: nextBatchStart
          }
        },
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
    }

    setUserInput('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setIsCorrect(null);
    setShowStats(false);
    setStats({ correct: 0, total: 0 });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Keyboard shortcut: Pressing Enter is equivalent to clicking "檢查答案" / "下一題"
  const lastEnterTimeRef = useRef(0);
  const handleCheckRef = useRef(handleCheck);
  handleCheckRef.current = handleCheck;
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const handleResetRef = useRef(handleReset);
  handleResetRef.current = handleReset;
  const isCorrectRef = useRef(isCorrect);
  isCorrectRef.current = isCorrect;
  const showStatsRef = useRef(showStats);
  showStatsRef.current = showStats;

  // Single unified action for Enter key
  const handleEnterPress = () => {
    const now = Date.now();
    if (now - lastEnterTimeRef.current < 200) return;
    lastEnterTimeRef.current = now;

    if (showStatsRef.current) {
      handleResetRef.current();
    } else if (isCorrectRef.current === null) {
      handleCheckRef.current();
    } else {
      handleNextRef.current();
    }
  };

  // Auto-focus input whenever a question becomes active
  useEffect(() => {
    if (isCorrect === null && !showStats) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isCorrect, showStats]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if modal dialogs are active
      if (tutorMode || showResetConfirm || showLoginModal || showClearStatsConfirm) return;

      const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13;
      if (!isEnter) return;

      const target = e.target as HTMLElement | null;
      // Don't intercept Enter inside other input elements (e.g. modal name inputs)
      if (target && target.tagName === 'INPUT' && target !== inputRef.current) {
        return;
      }

      // If user is composing in IME and answer is not yet checked, let IME finish
      if (isCorrectRef.current === null && (e.isComposing || (e as any).keyCode === 229)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      handleEnterPress();
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [tutorMode, showResetConfirm, showLoginModal, showClearStatsConfirm]);

  const handleGlobalReset = async () => {
    // 1. First clear the storage
    localStorage.setItem(`vocabulary_batchStartIndex_${currentSet}`, '0');
    localStorage.setItem(`vocabulary_currentIndex_${currentSet}`, '0');
    
    // Clear word stats for current set words
    const newWordStats = { ...wordStats };
    orderedData.forEach(item => {
      delete newWordStats[item.word];
    });
    setWordStats(newWordStats);
    localStorage.setItem('vocabulary_wordStats', JSON.stringify(newWordStats));
    
    // Sync to Cloud
    if (user) {
      const setKey = `set_${currentSet}`;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          currentSet,
          progress: {
            [setKey]: {
              batchStartIndex: 0,
              currentIndex: 0
            }
          },
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    }
    
    // 2. Then update state
    setBatchStartIndex(0);
    setCurrentIndex(0);
    setUserInput('');
    setIsCorrect(null);
    setShowStats(false);
    setStats({ correct: 0, total: 0 });
    setShowResetConfirm(false); // Close modal
    
    // 3. Focus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const handleClearCurrentSetRecords = async () => {
    setIsLoadingFirestore(true);
    const setName = SET_LABELS[currentSet] || `Set ${currentSet}`;
    try {
      if (user) {
        // Query wordStats in cloud and delete documents that match this set
        const statsSnap = await getDocs(collection(db, 'users', user.uid, 'wordStats'));
        const currentWordSet = new Set(orderedData.map(item => item.word.toLowerCase()));
        
        const batch = writeBatch(db);
        statsSnap.docs.forEach(d => {
          const docIdLower = d.id.toLowerCase();
          const docWord = (d.data().word || '').toLowerCase();
          if (currentWordSet.has(docIdLower) || currentWordSet.has(docWord)) {
            batch.delete(d.ref);
          }
        });

        const setKey = `set_${currentSet}`;
        batch.set(doc(db, 'users', user.uid), {
          currentSet,
          progress: {
            [setKey]: {
              batchStartIndex: 0,
              currentIndex: 0
            }
          },
          updatedAt: serverTimestamp()
        }, { merge: true });

        await batch.commit();
      }

      // Local storage & state cleanup for current set
      localStorage.removeItem(`vocabulary_batchStartIndex_${currentSet}`);
      localStorage.removeItem(`vocabulary_currentIndex_${currentSet}`);

      const currentWordSet = new Set(orderedData.map(item => item.word.toLowerCase()));
      setWordStats(prev => {
        const next: Record<string, { c: number; t: number }> = {};
        Object.keys(prev).forEach(k => {
          if (!currentWordSet.has(k.toLowerCase()) && prev[k]) {
            next[k] = prev[k];
          }
        });
        localStorage.setItem('vocabulary_wordStats', JSON.stringify(next));
        return next;
      });

      setBatchStartIndex(0);
      setCurrentIndex(0);
      setStats({ correct: 0, total: 0 });
      setShowClearStatsConfirm(false);
      showToast(`「${setName}」的紀錄已成功清除！`, 'success');
    } catch (e) {
      console.error("Failed to clear current set data:", e);
      showToast('清除紀錄時發生錯誤，請檢查網路連線。', 'error');
    } finally {
      setIsLoadingFirestore(false);
    }
  };

  const handleClearAllRecords = async () => {
    setIsLoadingFirestore(true);
    try {
      if (user) {
        // 1. Delete all wordStats documents in batches of 400
        const statsSnap = await getDocs(collection(db, 'users', user.uid, 'wordStats'));
        for (let i = 0; i < statsSnap.docs.length; i += 400) {
          const chunk = statsSnap.docs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }

        // 2. Delete all history documents in batches of 400
        const historySnap = await getDocs(collection(db, 'users', user.uid, 'history'));
        for (let i = 0; i < historySnap.docs.length; i += 400) {
          const chunk = historySnap.docs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }

        // 3. Reset user profile progress while keeping currentSet and meeting rules requirements
        await setDoc(doc(db, 'users', user.uid), {
          currentSet,
          progress: {},
          updatedAt: serverTimestamp()
        });
      }

      // Local storage & state cleanup for ALL sets
      localStorage.removeItem('vocabulary_wordStats');
      localStorage.removeItem('vocabulary_history');
      Object.keys(SET_LABELS).forEach(i => {
        localStorage.removeItem(`vocabulary_batchStartIndex_${i}`);
        localStorage.removeItem(`vocabulary_currentIndex_${i}`);
      });

      setWordStats({});
      setHistory([]);
      setBatchStartIndex(0);
      setCurrentIndex(0);
      setStats({ correct: 0, total: 0 });
      setShowClearStatsConfirm(false);
      showToast('所有題組的答題統計、歷史紀錄與進度已全部清除！', 'success');
    } catch (e) {
      console.error("Failed to clear all data:", e);
      showToast('清除全部紀錄時發生錯誤，請檢查網路連線。', 'error');
    } finally {
      setIsLoadingFirestore(false);
    }
  };

  if (orderedData.length === 0) return null;

  // Replace word in sentence with ____
  const displaySentence = (() => {
    if (!currentWord.sentenceEn) return '__________';
    const escaped = currentWord.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(currentWord.sentenceEn)) {
      return currentWord.sentenceEn.replace(regex, '__________');
    }
    if (currentWord.sentenceEn.toLowerCase().includes(currentWord.word.toLowerCase())) {
      const idx = currentWord.sentenceEn.toLowerCase().indexOf(currentWord.word.toLowerCase());
      return currentWord.sentenceEn.slice(0, idx) + '__________' + currentWord.sentenceEn.slice(idx + currentWord.word.length);
    }
    return currentWord.sentenceEn.includes('__________') ? currentWord.sentenceEn : `${currentWord.sentenceEn} (__________)`;
  })();

  const isBatchComplete = stats.correct === stats.total && stats.total > 0;

  const handleAuthError = (error: any) => {
    if (!error) return;
    if (error.code === 'auth/popup-blocked') {
      setAuthError('登入彈出視窗被瀏覽器封鎖了。請點擊「重新導向登入 (Redirect)」或在新分頁中開啟網頁後再試一次。');
      setShowLoginModal(true);
    } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      // User cancelled
    } else if (error.code === 'auth/unauthorized-domain') {
      setAuthError('此網域未被授權進行 Firebase Google 登入 (auth/unauthorized-domain)。請參考下方步驟將當前網域加入 Firebase 控制台的「已授權網域」清單中。');
      setShowLoginModal(true);
    } else {
      setAuthError(`登入失敗: ${error.message || '未知錯誤'} (${error.code || 'error'})。`);
      setShowLoginModal(true);
    }
  };

  const handleLoginWithPopup = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      setShowLoginModal(false);
      showToast('Google 雲端登入成功！進度已同步。', 'success');
    } catch (error: any) {
      console.error('Popup login error:', error);
      handleAuthError(error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLoginWithRedirect = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (error: any) {
      console.error('Redirect login error:', error);
      handleAuthError(error);
      setIsAuthenticating(false);
    }
  };

  const handleSaveStudentName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      localStorage.removeItem('vocabulary_studentName');
      setStudentName('');
      showToast('已切換為訪客模式', 'success');
    } else {
      localStorage.setItem('vocabulary_studentName', trimmed);
      setStudentName(trimmed);
      showToast(`已設定學生身份：${trimmed}`, 'success');
    }
  };

  return (
    <div className="h-screen bg-[#F0F2F5] font-sans text-gray-900 flex flex-col overflow-y-auto lg:overflow-hidden select-none">
      {/* Auth Error Toast */}
      <AnimatePresence>
        {authError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
          >
            <XCircle size={20} />
            <span className="text-sm">{authError}</span>
            <button onClick={() => setAuthError(null)} className="ml-2 hover:bg-white/20 p-1 rounded-full">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoadingFirestore && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-4 left-4 z-[60] bg-white border border-gray-100 px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Syncing with Cloud...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white px-2 md:px-4 py-2 sticky top-0 z-40 border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Branding */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-[#00B140] rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
              <Headphones size={22} />
            </div>
            <div className="hidden min-[400px]:block">
              <h1 className="text-sm md:text-xl font-black text-[#1A2E35] leading-tight">單字填空</h1>
              <p className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none">SAVED</p>
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-1 md:gap-3 flex-1 justify-end min-w-0">
            {/* Set Selector */}
            <div className="relative shrink min-w-0 max-w-[100px] sm:max-w-none">
              <select
                value={currentSet}
                onChange={(e) => setCurrentSet(Number(e.target.value))}
                className="appearance-none bg-[#F0F7FF] border border-[#D0E5FF] text-[#1A2E35] py-1.5 md:py-2.5 pl-2 md:pl-4 pr-7 md:pr-10 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold focus:outline-none cursor-pointer truncate w-full shadow-sm"
              >
                {Object.keys(SET_LABELS).map(Number).map(id => (
                  <option key={id} value={id}>
                    {SET_LABELS[id]}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-1.5 md:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#5B7B9E]" />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* User / Login */}
              {user ? (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2 md:px-3 py-1.5 rounded-xl md:rounded-2xl transition-all shadow-xs shrink-0 cursor-pointer"
                  title="已連接 Google 雲端，點擊查看詳情"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="flex flex-col items-start leading-none text-left">
                    <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-wider">Cloud</span>
                    <span className="text-[10px] md:text-xs font-bold text-gray-700 truncate max-w-[65px] sm:max-w-[100px]">
                      {user.displayName || user.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                </button>
              ) : studentName ? (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 px-2 md:px-3 py-1.5 rounded-xl md:rounded-2xl transition-all shadow-xs shrink-0 cursor-pointer"
                  title="本機學生身份，點擊管理或切換"
                >
                  <UserIcon size={13} className="text-blue-600 shrink-0" />
                  <div className="flex flex-col items-start leading-none text-left">
                    <span className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-wider">學生</span>
                    <span className="text-[10px] md:text-xs font-bold text-gray-700 truncate max-w-[65px] sm:max-w-[90px]">
                      {studentName}
                    </span>
                  </div>
                </button>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  disabled={isAuthenticating}
                  className={`flex items-center justify-center gap-1 bg-[#4285F4] text-white px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl md:rounded-2xl hover:bg-[#357ae8] transition-colors text-[10px] md:text-sm font-black shadow-sm shrink-0 cursor-pointer ${isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="登入同步"
                >
                  <LogIn size={15} className={isAuthenticating ? 'animate-pulse' : ''} />
                  <span>{isAuthenticating ? '...' : '登入同步'}</span>
                </button>
              )}

              {/* Tools */}
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="w-8 h-8 md:w-10 md:h-10 bg-[#F0F2F5] text-[#5B7B9E] rounded-full hover:bg-[#E4E7EB] transition-colors flex items-center justify-center border border-[#D1D5DB] shadow-sm"
                title="重置進度"
              >
                <RotateCcw size={16} />
              </button>

              <button 
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1 md:gap-2 bg-black text-white h-8 md:h-10 px-2 md:px-5 rounded-xl md:rounded-2xl hover:bg-[#202020] transition-colors text-[10px] md:text-sm font-black shadow-md shrink-0"
              >
                <BarChart2 size={16} />
                <span className="hidden sm:inline">統計</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-2 sm:px-4 pt-2 sm:pt-3 pb-3 flex-1 flex flex-col items-center justify-start min-h-0 overflow-y-auto">
        <div className="flex gap-3 mb-3"><button className="rounded-xl bg-indigo-600 text-white px-4 py-2 font-bold" aria-pressed={tutorMode} onClick={() => setTutorMode(true)}>引導家教</button><button className="rounded-xl bg-slate-700 text-white px-4 py-2 font-bold" aria-pressed={!tutorMode} onClick={() => setTutorMode(false)}>原本單字練習</button></div>
        {tutorMode ? <Tutor key={`${currentSet}:${user?.uid || studentName || 'guest'}`} words={getSetData(currentSet)} unit={SET_LABELS[currentSet]} storageId={user?.uid || studentName || 'guest'} /> : <AnimatePresence mode="wait">
          {showStats ? (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden w-full max-w-xl my-1 sm:my-2"
            >
              {/* Stats Header */}
              <div className="px-5 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-500 shadow-2xs">
                    <BarChart2 size={18} />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">練習統計</h2>
                </div>
                <button 
                  onClick={() => setShowStats(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 focus:outline-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white flex flex-col flex-1 min-h-0">
                {/* Section 1: Word Stats Header */}
                <div className="shrink-0 mb-1.5">
                  <div className="flex items-center justify-between pb-0.5">
                    <div className="flex items-center gap-2 text-gray-900 font-black text-base sm:text-lg">
                      <TrendingUp className="text-red-500" size={20} />
                      單字答題統計
                    </div>
                    <button 
                      id="btn-open-clear-stats-modal"
                      onClick={() => setShowClearStatsConfirm(true)}
                      className={`text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                        isLoadingFirestore 
                          ? 'text-gray-300 border-gray-200 pointer-events-none' 
                          : 'text-gray-600 hover:text-red-600 border-gray-200 hover:border-red-200 hover:bg-red-50/50 shadow-2xs'
                      }`}
                      disabled={isLoadingFirestore}
                      title="清除答題統計紀錄"
                    >
                      <Trash2 size={13} className="text-gray-500" />
                      <span>{isLoadingFirestore ? '處理中...' : '清除所有紀錄'}</span>
                    </button>
                  </div>
                  {lastSyncTime && (
                    <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider">
                      雲端同步於 {lastSyncTime.toLocaleTimeString()}
                    </div>
                  )}
                </div>

                {/* Ultra-compact Scrollable Word List (滾輪滑動瀏覽全部單字) */}
                <div className="overflow-y-auto max-h-[48vh] sm:max-h-[55vh] pr-1 stats-scrollbar">
                  <div className="space-y-0.5">
                    {orderedData.map((item, idx) => {
                      const statsInfo = wordStats[item.word] || { c: 0, t: 0 };
                      const incorrect = statsInfo.t - statsInfo.c;
                      const hasErrors = incorrect > 0;
                      const isAttempted = statsInfo.t > 0;

                      return (
                        <div 
                          key={item.word} 
                          className="flex items-center justify-between py-0.5 sm:py-1 px-1.5 hover:bg-gray-50/80 rounded transition-colors group"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            {isAttempted ? (
                              hasErrors ? (
                                <div className="w-3.5 h-3.5 rounded-full bg-[#FF7A00] shrink-0" title={`曾答錯 ${incorrect} 次`} />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-[#00B140] shrink-0" title="全部答對" />
                              )
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" title="尚未作答" />
                            )}
                            <span className="text-gray-400 font-normal text-xs sm:text-sm w-5 sm:w-6 text-left shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-[#0A1128] font-bold text-sm sm:text-base truncate">
                              {item.word}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-xs sm:text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#00B140] shrink-0" />
                              <span className="font-medium text-gray-700">答對 {statsInfo.c}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#FF4D4F] shrink-0" />
                              <span className="font-medium text-gray-700">答錯 {incorrect}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Stats Footer Actions */}
              <div className="p-3 sm:p-4 bg-gray-50/80 border-t border-gray-100 flex flex-col gap-2">
                <button 
                  onClick={handleReset}
                  className={`w-full inline-flex items-center justify-center gap-2 text-white px-6 py-2.5 sm:py-3 rounded-xl font-black text-sm sm:text-base transition-all shadow-md active:scale-[0.98] cursor-pointer ${
                    isBatchComplete 
                      ? 'bg-green-500 hover:bg-green-600 shadow-green-200/50' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50'
                  }`}
                >
                  {isBatchComplete ? (
                    <><ChevronRight size={18} className="stroke-[3]" /> 挑戰下一組單字</>
                  ) : (
                    <><RotateCcw size={18} className="stroke-[3]" /> 重新挑戰這一組</>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl flex flex-col items-center justify-start"
            >
              {(() => {
                const targetLetters = currentWord.word.split('');
                const inputLetters = userInput.trim().split('');
                const maxLen = Math.max(targetLetters.length, inputLetters.length, 1);
                const slots = Array.from({ length: maxLen }, (_, i) => i);
                const currentKK = getKKPhonetic(currentWord.word, currentWord.kk);

                return (
                  <div className="bg-black text-white rounded-3xl p-4 sm:p-6 md:p-7 shadow-2xl border border-neutral-800 w-full flex flex-col gap-3.5 sm:gap-4 relative">
                    
                    {/* Top Progress Header (Integrated in Card, exactly as screenshot) */}
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="bg-[#0D244D] text-[#4ea0ff] border border-[#1d467c] px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                          {SET_LABELS[currentSet] || `Set ${currentSet}`}
                        </span>
                        <span className="text-gray-200 text-xs sm:text-sm font-bold">
                          進度: <span className="text-white font-black">{currentIndex + 1}</span> / {orderedData.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCorrect !== null && (
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black flex items-center gap-1 ${
                            isCorrect 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                              : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}>
                            {isCorrect ? '✓ 答對了！' : `✗ 正確: ${currentWord.word}`}
                          </span>
                        )}
                        <span className="text-[#00FF85] font-mono text-sm sm:text-base font-black">
                          {Math.round(((currentIndex + 1) / orderedData.length) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Slim Progress Bar */}
                    <div className="w-full h-1 sm:h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#00FF85] transition-all duration-500 ease-out"
                        style={{ width: `${((currentIndex + 1) / orderedData.length) * 100}%` }}
                      />
                    </div>

                    {/* Sentence Question */}
                    <div className="text-center px-1 py-1">
                      <h3 className="text-base sm:text-xl md:text-2xl font-black leading-snug tracking-tight text-[#FFD700]">
                        {displaySentence.split('__________')[0]}
                        <span className="text-[#4299E1] border-b-2 sm:border-b-4 border-[#4299E1] mx-1 sm:mx-1.5 px-1.5 inline-block min-w-[70px] sm:min-w-[100px] text-center font-black">
                          {isCorrect !== null ? currentWord.word : (userInput || '\u00A0\u00A0\u00A0\u00A0')}
                        </span>
                        {displaySentence.split('__________')[1]}
                      </h3>
                    </div>

                    {/* Letter Slots Box (White/Light card matching screenshot) */}
                    <div className="bg-[#EEF1F6] rounded-2xl p-3 sm:p-4 shadow-sm border border-neutral-200/60 flex flex-col items-center gap-1.5 w-full max-w-xl mx-auto">
                      {/* Top Row: User Input (with per-letter green/red comparison) */}
                      <div className="flex justify-center items-center gap-1 sm:gap-1.5 flex-wrap">
                        {slots.map((i) => {
                          const targetChar = targetLetters[i] || '';
                          const inputChar = inputLetters[i] || '';
                          const isSpace = targetChar === ' ';
                          if (isSpace) {
                            return <div key={`top-${i}`} className="w-2 sm:w-3" />;
                          }
                          const isMatch = targetChar && inputChar && targetChar.toLowerCase() === inputChar.toLowerCase();

                          if (isCorrect === null) {
                            return (
                              <div 
                                key={`top-${i}`} 
                                className={`w-8 h-9 sm:w-9 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base font-black border transition-all ${
                                  inputChar 
                                    ? 'bg-white text-gray-900 border-blue-400 shadow-xs' 
                                    : 'bg-white/80 text-gray-400 border-gray-200/80 shadow-2xs'
                                }`}
                              >
                                {inputChar || '_'}
                              </div>
                            );
                          }

                          // Checked state: User input letters evaluated (green for correct, red for error)
                          return (
                            <div 
                              key={`top-${i}`} 
                              className={`w-8 h-9 sm:w-9 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base font-black border transition-all text-white shadow-xs ${
                                isMatch
                                  ? 'bg-[#00B140] border-[#008730]'
                                  : 'bg-[#B91C1C] border-[#991B1B]'
                              }`}
                            >
                              {inputChar || '-'}
                            </div>
                          );
                        })}
                      </div>

                      {/* Middle Indicator */}
                      <div 
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-black text-white shadow-xs ${
                          isCorrect === null ? 'bg-[#2B6CB0]' : isCorrect ? 'bg-[#00B140]' : 'bg-[#E53E3E]'
                        }`}
                      >
                        {isCorrect === null ? '↓' : isCorrect ? '✓' : '↓'}
                      </div>

                      {/* Bottom Row: Correct Target Word (Hidden as ? before checking, all green when checked) */}
                      <div className="flex justify-center items-center gap-1 sm:gap-1.5 flex-wrap">
                        {slots.map((i) => {
                          const targetChar = targetLetters[i] || '';
                          const isSpace = targetChar === ' ';
                          if (isSpace) {
                            return <div key={`bottom-${i}`} className="w-2 sm:w-3" />;
                          }

                          if (isCorrect === null) {
                            return (
                              <div 
                                key={`bottom-${i}`} 
                                className="w-8 h-9 sm:w-9 sm:h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 text-sm sm:text-base font-black border border-gray-200/80 shadow-2xs"
                              >
                                {targetChar ? '?' : ''}
                              </div>
                            );
                          }

                          // Checked state: All letters of target word are revealed in green
                          return (
                            <div 
                              key={`bottom-${i}`} 
                              className="w-8 h-9 sm:w-9 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base font-black border border-[#008730] transition-all text-white bg-[#00B140] shadow-xs"
                              title={targetChar ? `正確字母: ${targetChar}` : undefined}
                            >
                              {targetChar || '-'}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Input Field & Check Button Row */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full max-w-xl mx-auto">
                      <div className="w-full sm:flex-1 relative">
                        <input
                          ref={inputRef}
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.keyCode === 13) {
                              if (isCorrect === null && (e.nativeEvent.isComposing || (e as any).keyCode === 229)) {
                                return;
                              }
                              e.preventDefault();
                              e.stopPropagation();
                              handleEnterPress();
                            }
                          }}
                          placeholder="輸入 單字..."
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck="false"
                          className="w-full bg-white text-[#5D5DFF] text-lg sm:text-xl md:text-2xl font-black text-center h-12 sm:h-13 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-inner tracking-wider placeholder:text-[#A5B4FC] placeholder:text-base sm:placeholder:text-lg"
                          autoFocus
                        />
                      </div>

                      {/* Action Button */}
                      {isCorrect === null ? (
                        <button 
                          type="button"
                          onClick={() => handleEnterPress()}
                          className="w-full sm:w-auto px-6 h-12 sm:h-13 bg-[#FF3B3B] hover:bg-[#E03030] text-white rounded-2xl text-base sm:text-lg font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          ✓ 檢查答案
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => handleEnterPress()}
                          className="w-full sm:w-auto px-6 h-12 sm:h-13 bg-[#00B140] hover:bg-[#009A37] text-white rounded-2xl text-base sm:text-lg font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                          下一題 ➔
                        </button>
                      )}
                    </div>

                    {/* Audio Buttons */}
                    <div className="flex items-center justify-center gap-2.5 flex-wrap">
                      <button 
                        type="button"
                        onClick={() => {
                          speak(currentWord.word);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 bg-[#00B140] hover:bg-[#009A37] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title={currentKK ? `KK音標: /${currentKK}/` : '聆聽單字發音'}
                      >
                        <Volume2 size={15} className="shrink-0" />
                        {currentKK && (
                          <span className="font-sans font-bold tracking-wide">/{currentKK}/</span>
                        )}
                        <span>單字(英)</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          speak(currentWord.sentenceEn);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 bg-[#00B140] hover:bg-[#009A37] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Volume2 size={15} /> 例句(英)
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          speak(currentWord.definitionEn);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-1.5 bg-[#00B140] hover:bg-[#009A37] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Volume2 size={15} /> 定義(英)
                      </button>
                    </div>

                    {/* Word Details & Translations (Exactly matching screenshot) */}
                    <div className="space-y-1.5 text-left pt-1 text-sm sm:text-base leading-snug">
                      <div className="text-[#FFDE00] font-bold flex items-center gap-2 flex-wrap">
                        <span>中文單字翻譯: {currentWord.translation}</span>
                        {currentKK && (
                          <span className="text-[#38BDF8] font-sans font-bold text-xs sm:text-sm tracking-wide">
                            /{currentKK}/
                          </span>
                        )}
                        <button 
                          onClick={() => speak(currentWord.word)} 
                          className="text-[#4299E1] hover:text-blue-300 cursor-pointer transition-colors"
                          title="聆聽單字發音"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                      <div className="text-[#FFDE00] font-bold">
                        中文翻譯: {currentWord.sentenceCn}
                      </div>
                      <div className="text-[#FFDE00] font-bold italic">
                        英文定義: {currentWord.definitionEn}
                      </div>
                      <div className="text-[#FFDE00] font-bold">
                        中文定義: {currentWord.definitionCn}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>}
      </main>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
                  <RotateCcw size={32} />
                </div>
                <h2 className="text-xl font-black text-gray-900">確認重置？</h2>
                <p className="text-gray-500 font-medium">
                  確定要重置「<span className="text-blue-600 font-bold">{SET_LABELS[currentSet]}</span>」的練習進度嗎？所有目前的答題狀態將會歸零。
                </p>
                <div className="flex gap-3 w-full mt-4">
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleGlobalReset}
                    className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                  >
                    確定
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Clear Stats Modal */}
      <AnimatePresence>
        {showClearStatsConfirm && (
          <div id="clear-stats-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-sm">
                  <Trash2 size={28} />
                </div>
                <h2 className="text-xl font-black text-gray-900">清除答題紀錄</h2>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  請選擇您要清除的答題統計紀錄範圍：
                </p>
              </div>

              <div className="space-y-3">
                {/* Option 1: Clear All Sets Records */}
                <button
                  id="btn-clear-all-records"
                  onClick={handleClearAllRecords}
                  disabled={isLoadingFirestore}
                  className="w-full p-4 rounded-2xl border-2 border-red-500/20 bg-red-50/60 hover:bg-red-50 hover:border-red-500 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 group-hover:scale-105 transition-transform">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-red-700">清除「全部題組」所有紀錄</div>
                    <div className="text-xs text-red-600/80 font-medium mt-0.5 leading-normal">
                      徹底清空所有題組（共 {Object.keys(SET_LABELS).length} 個題組）的單字答題統計、練習歷史與各組進度
                    </div>
                  </div>
                </button>

                {/* Option 2: Clear Current Set Only */}
                <button
                  id="btn-clear-current-set-records"
                  onClick={handleClearCurrentSetRecords}
                  disabled={isLoadingFirestore}
                  className="w-full p-4 rounded-2xl border-2 border-orange-500/20 bg-orange-50/40 hover:bg-orange-50 hover:border-orange-500 transition-all text-left flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 group-hover:scale-105 transition-transform">
                    <RotateCcw size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-orange-800">
                      僅清除「{SET_LABELS[currentSet]}」紀錄
                    </div>
                    <div className="text-xs text-orange-700/80 font-medium mt-0.5 leading-normal">
                      僅重置目前題組（{orderedData.length} 個單字）的單字統計與目前進度
                    </div>
                  </div>
                </button>
              </div>

              <button 
                id="btn-cancel-clear-stats"
                onClick={() => setShowClearStatsConfirm(false)}
                disabled={isLoadingFirestore}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm cursor-pointer"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login & User Profile Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => {
              setShowLoginModal(false);
              setAuthError(null);
            }}
            user={user}
            studentName={studentName}
            onSaveStudentName={handleSaveStudentName}
            onLoginWithPopup={handleLoginWithPopup}
            onLoginWithRedirect={handleLoginWithRedirect}
            onLogout={() => {
              logout();
              showToast('已登出帳號', 'success');
            }}
            isAuthenticating={isAuthenticating}
            authError={authError}
            lastSyncTime={lastSyncTime}
            onForceSync={forceSyncFromCloud}
            isSyncingManual={isSyncingManual}
            projectId={(firebaseConfig as any)?.projectId || 'gen-lang-client-0570894418'}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-white max-w-md ${
              toastMessage.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
            }`}
          >
            {toastMessage.type === 'error' ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="text-sm font-semibold">{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-2 hover:bg-white/20 p-1 rounded-full text-white cursor-pointer">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


