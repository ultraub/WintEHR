/**
 * Component Prop Interfaces for WintEHR
 *
 * TypeScript interfaces for React component props.
 * Organized by component category for easy discovery.
 */

import type { ReactNode, CSSProperties, MouseEvent, ChangeEvent } from 'react';
import type { SxProps, Theme } from '@mui/material';
import type {
  Patient,
  PatientSummary,
  Condition,
  ConditionSummary,
  MedicationRequest,
  MedicationSummary,
  AllergyIntolerance,
  AllergySummary,
  ServiceRequest,
  OrderSummary,
  Observation,
  LabResultSummary,
  VitalSignSummary,
  Encounter,
  EncounterSummary,
  ClinicalNote,
  PharmacyQueueItem,
  ImagingStudySummary,
} from './clinical';
import type { FHIRResource, Bundle } from './fhir';
import type { CatalogItem } from './api';
import type { ClinicalSeverity, ClinicalStatus, AsyncState } from './common';

// =============================================================================
// Base Component Props
// =============================================================================

/**
 * Base props shared by most components
 */
export interface BaseComponentProps {
  className?: string;
  style?: CSSProperties;
  sx?: SxProps<Theme>;
  'data-testid'?: string;
}

/**
 * Props for components with loading states
 */
export interface LoadingComponentProps extends BaseComponentProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * Props for components with error states
 */
export interface ErrorComponentProps extends BaseComponentProps {
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Props for components with both loading and error states
 */
export interface AsyncComponentProps extends LoadingComponentProps, ErrorComponentProps {}

// =============================================================================
// Clinical Shared Component Props
// =============================================================================

/**
 * ClinicalResourceCard props
 */
export interface ClinicalResourceCardProps extends BaseComponentProps {
  resource: FHIRResource;
  title: string;
  subtitle?: string;
  severity?: ClinicalSeverity;
  status?: ClinicalStatus;
  icon?: ReactNode;
  actions?: ReactNode;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  selected?: boolean;
  compact?: boolean;
  showBadge?: boolean;
  badgeContent?: ReactNode;
}

/**
 * ClinicalLoadingState props
 */
export interface ClinicalLoadingStateProps extends BaseComponentProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'circular' | 'linear' | 'skeleton';
  skeletonCount?: number;
}

/**
 * ClinicalEmptyState props
 */
export interface ClinicalEmptyStateProps extends BaseComponentProps {
  message: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * ClinicalErrorState props
 */
export interface ClinicalErrorStateProps extends BaseComponentProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showDetails?: boolean;
}

/**
 * SeverityBadge props
 */
export interface SeverityBadgeProps extends BaseComponentProps {
  severity: ClinicalSeverity;
  label?: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

/**
 * StatusChip props
 */
export interface StatusChipProps extends BaseComponentProps {
  status: ClinicalStatus;
  label?: string;
  size?: 'small' | 'medium';
}

// =============================================================================
// Patient Component Props
// =============================================================================

/**
 * PatientBanner props
 */
export interface PatientBannerProps extends AsyncComponentProps {
  patient: Patient | PatientSummary | null;
  onPatientSelect?: () => void;
  onPatientClear?: () => void;
  compact?: boolean;
  showPhoto?: boolean;
  showAllergies?: boolean;
  allergies?: AllergySummary[];
}

/**
 * PatientSearch props
 */
export interface PatientSearchProps extends BaseComponentProps {
  onPatientSelect: (patient: PatientSummary) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * PatientList props
 */
export interface PatientListProps extends AsyncComponentProps {
  patients: PatientSummary[];
  selectedPatientId?: string;
  onPatientSelect: (patient: PatientSummary) => void;
  showPagination?: boolean;
  pageSize?: number;
}

/**
 * PatientDemographics props
 */
export interface PatientDemographicsProps extends AsyncComponentProps {
  patient: Patient | null;
  editable?: boolean;
  onSave?: (patient: Patient) => void;
}

// =============================================================================
// Condition/Problem Component Props
// =============================================================================

/**
 * ConditionList props
 */
export interface ConditionListProps extends AsyncComponentProps {
  conditions: Condition[] | ConditionSummary[];
  onConditionSelect?: (condition: Condition | ConditionSummary) => void;
  selectedConditionId?: string;
  showInactive?: boolean;
  filterCategory?: string;
  sortBy?: 'onset' | 'status' | 'severity' | 'alphabetical';
}

/**
 * ConditionCard props
 */
export interface ConditionCardProps extends BaseComponentProps {
  condition: Condition | ConditionSummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showActions?: boolean;
  onEdit?: () => void;
  onResolve?: () => void;
}

/**
 * ProblemListEditor props
 */
export interface ProblemListEditorProps extends AsyncComponentProps {
  patientId: string;
  conditions: Condition[];
  onConditionAdd: (condition: Condition) => void;
  onConditionUpdate: (condition: Condition) => void;
  onConditionRemove: (conditionId: string) => void;
}

// =============================================================================
// Medication Component Props
// =============================================================================

/**
 * MedicationList props
 */
export interface MedicationListProps extends AsyncComponentProps {
  medications: MedicationRequest[] | MedicationSummary[];
  onMedicationSelect?: (medication: MedicationRequest | MedicationSummary) => void;
  selectedMedicationId?: string;
  showDiscontinued?: boolean;
  filterStatus?: string;
  groupBy?: 'none' | 'status' | 'category' | 'route';
}

/**
 * MedicationCard props
 */
export interface MedicationCardProps extends BaseComponentProps {
  medication: MedicationRequest | MedicationSummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showActions?: boolean;
  onRefill?: () => void;
  onDiscontinue?: () => void;
  onModify?: () => void;
}

/**
 * MedicationOrderForm props
 */
export interface MedicationOrderFormProps extends BaseComponentProps {
  patientId: string;
  onSubmit: (medicationRequest: MedicationRequest) => void;
  onCancel: () => void;
  initialValues?: Partial<MedicationRequest>;
  mode?: 'create' | 'edit' | 'renew';
}

// =============================================================================
// Allergy Component Props
// =============================================================================

/**
 * AllergyList props
 */
export interface AllergyListProps extends AsyncComponentProps {
  allergies: AllergyIntolerance[] | AllergySummary[];
  onAllergySelect?: (allergy: AllergyIntolerance | AllergySummary) => void;
  selectedAllergyId?: string;
  showResolved?: boolean;
  highlightCritical?: boolean;
}

/**
 * AllergyCard props
 */
export interface AllergyCardProps extends BaseComponentProps {
  allergy: AllergyIntolerance | AllergySummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showReactions?: boolean;
}

/**
 * AllergyBanner props
 */
export interface AllergyBannerProps extends BaseComponentProps {
  allergies: AllergySummary[];
  variant?: 'full' | 'compact' | 'badge-only';
  onExpand?: () => void;
}

// =============================================================================
// Order Component Props
// =============================================================================

/**
 * OrderList props
 */
export interface OrderListProps extends AsyncComponentProps {
  orders: ServiceRequest[] | OrderSummary[];
  onOrderSelect?: (order: ServiceRequest | OrderSummary) => void;
  selectedOrderId?: string;
  filterStatus?: string;
  filterCategory?: string;
  sortBy?: 'date' | 'priority' | 'status' | 'category';
}

/**
 * OrderCard props
 */
export interface OrderCardProps extends BaseComponentProps {
  order: ServiceRequest | OrderSummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showActions?: boolean;
  onCancel?: () => void;
  onModify?: () => void;
}

/**
 * OrderEntryForm props
 */
export interface OrderEntryFormProps extends BaseComponentProps {
  patientId: string;
  encounterId?: string;
  orderType: 'lab' | 'imaging' | 'procedure' | 'referral' | 'medication';
  onSubmit: (order: ServiceRequest) => void;
  onCancel: () => void;
  catalogItems?: CatalogItem[];
}

// CatalogItem imported from './api' to avoid duplicate export

// =============================================================================
// Results Component Props
// =============================================================================

/**
 * LabResultList props
 */
export interface LabResultListProps extends AsyncComponentProps {
  results: Observation[] | LabResultSummary[];
  onResultSelect?: (result: Observation | LabResultSummary) => void;
  selectedResultId?: string;
  filterCategory?: string;
  showAbnormalOnly?: boolean;
  groupBy?: 'none' | 'date' | 'category' | 'panel';
}

/**
 * LabResultCard props
 */
export interface LabResultCardProps extends BaseComponentProps {
  result: Observation | LabResultSummary;
  onClick?: () => void;
  selected?: boolean;
  showTrend?: boolean;
  trendData?: { date: string; value: number }[];
}

/**
 * VitalSignsPanel props
 */
export interface VitalSignsPanelProps extends AsyncComponentProps {
  vitals: VitalSignSummary[];
  onVitalSelect?: (vital: VitalSignSummary) => void;
  layout?: 'grid' | 'list' | 'compact';
  showTrends?: boolean;
}

/**
 * ResultTrendChart props
 */
export interface ResultTrendChartProps extends BaseComponentProps {
  data: { date: string; value: number }[];
  referenceRange?: { low: number; high: number };
  unit?: string;
  title?: string;
  height?: number;
}

// =============================================================================
// Encounter Component Props
// =============================================================================

/**
 * EncounterList props
 */
export interface EncounterListProps extends AsyncComponentProps {
  encounters: Encounter[] | EncounterSummary[];
  onEncounterSelect?: (encounter: Encounter | EncounterSummary) => void;
  selectedEncounterId?: string;
  filterClass?: string;
  filterStatus?: string;
  dateRange?: { start: string; end: string };
}

/**
 * EncounterCard props
 */
export interface EncounterCardProps extends BaseComponentProps {
  encounter: Encounter | EncounterSummary;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  showDiagnoses?: boolean;
}

/**
 * EncounterTimeline props
 */
export interface EncounterTimelineProps extends AsyncComponentProps {
  encounters: EncounterSummary[];
  onEncounterSelect?: (encounter: EncounterSummary) => void;
  selectedEncounterId?: string;
  orientation?: 'vertical' | 'horizontal';
}

// =============================================================================
// Clinical Notes Component Props
// =============================================================================

/**
 * ClinicalNoteList props
 */
export interface ClinicalNoteListProps extends AsyncComponentProps {
  notes: ClinicalNote[];
  onNoteSelect?: (note: ClinicalNote) => void;
  selectedNoteId?: string;
  filterType?: string;
  filterAuthor?: string;
  showUnsigned?: boolean;
}

/**
 * ClinicalNoteCard props
 */
export interface ClinicalNoteCardProps extends BaseComponentProps {
  note: ClinicalNote;
  onClick?: () => void;
  selected?: boolean;
  preview?: boolean;
  previewLength?: number;
}

/**
 * ClinicalNoteEditor props
 */
export interface ClinicalNoteEditorProps extends BaseComponentProps {
  patientId: string;
  encounterId?: string;
  noteType: string;
  initialContent?: string;
  onSave: (note: ClinicalNote) => void;
  onSign?: (note: ClinicalNote) => void;
  onCancel: () => void;
  templates?: NoteTemplate[];
}

/**
 * Note template
 */
export interface NoteTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
}

// =============================================================================
// Pharmacy Component Props
// =============================================================================

/**
 * PharmacyQueue props
 */
export interface PharmacyQueueProps extends AsyncComponentProps {
  items: PharmacyQueueItem[];
  onItemSelect?: (item: PharmacyQueueItem) => void;
  selectedItemId?: string;
  filterStatus?: string;
  filterPriority?: string;
}

/**
 * PharmacyQueueCard props
 */
export interface PharmacyQueueCardProps extends BaseComponentProps {
  item: PharmacyQueueItem;
  onClick?: () => void;
  selected?: boolean;
  showActions?: boolean;
  onVerify?: () => void;
  onDispense?: () => void;
  onHold?: () => void;
}

/**
 * DispenseForm props
 */
export interface DispenseFormProps extends BaseComponentProps {
  prescription: PharmacyQueueItem;
  onDispense: (dispenseData: DispenseData) => void;
  onCancel: () => void;
}

/**
 * Dispense data
 */
export interface DispenseData {
  quantity: number;
  daysSupply?: number;
  substitution?: boolean;
  pharmacistNotes?: string;
}

// =============================================================================
// Imaging Component Props
// =============================================================================

/**
 * ImagingStudyList props
 */
export interface ImagingStudyListProps extends AsyncComponentProps {
  studies: ImagingStudySummary[];
  onStudySelect?: (study: ImagingStudySummary) => void;
  selectedStudyId?: string;
  filterModality?: string;
  filterBodyPart?: string;
  dateRange?: { start: string; end: string };
}

/**
 * ImagingStudyCard props
 */
export interface ImagingStudyCardProps extends BaseComponentProps {
  study: ImagingStudySummary;
  onClick?: () => void;
  selected?: boolean;
  showThumbnail?: boolean;
}

/**
 * DicomViewer props
 */
export interface DicomViewerProps extends BaseComponentProps {
  studyId: string;
  seriesId?: string;
  instanceId?: string;
  tools?: DicomViewerTool[];
  onMeasurement?: (measurement: DicomMeasurement) => void;
}

/**
 * DICOM viewer tool
 */
export type DicomViewerTool =
  | 'pan'
  | 'zoom'
  | 'window-level'
  | 'length'
  | 'angle'
  | 'rectangle'
  | 'ellipse'
  | 'annotation';

/**
 * DICOM measurement
 */
export interface DicomMeasurement {
  type: 'length' | 'angle' | 'area';
  value: number;
  unit: string;
  coordinates: { x: number; y: number }[];
}

// =============================================================================
// FHIR Explorer Component Props
// =============================================================================

/**
 * FHIRResourceBrowser props
 */
export interface FHIRResourceBrowserProps extends AsyncComponentProps {
  resourceType?: string;
  searchParams?: Record<string, string>;
  onResourceSelect?: (resource: FHIRResource) => void;
  selectedResourceId?: string;
}

/**
 * FHIRResourceViewer props
 */
export interface FHIRResourceViewerProps extends BaseComponentProps {
  resource: FHIRResource;
  format?: 'json' | 'xml' | 'table';
  expandAll?: boolean;
  highlightChanges?: boolean;
}

/**
 * FHIRQueryBuilder props
 */
export interface FHIRQueryBuilderProps extends BaseComponentProps {
  resourceType: string;
  onSearch: (params: Record<string, string>) => void;
  initialParams?: Record<string, string>;
  mode?: 'visual' | 'code';
}

/**
 * FHIRBundleViewer props
 */
export interface FHIRBundleViewerProps extends BaseComponentProps {
  bundle: Bundle;
  onResourceSelect?: (resource: FHIRResource) => void;
  showPagination?: boolean;
  pageSize?: number;
}

// =============================================================================
// Layout Component Props
// =============================================================================

/**
 * ClinicalWorkspace props
 */
export interface ClinicalWorkspaceProps extends BaseComponentProps {
  patientId: string;
  tabs: TabConfig[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * Tab configuration for workspace
 */
export interface TabConfig {
  id: string;
  label: string;
  icon?: ReactNode;
  component: ReactNode;
  badge?: number;
  disabled?: boolean;
}

/**
 * SplitPane props
 */
export interface SplitPaneProps extends BaseComponentProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  defaultLeftWidth?: number | string;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  resizable?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * CollapsiblePanel props
 */
export interface CollapsiblePanelProps extends BaseComponentProps {
  title: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

// =============================================================================
// Dialog Component Props
// =============================================================================

/**
 * ConfirmDialog props
 */
export interface ConfirmDialogProps extends BaseComponentProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ResourceDialog props
 */
export interface ResourceDialogProps extends BaseComponentProps {
  open: boolean;
  title: string;
  resource: FHIRResource | null;
  onClose: () => void;
  onSave?: (resource: FHIRResource) => void;
  mode?: 'view' | 'edit' | 'create';
}
