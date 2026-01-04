
import React, { useState, useMemo } from 'react';
import { Letter, CorrespondenceType, LetterStatus, PriorityLevel } from '../types';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip } from './utils';
import LetterDetails from './LetterDetails';
import { SearchIcon, InboxInIcon, SendIcon, FileTextIcon, LinkIcon, FilterIcon } from './icons';

const groupLettersByDate = (letters: Letter[]) => {
    const groups: { [key: string]: Letter[] } = {
        'اليوم': [],
        'أمس': [],
        'الأسبوع الحالي': [],
        'الشهر الحالي': [],
        'أقدم': []
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);

    letters.forEach(letter => {
        try {
            const dateObj = new Date(letter.date.replace(/\//g, '-'));
            if (isNaN(dateObj.getTime())) { groups['أقدم'].push(letter); return; }
            if (dateObj.getTime() === today.getTime()) groups['اليوم'].push(letter);
            else if (dateObj.getTime() === yesterday.getTime()) groups['أمس'].push(letter);
            else if (dateObj > lastWeek) groups['الأسبوع الحالي'].push(letter);
            else groups['أقدم'].push(letter);
        } catch (e) { groups['أقدم'].push(letter); }
    });
    return groups;
};

export default function Correspondence() {
    const { state } = useApp();
    const { letters: allLetters, companySettings } = state;
    const [activeFilter, setActiveFilter] = useState<'all' | 'inbound' | 'outbound' | 'drafts'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredLetters = useMemo(() => {
        let result = allLetters.filter(l => l.status !== LetterStatus.ARCHIVED);
        if (activeFilter === 'inbound') result = result.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
        if (activeFilter === 'outbound') result = result.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
        if (activeFilter === 'drafts') result = result.filter(l => l.status === LetterStatus.DRAFT);
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(l => l.subject.toLowerCase().includes(q) || (l.internalRefNumber || '').includes(q));
        }
        return result.sort((a, b) => new Date(b.date.replace(/\//g, '-')).getTime() - new Date(a.date.replace(/\//g, '-')).getTime());
    }, [allLetters, activeFilter, searchTerm]);

    const grouped = useMemo(() => groupLettersByDate(filteredLetters), [filteredLetters]);
    const selectedLetter = allLetters.find(l => l.id === selectedId);

    return (
        <div className="flex h-[calc(100vh-6rem)] overflow-hidden gap-5">
            <div className={`flex flex-col w-full lg:w-[380px] shrink-0 gap-4 ${selectedLetter ? 'hidden lg:flex' : 'flex'}`}>
                <div className="flex flex-col gap-3 px-1">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-white">المراسلات النشطة</h1>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{filteredLetters.length} سجل</span>
                    </div>
                    <div className="relative">
                        <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="بحث سياقي..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full py-2 pr-9 pl-3 text-sm bg-slate-900/50 border border-white/5 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5">
                        {['all', 'inbound', 'outbound'].map(f => (
                            <button key={f} onClick={() => setActiveFilter(f as any)} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${activeFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                                {f === 'all' ? 'الكل' : f === 'inbound' ? 'الوارد' : 'الصادر'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-4">
                    {/* @FIX: Explicitly casted letters to Letter[] to fix length and map property errors on unknown type */}
                    {Object.entries(grouped).map(([group, letters]) => (letters as Letter[]).length > 0 && (
                        <div key={group}>
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2">{group}</h3>
                            <div className="space-y-1.5">
                                {/* @FIX: Added explicit casting to Letter[] */}
                                {(letters as Letter[]).map(letter => (
                                    <div key={letter.id} onClick={() => setSelectedId(letter.id)} className={`p-3.5 rounded-xl border cursor-pointer transition-all ${selectedId === letter.id ? 'bg-indigo-600/10 border-indigo-500/50 shadow-sm' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60'}`}>
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1 rounded-md ${letter.correspondenceType === CorrespondenceType.INBOUND ? 'bg-violet-500/10 text-violet-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                    {letter.correspondenceType === CorrespondenceType.INBOUND ? <InboxInIcon className="w-3 h-3" /> : <SendIcon className="w-3 h-3" />}
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[120px]">{letter.correspondenceType === CorrespondenceType.INBOUND ? letter.from : letter.to}</span>
                                            </div>
                                            <span className="text-[9px] font-mono text-slate-600">{letter.date}</span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-slate-100 line-clamp-1 mb-2">{letter.subject}</h4>
                                        <div className="flex justify-between items-center scale-90 origin-right">
                                            <span className="text-[10px] font-mono text-slate-600">#{letter.internalRefNumber}</span>
                                            {getStatusChip(letter.status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 h-full glass-card border border-white/5 relative overflow-hidden flex flex-col">
                {selectedLetter ? (
                    <div className="flex flex-col h-full animate-in fade-in duration-300">
                        <div className="lg:hidden p-3 border-b border-white/5">
                            <button onClick={() => setSelectedId(null)} className="text-xs font-bold text-indigo-400">← العودة للقائمة</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <LetterDetails letter={selectedLetter} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-10 opacity-30">
                        <FileTextIcon className="w-12 h-12 text-slate-500 mb-4" />
                        <p className="font-semibold text-slate-400">اختر معاملة لاستعراض التفاصيل</p>
                    </div>
                )}
            </div>
        </div>
    );
}
