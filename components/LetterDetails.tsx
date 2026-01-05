
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, Attachment, User, Comment, PriorityLevel, ConfidentialityLevel, CompanySettings, View, EnhancementSuggestion, LetterType, SmartReply, Tone, StrategicAnalysis } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies, analyzeLetterBrief, analyzeStrategicPaths } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, getConfidentialityChip, sanitizeHTML } from './utils';
import ProofreadModal from './ProofreadModal';
import WorkflowTracker from './WorkflowTracker';
import { LinkIcon, InboxInIcon, ClockIcon, SendIcon, ArchiveIcon, CheckCircleIcon, XCircleIcon, ArrowRightLeftIcon, FileTextIcon, DownloadIcon, SparklesIcon, PrinterIcon, BotIcon, ShieldCheckIcon, LightbulbIcon, BrainCircuitIcon } from './icons';
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'comments' | 'history'>('content');
  const [newComment, setNewComment] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const [showProofreadModal, setShowProofreadModal] = useState(false);
  const [proofreadSuggestions, setProofreadSuggestions] = useState<EnhancementSuggestion[]>([]);

  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  const aiBrief = letter.aiCache?.brief;
  const aiStrategy = letter.aiCache?.strategy;
  const threadSummary = letter.aiCache?.threadSummary;

  const handleDeepAnalysis = async () => {
    setIsLoadingBrief(true);
    setIsLoadingStrategy(true);
    try {
        const [brief, strategy] = await Promise.all([
            analyzeLetterBrief(letter),
            analyzeStrategicPaths(letter)
        ]);
        dispatch({ 
            type: 'UPDATE_LETTER', 
            payload: { ...letter, aiCache: { ...letter.aiCache, brief, strategy } } 
        });
        toast.success("اكتمل التحليل الاستراتيجي وكشف النوايا.");
    } catch (e: any) { 
        toast.error("فشل التحليل المعمق."); 
    } finally { 
        setIsLoadingBrief(false); 
        setIsLoadingStrategy(false); 
    }
  };

  const handleStatusChange = (newStatus: LetterStatus, actionText: string) => {
    const newHistoryRecord: ApprovalRecord = {
      action: actionText,
      date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
      userId: state.currentUser?.id,
      userName: state.currentUser?.name
    };
    dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, status: newStatus, approvalHistory: [...letter.approvalHistory, newHistoryRecord] } });
  };

  const onReply = (letterToReply: Letter, objective?: string, tone?: string) => {
    dispatch({type: 'SET_REPLY_CONTEXT', payload: { letterId: letterToReply.id, sender: letterToReply.to, recipient: letterToReply.from, subject: `رد على: ${letterToReply.subject}`, mode: 'reply', objective, tone: (tone as Tone) || Tone.NEUTRAL }});
  };

  const threadLetters = useMemo(() => {
    let root = letter;
    let parent = allLetters.find(l => l.id === root.referenceId);
    while(parent) { root = parent; parent = allLetters.find(l => l.id === root.referenceId); }
    const thread: Letter[] = [];
    const collectChildren = (current: Letter) => {
        thread.push(current);
        allLetters.filter(l => l.referenceId === current.id).forEach(collectChildren);
    };
    collectChildren(root);
    return thread;
  }, [letter, allLetters]);

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* قسم المساعد الاستراتيجي المطور */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-40"></div>
          
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner ring-1 ring-white/5">
                      <BrainCircuitIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">رؤى الذكاء الاصطناعي الاستراتيجية</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">كشف النوايا وتحليل الموقف الإداري</p>
                  </div>
              </div>
              <button 
                onClick={handleDeepAnalysis} 
                disabled={isLoadingBrief || isLoadingStrategy}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-xl active:scale-95 ${isLoadingStrategy ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
              >
                {isLoadingStrategy ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <SparklesIcon className="w-4 h-4" />}
                {aiStrategy ? 'إعادة التحليل' : 'تحليل النوايا والمخاطر'}
              </button>
          </div>

          {!aiBrief && !aiStrategy && !isLoadingStrategy && (
            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <BotIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">اضغط على الزر أعلاه لتفعيل القراءة الذكية لما وراء السطور.</p>
            </div>
          )}

          {(aiBrief || aiStrategy) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-top-4 duration-700">
                  
                  {/* الرؤية الاستراتيجية ونبرة الخطاب */}
                  <div className="lg:col-span-8 space-y-6">
                      {aiStrategy && (
                        <div className="bg-slate-950/60 p-6 rounded-3xl border border-white/5 shadow-inner">
                            <div className="flex items-center gap-2 text-indigo-400 mb-4">
                                <LightbulbIcon className="w-5 h-5" />
                                <span className="text-[11px] font-black uppercase tracking-widest">كشف النوايا (Intent Analysis)</span>
                            </div>
                            <p className="text-base text-slate-100 font-bold leading-relaxed">{aiStrategy.sender_intent}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <span className="block text-[9px] font-black text-slate-500 uppercase mb-2">ميزان القوة</span>
                                    <p className="text-sm text-indigo-200 font-bold">{aiStrategy.power_balance}</p>
                                </div>
                                <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                                    <span className="block text-[9px] font-black text-rose-400 uppercase mb-2">المخاطر المحتملة</span>
                                    <ul className="space-y-1">
                                        {aiStrategy.risks?.map((r, i) => (
                                            <li key={i} className="text-xs text-rose-100 font-bold flex items-center gap-2">
                                                <div className="w-1 h-1 bg-rose-500 rounded-full"></div> {r}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                      )}

                      {aiBrief && (
                          <div className="bg-indigo-600/10 p-6 rounded-3xl border border-indigo-500/20">
                               <div className="flex items-center gap-2 text-indigo-300 mb-3">
                                <FileTextIcon className="w-5 h-5" />
                                <span className="text-[11px] font-black uppercase tracking-widest">الموجز التنفيذي</span>
                            </div>
                            <p className="text-sm text-indigo-50 font-bold leading-relaxed">{aiBrief.summary}</p>
                          </div>
                      )}
                  </div>

                  {/* النقاط الجوهرية (Action Items) */}
                  <div className="lg:col-span-4 space-y-4">
                      <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/5 h-full shadow-2xl">
                          <h4 className="text-xs font-black text-white mb-5 flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                              نقاط تستوجب الرد/المعالجة
                          </h4>
                          <ul className="space-y-4">
                              {aiBrief?.keyPoints.map((point, i) => (
                                  <li key={i} className="flex items-start gap-3 group">
                                      <div className="mt-1 w-5 h-5 rounded-lg border-2 border-slate-700 group-hover:border-indigo-500 transition-colors flex-shrink-0"></div>
                                      <span className="text-xs text-slate-300 font-bold leading-relaxed group-hover:text-white transition-colors">{point}</span>
                                  </li>
                              ))}
                              {(!aiBrief || aiBrief.keyPoints.length === 0) && !isLoadingBrief && (
                                  <p className="text-[11px] text-slate-600 font-bold text-center py-4 italic">لا توجد نقاط معالجة مستخرجة حالياً.</p>
                              )}
                          </ul>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* سلسلة المراسلات - المخطط الزمني */}
      {threadLetters && threadLetters.length > 1 && (
        <div className="glass-card border border-white/10 p-6 overflow-hidden">
             <div className="flex items-center gap-3 mb-8">
                 <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                 <h3 className="text-lg font-black text-white">تسلسل المراسلات المرتبطة</h3>
             </div>
             
             <div className="relative space-y-8 pr-4">
                <div className="absolute right-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-500/50 via-emerald-500/50 to-slate-500/50"></div>
                {threadLetters.map((tl, idx) => {
                    const isCurrent = tl.id === letter.id;
                    const isInbound = tl.correspondenceType === CorrespondenceType.INBOUND;
                    return (
                        <div key={tl.id} className="relative flex items-start gap-6 group">
                            <div className={`z-10 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 shadow-lg ${isCurrent ? 'bg-indigo-600 border-indigo-400 scale-110' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}`}>
                                {isInbound ? <InboxInIcon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} /> : <SendIcon className={`w-5 h-5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />}
                            </div>
                            <div onClick={() => !isCurrent && dispatch({ type: 'SELECT_LETTER', payload: tl.id })} className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer ${isCurrent ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:translate-x-[-4px]'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isInbound ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>{isInbound ? 'وارد من ' + tl.from : 'صادر إلى ' + tl.to}</span>
                                    <div className="flex items-center gap-3"><span className="text-[10px] font-mono text-slate-500">{tl.date}</span>{getStatusChip(tl.status)}</div>
                                </div>
                                <p className={`text-sm font-black ${isCurrent ? 'text-white' : 'text-slate-300'}`}>{tl.subject}</p>
                            </div>
                        </div>
                    );
                })}
             </div>
        </div>
      )}

      {/* تفاصيل وبطاقة المعاملة */}
      <div className="py-6 border-b border-white/10">
          <h3 className="text-lg font-black text-slate-300 mb-4">بطاقة المعاملة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              <DetailItem label="المرسل" value={letter.from} /><DetailItem label={letter.correspondenceType === CorrespondenceType.INBOUND ? "التصنيف الإداري" : "إلى"} value={letter.to} /><DetailItem label="التاريخ" value={letter.date} /><DetailItem label="رقم المعاملة" value={letter.internalRefNumber || '---'} /><DetailItem label="الأهمية" children={getPriorityChip(letter.priority || PriorityLevel.NORMAL)} /><DetailItem label="الحالة" children={getStatusChip(letter.status)} />
          </div>
      </div>

      {/* محتوى المعاملة */}
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
            <div className="rounded-2xl border border-white/10 bg-white/95 text-black shadow-2xl p-8 md:p-12 relative">
                <div className="absolute top-4 right-4 text-[10px] text-slate-300 font-black uppercase tracking-widest pointer-events-none opacity-20">نص الخطاب الرسمي</div>
                <div className="prose max-w-none font-bold text-slate-900 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
            </div>
        )}
      </div>

      {/* إجراءات الرد والأرشفة */}
      {letter.status !== LetterStatus.ARCHIVED && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-40 animate-in slide-in-from-bottom-10 duration-700 no-print ring-1 ring-white/10">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 border-l border-white/10">إجراءات سريعة</span>
                <button onClick={() => onReply(letter)} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all shadow-lg active:scale-95 group">
                    <SendIcon className="w-4 h-4 group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform" /> إنشاء رد ذكي
                </button>
                <button onClick={() => handleStatusChange(LetterStatus.ARCHIVED, "تمت أرشفة المعاملة")} className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-black text-sm transition-all border border-white/10">
                    <ArchiveIcon className="w-4 h-4" /> أرشفة
                </button>
          </div>
      )}
    </div>
  );
}
