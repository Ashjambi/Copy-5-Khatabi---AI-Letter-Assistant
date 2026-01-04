
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { Letter, LetterType, Tone, PriorityLevel, ConfidentialityLevel, GeneratorState, LetterVariations, StrategicAnalysis, StrategicPath } from '../types';
import { analyzeStrategicPaths, generateLetterVariations, refineLetterWithChat } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import { SparklesIcon, BotIcon, InboxInIcon, CheckCircleIcon, Undo2Icon, MessageSquareIcon, SendIcon, ShieldCheckIcon, BarChart3Icon, LightbulbIcon } from './icons';

export default function LetterGenerator() {
    const { state, dispatch } = useApp();
    const { generatorState, letters, companySettings } = state;
    const { sender, receiver, subject, cc, priority, confidentiality, completionDays, notes, letterType, originalLetterContent, referenceId, objective } = generatorState;

    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    
    // Strategic States
    const [strategicAnalysis, setStrategicAnalysis] = useState<StrategicAnalysis | null>(null);
    const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

    const [generatedContent, setGeneratedContent] = useState<{variations: LetterVariations, analysis: { strategic_feedback: string[] }} | null>(null);
    const [finalBody, setFinalBody] = useState('');
    const [objectiveText, setObjectiveText] = useState(objective || '');
    
    // Chat Refinement States
    const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [userChatInput, setUserChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    // تفعيل التحليل الاستراتيجي فوراً عند الدخول في نمط الرد
    useEffect(() => {
        if (isReplyMode && parentLetter && !strategicAnalysis && step === 0) {
            setIsLoading(true);
            analyzeStrategicPaths(parentLetter)
                .then(data => {
                    setStrategicAnalysis(data);
                    toast.success("تم الانتهاء من فك شفرة الخطاب الوارد.");
                })
                .catch(() => toast.error("تعذر إجراء التحليل الاستراتيجي حالياً."))
                .finally(() => setIsLoading(false));
        }
    }, [isReplyMode, parentLetter]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

    const handleGenerate = async () => {
        if (!objectiveText.trim()) return toast.error("الرجاء تحديد غرض الخطاب.");
        setIsLoading(true);
        try {
            const selectedPath = strategicAnalysis?.suggested_strategies.find(p => p.id === selectedPathId);
            const result = await generateLetterVariations({
                isReply: isReplyMode,
                originalContent: originalLetterContent,
                objective: objectiveText,
                sender, receiver, subject,
                strategy_logic: selectedPath?.logic
            });
            setGeneratedContent(result);
            setStep(1);
        } catch (e: any) { 
            toast.error(e.message || "فشلت عملية الصياغة.");
        } finally { setIsLoading(false); }
    };

    const handleChatRefine = async () => {
        if (!userChatInput.trim() || isLoading) return;
        const instruction = userChatInput;
        setUserChatInput('');
        setChatMessages(prev => [...prev, {role: 'user', text: instruction}]);
        setIsLoading(true);
        try {
            const context = `الموضوع: ${subject} | الهدف: ${objectiveText}`;
            const newBody = await refineLetterWithChat(finalBody, instruction, context);
            setFinalBody(newBody);
            setChatMessages(prev => [...prev, {role: 'ai', text: 'تم تحديث النص بنجاح.'}]);
        } catch (e) { toast.error("تعذر التحديث بالحوار حالياً."); } finally { setIsLoading(false); }
    };

    const handleFinalSave = () => {
        dispatch({ type: 'CREATE_LETTER', payload: { newLetterData: { subject, from: sender, to: receiver, body: finalBody, type: letterType, tone: Tone.NEUTRAL, attachments: [], cc, priority, confidentiality, completionDays: Number(completionDays) || undefined, notes } } });
        toast.success("تم اعتماد الخطاب وحفظه في الأرشيف.");
    };

    return (
        <div className="max-w-[1700px] mx-auto pb-12">
            <div className="flex justify-between items-end mb-8 px-2">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        {isReplyMode ? <ShieldCheckIcon className="w-8 h-8 text-indigo-400" /> : <SparklesIcon className="w-8 h-8 text-indigo-400" />}
                        {isReplyMode ? "مختبر الاستراتيجيات الإدارية" : "مركز الإنشاء الذكي"}
                    </h2>
                    <p className="text-slate-400 font-bold mt-2">
                        {isReplyMode ? "تحليل النوايا وبناء ردود استراتيجية محكمة" : "صياغة خطابات رسمية عالية الجودة"}
                    </p>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="btn-3d-secondary px-5 py-2.5 flex items-center gap-2 text-xs font-black transition-all">
                        <Undo2Icon className="w-4 h-4" /> العودة للخطوة السابقة
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Side Panel: Strategic Insights */}
                <div className="lg:col-span-4 space-y-6">
                    {isReplyMode && parentLetter && (
                        <div className="glass-card border-indigo-500/20 p-6 rounded-3xl space-y-4 shadow-2xl">
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                <InboxInIcon className="w-4 h-4" /> المعاملة المرجعية
                            </div>
                            <h3 className="text-base font-black text-white leading-snug">{parentLetter.subject}</h3>
                            <div className="text-[11px] text-slate-500 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar opacity-70 prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: parentLetter.body }} />
                        </div>
                    )}

                    {strategicAnalysis && (
                        <div className="bg-indigo-600/5 border border-indigo-500/10 p-6 rounded-3xl space-y-6 animate-in fade-in duration-700 shadow-xl">
                             <div className="space-y-2">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">تحليل النبرة والنوايا</p>
                                <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{strategicAnalysis.sender_vibe}"</p>
                             </div>
                             <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex items-center gap-3">
                                <BarChart3Icon className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase">ميزان القوة</p>
                                    <p className="text-xs font-black text-white">
                                        {strategicAnalysis.power_dynamic === 'superior' ? 'المرسل في مركز قوة' : strategicAnalysis.power_dynamic === 'equal' ? 'ندية إدارية' : 'أفضلية للمستلم'}
                                    </p>
                                </div>
                             </div>
                             <div className="space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">النقاط الحرجة في الخطاب:</p>
                                <ul className="space-y-2">
                                    {strategicAnalysis.critical_points.map((p, i) => (
                                        <li key={i} className="text-[11px] text-slate-400 font-bold flex items-start gap-2">
                                            <span className="mt-1.5 w-1 h-1 bg-indigo-500 rounded-full shrink-0"></span> {p}
                                        </li>
                                    ))}
                                </ul>
                             </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-8">
                    {step === 0 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            {isReplyMode && strategicAnalysis && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <LightbulbIcon className="w-5 h-5 text-amber-400" />
                                        <p className="text-sm font-black text-white">اختر المسار الاستراتيجي للرد:</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {strategicAnalysis.suggested_strategies.map((path) => (
                                            <button 
                                                key={path.id}
                                                onClick={() => { setSelectedPathId(path.id); setObjectiveText(path.suggestedObjective); }}
                                                className={`p-5 rounded-[2.2rem] border text-right transition-all group flex flex-col justify-between min-h-[200px] shadow-2xl ${selectedPathId === path.id ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-900/40 border-white/5 hover:border-indigo-500/30'}`}
                                            >
                                                <div>
                                                    <span className={`text-[10px] font-black uppercase mb-3 block ${selectedPathId === path.id ? 'text-indigo-400' : 'text-slate-500'}`}>{path.title}</span>
                                                    <p className="text-xs font-black text-slate-100 leading-relaxed mb-4">{path.impact}</p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-white/5 text-[9px] font-black text-slate-500 group-hover:text-indigo-300 transition-colors">
                                                    {selectedPathId === path.id ? "المسار مفعل ✓" : "تفعيل المسار ←"}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="glass-card p-8 rounded-[2.5rem] border-white/10 space-y-8 shadow-3xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-6 rounded-3xl border border-white/5">
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
                                        rows={5}
                                        className="w-full input-inset p-6 rounded-3xl text-base font-bold bg-slate-950/40 border-indigo-500/10 focus:border-indigo-500 shadow-inner outline-none transition-all"
                                        placeholder="ما الذي تريد قوله باختصار؟"
                                    />
                                </div>

                                <div className="flex justify-center">
                                    <button 
                                        onClick={handleGenerate} 
                                        disabled={isLoading || !objectiveText.trim()} 
                                        className={`px-20 py-5 rounded-2xl font-black text-lg flex items-center gap-4 transition-all shadow-2xl active:scale-95 ${isLoading ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                    >
                                        {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-b-white rounded-full"></div> : <SparklesIcon className="w-6 h-6" />}
                                        <span>{isLoading ? 'جاري الصياغة...' : 'توليد المسودات الذكية'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && generatedContent && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                             <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl flex items-start gap-4 shadow-2xl">
                                <BotIcon className="w-8 h-8 text-indigo-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">رؤية المحلل الإداري</p>
                                    <p className="text-sm text-slate-100 font-bold leading-relaxed">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(vKey => (
                                    <div key={vKey} className="bg-slate-900/80 rounded-[2.2rem] border border-white/5 overflow-hidden flex flex-col hover:border-indigo-500/50 transition-all shadow-xl hover:-translate-y-1 group">
                                        <div className="p-4 bg-white/5 border-b border-white/10 text-center font-black text-[10px] uppercase text-slate-400 tracking-widest group-hover:text-white transition-colors">
                                            {vKey === 'neutral' ? 'الصيغة المعتدلة' : vKey === 'strict' ? 'الصيغة الحازمة' : 'الصيغة الدبلوماسية'}
                                        </div>
                                        <div className="p-6 flex-grow text-white text-[13px] leading-relaxed font-bold overflow-y-auto max-h-[380px] text-right prose prose-invert prose-sm custom-scrollbar" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[vKey]) }} />
                                        <div className="p-4"><button onClick={() => { setFinalBody(generatedContent.variations[vKey]); setStep(2); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-black text-xs text-white shadow-lg transition-all">اعتماد هذه النسخة</button></div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                             <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                                <div className="xl:col-span-8 space-y-6">
                                    <div className="rounded-[2.5rem] overflow-hidden border border-white/10 shadow-3xl bg-white">
                                        <RichTextEditor value={finalBody} onChange={setFinalBody} minHeight="min-h-[650px]" />
                                    </div>
                                    <div className="flex justify-end gap-4">
                                        <button onClick={handleFinalSave} className="px-16 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black flex items-center gap-3 shadow-xl active:scale-95 transition-all">
                                            <CheckCircleIcon className="w-6 h-6" /> حفظ واعتـماد المعاملة
                                        </button>
                                    </div>
                                </div>

                                <div className="xl:col-span-4 flex flex-col h-[750px] glass-card border-white/5 p-6 rounded-[2.5rem] shadow-2xl">
                                    <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><MessageSquareIcon className="w-5 h-5" /></div>
                                        <h3 className="text-sm font-black text-white">تنقيح ذكي بالحوار</h3>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 px-2 text-right">
                                        {chatMessages.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-4">
                                                <BotIcon className="w-12 h-12 mb-4" />
                                                <p className="text-xs font-bold leading-relaxed">اطلب مني تعديل فقرة أو إضافة نقطة معينة في الخطاب أعلاه وسأقوم بذلك فوراً.</p>
                                            </div>
                                        )}
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold shadow-md ${msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/20' : 'bg-slate-800 text-slate-200 border border-white/5'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                    
                                    <div className="relative mt-auto">
                                        <textarea 
                                            value={userChatInput} 
                                            onChange={e => setUserChatInput(e.target.value)} 
                                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatRefine()} 
                                            placeholder="مثال: اجعل الخاتمة أكثر دبلوماسية..." 
                                            className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white focus:ring-1 focus:ring-indigo-500 resize-none pr-12 shadow-inner outline-none transition-all" 
                                            rows={3} 
                                        />
                                        <button 
                                            onClick={handleChatRefine} 
                                            disabled={isLoading || !userChatInput.trim()} 
                                            className="absolute bottom-4 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50 transition-all hover:bg-indigo-500 active:scale-90"
                                        >
                                            <SendIcon className="w-4 h-4 rotate-180" />
                                        </button>
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
