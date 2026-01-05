
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, Attachment, User, Comment, PriorityLevel, ConfidentialityLevel, CompanySettings, View, EnhancementSuggestion, LetterType, SmartReply, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies, analyzeLetterBrief } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, getConfidentialityChip, sanitizeHTML } from './utils';
import ProofreadModal from './ProofreadModal';
import WorkflowTracker from './WorkflowTracker';
import { LinkIcon, InboxInIcon, ClockIcon, SendIcon, ArchiveIcon, CheckCircleIcon, XCircleIcon, ArrowRightLeftIcon, FileTextIcon, DownloadIcon, SparklesIcon, PrinterIcon, BotIcon } from './icons';
import { FileSystemService } from '../services/fileSystemService';

interface LetterDetailsProps {
  letter: Letter;
}

const DetailItem = ({ label, value, children, fullWidth = false }: { label: string, value?: string | number, children?: React.ReactNode, fullWidth?: boolean }) => (
    <div className={fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}>
        <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">{label}</p>
        {value && <p className="font-bold text-base text-white break-words">{value}</p>}
        {children && <div className="font-bold text-base text-white">{children}</div>}
    </div>
);

export default function LetterDetails({ letter }: LetterDetailsProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings, comments } = state;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [activeTab, setActiveTab] = useState<'content' | 'comments' | 'history'>('content');
  const [newComment, setNewComment] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const [showProofreadModal, setShowProofreadModal] = useState(false);
  const [proofreadSuggestions, setProofreadSuggestions] = useState<EnhancementSuggestion[]>([]);

  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);

  // حساب سلسلة المراسلات بالكامل (من الأصل إلى أحدث رد)
  const threadLetters = useMemo(() => {
    let root = letter;
    // العودة للخلف حتى نصل لأول خطاب في السلسلة
    let parent = allLetters.find(l => l.id === root.referenceId);
    while(parent) { 
        root = parent; 
        parent = allLetters.find(l => l.id === root.referenceId); 
    }
    
    const thread: Letter[] = [];
    const collectChildren = (current: Letter) => {
        thread.push(current);
        const children = allLetters.filter(l => l.referenceId === current.id);
        children.sort((a, b) => new Date(a.date.replace(/\//g, '-')).getTime() - new Date(b.date.replace(/\//g, '-')).getTime());
        children.forEach(collectChildren);
    };
    
    collectChildren(root);
    return thread;
  }, [letter, allLetters]);

  const handleGenerateBrief = async () => {
    setIsLoadingBrief(true);
    try {
        const brief = await analyzeLetterBrief(letter);
        dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, aiCache: { ...letter.aiCache, brief } } });
        toast.success("تم توليد الموجز.");
    } catch (e: any) { toast.error("فشل توليد الموجز."); } finally { setIsLoadingBrief(false); }
  };

  const handleSummarizeThread = async () => {
      if (!threadLetters || threadLetters.length <= 1) return;
      setIsSummarizing(true);
      try {
          const result = await summarizeCorrespondenceThread(threadLetters);
          dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, aiCache: { ...letter.aiCache, threadSummary: result } } });
          toast.success("تم تحليل سلسلة المراسلات بالكامل.");
      } catch (e: any) { toast.error("فشل تحليل السلسلة."); } finally { setIsSummarizing(false); }
  };

  const onReply = (letterToReply: Letter) => {
    dispatch({type: 'SET_REPLY_CONTEXT', payload: { letterId: letterToReply.id, sender: letterToReply.to, recipient: letterToReply.from, subject: `رد على: ${letterToReply.subject}`, mode: 'reply' }});
  };

  const theme = getThemeClasses(settings.primaryColor);
  const aiBrief = letter.aiCache?.brief;
  const threadSummary = letter.aiCache?.threadSummary;

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* قسم المساعد الذكي */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-60"></div>
          <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shadow-inner"><BotIcon className="w-6 h-6" /></div>
                  <h3 className="text-lg font-black text-white">تحليل الموقف الإداري</h3>
              </div>
              <div className="flex gap-2">
                {!aiBrief && <button onClick={handleGenerateBrief} disabled={isLoadingBrief} className="text-[10px] font-black bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">{isLoadingBrief ? 'جاري التحليل...' : 'موجز الخطاب'}</button>}
                {threadLetters.length > 1 && !threadSummary && <button onClick={handleSummarizeThread} disabled={isSummarizing} className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">{isSummarizing ? 'جاري التحليل...' : 'تحليل السلسلة بالكامل'}</button>}
              </div>
          </div>
          
          {(aiBrief || threadSummary) && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-500">
                  {threadSummary && (
                      <div className="bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-2xl">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><LinkIcon className="w-3 h-3"/> رؤية سياق السلسلة (مجمع)</p>
                          <p className="text-sm text-indigo-100 leading-relaxed font-bold">{threadSummary}</p>
                      </div>
                  )}
                  {aiBrief && (
                      <div className="bg-black/20 p-5 rounded-2xl border border-white/5 shadow-inner">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">جوهر هذا الخطاب</p>
                          <p className="text-sm text-slate-200 leading-relaxed font-bold">{aiBrief.summary}</p>
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* سلسلة المراسلات - المخطط الزمني */}
      {threadLetters && threadLetters.length > 1 && (
        <div className="glass-card border border-white/10 p-6 overflow-hidden">
             <div className="flex items-center gap-3 mb-8">
                 <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                 <h3 className="text-lg font-black text-white">تسلسل المراسلات المرتبطة</h3>
             </div>
             
             <div className="relative space-y-8 pr-4">
                {/* الخط الرأسي الموصل */}
                <div className="absolute right-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500/50 via-emerald-500/50 to-slate-500/50"></div>
                
                {threadLetters.map((tl, idx) => {
                    const isCurrent = tl.id === letter.id;
                    const isInbound = tl.correspondenceType === CorrespondenceType.INBOUND;
                    
                    return (
                        <div key={tl.id} className="relative flex items-start gap-6 group">
                            {/* نقطة الزمن */}
                            <div className={`z-10 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 shadow-lg ${isCurrent ? 'bg-indigo-600 border-indigo-400 scale-110' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}`}>
                                {isInbound ? <InboxInIcon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} /> : <SendIcon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />}
                            </div>
                            
                            {/* بطاقة المعاملة */}
                            <div 
                                onClick={() => !isCurrent && dispatch({ type: 'SELECT_LETTER', payload: tl.id })}
                                className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer ${isCurrent ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:translate-x-[-4px]'}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isInbound ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                        {isInbound ? 'وارد من ' + tl.from : 'صادر إلى ' + tl.to}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono text-slate-500">{tl.date}</span>
                                        {getStatusChip(tl.status)}
                                    </div>
                                </div>
                                <p className={`text-sm font-black ${isCurrent ? 'text-white' : 'text-slate-300'}`}>{tl.subject}</p>
                                {isCurrent && <div className="mt-2 text-[10px] text-indigo-400 font-black flex items-center gap-1">المعاملة الحالية <div className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></div></div>}
                            </div>
                        </div>
                    );
                })}
             </div>
        </div>
      )}

      {/* تفاصيل المعاملة */}
      <div className="py-6 border-b border-white/10">
          <h3 className="text-lg font-black text-slate-300 mb-4">بطاقة المعاملة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              <DetailItem label="المرسل" value={letter.from} />
              <DetailItem label={letter.correspondenceType === CorrespondenceType.INBOUND ? "التصنيف الإداري" : "إلى"} value={letter.to} />
              <DetailItem label="التاريخ" value={letter.date} />
              <DetailItem label="رقم المعاملة" value={letter.internalRefNumber || '---'} />
              <DetailItem label="الأهمية" children={getPriorityChip(letter.priority || PriorityLevel.NORMAL)} />
              <DetailItem label="الحالة" children={getStatusChip(letter.status)} />
          </div>
      </div>

      {/* المحتوى */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-100">نص المعاملة</h3>
            <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"><PrinterIcon className="w-5 h-5"/></button>
                {!isEditing && <button onClick={() => setIsEditing(true)} className="text-sm font-black text-indigo-400 hover:text-indigo-300 px-3 py-1">تعديل النص</button>}
            </div>
        </div>
        
        {isEditing ? (
            <div className="animate-in fade-in duration-300">
                <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} />
                <div className="mt-4 flex justify-end gap-3">
                    <button onClick={() => setIsEditing(false)} className="px-6 py-2 text-sm font-bold text-slate-400">إلغاء</button>
                    <button onClick={() => { dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, body: editedBody } }); setIsEditing(false); toast.success("تم الحفظ"); }} className={`px-8 py-2 text-sm font-black text-white ${theme.bg} rounded-xl shadow-lg`}>اعتماد التعديلات</button>
                </div>
            </div>
        ) : (
            <div className="rounded-2xl border border-white/10 bg-white/95 text-black shadow-2xl p-8 md:p-12">
                <div className="prose max-w-none font-bold text-slate-900 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
            </div>
        )}
      </div>

      {/* إجراءات سريعة */}
      {letter.status !== LetterStatus.ARCHIVED && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-40 animate-in slide-in-from-bottom-10 duration-700 no-print">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 border-l border-white/10">إجراءات الرد</span>
                <button onClick={() => onReply(letter)} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all shadow-lg active:scale-95">
                    <SendIcon className="w-4 h-4" /> إنشاء رد ذكي
                </button>
                <button onClick={() => dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, status: LetterStatus.ARCHIVED } })} className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-black text-sm transition-all border border-white/10">
                    <ArchiveIcon className="w-4 h-4" /> أرشفة المعاملة
                </button>
          </div>
      )}
    </div>
  );
}
