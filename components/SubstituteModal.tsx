import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { GlassButton } from './GlassButton';
import { GlassSelect } from './ui/GlassSelect';
import { useAppContext } from '../hooks/useAppContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services';
import type { ClassAssignment, Faculty, Subject, Substitution } from '../types';
import { Loader2, CheckCircle, Award, Calendar, BookOpen } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface SubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (substitution: Omit<Substitution, 'id'>) => void;
  targetAssignment: ClassAssignment;
}

interface RankedSubstitute {
    facultyId: string;
    score: number;
    reasons: string[];
    canTeachOriginalSubject: boolean;
    alternativeSubjectIds: string[];
}

export const SubstituteModal: React.FC<SubstituteModalProps> = ({ isOpen, onClose, onConfirm, targetAssignment }) => {
  const { faculty, subjects } = useAppContext();
  const [rankedSubstitutes, setRankedSubstitutes] = useState<RankedSubstitute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<{ facultyId: string; subjectId: string; } | null>(null);
  const [dateRange, setDateRange] = useState({ 
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
  });
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      const find = async () => {
        setIsLoading(true);
        try {
          const results = await api.findSubstitutes(targetAssignment.id);
          setRankedSubstitutes(results);
        } catch (e: any) {
          toast.error(e.message || "Failed to find substitutes.");
        } finally {
          setIsLoading(false);
        }
      };
      find();
    } else {
        setRankedSubstitutes([]);
        setSelectedSubstitute(null);
    }
  }, [isOpen, targetAssignment.id, toast]);

  const getFacultyDetails = (facultyId: string) => faculty.find(f => f.id === facultyId);
  const getSubjectDetails = (subjectId: string) => subjects.find(s => s.id === subjectId);

  const handleSelectSubstitute = (sub: RankedSubstitute) => {
    let subjectIdToSet = targetAssignment.subjectId;
    if (!sub.canTeachOriginalSubject) {
        subjectIdToSet = sub.alternativeSubjectIds.length > 0 
            ? sub.alternativeSubjectIds[0] 
            : (getFacultyDetails(sub.facultyId)?.subjectIds[0] || '');
    }
    setSelectedSubstitute({
        facultyId: sub.facultyId,
        subjectId: subjectIdToSet,
    });
  };

  const handleSubjectChange = (subjectId: string | number) => {
    if (selectedSubstitute) {
        setSelectedSubstitute(prev => prev ? { ...prev, subjectId: String(subjectId) } : null);
    }
  };

  const handleSubmit = () => {
    if (!selectedSubstitute) {
        toast.error("Please select a substitute teacher.");
        return;
    }
    if (!selectedSubstitute.subjectId) {
        toast.error("Could not determine a valid subject for this substitute. Please check their profile.");
        return;
    }
    if (!dateRange.startDate || !dateRange.endDate || new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
        toast.error("Please select a valid date range.");
        return;
    }
    // FIX: Use `facultyIds[0]` as the `ClassAssignment` type was updated for multi-teacher support.
    // Since this modal only opens for single-teacher classes, `facultyIds[0]` is the correct value.
    const originalFacultyId = targetAssignment.facultyIds[0];
    if (!originalFacultyId) {
        toast.error("Could not identify the original faculty member for this assignment.");
        return;
    }

    const substitution: Omit<Substitution, 'id'> = {
        originalAssignmentId: targetAssignment.id,
        originalFacultyId: originalFacultyId,
        substituteFacultyId: selectedSubstitute.facultyId,
        substituteSubjectId: selectedSubstitute.subjectId,
        batchId: targetAssignment.batchId,
        day: targetAssignment.day,
        slot: targetAssignment.slot,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
    };
    onConfirm(substitution);
  };
  
  const originalSubject = getSubjectDetails(targetAssignment.subjectId);
  // FIX: Use `facultyIds[0]` to get the single original faculty member.
  const originalFaculty = getFacultyDetails(targetAssignment.facultyIds[0]);

  const footer = (
    <>
      <GlassButton type="button" variant="secondary" onClick={onClose}>Cancel</GlassButton>
      <GlassButton type="button" onClick={handleSubmit} disabled={!selectedSubstitute}>Confirm Substitution</GlassButton>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Intelligent Substitute Finder"
      footer={footer}
      className="max-w-3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Panel: Class Details & Date */}
        <div className="space-y-4">
            <GlassPanel className="p-4">
                <h3 className="font-bold text-white mb-2">Class to be Substituted</h3>
                <p className="text-sm text-text-muted"><span className="font-semibold text-white">{originalSubject?.name}</span> taught by <span className="font-semibold text-white">{originalFaculty?.name}</span></p>
            </GlassPanel>
            <GlassPanel className="p-4">
                 <h3 className="font-bold text-white mb-2">Substitution Period</h3>
                 <div className="flex gap-2 items-center">
                    <input type="date" value={dateRange.startDate} onChange={e => setDateRange(p => ({...p, startDate: e.target.value}))} className="glass-input text-sm"/>
                    <span className="text-text-muted">to</span>
                    <input type="date" value={dateRange.endDate} onChange={e => setDateRange(p => ({...p, endDate: e.target.value}))} className="glass-input text-sm"/>
                 </div>
            </GlassPanel>
             {selectedSubstitute && (
                <GlassPanel className="p-4 bg-[var(--accent)]/10 border-[var(--accent)]/20">
                    <h3 className="font-bold text-[var(--accent)] mb-2">Final Assignment</h3>
                    <p className="text-sm">
                        <span className="font-semibold text-white">{getFacultyDetails(selectedSubstitute.facultyId)?.name}</span> will teach <span className="font-semibold text-white">{getSubjectDetails(selectedSubstitute.subjectId)?.name}</span> from {dateRange.startDate} to {dateRange.endDate}.
                    </p>
                </GlassPanel>
             )}
        </div>

        {/* Right Panel: Ranked List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <h3 className="font-bold text-white">Ranked Substitute Recommendations</h3>
            {isLoading ? (
                <div className="flex justify-center items-center py-10 text-text-muted"><Loader2 className="animate-spin mr-2"/> Finding best candidates...</div>
            ) : rankedSubstitutes.length === 0 ? (
                 <div className="text-center py-10 text-text-muted">No available substitutes found for this slot.</div>
            ) : (
                rankedSubstitutes.map((sub, index) => {
                    const facultyDetails = getFacultyDetails(sub.facultyId);
                    if (!facultyDetails) return null;

                    const isSelected = selectedSubstitute?.facultyId === sub.facultyId;
                    
                    const facultySubjects = sub.canTeachOriginalSubject
                        ? [originalSubject].filter(Boolean) as Subject[]
                        : sub.alternativeSubjectIds.map(id => getSubjectDetails(id)).filter(Boolean) as Subject[];

                    return (
                        <GlassPanel key={sub.facultyId} className={`p-4 cursor-pointer transition-all border-2 ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-transparent hover:border-white/20'}`}>
                           <div onClick={() => handleSelectSubstitute(sub)}>
                               <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-white">{facultyDetails.name}</p>
                                        <p className="text-xs text-text-muted">Suitability Score: <span className="font-bold text-green-400">{sub.score}/100</span></p>
                                    </div>
                                    {index === 0 && <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-semibold"><Award size={12}/> Top Pick</span>}
                               </div>
                               <div className="text-xs text-text-muted mt-2 space-y-1">
                                {sub.reasons.map((reason, i) => (
                                    <p key={i} className="flex items-start gap-2"><CheckCircle size={12} className="text-green-500 mt-0.5 shrink-0"/> {reason}</p>
                                ))}
                               </div>
                           </div>
                           {isSelected && (
                               <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
                                  <label className="text-sm font-semibold text-white block">What will be taught?</label>
                                   {sub.canTeachOriginalSubject ? (
                                        <div className="flex items-center gap-2 p-2 bg-panel-strong rounded-md text-sm">
                                            <BookOpen size={16} className="text-[var(--accent)]"/>
                                            <span>Covering: <span className="font-semibold">{originalSubject?.name}</span></span>
                                        </div>
                                   ) : (
                                       <GlassSelect
                                            value={selectedSubstitute?.subjectId || ''}
                                            onChange={handleSubjectChange}
                                            options={facultySubjects.map(s => ({ value: s.id, label: s.name }))}
                                       />
                                   )}
                               </div>
                           )}
                        </GlassPanel>
                    )
                })
            )}
        </div>
      </div>
    </Modal>
  );
};