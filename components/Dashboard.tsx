
import React, { useMemo } from 'react';
import { useApp } from '../App';
import FollowUpAssistant from './FollowUpAssistant';
import MyTasks from './MyTasks';
import { getVisibleLetters } from './utils';
import { LetterStatus, CorrespondenceType } from '../types';

export default function Dashboard() {
    const { state, dispatch } = useApp();
    const { letters: allLetters, companySettings, currentUser } = state;
    const visibleLetters = useMemo(() => getVisibleLetters(allLetters, currentUser), [allLetters, currentUser]);

    const stats = useMemo(() => ({
        total: visibleLetters.length,
        inbound: visibleLetters.filter(l => l.correspondenceType === CorrespondenceType.INBOUND).length,
        outbound: visibleLetters.filter(l => l.correspondenceType === CorrespondenceType.OUTBOUND).length,
        pending: visibleLetters.filter(l => [LetterStatus.RECEIVED, LetterStatus.AWAITING_REPLY].includes(l.status)).length,
    }), [visibleLetters]);

    const StatWidget = ({ label, value, color }: { label: string, value: number, color: string }) => (
        <div className="glass-card p-5 flex flex-col justify-center items-start border-white/5 hover:bg-white/5 transition-all">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                <div className={`w-1 h-1 rounded-full ${color}`}></div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-10">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">لوحة القيادة الإدارية</h1>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">موجز عمليات النظام والحالات النشطة.</p>
                </div>
                <div className="text-[10px] font-bold text-slate-600 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatWidget label="إجمالي المعاملات" value={stats.total} color="bg-indigo-500" />
                <StatWidget label="المراسلات الواردة" value={stats.inbound} color="bg-violet-500" />
                <StatWidget label="المراسلات الصادرة" value={stats.outbound} color="bg-blue-500" />
                <StatWidget label="قيد المتابعة" value={stats.pending} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2">
                    <MyTasks letters={visibleLetters} onSelectLetter={(id) => dispatch({type:'SELECT_LETTER', payload:id})} settings={companySettings} currentUser={currentUser!} allLetters={allLetters} />
                </div>
                <div className="xl:col-span-1">
                    <FollowUpAssistant />
                </div>
            </div>
        </div>
    );
}
