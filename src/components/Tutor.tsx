import React, { useState } from 'react';
import type { VocabularyItem } from '../data/vocabulary';
import { buildLesson, hintFor, normalize, reviewDate, type TutorRecord } from '../lib/tutor';

export default function Tutor({ words, unit, storageId }: { words: VocabularyItem[]; unit: string; storageId: string }) {
  const storageKey = `grade3_tutor_v1:${storageId}`;
  const [records, setRecords] = useState<TutorRecord[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(data) ? data.filter(r => r && typeof r.word === 'string' && typeof r.nextReview === 'string' && Array.isArray(r.answers)) : []; } catch { return []; }
  });
  const [lesson, setLesson] = useState<VocabularyItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [session, setSession] = useState<TutorRecord[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(2);
  const [mistakes, setMistakes] = useState(false);
  const word = lesson[index];
  const button = 'rounded-xl bg-indigo-600 text-white px-4 py-3 font-bold disabled:opacity-40';
  const speak = () => { if ('speechSynthesis' in window && word) { window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(word.word); speech.lang = 'en-US'; window.speechSynthesis.speak(speech); } };
  function start() {
    setLesson(buildLesson(words, records, unit)); setIndex(0); setInput(''); setAnswers([]); setRevealed(false); setDone(false); setSession([]); setFeedback('Hello! 一次一題，先自己想一想。'); setStreak(0); setLevel(2);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (!word || done || !input.trim()) return;
    const tries = [...answers, input.trim()]; setAnswers(tries);
    if (normalize(input) !== normalize(word.word)) {
      setFeedback(hintFor(word.word, tries.length));
      if (tries.length >= 2) setLevel(1);
      return;
    }
    const independent = tries.length === 1 && !revealed && level !== 1;
    const prior = records.filter(r => r.unit === unit && r.word === word.word).at(-1);
    const stage = independent && prior ? Math.min(prior.stage + 1, 4) : 0;
    const record: TutorRecord = { date: new Date().toISOString(), unit, word: word.word, question: word.translation, answers: tries, correctAnswer: word.word, errorType: 'V02', hints: tries.length - 1, independent, revealed, nextReview: reviewDate(stage), stage };
    const updated = [...records, record]; setRecords(updated); setSession(s => [...s, record]);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); setStorageError(false); } catch { setStorageError(true); }
    const nextStreak = independent ? streak + 1 : 0; setStreak(nextStreak);
    if (nextStreak >= 3) setLevel(3);
    setDone(true); setFeedback(independent ? 'Great job! 你獨立拼對了這個單字。' : 'Good work! 你透過提示完成了訂正。');
  }
  function next() {
    setIndex(i => i + 1); setInput(''); setAnswers([]); setRevealed(false); setDone(false); setFeedback('');
  }
  function exportRecords() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'english-tutor-records.json'; a.click(); URL.revokeObjectURL(url);
  }
  const finished = lesson.length > 0 && index >= lesson.length;
  const percent = session.length ? Math.round(session.filter(r => r.independent).length / session.length * 100) : 0;
  return <section aria-label="引導家教" className="w-full bg-white text-slate-800 rounded-3xl p-5 sm:p-8 space-y-5 shadow-lg">
    <h2 className="text-2xl font-bold">🌱 Grade 3 引導家教</h2>
    <p>{unit} · 一次一題 · 先提示，再重試</p>
    <p className="text-sm text-slate-600">依 SKILL.md 的規則練習現有教材。這是固定規則家教，沒有連接生成式 AI。紀錄只儲存在此瀏覽器，依目前帳號或學生區分；不會自動提醒或同步雲端。</p>
    {storageError && <p role="alert" className="text-red-700">瀏覽器無法儲存，請匯出紀錄保留本次學習。</p>}
    <div className="flex flex-wrap gap-3"><button className={button} onClick={start}>{lesson.length ? '重新開始本堂課' : '開始今天的英文課'}</button><button className={button} onClick={() => setMistakes(!mistakes)}>錯題與複習紀錄</button><button className={button} onClick={exportRecords}>匯出紀錄</button></div>
    {mistakes && <div className="max-h-64 overflow-auto space-y-2"><p>到期項目於下次開始課程時優先安排；錯題在當堂結束前再次提取。</p>{records.filter(r => r.unit === unit).slice().reverse().map((r, i) => <div key={`${r.date}-${i}`} className="border rounded-xl p-3 text-sm">{r.word} · {r.independent ? '首次獨立答對' : `提示 ${r.hints} 次${r.revealed ? '，看過答案' : '，自主訂正'}`}<br/>作答：{r.answers.join(' → ')} · {r.independent ? '無錯誤' : r.errorType}<br/>下次複習：{new Date(r.nextReview).toLocaleDateString('zh-TW')}</div>)}</div>}
    {word && <>
      <p className="text-sm">第 {index + 1} / {lesson.length} 題 · {['', '基礎：提供起始字母', '標準：獨立拼寫', '挑戰：減少中文提示'][level]}</p>
      <h3 className="text-xl font-bold">{level === 3 ? word.definitionEn : `Spell the word: ${word.translation}`}</h3>
      {level === 1 && !done && <p>開頭：{word.word[0]} · {word.word.replace(/\s/g, '').length} 個字母</p>}
      <button className={button} onClick={speak}>🔊 聽單字</button>
      <form onSubmit={submit} className="flex flex-wrap gap-3"><label className="flex-1">你的英文答案<input aria-label="你的英文答案" className="block border-2 rounded-xl p-3 w-full" value={input} onChange={e => setInput(e.target.value)} disabled={done} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}/></label>{!done && <button className={button} disabled={!input.trim()}>檢查答案</button>}</form>
      <p role="status" aria-live="polite">{feedback}</p>
      {!done && <button className="underline" onClick={() => { setRevealed(true); setFeedback('看過答案後，請親手拼一次；稍後再做一次確認理解。'); }}>我需要看答案</button>}
      {(done || revealed) && <p className="text-xl font-bold">{word.word}：{word.translation}</p>}
      {done && <div className="space-y-3"><p>{word.definitionEn}</p><p>{word.sentenceEn}</p><p>{word.sentenceCn}</p><p className="text-sm">完整句練習：讀一遍例句，再用自己的情境說一句。這裡只提供自我練習，不評估造句或發音。</p><button autoFocus className={button} onClick={() => { if (answers.length > 1 || revealed) setLesson(prev => [...prev, word]); next(); }}>下一題</button></div>}
    </>}
    {finished && <div className="space-y-3"><h3 className="text-xl font-bold">今日學習摘要</h3><p>完成 {session.length} 題 · 首次獨立答對率 {percent}% · 重點：單字拼寫、訂正及例句。</p><p>已獨立完成：{session.filter(r => r.independent).map(r => r.word).join('、') || '繼續練習中'}</p><p>優先複習：{[...new Set(session.filter(r => !r.independent).map(r => r.word))].join('、') || '依下次複習日期安排'}</p><p>複習間隔：1、3、7、14、30 天；答錯或看答案後回到 1 天。</p></div>}
  </section>;
}

