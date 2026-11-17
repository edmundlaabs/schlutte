import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task } from '../types';
import type { Person } from '../hooks/usePersons';
import { getDeadlineStatus } from '../utils/deadlineStatus';

interface CalendarViewProps {
  tasks: Task[];
  persons: Person[];
  onEditTask: (task: Task) => void;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, persons, onEditTask }) => {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthName = cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // Build 6-week grid starting on Monday
  const days = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Mon
    const gridStart = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      return new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    });
  }, [year, month]);

  // Bucket tasks by deadline date
  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!t.deadline) return;
      const k = t.deadline.split('T')[0]; // ISO yyyy-mm-dd
      (m[k] = m[k] || []).push(t);
    });
    return m;
  }, [tasks]);

  const noDateTasks = useMemo(() => tasks.filter(t => !t.deadline), [tasks]);

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const selectedTasks = selectedDay ? byDay[isoKey(selectedDay)] || [] : [];

  const getPersonShort = (personName: string): string => {
    const p = persons.find(pp => pp.name === personName);
    return (p?.shortName || personName).slice(0, 3).toUpperCase();
  };

  const prioColorClass = (prio: number | undefined, isDone: boolean | undefined): string => {
    if (isDone) return 'bg-[#EFEAE0] text-[#8A8278]';
    if (prio === 1) return 'bg-[#ff0049]/12 text-[#0E0E0D] border-l-2 border-[#ff0049]';
    if (prio === 2) return 'bg-[#ffb92e]/15 text-[#0E0E0D] border-l-2 border-[#ffb92e]';
    if (prio === 3) return 'bg-[#659900]/12 text-[#0E0E0D] border-l-2 border-[#659900]';
    return 'bg-[#F6F2EA] text-[#5C5852] border-l-2 border-[#969696]';
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#BDB6AB]/60">
        <div className="flex items-baseline gap-3">
          <h3 className="text-2xl font-light text-[#0E0E0D] tracking-tight capitalize">{monthName}</h3>
          <span className="text-xs font-mono text-[#8A8278] tracking-wider">
            {String(month + 1).padStart(2, '0')} / 12
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="text-xs h-9 px-3 border border-[#BDB6AB] rounded-none text-[#0E0E0D] bg-white hover:bg-[#F6F2EA] flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Zurück
          </button>
          <button
            onClick={goToday}
            className="text-xs h-9 px-4 border border-[#BDB6AB] rounded-none text-[#0E0E0D] bg-white hover:bg-[#F6F2EA] transition-colors"
          >
            Heute
          </button>
          <button
            onClick={goNext}
            className="text-xs h-9 px-3 border border-[#BDB6AB] rounded-none text-[#0E0E0D] bg-white hover:bg-[#F6F2EA] flex items-center gap-1.5 transition-colors"
          >
            Vor <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px bg-[#BDB6AB]/30 border border-[#BDB6AB]/60">
        {WEEKDAYS.map(d => (
          <div key={d} className="bg-[#D9D2C5] py-2 text-center text-[10px] font-bold text-[#3A3833] uppercase tracking-wider">
            {d}
          </div>
        ))}
        {/* Day cells */}
        {days.map((d, i) => {
          const isOut = d.getMonth() !== month;
          const isToday = sameDay(d, today);
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const dayTasks = byDay[isoKey(d)] || [];
          const visible = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - visible.length;

          return (
            <div
              key={i}
              onClick={() => setSelectedDay(d)}
              className={`
                min-h-[100px] p-1.5 cursor-pointer transition-colors flex flex-col gap-1
                ${isOut ? 'bg-[#F6F2EA]/40 text-[#BDB6AB]' : 'bg-white hover:bg-[#F6F2EA]'}
                ${isToday ? 'ring-2 ring-inset ring-[#A6824A]' : ''}
                ${isWeekend && !isOut ? 'bg-[#F6F2EA]/60' : ''}
              `}
            >
              <div className="flex justify-between items-center">
                <span className={`text-xs font-mono ${isOut ? 'text-[#BDB6AB]' : isToday ? 'font-bold text-[#0E0E0D]' : 'text-[#5C5852]'}`}>
                  {String(d.getDate()).padStart(2, '0')}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[9px] font-mono text-[#8A8278]">{String(dayTasks.length).padStart(2, '0')}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-h-0">
                {visible.map(t => (
                  <div
                    key={t.id}
                    onClick={e => {
                      e.stopPropagation();
                      onEditTask(t);
                    }}
                    title={`${t.kunde} — ${t.aufgabe}`}
                    className={`px-1.5 py-0.5 text-[10px] truncate flex items-center gap-1 ${prioColorClass(t.priorisierung, t.erledigt)} ${t.erledigt ? 'line-through' : ''}`}
                  >
                    <span className="font-bold flex-shrink-0">{getPersonShort(t.person)}</span>
                    <span className="truncate">{t.kunde} · {t.aufgabe}</span>
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="text-[9px] text-[#8A8278] font-mono px-1.5">
                    + {String(overflow).padStart(2, '0')} weitere
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No-deadline summary */}
      {noDateTasks.length > 0 && (
        <div className="mt-4 px-4 py-3 bg-[#F6F2EA]/50 border border-[#BDB6AB]/60 flex items-center gap-3 text-xs">
          <strong className="text-[#0E0E0D] font-mono uppercase tracking-wider">
            Ohne Deadline · {String(noDateTasks.length).padStart(2, '0')}
          </strong>
          <span className="text-[#BDB6AB]">—</span>
          <span className="flex-1 truncate text-[#5C5852]">
            {noDateTasks.slice(0, 4).map(t => `${t.kunde} · ${t.aufgabe}`).join(' / ')}
            {noDateTasks.length > 4 ? ' …' : ''}
          </span>
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-6 bg-white border border-[#BDB6AB]/60 p-6">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#BDB6AB]/40">
            <h3 className="text-xl font-light text-[#0E0E0D] tracking-tight">
              {selectedDay.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-[#8A8278] hover:text-[#0E0E0D] p-2 hover:bg-[#EFEAE0] rounded-none transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="text-sm text-[#8A8278] py-4">Keine Aufgaben mit dieser Deadline.</p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map(t => {
                const status = getDeadlineStatus(t.deadline, !!t.erledigt, todayStr);
                return (
                  <div
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="flex items-center gap-4 p-3 hover:bg-[#F6F2EA] cursor-pointer transition-colors border border-transparent hover:border-[#BDB6AB]/60"
                  >
                    <span className="text-xs font-bold text-[#0E0E0D] w-12 flex-shrink-0">{getPersonShort(t.person)}</span>
                    <span className="text-sm text-[#0E0E0D] font-medium w-40 truncate">{t.kunde}</span>
                    <span className="text-sm text-[#5C5852] flex-1 truncate">
                      {t.aufgabe}{t.bezeichnung ? ` — ${t.bezeichnung}` : ''}
                    </span>
                    {status.kind === 'overdue' && (
                      <span className="text-[#8C3A2E] bg-[#C9A86A]/30 px-1.5 py-0.5 text-xs font-bold rounded-none">{status.label}</span>
                    )}
                    {status.kind === 'today' && (
                      <span className="text-[#4A3526] bg-[#A6824A]/30 px-1.5 py-0.5 text-xs rounded-none">Heute</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
