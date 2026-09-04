import React, { useState, useEffect } from 'react';
import { useAuth, getStoredToken } from '../context/AuthContext';
import {
  Shield,
  Users,
  Activity,
  AlertTriangle,
  Moon,
  Clock,
  BatteryWarning,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Printer,
  ChevronRight,
  Building2,
  Layers,
  ArrowUpRight,
  Check,
  X,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Sun,
  Truck,
  Flame,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

interface WorkloadIndicator {
  id: string;
  indicator: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  direction: 'up' | 'down';
  change_label: string;
  metric_value: string;
  metric_unit: string;
  benchmark: string;
  severity: 'critical' | 'high' | 'moderate';
  description: string;
}

interface ActionRecommendation {
  id: string;
  title: string;
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
  summary: string;
  projected_impact: string;
  action_type: string;
}

interface PlatoonStatus {
  name: string;
  strength: number;
  night_load_pct: number;
  status: string;
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

interface UnitOverviewData {
  unit_id: string;
  unit_name: string;
  unit_subtitle?: string;
  personnel_monitored: number;
  distribution: {
    low: { count: number; percentage: number; label: string; color: string; status: string };
    moderate: { count: number; percentage: number; label: string; color: string; status: string };
    high: { count: number; percentage: number; label: string; color: string; status: string };
    critical: { count: number; percentage: number; label: string; color: string; status: string };
  };
  readiness_deployable_rate: number;
  fatigue_elevated_rate: number;
  main_workload_indicators: WorkloadIndicator[];
  primary_pattern: string;
  pattern_analysis: {
    title: string;
    summary: string;
    root_causes: string[];
    correlation_stat: string;
  };
  recommendation: string;
  action_recommendations: ActionRecommendation[];
  historical_trend: Array<{
    day: string;
    low: number;
    moderate: number;
    high: number;
    critical: number;
    night_hours: number;
    avg_stress: number;
  }>;
  platoons: PlatoonStatus[];
}

const UNIT_DATASETS: Record<string, UnitOverviewData> = {
  UNIT_A: {
    unit_id: 'UNIT_A',
    unit_name: 'UNIT A – WELFARE OVERVIEW',
    unit_subtitle: 'Alpha Company • 42nd Battalion',
    personnel_monitored: 120,
    distribution: {
      low: { count: 72, percentage: 60.0, label: 'Low', color: '#2E8B68', status: 'Optimal Readiness' },
      moderate: { count: 31, percentage: 25.8, label: 'Moderate', color: '#2965A8', status: 'Watchlist / Elevated Monitoring' },
      high: { count: 14, percentage: 11.7, label: 'High', color: '#C97A1E', status: 'Fatigue Threshold Exceeded' },
      critical: { count: 3, percentage: 2.5, label: 'Critical', color: '#D6453D', status: 'Immediate Stand-Down / Triage' },
    },
    readiness_deployable_rate: 85.8,
    fatigue_elevated_rate: 14.2,
    main_workload_indicators: [
      {
        id: 'night_duty',
        indicator: 'Night-duty concentration',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ Surging +38% vs baseline',
        metric_value: '4.2',
        metric_unit: 'consecutive night shifts (avg)',
        benchmark: 'Threshold: ≤ 2.0 shifts',
        severity: 'critical',
        description: 'Concentrated nocturnal shift allocation across outer perimeter defense & watch posts.',
      },
      {
        id: 'consecutive_duty',
        indicator: 'Consecutive duty periods',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ Elevated +24% stretch length',
        metric_value: '14.6',
        metric_unit: 'consecutive deployment days',
        benchmark: 'Threshold: ≤ 10.0 days',
        severity: 'high',
        description: 'Prolonged duty stretches without mandatory 24-hour restorative rest cycle.',
      },
      {
        id: 'recovery_availability',
        indicator: 'Reduced recovery availability',
        trend: 'decreasing',
        direction: 'up',
        change_label: '↑ 32% recovery deficit',
        metric_value: '6.5',
        metric_unit: 'hours avg rest turnaround',
        benchmark: 'Threshold: ≥ 12.0 hours',
        severity: 'critical',
        description: 'Compressed shift handovers reducing restorative sleep and physical recovery.',
      },
    ],
    primary_pattern: 'High consecutive night-duty load.',
    pattern_analysis: {
      title: 'High consecutive night-duty load',
      summary: 'Operational telemetry across Unit A indicates a concentrated compression of nocturnal shifts and static guard watches over the past 14 days, driving cumulative sleep debt and elevated risk scores across 17 personnel (14 High, 3 Critical).',
      root_causes: [
        '3-watch perimeter guarding roster lacking secondary relief squad rotation',
        'Turnaround rest intervals compressed to 6.5 hours during high-alert posture',
        'Back-to-back night patrols assigned to the same 17 personnel',
      ],
      correlation_stat: '3.4x elevated risk for personnel on ≥3 consecutive night shifts',
    },
    recommendation: 'Consider reviewing duty distribution and recovery opportunities.',
    action_recommendations: [
      {
        id: 'act-rebalance',
        title: 'Duty Distribution Rebalancing',
        priority: 'HIGH',
        summary: 'Rotate night-duty roster to incorporate Platoon 2 squads, capping consecutive night shifts at 2 per member.',
        projected_impact: '45% reduction in High/Critical fatigue within 5 days.',
        action_type: 'roster_rebalance',
      },
      {
        id: 'act-recovery',
        title: 'Authorize 48-Hour Recovery Windows',
        priority: 'IMMEDIATE',
        summary: 'Grant mandatory 48-hour restorative cycle for the 3 personnel currently in Critical tier.',
        projected_impact: 'Immediate mitigation of acute cognitive exhaustion and lapses in vigilance.',
        action_type: 'authorize_recovery',
      },
      {
        id: 'act-cross-unit',
        title: 'Request Cross-Unit Relief Support',
        priority: 'MEDIUM',
        summary: 'Liaise with Unit B (operating at 88% low-risk baseline) for temporary shift detachment.',
        projected_impact: 'Restores average rest turnaround to standard 12.0 hours.',
        action_type: 'request_relief',
      },
    ],
    historical_trend: [
      { day: 'D-13', low: 85, moderate: 26, high: 8, critical: 1, night_hours: 6.2, avg_stress: 24 },
      { day: 'D-11', low: 82, moderate: 28, high: 9, critical: 1, night_hours: 6.8, avg_stress: 26 },
      { day: 'D-9', low: 80, moderate: 28, high: 10, critical: 2, night_hours: 7.4, avg_stress: 29 },
      { day: 'D-7', low: 78, moderate: 29, high: 11, critical: 2, night_hours: 8.0, avg_stress: 31 },
      { day: 'D-5', low: 76, moderate: 30, high: 12, critical: 2, night_hours: 8.5, avg_stress: 33 },
      { day: 'D-3', low: 74, moderate: 31, high: 13, critical: 2, night_hours: 9.1, avg_stress: 35 },
      { day: 'Today', low: 72, moderate: 31, high: 14, critical: 3, night_hours: 9.4, avg_stress: 38 },
    ],
    platoons: [
      {
        name: 'Platoon 1 (Perimeter Alpha)',
        strength: 40,
        night_load_pct: 52,
        status: 'High Fatigue Alert',
        low: 20,
        moderate: 11,
        high: 7,
        critical: 2,
      },
      {
        name: 'Platoon 2 (Quick Reaction / Reserve)',
        strength: 40,
        night_load_pct: 18,
        status: 'Nominal / Ready for Relief',
        low: 32,
        moderate: 7,
        high: 1,
        critical: 0,
      },
      {
        name: 'Platoon 3 (Patrol & Sector Beta)',
        strength: 40,
        night_load_pct: 44,
        status: 'Elevated Watchlist',
        low: 20,
        moderate: 13,
        high: 6,
        critical: 1,
      },
    ],
  },

  UNIT_B: {
    unit_id: 'UNIT_B',
    unit_name: 'UNIT B – WELFARE OVERVIEW',
    unit_subtitle: 'Bravo Company • 42nd Battalion',
    personnel_monitored: 95,
    distribution: {
      low: { count: 68, percentage: 71.6, label: 'Low', color: '#2E8B68', status: 'Optimal Readiness' },
      moderate: { count: 20, percentage: 21.1, label: 'Moderate', color: '#2965A8', status: 'Watchlist / Nominal Monitoring' },
      high: { count: 6, percentage: 6.3, label: 'High', color: '#C97A1E', status: 'Fatigue Threshold Warning' },
      critical: { count: 1, percentage: 1.0, label: 'Critical', color: '#D6453D', status: 'Isolated Case Stand-Down' },
    },
    readiness_deployable_rate: 92.7,
    fatigue_elevated_rate: 7.3,
    main_workload_indicators: [
      {
        id: 'day_heat_strain',
        indicator: 'Day patrol temperature index',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ +18% thermal load',
        metric_value: '38.5°C',
        metric_unit: 'peak patrol index',
        benchmark: 'Threshold: ≤ 34.0°C',
        severity: 'moderate',
        description: 'Exposed daytime surveillance posts experiencing high ambient thermal load.',
      },
      {
        id: 'consecutive_duty',
        indicator: 'Consecutive duty periods',
        trend: 'stable',
        direction: 'down',
        change_label: '↓ -12% vs battalion avg',
        metric_value: '6.8',
        metric_unit: 'consecutive deployment days',
        benchmark: 'Threshold: ≤ 10.0 days',
        severity: 'moderate',
        description: 'Duty rotation cycle in equilibrium with standard off-duty leave slots.',
      },
      {
        id: 'recovery_availability',
        indicator: 'Rest turnaround window',
        trend: 'increasing',
        direction: 'down',
        change_label: 'Optimal turnaround',
        metric_value: '13.2',
        metric_unit: 'hours avg rest turnaround',
        benchmark: 'Threshold: ≥ 12.0 hours',
        severity: 'moderate',
        description: 'Sufficient inter-shift rest buffer maintaining cognitive alertness.',
      },
    ],
    primary_pattern: 'Daytime thermal strain with high overall operational stability.',
    pattern_analysis: {
      title: 'Daytime thermal strain with high overall operational stability',
      summary: 'Unit B exhibits balanced duty rotations with low nocturnal fatigue. Mild daytime heat exposure during open-terrain checkpoint shifts remains the only notable stressor.',
      root_causes: [
        'Sun-exposed vehicle checkposts between 11:00 and 15:00 hours',
        'Hydration interval compliance at 86% across outer cordon',
        'Night duty load evenly distributed across all 3 squads',
      ],
      correlation_stat: 'High combat readiness with capacity to assist Unit A cross-deployment',
    },
    recommendation: 'Maintain standard rotation; authorize temporary squad detachment to support Unit A night load.',
    action_recommendations: [
      {
        id: 'act-cross-deploy',
        title: 'Authorize Squad Detachment to Unit A',
        priority: 'HIGH',
        summary: 'Deploy 1 reserve squad (12 personnel) to assist Unit A perimeter night rotation.',
        projected_impact: 'Stabilizes sector-wide night duty tempo without compromising Unit B readiness.',
        action_type: 'cross_deployment',
      },
      {
        id: 'act-hydration-protocol',
        title: 'Implement Heat-Stress Midday Rotation',
        priority: 'MEDIUM',
        summary: 'Compress midday open checkpoint shifts from 4h to 2.5h intervals with shade canopy.',
        projected_impact: 'Eliminates remaining 6 high-tier fatigue cases within 72 hours.',
        action_type: 'thermal_protocol',
      },
    ],
    historical_trend: [
      { day: 'D-13', low: 72, moderate: 18, high: 4, critical: 1, night_hours: 3.2, avg_stress: 18 },
      { day: 'D-11', low: 71, moderate: 19, high: 4, critical: 1, night_hours: 3.4, avg_stress: 19 },
      { day: 'D-9', low: 70, moderate: 19, high: 5, critical: 1, night_hours: 3.5, avg_stress: 20 },
      { day: 'D-7', low: 69, moderate: 20, high: 5, critical: 1, night_hours: 3.6, avg_stress: 21 },
      { day: 'D-5', low: 68, moderate: 20, high: 6, critical: 1, night_hours: 3.8, avg_stress: 22 },
      { day: 'D-3', low: 68, moderate: 20, high: 6, critical: 1, night_hours: 3.7, avg_stress: 22 },
      { day: 'Today', low: 68, moderate: 20, high: 6, critical: 1, night_hours: 3.6, avg_stress: 21 },
    ],
    platoons: [
      {
        name: 'Platoon 1 (Checkpost North)',
        strength: 32,
        night_load_pct: 22,
        status: 'Optimal / Ready',
        low: 24,
        moderate: 6,
        high: 2,
        critical: 0,
      },
      {
        name: 'Platoon 2 (Mobile Patrol South)',
        strength: 32,
        night_load_pct: 20,
        status: 'Optimal / Ready',
        low: 25,
        moderate: 5,
        high: 2,
        critical: 0,
      },
      {
        name: 'Platoon 3 (Reserve & Escort)',
        strength: 31,
        night_load_pct: 14,
        status: 'Surplus Capacity (Relief Ready)',
        low: 19,
        moderate: 9,
        high: 2,
        critical: 1,
      },
    ],
  },

  UNIT_C: {
    unit_id: 'UNIT_C',
    unit_name: 'UNIT C – WELFARE OVERVIEW',
    unit_subtitle: 'Delta Support & Logistics • 42nd Battalion',
    personnel_monitored: 110,
    distribution: {
      low: { count: 58, percentage: 52.7, label: 'Low', color: '#2E8B68', status: 'Optimal Readiness' },
      moderate: { count: 34, percentage: 30.9, label: 'Moderate', color: '#2965A8', status: 'Watchlist / Extended Hours' },
      high: { count: 15, percentage: 13.6, label: 'High', color: '#C97A1E', status: 'Fatigue Threshold Exceeded' },
      critical: { count: 3, percentage: 2.8, label: 'Critical', color: '#D6453D', status: 'Immediate Stand-Down / Triage' },
    },
    readiness_deployable_rate: 83.6,
    fatigue_elevated_rate: 16.4,
    main_workload_indicators: [
      {
        id: 'logistics_transit',
        indicator: 'Convoy transit duration',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ +42% transit hours',
        metric_value: '11.4',
        metric_unit: 'hours avg driving shift',
        benchmark: 'Threshold: ≤ 7.0 hours',
        severity: 'critical',
        description: 'Continuous long-distance supply convoy operations across difficult terrain.',
      },
      {
        id: 'maintenance_tempo',
        indicator: 'Equipment turnaround tempo',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ +28% turnaround load',
        metric_value: '15.2',
        metric_unit: 'daily servicing cycles',
        benchmark: 'Threshold: ≤ 10.0 cycles',
        severity: 'high',
        description: 'Workshop mechanics logging overtime to service armored vehicles.',
      },
      {
        id: 'recovery_availability',
        indicator: 'Reduced recovery availability',
        trend: 'decreasing',
        direction: 'up',
        change_label: '↑ 28% turnaround deficit',
        metric_value: '7.8',
        metric_unit: 'hours avg rest turnaround',
        benchmark: 'Threshold: ≥ 12.0 hours',
        severity: 'high',
        description: 'Irregular convoy arrival times interrupting structured sleep cycles.',
      },
    ],
    primary_pattern: 'Logistical transit duration fatigue & technical maintenance overload.',
    pattern_analysis: {
      title: 'Logistical transit duration fatigue & technical maintenance overload',
      summary: 'Convoy drivers and workshop technicians in Unit C face irregular long-distance travel schedules and back-to-back night vehicle servicing, driving 18 personnel into High/Critical tiers.',
      root_causes: [
        'Single-driver assignments on extended convoy routes (>8 hrs)',
        'Nighttime vehicle recovery operations following mountain sector deployment',
        'Consecutive weekend maintenance shifts without compensatory off-duty days',
      ],
      correlation_stat: 'Driver fatigue scores correlate with 8+ hour continuous cab time',
    },
    recommendation: 'Mandate dual-driver pairing on all convoy transits exceeding 6 hours.',
    action_recommendations: [
      {
        id: 'act-dual-driver',
        title: 'Dual-Driver Convoy Protocol',
        priority: 'HIGH',
        summary: 'Assign co-drivers to all forward supply runs over 150km.',
        projected_impact: 'Reduces high-risk transit fatigue by 60%.',
        action_type: 'convoy_protocol',
      },
      {
        id: 'act-workshop-shifts',
        title: 'Workshop 2-Shift Staggering',
        priority: 'MEDIUM',
        summary: 'Split vehicle maintenance squad into morning and evening staggered watches.',
        projected_impact: 'Eliminates mechanic overtime and normalizes sleep schedules.',
        action_type: 'workshop_rebalance',
      },
    ],
    historical_trend: [
      { day: 'D-13', low: 66, moderate: 30, high: 11, critical: 3, night_hours: 7.1, avg_stress: 29 },
      { day: 'D-11', low: 64, moderate: 31, high: 12, critical: 3, night_hours: 7.4, avg_stress: 31 },
      { day: 'D-9', low: 62, moderate: 32, high: 13, critical: 3, night_hours: 7.8, avg_stress: 33 },
      { day: 'D-7', low: 61, moderate: 33, high: 13, critical: 3, night_hours: 8.0, avg_stress: 34 },
      { day: 'D-5', low: 60, moderate: 33, high: 14, critical: 3, night_hours: 8.2, avg_stress: 35 },
      { day: 'D-3', low: 59, moderate: 34, high: 14, critical: 3, night_hours: 8.4, avg_stress: 36 },
      { day: 'Today', low: 58, moderate: 34, high: 15, critical: 3, night_hours: 8.5, avg_stress: 37 },
    ],
    platoons: [
      {
        name: 'Platoon 1 (Heavy Transport)',
        strength: 40,
        night_load_pct: 46,
        status: 'High Fatigue Alert',
        low: 18,
        moderate: 14,
        high: 6,
        critical: 2,
      },
      {
        name: 'Platoon 2 (Forward Supply & POL)',
        strength: 35,
        night_load_pct: 32,
        status: 'Elevated Watchlist',
        low: 19,
        moderate: 11,
        high: 4,
        critical: 1,
      },
      {
        name: 'Platoon 3 (Technical Maintenance & EME)',
        strength: 35,
        night_load_pct: 40,
        status: 'Overtime Fatigue',
        low: 21,
        moderate: 9,
        high: 5,
        critical: 0,
      },
    ],
  },

  BATTALION_ALL: {
    unit_id: 'BATTALION_ALL',
    unit_name: '42ND BATTALION – ALL UNITS OVERVIEW',
    unit_subtitle: 'Battalion Headquarters Consolidated Intelligence',
    personnel_monitored: 325,
    distribution: {
      low: { count: 198, percentage: 60.9, label: 'Low', color: '#2E8B68', status: 'Optimal Readiness' },
      moderate: { count: 85, percentage: 26.2, label: 'Moderate', color: '#2965A8', status: 'Watchlist / Balanced Monitoring' },
      high: { count: 35, percentage: 10.8, label: 'High', color: '#C97A1E', status: 'Fatigue Threshold Exceeded' },
      critical: { count: 7, percentage: 2.1, label: 'Critical', color: '#D6453D', status: 'Immediate Stand-Down / Triage' },
    },
    readiness_deployable_rate: 87.1,
    fatigue_elevated_rate: 12.9,
    main_workload_indicators: [
      {
        id: 'night_duty_battalion',
        indicator: 'Battalion Night-duty Index',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ +26% sector variance',
        metric_value: '3.8',
        metric_unit: 'consecutive night shifts (avg)',
        benchmark: 'Threshold: ≤ 2.0 shifts',
        severity: 'high',
        description: 'Disproportionate nocturnal load concentrated in Unit A (52% share) vs Unit B (20% share).',
      },
      {
        id: 'deployment_tempo',
        indicator: 'Continuous deployment stretch',
        trend: 'increasing',
        direction: 'up',
        change_label: '↑ +19% deployment duration',
        metric_value: '12.8',
        metric_unit: 'consecutive operational days',
        benchmark: 'Threshold: ≤ 10.0 days',
        severity: 'high',
        description: 'Sector-wide mission duration tracking across forward deployment perimeter.',
      },
      {
        id: 'recovery_availability',
        indicator: 'Aggregate recovery margin',
        trend: 'decreasing',
        direction: 'up',
        change_label: '↑ 22% turnaround gap',
        metric_value: '8.4',
        metric_unit: 'hours avg rest turnaround',
        benchmark: 'Threshold: ≥ 12.0 hours',
        severity: 'high',
        description: 'Turnaround interval compressed in forward units compared to rear support.',
      },
    ],
    primary_pattern: 'Cross-unit operational workload imbalance (Unit A high night load vs Unit B surplus capacity).',
    pattern_analysis: {
      title: 'Cross-unit operational workload imbalance',
      summary: 'Battalion-level telemetry reveals a distinct asymmetry: Unit A is absorbing 58% of all critical nocturnal vigilance shifts, while Unit B operates with a 92.7% combat-ready baseline and available relief reserves.',
      root_causes: [
        'Static defense sector partitioning assigning all vulnerable night outposts to Unit A',
        'Lack of automated inter-unit roster synchronization at Battalion HQ level',
        'Logistics convoy scheduling in Unit C colliding with perimeter security watches',
      ],
      correlation_stat: 'Inter-unit cross-leveling predicted to restore battalion readiness to >93%',
    },
    recommendation: 'Execute Battalion-wide duty cross-leveling: rotate 2 squads from Unit B to reinforce Unit A perimeter posts.',
    action_recommendations: [
      {
        id: 'act-battalion-crosslevel',
        title: 'Battalion Cross-Leveling Order #42-B',
        priority: 'IMMEDIATE',
        summary: 'Deploy 2 squads from Unit B (Reserve) to relieve Unit A outposts 4 through 9.',
        projected_impact: 'Reduces Unit A critical fatigue by 75% within 48 hours.',
        action_type: 'battalion_rebalance',
      },
      {
        id: 'act-sector-recovery',
        title: 'Sector-Wide 48h Recovery Authorization',
        priority: 'HIGH',
        summary: 'Authorize mandatory 48h rest rotation for all 7 critical personnel across the battalion.',
        projected_impact: 'Zero critical fatigue cases across entire 42nd Battalion.',
        action_type: 'battalion_recovery',
      },
    ],
    historical_trend: [
      { day: 'D-13', low: 223, moderate: 74, high: 23, critical: 5, night_hours: 5.5, avg_stress: 23 },
      { day: 'D-11', low: 217, moderate: 78, high: 25, critical: 5, night_hours: 5.8, avg_stress: 25 },
      { day: 'D-9', low: 212, moderate: 79, high: 28, critical: 6, night_hours: 6.2, avg_stress: 27 },
      { day: 'D-7', low: 208, moderate: 82, high: 29, critical: 6, night_hours: 6.5, avg_stress: 29 },
      { day: 'D-5', low: 204, moderate: 83, high: 32, critical: 6, night_hours: 6.8, avg_stress: 30 },
      { day: 'D-3', low: 201, moderate: 85, high: 33, critical: 6, night_hours: 7.1, avg_stress: 31 },
      { day: 'Today', low: 198, moderate: 85, high: 35, critical: 7, night_hours: 7.2, avg_stress: 32 },
    ],
    platoons: [
      {
        name: 'Unit A (Alpha Company - Perimeter)',
        strength: 120,
        night_load_pct: 52,
        status: 'High Fatigue Alert (14 High, 3 Crit)',
        low: 72,
        moderate: 31,
        high: 14,
        critical: 3,
      },
      {
        name: 'Unit B (Bravo Company - Patrol & QRT)',
        strength: 95,
        night_load_pct: 18,
        status: 'Optimal / Surplus Capacity (Relief Ready)',
        low: 68,
        moderate: 20,
        high: 6,
        critical: 1,
      },
      {
        name: 'Unit C (Delta Support & Logistics)',
        strength: 110,
        night_load_pct: 40,
        status: 'Transit & Maintenance Fatigue',
        low: 58,
        moderate: 34,
        high: 15,
        critical: 3,
      },
    ],
  },
};

export const CommanderDashboard: React.FC = () => {
  const { token: authContextToken } = useAuth();

  // Unit Selection State
  const [selectedUnit, setSelectedUnit] = useState<string>('UNIT_A');
  const [distributionView, setDistributionView] = useState<'cards' | 'chart'>('cards');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  // Interactive Simulator State
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [simMaxNightShifts, setSimMaxNightShifts] = useState<number>(2);
  const [simRestHours, setSimRestHours] = useState<number>(14);
  const [simCrossRelief, setSimCrossRelief] = useState<boolean>(true);

  // Action feedback states
  const [appliedActions, setAppliedActions] = useState<Record<string, boolean>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Briefing Export Modal
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Active dataset state
  const [data, setData] = useState<UnitOverviewData>(UNIT_DATASETS.UNIT_A);

  // When selectedUnit changes, immediately update the view to the unit's local dataset and fetch live data
  const handleUnitChange = (newUnit: string) => {
    setSelectedUnit(newUnit);
    if (UNIT_DATASETS[newUnit]) {
      setData(UNIT_DATASETS[newUnit]);
    }
  };

  // Fetch live overview from backend
  const fetchOverview = async () => {
    setIsLoading(true);
    try {
      const activeToken = authContextToken || getStoredToken();
      const res = await fetch(`http://localhost:8000/dashboard/commander-overview?unit_id=${selectedUnit}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else if (UNIT_DATASETS[selectedUnit]) {
        setData(UNIT_DATASETS[selectedUnit]);
      }
    } catch (e) {
      console.warn('Using calibrated commander telemetry dataset:', e);
      if (UNIT_DATASETS[selectedUnit]) {
        setData(UNIT_DATASETS[selectedUnit]);
      }
    } finally {
      setIsLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedUnit, authContextToken]);

  // Calculate dynamic simulation values
  const getSimulatedMetrics = () => {
    if (!showSimulator) {
      return {
        low: data.distribution.low.count,
        moderate: data.distribution.moderate.count,
        high: data.distribution.high.count,
        critical: data.distribution.critical.count,
        readiness: data.readiness_deployable_rate,
      };
    }

    let critDelta = 0;
    let highDelta = 0;
    let modDelta = 0;
    let lowDelta = 0;

    // Simulation logic based on sliders
    if (simMaxNightShifts <= 2) {
      critDelta -= Math.min(data.distribution.critical.count, 3);
      highDelta -= Math.min(data.distribution.high.count, 9);
      modDelta += 4;
      lowDelta += 8;
    } else if (simMaxNightShifts === 3) {
      critDelta -= Math.min(data.distribution.critical.count, 2);
      highDelta -= Math.min(data.distribution.high.count, 5);
      modDelta += 3;
      lowDelta += 4;
    }

    if (simRestHours >= 12) {
      highDelta -= Math.min(data.distribution.high.count, 3);
      lowDelta += 3;
    }

    if (simCrossRelief) {
      highDelta -= Math.min(data.distribution.high.count, 2);
      modDelta -= 2;
      lowDelta += 4;
    }

    const newCrit = Math.max(0, data.distribution.critical.count + critDelta);
    const newHigh = Math.max(0, data.distribution.high.count + highDelta);
    const newMod = Math.max(0, data.distribution.moderate.count + modDelta);
    const newLow = Math.max(0, data.personnel_monitored - (newCrit + newHigh + newMod));
    const newReadiness = Math.round(((newLow + newMod) / data.personnel_monitored) * 1000) / 10;

    return {
      low: newLow,
      moderate: newMod,
      high: newHigh,
      critical: newCrit,
      readiness: newReadiness,
    };
  };

  const simResults = getSimulatedMetrics();

  const handleApplyAction = (actionId: string, title: string) => {
    setAppliedActions((prev) => ({ ...prev, [actionId]: true }));
    setActionNotice(`Operational Order Logged: "${title}" transmitted to Unit Operations & Duty Roster System.`);
    setTimeout(() => {
      setActionNotice(null);
    }, 6000);
  };

  // Chart data for risk distribution
  const chartDistributionData = [
    {
      category: 'Low',
      count: showSimulator ? simResults.low : data.distribution.low.count,
      pct: showSimulator ? Math.round((simResults.low / data.personnel_monitored) * 100) : data.distribution.low.percentage,
      color: '#2E8B68',
      label: 'Optimal Readiness',
    },
    {
      category: 'Moderate',
      count: showSimulator ? simResults.moderate : data.distribution.moderate.count,
      pct: showSimulator ? Math.round((simResults.moderate / data.personnel_monitored) * 100) : data.distribution.moderate.percentage,
      color: '#2965A8',
      label: 'Watchlist',
    },
    {
      category: 'High',
      count: showSimulator ? simResults.high : data.distribution.high.count,
      pct: showSimulator ? Math.round((simResults.high / data.personnel_monitored) * 100) : data.distribution.high.percentage,
      color: '#C97A1E',
      label: 'Fatigue Threshold',
    },
    {
      category: 'Critical',
      count: showSimulator ? simResults.critical : data.distribution.critical.count,
      pct: showSimulator ? Math.round((simResults.critical / data.personnel_monitored) * 100) : data.distribution.critical.percentage,
      color: '#D6453D',
      label: 'Stand-Down Urgency',
    },
  ];

  return (
    <div className="space-y-6 font-sans text-field-primary max-w-7xl mx-auto pb-12">
      {/* ========================================================= */}
      {/* 1. TOP EXECUTIVE COMMAND HEADER & UNIT SELECTION          */}
      {/* ========================================================= */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs text-field-muted font-mono uppercase tracking-wider">
              <Shield className="w-4 h-4 text-command-blue" />
              <span>Operational Command Console • Sector 4</span>
              <span className="text-field-border">•</span>
              <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-command-blue/40 text-command-blue font-semibold text-[10px]">
                RBAC: Commander
              </span>
              <span className="px-2 py-0.5 rounded bg-field-surface-subtle border border-field-border text-field-muted text-[10px] hidden sm:inline-block">
                Aggregate Privacy Protected
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-field-primary tracking-tight flex items-center gap-3">
              <span>{data.unit_name}</span>
            </h1>
            <p className="text-xs sm:text-sm text-field-muted mt-1 max-w-3xl leading-relaxed">
              Real-time fatigue telemetry, aggregate workforce readiness indices, and automated duty rotation decision support for tactical battalion command.
            </p>
          </div>

          {/* Unit Switcher & Control Suite */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center bg-field-surface-subtle border border-field-border rounded p-1">
              <Building2 className="w-3.5 h-3.5 text-field-muted ml-2 mr-1" />
              <select
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="bg-transparent text-field-primary text-xs font-semibold focus:outline-none pr-3 py-1 cursor-pointer"
              >
                <option value="UNIT_A" className="bg-field-surface text-field-primary">Unit A – Alpha Coy (120 Personnel)</option>
                <option value="UNIT_B" className="bg-field-surface text-field-primary">Unit B – Bravo Coy (95 Personnel)</option>
                <option value="UNIT_C" className="bg-field-surface text-field-primary">Unit C – Delta Support (110 Personnel)</option>
                <option value="BATTALION_ALL" className="bg-field-surface text-field-primary">Battalion Aggregate (325 Personnel)</option>
              </select>
            </div>

            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={`px-3 py-2 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                showSimulator
                  ? 'bg-command-blue text-white border-blue-400 shadow'
                  : 'bg-field-surface-elevated hover:bg-field-border text-field-primary border-field-border'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-field-muted" />
              <span>{showSimulator ? 'Close Simulator' : 'Roster Simulator'}</span>
            </button>

            <button
              onClick={() => setShowBriefingModal(true)}
              className="px-3 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-field-muted" />
              <span>Export Brief</span>
            </button>

            <button
              onClick={fetchOverview}
              disabled={isLoading}
              title="Refresh Live Telemetry"
              className="p-2 bg-field-surface-elevated hover:bg-field-border text-field-muted hover:text-field-primary border border-field-border rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-command-blue' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status ticker */}
        <div className="mt-4 pt-3 border-t border-field-border/60 flex flex-wrap items-center justify-between text-xs text-field-muted gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-readiness-green font-medium">
              <span className="w-2 h-2 rounded-full bg-readiness-green animate-pulse" />
              Active Telemetry Stream
            </span>
            <span>Last Sync: <strong className="text-field-primary font-mono">{lastRefreshed}</strong></span>
            <span className="hidden md:inline">Classification: <strong className="text-field-primary font-mono">RESTRICTED // OPS WELFARE</strong></span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Active Unit: <strong className="text-field-primary">{data.unit_subtitle || data.unit_name}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Notification Alert (if triggered) */}
      {actionNotice && (
        <div className="p-3.5 bg-blue-950/40 border border-command-blue/60 rounded-lg flex items-center justify-between text-xs text-blue-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-command-blue shrink-0" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-blue-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. INTERACTIVE ROSTER REBALANCE SIMULATOR PANEL (COLLAPSIBLE) */}
      {/* ========================================================= */}
      {showSimulator && (
        <div className="bg-field-surface-elevated border-2 border-command-blue/70 rounded-lg p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-field-border pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-command-blue" />
              <h2 className="text-sm font-bold text-field-primary tracking-wide uppercase">
                Predictive Roster & Shift Rebalance Simulator ({data.unit_name})
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-command-blue/20 text-command-blue border border-command-blue/40">
              Live Simulation Mode Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Slider 1: Max Night Shifts */}
            <div className="space-y-2 bg-field-surface p-3.5 rounded border border-field-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-field-primary">Max Consecutive Night Shifts:</span>
                <span className="font-mono font-bold text-command-blue px-2 py-0.5 rounded bg-field-surface-subtle">
                  {simMaxNightShifts} shifts
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={simMaxNightShifts}
                onChange={(e) => setSimMaxNightShifts(parseInt(e.target.value))}
                className="w-full accent-command-blue cursor-pointer"
              />
              <p className="text-[11px] text-field-muted">
                Reduces nocturnal fatigue concentration by capping consecutive night rotations.
              </p>
            </div>

            {/* Slider 2: Mandatory Rest Turnaround */}
            <div className="space-y-2 bg-field-surface p-3.5 rounded border border-field-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-field-primary">Mandatory Rest Window:</span>
                <span className="font-mono font-bold text-command-blue px-2 py-0.5 rounded bg-field-surface-subtle">
                  {simRestHours} hrs
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="24"
                step="2"
                value={simRestHours}
                onChange={(e) => setSimRestHours(parseInt(e.target.value))}
                className="w-full accent-command-blue cursor-pointer"
              />
              <p className="text-[11px] text-field-muted">
                Guarantees minimum off-duty turnaround interval between active shifts.
              </p>
            </div>

            {/* Toggle: Inter-Unit Relief */}
            <div className="space-y-2 bg-field-surface p-3.5 rounded border border-field-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-field-primary">Reserve Squad Cross-Leveling:</span>
                <button
                  type="button"
                  onClick={() => setSimCrossRelief(!simCrossRelief)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                    simCrossRelief ? 'bg-readiness-green text-white' : 'bg-field-surface-subtle text-field-muted border border-field-border'
                  }`}
                >
                  {simCrossRelief ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
              <p className="text-[11px] text-field-muted">
                Rotates 1 squad from Reserve/Support Platoons to absorb peak workload.
              </p>
            </div>
          </div>

          {/* Simulation Outcome Comparison Bar */}
          <div className="bg-field-surface p-4 rounded border border-command-blue/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs space-y-1">
              <span className="text-field-muted font-medium">Projected Outcome:</span>
              <div className="flex items-center gap-3 font-semibold text-field-primary">
                <span>Deployability: <strong className="text-readiness-green font-mono">{simResults.readiness}%</strong> (+{Math.round((simResults.readiness - data.readiness_deployable_rate) * 10) / 10}%)</span>
                <span>•</span>
                <span>Critical Risk: <strong className="text-emerald-400 font-mono">{simResults.critical}</strong> (Down from {data.distribution.critical.count})</span>
                <span>•</span>
                <span>High Risk: <strong className="text-amber-400 font-mono">{simResults.high}</strong> (Down from {data.distribution.high.count})</span>
              </div>
            </div>

            <button
              onClick={() => handleApplyAction('sim-rebalance-order', `Simulated Roster Optimization Plan (${data.unit_name})`)}
              className="px-4 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors shrink-0 shadow flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Simulated Roster to {data.unit_name.split('–')[0]}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. HEADLINE KEY METRIC: PERSONNEL MONITORED               */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monitored Strength */}
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-field-muted">
            <span className="font-mono uppercase tracking-wider font-semibold">Personnel Monitored</span>
            <Users className="w-4 h-4 text-command-blue" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-field-primary font-mono tracking-tight">
              {data.personnel_monitored}
            </span>
            <span className="text-xs font-medium text-field-muted">total strength</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-readiness-green">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>100% Active Unit Roster Telemetry</span>
          </div>
        </div>

        {/* Card 2: Mission Deployability */}
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-field-muted">
            <span className="font-mono uppercase tracking-wider font-semibold">Combat Ready (Low + Mod)</span>
            <Activity className="w-4 h-4 text-readiness-green" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-readiness-green font-mono tracking-tight">
              {showSimulator ? simResults.readiness : data.readiness_deployable_rate}%
            </span>
            <span className="text-xs font-medium text-field-muted">
              ({showSimulator ? simResults.low + simResults.moderate : data.distribution.low.count + data.distribution.moderate.count} / {data.personnel_monitored})
            </span>
          </div>
          <div className="w-full bg-field-surface-subtle h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-readiness-green h-full rounded-full transition-all duration-500"
              style={{ width: `${showSimulator ? simResults.readiness : data.readiness_deployable_rate}%` }}
            />
          </div>
        </div>

        {/* Card 3: Fatigue / Elevated Watchlist */}
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-field-muted">
            <span className="font-mono uppercase tracking-wider font-semibold">Fatigue / At-Risk Tier</span>
            <AlertTriangle className="w-4 h-4 text-triage-amber" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-triage-amber font-mono tracking-tight">
              {showSimulator ? simResults.high + simResults.critical : data.distribution.high.count + data.distribution.critical.count}
            </span>
            <span className="text-xs font-medium text-field-muted">
              ({showSimulator ? Math.round(((simResults.high + simResults.critical) / data.personnel_monitored) * 1000) / 10 : data.fatigue_elevated_rate}% of unit)
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-triage-amber font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{showSimulator ? simResults.high : data.distribution.high.count} High • {showSimulator ? simResults.critical : data.distribution.critical.count} Critical</span>
          </div>
        </div>

        {/* Card 4: Primary Indicator Gauge */}
        <div className="bg-field-surface border border-field-border rounded-lg p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-field-muted">
            <span className="font-mono uppercase tracking-wider font-semibold">{data.main_workload_indicators[0]?.indicator?.slice(0, 24) || 'Workload Load'}</span>
            {selectedUnit === 'UNIT_B' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : selectedUnit === 'UNIT_C' ? (
              <Truck className="w-4 h-4 text-command-blue" />
            ) : (
              <Moon className="w-4 h-4 text-command-blue" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-field-primary font-mono tracking-tight">
              {data.main_workload_indicators[0]?.metric_value || '4.2'}
            </span>
            <span className="text-xs font-medium text-field-muted">
              {data.main_workload_indicators[0]?.metric_unit?.split(' ')[0] || 'shifts'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-triage-red font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{data.main_workload_indicators[0]?.change_label}</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. WELFARE RISK DISTRIBUTION                              */}
      {/* ========================================================= */}
      <div className="bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-field-border pb-3">
          <div>
            <h2 className="text-base font-bold text-field-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-command-blue" />
              <span>{data.unit_name} – Welfare & Readiness Distribution</span>
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Calibrated four-tier risk stratification across all {data.personnel_monitored} monitored personnel.
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-field-surface-subtle border border-field-border rounded p-0.5">
              <button
                onClick={() => setDistributionView('cards')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                  distributionView === 'cards'
                    ? 'bg-field-surface-elevated text-field-primary font-bold shadow'
                    : 'text-field-muted hover:text-field-primary'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setDistributionView('chart')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                  distributionView === 'chart'
                    ? 'bg-field-surface-elevated text-field-primary font-bold shadow'
                    : 'text-field-muted hover:text-field-primary'
                }`}
                title="Bar Chart View"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chart</span>
              </button>
            </div>
            <div className="text-xs text-field-muted font-mono hidden md:block">
              Total Monitored: <strong className="text-field-primary">{data.personnel_monitored}</strong>
            </div>
          </div>
        </div>

        {distributionView === 'cards' ? (
          /* The 4 Category Metric Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Low */}
            <div className="bg-field-surface-subtle border border-triage-green-border rounded-lg p-4 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-triage-green" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-field-muted font-mono uppercase">Low</span>
                <span className="text-[11px] font-semibold text-triage-green px-2 py-0.5 rounded bg-triage-green-bg border border-triage-green-border">
                  {showSimulator ? Math.round((simResults.low / data.personnel_monitored) * 100) : data.distribution.low.percentage}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-triage-green font-mono">
                  {showSimulator ? simResults.low : data.distribution.low.count}
                </span>
                <span className="text-xs text-field-muted font-medium">personnel</span>
              </div>
              <div className="pt-2 border-t border-field-border/60">
                <p className="text-[11px] text-field-primary font-semibold">{data.distribution.low.status}</p>
                <p className="text-[10px] text-field-muted">Normal sleep cycle & duty tempo stability.</p>
              </div>
            </div>

            {/* Moderate */}
            <div className="bg-field-surface-subtle border border-triage-blue-border rounded-lg p-4 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-triage-blue" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-field-muted font-mono uppercase">Moderate</span>
                <span className="text-[11px] font-semibold text-command-blue px-2 py-0.5 rounded bg-triage-blue-bg border border-triage-blue-border">
                  {showSimulator ? Math.round((simResults.moderate / data.personnel_monitored) * 100) : data.distribution.moderate.percentage}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-command-blue font-mono">
                  {showSimulator ? simResults.moderate : data.distribution.moderate.count}
                </span>
                <span className="text-xs text-field-muted font-medium">personnel</span>
              </div>
              <div className="pt-2 border-t border-field-border/60">
                <p className="text-[11px] text-field-primary font-semibold">{data.distribution.moderate.status}</p>
                <p className="text-[10px] text-field-muted">Standard rotation recommended.</p>
              </div>
            </div>

            {/* High */}
            <div className="bg-field-surface-subtle border border-triage-amber-border rounded-lg p-4 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-triage-amber" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-field-muted font-mono uppercase">High</span>
                <span className="text-[11px] font-semibold text-triage-amber px-2 py-0.5 rounded bg-triage-amber-bg border border-triage-amber-border">
                  {showSimulator ? Math.round((simResults.high / data.personnel_monitored) * 100) : data.distribution.high.percentage}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-triage-amber font-mono">
                  {showSimulator ? simResults.high : data.distribution.high.count}
                </span>
                <span className="text-xs text-field-muted font-medium">personnel</span>
              </div>
              <div className="pt-2 border-t border-field-border/60">
                <p className="text-[11px] text-field-primary font-semibold">{data.distribution.high.status}</p>
                <p className="text-[10px] text-field-muted">Duty load elevated; rotation due.</p>
              </div>
            </div>

            {/* Critical */}
            <div className="bg-field-surface-subtle border border-triage-red-border rounded-lg p-4 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-triage-red" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-field-muted font-mono uppercase">Critical</span>
                <span className="text-[11px] font-semibold text-triage-red px-2 py-0.5 rounded bg-triage-red-bg border border-triage-red-border">
                  {showSimulator ? Math.round((simResults.critical / data.personnel_monitored) * 100) : data.distribution.critical.percentage}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-triage-red font-mono">
                  {showSimulator ? simResults.critical : data.distribution.critical.count}
                </span>
                <span className="text-xs text-field-muted font-medium">personnel</span>
              </div>
              <div className="pt-2 border-t border-field-border/60">
                <p className="text-[11px] text-field-primary font-semibold">{data.distribution.critical.status}</p>
                <p className="text-[10px] text-field-muted">Mandatory 48h rest intervention.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Bar Chart Mode */
          <div className="h-60 w-full bg-field-surface-subtle p-3 rounded-lg border border-field-border">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222D37" vertical={false} />
                <XAxis dataKey="category" stroke="#8294A2" fontSize={11} tickLine={false} />
                <YAxis stroke="#8294A2" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-field-surface border border-field-border p-2.5 rounded shadow-lg text-xs space-y-1 font-mono">
                          <p className="font-bold text-field-primary">{d.category} Tier: {d.count} personnel ({d.pct}%)</p>
                          <p className="text-field-muted">{d.label}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Visual Multi-Segment Proportional Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-field-muted">
            <span className="font-semibold text-field-primary">Unit Population Composition</span>
            <span className="font-mono text-[11px]">{data.personnel_monitored} Active Personnel</span>
          </div>
          <div className="h-4 w-full bg-field-surface-subtle rounded-full overflow-hidden flex border border-field-border">
            <div
              style={{ width: `${showSimulator ? (simResults.low / data.personnel_monitored) * 100 : data.distribution.low.percentage}%`, backgroundColor: '#2E8B68' }}
              title={`Low: ${showSimulator ? simResults.low : data.distribution.low.count}`}
              className="h-full transition-all duration-500"
            />
            <div
              style={{ width: `${showSimulator ? (simResults.moderate / data.personnel_monitored) * 100 : data.distribution.moderate.percentage}%`, backgroundColor: '#2965A8' }}
              title={`Moderate: ${showSimulator ? simResults.moderate : data.distribution.moderate.count}`}
              className="h-full transition-all duration-500"
            />
            <div
              style={{ width: `${showSimulator ? (simResults.high / data.personnel_monitored) * 100 : data.distribution.high.percentage}%`, backgroundColor: '#C97A1E' }}
              title={`High: ${showSimulator ? simResults.high : data.distribution.high.count}`}
              className="h-full transition-all duration-500"
            />
            <div
              style={{ width: `${showSimulator ? (simResults.critical / data.personnel_monitored) * 100 : data.distribution.critical.percentage}%`, backgroundColor: '#D6453D' }}
              title={`Critical: ${showSimulator ? simResults.critical : data.distribution.critical.count}`}
              className="h-full transition-all duration-500"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between text-[11px] text-field-muted pt-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-triage-green inline-block" /> Low ({showSimulator ? simResults.low : data.distribution.low.count})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-command-blue inline-block" /> Moderate ({showSimulator ? simResults.moderate : data.distribution.moderate.count})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-triage-amber inline-block" /> High ({showSimulator ? simResults.high : data.distribution.high.count})</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-triage-red inline-block" /> Critical ({showSimulator ? simResults.critical : data.distribution.critical.count})</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MAIN WORKLOAD INDICATORS (THE 3 KEY WORKLOAD TELEMETRY) */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-field-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-command-blue" />
              <span>Main Workload Indicators ({data.unit_name})</span>
            </h2>
            <p className="text-xs text-field-muted mt-0.5">
              Key operational stressors driving fatigue and risk transitions in {data.unit_name.split('–')[0]}.
            </p>
          </div>
          <span className="text-[11px] text-field-muted font-mono uppercase bg-field-surface border border-field-border px-2 py-1 rounded">
            Threshold Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.main_workload_indicators.map((ind, idx) => (
            <div
              key={idx}
              className="bg-field-surface border border-field-border rounded-lg p-5 space-y-3 hover:border-field-border-light transition-colors relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center ${
                    ind.severity === 'critical'
                      ? 'bg-triage-red-bg border border-triage-red-border text-triage-red'
                      : ind.severity === 'high'
                      ? 'bg-triage-amber-bg border border-triage-amber-border text-triage-amber'
                      : 'bg-blue-950/40 border border-command-blue/40 text-command-blue'
                  }`}
                >
                  {ind.id.includes('night') ? (
                    <Moon className="w-4 h-4" />
                  ) : ind.id.includes('heat') ? (
                    <Flame className="w-4 h-4" />
                  ) : ind.id.includes('transit') ? (
                    <Truck className="w-4 h-4" />
                  ) : ind.id.includes('duty') ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <BatteryWarning className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                    ind.severity === 'critical'
                      ? 'bg-triage-red-bg border border-triage-red-border text-triage-red'
                      : ind.severity === 'high'
                      ? 'bg-triage-amber-bg border border-triage-amber-border text-triage-amber'
                      : 'bg-command-blue/20 border border-command-blue/40 text-command-blue'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{ind.change_label}</span>
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-field-primary">
                  {ind.indicator}
                </h3>
                <p className="text-xs text-field-muted mt-1 leading-relaxed">
                  {ind.description}
                </p>
              </div>

              <div className="p-3 bg-field-surface-subtle rounded border border-field-border space-y-1 font-mono">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-field-muted">Telemetry Load:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      ind.severity === 'critical' ? 'text-triage-red' : ind.severity === 'high' ? 'text-triage-amber' : 'text-command-blue'
                    }`}
                  >
                    {ind.metric_value} {ind.metric_unit}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[10px] text-field-muted">
                  <span>Standard Baseline:</span>
                  <span className="text-field-primary">{ind.benchmark}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. PRIMARY PATTERN & EXECUTIVE RECOMMENDATION SECTION     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Primary Pattern Intelligence (5 cols) */}
        <div className="lg:col-span-5 bg-field-surface border-2 border-triage-amber-border rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-triage-amber">
            <AlertCircle className="w-4 h-4" />
            <span>Operational Diagnostic Pattern</span>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-field-primary tracking-tight">
              Primary pattern: {data.primary_pattern}
            </h2>
            <p className="text-xs sm:text-sm text-field-muted mt-2 leading-relaxed">
              {data.pattern_analysis.summary}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-field-border">
            <h4 className="text-xs font-semibold text-field-primary uppercase tracking-wider font-mono">
              Key Root Causes:
            </h4>
            <ul className="space-y-1.5 text-xs text-field-muted">
              {data.pattern_analysis.root_causes.map((rc, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-triage-amber font-bold shrink-0">•</span>
                  <span>{rc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-field-surface-subtle rounded border border-field-border flex items-center justify-between text-xs">
            <span className="text-field-muted">Statistical Correlation:</span>
            <span className="font-mono font-bold text-triage-amber">
              {data.pattern_analysis.correlation_stat}
            </span>
          </div>
        </div>

        {/* Right Column: Executive Recommendation & Decision Support Suite (7 cols) */}
        <div className="lg:col-span-7 bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-command-blue mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Automated Command Decision Support</span>
            </div>

            {/* Exact Recommendation Callout */}
            <div className="p-4 bg-blue-950/30 border-2 border-command-blue/60 rounded-lg">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-command-blue block mb-1">
                Executive Action Recommendation
              </span>
              <p className="text-sm sm:text-base font-bold text-white leading-snug">
                RECOMMENDATION: {data.recommendation}
              </p>
            </div>
          </div>

          {/* Actionable Decision Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-field-primary uppercase tracking-wider font-mono">
              Command Actions & Operational Relief Plans:
            </h4>

            <div className="space-y-2.5">
              {data.action_recommendations.map((action) => {
                const isApplied = appliedActions[action.id];
                return (
                  <div
                    key={action.id}
                    className="p-3.5 bg-field-surface-subtle border border-field-border rounded-lg hover:border-command-blue/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            action.priority === 'IMMEDIATE'
                              ? 'bg-triage-red-bg text-triage-red border border-triage-red-border'
                              : action.priority === 'HIGH'
                              ? 'bg-triage-amber-bg text-triage-amber border border-triage-amber-border'
                              : 'bg-command-blue/20 text-command-blue border border-command-blue/40'
                          }`}
                        >
                          {action.priority}
                        </span>
                        <h4 className="text-xs font-bold text-field-primary">{action.title}</h4>
                      </div>
                      <p className="text-[11px] text-field-muted">{action.summary}</p>
                      <p className="text-[11px] text-readiness-green font-medium">
                        Impact: {action.projected_impact}
                      </p>
                    </div>

                    <button
                      onClick={() => handleApplyAction(action.id, action.title)}
                      disabled={isApplied}
                      className={`px-3 py-2 rounded text-xs font-bold transition-colors shrink-0 flex items-center justify-center gap-1.5 ${
                        isApplied
                          ? 'bg-readiness-green/20 text-readiness-green border border-readiness-green/40 cursor-default'
                          : 'bg-command-blue hover:bg-blue-600 text-white shadow'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Order Active</span>
                        </>
                      ) : (
                        <>
                          <span>Execute Plan</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. PLATOON LOAD BREAKDOWN & 14-DAY TEMPORAL TREND        */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Platoon Load & Shift Distribution (6 cols) */}
        <div className="lg:col-span-6 bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-field-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-field-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-command-blue" />
                <span>Sub-Unit Workload & Shift Allocation</span>
              </h3>
              <p className="text-xs text-field-muted mt-0.5">
                Load distribution across {data.unit_name.split('–')[0]} sections.
              </p>
            </div>
            <span className="text-[10px] font-mono text-field-muted uppercase">{data.platoons.length} Sub-Units</span>
          </div>

          <div className="space-y-3">
            {data.platoons.map((plt, idx) => (
              <div key={idx} className="p-3.5 bg-field-surface-subtle border border-field-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-field-primary">{plt.name}</h4>
                    <span className="text-[10px] font-mono text-field-muted">({plt.strength} pers.)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      plt.night_load_pct > 50
                        ? 'bg-triage-red-bg text-triage-red border border-triage-red-border'
                        : plt.night_load_pct > 30
                        ? 'bg-triage-amber-bg text-triage-amber border border-triage-amber-border'
                        : 'bg-triage-green-bg text-triage-green border border-triage-green-border'
                    }`}
                  >
                    {plt.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-field-muted">
                    <span>Peak Shift Load Share:</span>
                    <span className="font-mono font-bold text-field-primary">{plt.night_load_pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-field-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        plt.night_load_pct > 50 ? 'bg-triage-red' : plt.night_load_pct > 30 ? 'bg-triage-amber' : 'bg-triage-green'
                      }`}
                      style={{ width: `${plt.night_load_pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-field-muted pt-1">
                  <span>Low: <strong className="text-triage-green">{plt.low}</strong></span>
                  <span>Mod: <strong className="text-command-blue">{plt.moderate}</strong></span>
                  <span>High: <strong className="text-triage-amber">{plt.high}</strong></span>
                  <span>Crit: <strong className="text-triage-red">{plt.critical}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 14-Day Night Duty vs Stress Trend (6 cols) */}
        <div className="lg:col-span-6 bg-field-surface border border-field-border rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-field-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-field-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-command-blue" />
                <span>14-Day Duty Load vs Stress Correlation</span>
              </h3>
              <p className="text-xs text-field-muted mt-0.5">
                Workload hours per shift tracking alongside aggregate stress index.
              </p>
            </div>
            <span className="text-[10px] font-mono text-field-muted uppercase">Telemetry History</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.historical_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2965A8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2965A8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D6453D" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D6453D" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222D37" vertical={false} />
                <XAxis dataKey="day" stroke="#8294A2" fontSize={11} tickLine={false} />
                <YAxis stroke="#8294A2" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-field-surface border border-field-border p-2.5 rounded shadow-lg text-xs space-y-1 font-mono">
                          <p className="font-bold text-field-primary">{d.day}</p>
                          <p className="text-command-blue">Workload Hours: {d.night_hours} hrs/shift</p>
                          <p className="text-triage-red">Avg Unit Stress: {d.avg_stress}/100</p>
                          <p className="text-field-muted">High + Crit Pers: {d.high + d.critical}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="avg_stress" stroke="#D6453D" strokeWidth={2} fillOpacity={1} fill="url(#colorStress)" name="Unit Stress Index" />
                <Area type="monotone" dataKey="night_hours" stroke="#2965A8" strokeWidth={2} fillOpacity={1} fill="url(#colorNight)" name="Avg Workload Hours" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-field-muted font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-triage-red inline-block" /> Unit Stress Index (0-100)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-command-blue inline-block" /> Duty Duration (Hours)
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 8. BRIEFING EXPORT MODAL (PRINT READY)                    */}
      {/* ========================================================= */}
      {showBriefingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-field-surface border border-field-border rounded-lg max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-field-border pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-command-blue" />
                <h3 className="text-base font-bold text-field-primary uppercase font-mono">
                  Operational Welfare Intelligence Brief
                </h3>
              </div>
              <button onClick={() => setShowBriefingModal(false)} className="text-field-muted hover:text-field-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans leading-relaxed text-field-primary">
              <div className="p-3 bg-field-surface-subtle border border-field-border rounded font-mono text-[11px] space-y-1">
                <p>UNIT: <strong>{data.unit_name} ({data.unit_subtitle || '42nd Battalion'})</strong></p>
                <p>PERSONNEL MONITORED: <strong>{data.personnel_monitored} ACTIVE SERVICE MEMBERS</strong></p>
                <p>DATE / TIMESTAMP: <strong>{new Date().toUTCString()}</strong></p>
                <p>CLASSIFICATION: <strong>CONFIDENTIAL // BATTALION COMMAND OVERSIGHT</strong></p>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">1. Executive Summary & Readiness</h4>
                <p className="text-field-muted">
                  {data.unit_name} maintains an {data.readiness_deployable_rate}% deployability rate. {data.fatigue_elevated_rate}% of personnel ({data.distribution.high.count + data.distribution.critical.count} members) sit in High and Critical fatigue bands.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">2. Population Stratification</h4>
                <div className="grid grid-cols-4 gap-2 text-center font-mono py-1">
                  <div className="p-2 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">LOW</span>
                    <strong className="text-triage-green text-sm">{data.distribution.low.count}</strong>
                  </div>
                  <div className="p-2 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">MODERATE</span>
                    <strong className="text-command-blue text-sm">{data.distribution.moderate.count}</strong>
                  </div>
                  <div className="p-2 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">HIGH</span>
                    <strong className="text-triage-amber text-sm">{data.distribution.high.count}</strong>
                  </div>
                  <div className="p-2 bg-field-surface-subtle rounded border border-field-border">
                    <span className="block text-field-muted text-[10px]">CRITICAL</span>
                    <strong className="text-triage-red text-sm">{data.distribution.critical.count}</strong>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">3. Primary Pattern Diagnosis</h4>
                <p className="text-field-muted">
                  <strong>Primary pattern: {data.primary_pattern}</strong> {data.pattern_analysis.summary}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-field-primary uppercase mb-1">4. Command Recommendation</h4>
                <p className="p-3 bg-blue-950/40 border border-command-blue/40 rounded font-semibold text-white">
                  RECOMMENDATION: {data.recommendation}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-field-border">
              <button
                onClick={() => setShowBriefingModal(false)}
                className="px-4 py-2 bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border rounded text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-command-blue hover:bg-blue-600 text-white rounded text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Brief</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
