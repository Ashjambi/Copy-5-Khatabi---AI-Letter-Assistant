
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Letter, LetterStatus, CorrespondenceType, Attachment, PriorityLevel, Tone, View } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies, analyzeLetterBrief } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, sanitizeHTML, getConfidentialityChip } from './utils';
import { ClockIcon, SendIcon, FileTextIcon, SparklesIcon, BotIcon, InfoIcon, ShieldCheckIcon } from './icons';

export default function LetterDetails({ letter }: { letter: Letter }) {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings } = state;
  
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
    
    // جلب الموجز والتحليل
    analyzeLetterBrief(letter).then(setAiBrief).finally(() => setLoadingBrief(false));
    
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
    toast.success('تم الحفظ.');
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
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/5 pb-6">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">موضوع المعاملة النشطة</span>
                {getStatusChip(letter.status)}
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">{letter.subject}</h1>
        </div>
        <div className="flex gap-2">
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all">
                    تعديل المحتوى
                </button>
            )}
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all">
                طباعة المستند
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-6">
            
            {/* بطاقة التحليل الذكي (Briefing) */}
            <div className="glass-card bg-indigo-500/5 border-indigo-500/10 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <BotIcon className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-indigo-100">تحليل المساعد الذكي للمحتوى</h3>
                </div>
                {loadingBrief ? (
                    <div className="flex items-center gap-3 py-4 animate-pulse">
                        <div className="h-2 w-2 bg-indigo-400 rounded-full"></div>
                        <div className="text-xs text-slate-500 font-bold">جاري استخلاص النقاط الجوهرية...</div>
                    </div>
                ) : aiBrief ? (
                    <div className="space-y-4">
                        <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">الملخص التنفيذي</p>
                            <p className="text-xs text-slate-300 leading-relaxed font-semibold">{aiBrief.summary}</p>
                        </div>
                        {aiBrief.keyPoints.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-1">نقاط تستوجب المعالجة:</p>
                                <ul className="space-y-2">
                                    {aiBrief.keyPoints.map((point, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[12px] text-slate-300 font-medium">
                                            <span className="mt-1 w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0"></span>
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 font-bold">انقر على "تحديث" لإعادة تحليل متن الخطاب.</p>
                )}
            </div>

            {/* عرض المستند */}
            {isEditing ? (
                <div className="space-y-4">
                    <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} minHeight="min-h-[400px]" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-xs font-bold text-slate-400">إلغاء</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">حفظ التغييرات</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xl overflow-hidden min-h-[600px] border border-slate-200 relative group/doc">
                    <div className="absolute top-4 left-4 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                         <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded">معاينة المستند الرسمي</span>
                    </div>
                    <div className="p-10 md:p-16">
                        <div className="prose max-w-none prose-slate font-medium text-slate-800 text-base leading-[1.8] text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                    </div>
                </div>
            )}
          </div>

          {/* الجانب الأيسر: البيانات والردود */}
          <div className="space-y-6">
            <div className="glass-card p-5 space-y-4 border-white/5 bg-slate-900/40">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">تفاصيل المعاملة</h3>
                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">الأطراف</p>
                        <div className="p-2.5 bg-black/20 rounded-lg space-y-1">
                            <p className="text-xs font-semibold text-indigo-300">من: {letter.from}</p>
                            <p className="text-xs font-semibold text-white">إلى: {letter.to}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">التاريخ</p>
                            <p className="text-[12px] font-mono text-white">{letter.date}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">درجة الأهمية</p>
                            <div className="scale-75 origin-right">{getPriorityChip(letter.priority)}</div>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">المعرفات الرقمية</p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                <span className="text-[10px] text-slate-400 font-bold">قيد داخلي:</span>
                                <span className="text-xs font-mono text-emerald-400 font-bold">{letter.internalRefNumber}</span>
                            </div>
                            {letter.externalRefNumber && (
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <span className="text-[10px] text-slate-400 font-bold">صادر خارجي:</span>
                                    <span className="text-xs font-mono text-slate-200">{letter.externalRefNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* مسارات الرد الذكي */}
            {letter.correspondenceType === CorrespondenceType.INBOUND && (
                <div className="glass-card p-5 space-y-3 bg-indigo-950/20 border-indigo-500/20">
                    <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3" /> مسارات الرد الذكي
                    </h3>
                    {loadingReplies ? (
                        <div className="space-y-2">
                            {[1,2].map(i => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse"></div>)}
                        </div>
                    ) : smartReplies.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {smartReplies.map((r, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onSelectSmartReply(r)}
                                    className="p-3 rounded-xl bg-white/5 border border-white/5 text-right hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                                >
                                    <span className="block text-[9px] font-bold text-indigo-400 opacity-80 mb-1 uppercase group-hover:opacity-100">{r.title}</span>
                                    <span className="text-[12px] font-semibold text-slate-200 line-clamp-2 leading-snug">{r.objective}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-500 font-bold text-center py-2">لا توجد اقتراحات رد لهذه المعاملة.</p>
                    )}
                </div>
            )}
          </div>
      </div>
    </div>
  );
}
