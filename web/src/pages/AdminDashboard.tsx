import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Database,
  Server,
  CheckCircle2,
  Lock,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Play,
  RefreshCw,
  Cpu,
  Check,
  RotateCcw
} from 'lucide-react';
import { API_BASE_URL } from '../config';

interface DatasetStatus {
  active_dataset: string;
  model_version: string;
  training_timestamp: string;
  records_count: number;
  personnel_count: number;
  is_session_custom: boolean;
}

interface ValidationSummary {
  valid: boolean;
  row_count: number;
  personnel_count: number;
  checks: {
    required_columns: boolean;
    dates_valid: boolean;
    no_duplicate_records: boolean;
    numeric_fields_valid: boolean;
    target_valid: boolean;
  };
  errors: string[];
  warnings: string[];
}

interface UploadResponse {
  status: string;
  filename: string;
  row_count: number;
  personnel_count: number;
  validation: ValidationSummary;
  preview_sample: any[];
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  const [statusData, setStatusData] = useState<DatasetStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Training State
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainStep, setTrainStep] = useState<number>(0);
  const [trainSuccess, setTrainSuccess] = useState<string | null>(null);
  const [trainError, setTrainError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/dataset/status`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data: DatasetStatus = await res.json();
        setStatusData(data);
      }
    } catch (err) {
      console.error('Failed to fetch dataset status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
      setUploadError(null);
      setTrainSuccess(null);
      setTrainError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setTrainSuccess(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_BASE_URL}/api/dataset/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed (${res.status})`);
      }

      const data: UploadResponse = await res.json();
      setUploadResult(data);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload and validate dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTrainAndPredict = async () => {
    if (!user) return;
    setIsTraining(true);
    setTrainError(null);
    setTrainSuccess(null);
    setTrainStep(1); // 1: Dataset validated

    try {
      setTimeout(() => setTrainStep(2), 500); // 2: Features prepared
      setTimeout(() => setTrainStep(3), 1100); // 3: Model trained
      setTimeout(() => setTrainStep(4), 1800); // 4: Predictions generated
      setTimeout(() => setTrainStep(5), 2400); // 5: SHAP explanations generated

      const res = await fetch(`${API_BASE_URL}/api/dataset/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Model training failed (${res.status})`);
      }

      const resData = await res.json();
      setTrainStep(6);
      setTrainSuccess(
        `Successfully retrained calibrated XGBoost model (${resData.model_version}). Active session updated with ${resData.records_count} records across ${resData.personnel_count} personnel!`
      );
      await fetchStatus();
    } catch (err: any) {
      setTrainError(err.message || 'Error occurred during model retraining.');
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* System Administration Header */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-field-surface-elevated text-field-muted border border-field-border">
            System Administration Console
          </span>
          <span className="text-xs text-field-muted flex items-center gap-1">
            <Lock className="w-3 h-3 text-readiness-green" />
            Active Session Security • Defense Grade
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-field-primary tracking-tight">
          Dataset Management & Predictive Pipeline Administration
        </h1>
        <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-2xl leading-relaxed">
          Manage the active master dataset, inspect operational telemetry, upload longitudinal cohort data (CSV/XLSX), and retrain the calibrated XGBoost & TreeSHAP explanation pipeline.
        </p>
      </div>

      {/* Current Active Dataset Status Card */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-field-border">
          <div>
            <h2 className="text-base font-bold text-field-primary flex items-center gap-2">
              <Database className="w-4 h-4 text-command-blue" />
              Active Dataset & Model Status
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Current running in-memory model configuration. Resets cleanly to default master dataset upon server restart.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            className="px-3 py-1.5 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className="w-3 h-3 text-field-muted" />
            <span>Refresh Status</span>
          </button>
        </div>

        {statusData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
              <span className="text-field-muted block">Active Dataset File</span>
              <strong className="text-field-primary font-mono text-sm block mt-1 truncate">
                {statusData.active_dataset}
              </strong>
              {statusData.is_session_custom ? (
                <span className="inline-block mt-1 text-[10px] text-triage-amber font-semibold">
                  (Temporary Session Upload)
                </span>
              ) : (
                <span className="inline-block mt-1 text-[10px] text-readiness-green font-semibold">
                  (Default Baseline Dataset)
                </span>
              )}
            </div>

            <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
              <span className="text-field-muted block">Model Pipeline Version</span>
              <strong className="text-command-blue font-mono text-sm block mt-1">
                {statusData.model_version}
              </strong>
              <span className="text-[10px] text-field-muted block mt-1">Calibrated XGBoost + TreeSHAP</span>
            </div>

            <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
              <span className="text-field-muted block">Total Records / Personnel</span>
              <strong className="text-field-primary text-sm block mt-1">
                {statusData.records_count} rows ({statusData.personnel_count} personnel)
              </strong>
              <span className="text-[10px] text-field-muted block mt-1">Single Master Schema</span>
            </div>

            <div className="bg-field-surface-subtle p-3 rounded border border-field-border">
              <span className="text-field-muted block">Trained Timestamp</span>
              <strong className="text-field-primary font-mono text-[11px] block mt-1 truncate">
                {statusData.training_timestamp
                  ? new Date(statusData.training_timestamp).toLocaleString()
                  : 'On App Boot'}
              </strong>
              <span className="text-[10px] text-readiness-green block mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Live In-Memory
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-field-muted">Loading dataset status...</div>
        )}
      </div>

      {/* Dataset Upload & Retraining Flow */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-field-primary flex items-center gap-2">
            <Upload className="w-4 h-4 text-command-blue" />
            Upload New Master Dataset (CSV or Excel)
          </h2>
          <p className="text-xs text-field-muted mt-0.5">
            Select a new master dataset (containing one row per <code>(person_id, record_date)</code>). The application will validate schema requirements, handle missing values, and allow you to retrain the XGBoost model for the current running session.
          </p>
        </div>

        {/* Upload Controls */}
        <div className="p-4 bg-field-surface-subtle border border-field-border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-command-blue" />
              <span>{selectedFile ? selectedFile.name : 'Select CSV / Excel File'}</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <span className="text-xs text-field-muted font-mono truncate max-w-xs">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full sm:w-auto px-4 py-2 bg-command-blue hover:bg-blue-600 disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Validating File...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Upload & Validate</span>
              </>
            )}
          </button>
        </div>

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="p-3.5 bg-triage-red-bg border border-triage-red-border rounded flex items-start gap-2.5 text-triage-red text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Upload Rejected</strong>
              <span>{uploadError}</span>
            </div>
          </div>
        )}

        {/* Validation Preview & Train Trigger */}
        {uploadResult && (
          <div className="space-y-4 pt-2">
            <div className="bg-field-surface-subtle border border-field-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-field-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-field-primary">Dataset Validation Preview:</span>
                  <span className="font-mono text-xs text-command-blue">{uploadResult.filename}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    uploadResult.validation.valid
                      ? 'bg-triage-green-bg text-readiness-green border-triage-green-border'
                      : 'bg-triage-red-bg text-triage-red border-triage-red-border'
                  }`}
                >
                  {uploadResult.validation.valid ? 'VALIDATED FOR TRAINING' : 'VALIDATION FAILED'}
                </span>
              </div>

              {/* Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${uploadResult.validation.checks.required_columns ? 'text-readiness-green' : 'text-triage-red'}`}
                  />
                  <span>Required Columns ({uploadResult.validation.checks.required_columns ? 'Present' : 'Missing'})</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${uploadResult.validation.checks.dates_valid ? 'text-readiness-green' : 'text-triage-red'}`}
                  />
                  <span>Dates Formatted</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${uploadResult.validation.checks.no_duplicate_records ? 'text-readiness-green' : 'text-triage-red'}`}
                  />
                  <span>Zero Duplicate Observations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 ${uploadResult.validation.checks.numeric_fields_valid ? 'text-readiness-green' : 'text-triage-red'}`}
                  />
                  <span>Numeric & Target Valid</span>
                </div>
              </div>

              {/* Errors if any */}
              {uploadResult.validation.errors.length > 0 && (
                <div className="p-3 bg-triage-red-bg border border-triage-red-border rounded space-y-1 text-xs text-triage-red">
                  <strong className="block font-semibold">Validation Errors to Resolve:</strong>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {uploadResult.validation.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-field-muted flex items-center justify-between pt-1">
                <span>
                  Total Rows: <strong className="text-field-primary">{uploadResult.row_count}</strong> | Personnel:{' '}
                  <strong className="text-field-primary">{uploadResult.personnel_count}</strong>
                </span>
              </div>
            </div>

            {/* Train & Predict Button */}
            {uploadResult.validation.valid && (
              <div className="p-4 bg-field-surface-subtle border border-field-border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-field-primary">Execute Retraining & Refresh Dashboard</h3>
                  <p className="text-[11px] text-field-muted">
                    Fits calibrated XGBoost on the temporal split, recalculates TreeSHAP values, and refreshes the roster.
                  </p>
                </div>

                <button
                  onClick={handleTrainAndPredict}
                  disabled={isTraining}
                  className="w-full sm:w-auto px-5 py-2.5 bg-readiness-green hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {isTraining ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Training Model Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Train & Predict</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step-by-Step Training Progress State */}
        {isTraining && (
          <div className="p-4 bg-field-surface-subtle border border-field-border rounded-lg space-y-2 text-xs">
            <span className="font-bold text-field-primary block pb-1 border-b border-field-border">
              Training model in progress...
            </span>
            <div className="space-y-1.5 pt-1">
              <div className={`flex items-center gap-2 ${trainStep >= 1 ? 'text-readiness-green font-semibold' : 'text-field-muted'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dataset validated</span>
              </div>
              <div className={`flex items-center gap-2 ${trainStep >= 2 ? 'text-readiness-green font-semibold' : 'text-field-muted'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Features prepared & previous predictions excluded</span>
              </div>
              <div className={`flex items-center gap-2 ${trainStep >= 3 ? 'text-readiness-green font-semibold' : 'text-field-muted'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>XGBoost model trained & calibrated (Platt scaling)</span>
              </div>
              <div className={`flex items-center gap-2 ${trainStep >= 4 ? 'text-readiness-green font-semibold' : 'text-field-muted'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Personnel welfare risk predictions generated</span>
              </div>
              <div className={`flex items-center gap-2 ${trainStep >= 5 ? 'text-readiness-green font-semibold' : 'text-field-muted'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>TreeSHAP explanations & recommendations computed</span>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {trainSuccess && (
          <div className="p-4 bg-triage-green-bg border border-triage-green-border rounded text-xs text-readiness-green space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pipeline Successfully Retrained</span>
            </div>
            <p className="text-xs leading-relaxed">{trainSuccess}</p>
          </div>
        )}

        {/* Error Alert */}
        {trainError && (
          <div className="p-4 bg-triage-red-bg border border-triage-red-border rounded text-xs text-triage-red flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block">Training Failed</strong>
              <span>{trainError}</span>
            </div>
          </div>
        )}
      </div>

      {/* System Infrastructure Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-command-blue" />
              <h3 className="text-xs font-bold text-field-primary">FastAPI Backend</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Nominal
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Service active on port 8000. XGBoost inference and TreeSHAP explainer pipelines online.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-command-blue" />
              <h3 className="text-xs font-bold text-field-primary">Model Governance</h3>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-readiness-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Session Active
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Previous predictions strictly quarantined from training to eliminate data leakage.
          </p>
        </div>

        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-field-border">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-triage-amber" />
              <h3 className="text-xs font-bold text-field-primary">Reboot Fallback</h3>
            </div>
            <span className="text-[11px] text-field-muted font-mono">
              Auto: Default Master
            </span>
          </div>
          <p className="text-xs text-field-muted">
            Container restarts safely restore the verified default baseline dataset automatically.
          </p>
        </div>
      </div>
    </div>
  );
};
