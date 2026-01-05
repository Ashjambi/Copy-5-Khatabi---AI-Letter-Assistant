
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Letter, Attachment, CompanySettings, PriorityLevel, ConfidentialityLevel, LetterType, InboundLetterFormState, CorrespondenceType } from '../types';
import { extractDetailsFromLetterImage } from '../services/geminiService';
import Tiff from 'tiff.js';
import { useApp } from '../App';
import { getThemeClasses } from './utils';
import MultiSelectCombobox from './MultiSelectCombobox';
import { LinkIcon } from './icons';

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
    const scanToast = toast.loading("جاري قراءة المستند ذكياً...");
    
    try {
        let base64Data: string;
        let mimeType: string = file.type || "application/pdf";
        const dataUrl = await fileToDataURL(file);
        base64Data = dataUrl.split(",")[1];

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
        
        if (extractedData.date) {
            const d = new Date(extractedData.date);
            if (!isNaN(d.getTime())) updates.dateReceived = d.toISOString().split('T')[0];
        }
        
        updateState({ ...updates, attachments: [file, ...attachments] });
        toast.success("تم استخلاص البيانات بنجاح!", { id: scanToast });
    } catch(error: any) {
        toast.error(`خطأ: ${error.message || 'فشل المسح الذكي'}`, { id: scanToast });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) {
        toast.error('يرجى تعبئة كافة الحقول وإرفاق ملف.');
        return;
    }

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
            subject, from, to, type: letterType, cc, date: dateReceived, 
            attachments: newAttachments, externalRefNumber, priority, 
            confidentiality, completionDays: completionDays ? Number(completionDays) : undefined, 
            notes, category, summary, referenceId 
        } as any 
    });
    
    toast.success("تم تسجيل الوارد بنجاح.");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-2xl font-bold text-white">تسجيل خطاب وارد جديد</h2>
        <button type="button" onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} className="text-xs text-rose-300 font-bold border border-rose-500/30 p-2 rounded hover:bg-rose-500/10 transition-colors">مسح النموذج</button>
      </div>
      <p className="text-slate-400 font-bold mb-6">أدخل البيانات أو استخدم المسح الضوئي الذكي (OCR) للتعبئة التلقائية.</p>
      
      <div className="bg-slate-900/60 p-6 rounded-lg shadow-lg border border-white/10 mt-6">
        <div className="flex justify-center mb-8">
            <button 
                type="button"
                onClick={() => aiScanInputRef.current?.click()} 
                disabled={isScanning} 
                className={`px-10 py-4 text-white rounded-xl transition-all ${isScanning ? 'bg-slate-700' : `${theme.bg} hover:brightness-110 shadow-lg shadow-indigo-500/20`} font-black text-lg flex items-center gap-3`}
            >
                {isScanning ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-b-white rounded-full"></div> : null}
                {isScanning ? "جاري المعالجة..." : "المسح الضوئي الذكي (OCR)"}
            </button>
            <input type="file" accept="image/*,application/pdf" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required placeholder="موضوع الخطاب" />
                <InputField label="الجهة المرسلة (من)" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required placeholder="اسم المرسل" />
                <SelectField label="القسم المستلم" value={to} onChange={(e) => updateState({ to: e.target.value })} options={settings.departments} ringColor={theme.ring} required />
                <InputField label="تاريخ الورود" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
                <InputField label="رقم المرجع الخارجي" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} ringColor={theme.ring} placeholder="الرقم على الخطاب الورقي" />
                <SelectField label="نوع المعاملة" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
            </div>

            <div className="mt-4">
                <label className="block text-sm font-bold text-slate-300 mb-2">الملفات المرفقة ({attachments.length})</label>
                <label className="cursor-pointer bg-indigo-600/10 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 p-6 rounded-xl block text-center transition-all group">
                    <span className="text-sm font-bold text-indigo-400 group-hover:text-indigo-300">انقر هنا لرفع صورة الخطاب أو ملف PDF</span>
                    <input type="file" multiple onChange={(e) => e.target.files && updateState({ attachments: [...attachments, ...Array.from(e.target.files)] })} className="hidden" />
                </label>
                {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <div key={index} className="bg-white/5 border border-white/10 px-3 py-1 rounded text-xs font-bold text-slate-300">{file.name}</div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-6 text-center">
                <button type="submit" disabled={isScanning} className="w-full md:w-auto px-20 py-4 text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 font-black text-lg shadow-xl active:scale-95 disabled:opacity-50">
                    حفظ وتسجيل الوارد
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
