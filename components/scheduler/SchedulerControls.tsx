import React from 'react';
import { GlassPanel } from '../GlassPanel';
import { GlassButton } from '../GlassButton';
import { Loader2, Zap, ChevronDown } from 'lucide-react';

interface SchedulerControlsProps {
    selectedBatchIds: string[];
    onSelectBatches: () => void;
    onGenerate: () => void;
    isLoading: boolean;
}

export const SchedulerControls: React.FC<SchedulerControlsProps> = ({ selectedBatchIds, onSelectBatches, onGenerate, isLoading }) => {
    return (
        <GlassPanel className="p-4 relative z-10">
            <h2 className="text-lg font-bold mb-4">Controls</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Select Batches</label>
                    <GlassButton
                        variant="secondary"
                        className="w-full justify-between items-center text-left"
                        onClick={onSelectBatches}
                    >
                        <span className="truncate pr-2">
                            {selectedBatchIds.length > 0 ? `${selectedBatchIds.length} batch(es) selected` : 'Click to select...'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-text-muted shrink-0"/>
                    </GlassButton>
                </div>
                <GlassButton 
                    icon={isLoading ? undefined : Zap} 
                    onClick={onGenerate} 
                    disabled={isLoading || selectedBatchIds.length === 0} 
                    className="w-full"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center"><Loader2 className="animate-spin mr-2" size={16} /> Optimizing...</span> 
                    ) : 'Generate New'}
                </GlassButton>
            </div>
        </GlassPanel>
    );
};
