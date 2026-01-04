
import React, { useState, useEffect, useCallback } from 'react';
import { Letter, LetterStatus, CorrespondenceType, Attachment, PriorityLevel, Tone, View, ConfidentialityLevel } from '../types';
import { toast } from 'react-hot-toast';
import { generateSmartReplies, analyzeLetterBrief } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, sanitizeHTML, getConfidentialityChip } from './utils';
import { ClockIcon, SendIcon, FileTextIcon, SparklesIcon, BotIcon, InfoIcon, ShieldCheckIcon, PrinterIcon, LinkIcon } from './icons';

export default function LetterDetails({ letter }: { letter: Letter }) {
  const { state, dispatch } = useApp();
  const { companySettings: settings } = state;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [smartReplies, setSmartReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  
  const [aiBrief, setAiBrief] = useState<{summary: string, keyPoints: string[]} | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);

  const loadAiContent = useCallback(async () => {
    setLoadingBrief(true);
    setLoadingReplies(true);
    
    // تحليل متن الخطاب لاستخراج الموجز والفقرات الهامة
    analyzeLetterBrief(letter).then(setAiBrief).catch(() => {
        setAiBrief({ summary: "تعذر استخراج الموجز حالياً.", keyPoints: [] });
    }).finally(() => setLoadingBrief(false));
    
    // جلب الردود الذكية إذا كان وارداً
    if (letter.correspondenceType === CorrespondenceType.INBOUND && letter.status !== LetterStatus.REPLIED) {
        generateSmartReplies(letter).then(setSmartReplies).finally(() => setLoadingReplies(false));
    } else { 
        setSmartReplies([]); 
        setLoadingReplies(false);
    }
  }, [letter.id]);

  useEffect(() => {
    setIsEditing(false); 
    setEditedBody(letter.body);
    setAiBrief(null);
    loadAiContent();
  }, [letter.id, loadAiContent]);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, body: sanitizeHTML(editedBody) } });
    setIsEditing(false); 
    toast.success('تم حفظ التعديلات.');
  };

  const onSelectSmartReply = (reply: any) => {
    dispatch({
        type: 'SET_REPLY_CONTEXT',
        payload: {
            letterId: letter.id,
            sender: letter.to,
            recipient: letter.from,
            subject: `رد على: ${letter.subject}`,
            mode: 'reply',
            objective: reply.objective,
            tone: reply.tone as Tone
        }
    });
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded">معاملة نشطة</span>
                {getStatusChip(letter.status)}
            </div>
            <h1 className="text-2xl font-black text-white leading-tight mt-2">{letter.subject}</h1>
        </div>
        <div className="flex gap-2 no-print">
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-slate-300">
                    تعديل المتن
                </button>
            )}
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                <PrinterIcon className="w-4 h-4" /> طباعة
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            
            {/* AI Analysis Card (The Briefing) */}
            <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-50"></div>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><BotIcon className="w-6 h-6" /></div>
                        <h3 className="text-lg font-black text-white">التحليل السياقي للمساعد الذكي</h3>
                    </div>
                    {loadingBrief && <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-b-transparent rounded-full"></div>}
                </div>

                {loadingBrief ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-4 bg-white/5 rounded w-3/4"></div>
                        <div className="h-4 bg-white/5 rounded w-1/2"></div>
                        <div className="h-4 bg-white/5 rounded w-2/3"></div>
                    </div>
                ) : aiBrief ? (
                    <div className="space-y-6">
                        <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">الملخص التنفيذي للمتن</p>
                            <p className="text-sm text-slate-200 leading-relaxed font-bold">{aiBrief.summary}</p>
                        </div>
                        {aiBrief.keyPoints.length > 0 && (
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">نقاط جوهرية تتطلب رداً أو إجراءً:</p>
                                <ul className="space-y-3">
                                    {aiBrief.keyPoints.map((point, i) => (
                                        <li key={i} className="flex items-start gap-3 text-[13px] text-slate-300 font-bold group/item">
                                            <span className="mt-1.5 w-2 h-2 bg-indigo-500 rounded-full shrink-0 group-hover/item:scale-125 transition-transform shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
                                            <span className="leading-relaxed">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 font-bold">انقر على "تحديث" لإعادة تشغيل التحليل التلقائي للمحتوى.</p>
                )}
            </div>

            {/* Document Body */}
            {isEditing ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} minHeight="min-h-[500px]" />
                    <div className="flex justify-end gap-3 p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                        <button onClick={() => setIsEditing(false)} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors">إلغاء</button>
                        <button onClick={handleSave} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold">حفظ التغييرات</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[700px] border border-slate-200 relative">
                    <div className="absolute top-6 left-6 no-print">
                         <span className="text-[10px] bg-slate-100 text-slate-400 font-black px-3 py-1 rounded-full border border-slate-200">الوثيقة الرقمية المعتمدة</span>
                    </div>
                    <div className="p-12 md:p-20">
                        <div className="prose max-w-none prose-slate font-bold text-slate-900 text-lg leading-[2] text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                    </div>
                </div>
            )}
          </div>

          {/* Sidebar: Metadata & Smart Replies */}
          <div className="space-y-6 no-print">
            <div className="glass-card p-6 space-y-6 border-white/5 bg-slate-900/40">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-3">بطاقة بيانات المستند</h3>
                
                <div className="space-y-5">
                    <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 font-black uppercase">أطراف المعاملة</p>
                        <div className="p-3.5 bg-black/30 rounded-2xl space-y-2 border border-white/5">
                            <div>
                                <span className="text-[9px] text-indigo-400 font-black uppercase block">المرسل:</span>
                                <p className="text-[13px] font-bold text-white">{letter.from}</p>
                            </div>
                            <div className="h-px bg-white/5 w-1/2"></div>
                            <div>
                                <span className="text-[9px] text-emerald-400 font-black uppercase block">المستلم:</span>
                                <p className="text-[13px] font-bold text-white">{letter.to}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-black uppercase">تاريخ القيد</p>
                            <p className="text-sm font-mono font-bold text-slate-200">{letter.date}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-black uppercase">درجة الأهمية</p>
                            <div className="scale-90 origin-right">{getPriorityChip(letter.priority || PriorityLevel.NORMAL)}</div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-3">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">المعرفات الرقمية</p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5 group">
                                <span className="text-[10px] text-slate-400 font-bold">رقم القيد الداخلي:</span>
                                <span className="text-[13px] font-mono text-indigo-400 font-black group-hover:scale-110 transition-transform">#{letter.internalRefNumber}</span>
                            </div>
                            {letter.externalRefNumber && (
                                <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                    <span className="text-[10px] text-slate-400 font-bold">رقم الصادر الخارجي:</span>
                                    <span className="text-[12px] font-mono text-slate-200 font-bold">{letter.externalRefNumber}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                <span className="text-[10px] text-slate-400 font-bold">مستوى السرية:</span>
                                <div className="scale-75 origin-left">{getConfidentialityChip(letter.confidentiality || ConfidentialityLevel.NORMAL)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Reply Paths */}
            {letter.correspondenceType === CorrespondenceType.INBOUND && (
                <div className="glass-card p-6 space-y-4 bg-indigo-950/20 border-indigo-500/20 rounded-[2rem] shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 shadow-inner"><SparklesIcon className="w-4 h-4" /></div>
                        <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">مسارات الرد الذكي</h3>
                    </div>
                    {loadingReplies ? (
                        <div className="space-y-3">
                            {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse"></div>)}
                        </div>
                    ) : smartReplies.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {smartReplies.map((r, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onSelectSmartReply(r)}
                                    className="p-4 rounded-2xl bg-white/5 border border-white/5 text-right hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group flex flex-col gap-1 shadow-sm active:scale-95"
                                >
                                    <span className="block text-[9px] font-black text-indigo-400 opacity-60 mb-1 uppercase tracking-widest group-hover:opacity-100">{r.title}</span>
                                    <span className="text-[13px] font-bold text-slate-200 leading-snug line-clamp-2">{r.objective}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 font-black text-center py-4 bg-white/5 rounded-2xl border border-dashed border-white/5">لا توجد مسارات رد مقترحة حالياً.</p>
                    )}
                </div>
            )}
          </div>
      </div>
    </div>
  );
}
