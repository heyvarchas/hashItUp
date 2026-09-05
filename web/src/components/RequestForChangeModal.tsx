import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  initialType?: RequestType;
}

type RequestType = 'leave' | 'work_hours' | 'transfer' | 'day_to_night' | 'night_to_day';

export const RequestForChangeModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  onSubmitted,
  initialType,
}) => {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<RequestType>(initialType || 'leave');

  // Sync initialType when passed or changed
  React.useEffect(() => {
    if (initialType) {
      setSelectedType(initialType);
    }
  }, [initialType]);

  // Form states
  // 1. Leave
  const [leaveDays, setLeaveDays] = useState<number>(5);
  const [leaveType, setLeaveType] = useState<string>('Casual Leave');

  // 2. Work Hours
  const [currentHours, setCurrentHours] = useState<number>(10);
  const [requestedHours, setRequestedHours] = useState<number>(8);

  // 3. Transfer
  const [currentPosting, setCurrentPosting] = useState<string>('Current Unit');
  const [requestedPosting, setRequestedPosting] = useState<string>('Requested Unit');

  // Common fields
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
    } else if (selectedType === 'work_hours') {
      requestDetails = {
        current_hours: Number(currentHours),
        requested_hours: Number(requestedHours),
      };
    } else if (selectedType === 'transfer') {
      requestDetails = {
        current_posting: currentPosting.trim() || 'Current Unit',
        requested_posting: requestedPosting.trim() || 'Requested Unit',
        preferred_transfer_unit_location: requestedPosting.trim() || 'Requested Unit',
      };
    } else if (selectedType === 'day_to_night') {
      requestDetails = {
        current_shift: 'Day',
        requested_shift: 'Night',
      };
    } else if (selectedType === 'night_to_day') {
      requestDetails = {
        current_shift: 'Night',
        requested_shift: 'Day',
      };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/requests`, {
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
      label: 'Leave',
      desc: 'Request time off',
      icon: Calendar,
    },
    {
      type: 'work_hours' as RequestType,
      label: 'Work Hours',
      desc: 'Change duty hours',
      icon: Clock,
    },
    {
      type: 'transfer' as RequestType,
      label: 'Transfer',
      desc: 'Request transfer',
      icon: MapPin,
    },
    {
      type: 'day_to_night' as RequestType,
      label: 'Day → Night',
      desc: 'Request night duty',
      icon: Clock,
    },
    {
      type: 'night_to_day' as RequestType,
      label: 'Night → Day',
      desc: 'Request day duty',
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        ? 'bg-command-blue/15 border-command-blue text-field-primary ring-1 ring-command-blue'
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
            {/* A. LEAVE */}
            {selectedType === 'leave' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-field-primary pb-1 border-b border-field-border">
                  Request for Leave
                </div>
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
              </div>
            )}

            {/* B. WORK HOURS */}
            {selectedType === 'work_hours' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-field-primary pb-1 border-b border-field-border">
                  Request Change in Work Hours
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Current Duty Hours (hrs/day) *
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={18}
                      value={currentHours}
                      onChange={(e) => setCurrentHours(parseInt(e.target.value) || 10)}
                      required
                      className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Requested Duty Hours (hrs/day) *
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={18}
                      value={requestedHours}
                      onChange={(e) => setRequestedHours(parseInt(e.target.value) || 8)}
                      required
                      className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-field-muted">
                  Example: Reduce duty hours from 10 hours/day to 8 hours/day, or request temporary workload augmentation.
                </p>
              </div>
            )}

            {/* C. TRANSFER */}
            {selectedType === 'transfer' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-field-primary pb-1 border-b border-field-border">
                  Request Transfer
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Current Posting *
                    </label>
                    <input
                      type="text"
                      placeholder="Current Unit"
                      value={currentPosting}
                      onChange={(e) => setCurrentPosting(e.target.value)}
                      required
                      className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Requested Posting *
                    </label>
                    <input
                      type="text"
                      placeholder="Requested Unit"
                      value={requestedPosting}
                      onChange={(e) => setRequestedPosting(e.target.value)}
                      required
                      className="w-full bg-field-surface border border-field-border rounded px-3 py-1.5 text-xs text-field-primary focus:outline-none focus:border-command-blue"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* D. DAY -> NIGHT */}
            {selectedType === 'day_to_night' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-field-primary pb-1 border-b border-field-border">
                  Request Shift Change: Day → Night
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Current Shift
                    </label>
                    <input
                      type="text"
                      value="Day"
                      disabled
                      className="w-full bg-field-surface/60 border border-field-border rounded px-3 py-1.5 text-xs text-field-primary opacity-80 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Requested Shift
                    </label>
                    <input
                      type="text"
                      value="Night"
                      disabled
                      className="w-full bg-field-surface/60 border border-field-border rounded px-3 py-1.5 text-xs text-command-blue font-bold opacity-90 cursor-not-allowed"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-field-muted">
                  Requesting assignment to nocturnal operational schedule.
                </p>
              </div>
            )}

            {/* E. NIGHT -> DAY */}
            {selectedType === 'night_to_day' && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-field-primary pb-1 border-b border-field-border">
                  Request Shift Change: Night → Day
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Current Shift
                    </label>
                    <input
                      type="text"
                      value="Night"
                      disabled
                      className="w-full bg-field-surface/60 border border-field-border rounded px-3 py-1.5 text-xs text-field-primary opacity-80 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-field-muted block mb-1">
                      Requested Shift
                    </label>
                    <input
                      type="text"
                      value="Day"
                      disabled
                      className="w-full bg-field-surface/60 border border-field-border rounded px-3 py-1.5 text-xs text-readiness-green font-bold opacity-90 cursor-not-allowed"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-field-muted">
                  Requesting assignment to daytime schedule for circadian recovery and fatigue alleviation.
                </p>
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
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 border-t border-field-border">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-3.5 py-2 rounded bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border text-xs font-medium transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 rounded bg-command-blue hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
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
