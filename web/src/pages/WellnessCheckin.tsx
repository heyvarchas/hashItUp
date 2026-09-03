import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Smile, 
  Moon, 
  Flame, 
  HelpCircle, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Lock
} from 'lucide-react';

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

  const moodLabels: { [key: number]: { label: string; color: string } } = {
    1: { label: 'Very Low / Distressed', color: 'text-rose-400' },
    2: { label: 'Low / Fatigued', color: 'text-amber-400' },
    3: { label: 'Moderate / Balanced', color: 'text-blue-400' },
    4: { label: 'Good / Positive', color: 'text-emerald-400' },
    5: { label: 'Excellent / Energized', color: 'text-teal-300' },
  };

  const sleepLabels: { [key: number]: { label: string; color: string } } = {
    1: { label: 'Very Poor (Broken / Insomnia)', color: 'text-rose-400' },
    2: { label: 'Poor (Interrupted)', color: 'text-amber-400' },
    3: { label: 'Fair (Adequate rest)', color: 'text-blue-400' },
    4: { label: 'Good (Sound sleep)', color: 'text-emerald-400' },
    5: { label: 'Restorative / Optimal', color: 'text-teal-300' },
  };

  const getStressDetails = (val: number) => {
    if (val <= 3) return { label: 'Low / Manageable', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (val <= 6) return { label: 'Moderate / Demanding', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    if (val <= 8) return { label: 'High / Strained', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { label: 'Severe / Overwhelming', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/wellness/assessment', {
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
        throw new Error(errorData.detail || 'Failed to submit check-in assessment.');
      }

      const data = await response.json();
      setSuccessResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button & header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/personnel')}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-slate-900/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/40 px-3 py-1 rounded-full border border-slate-800">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Pseudonymous submission</span>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Daily Wellness Check-in</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete your confidential self-assessment to track recovery, stress levels, and operational readiness.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Submission Error</p>
              <p className="text-xs text-rose-400 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {successResult ? (
          <div className="py-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Check-in Submitted Successfully!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your response has been securely saved and evaluated by the automated risk engine.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left font-mono text-xs space-y-1.5 text-slate-300">
              <p className="text-slate-500 font-sans text-[11px] font-semibold uppercase tracking-wider mb-2">DB Confirmation Row</p>
              <div className="flex justify-between">
                <span className="text-slate-500">Assessment ID:</span>
                <span className="text-indigo-300 truncate max-w-[240px]">{successResult.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pseudonymous ID:</span>
                <span className="text-indigo-300 truncate max-w-[240px]">{successResult.pseudonymous_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submitted At:</span>
                <span>{new Date(successResult.submitted_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mood / Sleep / Stress:</span>
                <span className="text-emerald-400 font-bold">{successResult.mood_score}/5 • {successResult.sleep_quality_score}/5 • {successResult.stress_self_rating}/10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Talk to Someone:</span>
                <span className={successResult.help_requested ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {successResult.help_requested ? 'Requested' : 'No'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setSuccessResult(null);
                  setFreeTextNote('');
                  setHelpRequested(false);
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Submit Another Entry
              </button>
              <button
                onClick={() => navigate('/personnel')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-indigo-600/25"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mood Slider */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-indigo-400" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Mood Rating (1 - 5)
                  </label>
                </div>
                <span className={`text-xs font-semibold ${moodLabels[mood].color}`}>
                  {mood} / 5 — {moodLabels[mood].label}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-medium px-1">
                <span>1 (Distressed)</span>
                <span>3 (Moderate)</span>
                <span>5 (Energized)</span>
              </div>
            </div>

            {/* Sleep Slider */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-blue-400" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Sleep Quality (1 - 5)
                  </label>
                </div>
                <span className={`text-xs font-semibold ${sleepLabels[sleep].color}`}>
                  {sleep} / 5 — {sleepLabels[sleep].label}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={sleep}
                onChange={(e) => setSleep(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-medium px-1">
                <span>1 (Very Poor)</span>
                <span>3 (Fair)</span>
                <span>5 (Optimal)</span>
              </div>
            </div>

            {/* Stress Self-Rating Slider */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4.5 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Stress Self-Rating (1 - 10)
                  </label>
                </div>
                {(() => {
                  const details = getStressDetails(stress);
                  return (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${details.color} ${details.bg}`}>
                      Level {stress} — {details.label}
                    </span>
                  );
                })()}
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={stress}
                onChange={(e) => setStress(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-medium px-1">
                <span>1 (Low)</span>
                <span>5 (Manageable)</span>
                <span>10 (Severe)</span>
              </div>
            </div>

            {/* Free Text Note */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Optional Notes / Comments
                </label>
              </div>
              <textarea
                rows={3}
                value={freeTextNote}
                onChange={(e) => setFreeTextNote(e.target.value)}
                placeholder="Share any operational context, sleep disruptions, or physical fatigue symptoms..."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <p className="text-[11px] text-slate-500">
                Notes are stored encrypted in the analytics database and isolated from service rosters.
              </p>
            </div>

            {/* "I'd like to talk to someone" Flag */}
            <div className="bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Confidential Support Request</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Trigger an immediate, confidential outreach notification for the welfare officer team.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHelpRequested(!helpRequested)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${
                  helpRequested
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {helpRequested ? "✓ Help Requested" : "I'd like to talk to someone"}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Assessment</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
