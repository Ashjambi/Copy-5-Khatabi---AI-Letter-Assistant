
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Letter, LetterStatus, CorrespondenceType, Attachment, PriorityLevel, Tone } from '../types';
import { toast } from 'react-hot-toast';
import { summarizeCorrespondenceThread, enhanceLetter, generateSmartReplies } from '../services/geminiService';
import RichTextEditor from './RichTextEditor';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip, getPriorityChip, sanitizeHTML } from './utils';
import { ClockIcon, SendIcon, FileTextIcon, SparklesIcon } from './icons';

export default function LetterDetails({ letter }: { letter: Letter }) {
  const { state, dispatch } = useApp();
  const { letters: allLetters, companySettings: settings } = state;
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(letter.body);
  const [activeTab, setActiveTab] = useState<'content' | 'history'>('content');
  const [smartReplies, setSmartReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);

  useEffect(() => {
    setIsEditing(false); setEditedBody(letter.body);
    if (letter.correspondenceType === CorrespondenceType.INBOUND && letter.status !== LetterStatus.REPLIED) {
        setLoadingReplies(true);
        generateSmartReplies(letter).then(setSmartReplies).finally(() => setLoadingReplies(false));
    } else { setSmartReplies([]); }
  }, [letter.id]);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_LETTER', payload: { ...letter, body: sanitizeHTML(editedBody) } });
    setIsEditing(false); toast.success('تم الحفظ.');
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/5 pb-6">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">موضوع المعاملة</span>
                {getStatusChip(letter.status)}
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">{letter.subject}</h1>
        </div>
        <div className="flex gap-2">
            {!isEditing && <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-all">تعديل المحتوى</button>}
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-all">طباعة المستند</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-6">
            {isEditing ? (
                <div className="space-y-4">
                    <RichTextEditor value={editedBody} onChange={setEditedBody} ringColor={theme.ring} minHeight="min-h-[400px]" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-xs font-bold text-slate-400">إلغاء</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">حفظ التغييرات</button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-xl overflow-hidden min-h-[500px] border border-slate-200">
                    <div className="p-10 md:p-14">
                        <div className="prose max-w-none prose-slate font-medium text-slate-700 text-base leading-[1.8]" dangerouslySetInnerHTML={{ __html: sanitizeHTML(letter.body) }} />
                    </div>
                </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="glass-card p-5 space-y-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">بيانات المستند</h3>
                <div className="space-y-3">
                    <div><p className="text-[9px] text-slate-500 font-bold uppercase">المرسل:</p><p className="text-sm font-semibold text-white">{letter.from}</p></div>
                    <div><p className="text-[9px] text-slate-500 font-bold uppercase">المستلم:</p><p className="text-sm font-semibold text-white">{letter.to}</p></div>
                    <div><p className="text-[9px] text-slate-500 font-bold uppercase">التاريخ:</p><p className="text-sm font-mono text-white">{letter.date}</p></div>
                    <div><p className="text-[9px] text-slate-500 font-bold uppercase">الرقم المرجعي:</p><p className="text-sm font-mono text-indigo-400 font-bold">{letter.internalRefNumber}</p></div>
                </div>
            </div>

            {smartReplies.length > 0 && (
                <div className="glass-card p-5 space-y-3 bg-indigo-950/20 border-indigo-500/20">
                    <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3" /> مسارات الرد الذكي
                    </h3>
                    <div className="flex flex-col gap-2">
                        {smartReplies.map((r, i) => (
                            <button key={i} className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-right hover:border-indigo-500/30 transition-all">
                                <span className="block text-[8px] font-bold text-indigo-300 opacity-70 mb-0.5">{r.title}</span>
                                <span className="text-[11px] font-semibold text-slate-200 line-clamp-2 leading-snug">{r.objective}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
      </div>
    </div>
  );
}
