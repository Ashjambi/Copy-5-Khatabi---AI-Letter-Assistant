
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { LetterType, Tone, GeneratorState, LetterVariations, SmartReply } from '../types';
import { generateSmartReplies, generateLetterVariations } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import MultiSelectCombobox from './MultiSelectCombobox';
import { SparklesIcon, BotIcon, InboxInIcon, CheckCircleIcon, Undo2Icon, MessageSquareIcon } from './icons';

export default function LetterGenerator() {
    const { state, dispatch } = useApp();
    const { generatorState, learnedPrinciples, companySettings, letters } = state;
    const { sender, receiver, subject, cc, priority, confidentiality, completionDays, notes, tone, letterType, originalLetterContent, referenceId, objective } = generatorState;

    const theme = getThemeClasses(companySettings.primaryColor);
    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);
    const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
    const [generatedContent, setGeneratedContent] = useState<any>(null);
    const [finalBody, setFinalBody] = useState('');
    const [objectiveText, setObjectiveText] = useState(objective || '');

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    useEffect(() => {
        if (isReplyMode && parentLetter) {
            setIsLoadingReplies(true);
            generateSmartReplies(parentLetter).then(r => setSmartReplies(r || [])).finally(() => setIsLoadingReplies(false));
        }
    }, [referenceId, parentLetter]);

    useEffect(() => { if (objective) setObjectiveText(objective); }, [objective]);

    const handleGenerate = async () => {
        if (!objectiveText.trim()) { toast.error("الرجاء إدخال توجيهات الصياغة."); return; }
        setIsLoading(true);
        try {
            const result = await generateLetterVariations({
                isReply: isReplyMode, originalContent: originalLetterContent, objective: objectiveText, sender, receiver, subject,
                principles: learnedPrinciples.map(p => p.text).join(' | ')
            });
            setGeneratedContent(result);
            setStep(1);
        } catch (e: any) { toast.error("فشلت عملية الصياغة الذكية."); } finally { setIsLoading(false); }
    };

    const handleFinalSave = () => {
        dispatch({ type: 'CREATE_LETTER', payload: { newLetterData: { subject, from: sender, to: receiver, body: finalBody, type: letterType, tone, attachments: [], cc, priority, confidentiality, completionDays: Number(completionDays) || undefined, notes } } });
        toast.success("تم اعتماد وحفظ الخطاب.");
    };

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">مساعد الصياغة الذكي</h2>
                    <p className="text-xs text-slate-400 mt-1">{isReplyMode ? `نمط الرد على: ${parentLetter?.internalRefNumber}` : 'إنشاء خطاب جديد من الصفر'}</p>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-2">
                        <Undo2Icon className="w-3 h-3" /> رجوع
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {isReplyMode && parentLetter && (
                    <div className="lg:col-span-4">
                        <div className="glass-card p-5 border-indigo-500/10 bg-slate-900/40">
                            <div className="flex items-center gap-2 mb-4 text-indigo-400">
                                <InboxInIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">الخطاب المرجعي</span>
                            </div>
                            <h3 className="text-sm font-bold text-white mb-3">{parentLetter.subject}</h3>
                            <div className="text-[12px] text-slate-400 leading-relaxed bg-black/20 p-4 rounded-lg max-h-[300px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: sanitizeHTML(parentLetter.body) }} />
                        </div>
                    </div>
                )}

                <div className={`${isReplyMode ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
                    {step === 0 && (
                        <div className="glass-card p-6 space-y-6 animate-in slide-in-from-bottom-2">
                            <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-white/5">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">من:</label>
                                    <input type="text" value={sender} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{sender:e.target.value}})} className="w-full bg-transparent text-sm font-semibold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">إلى:</label>
                                    <input type="text" value={receiver} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{receiver:e.target.value}})} className="w-full bg-transparent text-sm font-semibold outline-none" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                    <MessageSquareIcon className="w-4 h-4 text-indigo-400" /> توجيهات الصياغة (أهداف الرد)
                                </label>
                                <textarea 
                                    value={objectiveText} onChange={e => setObjectiveText(e.target.value)} rows={4}
                                    className="w-full input-inset p-4 text-sm leading-relaxed"
                                    placeholder="ما الذي تريد تحقيقه في هذا الخطاب؟"
                                />
                                
                                {isReplyMode && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            {isLoadingReplies ? <div className="animate-spin h-2 w-2 border-b border-indigo-400 rounded-full"></div> : <SparklesIcon className="w-3 h-3" />}
                                            مسارات استراتيجية مقترحة
                                        </p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {smartReplies.map((reply, i) => (
                                                <button key={i} onClick={() => { setObjectiveText(reply.objective); dispatch({type:'UPDATE_GENERATOR_STATE', payload:{tone: reply.tone}}); }} className={`p-3 rounded-lg border text-right transition-all text-xs font-semibold ${objectiveText === reply.objective ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>
                                                    <span className="block text-[8px] opacity-60 mb-1">{reply.title}</span>
                                                    {reply.objective}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleGenerate} disabled={isLoading || !objectiveText.trim()} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all ${isLoading ? 'bg-slate-700 opacity-50' : theme.bg + ' text-white hover:shadow-lg'}`}>
                                {isLoading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div> : <SparklesIcon className="w-4 h-4" />}
                                <span>{isLoading ? 'جاري التحليل والصياغة...' : 'توليد المسودات الذكية'}</span>
                            </button>
                        </div>
                    )}

                    {step === 1 && generatedContent && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                             <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-4">
                                <BotIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">توصية النظام</p>
                                    <p className="text-xs text-slate-200 font-semibold leading-relaxed">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(v => (
                                    <div key={v} className="bg-slate-900/60 rounded-xl border border-white/5 flex flex-col overflow-hidden hover:border-indigo-500/30 transition-all">
                                        <div className="p-3 bg-white/5 text-center font-bold text-[10px] text-slate-400 uppercase border-b border-white/5">
                                            {v === 'neutral' ? 'رسمي معتدل' : v === 'strict' ? 'رسمي حازم' : 'دبلوماسي مرن'}
                                        </div>
                                        <div className="p-4 flex-grow text-[12px] text-slate-300 leading-relaxed font-medium h-[250px] overflow-y-auto no-scrollbar" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[v]) }} />
                                        <button onClick={() => { setFinalBody(generatedContent.variations[v]); setStep(2); }} className={`m-3 py-2 rounded-lg font-bold text-[11px] text-white ${theme.bg}`}>اختيار هذه النسخة</button>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-2">
                             <div className="flex items-center gap-2 px-1">
                                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                <h3 className="text-sm font-bold text-white uppercase">المراجعة النهائية والاعتماد</h3>
                             </div>
                             <RichTextEditor value={finalBody} onChange={setFinalBody} ringColor={theme.ring} minHeight="min-h-[500px]" />
                             <div className="flex justify-end pt-4">
                                <button onClick={handleFinalSave} className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2">
                                    <CheckCircleIcon className="w-4 h-4" /> اعتماد وحفظ المعاملة
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
