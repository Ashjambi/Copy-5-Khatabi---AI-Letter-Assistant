
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Letter, Attachment, CompanySettings, PriorityLevel, ConfidentialityLevel, LetterType, InboundLetterFormState, CorrespondenceType, View } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import { useApp } from '../App';
import { getThemeClasses } from './utils';

const InputField = ({ label, value, onChange, placeholder, type = 'text', ringColor, disabled = false, required = false }: {label: string, value: string | number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, type?: string, ringColor: string, disabled?: boolean, required?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      />
    </div>
);

const SelectField = <T extends string>({ label, value, onChange, options, ringColor, disabled=false, required=false }: {label: string, value: T, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: object | string[], ringColor: string, disabled?: boolean, required?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
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
  const { companySettings: settings, inboundLetterFormState } = state;

  const {
      subject, from, to, dateReceived, letterType, attachments, summary, externalRefNumber, priority, confidentiality
  } = inboundLetterFormState;

  const [isScanning, setIsScanning] = useState(false);
  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const scanToast = toast.loading("جاري قراءة المستند ذكياً...");
    
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
            []
        );
        
        const updates: Partial<InboundLetterFormState> = {};
        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if (extractedData.summary) updates.summary = extractedData.summary;
        
        updateState({ ...updates, attachments: [file, ...attachments] });
        toast.success("تم استخلاص البيانات بنجاح!", { id: scanToast });
    } catch(error: any) {
        toast.error(`فشل المسح الذكي: ${error.message}`, { id: scanToast });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) {
        toast.error('يرجى تعبئة كافة الحقول الأساسية وإرفاق ملف.');
        return;
    }

    const attachmentPromises = attachments.map(async (file, index) => {
        const url = await fileToDataURL(file);
        return {
            id: `in_att_${Date.now()}_${index}`,
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.includes('word') ? 'word' : 'other' as any,
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
            confidentiality, summary 
        } as any 
    });
    
    toast.success("تم تسجيل الوارد بنجاح.");
    dispatch({ type: 'RESET_INBOUND_FORM_STATE' });
    // @FIX: Added missing View import to fix "Cannot find name 'View'" error
    dispatch({ type: 'SET_VIEW', payload: View.DASHBOARD });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-black text-white">تسجيل خطاب وارد جديد</h2>
            <p className="text-slate-400 font-bold mt-1">استخدم المسح الذكي (OCR) لتعبئة البيانات تلقائياً.</p>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} className="text-xs text-rose-300 font-black border border-rose-500/30 px-4 py-2 rounded-xl hover:bg-rose-500/10 transition-colors">تفريغ النموذج</button>
      </div>
      
      <div className="bg-slate-900/60 p-8 rounded-[2rem] shadow-3xl border border-white/10">
        <div className="flex justify-center mb-10">
            <button 
                type="button"
                onClick={() => aiScanInputRef.current?.click()} 
                disabled={isScanning} 
                className={`px-12 py-5 text-white rounded-2xl transition-all ${isScanning ? 'bg-slate-700' : `bg-indigo-600 hover:bg-indigo-50 shadow-xl shadow-indigo-600/20`} font-black text-lg flex items-center gap-4`}
            >
                {isScanning ? <div className="animate-spin h-6 w-6 border-2 border-white/20 border-b-white rounded-full"></div> : null}
                {isScanning ? "جاري المسح الضوئي..." : "المسح الضوئي الذكي (OCR)"}
            </button>
            <input type="file" accept="image/*,application/pdf" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField label="موضوع الخطاب" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required placeholder="أدخل موضوع المعاملة" />
                <InputField label="الجهة الوارد منها" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required placeholder="اسم المرسل الخارجي" />
                <SelectField label="القسم المستلم" value={to} onChange={(e) => updateState({ to: e.target.value })} options={settings.departments} ringColor={theme.ring} required />
                <InputField label="تاريخ الخطاب" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
                <InputField label="الرقم المرجعي (الخارجي)" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} ringColor={theme.ring} placeholder="الرقم المسجل على الورقة" />
                <SelectField label="نوع المعاملة" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
            </div>

            <div className="pt-8 border-t border-white/5 text-center">
                <button type="submit" disabled={isScanning} className="w-full md:w-auto px-24 py-5 text-white bg-emerald-600 rounded-2xl hover:bg-emerald-500 font-black text-xl shadow-2xl active:scale-95 disabled:opacity-50">
                    حفظ وتسجيل في الأرشيف
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
