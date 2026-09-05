import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Lock,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export const WellnessCheckin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mood, setMood] = useState<number>(3);
  const [sleep, setSleep] = useState<number>(3);
  const [stress, setStress] = useState<number>(5);
  const [helpRequested, setHelpRequested] = useState<boolean>(false);
  const [freeTextNote, setFreeTextNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const moodOptions = [
    { val: 1, label: 'Distressed / Severe Low', sub: 'Unable to focus / feeling exhausted' },
    { val: 2, label: 'Fatigued / Low', sub: 'Noticeable drop in morale or energy' },
    { val: 3, label: 'Moderate / Balanced', sub: 'Standard operational baseline' },
    { val: 4, label: 'Good / Steady', sub: 'High energy and positive focus' },
    { val: 5, label: 'Optimal / Energized', sub: 'Peak physical and mental readiness' },
  ];

  const sleepOptions = [
    { val: 1, label: 'Very Poor', sub: '< 3 hours or severe interruption' },
    { val: 2, label: 'Restless', sub: 'Broken sleep / unrefreshed' },
    { val: 3, label: 'Adequate', sub: '5–6 hours of standard rest' },
    { val: 4, label: 'Good Rest', sub: '7–8 hours sound uninterrupted sleep' },
    { val: 5, label: 'Optimal Recovery', sub: 'Fully restorative natural sleep' },
  ];

  const getStressBand = (val: number) => {
    if (val <= 3) return { label: 'Low / Manageable Tempo', color: 'text-readiness-green', bg: 'bg-triage-green-bg border-triage-green-border' };
    if (val <= 6) return { label: 'Moderate Operational Demand', color: 'text-blue-400', bg: 'bg-triage-blue-bg border-triage-blue-border' };
    if (val <= 8) return { label: 'Elevated Strain / High Fatigue', color: 'text-triage-amber', bg: 'bg-triage-amber-bg border-triage-amber-border' };
    return { label: 'Severe / Overwhelming Workload', color: 'text-triage-red', bg: 'bg-triage-red-bg border-triage-red-border' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/wellness/assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          mood_score: mood,
          sleep_quality_score: sleep,
          stress_self_rating: stress,
          help_requested: helpRequested,
          free_text_note: freeTextNote.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to submit daily check-in.');
      }

      const data = await response.json();
      setSuccessResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during check-in submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 font-sans">
      {/* Top Header Rail */}
      <div className="flex items-center justify-between pb-1">
        <button
          onClick={() => navigate('/personnel')}
          className="flex items-center gap-1.5 text-xs font-medium text-field-muted hover:text-field-primary transition-colors bg-field-surface px-3 py-1.5 rounded border border-field-border"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Readiness Dashboard</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-field-muted bg-field-surface px-2.5 py-1 rounded border border-field-border">
          <Lock className="w-3 h-3 text-readiness-green" />
          <span>Pseudonymous: {user?.claims.pseudonymous_id?.slice(0, 8)}...</span>
        </div>
      </div>

      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-7">
        <div className="border-b border-field-border pb-4 mb-5">
          <h1 className="text-xl font-bold text-field-primary tracking-tight">
            Daily 30-Second Wellness Check-in
          </h1>
          <p className="text-xs text-field-muted mt-1 leading-relaxed">
            Quick confidential check-in on mood, sleep, and operational strain. Data is encrypted and locked away separately from service rosters.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-start gap-2.5 text-triage-red text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Submission Error</p>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {successResult ? (
          <div className="py-4 space-y-5 text-center">
            <div className="w-12 h-12 bg-triage-green-bg border border-triage-green-border rounded-full flex items-center justify-center text-readiness-green mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-field-primary">Check-in Logged Successfully</h2>
              <p className="text-xs text-field-muted mt-1">
                Your report has been evaluated by the early-warning fatigue engine.
              </p>
            </div>

            {/* Confirmation Dossier Sheet */}
            <div className="bg-field-surface-subtle p-4 rounded border border-field-border text-left text-xs space-y-2 text-field-primary">
              <div className="flex justify-between border-b border-field-border pb-1 text-field-muted">
                <span>Assessment Ref:</span>
                <span className="font-medium text-field-primary">{successResult.id?.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-field-muted">Logged At:</span>
                <span>{new Date(successResult.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-field-muted">Mood / Sleep / Stress:</span>
                <span className="font-semibold text-field-primary">
                  {successResult.mood_score}/5 • {successResult.sleep_quality_score}/5 • {successResult.stress_self_rating}/10
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-field-muted">Officer Outreach Request:</span>
                <span className={successResult.help_requested ? 'text-triage-amber font-semibold' : 'text-field-muted'}>
                  {successResult.help_requested ? 'Dispatched Confidentially' : 'None Requested'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 justify-center pt-2">
              <button
                onClick={() => {
                  setSuccessResult(null);
                  setFreeTextNote('');
                  setHelpRequested(false);
                }}
                className="px-3.5 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors"
              >
                Log Another Entry
              </button>
              <button
                onClick={() => navigate('/personnel')}
                className="px-4 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-semibold transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Demo Scenario Trigger */}
            <div className="bg-field-surface-subtle border border-field-border rounded p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-field-primary block">Demonstration Scenario Helper</span>
                <span className="text-field-muted text-[11px]">Pre-populate acute fatigue indicators (mood: 1, sleep: 1, stress: 9)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMood(1);
                  setSleep(1);
                  setStress(9);
                  setHelpRequested(false);
                  setFreeTextNote('Severe fatigue following multiple night shifts, persistent sleep disruption.');
                }}
                className="px-2.5 py-1 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium shrink-0 transition-colors"
              >
                Pre-fill Fatigue Case
              </button>
            </div>

            {/* 1. Mood Rating Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-field-primary">
                  1. Current Mood & Energy State
                </label>
                <span className="text-xs font-medium text-field-muted">
                  Score: <strong className="text-field-primary">{mood}</strong>/5
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {moodOptions.map((opt) => {
                  const isSelected = mood === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setMood(opt.val)}
                      className={`p-2.5 rounded border text-center transition-colors flex flex-col items-center justify-center gap-1 ${isSelected
                          ? 'bg-command-blue text-white border-blue-400 font-semibold'
                          : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                        }`}
                    >
                      <span className="text-sm font-bold">{opt.val}</span>
                      <span className="text-[10px] leading-tight line-clamp-1">{opt.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-field-muted">
                {moodOptions.find((m) => m.val === mood)?.sub}
              </p>
            </div>

            {/* 2. Sleep Quality Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-field-primary">
                  2. Sleep Quality & Recovery (Last 24 Hours)
                </label>
                <span className="text-xs font-medium text-field-muted">
                  Score: <strong className="text-field-primary">{sleep}</strong>/5
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {sleepOptions.map((opt) => {
                  const isSelected = sleep === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSleep(opt.val)}
                      className={`p-2.5 rounded border text-center transition-colors flex flex-col items-center justify-center gap-1 ${isSelected
                          ? 'bg-command-blue text-white border-blue-400 font-semibold'
                          : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                        }`}
                    >
                      <span className="text-sm font-bold">{opt.val}</span>
                      <span className="text-[10px] leading-tight line-clamp-1">{opt.label.split('/')[0]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-field-muted">
                {sleepOptions.find((s) => s.val === sleep)?.sub}
              </p>
            </div>

            {/* 3. Stress Self-Rating (1-10) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-field-primary">
                  3. Stress & Fatigue Level (1–10 Scale)
                </label>
                {(() => {
                  const band = getStressBand(stress);
                  return (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${band.bg} ${band.color}`}>
                      Level {stress} — {band.label}
                    </span>
                  );
                })()}
              </div>
              <div className="grid grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isSelected = stress === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setStress(num)}
                      className={`py-2 rounded border text-center text-xs font-bold transition-colors ${isSelected
                          ? num >= 8
                            ? 'bg-triage-red text-white border-red-500'
                            : num >= 6
                              ? 'bg-triage-amber text-white border-amber-500'
                              : 'bg-command-blue text-white border-blue-400'
                          : 'bg-field-surface-subtle border-field-border text-field-muted hover:text-field-primary hover:bg-field-surface-elevated'
                        }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] text-field-muted">
                <span>1 (Low demand)</span>
                <span>5 (Manageable tempo)</span>
                <span>10 (Overwhelming strain)</span>
              </div>
            </div>

            {/* 4. Notes / Operational Context */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-field-primary">
                4. Operational Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={freeTextNote}
                onChange={(e) => setFreeTextNote(e.target.value)}
                placeholder="Share any operational context, consecutive night shifts, missed rest intervals, or physical symptoms..."
                className="w-full bg-field-surface-subtle border border-field-border rounded p-3 text-xs text-field-primary placeholder-field-muted/60 focus:outline-none focus:border-command-blue"
              />
            </div>

            {/* 5. Confidential Support Outreach Toggle */}
            <div className="bg-field-surface-subtle border border-field-border rounded p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-4 h-4 text-triage-amber shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-field-primary">
                    Request Confidential Officer Outreach
                  </p>
                  <p className="text-[11px] text-field-muted mt-0.5">
                    Triggers a high-priority, private review notification for the unit welfare officer team.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHelpRequested(!helpRequested)}
                className={`shrink-0 px-3.5 py-1.5 rounded text-xs font-semibold transition-colors border ${helpRequested
                    ? 'bg-triage-amber text-white border-amber-500'
                    : 'bg-field-surface-elevated hover:bg-field-border text-field-primary border-field-border'
                  }`}
              >
                {helpRequested ? '✓ Outreach Requested' : "I'd like to talk to someone"}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-command-blue hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Confidential Assessment</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
