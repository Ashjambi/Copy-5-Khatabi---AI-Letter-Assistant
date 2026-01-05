
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { Letter, LetterType, Tone, PriorityLevel, ConfidentialityLevel, GeneratorState, LetterVariations, SmartReply } from '../types';
import { generateSmartReplies, generateLetterVariations, refineLetterWithChat } from '../services/geminiService';
import { toast } from 'react-hot-toast';
import { getThemeClasses, sanitizeHTML } from './utils';
import RichTextEditor from './RichTextEditor';
import MultiSelectCombobox from './MultiSelectCombobox';
import { SparklesIcon, FileTextIcon, BotIcon, InboxInIcon, CheckCircleIcon, ArrowRightLeftIcon, Undo2Icon, MessageSquareIcon, SendIcon, UserIcon } from './icons';

interface LetterAnalysis {
    strategic_feedback: string[];
}

export default function LetterGenerator() {
    const { state, dispatch } = useApp();
    const { generatorState, learnedPrinciples, companySettings, letters } = state;
    const {
        sender, receiver, subject, cc, priority, confidentiality,
        completionDays, notes, tone, letterType, originalLetterContent, referenceId, objective
    } = generatorState;

    const theme = getThemeClasses(companySettings.primaryColor);
    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);
    const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
    const [generatedContent, setGeneratedContent] = useState<{variations: LetterVariations, analysis: LetterAnalysis} | null>(null);
    const [finalBody, setFinalBody] = useState('');
    const [objectiveText, setObjectiveText] = useState(objective || '');
    const [isContextCollapsed, setIsContextCollapsed] = useState(false);

    // Chat Refinement States
    const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [userChatInput, setUserChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const parentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);
    const isReplyMode = !!referenceId;

    useEffect(() => {
        if (isReplyMode && parentLetter) {
            setIsLoadingReplies(true);
            generateSmartReplies(parentLetter)
                .then(setSmartReplies)
                .catch(() => toast.error("تعذر تحميل الردود المقترحة"))
                .finally(() => setIsLoadingReplies(false));
        }
    }, [referenceId, parentLetter]);

    useEffect(() => { 
        if (objective) setObjectiveText(objective); 
    }, [objective]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const updateState = (payload: Partial<GeneratorState>) => {
        dispatch({ type: 'UPDATE_GENERATOR_STATE', payload });
    };

    const handleGenerate = async () => {
        if (!objectiveText.trim()) {
            toast.error("الرجاء إدخال التوجيهات أو اختيار مسار رد.");
            return;
        }

        setIsLoading(true);
        try {
            const principles = learnedPrinciples.map(p => p.text).join(' - ');
            const result = await generateLetterVariations({
                isReply: isReplyMode,
                originalContent: originalLetterContent,
                objective: objectiveText,
                sender,
                receiver,
                subject,
                principles
            });

            setGeneratedContent(result);
            setStep(1);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "فشلت الصياغة الذكية.");
        } finally {
            setIsLoading(false);
        }
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
            setChatMessages(prev => [...prev, {role: 'ai', text: 'تم تحديث المتن بناءً على ملاحظاتك بنجاح.'}]);
        } catch (e) {
            toast.error("تعذر تحديث النص حالياً.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalSave = () => {
        dispatch({ 
            type: 'CREATE_LETTER', 
            payload: { 
                newLetterData: { 
                    subject, from: sender, to: receiver, body: finalBody, 
                    type: letterType, tone, attachments: [], cc, priority, 
                    confidentiality, completionDays: Number(completionDays) || undefined, notes 
                } 
            } 
        });
        toast.success("تم اعتماد الخطاب وحفظه بنجاح.");
    };

    return (
        <div className="max-w-[1700px] mx-auto pb-12">
            <div className="flex justify-between items-end mb-8 px-2">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">مركز الصياغة والتحليل</h2>
                    <div className="flex items-center gap-3 mt-2">
                         {isReplyMode ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-[11px] font-black border border-emerald-500/20 flex items-center gap-2">
                                <BotIcon className="w-3.5 h-3.5" /> نمط الرد الاستراتيجي
                            </span>
                         ) : (
                            <span className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg text-[11px] font-black border border-indigo-500/20 flex items-center gap-2">
                                <SparklesIcon className="w-3.5 h-3.5" /> نمط الإنشاء الحر
                            </span>
                         )}
                         {isReplyMode && <span className="text-slate-500 text-[11px] font-bold">• المرجع: {parentLetter?.internalRefNumber}</span>}
                    </div>
                </div>
                {step > 0 && (
                    <button onClick={() => setStep(step - 1)} className="btn-3d-secondary px-5 py-2.5 flex items-center gap-2 text-xs font-black hover:scale-105 transition-all">
                        <Undo2Icon className="w-4 h-4" /> العودة للخطوة السابقة
                    </button>
                )}
            </div>

            <div className={`grid grid-cols-1 ${isReplyMode && step < 2 ? 'lg:grid-cols-12' : ''} gap-8 items-start`}>
                
                {/* --- لوحة الخطاب الوارد (المرجع) - تظهر فقط في الخطوات الأولى --- */}
                {isReplyMode && parentLetter && step < 2 && (
                    <div className={`${isContextCollapsed ? 'lg:col-span-1' : 'lg:col-span-4'} transition-all duration-500 lg:sticky lg:top-6`}>
                        <div className="glass-card border-indigo-500/20 bg-slate-950/40 overflow-hidden shadow-2xl rounded-3xl">
                            <div className="p-4 bg-indigo-500/10 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <InboxInIcon className="w-5 h-5 text-indigo-400" />
                                    {!isContextCollapsed && <span className="font-black text-[11px] text-indigo-300 uppercase tracking-widest">الخطاب الوارد المرجعي</span>}
                                </div>
                                <button onClick={() => setIsContextCollapsed(!isContextCollapsed)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                    <ArrowRightLeftIcon className={`w-4 h-4 text-slate-500 ${isContextCollapsed ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            
                            {!isContextCollapsed && (
                                <div className="p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <h3 className="text-lg font-black text-white leading-snug">{parentLetter.subject}</h3>
                                    <div className="text-[13px] text-slate-400 leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(parentLetter.body) }} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- منطقة العمل الرئيسية --- */}
                <div className={`${isReplyMode && step < 2 ? (isContextCollapsed ? 'lg:col-span-11' : 'lg:col-span-8') : 'max-w-5xl mx-auto w-full'} transition-all duration-500`}>
                    
                    {step === 0 && (
                        <div className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-6 duration-700 border-white/10 rounded-3xl shadow-3xl">
                            {/* ... حقول المرسل والمستقبل ... */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/40 p-6 rounded-3xl border border-white/5 shadow-inner">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">المرسل (من)</label>
                                    <input type="text" value={sender} onChange={e => updateState({ sender: e.target.value })} className="w-full bg-transparent border-none text-slate-200 font-bold text-base p-0 focus:ring-0 placeholder-slate-800" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">المستلم (إلى)</label>
                                    <input type="text" value={receiver} onChange={e => updateState({ receiver: e.target.value })} className="w-full bg-transparent border-none text-slate-200 font-bold text-base p-0 focus:ring-0 placeholder-slate-800" />
                                </div>
                                <div className="md:col-span-2 pt-4 border-t border-white/5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">موضوع الخطاب</label>
                                    <input type="text" value={subject} onChange={e => updateState({ subject: e.target.value })} className="w-full bg-transparent border-none text-indigo-400 font-black text-xl p-0 focus:ring-0 mt-1" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <label className="text-sm font-black text-slate-200 flex items-center gap-2">
                                    <MessageSquareIcon className="w-4 h-4 text-indigo-400" />
                                    توجيه الصياغة الاستراتيجية
                                </label>

                                <textarea 
                                    value={objectiveText} 
                                    onChange={e => setObjectiveText(e.target.value)}
                                    rows={5}
                                    className="w-full input-inset p-6 rounded-2xl text-base font-bold border-indigo-500/10 focus:border-indigo-500 shadow-2xl bg-slate-950/20"
                                    placeholder="اشرح غرض الخطاب، وسيقوم النظام بصياغته باحترافية..."
                                />
                                
                                {isReplyMode && (
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                            {isLoadingReplies ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-500"></div> : <SparklesIcon className="w-3 h-3" />}
                                            مسارات الرد السريع المقترحة
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {smartReplies.map((reply, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => { setObjectiveText(reply.objective); updateState({ tone: reply.tone as Tone }); }}
                                                    className={`p-5 rounded-2xl border text-right transition-all group shadow-lg flex flex-col justify-between min-h-[140px] ${objectiveText === reply.objective ? 'bg-indigo-600/20 border-indigo-500' : 'bg-white/5 border-white/5 hover:border-indigo-500/40'}`}
                                                >
                                                    <span className={`block text-[9px] font-black uppercase mb-3 tracking-widest ${objectiveText === reply.objective ? 'text-indigo-400' : 'text-slate-500'}`}>{reply.title}</span>
                                                    <p className={`text-[12px] font-bold leading-relaxed ${objectiveText === reply.objective ? 'text-white' : 'text-slate-300'}`}>{reply.objective}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center pt-4">
                                <button onClick={handleGenerate} disabled={isLoading || !objectiveText.trim()} className={`px-20 py-5 rounded-2xl font-black text-lg flex items-center gap-4 transition-all shadow-[0_20px_60px_rgba(99,102,241,0.2)] active:scale-95 ${isLoading ? 'bg-slate-700 opacity-50' : theme.bg + ' text-white hover:brightness-110'}`}>
                                    {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <SparklesIcon className="w-6 h-6" />}
                                    <span>{isLoading ? 'جاري التحليل...' : 'توليد المسودات الذكية'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && generatedContent && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                             {/* ... تحليل المسار الاستراتيجي والخيارات ... */}
                             <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-3xl flex items-start gap-5 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                                <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 shrink-0"><BotIcon className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">تحليل المسار الاستراتيجي</p>
                                    <p className="text-base text-slate-100 font-bold leading-relaxed">{generatedContent.analysis.strategic_feedback[0]}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {(['neutral', 'strict', 'diplomatic'] as const).map(vKey => (
                                    <div key={vKey} className="bg-slate-900/80 rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col hover:border-indigo-500/50 hover:shadow-2xl transition-all group/card">
                                        <div className="p-5 bg-white/5 border-b border-white/10 text-center font-black text-white text-xs tracking-widest uppercase">
                                            {vKey === 'neutral' ? 'صيغة رسمية معتدلة' : vKey === 'strict' ? 'صيغة رسمية حازمة' : 'صيغة دبلوماسية مرنة'}
                                        </div>
                                        <div className="p-6 flex-grow text-white text-sm leading-relaxed font-bold overflow-y-auto max-h-[400px] custom-scrollbar text-right prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(generatedContent.variations[vKey]) }} />
                                        <div className="p-5 bg-white/5">
                                            <button 
                                                onClick={() => { setFinalBody(generatedContent.variations[vKey]); setStep(2); }}
                                                className={`w-full py-4 rounded-xl font-black text-sm text-white shadow-xl transition-all ${theme.bg}`}
                                            >
                                                اعتماد النسخة للتنقيح النهائي
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-10 duration-700">
                             <div className="flex items-center gap-3 px-2">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">التحرير النهائي والتنقيح بالحوار</h3>
                             </div>

                             {/* منطقة المحرر - تأخذ العرض الكامل */}
                             <div className="shadow-3xl rounded-3xl overflow-hidden border border-white/5">
                                <RichTextEditor value={finalBody} onChange={setFinalBody} ringColor={theme.ring} minHeight="min-h-[500px]" />
                             </div>

                             {/* منصة الحوار - انتقلت للأسفل ومساوية للمحرر في العرض */}
                             <div className="glass-card border-indigo-500/30 bg-slate-950/60 p-6 rounded-[2.5rem] flex flex-col h-[500px] shadow-3xl overflow-hidden">
                                <div className="flex items-center gap-4 border-b border-white/5 pb-5 mb-5">
                                    <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 shadow-inner"><MessageSquareIcon className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="text-base font-black text-white">منصة الحوار والتنقيح الذكي</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">اطلب تعديلات محددة على النص أعلاه</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 px-1 pb-4">
                                    {chatMessages.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-6">
                                            <BotIcon className="w-16 h-16 mb-4" />
                                            <p className="text-sm font-black">المسودة جاهزة للمراجعة. يمكنك طلبتغييرات مثل: "اجعلها أكثر اختصاراً" أو "أضف فقرة حول الميزانية".</p>
                                        </div>
                                    )}
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} animate-in fade-in`}>
                                            <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-[13px] font-bold flex items-start gap-3 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/20 rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-white/5 rounded-tl-none'}`}>
                                                {msg.role === 'user' ? <UserIcon className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400" /> : <BotIcon className="w-5 h-5 shrink-0 mt-0.5 text-slate-500" />}
                                                <p className="leading-relaxed">{msg.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="relative group">
                                        <textarea 
                                            rows={2}
                                            value={userChatInput} 
                                            onChange={e => setUserChatInput(e.target.value)}
                                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatRefine(); } }}
                                            placeholder="اكتب تعليمات التعديل هنا..."
                                            className="w-full bg-slate-900 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner resize-none pr-14"
                                        />
                                        <button 
                                            onClick={handleChatRefine}
                                            disabled={isLoading || !userChatInput.trim()}
                                            className="absolute bottom-3.5 right-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-xl active:scale-90"
                                        >
                                            {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-b-white rounded-full"></div> : <SendIcon className="w-5 h-5 rotate-180" />}
                                        </button>
                                    </div>
                                </div>
                             </div>

                             {/* شريط الإجراءات النهائي - في الأسفل */}
                             <div className="bg-slate-900/40 p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-300">هل اكتملت الصياغة؟</p>
                                    <p className="text-[11px] text-slate-500 font-bold mt-1">سيتم أرشفة المعاملة برقم صادر فريد بمجرد الحفظ.</p>
                                </div>
                                <button onClick={handleFinalSave} className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-2xl shadow-emerald-600/20 transition-all flex items-center gap-3 active:scale-95 group">
                                    <CheckCircleIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /> اعتماد وحفظ المعاملة
                                </button>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
