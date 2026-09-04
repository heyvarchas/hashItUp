import React, { useState } from 'react';
import {
  Calendar,
  UserPlus,
  UserMinus,
  MapPin,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

type RequestType = 'leave' | 'increase_workers' | 'decrease_workers' | 'transfer' | 'shift_change';

export const RequestForChangeModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<RequestType>('leave');

  // Form states
  const [leaveDays, setLeaveDays] = useState<number>(5);
  const [leaveType, setLeaveType] = useState<string>('Casual Leave');

  const [increaseWorkersCount, setIncreaseWorkersCount] = useState<number>(2);
  const [decreaseWorkersCount, setDecreaseWorkersCount] = useState<number>(1);

  const [transferLocation, setTransferLocation] = useState<string>('');
  const [shiftOption, setShiftOption] = useState<'Day to Night' | 'Night to Day'>('Night to Day');

  const [reason, setReason] = useState<string>('');
  const [additionalNote, setAdditionalNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Please provide a substantive operational reason for this request.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Build specific request details payload
    let requestDetails: Record<string, any> = {};
    if (selectedType === 'leave') {
      requestDetails = {
        leave_days: Number(leaveDays),
        leave_type: leaveType,
      };
    } else if (selectedType === 'increase_workers') {
      requestDetails = {
        additional_workers_requested: Number(increaseWorkersCount),
      };
    } else if (selectedType === 'decrease_workers') {
      requestDetails = {
        workers_to_decrease: Number(decreaseWorkersCount),
      };
    } else if (selectedType === 'transfer') {
      requestDetails = {
        preferred_transfer_unit_location: transferLocation.trim() || 'Headquarters Garrison',
      };
    } else if (selectedType === 'shift_change') {
      requestDetails = {
        requested_shift: shiftOption,
      };
    }

    try {
      const res = await fetch('http://localhost:8000/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          request_type: selectedType,
          request_details: requestDetails,
          reason: reason.trim(),
          additional_note: additionalNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to submit request.');
      }

      setSuccessMessage('Change request submitted successfully. It has been routed to the Welfare Officer.');
      setTimeout(() => {
        onSubmitted();
        onClose();
        // Reset form
        setReason('');
        setAdditionalNote('');
        setSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const TYPE_CONFIG = [
    {
      type: 'leave' as RequestType,
      label: 'Request for Leave',
      desc: 'Apply for operational respite or family emergency leave.',
      icon: Calendar,
    },
    {
      type: 'increase_workers' as RequestType,
      label: 'Increase Workers',
      desc: 'Request additional personnel for heavy duty workload.',
      icon: UserPlus,
    },
    {
      type: 'decrease_workers' as RequestType,
      label: 'Decrease Workers',
      desc: 'Request staff decrement if operational tempo is low.',
      icon: UserMinus,
    },
    {
      type: 'transfer' as RequestType,
      label: 'Request Transfer',
      desc: 'Seek deployment rotation to an alternate unit/location.',
      icon: MapPin,
    },
    {
      type: 'shift_change' as RequestType,
      label: 'Shift Change',
      desc: 'Transition between Day and Night operational schedules.',
      icon: Clock,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-field-surface border border-field-border rounded-lg shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col font-sans">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-field-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40">
                Personnel Request
              </span>
              <span className="text-xs text-field-muted">Decision-Support Enabled</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-field-primary mt-1">
              Submit Request for Change
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-field-surface-elevated text-field-muted hover:text-field-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Status Banners */}
          {errorMessage && (
            <div className="p-3 bg-triage-red-bg border border-triage-red-border rounded flex items-center gap-2 text-triage-red text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-triage-green-bg border border-triage-green-border rounded flex items-center gap-2 text-readiness-green text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Request Type Selector Tiles */}
          <div>
            <label className="text-xs font-semibold text-field-muted block mb-2">
              Select Request Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TYPE_CONFIG.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedType === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedType(item.type)}
                    className={`text-left p-2.5 rounded border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-command-blue/15 border-command-blue text-field-primary'
                        : 'bg-field-surface-subtle border-field-border text-field-muted hover:border-field-primary/40 hover:text-field-primary'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-command-blue' : 'text-field-muted'}`} />
                    <div>
                      <span className="text-xs font-bold block">{item.label}</span>
                      <span className="text-[10px] text-field-muted line-clamp-1">{item.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Specific Form Fields Based on Type */}
          <div className="p-3.5 bg-field-surface-subtle border border-field-border rounded-lg space-y-3">
            {selectedType === 'leave' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-field-muted block mb-1">
                    Number of Leave Days *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(parseInt(e.target.value) || 1)}
                    required
                    className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-field-muted block mb-1">
                    Leave Type *
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                  >
                    <option value="Casual Leave">Casual Leave (Rest & Recuperation)</option>
                    <option value="Earned / Annual Leave">Earned / Annual Leave</option>
                    <option value="Emergency / Medical Leave">Emergency / Medical Leave</option>
                    <option value="Compassionate Leave">Compassionate Leave</option>
                  </select>
                </div>
              </div>
            )}

            {selectedType === 'increase_workers' && (
              <div>
                <label className="text-xs font-semibold text-field-muted block mb-1">
                  Requested Additional Workers *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={increaseWorkersCount}
                  onChange={(e) => setIncreaseWorkersCount(parseInt(e.target.value) || 1)}
                  required
                  className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                />
                <span className="text-[10px] text-field-muted mt-1 block">
                  Augmentation to alleviate high duty-hours and workload tempo.
                </span>
              </div>
            )}

            {selectedType === 'decrease_workers' && (
              <div>
                <label className="text-xs font-semibold text-field-muted block mb-1">
                  Number of Workers to Decrease *
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={decreaseWorkersCount}
                  onChange={(e) => setDecreaseWorkersCount(parseInt(e.target.value) || 1)}
                  required
                  className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                />
                <span className="text-[10px] text-triage-amber mt-1 block">
                  ⚠️ Note: Decreasing personnel will be reviewed carefully to prevent team workload spikes.
                </span>
              </div>
            )}

            {selectedType === 'transfer' && (
              <div>
                <label className="text-xs font-semibold text-field-muted block mb-1">
                  Preferred Transfer Unit / Location *
                </label>
                <input
                  type="text"
                  placeholder="e.g., 2nd Battalion Support / Base Logistics Depot"
                  value={transferLocation}
                  onChange={(e) => setTransferLocation(e.target.value)}
                  required
                  className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                />
              </div>
            )}

            {selectedType === 'shift_change' && (
              <div>
                <label className="text-xs font-semibold text-field-muted block mb-1">
                  Requested Shift Change *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShiftOption('Night to Day')}
                    className={`p-2.5 rounded border text-xs font-semibold text-center transition-colors ${
                      shiftOption === 'Night to Day'
                        ? 'bg-command-blue/20 border-command-blue text-command-blue'
                        : 'bg-field-surface border-field-border text-field-muted hover:text-field-primary'
                    }`}
                  >
                    Night → Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftOption('Day to Night')}
                    className={`p-2.5 rounded border text-xs font-semibold text-center transition-colors ${
                      shiftOption === 'Day to Night'
                        ? 'bg-command-blue/20 border-command-blue text-command-blue'
                        : 'bg-field-surface border-field-border text-field-muted hover:text-field-primary'
                    }`}
                  >
                    Day → Night
                  </button>
                </div>
              </div>
            )}

            {/* Substantive Reason Field */}
            <div>
              <label className="text-xs font-semibold text-field-muted block mb-1">
                Reason for Request *
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the background or operational strain necessitating this change..."
                required
                className="w-full bg-field-surface border border-field-border rounded p-2.5 text-xs text-field-primary placeholder-field-muted/50 focus:outline-none focus:border-command-blue"
              />
            </div>

            {/* Optional Additional Note */}
            <div>
              <label className="text-xs font-semibold text-field-muted block mb-1">
                Optional Additional Note
              </label>
              <input
                type="text"
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="Any routing details or emergency context..."
                className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary placeholder-field-muted/50 focus:outline-none focus:border-command-blue"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-field-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded bg-command-blue hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Routing Request...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
