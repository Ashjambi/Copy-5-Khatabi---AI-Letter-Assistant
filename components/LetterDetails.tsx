
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, Attachment, PriorityLevel, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { analyzeLetterBrief, analyzeStrategicPaths } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, sanitizeHTML } from './utils';
import { InboxInIcon, SendIcon, ArchiveIcon, CheckCircleIcon, FileTextIcon, SparklesIcon, PrinterIcon, BotIcon, LightbulbIcon, BrainCircuitIcon, ShieldAlertIcon, TargetIcon, ScaleIcon } from './icons';
import { FileSystemService } from '../services/fileSystemService';

interface LetterDetailsProps {
  letter: Letter;
}

const DetailItem = ({ label, value, children }: { label: string, value?: string | number, children?: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
        <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">{label}</p>
        {value && <p className="font-bold text-sm text-white break-words">{value}</p>}
        {children && <div className="font-bold text-sm text-white">{children}</div>}
    </div>
);

export default function LetterDetails({ letter }: LetterDetailsProps): React.ReactNode {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings } = state;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  
  // استرجاع البيانات من التخزين المؤقت
  const aiBrief = letter.aiCache?.brief;
  const aiStrategy = letter.aiCache?.strategy;

  const handleFullAnalysis = async () => {
    setIsLoadingAnalysis(true);
    const analysisToast = toast.loading("جاري تحليل النوايا واستخراج النقاط الجوهرية...");
    try {
        const [brief, strategy] = await Promise.all([
            analyzeLetterBrief(letter),
            analyzeStrategicPaths(letter)
        ]);
        
        dispatch({ 
            type: 'UPDATE_LETTER', 
            payload: { 
                ...letter, 
                aiCache: { ...letter.aiCache, brief, strategy } 
            } 
        });
        toast.success("اكتمل التحليل العميق بنجاح.", { id: analysisToast });
    } catch (e: any) { 
        toast.error("فشل التحليل. يرجى المحاولة لاحقاً.", { id: analysisToast }); 
    } finally { 
        setIsLoadingAnalysis(false); 
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
    toast.success(actionText);
  };

  const onReply = (letterToReply: Letter) => {
    dispatch({
        type: 'SET_REPLY_CONTEXT', 
        payload: { 
            letterId: letterToReply.id, 
            sender: letterToReply.to, 
            recipient: letterToReply.from, 
            subject: `رد على: ${letterToReply.subject}`, 
            mode: 'reply'
        }
    });
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
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500 pb-24 relative">
      
      {/* 1. قسم المساعد الذكي المطور - يجمع بين كشف النوايا والنقاط المهمة */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-[3rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-40"></div>
          
          <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner ring-1 ring-white/5">
                      <BrainCircuitIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">رؤى الذكاء الاصطناعي الاستراتيجية</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">القراءة الذكية لما وراء السطور</p>
                  </div>
              </div>
              <button 
                onClick={handleFullAnalysis} 
                disabled={isLoadingAnalysis}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-xl active:scale-95 ${isLoadingAnalysis ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
              >
                {isLoadingAnalysis ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <SparklesIcon className="w-4 h-4" />}
                {aiBrief || aiStrategy ? 'تحديث التحليل العميق' : 'تحليل النوايا والمخاطر'}
              </button>
          </div>

          {!aiBrief && !aiStrategy && !isLoadingAnalysis && (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-black/20">
                <BotIcon className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <p className="text-base font-bold text-slate-500 max-w-md mx-auto">
                    اضغط على "تحليل النوايا" لتفعيل محرك الذكاء الاصطناعي واستكشاف النقاط الجوهرية والمخاطر في هذا الخطاب.
                </p>
            </div>
          )}

          {(aiBrief || aiStrategy) && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in slide-in-from-top-4 duration-700">
                  
                  {/* العمود الأول: كشف النوايا والمخاطر */}
                  <div className="xl:col-span-7 space-y-6">
                      {aiStrategy && (
                        <div className="bg-slate-950/60 p-7 rounded-[2.5rem] border border-white/5 shadow-inner">
                            <div className="flex items-center gap-3 text-indigo-400 mb-6">
                                <TargetIcon className="w-6 h-6" />
                                <span className="text-xs font-black uppercase tracking-widest border-b border-indigo-500/30 pb-1">كشف النوايا (Intent Disclosure)</span>
                            </div>
                            <p className="text-base text-slate-100 font-bold leading-relaxed mb-8">{aiStrategy.sender_intent}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/5 p-5 rounded-3xl border border-white/5 flex items-start gap-4">
                                    <ScaleIcon className="w-6 h-6 text-indigo-400 shrink-0" />
                                    <div>
                                        <span className="block text-[9px] font-black text-slate-500 uppercase mb-1">ميزان القوة</span>
                                        <p className="text-sm text-indigo-200 font-bold leading-tight">{aiStrategy.power_balance}</p>
                                    </div>
                                </div>
                                <div className="bg-rose-500/10 p-5 rounded-3xl border border-rose-500/20 flex items-start gap-4">
                                    <ShieldAlertIcon className="w-6 h-6 text-rose-500 shrink-0" />
                                    <div>
                                        <span className="block text-[9px] font-black text-rose-400 uppercase mb-1">المخاطر المحتملة</span>
                                        <ul className="space-y-1 mt-1">
                                            {aiStrategy.risks?.map((r, i) => (
                                                <li key={i} className="text-[11px] text-rose-100 font-bold flex items-center gap-2">
                                                    <div className="w-1 h-1 bg-rose-500 rounded-full"></div> {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                      )}

                      {aiBrief && (
                        <div className="bg-indigo-600/10 p-7 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden group/brief">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/brief:opacity-10 transition-opacity">
                                <FileTextIcon className="w-20 h-20" />
                            </div>
                            <div className="flex items-center gap-3 text-indigo-300 mb-4">
                                <LightbulbIcon className="w-6 h-6" />
                                <span className="text-xs font-black uppercase tracking-widest">الموجز التنفيذي</span>
                            </div>
                            <p className="text-sm text-indigo-50 font-bold leading-relaxed">{aiBrief.summary}</p>
                        </div>
                      )}
                  </div>

                  {/* العمود الثاني: النقاط الجوهرية (Action Items) */}
                  <div className="xl:col-span-5">
                      <div className="bg-slate-900/80 p-8 rounded-[2.5rem] border border-white/5 h-full shadow-2xl relative">
                          <div className="flex items-center justify-between mb-8">
                              <h4 className="text-sm font-black text-white flex items-center gap-3">
                                  <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                  نقاط تستوجب الرد/المعالجة
                              </h4>
                              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-500/20">
                                  {aiBrief?.keyPoints.length || 0} نقاط
                              </span>
                          </div>
                          <ul className="space-y-5">
                              {aiBrief?.keyPoints.map((point, i) => (
                                  <li key={i} className="flex items-start gap-4 group/point">
                                      <div className="mt-1 w-6 h-6 rounded-xl border-2 border-slate-700 group-hover/point:border-indigo-500 group-hover/point:bg-indigo-500/10 transition-all flex-shrink-0 flex items-center justify-center text-[10px] text-slate-500 group-hover/point:text-indigo-400 font-black">
                                          {i + 1}
                                      </div>
                                      <span className="text-sm text-slate-300 font-bold leading-relaxed group-hover/point:text-white transition-colors">{point}</span>
                                  </li>
                              ))}
                              {(!aiBrief || aiBrief.keyPoints.length === 0) && !isLoadingAnalysis && (
                                  <div className="text-center py-12 opacity-30">
                                      <BotIcon className="w-12 h-12 mx-auto mb-3" />
                                      <p className="text-xs font-black">لا توجد نقاط معالجة مستخرجة.</p>
                                  </div>
                              )}
                          </ul>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* 2. تفاصيل وبطاقة المعاملة - مع شريط الإجراءات السريعة المدمج */}
      <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
              <div>
                  <h3 className="text-xl font-black text-white">بطاقة المعاملة الرسمية</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">البيانات الوصفية وسجل الحالة</p>
              </div>
              
              {/* شريط الإجراءات السريعة - مكان جديد لا يحجب النص */}
              {letter.status !== LetterStatus.ARCHIVED && (
                  <div className="flex items-center gap-3 bg-slate-950/60 p-2 rounded-2xl border border-white/5 shadow-inner no-print">
                      <button 
                        onClick={() => onReply(letter)} 
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 group min-w-[140px]"
                      >
                        <SendIcon className="w-4 h-4 group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform" />
                        إنشاء رد ذكي
                      </button>
                      <button 
                        onClick={() => handleStatusChange(LetterStatus.ARCHIVED, "تمت أرشفة المعاملة")} 
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-black transition-all active:scale-95 min-w-[140px]"
                      >
                        <ArchiveIcon className="w-4 h-4" />
                        أرشفة المعاملة
                      </button>
                  </div>
              )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              <DetailItem label="المرسل" value={letter.from} />
              <DetailItem label={letter.correspondenceType === CorrespondenceType.INBOUND ? "التصنيف" : "إلى"} value={letter.to} />
              <DetailItem label="التاريخ" value={letter.date} />
              <DetailItem label="الرقم المرجعي" value={letter.internalRefNumber || '---'} />
              <DetailItem label="الأهمية" children={getPriorityChip(letter.priority || PriorityLevel.NORMAL)} />
              <DetailItem label="الحالة" children={getStatusChip(letter.status)} />
          </div>
      </div>

      {/* 3. محتوى المعاملة */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                <h3 className="text-2xl font-black text-slate-100 tracking-tight">نص المعاملة</h3>
            </div>
            <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-3 hover:bg-white/10 rounded-xl text-slate-400 transition-colors border border-white/5" title="طباعة المعاملة">
                    <PrinterIcon className="w-6 h-6"/>
                </button>
                {!isEditing && (
                    <button 
                        onClick={() => { setEditedBody(letter.body); setIsEditing(true); }} 
                        className="text-xs font-black text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-5 py-2.5 rounded-xl border border-indigo-500/20 transition-all active:scale-95"
                    >
                        تعديل النص يدوياً
                    </button>
                )}
            </div>
        </div>
        
        {isEditing ? (
            <div className="animate-in fade-in duration-300 space-y-4">
                <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} minHeight="min-h-[600px]" />
                <div className="flex justify-end gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white transition-colors">إلغاء التعديلات</button>
                    <button 
                        onClick={() => { 
                            dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, body: editedBody } }); 
                            setIsEditing(false); 
                            toast.success("تم حفظ التعديلات الجديدة."); 
                        }} 
                        className={`px-10 py-3 text-sm font-black text-white ${theme.bg} rounded-xl shadow-xl hover:brightness-110 active:scale-95 transition-all`}
                    >
                        اعتماد وحفظ النص المعدل
                    </button>
                </div>
            </div>
        ) : (
            <div className="rounded-[3rem] border border-white/10 bg-white/95 text-black shadow-[0_30px_100px_rgba(0,0,0,0.4)] p-12 lg:p-20 relative overflow-hidden group/text">
                <div className="absolute top-8 right-8 text-[10px] text-slate-300 font-black uppercase tracking-widest pointer-events-none opacity-30 group-hover/text:opacity-60 transition-opacity">الخطاب الرسمي المعتمد</div>
                <div className="prose max-w-none font-bold text-slate-900 text-xl leading-relaxed text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                
                {letter.isSigned && (
                    <div className="mt-20 pt-10 border-t-2 border-dashed border-slate-200 flex items-center justify-between opacity-80">
                        <div className="flex items-center gap-4 text-emerald-800 font-black">
                            <div className="p-3 bg-emerald-100 rounded-2xl"><CheckCircleIcon className="w-8 h-8" /></div>
                            <div>
                                <p className="text-lg">تم التوقيع والمصادقة رقمياً</p>
                                <p className="text-xs font-mono text-emerald-600 mt-1 uppercase tracking-widest">ID: {letter.id.substring(0, 12)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* 4. سلسلة المراسلات - تظهر في الأسفل دائماً */}
      {threadLetters && threadLetters.length > 1 && (
        <div className="glass-card border border-white/10 p-8 rounded-[3rem] overflow-hidden bg-slate-950/20 shadow-xl">
             <div className="flex items-center gap-3 mb-10">
                 <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                 <h3 className="text-xl font-black text-white">التسلسل الزمني للمراسلات المرتبطة</h3>
             </div>
             
             <div className="relative space-y-8 pr-6">
                <div className="absolute right-[22px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-500/50 via-emerald-500/50 to-slate-500/50"></div>
                {threadLetters.map((tl) => {
                    const isCurrent = tl.id === letter.id;
                    const isInbound = tl.correspondenceType === CorrespondenceType.INBOUND;
                    return (
                        <div key={tl.id} className="relative flex items-start gap-8 group">
                            <div className={`z-10 w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-xl ${isCurrent ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-indigo-600/30' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}`}>
                                {isInbound ? <InboxInIcon className={`w-6 h-6 ${isCurrent ? 'text-white' : 'text-slate-500'}`} /> : <SendIcon className={`w-6 h-6 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />}
                            </div>
                            <div onClick={() => !isCurrent && dispatch({ type: 'SELECT_LETTER', payload: tl.id })} className={`flex-1 p-6 rounded-3xl border transition-all cursor-pointer ${isCurrent ? 'bg-indigo-500/10 border-indigo-500/40 shadow-2xl ring-1 ring-white/5' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:translate-x-[-8px]'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isInbound ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>{isInbound ? 'وارد من ' + tl.from : 'صادر إلى ' + tl.to}</span>
                                    <div className="flex items-center gap-3"><span className="text-[10px] font-mono text-slate-500 font-bold">{tl.date}</span>{getStatusChip(tl.status)}</div>
                                </div>
                                <p className={`text-base font-black leading-snug ${isCurrent ? 'text-white' : 'text-slate-300'}`}>{tl.subject}</p>
                                {isCurrent && <span className="inline-block mt-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest">المعاملة المفتوحة حالياً</span>}
                            </div>
                        </div>
                    );
                })}
             </div>
        </div>
      )}
    </div>
  );
}
