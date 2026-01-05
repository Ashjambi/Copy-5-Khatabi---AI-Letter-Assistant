
import React, { useState, useMemo } from 'react';
import { Letter, CorrespondenceType, LetterStatus, PriorityLevel } from '../types';
import { useApp } from '../App';
import { getThemeClasses, getStatusChip } from './utils';
import LetterDetails from './LetterDetails';
import { SearchIcon, InboxInIcon, SendIcon, FileTextIcon, LinkIcon, FilterIcon, ArrowRightLeftIcon } from './icons';

export default function Correspondence() {
    const { state } = useApp();
    const { letters: allLetters } = state;
    const [activeFilter, setActiveFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [groupByThread, setGroupByThread] = useState(true);

    const filteredLetters = useMemo(() => {
        let result = allLetters.filter(l => l.status !== LetterStatus.ARCHIVED);
        if (activeFilter === 'inbound') result = result.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
        if (activeFilter === 'outbound') result = result.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
        
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(l => l.subject.toLowerCase().includes(q) || (l.internalRefNumber || '').includes(q));
        }
        
        return result.sort((a, b) => new Date(b.date.replace(/\//g, '-')).getTime() - new Date(a.date.replace(/\//g, '-')).getTime());
    }, [allLetters, activeFilter, searchTerm]);

    // منطق تجميع السلاسل
    const displayItems = useMemo(() => {
        if (!groupByThread) return filteredLetters;

        const threads = new Map<string, Letter[]>();
        const processedIds = new Set<string>();

        // دالة للبحث عن الـ Root (أصل المعاملة)
        const getRootId = (letter: Letter): string => {
            let current = letter;
            let parent = allLetters.find(l => l.id === current.referenceId);
            while (parent) {
                current = parent;
                parent = allLetters.find(l => l.id === current.referenceId);
            }
            return current.id;
        };

        filteredLetters.forEach(l => {
            const rootId = getRootId(l);
            if (!threads.has(rootId)) threads.set(rootId, []);
            threads.get(rootId)!.push(l);
        });

        // تحويل الخريطة إلى قائمة تعرض "أحدث خطاب" في كل سلسلة
        return Array.from(threads.values()).map(thread => {
            thread.sort((a, b) => new Date(b.date.replace(/\//g, '-')).getTime() - new Date(a.date.replace(/\//g, '-')).getTime());
            return {
                latest: thread[0],
                count: thread.length,
                thread: thread
            };
        }).sort((a, b) => new Date(b.latest.date.replace(/\//g, '-')).getTime() - new Date(a.latest.date.replace(/\//g, '-')).getTime());
    }, [filteredLetters, groupByThread, allLetters]);

    const selectedLetter = allLetters.find(l => l.id === selectedId);

    return (
        <div className="flex h-[calc(100vh-6rem)] overflow-hidden gap-5">
            <div className={`flex flex-col w-full lg:w-[420px] shrink-0 gap-4 ${selectedLetter ? 'hidden lg:flex' : 'flex'}`}>
                <div className="flex flex-col gap-3 px-1">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-white">المراسلات النشطة</h1>
                        <button 
                            onClick={() => setGroupByThread(!groupByThread)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${groupByThread ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                        >
                            <LinkIcon className="w-3 h-3" />
                            {groupByThread ? 'عرض كمحادثات مفعّل' : 'تجميع السلاسل'}
                        </button>
                    </div>
                    
                    <div className="relative">
                        <SearchIcon className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="بحث في الموضوع أو الرقم..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full py-2.5 pr-10 pl-4 text-sm bg-slate-900/50 border border-white/5 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>

                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                        {['all', 'inbound', 'outbound'].map(f => (
                            <button key={f} onClick={() => setActiveFilter(f as any)} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                                {f === 'all' ? 'الكل' : f === 'inbound' ? 'الوارد' : 'الصادر'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-2">
                    {displayItems.length === 0 ? (
                        <div className="text-center py-20 opacity-20"><FileTextIcon className="w-12 h-12 mx-auto mb-4" /><p className="font-bold">لا توجد مراسلات حالياً</p></div>
                    ) : (
                        displayItems.map((item: any) => {
                            const isThread = !!item.latest;
                            const l = isThread ? item.latest : item;
                            const isSelected = selectedId === l.id;
                            
                            return (
                                <div 
                                    key={l.id} 
                                    onClick={() => setSelectedId(l.id)} 
                                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${isSelected ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'}`}
                                >
                                    {isThread && item.count > 1 && (
                                        <div className="absolute -top-1 -left-1 bg-emerald-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 z-10 animate-in zoom-in duration-500">
                                            {item.count}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${l.correspondenceType === CorrespondenceType.INBOUND ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                {l.correspondenceType === CorrespondenceType.INBOUND ? <InboxInIcon className="w-3.5 h-3.5" /> : <SendIcon className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-400 truncate max-w-[150px]">{l.correspondenceType === CorrespondenceType.INBOUND ? l.from : l.to}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-600">{l.date}</span>
                                    </div>

                                    <h4 className={`text-sm font-black mb-3 leading-snug line-clamp-2 ${isSelected ? 'text-white' : 'text-slate-200'}`}>{l.subject}</h4>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">#{l.internalRefNumber}</span>
                                        <div className="scale-90 origin-left">
                                            {getStatusChip(l.status)}
                                        </div>
                                    </div>

                                    {isThread && item.count > 1 && (
                                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                                            <LinkIcon className="w-3 h-3 text-emerald-500/60" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">سلسلة من {item.count} مراسلات مرتبطة</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="flex-1 h-full glass-card border border-white/5 relative overflow-hidden flex flex-col">
                {selectedLetter ? (
                    <div className="flex flex-col h-full animate-in fade-in duration-300">
                        <div className="lg:hidden p-3 border-b border-white/5 bg-slate-950/50">
                            <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-xs font-black text-indigo-400">
                                <ArrowRightLeftIcon className="w-3 h-3 rotate-180" /> العودة للقائمة
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <LetterDetails letter={selectedLetter} />
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-10 opacity-10">
                        <FileTextIcon className="w-24 h-24 text-slate-500 mb-6" />
                        <p className="text-xl font-black text-slate-400">اختر معاملة من القائمة لاستعراض "قصة" المراسلة</p>
                    </div>
                )}
            </div>
        </div>
    );
}
