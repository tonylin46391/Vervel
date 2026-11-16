import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  RotateCw,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { User } from 'firebase/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  studentName: string;
  onSaveStudentName: (name: string) => void;
  onLoginWithPopup: () => Promise<void>;
  onLoginWithRedirect: () => Promise<void>;
  onLogout: () => void;
  isAuthenticating: boolean;
  authError: string | null;
  lastSyncTime: Date | null;
  onForceSync: () => void;
  isSyncingManual: boolean;
  projectId?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  user,
  studentName,
  onSaveStudentName,
  onLoginWithPopup,
  onLoginWithRedirect,
  onLogout,
  isAuthenticating,
  authError,
  lastSyncTime,
  onForceSync,
  isSyncingManual,
  projectId = 'gen-lang-client-0570894418'
}) => {
  const [nameInput, setNameInput] = useState(studentName);
  const [copied, setCopied] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(
    Boolean(authError && authError.includes('unauthorized-domain'))
  );

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'ela-spelling-list-12.vercel.app';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isUnauthorizedError = Boolean(authError && authError.includes('unauthorized-domain'));
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyDomain = async () => {
    try {
      await navigator.clipboard.writeText(currentHostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleStudentNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveStudentName(nameInput);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
              <UserIcon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">帳號與登入同步</h3>
              <p className="text-[11px] text-gray-500 font-medium">支援 Google 雲端帳號與本機學生身份管理</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Current Identity Card */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0 ${
                  user 
                    ? 'bg-emerald-500 shadow-emerald-200' 
                    : studentName 
                    ? 'bg-blue-500 shadow-blue-200' 
                    : 'bg-gray-400'
                }`}>
                  {user ? (user.displayName?.[0] || 'G') : (studentName?.[0] || '?')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-gray-900 text-sm truncate">
                      {user ? (user.displayName || user.email) : (studentName ? studentName : '訪客模式（未設定身份）')}
                    </span>
                    {user && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        Google 雲端同步中
                      </span>
                    )}
                    {!user && studentName && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={11} className="text-blue-600" />
                        本機學生身份
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {user ? (
                      lastSyncTime ? `上次同步時間：${lastSyncTime.toLocaleTimeString()}` : '已連接 Firebase 雲端資料庫'
                    ) : (
                      '練習答題記錄與統計將保存在當前瀏覽器中'
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Logged In User */}
              {user && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={onForceSync}
                    disabled={isSyncingManual}
                    className="p-2 text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 rounded-xl border border-gray-200 transition-colors shadow-xs"
                    title="立即手動同步雲端"
                  >
                    <RotateCw size={14} className={isSyncingManual ? 'animate-spin text-blue-600' : ''} />
                  </button>
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white hover:bg-red-50 rounded-xl border border-red-200 transition-colors shadow-xs"
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Auth Error Banner if active */}
          {authError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 space-y-1.5">
              <div className="flex items-start gap-2 font-bold">
                <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
                <span>登入提示</span>
              </div>
              <p className="text-red-800 leading-relaxed text-[11px] pl-6">{authError}</p>
            </div>
          )}

          {/* SECTION 1: Google Cloud Login */}
          {!user && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Google 雲端帳號登入
                </span>
                <span className="text-[10px] text-gray-400 font-bold">跨裝置紀錄同步</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={onLoginWithPopup}
                  disabled={isAuthenticating}
                  className="flex items-center justify-center gap-2 bg-[#4285F4] hover:bg-[#357ae8] text-white font-bold text-xs py-3 px-4 rounded-2xl shadow-md transition-all disabled:opacity-50 hover:shadow-lg active:scale-98"
                >
                  <LogIn size={15} className={isAuthenticating ? 'animate-pulse' : ''} />
                  <span>{isAuthenticating ? '處理中...' : 'Google 彈出登入 (推薦)'}</span>
                </button>

                <button
                  onClick={onLoginWithRedirect}
                  disabled={isAuthenticating}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs py-3 px-4 rounded-2xl border border-gray-300 shadow-xs transition-all disabled:opacity-50 hover:border-gray-400 active:scale-98"
                  title="若手機瀏覽器或彈出視窗受阻，請使用此方式"
                >
                  <ArrowRight size={15} className="text-gray-500" />
                  <span>重新導向登入 (Redirect)</span>
                </button>
              </div>

              {/* Iframe advice */}
              {isInIframe && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
                  <HelpCircle size={16} className="shrink-0 mt-0.5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-bold text-[11px]">偵測到目前在嵌入視窗 (iframe) 中</p>
                    <p className="text-blue-700 mt-0.5 leading-relaxed text-[11px]">
                      瀏覽器可能封鎖嵌入頁面的 Google 彈出視窗。若登入無法彈出，請點擊下方按鈕在新分頁開啟本網頁：
                    </p>
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white px-3 py-1.5 rounded-xl border border-blue-300 shadow-xs hover:shadow-sm transition-all"
                    >
                      <ExternalLink size={13} />
                      在新分頁中開啟本應用程式
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: Vercel / Domain Authorization Instructions (Vital for unauthorized-domain) */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Vercel 網域授權指引 (Fix unauthorized-domain)
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    若在 Vercel（例如 <code className="bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-mono font-bold">{currentHostname}</code>）登入顯示「網域未授權」，需將此網域加入 Firebase 控制台白名單：
                  </p>
                </div>
              </div>
            </div>

            {/* Current Domain Box with One-Click Copy */}
            <div className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="font-mono text-gray-800 font-bold text-[11px] truncate select-all pl-1">
                {currentHostname}
              </div>
              <button
                onClick={handleCopyDomain}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors shrink-0"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copied ? '已複製！' : '複製網域'}</span>
              </button>
            </div>

            {/* 3 Steps */}
            <div className="bg-amber-100/60 p-3 rounded-xl space-y-1.5 text-[11px] text-amber-950">
              <p className="font-bold text-amber-900">快速 3 步驟授權：</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-900 leading-normal">
                <li>點擊上方「複製網域」按鈕。</li>
                <li>前往 Firebase 控制台「Authentication」&gt;「Settings」&gt;「Authorized domains」。</li>
                <li>點選「Add domain」，貼上後儲存。完成後重新整理此頁面即可登入！</li>
              </ol>

              <a
                href={firebaseSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-white px-3 py-1.5 rounded-lg border border-amber-300 shadow-2xs hover:shadow-xs transition-all"
              >
                <ExternalLink size={12} />
                前往 Firebase 授權網域設定頁面 ↗
              </a>
            </div>
          </div>

          {/* SECTION 3: Student Profile Mode */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                <UserIcon size={14} className="text-blue-500" />
                學生身份設定（免 Google 帳號，立即可用）
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              適合學校課堂或未註冊 Google 的學生。輸入學生姓名後，練習成績與錯題統計將記錄在此瀏覽器中，重新整理或重啟不會遺失。
            </p>

            <form onSubmit={handleStudentNameSubmit} className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="輸入學生姓名或英文暱稱（如 Rebecca）"
                className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shrink-0 shadow-xs"
              >
                儲存身份
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-medium">
            Firebase Project: {projectId}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};
