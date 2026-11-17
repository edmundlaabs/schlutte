import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, X, CircleCheckBig, CheckCircle2, Circle, FileDown, TriangleAlert, Turtle, Copy, List, Calendar as CalendarIcon, GripVertical, CornerDownRight } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, Priority } from '../types';
import { useTasks } from '../hooks/useTasks';
import { usePersons } from '../hooks/usePersons';
import { useCustomers } from '../hooks/useCustomers';
import { v4 as uuidv4 } from '../utils/uuid';
import type { TabType } from '../GerdaApp';
import { generatePDFReport } from '../utils/generatePDF';
import { generateCSVReport } from '../utils/generateCSV';
import { getDeadlineStatus } from '../utils/deadlineStatus';
import { CalendarView } from './CalendarView';

type ViewMode = 'liste' | 'kalender';

// Defined OUTSIDE TaskBoard so React sees a stable component type across renders.
// If defined inside, every keystroke creates a new function reference → React
// unmounts/remounts the subtree → form inputs lose focus.
interface SortableTaskGroupProps {
  task: Task;
  subtasks: Task[];
  idx: number;
  isDragEnabled: boolean;
  isEditing: boolean;
  renderTaskRow: (task: Task, idx: number, dndProps?: any) => React.ReactNode;
}

const SortableTaskGroup: React.FC<SortableTaskGroupProps> = ({ task, subtasks, idx, isDragEnabled, isEditing, renderTaskRow }) => {
  // Disable dragging while this row is expanded for editing — otherwise the
  // edit form (rendered inside this same <tbody>) inherits the drag listeners
  // and any pointer movement in a field starts a drag.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !isDragEnabled || isEditing });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? ('relative' as const) : ('static' as const),
    zIndex: isDragging ? 10 : 1,
    backgroundColor: isDragging ? '#ffffff' : undefined,
    boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : undefined,
  };

  return (
    <tbody ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderTaskRow(task, idx, { isDragEnabled, isDragging, isSubtask: false, showDragColumn: isDragEnabled })}
      {subtasks.map((sub, sIdx) => renderTaskRow(sub, idx + 0.1 * (sIdx + 1), { isDragEnabled: false, isDragging: false, isSubtask: true, showDragColumn: isDragEnabled }))}
    </tbody>
  );
};

interface TaskBoardProps {
  person: TabType;
}

type SortType = 'manual' | 'priority' | 'createdAt' | 'deadline';

export const TaskBoard: React.FC<TaskBoardProps> = ({ person }) => {
  const { getTasksByPerson, getAllTasks, addTask, updateTask, deleteTask, reorderTasks } = useTasks();
  const { persons } = usePersons();
  const { customers, addCustomer, deleteCustomer } = useCustomers();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  // Sorted active persons keeping Eddy last
  const sortedActivePersons = useMemo(() => {
    return [...persons.filter(p => p.active)].sort((a, b) => {
      const aIsEddy = a.name.toUpperCase() === 'EDDY' || (a.shortName || '').toUpperCase() === 'EDDY' || (a.shortName || '').toUpperCase() === 'EDD';
      const bIsEddy = b.name.toUpperCase() === 'EDDY' || (b.shortName || '').toUpperCase() === 'EDDY' || (b.shortName || '').toUpperCase() === 'EDD';
      if (aIsEddy && !bIsEddy) return 1;
      if (!aIsEddy && bIsEddy) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [persons]);
  
  // Local State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortType>(() => {
    const saved = localStorage.getItem('taskboard_sort');
    return (saved as SortType) || 'manual';
  });
  const [showDone, setShowDone] = useState(false);
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');

  useEffect(() => {
    localStorage.setItem('taskboard_sort', sortBy);
  }, [sortBy]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (sortBy !== 'manual' || groupByCustomer) return;

    // Only reorder top-level tasks — subtasks follow their parent automatically
    const oldIndex = topLevelTasks.findIndex(t => t.id === active.id);
    const newIndex = topLevelTasks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = [...topLevelTasks];
      const [movedTask] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, movedTask);

      // Assign order to top-level tasks; subtasks inherit parent order
      const updates: { id: string; order: number }[] = [];
      reordered.forEach((t, idx) => {
        updates.push({ id: t.id, order: idx });
        // Also update subtasks so they stay grouped with their parent
        const subs = subtasksMap[t.id];
        if (subs) {
          subs.forEach((sub, sIdx) => {
            updates.push({ id: sub.id, order: idx * 1000 + sIdx + 1 });
          });
        }
      });
      reorderTasks(updates);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close form/clear editing
      if (e.key === 'Escape') {
        e.preventDefault();
        resetForm();
      }
      // Ctrl+N or Cmd+N: Start new task
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        resetForm();
        setIsAdding(true);
      }
      // /: Focus search (only if not in input/textarea)
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const duplicateTask = async (task: Task) => {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      erledigt: false,
    };
    await addTask(newTask);
  };
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [kommissionsNummer, setKommissionsNummer] = useState('');
  const [kunde, setKunde] = useState('');
  const [priorisierung, setPriorisierung] = useState<Priority>(2);
  const [bezeichnung, setBezeichnung] = useState('');
  const [aufgabe, setAufgabe] = useState('');
  const [eingetragenAm, setEingetragenAm] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState('');
  const isOverview = person === 'Alle';
  const fullPersonName = isOverview ? 'Alle' : (persons.find(p => p.shortName === person)?.name || person);
  const [assignedPerson, setAssignedPerson] = useState(person === 'Alle' ? '' : fullPersonName);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const rawTasks = isOverview ? getAllTasks() : getTasksByPerson(fullPersonName);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  // Extract all unique tasks to build the Tag Cloud
  const allExistingTags = useMemo(() => {
    const all = getAllTasks();
    const tagCount: Record<string, number> = {};
    all.forEach(t => {
      if (t.aufgabe) tagCount[t.aufgabe] = (tagCount[t.aufgabe] || 0) + 1;
    });
    // Sort by most frequent
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 8); // top 8
  }, [getAllTasks]);

  // Sorting AND Filtering logic
  const tasks = useMemo(() => {
    let result = [...rawTasks];
    
    // Sort logic
    result.sort((a, b) => {
      if (sortBy === 'manual') {
        const orderA = a.order ?? 999999;
        const orderB = b.order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'priority') {
        if (a.priorisierung !== b.priorisierung) return a.priorisierung - b.priorisierung;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      } else if (sortBy === 'createdAt') {
        const timeA = a.eingetragenAm ? new Date(a.eingetragenAm).getTime() : 0;
        const timeB = b.eingetragenAm ? new Date(b.eingetragenAm).getTime() : 0;
        return timeA - timeB;
      } else if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1; // push empty deadlines to bottom
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });

    // Filter logic
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(t => 
        (t.kommissionsNummer || '').toLowerCase().includes(s) ||
        (t.kunde || '').toLowerCase().includes(s) ||
        (t.bezeichnung || '').toLowerCase().includes(s) ||
        (t.aufgabe || '').toLowerCase().includes(s) ||
        (isOverview && (t.person || '').toLowerCase().includes(s))
      );
    }

    if (selectedCustomer) {
      result = result.filter(t => t.kunde === selectedCustomer);
    }

    // Hide done filter
    if (!showDone) {
      result = result.filter(t => !t.erledigt);
    }

    return result;
  }, [rawTasks, sortBy, searchTerm, isOverview, showDone, selectedCustomer]);

  const topLevelTasks = useMemo(() => tasks.filter(t => !t.parentId), [tasks]);
  const subtasksMap = useMemo(() => {
    return tasks.filter(t => t.parentId).reduce((acc, t) => {
      if (!acc[t.parentId!]) acc[t.parentId!] = [];
      acc[t.parentId!].push(t);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    if (!groupByCustomer) return null;
    
    // Group tasks by customer
    const groups: Record<string, Task[]> = {};
    tasks.forEach(task => {
      const c = task.kunde || 'Kein Kunde';
      if (!groups[c]) groups[c] = [];
      groups[c].push(task);
    });
    
    return groups;
  }, [tasks, groupByCustomer]);

  const handleKommNummerChange = (val: string) => {
    // Only allow numbers, max 6 digits
    const numericVal = val.replace(/\D/g, '').substring(0, 6);
    setKommissionsNummer(numericVal);
  };

  const resetForm = () => {
    setKommissionsNummer('');
    setKunde('');
    setPriorisierung(2);
    setBezeichnung('');
    setAufgabe('');
    setEingetragenAm(new Date().toISOString().split('T')[0]);
    setDeadline('');
    setAssignedPerson(person === 'Alle' ? (sortedActivePersons[0]?.name || '') : (person as string));
    setParentId(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!kunde) return;
    
    // If user enters a date in eingetragenAm, but it's empty, fallback to today.
    const finalEingetragenAm = eingetragenAm || new Date().toISOString().split('T')[0];

    const finalPerson = assignedPerson || (person as string);

    if (kunde.trim()) {
      addCustomer(kunde.trim());
    }

    if (editingId) {
      updateTask(editingId, { 
        person: finalPerson,
        kommissionsNummer, 
        kunde, 
        priorisierung, 
        bezeichnung, 
        aufgabe, 
        eingetragenAm: finalEingetragenAm, 
        deadline: deadline || '',
        parentId: parentId || ''
      });
    } else {
      addTask({
        id: uuidv4(),
        person: finalPerson,
        kommissionsNummer,
        kunde,
        priorisierung,
        bezeichnung,
        aufgabe,
        eingetragenAm: finalEingetragenAm,
        deadline: deadline || '',
        createdAt: new Date().toISOString(),
        parentId: parentId || '',
        erledigt: false
      });
    }
    resetForm();
  };

  const startEdit = (task: Task) => {
    if (editingId === task.id) {
      resetForm();
    } else {
      setEditingId(task.id);
      setKommissionsNummer(task.kommissionsNummer);
      setKunde(task.kunde);
      setPriorisierung(task.priorisierung);
      setBezeichnung(task.bezeichnung);
      setAufgabe(task.aufgabe);
      setEingetragenAm(task.eingetragenAm || new Date(task.createdAt).toISOString().split('T')[0]);
      setDeadline(task.deadline || '');
      setAssignedPerson(task.person);
      setParentId(task.parentId || null);
      setIsAdding(true);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const renderForm = () => (
    <div className="bg-white border border-[#BDB6AB]/60 relative overflow-visible z-10 p-8 mb-6">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-[#A6824A]/10 blur-3xl pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-6 relative">
         <h3 className="text-xl tracking-tight text-[#0E0E0D] font-light">
           {editingId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
         </h3>
         <button onClick={resetForm} className="text-[#8A8278] hover:text-[#0E0E0D] p-2 hover:bg-[#EFEAE0] rounded-none transition-colors">
           <X className="w-5 h-5" />
         </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5 relative">
        <div>
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Eingetragen am</label>
          <input type="date" className="w-full solnest-input text-sm" value={eingetragenAm} onChange={(e) => setEingetragenAm(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2 flex items-center gap-2">Komm.-Nr. <span className="lowercase font-normal opacity-50 text-[10px]">(Optional)</span></label>
          <input type="text" className="w-full solnest-input text-sm" value={kommissionsNummer} onChange={(e) => handleKommNummerChange(e.target.value)} placeholder="000000" />
        </div>
        <div className="lg:col-span-2 relative">
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2 flex items-center gap-1">Kunde / Bauvorhaben <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            className="w-full solnest-input text-sm" 
            value={kunde} 
            onChange={(e) => { setKunde(e.target.value); setIsCustomerDropdownOpen(true); }} 
            onFocus={() => setIsCustomerDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
            placeholder="Name" 
          />
          {isCustomerDropdownOpen && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#BDB6AB] shadow-lg max-h-48 overflow-y-auto">
              {customers
                .filter(c => c.toLowerCase().includes(kunde.toLowerCase()))
                .map(c => (
                  <div key={c} className="flex justify-between items-center px-4 py-2 hover:bg-[#F6F2EA] cursor-pointer text-sm">
                    <span className="flex-1" onClick={() => { setKunde(c); setIsCustomerDropdownOpen(false); }}>{c}</span>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (window.confirm(`Kunde "${c}" aus der Liste löschen?`)) {
                          deleteCustomer(c);
                        }
                      }} 
                      className="text-[#8A8278] hover:text-[#8C3A2E] p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {customers.filter(c => c.toLowerCase().includes(kunde.toLowerCase())).length === 0 && kunde.trim() && (
                <div className="px-4 py-2 text-xs text-[#8A8278]">
                  Neu: "{kunde}" (wird beim Speichern hinzugefügt)
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Priorität</label>
          <select className="w-full solnest-input text-sm font-medium" value={priorisierung} onChange={(e) => setPriorisierung(Number(e.target.value) as Priority)}>
            <option value={1}>1 - Hoch</option>
            <option value={2}>2 - Mittel</option>
            <option value={3}>3 - Niedrig</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2 flex items-center gap-2">Deadline <span className="lowercase font-normal opacity-50 text-[10px]">(Optional)</span></label>
          <input type="date" className="w-full solnest-input text-sm" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Aufgabenart</label>
          <input type="text" list="aufgabe-list" className="w-full solnest-input text-sm" value={aufgabe} onChange={(e) => setAufgabe(e.target.value)} placeholder="z.B. Planen / AV" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {allExistingTags.map(tag => (
              <button
                key={tag}
                onClick={() => setAufgabe(tag)}
                className="px-2.5 py-1 text-[12px] font-mono tracking-wide bg-[#F6F2EA] hover:border-[rgba(14,14,13,0.22)] hover:text-[#0E0E0D] text-[#5C5852] rounded-none transition-colors border border-[rgba(14,14,13,0.10)]"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Zuweisung</label>
          <select className="w-full solnest-input text-sm" value={assignedPerson} onChange={(e) => setAssignedPerson(e.target.value)}>
            {sortedActivePersons.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Teilaufgabe von</label>
          <select className="w-full solnest-input text-sm" value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)}>
            <option value="">(Keine)</option>
            {topLevelTasks.map(t => (
              <option key={t.id} value={t.id}>{t.kommissionsNummer ? `${t.kommissionsNummer} - ` : ''}{t.kunde || 'Unbekannt'}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] mb-2">Bezeichnung / Details</label>
          <input type="text" className="w-full solnest-input text-sm" value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="Details eingeben..." />
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3 relative">
        <button onClick={handleSave} disabled={!kunde} className="solnest-btn-primary transition-shadow duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
          <CircleCheckBig className="w-4 h-4" /> Speichern
        </button>
      </div>
    </div>
  );


  const renderTaskRow = (task: Task, idx: number = 0, dndProps?: any) => {
    const isDone = task.erledigt;
    const isSubtask = dndProps?.isSubtask;
    const isLate = !isDone && task.deadline && task.deadline < todayStr;
    const prioColor =
      task.priorisierung === 1 ? '#ff0049' :
      task.priorisierung === 2 ? '#ffb92e' :
      task.priorisierung === 3 ? '#659900' : '#969696';
    const trClasses = `relative transition-colors duration-150 group hover:bg-white cursor-pointer border-b border-[rgba(14,14,13,0.06)] ${isDone ? 'opacity-50' : ''} ${isSubtask ? 'bg-[#F9F7F3]' : ''}`;

    const TrComponent: any = dndProps?.isDragEnabled ? 'tr' : motion.tr;
    const motionProps = dndProps?.isDragEnabled ? {} : {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3, delay: idx * 0.05 }
    };

    return (
      <React.Fragment key={task.id}>
        <TrComponent
          ref={dndProps?.setNodeRef}
          style={dndProps?.style}
          {...motionProps}
          className={trClasses}
          onClick={() => startEdit(task)}>
          {dndProps?.showDragColumn && (
            <td className="w-8 p-0 text-center align-middle" onClick={(e) => e.stopPropagation()}>
              {dndProps?.isDragEnabled && (
                <button
                  {...dndProps?.attributes}
                  {...dndProps?.listeners}
                  className="text-[#8A8278] hover:text-[#0E0E0D] cursor-grab active:cursor-grabbing p-1"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
            </td>
          )}
          {/* Prio bar — thin 3px stripe left, 8px inset (MVP-style) */}
          <td className="w-1 p-0 relative">
            <span
              className="absolute left-0 top-2 bottom-2 w-[3px]"
              style={{ background: prioColor }}
              aria-hidden="true"
            />
          </td>

          {isOverview && (
            <td className="px-3 py-4 whitespace-nowrap text-xs font-mono font-medium tracking-[0.12em] text-[#0E0E0D]">
              <div className="flex items-center gap-1.5">
                <span className={isDone ? 'opacity-50' : ''}>
                  {(persons.find(p => p.name === task.person)?.shortName || task.person).slice(0, 3).toUpperCase()}
                </span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#6B7A5A] flex-shrink-0" />}
              </div>
            </td>
          )}

          <td className={`px-3 py-4 whitespace-nowrap text-sm text-[#0E0E0D] font-medium tracking-tight ${isSubtask ? 'pl-8' : ''}`}>
            {isSubtask && <CornerDownRight className="w-4 h-4 inline-block mr-2 text-[#8A8278]" />}
            {task.kunde || 'Kein Kunde'}
          </td>

          {/* Aufgabe */}
          <td className={`px-3 py-4 whitespace-nowrap text-sm truncate ${isDone ? 'line-through text-[#8A8278]' : 'text-[#0E0E0D]'}`}>
            {task.aufgabe}
          </td>

          {/* Bemerkung */}
          <td className={`px-3 py-4 text-sm ${isDone ? 'line-through text-[#8A8278]' : 'text-[#5C5852]'}`} title={task.bezeichnung}>
            <div className="line-clamp-2 whitespace-normal leading-snug">
              {task.bezeichnung}
            </div>
          </td>

          <td className={`px-3 py-4 whitespace-nowrap text-xs font-mono text-right truncate ${isDone ? 'line-through text-[#8A8278]' : 'text-[#5C5852]'}`}>
            <div className="flex items-center justify-end gap-1.5">
              <span className="truncate">{task.kommissionsNummer || '–'}</span>
              {!isOverview && isDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#6B7A5A] flex-shrink-0" />}
            </div>
          </td>

          {/* Eingetragen am -> EINTRAG (mono, right-aligned) */}
          <td className={`px-3 py-4 whitespace-nowrap text-xs font-mono text-right truncate ${isDone ? 'line-through' : ''} text-[#8A8278]`}>
            {formatDate(task.eingetragenAm)}
          </td>

          {/* Deadline */}
          <td className="px-3 py-4 whitespace-nowrap text-xs font-mono text-right truncate">
            {task.deadline && (
              <span className={isLate ? 'text-[#8C3A2E] font-medium' : 'text-[#8A8278]'}>
                {formatDate(task.deadline)}
              </span>
            )}
            {!task.deadline && <span className="text-[#BDB6AB]">–</span>}
          </td>

          {/* Status (deadline chip) */}
          <td className="px-3 py-4 whitespace-nowrap text-xs truncate relative">
            {(() => {
              const status = getDeadlineStatus(task.deadline, !!isDone, todayStr);
              switch (status.kind) {
                case 'none':
                  return <span className="text-[#BDB6AB]">–</span>;
                case 'done':
                  return <span className="font-mono text-[#6B7A5A]">Erledigt</span>;
                case 'overdue':
                  return <span className="font-mono inline-flex items-center px-2 py-1 bg-[#8C3A2E]/12 text-[#8C3A2E] font-medium tracking-wide">{status.label}</span>;
                case 'today':
                  return <span className="font-mono inline-flex items-center px-2 py-1 bg-[#B58C4A]/18 text-[#3A3833] font-medium tracking-wide">Heute</span>;
                case 'tomorrow':
                  return <span className="font-mono inline-flex items-center px-2 py-1 bg-white border border-[rgba(14,14,13,0.10)] text-[#5C5852] tracking-wide">Morgen</span>;
                case 'soon':
                  return <span className="font-mono inline-flex items-center px-2 py-1 bg-white border border-[rgba(14,14,13,0.10)] text-[#5C5852] tracking-wide">{status.label}</span>;
                case 'far':
                  return <span className="font-mono text-[#8A8278] tracking-wide">{status.label}</span>;
              }
            })()}

            {/* Hover actions — MVP-style floating box right.
                On touch devices (no hover) the buttons are always visible &
                tappable — otherwise delete/duplicate/done are unreachable there. */}
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-white border border-[rgba(14,14,13,0.10)] p-1 shadow-[0_1px_2px_rgba(14,14,13,0.04)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => updateTask(task.id, { erledigt: !task.erledigt })}
                className={`w-7 h-7 inline-flex items-center justify-center transition-colors ${isDone ? 'text-[#8A8278] hover:text-[#0E0E0D] hover:bg-[#F6F2EA]' : 'text-[#5C5852] hover:text-[#6B7A5A] hover:bg-[#F6F2EA]'}`}
                title={isDone ? "Als unerledigt markieren" : "Als erledigt markieren"}
              >
                {isDone ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => duplicateTask(task)}
                className="w-7 h-7 inline-flex items-center justify-center text-[#5C5852] hover:text-[#0E0E0D] hover:bg-[#F6F2EA] transition-colors"
                title="Aufgabe duplizieren"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Verifiziert: Aufgabe löschen?')) {
                    deleteTask(task.id);
                  }
                }}
                className="w-7 h-7 inline-flex items-center justify-center text-[#5C5852] hover:text-[#8C3A2E] hover:bg-[#F6F2EA] transition-colors"
                title="Aufgabe löschen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </TrComponent>
        <AnimatePresence>
        {editingId === task.id && (
          <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <td colSpan={12} className="p-0">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                {renderForm()}
              </motion.div>
            </td>
          </motion.tr>
        )}
        </AnimatePresence>
      </React.Fragment>
    );
  };

  const renderMobileCard = (task: Task) => {
    const isDone = task.erledigt;
    const isLate = !isDone && task.deadline && task.deadline < todayStr;
    
    return (
      <React.Fragment key={task.id}>
        <div className={`bg-white/80 p-4 rounded-none border border-[#BDB6AB]/60 shadow-sm transition-all ${isDone ? 'opacity-60 grayscale-[0.3]' : ''} ${isLate ? 'border-red-200 bg-red-50/50' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#0E0E0D]">{task.kommissionsNummer || '-'}</span>
            <span title={task.priorisierung === 1 ? 'Hoch' : task.priorisierung === 2 ? 'Mittel' : 'Niedrig'} className={`px-2 py-1.5 rounded-none flex items-center justify-center text-white ${task.priorisierung === 1 ? 'bg-[#ff0049]' : task.priorisierung === 2 ? 'bg-[#ffb92e]' : 'bg-[#659900]'}`}>
              {task.priorisierung === 1 && <TriangleAlert className="w-3.5 h-3.5" />}
              {task.priorisierung === 2 && <Circle className="w-3.5 h-3.5 fill-current" />}
              {task.priorisierung === 3 && <Turtle className="w-4 h-4" />}
            </span>
          </div>
          {/* Fertig In */}
          <div className="text-xs font-semibold">
            {(() => {
                const status = getDeadlineStatus(task.deadline, !!isDone, todayStr);
                switch (status.kind) {
                  case 'none':
                    return <span className="text-[#8A8278]">-</span>;
                  case 'done':
                    return <span className="text-[#6B7A5A]">Erledigt</span>;
                  case 'overdue':
                    return <span className="text-[#8C3A2E] bg-[#C9A86A]/30 px-1.5 py-0.5 rounded-none">{status.label}</span>;
                  case 'today':
                    return <span className="text-[#4A3526] bg-[#A6824A]/30 px-1.5 py-0.5 rounded-none">Heute</span>;
                  case 'tomorrow':
                    return <span className="text-[#4A5938]">Morgen</span>;
                  case 'soon':
                  case 'far':
                    return <span className="text-[#4A5938]">{status.label}</span>;
                }
            })()}
          </div>
        </div>
        
        <div className="mb-2">
          <div className={`text-sm font-semibold cursor-pointer ${isDone ? 'line-through text-[#8A8278]' : 'text-[#0E0E0D]'}`} onClick={() => startEdit(task)}>
            {task.kunde}{task.aufgabe ? <> <span className="text-[#8A8278] font-normal mx-1">|</span> {task.aufgabe} </> : ''}
          </div>
          {task.bezeichnung && (
            <div className={`text-sm mt-1 ${isDone ? 'text-[#8A8278]' : 'text-[#5C5852]'}`}>
              {task.bezeichnung}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#BDB6AB]/30">
          <div className="flex items-center gap-3 text-xs text-[#8A8278]">
            {isOverview && <span>👤 {task.person}</span>}
            <span>📅 {formatDate(task.eingetragenAm)}</span>
          </div>
          
            <div className="flex gap-1">
              <button onClick={() => updateTask(task.id, { erledigt: !task.erledigt })} className="p-1.5 text-[#6B7A5A] hover:bg-[#6B7A5A]/20 rounded-none">
                {isDone ? <Circle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
              <button onClick={() => startEdit(task)} className="p-1.5 text-[#8A8278] hover:bg-[#BDB6AB]/30 rounded-none">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => duplicateTask(task)} className="p-1.5 text-[#8A8278] hover:bg-[#BDB6AB]/30 rounded-none" title="Duplizieren">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={() => { if (window.confirm('Verifiziert: Aufgabe löschen?')) deleteTask(task.id); }} className="p-1.5 text-[#8C3A2E] hover:bg-[#C9A86A]/30 rounded-none">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
        </div>
      </div>
      <AnimatePresence>
      {editingId === task.id && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
          {renderForm()}
        </motion.div>
      )}
      </AnimatePresence>
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      
      {/* Title row + Toolbar row (MVP-style: separate rows for full width) */}
      <div className="flex flex-col gap-6 pb-4 border-b border-[#BDB6AB]/60">

        {/* Title Area — full width on its own row */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-4 w-full">
          <div>
            {/* Eyebrow with Brass-Rule */}
            <div className="flex items-center gap-3 mb-3 text-[11px] font-mono uppercase tracking-[0.12em] text-[#8A8278]">
              <span className="block w-8 h-px bg-[#A6824A]" aria-hidden="true" />
              <span>
                {isOverview ? 'Übersicht' : 'Mitarbeiter'}
                <span className="mx-2 text-[#BDB6AB]">·</span>
                {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                <span className="mx-2 text-[#BDB6AB]">·</span>
                {rawTasks.filter(t => !t.erledigt).length.toString().padStart(2, '0')} {isOverview ? 'offene Aufgaben' : 'offen'}
              </span>
            </div>
            <h2
              className="font-light text-[#0E0E0D] tracking-tight flex items-start gap-2 mb-3 leading-[1.05]"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}
            >
              {isOverview ? (
                <>Gesamtübersicht <span className="text-sm font-light text-[#0E0E0D] border border-[#0E0E0D] px-1.5 py-0.5 ml-2 mt-[4px] leading-none tracking-widest">ALLE</span></>
              ) : (
                <>
                  {(() => {
                    const personObj = persons.find(p => p.name === person || p.shortName === person);
                    const displayName = personObj?.name || person;
                    const displayShort = (personObj?.shortName || person).slice(0, 3).toUpperCase();
                    return (
                      <span className="inline-flex items-start gap-2">
                        <span>{displayName}</span>
                        <span className="text-[11px] font-light text-[#0E0E0D] border border-[#0E0E0D] px-1 py-0.5 uppercase leading-none mt-[6px] select-none tracking-wide">
                          {displayShort}
                        </span>
                      </span>
                    );
                  })()}
                </>
              )}
            </h2>
            <p className="text-xs text-[#8A8278]">
              {isOverview 
                ? 'Die aktuelle Übersicht aller Mitarbeiter-Aufgaben' 
                : 'Ihre aktuelle Workflow-Zusammenfassung und Aktivität'}
            </p>
          </div>

          {!isOverview && (() => {
            const open = rawTasks.filter(t => !t.erledigt);
            const hoch = open.filter(t => t.priorisierung === 1).length;
            const mittel = open.filter(t => t.priorisierung === 2).length;
            const niedrig = open.filter(t => t.priorisierung === 3).length;
            const ueberfaellig = open.filter(t => t.deadline && t.deadline < todayStr).length;
            const erledigt = rawTasks.filter(t => t.erledigt).length;
            const pad = (n: number) => String(n).padStart(2, '0');
            const labelCls = "text-[10px] font-mono uppercase tracking-[0.22em] text-[#8A8278]";
            const valueBase = "font-light text-[32px] leading-none tracking-tight";
            return (
              <div className="grid grid-cols-5 gap-8 items-end">
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Prio hoch</span>
                  <span className={`${valueBase} ${hoch > 0 ? 'text-[#ff0049]' : 'text-[#969696]'}`}>{pad(hoch)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Prio mittel</span>
                  <span className={`${valueBase} ${mittel > 0 ? 'text-[#ffb92e]' : 'text-[#969696]'}`}>{pad(mittel)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>Prio niedrig</span>
                  <span className={`${valueBase} ${niedrig > 0 ? 'text-[#659900]' : 'text-[#969696]'}`}>{pad(niedrig)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>
                    <span className="hidden md:inline">Überfällig</span>
                    <span className="md:hidden">Über-<br />fällig</span>
                  </span>
                  <span className={`${valueBase} ${ueberfaellig > 0 ? 'text-[#ff0049]' : 'text-[#969696]'}`}>{pad(ueberfaellig)}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={labelCls}>
                    <span className="hidden md:inline">Erledigt</span>
                    <span className="md:hidden">Er-<br />ledigt</span>
                  </span>
                  <span className={`${valueBase} text-[#8A8278]`}>{pad(erledigt)}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Controls — full width row beneath the title */}
        <div className="flex w-full flex-wrap items-center gap-3">
          {/* View Mode Toggle (Liste / Kalender) */}
          <div className="flex items-center border border-[#BDB6AB] bg-white h-9" role="tablist" aria-label="Ansichtsmodus">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'liste'}
              onClick={() => setViewMode('liste')}
              className={`flex items-center gap-1.5 px-3 h-full text-xs transition-colors ${viewMode === 'liste' ? 'bg-[#0E0E0D] text-white' : 'text-[#5C5852] hover:bg-[#F6F2EA]'}`}
              title="Listen-Ansicht"
            >
              <List className="w-3.5 h-3.5" /> Liste
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'kalender'}
              onClick={() => setViewMode('kalender')}
              className={`flex items-center gap-1.5 px-3 h-full text-xs transition-colors border-l border-[#BDB6AB] ${viewMode === 'kalender' ? 'bg-[#0E0E0D] text-white' : 'text-[#5C5852] hover:bg-[#F6F2EA]'}`}
              title="Kalender-Ansicht"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Kalender
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#8A8278]" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="block w-full h-9 pl-9 pr-3 text-xs border border-[#BDB6AB] bg-white rounded-none outline-none focus:outline-none focus:border-[#BDB6AB] focus:ring-2 focus:ring-[#BDB6AB]/20 transition-all text-[#0E0E0D]"
              placeholder={isOverview ? "Suchen..." : "Suchen..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-44 whitespace-nowrap">
            <select
              className="block w-full h-9 pl-3 pr-8 text-xs font-medium tracking-wide appearance-none cursor-pointer border border-[rgba(14,14,13,0.10)] bg-white hover:border-[rgba(14,14,13,0.22)] transition-colors rounded-none outline-none focus:border-[#A6824A] focus:ring-2 focus:ring-[#A6824A]/20 text-[#0E0E0D]"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              style={{
                backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%238A8278' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              <option value="manual">↑↓ Manuell</option>
              <option value="priority">↑↓ Nach Prio</option>
              <option value="createdAt">↑↓ Nach Eingabe</option>
              <option value="deadline">↑↓ Nach Deadline</option>
            </select>
          </div>

          <div className="relative w-full sm:w-44 whitespace-nowrap">
            <select
              className="block w-full h-9 pl-3 pr-8 text-xs font-medium tracking-wide appearance-none cursor-pointer border border-[rgba(14,14,13,0.10)] bg-white hover:border-[rgba(14,14,13,0.22)] transition-colors rounded-none outline-none focus:border-[#A6824A] focus:ring-2 focus:ring-[#A6824A]/20 text-[#0E0E0D]"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              style={{
                backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%238A8278' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              <option value="">Kunde: Alle</option>
              {customers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 h-9">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="showDone" 
                checked={showDone} 
                onChange={(e) => setShowDone(e.target.checked)}
                className="rounded-none border-[#BDB6AB] text-[#0E0E0D] focus:ring-[#0E0E0D] w-4 h-4"
              />
              <label htmlFor="showDone" className="text-xs text-[#5C5852] cursor-pointer whitespace-nowrap">Erledigte einblenden</label>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="groupByCustomer" 
                checked={groupByCustomer} 
                onChange={(e) => setGroupByCustomer(e.target.checked)}
                className="rounded-none border-[#BDB6AB] text-[#0E0E0D] focus:ring-[#0E0E0D] w-4 h-4"
              />
              <label htmlFor="groupByCustomer" className="text-xs text-[#5C5852] cursor-pointer whitespace-nowrap">Nach Kunde gruppieren</label>
            </div>
          </div>

          {!isOverview && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => generateCSVReport(tasks, `Report_${person}`)}
                className="text-xs h-9 px-4 border border-[#BDB6AB] rounded-none text-[#0E0E0D] bg-white hover:bg-[#F6F2EA] flex items-center gap-1.5 whitespace-nowrap transition-colors justify-center"
                title="Als CSV exportieren (Excel-kompatibel)"
              >
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => generatePDFReport(tasks, `Report ${person}`)}
                className="text-xs h-9 px-4 border border-[#BDB6AB] rounded-none text-[#0E0E0D] bg-white hover:bg-[#F6F2EA] flex items-center gap-1.5 whitespace-nowrap transition-colors justify-center"
              >
                <FileDown className="w-3.5 h-3.5" /> Export
              </button>
              <button
                onClick={() => { resetForm(); setIsAdding(true); }}
                className="solnest-btn-primary transition-shadow duration-300 hover:shadow-md text-xs h-9 px-4 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span className="whitespace-nowrap">Neu</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {viewMode === 'kalender' ? (
        <CalendarView tasks={tasks} persons={persons} onEditTask={startEdit} />
      ) : (
      <>
      {/* Form Area moved into Table */}
              {/* Mobile Card View (< md) */}
      <div className="block md:hidden pb-4 space-y-4 p-4 bg-white/20">
        <AnimatePresence>
        {isAdding && !editingId && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
            {renderForm()}
          </motion.div>
        )}
        </AnimatePresence>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-[#8A8278] py-10">
            <div className="bg-[#D9D2C5]/50 rounded-full p-4 mb-4">
              <CircleCheckBig className="h-8 w-8 text-[#5C5852]" />
            </div>
            <p className="font-medium text-[#0E0E0D]">Keine Aufgaben</p>
          </div>
        ) : (
          groupByCustomer && groupedTasks ? (
            Object.entries(groupedTasks).map(([customerName, customerTasks], index) => (
              <React.Fragment key={customerName}>
                {/* Mobile Customer Group Header */}
                <div className={`bg-[#F6F2EA] px-4 py-4 border-y border-[#BDB6AB]/60 font-bold text-sm text-[#0E0E0D] uppercase tracking-wider ${index > 0 ? 'mt-10' : 'mt-2'}`}>
                  Kunde: <span className="text-[#8C3A2E] font-black">{customerName}</span> ({customerTasks.length} {customerTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'})
                </div>
                <div className="space-y-4 pl-2 border-l border-[#BDB6AB]/40">
                  {customerTasks.map((task) => renderMobileCard(task))}
                </div>
              </React.Fragment>
            ))
          ) : (
            tasks.map((task) => renderMobileCard(task))
          )
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-hidden flex-1 relative z-0">
        <div className="overflow-x-auto h-full w-full">
          <table className="w-full table-fixed border-collapse" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <thead>
              <tr className="border-b border-[rgba(14,14,13,0.10)]">
                {sortBy === 'manual' && !groupByCustomer && <th className="w-8 p-0"></th>}
                <th className="w-1 p-0">
                  <span className="sr-only">Prio</span>
                </th>
                {isOverview && <th className="px-3 py-3 text-left text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[60px]">MA</th>}
                <th className="px-3 py-3 text-left text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[15%]">Kunde</th>
                <th className="px-3 py-3 text-left text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[15%]">Aufgabe</th>
                <th className="px-3 py-3 text-left text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-auto">Bemerkung</th>
                <th className="px-3 py-3 text-right text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[90px]">Komm.</th>
                <th className="px-3 py-3 text-right text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[100px]">Eintrag</th>
                <th className="px-3 py-3 text-right text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[100px]">Deadline</th>
                <th className="px-3 py-3 text-left text-[10px] font-mono font-normal text-[#8A8278] uppercase tracking-[0.22em] w-[130px]">Fällig</th>
              </tr>
            </thead>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={topLevelTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence>
                {isAdding && !editingId && (
                  <motion.tbody initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <tr>
                      <td colSpan={12} className="p-0">
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                          {renderForm()}
                        </motion.div>
                      </td>
                    </tr>
                  </motion.tbody>
                )}
                </AnimatePresence>
                {topLevelTasks.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={12} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8A8278]">
                            — Leere Liste —
                          </span>
                          <p className="text-2xl font-light tracking-tight text-[#0E0E0D]">Keine Aufgaben gefunden</p>
                          <p className="text-sm text-[#8A8278]">Genieße die freie Zeit.</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                ) : (
                  groupByCustomer && groupedTasks ? (
                    Object.entries(groupedTasks).map(([customerName, customerTasks], index) => (
                      <React.Fragment key={customerName}>
                        {/* Empty spacer row for larger distance between customer blocks */}
                        {index > 0 && (
                          <tbody>
                            <tr className="h-10 bg-transparent pointer-events-none">
                              <td colSpan={12} className="border-none py-4"></td>
                            </tr>
                          </tbody>
                        )}
                        <tbody>
                          <tr>
                            <td colSpan={12} className="pt-8 pb-2 px-3 align-baseline">
                              <div className="flex items-baseline gap-3">
                                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#8A8278]">
                                  Kunde
                                </span>
                                <span className="text-xl font-light tracking-tight text-[#0E0E0D]">
                                  {customerName}
                                </span>
                                <span className="ml-auto text-[10px] font-mono tracking-wider text-[#8A8278]">
                                  {String(customerTasks.length).padStart(2, '0')} {customerTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                        {customerTasks.filter(t => !t.parentId).map((task, idx) => (
                          <SortableTaskGroup key={task.id} task={task} subtasks={subtasksMap[task.id] || []} idx={idx} isDragEnabled={sortBy === 'manual' && !groupByCustomer} isEditing={editingId === task.id} renderTaskRow={renderTaskRow} />
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    topLevelTasks.map((task, idx) => (
                      <SortableTaskGroup key={task.id} task={task} subtasks={subtasksMap[task.id] || []} idx={idx} isDragEnabled={sortBy === 'manual' && !groupByCustomer} isEditing={editingId === task.id} renderTaskRow={renderTaskRow} />
                    ))
                  )
                )}
              </SortableContext>
            </DndContext>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
