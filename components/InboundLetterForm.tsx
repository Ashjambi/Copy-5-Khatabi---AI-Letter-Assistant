
import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { LetterType, PriorityLevel, ConfidentialityLevel, InboundLetterFormState } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import MultiSelectCombobox from './MultiSelectCombobox';
import { ScanTextIcon, CheckCircleIcon, SparklesIcon } from './icons';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide">{children}</label>;

export default function InboundLetterForm() {
  const { state, dispatch } = useApp();
  const { companySettings: settings, letters, inboundLetterFormState } = state;
  const { subject, from, to, cc, dateReceived, letterType, category, attachments, summary, externalRefNumber, priority, confidentiality, completionDays } = inboundLetterFormState;

  const [isScanning, setIsScanning] = useState(false);
  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);

  const updateState = (p: Partial<InboundLetterFormState>) => dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload: p });

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    
    // التحقق من الحجم - إذا كان كبيراً جداً قد نبطئ المعالجة
    if (file.size > 10 * 1024 * 1024) {
        toast.error("حجم الملف كبير جداً. يرجى اختيار ملف أقل من 10 ميجابايت.");
        return;
    }

    setIsScanning(true);
    const toastId = toast.loading("جاري التحليل الفوري للوثيقة...");
    
    try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((res) => { 
            reader.onload = () => res(reader.result as string); 
            reader.readAsDataURL(file); 
        });
        
        const [header, data] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] || file.type;
        
        // إرسال البيانات المباشرة للمحرك
        const res = await extractDetailsFromLetterImage(
            data, 
            mime, 
            settings.departments, 
            Object.values(LetterType), 
            Object.values(PriorityLevel), 
            Object.values(ConfidentialityLevel), 
            [], 
            letters
        );

        updateState({ 
            subject: res.subject || '', 
            from: res.from || '', 
            to: res.to || '', 
            externalRefNumber: res.externalRefNumber || '', 
            summary: res.summary || '', 
            category: res.category || '', 
            dateReceived: res.date || new Date().toISOString().split('T')[0]
        });
        
        toast.success("تم استخلاص البيانات فوراً!", { id: toastId });
    } catch(err: any) { 
        console.error(err);
        toast.error(`فشل التحليل: ${err.message || "تأكد من وضوح الصورة"}`, { id: toastId }); 
    } finally { 
        setIsScanning(false); 
        if (e.target) e.target.value = ''; 
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim()) { toast.error('الحقول الأساسية مطلوبة.'); return; }
    dispatch({ type: 'REGISTER_INBOUND', payload: { ...inboundLetterFormState, date: dateReceived, attachments: [] } as any });
    toast.success("تم تسجيل المعاملة بنجاح.");
    dispatch({ type: 'RESET_INBOUND_FORM_STATE' });
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">تسجيل وارد جديد</h2>
        <button 
            onClick={() => aiScanInputRef.current?.click()} 
            disabled={isScanning} 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl active:scale-95 ${isScanning ? 'bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}`}
        >
            {isScanning ? (
                <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white/20 border-b-white rounded-full"></div>
                    <span>جاري القراءة...</span>
                </div>
            ) : (
                <>
                    <SparklesIcon className="w-4 h-4" />
                    <span>مسح ذكي سريع</span>
                </>
            )}
        </button>
        <input type="file" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" accept="image/*,application/pdf" />
      </div>
      
      <div className="glass-card p-8 border-white/5 bg-slate-900/40 relative overflow-hidden">
        {isScanning && (
            <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="p-4 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-3">
                    <div className="animate-bounce p-3 bg-indigo-500/20 rounded-full">
                        <ScanTextIcon className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-sm font-bold text-indigo-300">يتم الآن استخراج النصوص والبيانات...</p>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                    <Label>موضوع المعاملة</Label>
                    <input type="text" value={subject} onChange={e => updateState({subject: e.target.value})} className="w-full input-inset p-3 font-semibold" placeholder="عنوان الخطاب..." required />
                </div>
                <div>
                    <Label>الجهة المرسلة</Label>
                    <input type="text" value={from} onChange={e => updateState({from: e.target.value})} className="w-full input-inset p-3 font-semibold" placeholder="من..." required />
                </div>
                <div>
                    <Label>الإحالة إلى</Label>
                    <select value={to} onChange={e => updateState({to: e.target.value})} className="w-full input-inset p-3 font-semibold outline-none">
                        <option value="">اختر القسم...</option>
                        {settings.departments.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                    </select>
                </div>
                <div>
                    <Label>تاريخ الاستلام</Label>
                    <input type="date" value={dateReceived} onChange={e => updateState({dateReceived: e.target.value})} className="w-full input-inset p-3 font-semibold" />
                </div>
                <div>
                    <Label>رقم القيد الخارجي</Label>
                    <input type="text" value={externalRefNumber} onChange={e => updateState({externalRefNumber: e.target.value})} className="w-full input-inset p-3 font-semibold" placeholder="الرقم على الخطاب..." />
                </div>
            </div>

            <div>
                <Label>ملخص الإجراء أو المحتوى</Label>
                <textarea value={summary} onChange={e => updateState({summary: e.target.value})} rows={3} className="w-full input-inset p-4 text-sm leading-relaxed" placeholder="نبذة مختصرة عن المعاملة..."></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label>الأهمية</Label>
                    <select value={priority} onChange={e => updateState({priority: e.target.value as PriorityLevel})} className="w-full input-inset p-3 font-semibold outline-none">
                        {Object.values(PriorityLevel).map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                    </select>
                </div>
                <div>
                    <Label>السرية</Label>
                    <select value={confidentiality} onChange={e => updateState({confidentiality: e.target.value as ConfidentialityLevel})} className="w-full input-inset p-3 font-semibold outline-none">
                        {Object.values(ConfidentialityLevel).map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </select>
                </div>
                <div>
                    <Label>أيام الإنجاز</Label>
                    <input type="number" value={completionDays} onChange={e => updateState({completionDays: e.target.value === '' ? '' : parseInt(e.target.value)})} className="w-full input-inset p-3 font-semibold" placeholder="مهلة المعالجة..." />
                </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-center">
                <button type="submit" className="px-16 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-base shadow-lg transition-all flex items-center gap-2 active:scale-[0.98]">
                    <CheckCircleIcon className="w-5 h-5" /> تسجيل واعتماد الوارد
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
