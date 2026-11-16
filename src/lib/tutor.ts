import type { VocabularyItem } from '../data/vocabulary';

export const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
export interface TutorRecord {
  date: string; unit: string; word: string; question: string; answers: string[];
  correctAnswer: string; errorType: 'V02'; hints: number; independent: boolean;
  revealed: boolean; nextReview: string; stage: number;
}
const intervals = [1, 3, 7, 14, 30];
export function reviewDate(stage: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + intervals[Math.min(stage, intervals.length - 1)]);
  return date.toISOString();
}
export function hintFor(word: string, attempts: number) {
  if (attempts === 1) return `Nice try! 這是拼字問題（V02）。先聽單字，再檢查字母順序。共 ${word.replace(/\s/g, '').length} 個字母。`;
  if (attempts === 2) return `Let's try again! 開頭是「${word[0]}」，先想想這個字的起始音。`;
  return '把單字分成幾個音，逐段拼寫。例如 cat 可以分成 c–a–t。請再完成原題；需要時可按「看答案」。';
}
export function buildLesson(words: VocabularyItem[], records: TutorRecord[], unit: string, now = new Date()) {
  const latest = new Map<string, TutorRecord>();
  records.filter(r => r.unit === unit).forEach(r => latest.set(r.word, r));
  const due = words.filter(w => { const r = latest.get(w.word); return r && new Date(r.nextReview) <= now; });
  const fresh = words.filter(w => !due.includes(w));
  return [...due, ...fresh].slice(0, 6);
}
