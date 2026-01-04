
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../App';
import { LetterType, Tone, GeneratorState, LetterVariations, SmartReply } from '../types';
import { generateSmartReplies, generateLetterVariations, refineLetterWithChat } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import { SparklesIcon, BotIcon, InboxInIcon, CheckCircleIcon, Undo2Icon, MessageSquareIcon, SendIcon, UserIcon } from './icons';

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
    
    // Chat Refinement States
    const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [userChatInput, setUserChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    useEffect(() => {
        if (isReplyMode && parentLetter) {
            setIsLoadingReplies(true);
            generateSmartReplies(parentLetter).then(r => setSmartReplies(r || [])).finally(() => setIsLoadingReplies(false));
        }
    }, [referenceId, parentLetter]);

    useEffect(() => { if (objective) setObjectiveText(objective); }, [objective]);
    
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

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

    const handleChatRefine = async () => {
        if (!userChatInput.trim() || isLoading) return;
        const instruction = userChatInput;
        setUserChatInput('');
        setChatMessages(prev => [...prev, {role: 'user', text: instruction}]);
        setIsLoading(true);
        try {
            const newBody = await refineLetterWithChat(finalBody, instruction, originalLetterContent || '');
            setFinalBody(newBody);
            setChatMessages(prev => [...prev, {role: 'ai', text: 'تم تحديث المسودة بناءً على طلبك.'}]);
        } catch (e) {
            toast.error("تعذر تحديث النص.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalSave = () => {
        dispatch({ type: 'CREATE_LETTER', payload: { newLetterData: { subject, from: sender, to: receiver, body: finalBody, type: letterType, tone, attachments: [], cc, priority, confidentiality, completionDays: Number(completionDays) || undefined, notes } } });
        toast.success("تم اعتماد وحفظ الخطاب.");
    };

    return (
        <div className="max-w-[1600px] mx-auto pb-10">
            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">مساعد الصياغة الذكي</h2>
                    <p className="text-[11px] text-slate-500 mt-1 font-semibold">{isReplyMode ? `مسار الرد على المعاملة المرجعية: ${parentLetter?.internalRefNumber}` : 'مسار إنشاء معاملة جديدة'}</p>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 transition-all">
                        <Undo2Icon className="w-3.5 h-3.5" /> العودة للخطوة السابقة
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* الجانب الأيمن: سياق الخطاب الوارد */}
                {isReplyMode && parentLetter && (
                    <div className="lg:col-span-3 lg:sticky lg:top-6">
                        <div className="glass-card p-5 border-indigo-500/10 bg-slate-900/40 shadow-xl">
                            <div className="flex items-center gap-2 mb-4 text-indigo-400">
                                <InboxInIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">الخطاب الوارد (المرجع)</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-3">{parentLetter.subject}</h3>
                            <div className="text-[12px] text-slate-400 leading-relaxed max-h-[500px] overflow-y-auto no-scrollbar prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(parentLetter.body) }} />
                        </div>
                    </div>
                )}

                {/* الجانب الأيسر: منطقة العمل التفاعلية */}
                <div className={`${isReplyMode ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
                    
                    {/* الخطوة 0: تحديد الهدف والمسارات */}
                    {step === 0 && (
                        <div className="glass-card p-6 space-y-8 animate-in slide-in-from-bottom-2 border-white/5">
                            <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 px-1">المرسل (من):</label>
                                    <input type="text" value={sender} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{sender:e.target.value}})} className="w-full bg-transparent text-sm font-semibold text-white outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 px-1">المستلم (إلى):</label>
                                    <input type="text" value={receiver} onChange={e => dispatch({type:'UPDATE_GENERATOR_STATE', payload:{receiver:e.target.value}})} className="w-full bg-transparent text-sm font-semibold text-white outline-none" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                    <MessageSquareIcon className="w-4 h-4 text-indigo-400" /> توجيه الصياغة الاستراتيجية
                                </label>
                                
                                {isReplyMode && (
                                    <div className="space-y-3">
                                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            {isLoadingReplies ? <div className="animate-spin h-2.5 w-2.5 border-b border-indigo-400 rounded-full"></div> : <SparklesIcon className="w-3.5 h-3.5" />}
                                            مسارات الرد الذكي المقترحة
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {smartReplies.map((reply, i) => (
                                                <button key={i} onClick={() => { setObjectiveText(reply.objective); dispatch({type:'UPDATE_GENERATOR_STATE', payload:{tone: reply.tone}}); }} className={`p-4 rounded-xl border text-right transition-all group flex flex-col justify-between min-h-[100px] ${objectiveText === reply.objective ? 'bg-indigo-600/10 border-indigo-500 shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>
                                                    <span className="block text-[8px] font-black uppercase mb-2 opacity-60 tracking-wider group-hover:text-indigo-300">{reply.title}</span>
                                                    <span className={`text-[12px] font-semibold leading-snug ${objectiveText === reply.objective ? 'text-indigo-100' : 'text-slate-300'}`}>{reply.objective}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <textarea 
                                    value={objectiveText} onChange={e => setObjectiveText(e.target.value)} rows={4}
                                    className="w-full input-inset p-5 text-sm leading-relaxed border-white/5 focus:border-indigo-500/50 transition-all shadow-inner"
                                    placeholder="اشرح الغرض من الرد أو عدل المسار المختار..."
                                />
                            </div>

                            <button onClick={handleGenerate} disabled={isLoading || !objectiveText.trim()} className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-xl ${isLoading ? 'bg-slate-700 opacity-50' : theme.bg + ' text-white hover:scale-[1.01]'}`}>
                                {isLoading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div> : <SparklesIcon className="w-5 h-5" />}
                                <span>{isLoading ? 'جاري تحليل السياق وصياغة المسودات...' : 'توليد المسودات الذكية'}</span>
                            </button>
                        </div>
                    )}

                    {/* الخطوة 1: اختيار المسودة والدردشة */}
                    {step === 1 && generatedContent && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                             <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl flex items-start gap-4">
                                <BotIcon className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">تحليل المسار الاستراتيجي</p>
                                    <p className="text-xs text-slate-300 font-semibold leading-relaxed">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(v => (
                                    <div key={v} className={`bg-slate-900/60 rounded-2xl border flex flex-col overflow-hidden transition-all group ${finalBody === generatedContent.variations[v] ? 'border-indigo-500 shadow-2xl ring-1 ring-indigo-500/30' : 'border-white/5 hover:border-white/20'}`}>
                                        <div className="p-3.5 bg-white/5 text-center font-bold text-[10px] text-slate-400 uppercase border-b border-white/5 tracking-wider">
                                            {v === 'neutral' ? 'صيغة رسمية معتدلة' : v === 'strict' ? 'صيغة رسمية حازمة' : 'صيغة دبلوماسية مرنة'}
                                        </div>
                                        <div className="p-5 flex-grow text-[13px] text-slate-300 leading-[1.8] font-medium h-[280px] overflow-y-auto custom-scrollbar prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[v]) }} />
                                        <button onClick={() => setFinalBody(generatedContent.variations[v])} className={`m-4 py-2.5 rounded-xl font-bold text-[11px] transition-all ${finalBody === generatedContent.variations[v] ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                                            {finalBody === generatedContent.variations[v] ? 'نسخة محددة' : 'اختيار هذه النسخة'}
                                        </button>
                                    </div>
                                ))}
                             </div>

                             {finalBody && (
                                <div className="glass-card border-indigo-500/20 bg-slate-950/40 p-6 rounded-[2rem] space-y-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="p-2 bg-indigo-500/20 rounded-lg"><MessageSquareIcon className="w-5 h-5 text-indigo-400" /></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">منصة الحوار والتنقيح</h3>
                                            <p className="text-[10px] text-slate-500 font-semibold">تحدث مع الخبير الإداري لتعديل أي جزئية في المسودة المختارة</p>
                                        </div>
                                    </div>

                                    {/* مساحة الدردشة */}
                                    <div className="bg-slate-900/60 rounded-2xl p-5 border border-white/5 h-[350px] flex flex-col">
                                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 px-2">
                                            {chatMessages.length === 0 && (
                                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                                    <BotIcon className="w-10 h-10 mb-2" />
                                                    <p className="text-xs font-semibold">المسودة جاهزة، هل لديك تعليمات إضافية؟</p>
                                                </div>
                                            )}
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[80%] p-3 rounded-2xl text-[12px] font-semibold flex items-start gap-3 ${msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/20' : 'bg-slate-800 text-slate-300 border border-white/5'}`}>
                                                        {msg.role === 'user' ? <UserIcon className="w-4 h-4 mt-0.5" /> : <BotIcon className="w-4 h-4 mt-0.5" />}
                                                        <p className="leading-relaxed">{msg.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div ref={chatEndRef} />
                                        </div>
                                        
                                        <div className="mt-4 flex gap-2">
                                            <input 
                                                type="text" 
                                                value={userChatInput} 
                                                onChange={e => setUserChatInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleChatRefine()}
                                                placeholder="اطلب تعديلاً (مثال: أضف فقرة عن المواعيد النهائية)..."
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                            />
                                            <button 
                                                onClick={handleChatRefine}
                                                disabled={isLoading || !userChatInput.trim()}
                                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-lg"
                                            >
                                                {isLoading ? <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div> : <SendIcon className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <p className="text-[10px] text-slate-500 font-bold">يمكنك المتابعة بمجرد رضاك عن النتيجة الحالية للمسودة.</p>
                                        <button onClick={() => setStep(2)} className="px-12 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/10 transition-all">
                                            الانتقال للتحرير النهائي والاعتماد
                                        </button>
                                    </div>
                                </div>
                             )}
                        </div>
                    )}

                    {/* الخطوة 2: المراجعة النهائية */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-2">
                             <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">المراجعة النهائية والتوزيع</h3>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">النمط: صادر معتمد</span>
                             </div>
                             
                             <div className="shadow-2xl rounded-2xl overflow-hidden border border-white/5">
                                <RichTextEditor value={finalBody} onChange={setFinalBody} ringColor={theme.ring} minHeight="min-h-[550px]" />
                             </div>
                             
                             <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-white/10">
                                <p className="text-xs text-slate-500 font-semibold max-w-lg text-center md:text-right">سيتم حفظ هذا الخطاب في سجل الصادر وربطه بالمعاملة المرجعية المحددة آلياً. تأكد من مراجعة الصياغة بدقة قبل الحفظ.</p>
                                <button onClick={handleFinalSave} className="px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-emerald-600/20 transition-all flex items-center gap-3 active:scale-95">
                                    <CheckCircleIcon className="w-5 h-5" /> اعتماد وحفظ المعاملة
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
