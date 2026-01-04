
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { Letter, LetterType, Tone, PriorityLevel, ConfidentialityLevel, GeneratorState, LetterVariations } from '../types';
import { analyzeStrategicPaths, generateLetterVariations, refineLetterWithChat } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import { SparklesIcon, BotIcon, InboxInIcon, CheckCircleIcon, Undo2Icon, MessageSquareIcon, SendIcon, UserIcon, ShieldCheckIcon, BarChart3Icon } from './icons';

export default function LetterGenerator() {
    const { state, dispatch } = useApp();
    const { generatorState, learnedPrinciples, companySettings, letters } = state;
    const { sender, receiver, subject, cc, priority, confidentiality, completionDays, notes, letterType, originalLetterContent, referenceId, objective } = generatorState;

    const theme = getThemeClasses(companySettings.primaryColor);
    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    
    // Strategic Canvas States
    const [strategicData, setStrategicData] = useState<{
        situation_analysis: string;
        power_balance: string;
        strategies: { id: string, title: string, impact: string, logic: string, suggested_objective: string }[]
    } | null>(null);
    const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

    const [generatedContent, setGeneratedContent] = useState<{variations: LetterVariations, analysis: { strategic_feedback: string[] }} | null>(null);
    const [finalBody, setFinalBody] = useState('');
    const [objectiveText, setObjectiveText] = useState(objective || '');
    
    // Chat States
    const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [userChatInput, setUserChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    // Load Strategic Analysis on Start (Reply Mode)
    useEffect(() => {
        if (isReplyMode && parentLetter && !strategicData) {
            setIsLoading(true);
            analyzeStrategicPaths(parentLetter)
                .then(setStrategicData)
                .catch(e => toast.error(e.message))
                .finally(() => setIsLoading(false));
        }
    }, [isReplyMode, parentLetter]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

    const handleGenerate = async () => {
        if (!objectiveText.trim()) return toast.error("الرجاء إدخال توجيهات الصياغة.");
        setIsLoading(true);
        try {
            const selectedStrategy = strategicData?.strategies.find(s => s.id === selectedStrategyId);
            const result = await generateLetterVariations({
                isReply: isReplyMode,
                originalContent: originalLetterContent,
                objective: objectiveText,
                sender, receiver, subject,
                strategy_logic: selectedStrategy?.logic
            });
            setGeneratedContent(result);
            setStep(1);
        } catch (e: any) { toast.error(e.message); } finally { setIsLoading(false); }
    };

    const handleChatRefine = async () => {
        if (!userChatInput.trim() || isLoading) return;
        const instruction = userChatInput;
        setUserChatInput('');
        setChatMessages(prev => [...prev, {role: 'user', text: instruction}]);
        setIsLoading(true);
        try {
            const context = `الموضوع: ${subject} | المرجع: ${originalLetterContent}`;
            const newBody = await refineLetterWithChat(finalBody, instruction, context);
            setFinalBody(newBody);
            setChatMessages(prev => [...prev, {role: 'ai', text: 'تم تحديث المتن بناءً على ملاحظاتك.'}]);
        } catch (e) { toast.error("فشل التعديل."); } finally { setIsLoading(false); }
    };

    const handleFinalSave = () => {
        dispatch({ type: 'CREATE_LETTER', payload: { newLetterData: { subject, from: sender, to: receiver, body: finalBody, type: letterType, tone: Tone.NEUTRAL, attachments: [], cc, priority, confidentiality, completionDays: Number(completionDays) || undefined, notes } } });
        toast.success("تم الحفظ.");
    };

    return (
        <div className="max-w-[1700px] mx-auto pb-12">
            <div className="flex justify-between items-end mb-8 px-2">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">مختبر الاستراتيجيات والردود</h2>
                    <p className="text-slate-400 font-bold mt-2 flex items-center gap-2">
                        {isReplyMode ? <><ShieldCheckIcon className="w-5 h-5 text-emerald-400"/> نظام تحليل الردود الاستراتيجية نشط</> : "إنشاء خطاب جديد بمعايير احترافية"}
                    </p>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="btn-3d-secondary px-5 py-2.5 flex items-center gap-2 text-xs font-black">
                        <Undo2Icon className="w-4 h-4" /> العودة للتخطيط
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Side Panel: Context & Analysis */}
                <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-6">
                    {isReplyMode && parentLetter && (
                        <div className="glass-card border-white/5 bg-slate-950/40 p-6 rounded-3xl space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                <InboxInIcon className="w-4 h-4" /> الخطاب الوارد الأصلي
                            </div>
                            <h3 className="text-base font-black text-white">{parentLetter.subject}</h3>
                            <div className="text-xs text-slate-400 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar opacity-60" dangerouslySetInnerHTML={{ __html: parentLetter.body }} />
                        </div>
                    )}

                    {strategicData && (
                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-3xl space-y-6 animate-in fade-in duration-500">
                             <div className="space-y-1">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">تحليل الموقف الذكي</p>
                                <p className="text-sm font-bold text-slate-200 leading-relaxed">{strategicData.situation_analysis}</p>
                             </div>
                             <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center gap-3">
                                <BarChart3Icon className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase">ميزان القوة</p>
                                    <p className="text-xs font-black text-white">{strategicData.power_balance}</p>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="lg:col-span-8">
                    {step === 0 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            {isReplyMode && strategicData && (
                                <div className="space-y-4">
                                    <p className="text-sm font-black text-white px-2">اختر مسار الرد الاستراتيجي:</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {strategicData.strategies.map((s) => (
                                            <button 
                                                key={s.id}
                                                onClick={() => { setSelectedStrategyId(s.id); setObjectiveText(s.suggested_objective); }}
                                                className={`p-5 rounded-[2rem] border text-right transition-all group flex flex-col justify-between min-h-[180px] shadow-2xl ${selectedStrategyId === s.id ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-900/40 border-white/5 hover:border-indigo-500/30'}`}
                                            >
                                                <div>
                                                    <span className={`text-[10px] font-black uppercase mb-2 block ${selectedStrategyId === s.id ? 'text-indigo-400' : 'text-slate-500'}`}>{s.title}</span>
                                                    <p className="text-xs font-bold text-slate-200 leading-relaxed">{s.impact}</p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-white/5 text-[9px] font-black text-slate-500 group-hover:text-indigo-300">
                                                    {selectedStrategyId === s.id ? "تم تفعيل المسار ✓" : "استخدام هذا المسار ←"}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="glass-card p-8 rounded-[2.5rem] border-white/10 space-y-6 shadow-3xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-6 rounded-3xl">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">من (المرسل)</label>
                                        <input type="text" value={sender} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{sender:e.target.value}})} className="w-full bg-transparent border-none text-white font-bold p-0 focus:ring-0" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إلى (المستلم)</label>
                                        <input type="text" value={receiver} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{receiver:e.target.value}})} className="w-full bg-transparent border-none text-white font-bold p-0 focus:ring-0" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-black text-white flex items-center gap-2">
                                        <MessageSquareIcon className="w-5 h-5 text-indigo-400" /> توجيهات الصياغة النهائية
                                    </label>
                                    <textarea 
                                        value={objectiveText} 
                                        onChange={e => setObjectiveText(e.target.value)}
                                        rows={4}
                                        className="w-full input-inset p-6 rounded-3xl text-base font-bold bg-slate-950/40 border-indigo-500/10 focus:border-indigo-500 shadow-inner"
                                        placeholder="ماذا تريد أن تقول في هذا الخطاب؟..."
                                    />
                                </div>

                                <div className="flex justify-center pt-4">
                                    <button onClick={handleGenerate} disabled={isLoading} className={`px-16 py-5 rounded-2xl font-black text-lg flex items-center gap-4 transition-all shadow-2xl active:scale-95 ${isLoading ? 'bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                                        {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-b-white rounded-full"></div> : <SparklesIcon className="w-6 h-6" />}
                                        <span>{isLoading ? 'جاري التحليل والصياغة...' : 'توليد المسودات الذكية'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && generatedContent && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                             <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl flex items-start gap-4">
                                <BotIcon className="w-8 h-8 text-indigo-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">ملاحظة الخبير الإداري</p>
                                    <p className="text-sm text-slate-100 font-bold">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(vKey => (
                                    <div key={vKey} className="bg-slate-900/80 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col hover:border-indigo-500/50 transition-all">
                                        <div className="p-4 bg-white/5 border-b border-white/10 text-center font-black text-[10px] uppercase text-slate-400">
                                            {vKey === 'neutral' ? 'صيغة متزنة' : vKey === 'strict' ? 'صيغة حازمة' : 'صيغة مرنة'}
                                        </div>
                                        <div className="p-6 flex-grow text-white text-[13px] leading-relaxed font-bold overflow-y-auto max-h-[300px] text-right prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[vKey]) }} />
                                        <div className="p-4"><button onClick={() => { setFinalBody(generatedContent.variations[vKey]); setStep(2); }} className="w-full py-3 bg-indigo-600 rounded-xl font-black text-xs text-white">اعتماد هذه النسخة</button></div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                             <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                                <div className="xl:col-span-8 space-y-6">
                                    <div className="rounded-[2rem] overflow-hidden border border-white/5 shadow-3xl">
                                        <RichTextEditor value={finalBody} onChange={setFinalBody} minHeight="min-h-[600px]" />
                                    </div>
                                    <div className="flex justify-end gap-4">
                                        <button onClick={handleFinalSave} className="px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black flex items-center gap-3 shadow-xl active:scale-95">
                                            <CheckCircleIcon className="w-6 h-6" /> اعتماد وحفظ الخطاب
                                        </button>
                                    </div>
                                </div>

                                <div className="xl:col-span-4 flex flex-col h-[700px] glass-card border-white/5 p-6 rounded-[2rem]">
                                    <h3 className="text-sm font-black text-white mb-6 flex items-center gap-2"><MessageSquareIcon className="w-5 h-5 text-indigo-400" /> تنقيح النسخة بالحوار</h3>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4">
                                        {chatMessages.length === 0 && <p className="text-xs text-slate-500 text-center mt-20 font-bold opacity-40">أخبر المساعد بأي تعديلات ترغب بها لترقية النص آلياً...</p>}
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold ${msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-100' : 'bg-slate-800 text-slate-200'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <div className="relative">
                                        <textarea value={userChatInput} onChange={e => setUserChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatRefine()} placeholder="اكتب تعليماتك هنا..." className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white focus:ring-1 focus:ring-indigo-500 resize-none pr-12 shadow-inner" rows={3} />
                                        <button onClick={handleChatRefine} disabled={isLoading || !userChatInput.trim()} className="absolute bottom-4 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50 transition-all"><SendIcon className="w-4 h-4 rotate-180" /></button>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
