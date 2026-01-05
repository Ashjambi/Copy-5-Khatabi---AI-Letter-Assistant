
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Letter, Attachment, CompanySettings, PriorityLevel, ConfidentialityLevel, LetterType, InboundLetterFormState, CorrespondenceType, View } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import MultiSelectCombobox from './MultiSelectCombobox';
import { LinkIcon, SparklesIcon, FilePlusIcon, CheckCircleIcon, InboxInIcon, ArrowRightLeftIcon } from './icons';

const InputField = ({ label, value, onChange, placeholder, type = 'text', ringColor, disabled = false, required = false }: {label: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, type?: string, ringColor: string, disabled?: boolean, required?: boolean}) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`block w-full px-4 py-3 bg-slate-950/40 text-white border border-white/5 rounded-2xl shadow-inner placeholder-slate-600 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-bold transition-all disabled:opacity-50`}
      />
    </div>
);

const SelectField = <T extends string>({ label, value, onChange, options, ringColor, disabled=false }: {label: string, value: T, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: object | string[], ringColor: string, disabled?: boolean}) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`block w-full px-4 py-3 bg-slate-950/40 text-white border border-white/5 rounded-2xl shadow-inner focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-bold transition-all disabled:opacity-50 appearance-none`}
      >
        {Array.isArray(options) 
          ? options.map(opt => <option key={opt} value={opt} className="bg-slate-900">{opt}</option>)
          : Object.entries(options).filter(([key]) => isNaN(Number(key))).map(([key, val]) => <option key={key} value={val} className="bg-slate-900">{val}</option>)}
      </select>
    </div>
);

const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

export default function InboundLetterForm(): React.ReactNode {
  const { state, dispatch } = useApp();
  const { companySettings: settings, letters, inboundLetterFormState } = state;

  const {
      subject, from, to, cc, dateReceived, letterType, category, attachments, summary, referenceId,
      externalRefNumber, priority, confidentiality, completionDays, notes
  } = inboundLetterFormState;

  const [isScanning, setIsScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);
  const allRecipients = useMemo(() => [...settings.departments, ...(settings.externalEntities || [])], [settings]);

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const filteredLetters = useMemo(() => {
      if (!searchTerm) return [];
      const lower = searchTerm.toLowerCase();
      return letters.filter(l => 
          l.subject.toLowerCase().includes(lower) || 
          (l.internalRefNumber || '').toLowerCase().includes(lower)
      ).slice(0, 5);
  }, [searchTerm, letters]);

  const selectedParentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const scanToast = toast.loading("جاري تحليل المستند ذكياً (OCR)...");
    
    try {
        const dataUrl = await fileToDataURL(file);
        const base64Data = dataUrl.split(",")[1];
        const mimeType = file.type || "image/jpeg";

        const extractedData = await extractDetailsFromLetterImage(
            base64Data, 
            mimeType, 
            settings.departments, 
            Object.values(LetterType), 
            Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), 
            [], 
            letters.map(l => ({ id: l.id, subject: l.subject, internalRefNumber: l.internalRefNumber, date: l.date }))
        );
        
        const updates: Partial<InboundLetterFormState> = {};
        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if (extractedData.summary) updates.summary = extractedData.summary;
        if (extractedData.referenceId) updates.referenceId = extractedData.referenceId;
        
        // ربط الملف فورياً بالمرفقات لضمان عدم فشل الحفظ
        updateState({ ...updates, attachments: [file, ...attachments] });
        toast.success("تم استخلاص البيانات بنجاح!", { id: scanToast });
    } catch(error: any) {
        toast.error(`فشل المسح: ${error.message}`, { id: scanToast });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) {
        toast.error('يرجى تعبئة الحقول الأساسية (الموضوع، المرسل، القسم) وإرفاق نسخة الخطاب.');
        return;
    }

    const loadingToast = toast.loading("جاري أرشفة المعاملة...");

    try {
        const attachmentPromises = attachments.map(async (file, index) => {
            const url = await fileToDataURL(file);
            return {
                id: `in_att_${Date.now()}_${index}`,
                name: file.name,
                type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other' as any,
                url: url,
                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
            };
        });

        const newAttachments: Attachment[] = await Promise.all(attachmentPromises);

        dispatch({ 
            type: 'REGISTER_INBOUND', 
            payload: { 
                subject, from, to, type: letterType, date: dateReceived, 
                attachments: newAttachments, externalRefNumber, priority, 
                confidentiality, summary, referenceId, cc 
            } as any 
        });
        
        toast.success("تم تسجيل وأرشفة الوارد بنجاح.", { id: loadingToast });
        dispatch({ type: 'RESET_INBOUND_FORM_STATE' });
        dispatch({ type: 'SET_VIEW', payload: View.DASHBOARD });
    } catch (err) {
        toast.error("حدث خطأ أثناء الحفظ. حاول مرة أخرى.", { id: loadingToast });
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <InboxInIcon className="w-8 h-8 text-indigo-400" />
                تسجيل خطاب وارد
            </h2>
            <p className="text-slate-400 font-bold mt-1">نظام الأرشفة الذكي للمراسلات الخارجية</p>
        </div>
        <button 
            type="button" 
            onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} 
            className="text-xs text-rose-400 font-black border border-rose-500/20 px-4 py-2 rounded-xl hover:bg-rose-500/10 transition-all"
        >
            تفريغ النموذج
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* منطقة المسح الضوئي */}
        <div className="lg:col-span-1">
            <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/5 sticky top-6">
                <div className="flex items-center gap-2 mb-6">
                    <SparklesIcon className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-black text-white text-sm uppercase tracking-widest">المسح الذكي OCR</h3>
                </div>
                
                <div 
                    onClick={() => aiScanInputRef.current?.click()}
                    className={`relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-8 text-center transition-all duration-500 ${isScanning ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/5'}`}
                >
                    {isScanning ? (
                        <div className="space-y-4">
                            <div className="animate-spin h-12 w-12 border-4 border-indigo-500/20 border-b-indigo-500 rounded-full mx-auto"></div>
                            <p className="text-indigo-300 font-black text-sm">جاري القراءة...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                <FilePlusIcon className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-white font-black text-lg">ارفع الخطاب هنا</p>
                                <p className="text-slate-500 text-xs mt-2 font-bold leading-relaxed">سيقوم Gemini باستخراج الموضوع والبيانات آلياً</p>
                            </div>
                        </div>
                    )}
                    <input type="file" accept="image/*,application/pdf" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
                </div>

                {summary && (
                    <div className="mt-8 p-5 bg-slate-950/60 rounded-2xl border border-white/5 animate-in fade-in zoom-in-95 duration-500">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">ملخص المحتوى المستخلص:</p>
                        <p className="text-sm text-slate-200 font-bold leading-relaxed">{summary}</p>
                    </div>
                )}
            </div>
        </div>

        {/* نموذج البيانات */}
        <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-8 border-white/5 shadow-3xl">
                
                {/* قسم المعلومات الأساسية */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                        <h3 className="font-black text-white text-sm">المعلومات الأساسية</h3>
                    </div>
                    
                    <InputField label="موضوع المعاملة" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required placeholder="مثال: طلب توريد أجهزة مكتبية" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="الجهة الوارد منها" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required placeholder="اسم المرسل أو المنظمة" />
                        <SelectField label="القسم المستلم" value={to} onChange={(e) => updateState({ to: e.target.value })} options={settings.departments} ringColor={theme.ring} />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5">نسخة إلى (CC)</label>
                        <MultiSelectCombobox
                            options={allRecipients}
                            selectedItems={cc || []}
                            onChange={(newCc) => updateState({ cc: newCc })}
                            placeholder="اختر الإدارات ذات الصلة..."
                            ringColor={theme.ring}
                        />
                    </div>
                </div>

                {/* قسم الأرشفة والربط */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                        <h3 className="font-black text-white text-sm">بيانات الأرشفة والربط</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="تاريخ الخطاب" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
                        <InputField label="رقم الصادر الخارجي" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} ringColor={theme.ring} placeholder="الرقم المسجل على الورقة" />
                    </div>

                    {/* آلية الربط المتطورة */}
                    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5">
                        <label className="block text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <LinkIcon className="w-3.5 h-3.5" />
                            ربط بمعاملة سابقة (إلحاقي)
                        </label>
                        
                        {selectedParentLetter ? (
                            <div className="flex items-center justify-between bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><LinkIcon className="w-4 h-4" /></div>
                                    <div>
                                        <p className="text-sm font-black text-white">{selectedParentLetter.subject}</p>
                                        <p className="text-[10px] text-slate-500 font-bold">رقم: {selectedParentLetter.internalRefNumber}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => updateState({ referenceId: undefined })} className="text-xs font-black text-rose-400 hover:text-rose-300 px-3">إلغاء</button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
                                    placeholder="ابحث بموضوع أو رقم المعاملة الأصلية..."
                                    className="w-full bg-transparent border-b border-white/10 py-2 text-sm font-bold focus:border-indigo-500 focus:outline-none transition-colors"
                                />
                                {isSearchOpen && filteredLetters.length > 0 && (
                                    <div className="absolute z-20 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                        {filteredLetters.map(l => (
                                            <button
                                                key={l.id}
                                                type="button"
                                                onClick={() => { updateState({ referenceId: l.id }); setSearchTerm(''); setIsSearchOpen(false); }}
                                                className="w-full text-right px-4 py-3 hover:bg-indigo-600/20 border-b border-white/5 last:border-0"
                                            >
                                                <p className="text-xs font-black text-white">{l.subject}</p>
                                                <p className="text-[10px] text-slate-500 font-bold">{l.date} | #{l.internalRefNumber}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* قسم التصنيف والأولويات */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                    <SelectField label="نوع المعاملة" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
                    <SelectField label="الأهمية" value={priority} onChange={(e) => updateState({ priority: e.target.value as PriorityLevel })} options={PriorityLevel} ringColor={theme.ring} />
                    <InputField label="أيام الإنجاز" value={completionDays} onChange={(e) => updateState({ completionDays: e.target.value === '' ? '' : parseInt(e.target.value) })} type="number" ringColor={theme.ring} />
                </div>

                {/* المرفقات */}
                <div className="pt-6 border-t border-white/5">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-4">المرفقات الرقمية ({attachments.length})</label>
                    <div className="flex flex-wrap gap-3">
                        {attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 group">
                                <div className="p-2 bg-slate-950/40 rounded-lg text-slate-400 group-hover:text-indigo-400 transition-colors"><CheckCircleIcon className="w-4 h-4" /></div>
                                <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]">{file.name}</span>
                                <button type="button" onClick={() => updateState({ attachments: attachments.filter((_, i) => i !== idx) })} className="text-slate-500 hover:text-rose-500 font-black text-sm px-1">×</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => aiScanInputRef.current?.click()} className="flex items-center gap-2 border border-white/10 hover:border-indigo-500/50 bg-white/5 px-4 py-3 rounded-xl transition-all text-xs font-black text-slate-400 hover:text-white">
                            <FilePlusIcon className="w-4 h-4" />
                            إضافة ملف
                        </button>
                    </div>
                </div>

                {/* زر الحفظ النهائي */}
                <div className="pt-10 flex justify-center">
                    <button 
                        type="submit" 
                        disabled={isScanning} 
                        className={`group relative overflow-hidden px-16 py-5 rounded-[2rem] font-black text-xl transition-all shadow-2xl active:scale-95 ${isScanning ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'}`}
                    >
                        <div className="flex items-center gap-3 relative z-10">
                            <CheckCircleIcon className="w-6 h-6" />
                            <span>حفظ وأرشفة المعاملة</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
}
