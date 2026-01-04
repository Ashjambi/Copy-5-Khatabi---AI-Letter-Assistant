
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

const SelectField = <T extends string>({ label, value, onChange, options, ringColor, disabled=false }: {label: string, value: T, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: object | string[], ringColor: string, disabled?: boolean}) => (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1">{label}</label>
      <select 
        value={value}
        onChange={onChange}
        disabled={disabled}
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
  const theme = getThemeClasses(settings.primaryColor);
  const aiScanInputRef = useRef<HTMLInputElement>(null);
  const allRecipients = [...settings.departments, ...(settings.externalEntities || [])];

  const updateState = (payload: Partial<InboundLetterFormState>) => {
      dispatch({ type: 'UPDATE_INBOUND_FORM_STATE', payload });
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isSupported = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/tiff', 'image/tif'].includes(file.type) || 
                        file.name.toLowerCase().endsWith('.tif') || 
                        file.name.toLowerCase().endsWith('.tiff');

    if (!isSupported) {
        toast.error("الملف غير مدعوم. يرجى اختيار صورة أو PDF.");
        return;
    }

    setIsScanning(true);
    const toastId = toast.loading("جاري قراءة وتحليل الوثيقة...");
    
    try {
        let base64Data: string;
        let mimeType: string = file.type;
        
        if (file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
            const arrayBuffer = await file.arrayBuffer();
            const tiff = new Tiff({ buffer: arrayBuffer });
            const canvas = tiff.toCanvas();
            if (!canvas) throw new Error("Could not convert TIFF file.");
            const dataUrl = canvas.toDataURL('image/png');
            base64Data = dataUrl.split(',')[1];
            mimeType = 'image/png';
        } else {
            const dataUrl = await fileToDataURL(file);
            const splitData = dataUrl.split(',');
            base64Data = splitData[1];
            if (!mimeType) {
                const header = splitData[0];
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            }
        }

        const letterTypes = Object.values(LetterType) as string[];
        const priorityLevels = Object.values(PriorityLevel) as string[];
        const confidentialityLevels = Object.values(ConfidentialityLevel) as string[];
        const allCategories = [...new Set(letters.map(l => l.category).filter((c): c is string => !!c))] as string[];
        
        const existingLettersForScan = letters.map(l => ({
            id: l.id,
            subject: l.subject,
            internalRefNumber: l.internalRefNumber,
            externalRefNumber: l.externalRefNumber,
            date: l.date
        }));

        const extractedData = await extractDetailsFromLetterImage(
            base64Data, 
            mimeType, 
            settings.departments, 
            letterTypes, 
            priorityLevels, 
            confidentialityLevels, 
            allCategories, 
            existingLettersForScan
        );
        
        const updates: Partial<InboundLetterFormState> = {};
        if (extractedData.subject) updates.subject = extractedData.subject;
        if (extractedData.from) updates.from = extractedData.from;
        if (extractedData.to) updates.to = extractedData.to; 
        if (extractedData.externalRefNumber) updates.externalRefNumber = extractedData.externalRefNumber;
        if (extractedData.summary) updates.summary = extractedData.summary;
        if (extractedData.category) updates.category = extractedData.category;
        if (extractedData.referenceId) updates.referenceId = extractedData.referenceId;
        if (extractedData.date) updates.dateReceived = extractedData.date;
        
        updateState(updates);
        
        // إرفاق الملف تلقائياً
        if (!attachments.some(f => f.name === file.name)) {
            updateState({ attachments: [file, ...attachments] });
        }

        toast.success("تم استخلاص البيانات بنجاح!", { id: toastId });

    } catch(error: any) {
        console.error("OCR Final Catch:", error);
        toast.error(error.message || "حدث خطأ أثناء معالجة الوثيقة.", { id: toastId });
    } finally {
        setIsScanning(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        updateState({ attachments: [...attachments, ...Array.from(e.target.files)] });
    }
  };

  const removeAttachment = (index: number) => {
    updateState({ attachments: attachments.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !from.trim() || !to.trim()) {
      toast.error('الرجاء تعبئة الحقول الإلزامية.');
      return;
    }

    const attachmentPromises = attachments.map(async (file, index) => {
        const url = await fileToDataURL(file);
        const type: Attachment['type'] = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : file.type.includes('word') ? 'word' : 'other';
        return {
            id: `in_att_${Date.now()}_${index}`,
            name: file.name,
            type,
            url: url,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        };
    });

    const newAttachments: Attachment[] = await Promise.all(attachmentPromises);

    dispatch({ 
        type: 'REGISTER_INBOUND', 
        payload: {
            subject, from, to, type: letterType, cc,
            date: dateReceived, attachments: newAttachments, externalRefNumber, priority, confidentiality,
            completionDays: completionDays ? Number(completionDays) : undefined,
            notes, category, summary, referenceId,
        }
    });
    
    toast.success("تم تسجيل الوارد بنجاح.");
    dispatch({ type: 'RESET_INBOUND_FORM_STATE' });
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-2xl font-black text-white">تسجيل خطاب وارد جديد</h2>
        <button
            onClick={() => dispatch({ type: 'RESET_INBOUND_FORM_STATE' })}
            className="btn-3d-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs text-rose-300 font-bold border border-rose-500/30 hover:bg-rose-500/20"
        >
            تصفير النموذج
        </button>
      </div>
      <p className="text-slate-400 font-bold mb-8 text-sm">استخدم المسح الضوئي الذكي (OCR) لتوفير وقت الإدخال اليدوي.</p>
      
      <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-500/50 to-indigo-500/20"></div>

        <div className="flex justify-center mb-10">
            <button
                onClick={() => aiScanInputRef.current?.click()}
                disabled={isScanning}
                className={`group relative w-full md:w-auto inline-flex items-center justify-center gap-4 px-10 py-5 text-white rounded-2xl transition-all shadow-2xl active:scale-95 ${isScanning ? 'bg-slate-700 cursor-wait' : `${theme.bg} hover:brightness-110`} `}
            >
                 {isScanning ? (
                    <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <span className="font-black text-lg uppercase tracking-widest">جاري التحليل...</span>
                    </>
                 ) : (
                    <>
                        <LinkIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                        <span className="text-lg font-black tracking-tight">بدء المسح الضوئي الذكي (OCR)</span>
                    </>
                 )}
            </button>
            <input type="file" accept="application/pdf,image/*" ref={aiScanInputRef} onChange={handleAiScan} className="hidden" />
        </div>
        
        <div className="relative flex items-center mb-10">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">أو الإدخال اليدوي المباشر</span>
            <div className="flex-grow border-t border-white/5"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField label="الموضوع" value={subject} onChange={(e) => updateState({ subject: e.target.value })} ringColor={theme.ring} placeholder="عنوان المعاملة..." disabled={isScanning} required />
                <InputField label="الجهة الوارد منها" value={from} onChange={(e) => updateState({ from: e.target.value })} ringColor={theme.ring} placeholder="اسم الجهة..." disabled={isScanning} required/>
                
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">إحالة إلى (القسم)</label>
                  <input
                    list="departments-list"
                    value={to}
                    onChange={(e) => updateState({ to: e.target.value })}
                    className={`block w-full px-4 py-3 bg-slate-950/50 text-white border border-slate-700/50 rounded-xl shadow-inner focus:outline-none focus:ring-2 ${theme.ring} sm:text-sm font-bold transition-all`}
                    placeholder="اختر القسم..."
                    disabled={isScanning}
                    required
                  />
                  <datalist id="departments-list">
                    {settings.departments.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">نسخة إلى (CC)</label>
                    <MultiSelectCombobox
                        options={allRecipients}
                        selectedItems={cc}
                        onChange={(newCc) => updateState({ cc: newCc })}
                        placeholder="اختر الجهات..."
                        ringColor={theme.ring}
                        disabled={isScanning}
                    />
                </div>
                
                <InputField label="تاريخ الاستلام" value={dateReceived} onChange={(e) => updateState({ dateReceived: e.target.value })} type="date" ringColor={theme.ring} disabled={isScanning} />
                <InputField label="رقم قيد الوارد (الخارجي)" value={externalRefNumber} onChange={(e) => updateState({ externalRefNumber: e.target.value })} placeholder="الرقم على الخطاب..." ringColor={theme.ring} disabled={isScanning} />
            </div>

            <TextAreaField 
                label="ملخص الإجراء أو المحتوى" value={summary} onChange={e => updateState({ summary: e.target.value })}
                placeholder="اكتب ملخصاً سريعاً للمعاملة..." ringColor={theme.ring} disabled={isScanning} rows={4}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SelectField label="الأهمية" value={priority} onChange={(e) => updateState({ priority: e.target.value as PriorityLevel })} options={PriorityLevel} ringColor={theme.ring} disabled={isScanning} />
                <SelectField label="السرية" value={confidentiality} onChange={(e) => updateState({ confidentiality: e.target.value as ConfidentialityLevel })} options={ConfidentialityLevel} ringColor={theme.ring} disabled={isScanning} />
                <InputField label="أيام الإنجاز" value={completionDays} onChange={(e) => updateState({ completionDays: e.target.value === '' ? '' : parseInt(e.target.value) })} type="number" placeholder="مهلة الإنجاز..." ringColor={theme.ring} disabled={isScanning} />
            </div>

            <div className="mt-8">
                <label className="block text-sm font-black text-slate-300 mb-4 uppercase tracking-widest px-1">المرفقات الرقمية</label>
                <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-950/40 hover:bg-white/5 border-2 border-dashed border-white/10 rounded-2xl p-8 text-center block w-full transition-all group shadow-inner">
                    <span className="mt-2 block text-sm font-black text-slate-500 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">اسحب الملفات هنا أو انقر للإضافة</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                </label>
                {attachments.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 px-4 bg-slate-800/40 rounded-xl border border-white/5 shadow-lg group">
                                <span className="text-xs font-bold text-slate-300 truncate pr-2">{file.name}</span>
                                <button type="button" onClick={() => removeAttachment(index)} className="text-rose-500 hover:text-rose-400 font-black text-[10px] uppercase">حذف</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-8 text-center border-t border-white/5">
                <button
                    type="submit" disabled={isScanning}
                    className="group relative px-20 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xl shadow-3xl transition-all active:scale-95 disabled:opacity-50"
                >
                    اعتماد وتسجيل الوارد
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
