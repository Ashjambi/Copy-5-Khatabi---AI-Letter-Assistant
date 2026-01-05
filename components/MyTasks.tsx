
import React, { useMemo, useState } from 'react';
import { Letter, LetterStatus, CompanySettings, User, CorrespondenceType, PriorityLevel } from '../types';
import { getThemeClasses, getStatusChip, getPriorityChip } from './utils';
import { LinkIcon, InboxInIcon, SendIcon } from './icons';

interface MyTasksProps {
    letters: Letter[];
    allLetters?: Letter[];
    onSelectLetter: (id: string) => void;
    settings: CompanySettings;
    currentUser: User;
}

export default function MyTasks({ letters, allLetters = [], onSelectLetter, settings, currentUser }: MyTasksProps) {
    const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound' | 'pending'>('all');

    const filteredLetters = useMemo(() => {
        let result = letters;
        result = [...result].sort((a, b) => {
             const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
             const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
             return isNaN(dateA) || isNaN(dateB) ? 0 : dateB - dateA;
        });

        if (filter === 'inbound') return result.filter(l => l.correspondenceType === CorrespondenceType.INBOUND);
        if (filter === 'outbound') return result.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND);
        if (filter === 'pending') return result.filter(l => [LetterStatus.RECEIVED, LetterStatus.AWAITING_REPLY, LetterStatus.PENDING_REVIEW, LetterStatus.PENDING_AUDIT].includes(l.status));
        return result.slice(0, 15);
    }, [letters, filter]);

    const TabButton = ({ id, label }: { id: string, label: string }) => (
        <button
            onClick={() => setFilter(id as any)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200 border ${
                filter === id 
                ? `bg-white/10 text-white border-white/20 shadow-inner` 
                : 'text-slate-500 border-transparent hover:bg-white/5 hover:text-slate-300'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="glass-card flex flex-col h-full min-h-[500px] border border-white/5 shadow-2xl">
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 rounded-t-3xl">
                <h2 className="text-lg font-black text-white">المعاملات النشطة مؤخراً</h2>
                <div className="flex bg-slate-950/40 p-1 rounded-xl border border-white/5">
                    <TabButton id="all" label="الكل" />
                    <TabButton id="inbound" label="الوارد" />
                    <TabButton id="outbound" label="الصادر" />
                    <TabButton id="pending" label="تحت الإجراء" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {filteredLetters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                        <InboxInIcon className="w-12 h-12 mb-4" />
                        <p className="font-black text-sm">لا توجد معاملات نشطة حالياً</p>
                    </div>
                ) : (
                    filteredLetters.map((letter) => {
                        const isInbound = letter.correspondenceType === CorrespondenceType.INBOUND;
                        const hasThread = !!letter.referenceId || allLetters.some(l => l.referenceId === letter.id);
                        
                        return (
                            <div 
                                key={letter.id}
                                onClick={() => onSelectLetter(letter.id)}
                                className="group relative bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-indigo-500/20 rounded-2xl p-4 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm"
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {hasThread && <LinkIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="مرتبطة بسلسلة" />}
                                            <h3 className="text-sm font-black text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                                                {letter.subject}
                                            </h3>
                                        </div>
                                        <span className="flex-shrink-0 text-[9px] font-mono text-slate-600 font-bold">{letter.date}</span>
                                    </div>

                                    <div className="flex items-center justify-between mt-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1 rounded-lg ${isInbound ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                {isInbound ? <InboxInIcon className="w-3 h-3" /> : <SendIcon className="w-3 h-3" />}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                                                {isInbound ? letter.from : letter.to}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {letter.priority === PriorityLevel.URGENT && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>}
                                            <div className="scale-75 origin-left">
                                                {getStatusChip(letter.status)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
