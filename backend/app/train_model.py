"""
Phase 5.3: Model Training, Calibration & Artifact Persistence.

Trains the XGBoost welfare risk classifier and a Logistic Regression baseline,
calibrates probabilities using Platt scaling on the temporal validation split,
evaluates precision/recall/F1/ROC-AUC/PR-AUC on the unseen temporal test split,
and saves the trained calibrated pipeline artifact as `model.joblib`.
"""

from __future__ import annotations

import argparse
import datetime
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.synthetic.assemble_dataset import (
    assemble_training_dataset,
    load_synthetic_tables,
)

FEATURE_COLUMNS = [
    # Section 4 core features
    "avg_duty_hours_4wk",
    "consecutive_night_shifts",
    "days_since_last_leave",
    "deployment_duration_days",
    "transfers_last_12mo",
    "training_load_4wk",
    "wellness_score_trend",
    "sleep_score_trend",
    "sudden_wellness_drop",
    # Section 9 extended behavioral features
    "total_duty_hours_4wk",
    "duty_irregularity_index",
    "workload_trend_4wk",
    "leave_utilization_rate",
    "active_deployment_hardship",
    "stress_self_rating_trend",
    "latest_mood_score",
    "latest_sleep_quality",
    "latest_stress_self_rating",
    "help_requested_recent",
    "self_report_recency_days",
]


class WelfareRiskModel:
    """
    Wrapper for calibrated XGBoost model inferences, risk tier categorization,
    and calibrated 0-100 risk score generation.
    """

    def __init__(
        self,
        calibrated_model: Any,
        feature_names: List[str],
        feature_medians: Dict[str, float],
        feature_stds: Dict[str, float],
        raw_model: Optional[Any] = None,
        lr_baseline: Optional[Any] = None,
        metrics: Optional[Dict[str, Any]] = None,
    ):
        self.calibrated_model = calibrated_model
        self.feature_names = feature_names
        self.feature_medians = feature_medians
        self.feature_stds = feature_stds
        self.raw_model = raw_model
        self.lr_baseline = lr_baseline
        self.metrics = metrics or {}

    def predict_proba(self, X: Union[pd.DataFrame, pd.Series, Dict[str, Any]]) -> np.ndarray:
        """Predicts calibrated probability of welfare concern in the next 30 days."""
        if isinstance(X, (dict, pd.Series)):
            row_vals = [float(X.get(col, self.feature_medians.get(col, 0.0))) for col in self.feature_names]
            X_df = pd.DataFrame([row_vals], columns=self.feature_names, dtype=float)
        else:
            X_df = X[self.feature_names].astype(float)

        probs = self.calibrated_model.predict_proba(X_df)[:, 1]
        return probs

    def explain_factors(self, X: Union[pd.DataFrame, pd.Series, Dict[str, Any]], top_k: int = 3) -> List[str]:
        """Returns top K plain-language contributing factors for an individual."""
        from app.explainability import get_top_contributing_factors
        if isinstance(X, pd.DataFrame):
            row = X.iloc[0]
        else:
            row = X
        return get_top_contributing_factors(
            features=row,
            feature_medians=self.feature_medians,
            feature_stds=self.feature_stds,
            top_k=top_k,
        )

    def predict_risk_score(self, X: Union[pd.DataFrame, pd.Series, Dict[str, Any]], top_k: int = 3) -> Dict[str, Any]:
        """
        Returns full calibrated prediction with plain-language contributing factors:
        - probability_score: float in [0.0, 1.0]
        - calibrated_score: integer in [0, 100]
        - risk_tier: 'low' | 'moderate' | 'high' | 'critical'
        - welfare_concern_30d: bool
        - contributing_factors: List[str]
        """
        prob = float(self.predict_proba(X)[0])
        calibrated_score = int(round(prob * 100))

        # Risk tier thresholds matching Phase 3.3 calibration
        if calibrated_score >= 85:
            risk_tier = "critical"
        elif calibrated_score >= 65:
            risk_tier = "high"
        elif calibrated_score >= 35:
            risk_tier = "moderate"
        else:
            risk_tier = "low"

        welfare_concern = risk_tier in ("high", "critical") or prob >= 0.50
        factors = self.explain_factors(X, top_k=top_k)

        return {
            "probability_score": round(prob, 4),
            "calibrated_score": calibrated_score,
            "risk_tier": risk_tier,
            "welfare_concern_30d": welfare_concern,
            "contributing_factors": factors,
        }

    def save(self, filepath: Union[str, Path]) -> None:
        """Persists the pipeline to disk via joblib."""
        payload = {
            "calibrated_model": self.calibrated_model,
            "raw_model": self.raw_model,
            "lr_baseline": self.lr_baseline,
            "feature_names": self.feature_names,
            "feature_medians": self.feature_medians,
            "feature_stds": self.feature_stds,
            "metrics": self.metrics,
            "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(payload, filepath)

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> WelfareRiskModel:
        """Loads a persisted model from joblib file."""
        data = joblib.load(filepath)
        if isinstance(data, cls):
            return data
        return cls(
            calibrated_model=data["calibrated_model"],
            feature_names=data["feature_names"],
            feature_medians=data["feature_medians"],
            feature_stds=data["feature_stds"],
            raw_model=data.get("raw_model"),
            lr_baseline=data.get("lr_baseline"),
            metrics=data.get("metrics"),
        )


def evaluate_classifier(
    y_true: np.ndarray,
    probs: np.ndarray,
    name: str,
    threshold: float = 0.50,
) -> Dict[str, float]:
    """
    Computes precision, recall, F1, ROC-AUC, and PR-AUC.
    """
    preds = (probs >= threshold).astype(int)
    prec = float(precision_score(y_true, preds, zero_division=0))
    rec = float(recall_score(y_true, preds, zero_division=0))
    f1 = float(f1_score(y_true, preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_true, probs)) if len(np.unique(y_true)) > 1 else 0.50
    pr_auc = float(average_precision_score(y_true, probs))

    print(f"\n[{name} — Test Split Evaluation]")
    print(f"  Precision : {prec:.4f}")
    print(f"  Recall    : {rec:.4f}")
    print(f"  F1-Score  : {f1:.4f}")
    print(f"  ROC-AUC   : {roc_auc:.4f}")
    print(f"  PR-AUC    : {pr_auc:.4f}")

    return {
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
    }


def train_and_calibrate(
    dataset_df: pd.DataFrame,
    feature_cols: Optional[List[str]] = None,
    random_seed: int = 42,
) -> Tuple[WelfareRiskModel, Dict[str, Any], Dict[str, Any]]:
    """
    Executes training on the temporal train split, calibration on the validation split,
    and evaluation on the unseen test split.
    """
    features = feature_cols or FEATURE_COLUMNS

    train_df = dataset_df[dataset_df["split"] == "train"]
    val_df = dataset_df[dataset_df["split"] == "val"]
    test_df = dataset_df[dataset_df["split"] == "test"]

    if train_df.empty or test_df.empty:
        raise ValueError("Dataset is missing train or test splits!")

    X_train, y_train = train_df[features], train_df["label"].values
    X_val, y_val = val_df[features], val_df["label"].values
    X_test, y_test = test_df[features], test_df["label"].values

    # Compute population medians and standard deviations for explainability
    feature_medians = {col: float(dataset_df[col].median()) for col in features}
    feature_stds = {col: float(dataset_df[col].std()) for col in features}

    # 1. Train Logistic Regression Baseline
    lr_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(class_weight="balanced", C=0.5, random_state=random_seed)),
    ])
    lr_pipeline.fit(X_train, y_train)
    lr_test_probs = lr_pipeline.predict_proba(X_test)[:, 1]
    lr_metrics = evaluate_classifier(y_test, lr_test_probs, name="Logistic Regression Baseline")

    # 2. Train XGBoost Classifier
    # scale_pos_weight handles positive class imbalance
    n_pos = max(int(np.sum(y_train)), 1)
    n_neg = len(y_train) - n_pos
    scale_pos_weight = float(n_neg / n_pos)

    xgb_clf = xgb.XGBClassifier(
        n_estimators=30,
        max_depth=2,
        learning_rate=0.10,
        min_child_weight=2,
        reg_lambda=1.0,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=random_seed,
    )
    xgb_clf.fit(X_train, y_train)

    # 3. Calibrate Probabilities on Temporal Validation Split using Platt Scaling (sigmoid)
    calibrated_xgb = CalibratedClassifierCV(
        estimator=FrozenEstimator(xgb_clf),
        method="sigmoid",
    )
    calibrated_xgb.fit(X_val, y_val)

    xgb_test_probs = calibrated_xgb.predict_proba(X_test)[:, 1]
    xgb_metrics = evaluate_classifier(y_test, xgb_test_probs, name="Calibrated XGBoost Classifier")

    # Verify that XGBoost beats LR Baseline on PR-AUC
    pr_auc_diff = xgb_metrics["pr_auc"] - lr_metrics["pr_auc"]
    print("\n" + "=" * 80)
    print(f" MODEL COMPARISON (Test Split PR-AUC):")
    print(f"   XGBoost PR-AUC       : {xgb_metrics['pr_auc']:.4f}")
    print(f"   Logistic Reg PR-AUC  : {lr_metrics['pr_auc']:.4f}")
    print(f"   PR-AUC Advantage     : {pr_auc_diff:+.4f} ({'XGBoost WINS' if pr_auc_diff >= 0 else 'LR Baseline WINS'})")
    print("=" * 80)

    model_wrapper = WelfareRiskModel(
        calibrated_model=calibrated_xgb,
        feature_names=features,
        feature_medians=feature_medians,
        feature_stds=feature_stds,
        raw_model=xgb_clf,
        lr_baseline=lr_pipeline,
        metrics={
            "xgb": xgb_metrics,
            "lr": lr_metrics,
        },
    )

    return model_wrapper, xgb_metrics, lr_metrics


def main():
    parser = argparse.ArgumentParser(description="Train and calibrate Welfare Risk XGBoost model.")
    parser.add_argument(
        "--data-path",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "data" / "synthetic" / "training_dataset.parquet"),
        help="Path to training dataset parquet file.",
    )
    parser.add_argument(
        "--out-model",
        type=str,
        default=str(Path(__file__).resolve().parent / "model.joblib"),
        help="Path to save model.joblib artifact (default: backend/app/model.joblib)",
    )
    args = parser.parse_args()

    data_path = Path(args.data_path)
    out_model_path = Path(args.out_model)

    print("=" * 80)
    print(" PHASE 5.3: MODEL TRAINING & CALIBRATION")
    print("=" * 80)

    if not data_path.exists():
        print(f"Dataset not found at {data_path}. Assembling from raw tables...")
        tables, personnel_df, labels_df = load_synthetic_tables(data_path.parent)
        dataset_df = assemble_training_dataset(tables, labels_df, personnel_df)
        dataset_df.to_parquet(data_path, index=False)
    else:
        dataset_df = pd.read_parquet(data_path)

    print(f"Loaded dataset: {len(dataset_df)} rows across {dataset_df['split'].nunique()} splits.")

    model_wrapper, xgb_metrics, lr_metrics = train_and_calibrate(dataset_df)

    # Save model.joblib to requested path and also to backend/model.joblib for convenience
    model_wrapper.save(out_model_path)
    backend_root_joblib = Path(__file__).resolve().parent.parent / "model.joblib"
    model_wrapper.save(backend_root_joblib)

    print(f"\nSuccessfully persisted model artifact to:")
    print(f"  -> {out_model_path} ({out_model_path.stat().st_size / 1024:.1f} KB)")
    print(f"  -> {backend_root_joblib} ({backend_root_joblib.stat().st_size / 1024:.1f} KB)")
    print("=" * 80)


if __name__ == "__main__":
    main()
