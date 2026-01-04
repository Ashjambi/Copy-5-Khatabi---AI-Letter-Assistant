
import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Attachment, PriorityLevel, ConfidentialityLevel, LetterType, InboundLetterFormState, CorrespondenceType } from '../types';
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

const TextAreaField = ({ label, value, onChange, placeholder, rows, ringColor, disabled=false }: {label: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, rows?: number, ringColor: string, disabled?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <textarea
        rows={rows || 3}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`block w-full px-3 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md shadow-inner placeholder-slate-500 focus:outline-none focus:ring-2 ${ringColor} sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
      ></textarea>
    </div>
);

// @FIX: Added required prop to SelectField component
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
  const allRecipients = [...settings.departments, ...(settings.externalEntities || [])];

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const filteredLetters = useMemo(() => {
      if (!searchTerm) return [];
      const lower = searchTerm.toLowerCase();
      return letters.filter(l => 
          l.subject.toLowerCase().includes(lower) || 
          (l.internalRefNumber || '').toLowerCase().includes(lower) ||
          (l.externalRefNumber || '').toLowerCase().includes(lower)
      ).slice(0, 5);
  }, [searchTerm, letters]);

  const selectedParentLetter = useMemo(() => letters.find(l => l.id === referenceId), [letters, referenceId]);

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
        let base64Data: string;
        let mimeType: string;
        
        const dataUrl = await fileToDataURL(file);
        const parts = dataUrl.split(',');
        base64Data = parts[parts.length - 1];
        mimeType = parts[0].match(/:(.*?);/)?.[1] || file.type;

        if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (canvas) {
                const converted = canvas.toDataURL('image/png');
                base64Data = converted.split(',')[1];
                mimeType = 'image/png';
            }
        }

        const extractedData = await extractDetailsFromLetterImage(base64Data, mimeType, settings.departments, Object.values(LetterType) as string[], Object.values(PriorityLevel) as string[], Object.values(ConfidentialityLevel) as string[], [], letters.map(l => ({ id: l.id, subject: l.subject, internalRefNumber: l.internalRefNumber, externalRefNumber: l.externalRefNumber, date: l.date })));
        
        const updates: Partial<InboundLetterFormState> = {};
        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if (extractedData.letterType && Object.values(LetterType).includes(extractedData.letterType as any)) updates.letterType = extractedData.letterType as LetterType;
        if (extractedData.category) updates.category = extractedData.category;
        if (extractedData.summary) updates.summary = extractedData.summary;
        if (extractedData.priority) updates.priority = extractedData.priority as PriorityLevel;
        if (extractedData.confidentiality) updates.confidentiality = extractedData.confidentiality as ConfidentialityLevel;
        if (extractedData.date && !isNaN(new Date(extractedData.date).getTime())) updates.dateReceived = extractedData.date;
        
        updateState(updates);
        toast.success("تم استخلاص البيانات بنجاح!");
    } catch(error) { toast.error("حدث خطأ أثناء معالجة الصورة."); } finally { setIsScanning(false); if (e.target) e.target.value = ''; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim() || attachments.length === 0) { toast.error('الرجاء تعبئة الحقول الإلزامية وإرفاق ملف.'); return; }
    const newAttachments: Attachment[] = await Promise.all(attachments.map(async (file, index) => ({ id: `in_att_${Date.now()}_${index}`, name: file.name, type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other' as any, url: await fileToDataURL(file), size: `${(file.size / 1024 / 1024).toFixed(2)} MB` })));
    dispatch({ type: 'REGISTER_INBOUND', payload: { subject, from, to, type: letterType, cc, date: dateReceived, attachments: newAttachments, externalRefNumber, priority, confidentiality, completionDays: completionDays ? Number(completionDays) : undefined, notes, category, summary, referenceId } as any });
    toast.success("تم تسجيل الوارد بنجاح.");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-1"><h2 className="text-2xl font-bold text-white">تسجيل خطاب وارد جديد</h2><button onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })} className="text-xs text-rose-300 font-bold border border-rose-500/30 p-2 rounded">مسح النموذج</button></div>
      <div className="bg-slate-900/60 p-6 rounded-lg shadow-lg border border-white/10 mt-6">
        <div className="flex justify-center mb-6"><button onClick={() => aiScanInputRef.current?.click()} disabled={isScanning} className={`px-8 py-4 text-white rounded-lg transition-all ${isScanning ? 'bg-slate-500' : `${theme.bg} hover:brightness-110 shadow-lg`} font-bold`}>{isScanning ? "جاري المسح الضوئي..." : "المسح الضوئي الذكي (OCR)"}</button><input type="file" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" /></div>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-2"><LinkIcon className="w-4 h-4" /> ربط بمعاملة سابقة</h3>
                {selectedParentLetter ? <div className="flex justify-between items-center bg-indigo-500/20 p-3 rounded border border-indigo-500/30"><p className="text-sm font-bold text-white">{selectedParentLetter.subject}</p><button type="button" onClick={() => updateState({ referenceId: undefined })} className="text-xs text-rose-400 font-bold">إلغاء</button></div> : <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }} placeholder="ابحث برقم المعاملة أو الموضوع..." className="w-full px-4 py-2 bg-slate-950/50 text-white border border-slate-700/50 rounded-md text-sm" />}
                {isSearchOpen && searchTerm && filteredLetters.length > 0 && <div className="bg-slate-900 border border-white/10 rounded mt-1 overflow-hidden">{filteredLetters.map(l => <button key={l.id} type="button" onClick={() => { updateState({ referenceId: l.id }); setSearchTerm(''); setIsSearchOpen(false); }} className="w-full text-right px-4 py-2 hover:bg-white/5 border-b border-white/5 text-sm text-slate-200">{l.subject}</button>)}</div>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} required />
                <InputField label="الجهة الوارد منها (من)" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} required />
                <SelectField label="موجه إلى (القسم)" value={to} onChange={(e) => updateState({ to: e.target.value })} options={settings.departments} ringColor={theme.ring} required />
                <InputField label="تاريخ الاستلام" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} />
                <InputField label="رقم المرجع" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} ringColor={theme.ring} />
                <SelectField label="نوع المعاملة" value={letterType} onChange={(e) => updateState({ letterType: e.target.value as LetterType })} options={LetterType} ringColor={theme.ring} />
            </div>
            <div className="pt-4 text-center"><button type="submit" disabled={isScanning} className="w-full md:w-auto px-8 py-3 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 font-bold shadow-lg">تسجيل الخطاب الوارد</button></div>
        </form>
      </div>
    </div>
  );
}
