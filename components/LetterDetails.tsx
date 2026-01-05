
import React, { useState, useEffect, useMemo } from 'react';
import { Letter, LetterStatus, ApprovalRecord, CorrespondenceType, PriorityLevel, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { analyzeLetterBrief, analyzeStrategicPaths, generateSmartReplies } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, sanitizeHTML } from './utils';
import { SendIcon, ArchiveIcon, CheckCircleIcon, FileTextIcon, SparklesIcon, PrinterIcon, BotIcon, LightbulbIcon, BrainCircuitIcon, ShieldAlertIcon, TargetIcon, ScaleIcon } from './icons';

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
  
  // حالات تحميل مستقلة لكل وظيفة ذكاء اصطناعي
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  
  const aiBrief = letter.aiCache?.brief;
  const aiStrategy = letter.aiCache?.strategy;
  const smartReplies = letter.aiCache?.smartReplies;

  // وظيفة 1: توليد الموجز
  const handleBriefAnalysis = async () => {
    setIsLoadingBrief(true);
    try {
        const brief = await analyzeLetterBrief(letter);
        dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, aiCache: { ...letter.aiCache, brief } } });
        toast.success("تم تحديث الموجز التنفيذي");
    } catch (e: any) { toast.error(e.message); } finally { setIsLoadingBrief(false); }
  };

  // وظيفة 2: كشف النوايا والمخاطر
  const handleStrategyAnalysis = async () => {
    setIsLoadingStrategy(true);
    try {
        const strategy = await analyzeStrategicPaths(letter);
        dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, aiCache: { ...letter.aiCache, strategy } } });
        toast.success("اكتمل التحليل الاستراتيجي");
    } catch (e: any) { toast.error(e.message); } finally { setIsLoadingStrategy(false); }
  };

  // وظيفة 3: استكشاف مسارات الرد
  const handleRepliesAnalysis = async () => {
    setIsLoadingReplies(true);
    try {
        const replies = await generateSmartReplies(letter);
        dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, aiCache: { ...letter.aiCache, smartReplies: replies } } });
        toast.success("تم استخلاص مسارات الرد");
    } catch (e: any) { toast.error(e.message); } finally { setIsLoadingReplies(false); }
  };

  const onReply = (letterToReply: Letter, objective?: string, tone?: string) => {
    dispatch({
        type: 'SET_REPLY_CONTEXT', 
        payload: { 
            letterId: letterToReply.id, 
            sender: letterToReply.to, 
            recipient: letterToReply.from, 
            subject: `رد على: ${letterToReply.subject}`, 
            mode: 'reply',
            objective: objective || '',
            tone: (tone as Tone) || Tone.NEUTRAL
        }
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-8 animate-in fade-in duration-500 pb-24 relative">
      
      {/* مركز التحليل الذكي (المهام المفصولة) */}
      <div className="bg-indigo-500/5 border border-indigo-500/10 p-8 rounded-[3rem] relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-40"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner ring-1 ring-white/5">
                      <BrainCircuitIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">مركز الرؤى الاستراتيجية</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">تفعيل أدوات التحليل بشكل منفصل</p>
                  </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                  <button onClick={handleBriefAnalysis} disabled={isLoadingBrief} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingBrief ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <FileTextIcon className="w-3.5 h-3.5" />}
                      {aiBrief ? 'تحديث الموجز' : 'توليد موجز'}
                  </button>
                  <button onClick={handleStrategyAnalysis} disabled={isLoadingStrategy} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingStrategy ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <TargetIcon className="w-3.5 h-3.5" />}
                      {aiStrategy ? 'تحديث التحليل الاستراتيجي' : 'كشف النوايا والمخاطر'}
                  </button>
                  <button onClick={handleRepliesAnalysis} disabled={isLoadingReplies} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black transition-all shadow-xl disabled:opacity-50">
                      {isLoadingReplies ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <SparklesIcon className="w-3.5 h-3.5" />}
                      استكشاف مسارات الرد
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 space-y-6">
                  {aiBrief && (
                      <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-white/5 animate-in slide-in-from-top-4">
                          <div className="flex items-center gap-2 text-indigo-300 mb-3">
                              <LightbulbIcon className="w-5 h-5" />
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
                      </div>
                  )}
              </div>

              <div className="xl:col-span-4">
                  {smartReplies && smartReplies.length > 0 ? (
                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-2">توجيهات الرد المقترحة:</p>
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
                  ) : !isLoadingReplies && (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 border border-dashed border-white/10 rounded-[2rem] p-6">
                          <BotIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-black">لا توجد مسارات رد جاهزة</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* بطاقة المعاملة والنص */}
      <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 border-b border-white/5 pb-6">
              <div>
                  <h3 className="text-xl font-black text-white">بطاقة المعاملة الرسمية</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">البيانات الوصفية وسجل الحالة</p>
              </div>
              <div className="flex items-center gap-3 no-print">
                  <button onClick={() => onReply(letter)} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 group min-w-[140px]">
                    <SendIcon className="w-4 h-4 group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform" />
                    إنشاء رد ذكي
                  </button>
                  <button onClick={() => {
                      const newHistoryRecord: ApprovalRecord = { action: "تمت أرشفة المعاملة", date: new Date().toLocaleDateString('ar-SA-u-nu-latn'), userId: state.currentUser?.id, userName: state.currentUser?.name };
                      dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, status: LetterStatus.ARCHIVED, approvalHistory: [...letter.approvalHistory, newHistoryRecord] } });
                      toast.success("تمت أرشفة المعاملة");
                  }} className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-black transition-all active:scale-95 min-w-[140px]">
                    <ArchiveIcon className="w-4 h-4" />
                    أرشفة المعاملة
                  </button>
              </div>
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

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-black text-slate-100 tracking-tight">نص المعاملة</h3>
            <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-3 hover:bg-white/10 rounded-xl text-slate-400 border border-white/5 transition-colors">
                    <PrinterIcon className="w-6 h-6"/>
                </button>
                {!isEditing && (
                    <button onClick={() => { setEditedBody(letter.body); setIsEditing(true); }} className="text-xs font-black text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-5 py-2.5 rounded-xl border border-indigo-500/20 transition-all">
                        تعديل النص يدوياً
                    </button>
                )}
            </div>
        </div>
        
        {isEditing ? (
            <div className="animate-in fade-in duration-300 space-y-4">
                <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} minHeight="min-h-[600px]" />
                <div className="flex justify-end gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                    <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white">إلغاء</button>
                    <button onClick={() => { dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, body: editedBody } }); setIsEditing(false); toast.success("تم حفظ التعديلات."); }} className={`px-10 py-3 text-sm font-black text-white ${theme.bg} rounded-xl shadow-xl`}>
                        اعتماد وحفظ التعديلات
                    </button>
                </div>
            </div>
        ) : (
            <div className="rounded-[3rem] border border-white/10 bg-white/95 text-black shadow-2xl p-12 lg:p-20 relative overflow-hidden">
                <div className="prose max-w-none font-bold text-slate-900 text-xl leading-relaxed text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
            </div>
        )}
      </div>
    </div>
  );
}
