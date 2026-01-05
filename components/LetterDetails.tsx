
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, Attachment, User, Comment, PriorityLevel, ConfidentialityLevel, CompanySettings, View, EnhancementSuggestion, LetterType, SmartReply, Tone, StrategicAnalysis } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies, analyzeLetterBrief, analyzeStrategicPaths } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import DiffViewer from './DiffViewer';
import InboundCoverSheet from './InboundCoverSheet';
import OutboundLetterHeader from './OutboundLetterHeader';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, getConfidentialityChip, sanitizeHTML } from './utils';
import DeliveryReceipt from './DeliveryReceipt';
import ProofreadModal from './ProofreadModal';
import WorkflowTracker from './WorkflowTracker';
import { LinkIcon, InboxInIcon, ClockIcon, SendIcon, ArchiveIcon, CheckCircleIcon, XCircleIcon, ArrowRightLeftIcon, FileTextIcon, DownloadIcon, SparklesIcon, PrinterIcon, BotIcon, TargetIcon, ShieldAlertIcon, ScaleIcon } from './icons';
import { FileSystemService } from '../services/fileSystemService';

interface LetterDetailsProps {
  letter: Letter;
}

function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Error converting data URL to blob", e);
        return null;
    }
}

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const DetailItem = ({ label, value, children, fullWidth = false }: { label: string, value?: string | number, children?: React.ReactNode, fullWidth?: boolean }) => (
    <div className={fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}>
        <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">{label}</p>
        {value && <p className="font-bold text-base text-white break-words">{value}</p>}
        {children && <div className="font-bold text-base text-white">{children}</div>}
    </div>
);

const PrintableLetter = ({ letter, settings }: { letter: Letter, settings: CompanySettings }) => {
    const watermarkText = `${letter.confidentiality === ConfidentialityLevel.TOP_SECRET ? "سري للغاية\n" : ""}${settings.companyName}\n${new Date().toLocaleString('ar-SA')}`;
    
    return (
        <div className="bg-white">
            <div className="print-watermark" style={{ whiteSpace: 'pre-wrap' }}>{watermarkText}</div>
            <div className="p-10" style={{ fontFamily: 'Cairo, sans-serif' }}>
                <div className="printable-header">
                    {letter.correspondenceType === CorrespondenceType.OUTBOUND && (
                        <OutboundLetterHeader letter={letter} settings={settings} />
                    )}
                </div>
                <div className="prose max-w-none prose-slate font-bold text-black" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                {letter.isSigned && (
                    <div className="mt-8 pt-4 border-t border-dashed">
                        <p className="text-sm text-emerald-700 font-bold flex items-center gap-2">
                            <span>(تم التوقيع إلكترونياً)</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function LetterDetails({ letter }: LetterDetailsProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings, comments } = state;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [bodyBeforeEdit, setBodyBeforeEdit] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'comments' | 'history'>('content');
  const [newComment, setNewComment] = useState('');
  const [diffData, setDiffData] = useState<{ old: string; new: string } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [printableContent, setPrintableContent] = useState<React.ReactNode | null>(null);
  
  const [isProofreading, setIsProofreading] = useState(false);
  const [showProofreadModal, setShowProofreadModal] = useState(false);
  const [proofreadSuggestions, setProofreadSuggestions] = useState<EnhancementSuggestion[]>([]);

  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [isLoadingSmartReplies, setIsLoadingSmartReplies] = useState(false);

  const printRoot = document.getElementById('print-root');

  const ActionButton: React.FC<{ text: string, onClick: () => void, colorClass: string, disabled?: boolean, isLoading?: boolean, icon?: React.ReactNode }> = ({ text, onClick, colorClass, disabled, isLoading, icon }) => (
    <button onClick={onClick} disabled={disabled || isLoading} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg ${colorClass}`}>
        {isLoading ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div> : icon}
        <span>{text}</span>
    </button>
  );

  const handleGenerateBrief = async () => {
    setIsLoadingBrief(true);
    try {
        const brief = await analyzeLetterBrief(letter);
        dispatch({
            type: 'UPDATE_LETTER',
            payload: { ...letter, aiCache: { ...letter.aiCache, brief } }
        });
        toast.success("تم توليد الموجز الذكي.");
    } catch (e: any) {
        console.error("AI Brief Error:", e);
        toast.error("تعذر التواصل مع الذكاء الاصطناعي حالياً.");
    } finally {
        setIsLoadingBrief(false);
    }
  };

  const handleStrategyAnalysis = async () => {
    setIsLoadingStrategy(true);
    try {
        const strategy = await analyzeStrategicPaths(letter);
        dispatch({
            type: 'UPDATE_LETTER',
            payload: { ...letter, aiCache: { ...letter.aiCache, strategy } }
        });
        toast.success("اكتمل التحليل الاستراتيجي.");
    } catch (e: any) {
        console.error("AI Strategy Error:", e);
        toast.error("فشل تحليل النوايا والمخاطر.");
    } finally {
        setIsLoadingStrategy(false);
    }
  };

  const handleGenerateSmartReplies = async () => {
    setIsLoadingSmartReplies(true);
    try {
        const replies = await generateSmartReplies(letter);
        dispatch({
            type: 'UPDATE_LETTER',
            payload: { ...letter, aiCache: { ...letter.aiCache, smartReplies: replies } }
        });
        toast.success("تم استخلاص مسارات الرد.");
    } catch (e: any) {
        console.error("AI Smart Replies Error:", e);
        toast.error("فشل استخلاص الردود المقترحة.");
    } finally {
        setIsLoadingSmartReplies(false);
    }
  };

  useEffect(() => {
    setIsEditing(false);
    setEditedBody(letter.body);
    setActiveTab('content');
    setDiffData(null);
    setNewComment('');
    setPrintableContent(null);
    setShowProofreadModal(false);
  }, [letter.id]);

  const handlePrint = () => {
    setPrintableContent(<PrintableLetter letter={letter} settings={settings} />);
    setTimeout(() => { window.print(); setPrintableContent(null); }, 300);
  };

  const handleDownloadDigitalCopy = () => {
      FileSystemService.downloadLetterAsJson(letter);
      toast.success("تم تحميل النسخة الرقمية (JSON)");
  };

  const handleStatusChange = (newStatus: LetterStatus, actionText: string, notes?: string) => {
    const newHistoryRecord: ApprovalRecord = {
      action: actionText,
      date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
      notes,
      userId: state.currentUser?.id,
      userName: state.currentUser?.name
    };
    const updatedLetter = { ...letter, status: newStatus, approvalHistory: [...letter.approvalHistory, newHistoryRecord] };
    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
  };
  
  const handleSign = () => {
    const newHistoryRecord: ApprovalRecord = { action: 'تم التوقيع إلكترونياً', date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), userId: state.currentUser?.id, userName: state.currentUser?.name };
    const updatedLetter = { ...letter, isSigned: true, approvalHistory: [...letter.approvalHistory, newHistoryRecord] };
    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
  };

  const handleEdit = () => { setBodyBeforeEdit(letter.body); setIsEditing(true); setActiveTab('content'); };

  const handleSaveEdit = () => {
    const updatedLetter = { ...letter, body: sanitizeHTML(editedBody), approvalHistory: [...letter.approvalHistory, { action: 'تم تعديل المحتوى', date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), previousBody: bodyBeforeEdit, userId: state.currentUser?.id, userName: state.currentUser?.name }] };
    dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
    setIsEditing(false);
    toast.success('تم حفظ التعديلات.');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    dispatch({ type: 'ADD_COMMENT', payload: { letterId: letter.id, text: newComment }});
    setNewComment('');
  };
  
  const handleSummarizeThread = async () => {
      if (!threadLetters || threadLetters.length === 0) return;
      setIsSummarizing(true);
      try {
          const result = await summarizeCorrespondenceThread(threadLetters);
          dispatch({
              type: 'UPDATE_LETTER',
              payload: { ...letter, aiCache: { ...letter.aiCache, threadSummary: result } }
          });
          toast.success("تم تلخيص السلسلة");
      } catch (e: any) { 
          console.error("AI Thread Summary Error:", e);
          toast.error("فشل تلخيص سلسلة المراسلات.");
      } finally { setIsSummarizing(false); }
  };

  const onReply = (letterToReply: Letter, objective?: string, tone?: string) => {
    dispatch({type: 'SET_REPLY_CONTEXT', payload: { letterId: letterToReply.id, sender: letterToReply.to, recipient: letterToReply.from, subject: `ردًا على خطابكم بخصوص: ${letterToReply.subject}`, mode: 'reply', objective, tone: (tone as Tone) || Tone.NEUTRAL }});
    dispatch({type: 'SET_VIEW', payload: View.GENERATOR });
  };

  const onSupplementary = (letterToSupplement: Letter) => {
      const isOutbound = letterToSupplement.correspondenceType === CorrespondenceType.OUTBOUND;
      dispatch({type: 'SET_REPLY_CONTEXT', payload: { letterId: letterToSupplement.id, sender: isOutbound ? letterToSupplement.from : letterToSupplement.to, recipient: isOutbound ? letterToSupplement.to : letterToSupplement.from, subject: `إلحاقاً بخطابنا: ${letterToSupplement.subject}`, mode: 'supplementary' }});
      dispatch({type: 'SET_VIEW', payload: View.GENERATOR });
  };

  const handleProofread = async () => {
      if (!isEditing) handleEdit();
      setIsProofreading(true);
      try {
          const suggestions = await enhanceLetter((isEditing ? editedBody : letter.body).replace(/<[^>]*>?/gm, ' '));
          setProofreadSuggestions(suggestions);
          setShowProofreadModal(true);
      } catch (error) { console.error(error); } finally { setIsProofreading(false); }
  };

  const handleViewAttachment = (att: Attachment) => {
    if (!att.url || att.url === '#') {
        toast('المعاينة غير متاحة للمرفقات التجريبية.', { icon: 'ℹ️' });
        return;
    }
    try {
        const blob = dataURLtoBlob(att.url);
        if (blob) {
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        }
    } catch (e) {
        toast.error('حدث خطأ أثناء محاولة فتح المرفق.');
    }
  };

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = await fileToDataURL(file);
      const newAttachment: Attachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.includes('word') ? 'word' : 'other',
        url: url,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      };

      const updatedLetter = {
        ...letter,
        attachments: [...(letter.attachments || []), newAttachment],
        approvalHistory: [...letter.approvalHistory, { action: `تم إرفاق ملف: ${file.name}`, date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), userId: state.currentUser?.id, userName: state.currentUser?.name }]
      };
      dispatch({ type: 'UPDATE_LETTER', payload: updatedLetter });
      toast.success('تم إرفاق الملف بنجاح.');
    }
  };

  const theme = getThemeClasses(settings.primaryColor);
  const letterComments = useMemo(() => comments.filter(c => c.letterId === letter.id), [comments, letter.id]);

  const threadLetters = useMemo(() => {
    let root = letter;
    let parent = allLetters.find(l => l.id === root.referenceId);
    while(parent) { root = parent; parent = allLetters.find(l => l.id === root.referenceId); }
    const thread: Letter[] = [];
    const queue = [root];
    const visited = new Set<string>();
    while(queue.length > 0) {
        const curr = queue.shift()!;
        if(visited.has(curr.id)) continue;
        visited.add(curr.id);
        thread.push(curr);
        queue.push(...allLetters.filter(l => l.referenceId === curr.id));
    }
    return thread;
  }, [letter, allLetters]);

  const renderActions = () => {
    const actions = [];
    if (letter.correspondenceType === CorrespondenceType.INBOUND) {
        if (letter.status === LetterStatus.RECEIVED) {
            actions.push(<ActionButton key="requires-reply" text="يستوجب الرد" onClick={() => handleStatusChange(LetterStatus.AWAITING_REPLY, 'تم تحديد المعاملة بأنها تستوجب الرد')} colorClass="text-white bg-indigo-600 hover:bg-indigo-700" icon={<SendIcon className="w-4 h-4" />} />);
            actions.push(<ActionButton key="no-reply" text="للحفظ" onClick={() => handleStatusChange(LetterStatus.ARCHIVED, 'تم الحفظ للعلم والإحاطة')} colorClass="text-slate-200 bg-slate-600 hover:bg-slate-700" icon={<ArchiveIcon className="w-4 h-4" />} />);
        } else if (letter.status === LetterStatus.AWAITING_REPLY) {
            actions.push(<ActionButton key="reply" text="إنشاء الرد" onClick={() => onReply(letter)} colorClass="text-white bg-emerald-600 hover:bg-emerald-700" icon={<SendIcon className="w-4 h-4" />} />);
        }
    }
    actions.push(<ActionButton key="supplementary" text="خطاب إلحاقي" onClick={() => onSupplementary(letter)} colorClass="text-slate-800 bg-cyan-400 hover:bg-cyan-500" />);
    if (!isEditing && letter.status !== LetterStatus.ARCHIVED) {
        actions.push(<ActionButton key="edit" text="تعديل المحتوى" onClick={handleEdit} colorClass="text-slate-300 bg-white/10 hover:bg-white/20 border border-white/10" />);
    }
    if (!letter.isSigned) actions.push(<ActionButton key="sign" text="توقيع إلكتروني" onClick={handleSign} colorClass="text-white bg-violet-600 hover:bg-violet-700" />);
    if (letter.correspondenceType === CorrespondenceType.OUTBOUND && letter.status !== LetterStatus.SENT && letter.status !== LetterStatus.ARCHIVED) {
        actions.push(<ActionButton key="send" text="إرسال الخطاب" onClick={() => handleStatusChange(LetterStatus.SENT, 'تم الإرسال')} disabled={!letter.isSigned} colorClass={`text-white ${theme.bg} ${theme.hoverBg}`} />);
    }
    return <div className="flex flex-wrap items-center gap-3">{actions}</div>;
  };

  const aiBrief = letter.aiCache?.brief;
  const aiStrategy = letter.aiCache?.strategy;
  const smartReplies = letter.aiCache?.smartReplies || [];
  const threadSummary = letter.aiCache?.threadSummary;

  return (
    <>
    {printRoot && printableContent && createPortal(printableContent, printRoot)}
    {showProofreadModal && <ProofreadModal suggestions={proofreadSuggestions} onClose={() => setShowProofreadModal(false)} onApplyAll={(s) => { let b = editedBody; s.forEach(x => b = b.replace(x.original_part, x.suggested_improvement)); setEditedBody(b); setShowProofreadModal(false); }} onApplyOne={(s) => setEditedBody(prev => prev.replace(s.original_part, s.suggested_improvement))} />}

    <div className="p-4 lg:p-6 bg-transparent space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* مركز التحليل الذكي المطور */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-[3rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-60"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner ring-1 ring-white/5">
                      <BotIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">مركز الرؤى والتحليل</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">المعالج الذكي للمعاملات الإدارية</p>
                  </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                  <button onClick={handleGenerateBrief} disabled={isLoadingBrief} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingBrief ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <FileTextIcon className="w-3.5 h-3.5" />}
                      {aiBrief ? 'تحديث الموجز' : 'توليد موجز'}
                  </button>
                  <button onClick={handleStrategyAnalysis} disabled={isLoadingStrategy} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingStrategy ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <TargetIcon className="w-3.5 h-3.5" />}
                      {aiStrategy ? 'تحديث كشف النوايا' : 'كشف النوايا والمخاطر'}
                  </button>
                  <button onClick={handleGenerateSmartReplies} disabled={isLoadingSmartReplies} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingSmartReplies ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <SparklesIcon className="w-3.5 h-3.5" />}
                      {smartReplies.length > 0 ? 'تحديث مسارات الرد' : 'استكشاف الردود'}
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                  {aiBrief && (
                      <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-white/5 animate-in slide-in-from-top-4">
                          <div className="flex items-center gap-2 text-indigo-300 mb-3">
                              <SparklesIcon className="w-5 h-5" />
                              <span className="text-[10px] font-black uppercase tracking-widest">الموجز التنفيذي</span>
                          </div>
                          <p className="text-sm text-slate-100 font-bold leading-relaxed mb-4">{aiBrief.summary}</p>
                          <div className="flex flex-wrap gap-2">
                              {aiBrief.keyPoints.map((p, i) => (
                                  <span key={i} className="bg-white/5 px-3 py-1.5 rounded-lg text-[11px] text-slate-400 font-bold border border-white/5 flex items-center gap-2">
                                      <div className="w-1 h-1 bg-indigo-500 rounded-full"></div> {p}
                                  </span>
                              ))}
                          </div>
                      </div>
                  )}

                  {aiStrategy && (
                      <div className="bg-slate-950/80 p-6 rounded-[2rem] border border-white/5 shadow-inner space-y-6 animate-in slide-in-from-top-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                      <TargetIcon className="w-5 h-5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">النوايا المرصودة</span>
                                  </div>
                                  <p className="text-xs text-slate-300 font-bold leading-relaxed">{aiStrategy.sender_intent}</p>
                                  
                                  <div className="mt-4 flex items-center gap-2 text-indigo-300">
                                      <ScaleIcon className="w-4 h-4" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">{aiStrategy.power_balance}</span>
                                  </div>
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 text-rose-400 mb-2">
                                      <ShieldAlertIcon className="w-5 h-5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">المخاطر المحتملة</span>
                                  </div>
                                  <ul className="space-y-1">
                                      {aiStrategy.risks.map((r, i) => (
                                          <li key={i} className="text-[11px] text-rose-200/70 font-bold">• {r}</li>
                                      ))}
                                  </ul>
                              </div>
                          </div>

                          {/* عرض المسارات الاستراتيجية المقترحة */}
                          {aiStrategy.paths && aiStrategy.paths.length > 0 && (
                              <div className="pt-4 border-t border-white/5">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">مسارات استراتيجية مقترحة للرد:</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {aiStrategy.paths.map((path, i) => (
                                          <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                                              <p className="text-xs font-black text-indigo-400 mb-1">{path.title}</p>
                                              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{path.description}</p>
                                              <div className="mt-2 flex gap-2">
                                                  <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded font-bold">الأثر: {path.impact}</span>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
                  
                  {!aiBrief && !aiStrategy && !isLoadingBrief && !isLoadingStrategy && (
                      <div className="flex flex-col items-center justify-center py-12 opacity-20 border border-dashed border-white/10 rounded-[2rem]">
                          <BotIcon className="w-16 h-16 mb-4" />
                          <p className="font-black text-sm">استخدم أدوات الذكاء أعلاه لتحليل المعاملة</p>
                      </div>
                  )}
              </div>

              <div className="xl:col-span-4">
                  {smartReplies && smartReplies.length > 0 ? (
                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">توجيهات الرد السريع:</p>
                          {smartReplies.map((reply, i) => (
                              <button 
                                key={i} 
                                onClick={() => onReply(letter, reply.objective, reply.tone)}
                                className="w-full text-right p-4 bg-white/5 hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all group"
                              >
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{reply.title}</span>
                                      <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">{reply.tone}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-bold line-clamp-2 leading-relaxed group-hover:text-white">{reply.objective}</p>
                              </button>
                          ))}
                      </div>
                  ) : !isLoadingSmartReplies && (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 border border-dashed border-white/10 rounded-[2rem] p-6 text-center">
                          <SparklesIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-black">لا توجد ردود جاهزة</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      <div className="glass-card p-6 border border-white/10 shadow-lg"><WorkflowTracker letter={letter} settings={settings} /></div>

      {threadLetters && threadLetters.length > 1 && (
        <div className="glass-card border border-white/10 p-5 overflow-hidden">
             <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-black text-white flex items-center gap-2"><LinkIcon className="w-5 h-5 text-indigo-400" />سلسلة المراسلات المرتبطة</h3><ActionButton text={isSummarizing ? "جاري التلخيص..." : "تلخيص السلسلة"} onClick={handleSummarizeThread} colorClass="text-xs px-3 py-1.5 bg-white/5 text-slate-300 border border-white/5" icon={<FileTextIcon className="w-4 h-4"/>} /></div>
            <div className="space-y-3">{threadLetters.map((tl) => (<div key={tl.id} onClick={() => tl.id !== letter.id && dispatch({ type: 'SELECT_LETTER', payload: tl.id })} className={`p-4 rounded-xl border transition-all cursor-pointer ${tl.id === letter.id ? 'bg-indigo-500/10 border-indigo-500/40 shadow-inner' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}><div className="flex items-center justify-between mb-1"><span className="text-[10px] font-black text-slate-500">{tl.date}</span>{getStatusChip(tl.status)}</div><p className={`text-sm font-bold ${tl.id === letter.id ? 'text-white' : 'text-slate-300'}`}>{tl.subject}</p></div>))}</div>
            {threadSummary && <div className="mt-6 p-5 bg-slate-950/80 rounded-xl border border-indigo-500/30 text-indigo-100 text-sm leading-relaxed shadow-2xl animate-in zoom-in-95" dangerouslySetInnerHTML={{ __html: threadSummary.replace(/\n/g, '<br/>') }} />}
        </div>
      )}

      <div className="py-6 border-b border-white/10">
          <h3 className="text-lg font-black text-slate-300 mb-4">تفاصيل المعاملة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
              <DetailItem label="المرسل" value={letter.from} /><DetailItem label={letter.correspondenceType === CorrespondenceType.INBOUND ? "التصنيف الإداري" : "إلى"} value={letter.to} /><DetailItem label="التاريخ" value={letter.date} /><DetailItem label="رقم المعاملة" value={letter.internalRefNumber || '---'} /><DetailItem label="الأهمية" children={getPriorityChip(letter.priority || PriorityLevel.NORMAL)} /><DetailItem label="الحالة" children={getStatusChip(letter.status)} />
          </div>
      </div>

      <div className="my-6 p-4 bg-white/5 rounded-xl border border-white/5 no-print"><h3 className="text-lg font-bold text-slate-300 mb-4">الإجراءات المتاحة</h3>{renderActions()}</div>
      
        <div className="border-b border-white/10 mb-6"><nav className="-mb-px flex space-x-6 space-x-reverse"><button onClick={() => setActiveTab('content')} className={`whitespace-nowrap py-4 px-1 border-b-4 font-black text-sm ${activeTab === 'content' ? theme.tabActive : theme.tabInactive}`}>المحتوى والمرفقات</button><button onClick={() => setActiveTab('comments')} className={`whitespace-nowrap py-4 px-1 border-b-4 font-black text-sm ${activeTab === 'comments' ? theme.tabActive : theme.tabInactive}`}>الملاحظات والتعليقات</button><button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-4 px-1 border-b-4 font-black text-sm ${activeTab === 'history' ? theme.tabActive : theme.tabInactive}`}>سجل المسار الزمني</button></nav></div>

        <div>
            {activeTab === 'content' && (
                <div className="space-y-8">
                    <div>
                        <h3 className="text-xl font-black text-slate-100 mb-4">نص الشرح / الخطاب</h3>
                        {isEditing ? (
                            <div className="animate-in fade-in duration-300">
                                <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} />
                                <div className="mt-4 flex items-center justify-end gap-3 bg-slate-800/50 p-4 rounded-xl border border-white/5 shadow-inner"><button onClick={() => setIsEditing(false)} className="px-6 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors">إلغاء</button><button onClick={handleSaveEdit} className={`px-8 py-2 text-sm font-black text-white ${theme.bg} rounded-lg shadow-lg`}>حفظ واعتماد التعديلات</button></div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/95 text-black shadow-2xl overflow-hidden"><div className="p-8 md:p-12"><div className="prose max-w-none prose-slate font-bold text-slate-900 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />{letter.isSigned && (<div className="mt-12 pt-6 border-t border-dashed border-slate-300 flex items-center justify-between"><p className="text-base text-emerald-800 font-black flex items-center gap-2"><CheckCircleIcon className="w-5 h-5" /><span>تم التوقيع والمصادقة إلكترونياً</span></p><span className="text-[10px] text-slate-400 font-mono">HASH_{letter.id.substring(0,8)}</span></div>)}</div></div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="space-y-4"><h3 className="text-xl font-black text-slate-100">الملفات المرفقة</h3><div className="bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">{(!letter.attachments || letter.attachments.length === 0) ? <div className="text-center py-6"><p className="text-sm font-bold text-slate-500">لا توجد مرفقات لهذه المعاملة.</p></div> : <ul className="space-y-3">{letter.attachments?.map(att => (<li key={att.id}><div className="w-full text-right flex items-center gap-3 p-4 bg-slate-800/60 rounded-xl border border-white/10 hover:border-indigo-500/50 hover:shadow-xl transition-all group"><div className="flex-grow overflow-hidden"><button onClick={() => handleViewAttachment(att)} className="font-black text-base truncate block text-slate-200 group-hover:text-white transition-colors">{att.name}</button><span className="text-[10px] text-slate-500 font-bold">{att.size}</span></div><div className="flex items-center gap-2 flex-shrink-0"><a href={att.url} download={att.name} className="p-2 text-slate-400 hover:text-white font-bold rounded-lg hover:bg-white/10 transition-colors">تنزيل</a></div></div></li>))}</ul>}<div className="mt-4 pt-4 border-t border-white/5"><input type="file" ref={attachmentInputRef} onChange={handleAddAttachment} className="hidden" /><button onClick={() => attachmentInputRef.current?.click()} className="w-full text-sm font-black flex items-center justify-center gap-2 px-4 py-3 text-slate-400 bg-white/5 rounded-xl hover:bg-white/10 border border-white/5 transition-all">إضافة مرفق جديد</button></div></div></div><div className='no-print space-y-4'><h3 className="text-xl font-black text-slate-100">التصدير والطباعة</h3><div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-3 shadow-inner"><ActionButton text="تحميل نسخة رقمية (JSON)" onClick={handleDownloadDigitalCopy} colorClass="w-full justify-center text-emerald-400 bg-emerald-950/20 border border-emerald-500/30" icon={<DownloadIcon className="w-4 h-4"/>} /><ActionButton text="طباعة المستند" onClick={handlePrint} colorClass="w-full justify-center text-white bg-indigo-600 hover:bg-indigo-500" icon={<PrinterIcon className="w-4 h-4" />} /></div></div></div>
                </div>
            )}
            {activeTab === 'comments' && (
                <div className="max-w-3xl space-y-6">{letterComments.length > 0 ? <ul className="space-y-6">{letterComments.map(comment => (
                                <li key={comment.id} className="flex items-start gap-4">
                                    <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white bg-indigo-600/30 border border-indigo-500/30`}>خ</div>
                                    <div className="flex-grow bg-white/5 p-5 rounded-2xl border border-white/10 shadow-lg">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="font-black text-sm text-slate-200">نظام خطابي</p>
                                            <p className="text-[10px] font-bold text-slate-500">{comment.createdAt}</p>
                                        </div>
                                        <p className="text-base font-medium text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                    </div>
                                </li>
                             ))}</ul> : <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10"><p className="text-slate-500 font-bold">لا توجد ملاحظات على هذه المعاملة بعد.</p></div>}<div className="relative mt-8"><textarea rows={4} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="أضف ملاحظة توجيهية..." className="w-full px-5 py-4 bg-slate-900/60 text-white border border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-base font-medium placeholder-slate-500 shadow-inner" /><div className="mt-3 text-left"><button onClick={handleAddComment} className={`px-8 py-2.5 text-sm font-black text-white rounded-xl shadow-xl transition-all active:scale-95 ${theme.bg}`} disabled={!newComment.trim()}>إرسال الملاحظة</button></div></div></div>
            )}
            {activeTab === 'history' && (
                <div className="max-w-4xl py-6"><ul className="space-y-8 border-r-2 border-slate-700 pr-8 relative">{letter.approvalHistory.map((record, index) => (<li key={index} className="flex items-start gap-6 group"><div className="absolute -right-[0.55rem] top-1 w-4 h-4 rounded-full bg-slate-950 border-2 border-indigo-500 group-hover:scale-125 transition-transform"></div><div className="flex-grow bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-indigo-500/20 transition-all"><p className="font-black text-lg text-slate-200">{record.action}</p><div className="flex items-center gap-4 mt-1"><p className="text-[10px] font-black text-slate-500 flex items-center gap-1"><ClockIcon className="w-3 h-3" />{record.date}</p>{record.userName && <p className="text-[10px] font-black text-indigo-400">بواسطة: {record.userName}</p>}</div>{record.notes && <div className="mt-4 text-sm font-medium text-slate-300 bg-white/5 p-4 rounded-xl border border-white/10 leading-relaxed"><strong className="text-indigo-300">ملاحظات:</strong> {record.notes}</div>}{record.previousBody && <button onClick={() => setDiffData({ old: record.previousBody || '', new: letter.body })} className="text-xs font-black text-indigo-400 hover:text-indigo-300 mt-4 flex items-center gap-1">عرض مقارنة التغييرات ←</button>}</div></li>))}</ul></div>
            )}
        </div>
      </div>
    </>
  );
}
