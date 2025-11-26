/**
 * Modern Timeline Tab Component
 * Part of the Clinical UI Redesign Initiative
 * 
 * This is a complete redesign of the Timeline tab using modern visualization libraries:
 * - react-chrono for interactive timeline visualization
 * - framer-motion for smooth animations and transitions
 * - @nivo/calendar for calendar heatmap view
 * - vis-timeline for complex timeline features
 * - Patient journey visualization with milestone tracking
 * 
 * Date: 2025-08-04
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
  alpha,
  Snackbar,
  Paper,
  useMediaQuery,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Collapse,
  Badge,
  Slider,
  CircularProgress,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  Switch,
  Card,
  CardContent,
  CardMedia,
  LinearProgress,
  Grid,
  Tab,
  Tabs,
  Container
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LocalHospital as EncounterIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Assignment as ConditionIcon,
  Warning as AllergyIcon,
  Vaccines as ImmunizationIcon,
  Image as ImagingIcon,
  Assessment as VitalIcon,
  Flag as GoalIcon,
  Notes as NoteIcon,
  Print as PrintIcon,
  Timeline as TimelineIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Event as EventIcon,
  MedicalServices as ProcedureIcon,
  Description as PlanIcon,
  Group as TeamIcon,
  CreditCard as InsuranceIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon,
  ViewWeek as MultiTrackIcon,
  ViewStream as SingleTrackIcon,
  ViewList as ListViewIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  MoreVert as MoreIcon,
  Circle as DotIcon,
  Close as CloseIcon,
  ViewWeek,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPrevIcon,
  Speed as SpeedIcon,
  ShowChart as ChartIcon,
  CalendarViewMonth as CalendarViewIcon,
  AccountTree as JourneyIcon,
  Analytics as AnalyticsIcon,
  Map as MapIcon,
  Room as RoomIcon,
  LocalPharmacy as PharmacyIcon,
  Psychology as MentalHealthIcon,
  Favorite as HeartIcon,
  DirectionsWalk as ActivityIcon,
  Restaurant as NutritionIcon,
  Hotel as SleepIcon,
  FitnessCenter as ExerciseIcon,
  Mood as MoodIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AutoGraph as AutoGraphIcon,
  BubbleChart as BubbleChartIcon,
  DonutLarge as DonutIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Layers as LayersIcon,
  GridView as GridViewIcon,
  ViewInAr as View3DIcon,
  TouchApp as InteractiveIcon,
  MouseOutlined as MouseIcon,
  SwipeVertical as SwipeIcon,
  PanTool as PanIcon,
  ZoomInMap as ZoomMapIcon,
  MyLocation as LocationIcon,
  Navigation as NavigationIcon,
  Explore as ExploreIcon,
  Language as LanguageIcon,
  Translate as TranslateIcon,
  AccessibilityNew as AccessibilityIcon,
  VolumeUp as AudioIcon,
  Subtitles as SubtitlesIcon,
  BrightnessMedium as ContrastIcon,
  TextFields as FontSizeIcon,
  FormatSize as TextSizeIcon,
  Palette as ColorIcon,
  Brush as ThemeIcon,
  Dashboard as DashboardIcon,
  ViewColumn as ColumnIcon,
  ViewModule as ModuleIcon,
  ViewQuilt as QuiltIcon,
  ViewCompact as CompactIcon,
  ViewCozy as CozyIcon,
  ViewComfy as ComfyIcon,
  ViewAgenda as AgendaIcon,
  ViewDay as DayViewIcon,
  ViewWeekOutlined as WeekViewIcon,
  CalendarViewWeek as MonthViewIcon,
  CalendarViewDay as YearViewIcon
} from '@mui/icons-material';

// Import animation libraries
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useAnimation, useInView } from 'framer-motion';
import { Chrono } from 'react-chrono';
// import { ResponsiveCalendar } from '@nivo/calendar'; // Temporarily disabled due to rendering issues
import { 
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Cell
} from 'recharts';
// Import our custom vis-timeline wrapper
import VisTimelineWrapper from './VisTimelineWrapper';
// Import vis-timeline CSS
import './vis-timeline.css';

// Import date utilities
import { 
  format, 
  parseISO, 
  isWithinInterval, 
  subDays, 
  subMonths, 
  subYears, 
  startOfDay, 
  endOfDay, 
  differenceInDays, 
  addDays, 
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  isFuture,
  getYear,
  getMonth,
  getDay,
  getWeek,
  getHours,
  getMinutes,
  formatDistance,
  formatDistanceToNow,
  formatRelative,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  getDaysInMonth,
  getWeeksInMonth,
  addMonths,
  subMonths as subMonthsDate,
  addYears,
  subYears as subYearsDate,
  eachMonthOfInterval,
  eachYearOfInterval,
  isValid,
  compareAsc,
  compareDesc
} from 'date-fns';

// Import FHIR utilities
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { printDocument } from '../../../../core/export/printUtils';
import { getMedicationName, getMedicationDosageDisplay } from '../../../../core/fhir/utils/medicationDisplayUtils';
import { formatClinicalDate } from '../../../../core/fhir/utils/dateFormatUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { resourceBelongsToPatient } from '../../../../utils/fhir';
import websocketService from '../../../../services/websocket';

// Import shared clinical components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';

// Enhanced event type configuration
const eventTypes = {
  'Encounter': { 
    icon: <EncounterIcon />, 
    color: '#1976d2', // Blue
    label: 'Visit',
    category: 'clinical',
    importance: 8
  },
  'MedicationRequest': { 
    icon: <MedicationIcon />, 
    color: '#9c27b0', // Purple
    label: 'Medication',
    category: 'treatment',
    importance: 9
  },
  'MedicationStatement': { 
    icon: <MedicationIcon />, 
    color: '#9c27b0',
    label: 'Medication',
    category: 'treatment',
    importance: 8
  },
  'Observation': { 
    icon: <LabIcon />, 
    color: '#00bcd4', // Cyan
    label: 'Lab Result',
    category: 'diagnostic',
    importance: 7
  },
  'Condition': { 
    icon: <ConditionIcon />, 
    color: '#ff9800', // Orange
    label: 'Diagnosis',
    category: 'clinical',
    importance: 10
  },
  'AllergyIntolerance': { 
    icon: <AllergyIcon />, 
    color: '#f44336', // Red
    label: 'Allergy',
    category: 'clinical',
    importance: 10
  },
  'Immunization': { 
    icon: <ImmunizationIcon />, 
    color: '#4caf50', // Green
    label: 'Immunization',
    category: 'prevention',
    importance: 6
  },
  'Procedure': { 
    icon: <ProcedureIcon />, 
    color: '#3f51b5', // Indigo
    label: 'Procedure',
    category: 'treatment',
    importance: 8
  },
  'DiagnosticReport': { 
    icon: <LabIcon />, 
    color: '#00bcd4',
    label: 'Report',
    category: 'diagnostic',
    importance: 7
  },
  'ImagingStudy': { 
    icon: <ImagingIcon />, 
    color: '#795548', // Brown
    label: 'Imaging',
    category: 'diagnostic',
    importance: 8
  },
  'DocumentReference': { 
    icon: <NoteIcon />, 
    color: '#607d8b', // Blue Grey
    label: 'Note',
    category: 'documentation',
    importance: 5
  },
  'CarePlan': { 
    icon: <PlanIcon />, 
    color: '#009688', // Teal
    label: 'Care Plan',
    category: 'planning',
    importance: 7
  },
  'CareTeam': { 
    icon: <TeamIcon />, 
    color: '#00897b', // Teal Darker
    label: 'Care Team',
    category: 'planning',
    importance: 6
  },
  'Coverage': { 
    icon: <InsuranceIcon />, 
    color: '#455a64', // Blue Grey Darker
    label: 'Insurance',
    category: 'administrative',
    importance: 4
  },
  'Goal': { 
    icon: <GoalIcon />, 
    color: '#ff5722', // Deep Orange
    label: 'Goal',
    category: 'planning',
    importance: 6
  }
};

// Patient journey milestones
const journeyMilestones = {
  'diagnosis': {
    icon: <ConditionIcon />,
    color: '#ff9800',
    label: 'Diagnosis',
    description: 'Initial diagnosis or condition identified'
  },
  'treatment_start': {
    icon: <MedicationIcon />,
    color: '#9c27b0',
    label: 'Treatment Started',
    description: 'Beginning of treatment plan'
  },
  'procedure': {
    icon: <ProcedureIcon />,
    color: '#3f51b5',
    label: 'Procedure',
    description: 'Medical procedure performed'
  },
  'lab_result': {
    icon: <LabIcon />,
    color: '#00bcd4',
    label: 'Lab Result',
    description: 'Important lab result received'
  },
  'imaging': {
    icon: <ImagingIcon />,
    color: '#795548',
    label: 'Imaging',
    description: 'Imaging study completed'
  },
  'hospitalization': {
    icon: <EncounterIcon />,
    color: '#f44336',
    label: 'Hospitalization',
    description: 'Hospital admission'
  },
  'discharge': {
    icon: <EncounterIcon />,
    color: '#4caf50',
    label: 'Discharge',
    description: 'Hospital discharge'
  },
  'followup': {
    icon: <EventIcon />,
    color: '#2196f3',
    label: 'Follow-up',
    description: 'Follow-up appointment'
  },
  'recovery': {
    icon: <HeartIcon />,
    color: '#4caf50',
    label: 'Recovery',
    description: 'Recovery milestone achieved'
  },
  'goal_achieved': {
    icon: <GoalIcon />,
    color: '#ff5722',
    label: 'Goal Achieved',
    description: 'Treatment goal reached'
  }
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

const timelineVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 50,
      damping: 20
    }
  }
};

// Helper functions
const getEventDate = (event) => {
  switch (event.resourceType) {
    case 'Procedure':
      return event.performedDateTime || 
             event.performedPeriod?.start || 
             event.performedPeriod?.end ||
             event.occurrenceDateTime ||
             event.occurrencePeriod?.start ||
             event.date ||
             event.recordedDate ||
             null;
             
    case 'Observation':
      return event.effectiveDateTime || 
             event.effectivePeriod?.start ||
             event.issued ||
             event.date ||
             null;
             
    case 'MedicationRequest':
      return event.authoredOn || 
             event.dosageInstruction?.[0]?.timing?.event?.[0] ||
             event.dispenseRequest?.validityPeriod?.start ||
             null;
             
    case 'Condition':
      return event.onsetDateTime || 
             event.onsetPeriod?.start ||
             event.recordedDate ||
             event.dateRecorded ||
             null;
             
    case 'Encounter':
      return event.period?.start || 
             event.period?.end ||
             event.date ||
             null;
             
    default:
      return event.effectiveDateTime || 
             event.authoredOn || 
             event.dateTime ||
             event.date ||
             event.period?.start ||
             event.recordedDate ||
             null;
  }
};

const getEventTitle = (event) => {
  switch (event.resourceType) {
    case 'Encounter':
      return event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Encounter';
    case 'MedicationRequest':
      return getMedicationName(event);
    case 'Observation':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Observation';
    case 'Condition':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Condition';
    case 'Procedure':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Procedure';
    case 'AllergyIntolerance':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Allergy';
    case 'Immunization':
      return event.vaccineCode?.text || event.vaccineCode?.coding?.[0]?.display || 'Immunization';
    case 'DiagnosticReport':
      return event.code?.text || event.code?.coding?.[0]?.display || 'Report';
    case 'ImagingStudy':
      return event.procedureCode?.[0]?.text || event.procedureCode?.[0]?.coding?.[0]?.display || 'Imaging';
    case 'DocumentReference':
      return event.type?.text || event.type?.coding?.[0]?.display || 'Document';
    case 'CarePlan':
      return event.title || event.category?.[0]?.text || 'Care Plan';
    case 'Goal':
      return event.description?.text || 'Goal';
    default:
      return event.resourceType;
  }
};

const getEventDescription = (event) => {
  switch (event.resourceType) {
    case 'Encounter': {
      const encounterType = event.type?.[0]?.text || event.type?.[0]?.coding?.[0]?.display || 'Visit';
      const location = event.location?.[0]?.location?.display || '';
      const status = event.status || '';
      return `${encounterType}${location ? ` at ${location}` : ''}${status ? ` (${status})` : ''}`;
    }
      
    case 'MedicationRequest': {
      const med = getMedicationName(event);
      const dosage = getMedicationDosageDisplay(event);
      const status = event.status || '';
      return `${med}${dosage ? ` - ${dosage}` : ''}${status ? ` (${status})` : ''}`;
    }
      
    case 'Observation': {
      const obsName = event.code?.text || event.code?.coding?.[0]?.display || '';
      const value = event.valueQuantity ? 
        `${event.valueQuantity.value} ${event.valueQuantity.unit || ''}` : 
        event.valueString || '';
      const interpretation = event.interpretation?.[0]?.text || 
        event.interpretation?.[0]?.coding?.[0]?.display || '';
      return `${obsName}${value ? `: ${value}` : ''}${interpretation ? ` - ${interpretation}` : ''}`;
    }
      
    case 'Condition': {
      const condition = event.code?.text || event.code?.coding?.[0]?.display || '';
      const severity = event.severity?.text || event.severity?.coding?.[0]?.display || '';
      const clinicalStatus = event.clinicalStatus?.coding?.[0]?.code || '';
      return `${condition}${severity ? ` (${severity})` : ''}${clinicalStatus ? ` - ${clinicalStatus}` : ''}`;
    }
      
    case 'Procedure': {
      const procedure = event.code?.text || event.code?.coding?.[0]?.display || '';
      const outcome = event.outcome?.text || event.outcome?.coding?.[0]?.display || '';
      const procStatus = event.status || '';
      return `${procedure}${outcome ? ` - ${outcome}` : ''}${procStatus ? ` (${procStatus})` : ''}`;
    }
      
    default:
      return getEventTitle(event);
  }
};

const isResourceInactive = (resource) => {
  const status = resource.status || 
                 resource.clinicalStatus?.coding?.[0]?.code || 
                 resource.verificationStatus?.coding?.[0]?.code;
  
  return status && ['inactive', 'resolved', 'completed', 'stopped', 'entered-in-error', 'cancelled', 'ended'].includes(status);
};

const getEventSeverity = (event) => {
  if (isResourceInactive(event)) return 'low';
  
  switch (event.resourceType) {
    case 'AllergyIntolerance':
      const criticality = event.criticality;
      if (criticality === 'high') return 'critical';
      if (criticality === 'low') return 'moderate';
      return 'high';
      
    case 'Condition':
      const severity = event.severity?.coding?.[0]?.code;
      if (severity === 'severe') return 'critical';
      if (severity === 'moderate') return 'high';
      if (severity === 'mild') return 'moderate';
      return 'high';
      
    case 'Observation':
      const interpretation = event.interpretation?.[0]?.coding?.[0]?.code;
      if (['HH', 'LL', 'H>', 'L<'].includes(interpretation)) return 'critical';
      if (['H', 'L'].includes(interpretation)) return 'high';
      return 'moderate';
      
    case 'MedicationRequest':
      if (event.priority === 'urgent') return 'high';
      if (event.priority === 'stat') return 'critical';
      return 'moderate';
      
    case 'Encounter':
      if (event.class?.code === 'EMER') return 'critical';
      if (event.class?.code === 'IMP') return 'high';
      return 'low';
      
    default:
      return 'low';
  }
};

// Modern Timeline Tab Component
const TimelineTabModern = ({ patientId, patient, onNavigateToTab }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Create theme-aware event types
  const themedEventTypes = useMemo(() => ({
    'Encounter': { 
      icon: <EncounterIcon />, 
      color: theme.palette.primary.main,
      label: 'Visit',
      category: 'clinical',
      importance: 8
    },
    'MedicationRequest': { 
      icon: <MedicationIcon />, 
      color: theme.palette.secondary.main,
      label: 'Medication',
      category: 'treatment',
      importance: 9
    },
    'MedicationStatement': { 
      icon: <MedicationIcon />, 
      color: theme.palette.secondary.main,
      label: 'Medication',
      category: 'treatment',
      importance: 9
    },
    'Observation': { 
      icon: <LabIcon />, 
      color: theme.palette.info.main,
      label: 'Lab Result',
      category: 'diagnostic',
      importance: 7
    },
    'Condition': { 
      icon: <ConditionIcon />, 
      color: theme.palette.warning.main,
      label: 'Diagnosis',
      category: 'clinical',
      importance: 10
    },
    'AllergyIntolerance': { 
      icon: <AllergyIcon />, 
      color: theme.palette.error.main,
      label: 'Allergy',
      category: 'clinical',
      importance: 10
    },
    'Immunization': { 
      icon: <ImmunizationIcon />, 
      color: theme.palette.success.main,
      label: 'Immunization',
      category: 'prevention',
      importance: 6
    },
    'Procedure': { 
      icon: <ProcedureIcon />, 
      color: theme.palette.primary.dark,
      label: 'Procedure',
      category: 'treatment',
      importance: 8
    },
    'DiagnosticReport': { 
      icon: <LabIcon />, 
      color: theme.palette.info.main,
      label: 'Report',
      category: 'diagnostic',
      importance: 7
    },
    'ImagingStudy': { 
      icon: <ImagingIcon />, 
      color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : theme.palette.grey[700],
      label: 'Imaging',
      category: 'diagnostic',
      importance: 7
    },
    'DocumentReference': { 
      icon: <NoteIcon />, 
      color: theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[600],
      label: 'Note',
      category: 'documentation',
      importance: 5
    },
    'CarePlan': { 
      icon: <PlanIcon />, 
      color: theme.palette.info.dark,
      label: 'Care Plan',
      category: 'planning',
      importance: 8
    },
    'CareTeam': { 
      icon: <TeamIcon />, 
      color: theme.palette.info.light,
      label: 'Care Team',
      category: 'planning',
      importance: 6
    },
    'Coverage': { 
      icon: <InsuranceIcon />, 
      color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : theme.palette.grey[700],
      label: 'Insurance',
      category: 'administrative',
      importance: 4
    },
    'Goal': { 
      icon: <GoalIcon />, 
      color: theme.palette.warning.dark,
      label: 'Goal',
      category: 'planning',
      importance: 7
    },
  }), [theme]);

  // Create theme-aware journey milestones
  const themedJourneyMilestones = useMemo(() => ({
    'diagnosis': {
      icon: <ConditionIcon />,
      color: theme.palette.warning.main,
      label: 'Diagnosis',
      description: 'Initial diagnosis or condition identified'
    },
    'treatment_start': {
      icon: <MedicationIcon />,
      color: theme.palette.secondary.main,
      label: 'Treatment Started',
      description: 'Beginning of treatment plan'
    },
    'procedure': {
      icon: <ProcedureIcon />,
      color: theme.palette.primary.dark,
      label: 'Procedure',
      description: 'Medical procedure performed'
    },
    'lab_result': {
      icon: <LabIcon />,
      color: theme.palette.info.main,
      label: 'Lab Result',
      description: 'Important lab result received'
    },
    'imaging': {
      icon: <ImagingIcon />,
      color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : theme.palette.grey[700],
      label: 'Imaging',
      description: 'Imaging study completed'
    },
    'hospitalization': {
      icon: <EncounterIcon />,
      color: theme.palette.error.main,
      label: 'Hospitalization',
      description: 'Hospital admission'
    },
    'discharge': {
      icon: <EncounterIcon />,
      color: theme.palette.success.main,
      label: 'Discharge',
      description: 'Hospital discharge'
    },
    'followup': {
      icon: <EventIcon />,
      color: theme.palette.primary.main,
      label: 'Follow-up',
      description: 'Follow-up appointment'
    },
    'recovery': {
      icon: <HeartIcon />,
      color: theme.palette.success.main,
      label: 'Recovery',
      description: 'Recovery milestone achieved'
    },
    'goal_achieved': {
      icon: <GoalIcon />,
      color: theme.palette.warning.dark,
      label: 'Goal Achieved',
      description: 'Treatment goal reached'
    },
  }), [theme]);
  
  const { 
    resources, 
    searchResources,
    isResourceLoading, 
    currentPatient
  } = useFHIRResource();
  const { subscribe, notifications } = useClinicalWorkflow();
  
  // State
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline', 'journey', 'calendar', 'analytics'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = subYears(end, 1);
    return { start, end };
  });
  const [dateRangeValue, setDateRangeValue] = useState('1y'); // For the filter panel
  const [selectedTypes, setSelectedTypes] = useState(new Set(Object.keys(eventTypes)));
  const [showFilters, setShowFilters] = useState(false);
  const [showInactiveResources, setShowInactiveResources] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [dayDetailsDialogOpen, setDayDetailsDialogOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState({ date: null, events: [] });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(theme.palette.mode === 'dark');
  const [showLegend, setShowLegend] = useState(true);
  const [groupBy, setGroupBy] = useState('type'); // 'type', 'category', 'date', 'severity'
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState(new Set(['clinical', 'treatment', 'diagnostic', 'prevention', 'planning', 'documentation', 'administrative']));
  const [heatmapView, setHeatmapView] = useState('activity'); // 'activity', 'severity', 'category'
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [loadingError, setLoadingError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // Refs
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  
  // Animation controls
  const controls = useAnimation();
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacityProgress = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
  const springConfig = { stiffness: 400, damping: 30 };
  const scale = useSpring(scaleProgress, springConfig);
  const opacity = useSpring(opacityProgress, springConfig);
  
  // Check if element is in view
  const isInView = useInView(containerRef, { once: false, amount: 0.3 });
  
  // Load timeline data
  useEffect(() => {
    const loadData = async () => {
      if (!patientId || !dateRange.start) return;
      
      try {
        setLoadingError(null);
        
        const promises = Array.from(selectedTypes).map(async (resourceType) => {
          const params = {
            patient: patientId,
            _count: 100, // Load more resources for better timeline
            _sort: '-date'
          };
          
          // Add date range filters
          const dateParam = (() => {
            switch (resourceType) {
              case 'Condition': return 'recorded-date';
              case 'MedicationRequest': return 'authored';
              case 'Observation': return 'date';
              case 'Procedure': return 'performed';
              case 'Encounter': return 'date';
              case 'Immunization': return 'date';
              case 'DocumentReference': return 'date';
              case 'DiagnosticReport': return 'date';
              case 'AllergyIntolerance': return 'date';
              default: return 'date';
            }
          })();
          
          if (dateRange.start && dateRange.end) {
            params[dateParam] = `ge${dateRange.start.toISOString().split('T')[0]}&${dateParam}=le${dateRange.end.toISOString().split('T')[0]}`;
          }
          
          try {
            await searchResources(resourceType, params, !hasLoadedInitialData);
          } catch (error) {
            console.error(`Timeline: Error loading ${resourceType}:`, error);
          }
        });
        
        await Promise.all(promises);
        
        setHasLoadedInitialData(true);
      } catch (error) {
        console.error('Timeline: Error loading data', error);
        setLoadingError(error.message || 'Failed to load timeline data');
        setSnackbar({
          open: true,
          message: `Error loading timeline data: ${error.message || 'Unknown error'}`,
          severity: 'error'
        });
      }
    };
    
    loadData();
  }, [patientId, reloadTrigger]);
  
  // WebSocket subscription
  useEffect(() => {
    if (!patientId || !websocketService.isConnected) return;

    let subscriptionId = null;

    const setupPatientSubscription = async () => {
      try {
        const resourceTypes = Array.from(selectedTypes);
        subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
        console.log('[TimelineTabModern] Successfully subscribed to patient room:', subscriptionId);
        setReloadTrigger(prev => prev + 1);
      } catch (error) {
        console.error('[TimelineTabModern] Failed to subscribe to patient room:', error);
      }
    };

    setupPatientSubscription();

    return () => {
      if (subscriptionId) {
        websocketService.unsubscribeFromPatient(subscriptionId);
      }
    };
  }, [patientId, selectedTypes]);
  
  // Collect and process events
  const allEvents = useMemo(() => {
    const events = [];
    const seenIds = new Set();
    
    selectedTypes.forEach(resourceType => {
      if (resources && resources[resourceType]) {
        const resourceTypeData = resources[resourceType] || {};
        const patientResources = Array.isArray(resourceTypeData) 
          ? resourceTypeData.filter(r => resourceBelongsToPatient(r, patientId))
          : Object.values(resourceTypeData).filter(r => resourceBelongsToPatient(r, patientId));
        
        patientResources.forEach(resource => {
          const uniqueKey = `${resource.resourceType}-${resource.id}`;
          if (!seenIds.has(uniqueKey)) {
            seenIds.add(uniqueKey);
            events.push(resource);
          }
        });
      }
    });
    
    return events;
  }, [patientId, resources, selectedTypes]);
  
  // Filter and sort events
  const processedEvents = useMemo(() => {
    return allEvents
      .filter(event => {
        // Date filter
        const eventDate = getEventDate(event);
        if (!eventDate) return false;
        
        const date = new Date(eventDate);
        const startOfRangeDay = dateRange.start ? startOfDay(dateRange.start) : null;
        const endOfRangeDay = dateRange.end ? endOfDay(dateRange.end) : null;
        
        if (startOfRangeDay && date < startOfRangeDay) return false;
        if (endOfRangeDay && date > endOfRangeDay) return false;
        
        // Status filter
        if (!showInactiveResources && isResourceInactive(event)) {
          return false;
        }
        
        // Category filter
        const eventType = themedEventTypes[event.resourceType];
        if (eventType && !selectedCategories.has(eventType.category)) {
          return false;
        }
        
        // Search filter
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const title = getEventTitle(event).toLowerCase();
          const description = getEventDescription(event).toLowerCase();
          if (!title.includes(searchLower) && !description.includes(searchLower)) {
            return false;
          }
        }
        
        return true;
      })
      .map(event => ({
        ...event,
        _date: getEventDate(event),
        _title: getEventTitle(event),
        _description: getEventDescription(event),
        _severity: getEventSeverity(event),
        _type: themedEventTypes[event.resourceType] || { label: event.resourceType, color: theme.palette.grey[500], category: 'other' }
      }))
      .sort((a, b) => {
        const dateA = a._date;
        const dateB = b._date;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        return new Date(dateB) - new Date(dateA);
      });
  }, [allEvents, dateRange, searchQuery, showInactiveResources, selectedCategories]);
  
  // Prepare data for react-chrono
  const chronoItems = useMemo(() => {
    return processedEvents.map(event => ({
      title: formatClinicalDate(event._date),
      cardTitle: event._title,
      cardSubtitle: event._type.label,
      cardDetailedText: event._description,
      media: {
        type: 'IMAGE',
        source: {
          url: `data:image/svg+xml,${encodeURIComponent(`
            <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
              <rect width="60" height="60" fill="${event._type.color}" opacity="0.1"/>
              <text x="30" y="35" text-anchor="middle" font-size="24" fill="${event._type.color}">
                ${event._type.label.charAt(0)}
              </text>
            </svg>
          `)}`
        }
      },
      timelineContent: <div style={{ color: event._type.color }}>{event._type.label}</div>
    }));
  }, [processedEvents]);
  
  // Prepare data for vis-timeline
  const visTimelineItems = useMemo(() => {
    return processedEvents.map((event, index) => ({
      id: index,
      content: event._title,
      start: event._date,
      type: 'box',
      style: `background-color: ${event._type.color}20; border-color: ${event._type.color}; color: ${theme.palette.text.primary};`,
      group: groupBy === 'type' ? event.resourceType : 
             groupBy === 'category' ? event._type.category :
             groupBy === 'severity' ? event._severity : 0,
      className: `severity-${event._severity}`
    }));
  }, [processedEvents, groupBy, theme]);
  
  const visTimelineGroups = useMemo(() => {
    if (groupBy === 'type') {
      return Array.from(selectedTypes).map(type => ({
        id: type,
        content: eventTypes[type]?.label || type,
        style: `color: ${eventTypes[type]?.color || '#757575'};`
      }));
    } else if (groupBy === 'category') {
      return Array.from(selectedCategories).map(category => ({
        id: category,
        content: category.charAt(0).toUpperCase() + category.slice(1),
        style: `color: ${theme.palette.text.primary};`
      }));
    } else if (groupBy === 'severity') {
      return ['critical', 'high', 'moderate', 'low'].map(severity => ({
        id: severity,
        content: severity.charAt(0).toUpperCase() + severity.slice(1),
        style: `color: ${
          severity === 'critical' ? '#f44336' :
          severity === 'high' ? '#ff9800' :
          severity === 'moderate' ? '#2196f3' : '#4caf50'
        };`
      }));
    }
    return [];
  }, [groupBy, selectedTypes, selectedCategories, theme]);
  
  // Prepare data for calendar heatmap
  const calendarData = useMemo(() => {
    const dailyCounts = {};
    const dailySeverity = {};
    const dailyCategories = {};
    const eventsByDay = {};
    
    processedEvents.forEach(event => {
      if (!event._date) return;
      
      try {
        const dateStr = format(parseISO(event._date), 'yyyy-MM-dd');
        
        // Count events
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
        
        // Track severity
        if (!dailySeverity[dateStr] || 
            ['critical', 'high', 'moderate', 'low'].indexOf(event._severity) < 
            ['critical', 'high', 'moderate', 'low'].indexOf(dailySeverity[dateStr])) {
          dailySeverity[dateStr] = event._severity;
        }
        
        // Track categories
        if (!dailyCategories[dateStr]) {
          dailyCategories[dateStr] = new Set();
        }
        dailyCategories[dateStr].add(event._type.category);
        
        // Store events for tooltip
        if (!eventsByDay[dateStr]) {
          eventsByDay[dateStr] = [];
        }
        eventsByDay[dateStr].push(event);
      } catch (error) {
        console.error('Error processing date for calendar:', event._date, error);
      }
    });
    
    // Convert to array format for recharts calendar
    const fromDate = dateRange.start || subYears(new Date(), 1);
    const toDate = dateRange.end || new Date();
    
    // Create grid data for calendar
    const calendarGridData = [];
    const currentDate = new Date(fromDate);
    
    while (currentDate <= toDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const weekOfYear = getWeek(currentDate);
      const dayOfWeek = getDay(currentDate);
      const monthNum = getMonth(currentDate);
      
      const value = heatmapView === 'activity' ? (dailyCounts[dateStr] || 0) :
                    heatmapView === 'severity' ? 
                      (dailySeverity[dateStr] ? ['critical', 'high', 'moderate', 'low'].indexOf(dailySeverity[dateStr]) : -1) :
                      (dailyCategories[dateStr] ? dailyCategories[dateStr].size : 0);
      
      calendarGridData.push({
        date: dateStr,
        week: weekOfYear,
        day: dayOfWeek,
        month: monthNum,
        year: getYear(currentDate),
        value: value,
        count: dailyCounts[dateStr] || 0,
        severity: dailySeverity[dateStr] || 'none',
        events: eventsByDay[dateStr] || [],
        displayDate: formatClinicalDate(currentDate, 'monthDay')
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('[TimelineTabModern] Calendar data:', {
      count: calendarGridData.length,
      sample: calendarGridData.slice(0, 5),
      dateRange: {
        from: format(fromDate, 'yyyy-MM-dd'),
        to: format(toDate, 'yyyy-MM-dd')
      }
    });
    
    return calendarGridData;
  }, [processedEvents, heatmapView, dateRange]);
  
  // Calculate patient journey milestones
  const patientJourneyData = useMemo(() => {
    const milestones = [];
    const eventsByDate = {};
    
    // Group events by date
    processedEvents.forEach(event => {
      if (!event._date) return;
      const dateStr = format(parseISO(event._date), 'yyyy-MM-dd');
      if (!eventsByDate[dateStr]) {
        eventsByDate[dateStr] = [];
      }
      eventsByDate[dateStr].push(event);
    });
    
    // Identify milestones
    Object.entries(eventsByDate).forEach(([date, events]) => {
      // Check for diagnosis
      const diagnosis = events.find(e => e.resourceType === 'Condition');
      if (diagnosis) {
        milestones.push({
          date,
          type: 'diagnosis',
          event: diagnosis,
          title: diagnosis._title,
          description: diagnosis._description
        });
      }
      
      // Check for treatment start
      const medication = events.find(e => e.resourceType === 'MedicationRequest');
      if (medication) {
        milestones.push({
          date,
          type: 'treatment_start',
          event: medication,
          title: medication._title,
          description: medication._description
        });
      }
      
      // Check for procedures
      const procedure = events.find(e => e.resourceType === 'Procedure');
      if (procedure) {
        milestones.push({
          date,
          type: 'procedure',
          event: procedure,
          title: procedure._title,
          description: procedure._description
        });
      }
      
      // Check for hospitalizations
      const hospitalization = events.find(e => 
        e.resourceType === 'Encounter' && 
        (e.class?.code === 'IMP' || e.class?.code === 'EMER')
      );
      if (hospitalization) {
        milestones.push({
          date,
          type: 'hospitalization',
          event: hospitalization,
          title: 'Hospital Admission',
          description: hospitalization._description
        });
      }
      
      // Check for critical lab results
      const criticalLab = events.find(e => 
        e.resourceType === 'Observation' && 
        e._severity === 'critical'
      );
      if (criticalLab) {
        milestones.push({
          date,
          type: 'lab_result',
          event: criticalLab,
          title: 'Critical Lab Result',
          description: criticalLab._description
        });
      }
    });
    
    // Sort milestones by date
    return milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [processedEvents]);
  
  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const eventsByType = {};
    const eventsByCategory = {};
    const eventsBySeverity = {};
    const eventsByMonth = {};
    const eventTrends = [];
    
    processedEvents.forEach(event => {
      // Count by type
      eventsByType[event.resourceType] = (eventsByType[event.resourceType] || 0) + 1;
      
      // Count by category
      eventsByCategory[event._type.category] = (eventsByCategory[event._type.category] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event._severity] = (eventsBySeverity[event._severity] || 0) + 1;
      
      // Count by month
      if (event._date) {
        const monthKey = format(parseISO(event._date), 'yyyy-MM');
        eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
      }
    });
    
    // Prepare trend data
    const sortedMonths = Object.keys(eventsByMonth).sort();
    sortedMonths.forEach(month => {
      eventTrends.push({
        month,
        count: eventsByMonth[month],
        label: formatClinicalDate(month + '-01', 'shortMonthYear')
      });
    });
    
    return {
      byType: Object.entries(eventsByType).map(([type, count]) => ({
        type,
        count,
        label: eventTypes[type]?.label || type,
        color: eventTypes[type]?.color || '#757575'
      })),
      byCategory: Object.entries(eventsByCategory).map(([category, count]) => ({
        category,
        count,
        label: category.charAt(0).toUpperCase() + category.slice(1)
      })),
      bySeverity: Object.entries(eventsBySeverity).map(([severity, count]) => ({
        severity,
        count,
        label: severity.charAt(0).toUpperCase() + severity.slice(1),
        color: severity === 'critical' ? '#f44336' :
               severity === 'high' ? '#ff9800' :
               severity === 'moderate' ? '#2196f3' : '#4caf50'
      })),
      trends: eventTrends,
      total: processedEvents.length,
      active: processedEvents.filter(e => !isResourceInactive(e)).length,
      inactive: processedEvents.filter(e => isResourceInactive(e)).length
    };
  }, [processedEvents]);
  
  // Playback functionality
  useEffect(() => {
    if (isPlaying && processedEvents.length > 0) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentPlaybackIndex(prev => {
          if (prev >= processedEvents.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 3000 / playbackSpeed);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }
    
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, processedEvents.length]);
  
  // Handle resource updates from WebSocket
  const handleResourceUpdate = useCallback((event) => {
    if (event.patientId === patientId && selectedTypes.has(event.resourceType)) {
      console.log('[TimelineTabModern] Resource updated:', event);
      // Trigger a reload after a short delay to batch updates
      setReloadTrigger(prev => prev + 1);
    }
  }, [patientId, selectedTypes]);
  
  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribe(CLINICAL_EVENTS.RESOURCE_UPDATED, handleResourceUpdate);
    return () => unsubscribe();
  }, [subscribe, handleResourceUpdate]);
  
  // Process timeline data
  const processTimelineData = useCallback(() => {
    // Data processing is handled in the memoized values
    console.log('[TimelineTabModern] Processing timeline data');
  }, []);

  // Handlers
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setDetailsDialogOpen(true);
  };
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleSpeedChange = (event, newValue) => {
    setPlaybackSpeed(newValue);
  };
  
  const handleZoomIn = () => {
    setZoomLevel(Math.min(200, zoomLevel + 20));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(Math.max(50, zoomLevel - 20));
  };
  
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  const handleExport = () => {
    // TODO: Implement export functionality
    setSnackbar({
      open: true,
      message: 'Export functionality coming soon!',
      severity: 'info'
    });
  };
  
  const handleShare = () => {
    // TODO: Implement share functionality
    setSnackbar({
      open: true,
      message: 'Share functionality coming soon!',
      severity: 'info'
    });
  };
  
  const handlePrint = () => {
    const patientInfo = {
      name: patient ? 
        `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: patient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient?.id,
      birthDate: patient?.birthDate,
      gender: patient?.gender
    };
    
    let content = '<h2>Clinical Timeline</h2>';
    content += `<p>View: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}</p>`;
    content += `<p>Period: ${dateRange.start ? formatClinicalDate(dateRange.start) : 'N/A'} - ${dateRange.end ? formatClinicalDate(dateRange.end) : 'N/A'}</p>`;
    content += `<p>Total Events: ${processedEvents.length} (Active: ${analyticsData.active}, Historical: ${analyticsData.inactive})</p>`;

    if (viewMode === 'journey') {
      content += '<h3>Patient Journey Milestones</h3>';
      content += '<ul>';
      patientJourneyData.forEach(milestone => {
        content += `<li><strong>${formatClinicalDate(milestone.date)}</strong> - ${journeyMilestones[milestone.type].label}: ${milestone.title}</li>`;
      });
      content += '</ul>';
    } else {
      // Group by type for printing
      const eventsByType = {};
      processedEvents.forEach(event => {
        const type = event.resourceType;
        if (!eventsByType[type]) {
          eventsByType[type] = [];
        }
        eventsByType[type].push(event);
      });

      Object.entries(eventsByType).forEach(([type, events]) => {
        const config = eventTypes[type];
        content += `<h3>${config?.label || type} (${events.length})</h3>`;
        content += '<ul>';

        events.forEach(event => {
          const date = event._date;
          const dateStr = date ? formatClinicalDate(date, 'withTime') : 'No date';
          const status = isResourceInactive(event) ? ' [Historical]' : '';
          content += `<li><strong>${dateStr}</strong> - ${event._title}${status}</li>`;
        });

        content += '</ul>';
      });
    }
    
    printDocument({
      title: 'Clinical Timeline',
      patient: patientInfo,
      content
    });
  };
  
  // Use loading state from context
  const loading = isResourceLoading('Patient') || isResourceLoading('Observation') || isResourceLoading('Encounter') || !resources;
  
  if ((loading && !hasLoadedInitialData) || !resources) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
        <ClinicalLoadingState.SummaryCard count={4} />
        <Box sx={{ mt: 2 }}>
          <ClinicalLoadingState.FilterPanel />
        </Box>
        <Box sx={{ mt: 2, flex: 1 }}>
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </Box>
      </Box>
    );
  }
  
  if (loadingError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {loadingError}
          <Button onClick={() => window.location.reload()} sx={{ ml: 2 }}>
            Reload
          </Button>
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        bgcolor: isDarkMode ? 'grey.900' : 'background.default'
      }}
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {/* Enhanced Header with View Tabs */}
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 0,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: isDarkMode ? 'grey.800' : 'background.paper'
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Clinical Timeline
              </Typography>
              <Chip
                label={`${processedEvents.length} Events`}
                size="small"
                color="primary"
                sx={{ borderRadius: '4px' }}
              />
              {loading && (
                <CircularProgress size={20} />
              )}
            </Stack>
            
            <Stack direction="row" spacing={1}>
              <IconButton onClick={handleToggleFullscreen} size="small">
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
              <IconButton onClick={() => setIsDarkMode(!isDarkMode)} size="small">
                {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <IconButton onClick={handleExport} size="small">
                <DownloadIcon />
              </IconButton>
              <IconButton onClick={handleShare} size="small">
                <ShareIcon />
              </IconButton>
              <IconButton onClick={handlePrint} size="small">
                <PrintIcon />
              </IconButton>
            </Stack>
          </Stack>
          
          {/* View Mode Tabs */}
          <Tabs
            value={viewMode}
            onChange={(e, value) => setViewMode(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            <Tab 
              label="Timeline" 
              value="timeline"
              icon={<TimelineIcon />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab 
              label="Patient Journey" 
              value="journey"
              icon={<JourneyIcon />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab 
              label="Calendar" 
              value="calendar"
              icon={<CalendarViewIcon />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab 
              label="Analytics" 
              value="analytics"
              icon={<AnalyticsIcon />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
          </Tabs>
        </Paper>
        
        {/* Filter Bar */}
        <ClinicalFilterPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRangeValue}
          onDateRangeChange={(value) => {
            setDateRangeValue(value);
            // Convert string date range to actual dates
            const now = new Date();
            switch(value) {
              case '30d':
                setDateRange({ start: subDays(now, 30), end: now });
                break;
              case '90d':
                setDateRange({ start: subDays(now, 90), end: now });
                break;
              case '1y':
                setDateRange({ start: subYears(now, 1), end: now });
                break;
              case 'all':
              default:
                setDateRange({ start: subYears(now, 5), end: now });
                break;
            }
          }}
          onRefresh={() => setReloadTrigger(prev => prev + 1)}
          showCategories={false}
          onCategoriesChange={() => {}} // Not using categories in this component
          additionalFilters={
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={showInactiveResources}
                    onChange={(e) => setShowInactiveResources(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label="Historical"
                sx={{ m: 0 }}
              />
              <Button
                variant="outlined"
                startIcon={showFilters ? <ExpandLessIcon /> : <FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
                sx={{ borderRadius: 0 }}
              >
                Filters
              </Button>
              {viewMode === 'timeline' && (
                <>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      sx={{ borderRadius: 0 }}
                    >
                      <MenuItem value="type">By Type</MenuItem>
                      <MenuItem value="category">By Category</MenuItem>
                      <MenuItem value="severity">By Severity</MenuItem>
                      <MenuItem value="none">No Grouping</MenuItem>
                    </Select>
                  </FormControl>
                  <IconButton onClick={handleZoomOut} size="small">
                    <ZoomOutIcon />
                  </IconButton>
                  <Typography variant="caption">{zoomLevel}%</Typography>
                  <IconButton onClick={handleZoomIn} size="small">
                    <ZoomInIcon />
                  </IconButton>
                </>
              )}
              {viewMode === 'calendar' && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={heatmapView}
                    onChange={(e) => setHeatmapView(e.target.value)}
                    sx={{ borderRadius: 0 }}
                  >
                    <MenuItem value="activity">Activity</MenuItem>
                    <MenuItem value="severity">Severity</MenuItem>
                    <MenuItem value="category">Categories</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
          }
        />
        
        {/* Advanced Filters */}
        <Collapse in={showFilters}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Event Types</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(eventTypes).map(([type, config]) => (
                    <Chip
                      key={type}
                      label={config.label}
                      icon={config.icon}
                      onClick={() => {
                        setSelectedTypes(prev => {
                          const newTypes = new Set(prev);
                          if (prev.has(type)) {
                            newTypes.delete(type);
                          } else {
                            newTypes.add(type);
                          }
                          return newTypes;
                        });
                        setReloadTrigger(prev => prev + 1);
                      }}
                      sx={{ 
                        borderRadius: '4px',
                        borderColor: selectedTypes.has(type) ? config.color : 'divider',
                        bgcolor: selectedTypes.has(type) ? `${config.color}20` : 'transparent',
                        color: selectedTypes.has(type) ? config.color : 'text.secondary',
                        '& .MuiChip-icon': {
                          color: selectedTypes.has(type) ? config.color : 'text.secondary'
                        }
                      }}
                      variant={selectedTypes.has(type) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Categories</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['clinical', 'treatment', 'diagnostic', 'prevention', 'planning', 'documentation', 'administrative'].map(category => (
                    <Chip
                      key={category}
                      label={category.charAt(0).toUpperCase() + category.slice(1)}
                      onClick={() => {
                        setSelectedCategories(prev => {
                          const newCategories = new Set(prev);
                          if (prev.has(category)) {
                            newCategories.delete(category);
                          } else {
                            newCategories.add(category);
                          }
                          return newCategories;
                        });
                      }}
                      sx={{ borderRadius: '4px' }}
                      color={selectedCategories.has(category) ? 'primary' : 'default'}
                      variant={selectedCategories.has(category) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Collapse>
        
        {/* Main Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            {viewMode === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', padding: theme.spacing(2) }}
              >
                {processedEvents.length === 0 ? (
                  <ClinicalEmptyState
                    title="No events found"
                    message="Try adjusting your filters or date range"
                    actions={[
                      { 
                        label: 'Clear Filters', 
                        onClick: () => {
                          setSearchQuery('');
                          setSelectedTypes(new Set(Object.keys(eventTypes)));
                          setSelectedCategories(new Set(['clinical', 'treatment', 'diagnostic', 'prevention', 'planning', 'documentation', 'administrative']));
                          setShowInactiveResources(true);
                          setReloadTrigger(prev => prev + 1);
                        }
                      }
                    ]}
                  />
                ) : (
                  <Box sx={{ height: '100%', position: 'relative' }}>
                    <VisTimelineWrapper
                      items={visTimelineItems}
                      groups={visTimelineGroups}
                      defaultTimeStart={dateRange.start || subYears(new Date(), 1)}
                      defaultTimeEnd={dateRange.end || new Date()}
                      onItemClick={(itemId) => {
                        const event = processedEvents[itemId];
                        if (event) handleEventClick(event);
                      }}
                      onItemSelect={(itemId) => {
                        const event = processedEvents[itemId];
                        if (event) setSelectedEvent(event);
                      }}
                      options={{
                        stack: true,
                        stackSubgroups: true,
                        showTooltips: true,
                        tooltip: {
                          followMouse: true,
                          overflowMethod: 'cap'
                        },
                        zoomKey: 'ctrlKey',
                        horizontalScroll: true,
                        verticalScroll: true,
                        zoomable: true,
                        moveable: true,
                        selectable: true,
                        editable: false,
                        margin: {
                          item: 10,
                          axis: 50
                        },
                        zoomMin: 1000 * 60 * 60, // 1 hour
                        zoomMax: 1000 * 60 * 60 * 24 * 365 * 5, // 5 years
                        minHeight: 400,
                        orientation: 'top'
                      }}
                    />
                    
                    {/* Playback Controls */}
                    {animationEnabled && (
                      <Paper
                        elevation={4}
                        sx={{
                          position: 'absolute',
                          bottom: 16,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.paper, 0.95)
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <IconButton onClick={() => setCurrentPlaybackIndex(Math.max(0, currentPlaybackIndex - 1))}>
                            <SkipPrevIcon />
                          </IconButton>
                          <IconButton onClick={handlePlayPause} color="primary">
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                          </IconButton>
                          <IconButton onClick={() => setCurrentPlaybackIndex(Math.min(processedEvents.length - 1, currentPlaybackIndex + 1))}>
                            <SkipNextIcon />
                          </IconButton>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <SpeedIcon />
                            <Slider
                              value={playbackSpeed}
                              onChange={handleSpeedChange}
                              min={0.5}
                              max={3}
                              step={0.5}
                              marks
                              sx={{ width: 100 }}
                            />
                            <Typography variant="caption">{playbackSpeed}x</Typography>
                          </Stack>
                        </Stack>
                      </Paper>
                    )}
                  </Box>
                )}
              </motion.div>
            )}
            
            {viewMode === 'journey' && (
              <motion.div
                key="journey"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', padding: theme.spacing(2), overflow: 'auto' }}
              >
                {patientJourneyData.length === 0 ? (
                  <ClinicalEmptyState
                    title="No journey milestones found"
                    message="Patient journey milestones will appear as significant events occur"
                  />
                ) : (
                  <Container maxWidth="md">
                    <Stack spacing={4}>
                      {/* Journey Header */}
                      <Box textAlign="center">
                        <Typography variant="h5" gutterBottom>Patient Journey</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {patientJourneyData.length} key milestones over {
                            formatDistance(
                              parseISO(patientJourneyData[0].date),
                              parseISO(patientJourneyData[patientJourneyData.length - 1].date)
                            )
                          }
                        </Typography>
                      </Box>
                      
                      {/* Journey Timeline */}
                      <Box sx={{ position: 'relative' }}>
                        {/* Vertical Line */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: 0,
                            width: 2,
                            bgcolor: 'divider',
                            transform: 'translateX(-50%)'
                          }}
                        />
                        
                        {/* Milestones */}
                        {patientJourneyData.map((milestone, index) => {
                          const milestoneConfig = journeyMilestones[milestone.type];
                          const isLeft = index % 2 === 0;
                          
                          return (
                            <motion.div
                              key={`${milestone.type}-${milestone.date}`}
                              initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <Stack
                                direction={isLeft ? 'row' : 'row-reverse'}
                                alignItems="center"
                                spacing={3}
                                sx={{ mb: 6, position: 'relative' }}
                              >
                                {/* Content Card */}
                                <Card
                                  sx={{
                                    flex: 1,
                                    maxWidth: 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    '&:hover': {
                                      transform: 'scale(1.02)',
                                      boxShadow: 4
                                    }
                                  }}
                                  onClick={() => handleEventClick(milestone.event)}
                                >
                                  <CardContent>
                                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                      <Avatar sx={{ bgcolor: milestoneConfig.color, width: 32, height: 32 }}>
                                        {milestoneConfig.icon}
                                      </Avatar>
                                      <Typography variant="subtitle2" color="primary">
                                        {milestoneConfig.label}
                                      </Typography>
                                    </Stack>
                                    <Typography variant="h6" gutterBottom>
                                      {milestone.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" paragraph>
                                      {milestone.description}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatClinicalDate(milestone.date, 'verbose')}
                                    </Typography>
                                  </CardContent>
                                </Card>
                                
                                {/* Center Circle */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    bgcolor: milestoneConfig.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: 3,
                                    zIndex: 1
                                  }}
                                >
                                  {React.cloneElement(milestoneConfig.icon, { 
                                    sx: { color: 'white', fontSize: 20 }
                                  })}
                                </Box>
                                
                                {/* Spacer */}
                                <Box sx={{ flex: 1, maxWidth: 400 }} />
                              </Stack>
                            </motion.div>
                          );
                        })}
                      </Box>
                    </Stack>
                  </Container>
                )}
              </motion.div>
            )}
            
            {viewMode === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', padding: theme.spacing(2) }}
              >
                {calendarData.length === 0 ? (
                  <ClinicalEmptyState
                    title="No events to display"
                    message="No events found in the selected date range"
                    actions={[
                      { 
                        label: 'Adjust Date Range', 
                        onClick: () => {
                          setDateRangeValue('all');
                          setDateRange({ start: subYears(new Date(), 5), end: new Date() });
                        }
                      }
                    ]}
                  />
                ) : (
                  <Box 
                    sx={{ 
                      height: '100%', 
                      minHeight: 600,
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Activity Calendar
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {calendarData.length} days with events
                    </Typography>
                    <Box sx={{ flex: 1, minHeight: 500, overflow: 'auto' }}>
                      {/* Custom calendar heatmap component */}
                      <CalendarHeatmapComponent 
                        data={calendarData}
                        processedEvents={processedEvents}
                        heatmapView={heatmapView}
                        setHeatmapView={setHeatmapView}
                        isDarkMode={isDarkMode}
                        theme={theme}
                        onDayClick={(date, events) => {
                          if (events.length > 0) {
                            setSelectedDayEvents({ date, events });
                            setDayDetailsDialogOpen(true);
                          }
                        }}
                      />
                    </Box>
                  </Box>
                )}
              </motion.div>
            )}
            
            {viewMode === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', padding: theme.spacing(2), overflow: 'auto' }}
              >
                <Grid container spacing={3}>
                  {/* Summary Cards */}
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
                      <ClinicalSummaryCard
                        title="Total Events"
                        value={analyticsData.total}
                        icon={<EventIcon />}
                        severity="normal"
                      />
                      <ClinicalSummaryCard
                        title="Active"
                        value={analyticsData.active}
                        icon={<VisibilityIcon />}
                        severity="success"
                      />
                      <ClinicalSummaryCard
                        title="Historical"
                        value={analyticsData.inactive}
                        icon={<HistoryIcon />}
                        severity="normal"
                      />
                      <ClinicalSummaryCard
                        title="Categories"
                        value={selectedCategories.size}
                        icon={<LayersIcon />}
                        severity="normal"
                      />
                    </Stack>
                  </Grid>
                  
                  {/* Event Type Distribution */}
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 0, height: 400 }}>
                      <Typography variant="h6" gutterBottom>Event Types</Typography>
                      <Box sx={{ height: 'calc(100% - 40px)', position: 'relative' }}>
                        {analyticsData.byType.map((item, index) => {
                          const total = analyticsData.byType.reduce((sum, i) => sum + i.count, 0);
                          const percentage = (item.count / total * 100).toFixed(1);
                          
                          return (
                            <Box key={item.type} sx={{ mb: 2 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  {eventTypes[item.type]?.icon}
                                  <Typography variant="body2">{item.label}</Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  {item.count} ({percentage}%)
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={parseFloat(percentage)}
                                sx={{
                                  height: 8,
                                  borderRadius: 1,
                                  bgcolor: alpha(item.color, 0.1),
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: item.color,
                                    borderRadius: 1
                                  }
                                }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Grid>
                  
                  {/* Severity Distribution */}
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 0, height: 400 }}>
                      <Typography variant="h6" gutterBottom>Severity Distribution</Typography>
                      <Box sx={{ height: 'calc(100% - 40px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Stack spacing={2} sx={{ width: '100%', maxWidth: 300 }}>
                          {analyticsData.bySeverity.map((item) => {
                            const total = analyticsData.bySeverity.reduce((sum, i) => sum + i.count, 0);
                            const percentage = (item.count / total * 100).toFixed(1);
                            
                            return (
                              <Box key={item.severity}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                  <Chip
                                    label={item.label}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(item.color, 0.2),
                                      color: item.color,
                                      borderRadius: '4px'
                                    }}
                                  />
                                  <Typography variant="body2" color="text.secondary">
                                    {item.count} ({percentage}%)
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={parseFloat(percentage)}
                                  sx={{
                                    height: 8,
                                    borderRadius: 1,
                                    bgcolor: alpha(item.color, 0.1),
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: item.color,
                                      borderRadius: 1
                                    }
                                  }}
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    </Paper>
                  </Grid>
                  
                  {/* Timeline Trends */}
                  <Grid item xs={12}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 0 }}>
                      <Typography variant="h6" gutterBottom>Activity Over Time</Typography>
                      <Box sx={{ height: 300, position: 'relative' }}>
                        {analyticsData.trends.length === 0 ? (
                          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              No trend data available
                            </Typography>
                          </Box>
                        ) : (
                          <Stack spacing={1}>
                            {analyticsData.trends.map((month) => {
                              const maxCount = Math.max(...analyticsData.trends.map(m => m.count));
                              const percentage = (month.count / maxCount * 100);
                              
                              return (
                                <Box key={month.month}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                    <Typography variant="body2">{month.label}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {month.count} events
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    variant="determinate"
                                    value={percentage}
                                    sx={{
                                      height: 6,
                                      borderRadius: 1,
                                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                                      '& .MuiLinearProgress-bar': {
                                        borderRadius: 1
                                      }
                                    }}
                                  />
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
        
        {/* Event Details Dialog */}
        <Dialog
          open={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 0 } }}
        >
          <DialogTitle>
            Event Details
            <IconButton
              onClick={() => setDetailsDialogOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {selectedEvent && (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {selectedEvent._title}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip 
                        label={selectedEvent._type.label}
                        icon={selectedEvent._type.icon}
                        sx={{
                          borderRadius: '4px',
                          bgcolor: alpha(selectedEvent._type.color, 0.1),
                          color: selectedEvent._type.color,
                          '& .MuiChip-icon': {
                            color: selectedEvent._type.color
                          }
                        }}
                      />
                      <Chip
                        label={selectedEvent._severity}
                        size="small"
                        sx={{
                          borderRadius: '4px',
                          bgcolor: alpha(
                            selectedEvent._severity === 'critical' ? '#f44336' :
                            selectedEvent._severity === 'high' ? '#ff9800' :
                            selectedEvent._severity === 'moderate' ? '#2196f3' : '#4caf50',
                            0.1
                          ),
                          color: selectedEvent._severity === 'critical' ? '#f44336' :
                                 selectedEvent._severity === 'high' ? '#ff9800' :
                                 selectedEvent._severity === 'moderate' ? '#2196f3' : '#4caf50'
                        }}
                      />
                      {isResourceInactive(selectedEvent) && (
                        <Chip 
                          label="Historical"
                          size="small"
                          icon={<HistoryIcon />}
                          sx={{ borderRadius: '4px' }}
                        />
                      )}
                    </Stack>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {selectedEvent._date ? formatClinicalDate(selectedEvent._date, 'verboseWithTime') : 'No date'}
                  </Typography>
                </Stack>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="body2" paragraph>
                  {selectedEvent._description}
                </Typography>
                
                {/* Additional resource-specific details */}
                {selectedEvent.resourceType === 'Observation' && selectedEvent.referenceRange?.[0] && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Reference Range</Typography>
                    <Typography variant="body2">
                      {selectedEvent.referenceRange[0].low?.value} - {selectedEvent.referenceRange[0].high?.value} {selectedEvent.referenceRange[0].low?.unit}
                    </Typography>
                  </Box>
                )}
                
                {selectedEvent.note?.[0]?.text && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                    <Typography variant="body2">
                      {selectedEvent.note[0].text}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {onNavigateToTab && selectedEvent && (
              <Button 
                onClick={() => {
                  const resourceTypeToTab = {
                    'Encounter': 'encounters',
                    'MedicationRequest': 'chart-review',
                    'MedicationStatement': 'medications',
                    'Observation': 'results',
                    'Condition': 'chart-review',
                    'AllergyIntolerance': 'chart-review',
                    'Immunization': 'chart-review',
                    'ImagingStudy': 'imaging',
                    'DocumentReference': 'documentation',
                    'Goal': 'care-plan',
                    'CarePlan': 'care-plan',
                    'CareTeam': 'care-plan',
                    'Procedure': 'chart-review',
                    'DiagnosticReport': 'results'
                  };
                  
                  const tab = resourceTypeToTab[selectedEvent.resourceType] || 'summary';
                  onNavigateToTab(tab, {
                    resourceId: selectedEvent.id,
                    resourceType: selectedEvent.resourceType
                  });
                  setDetailsDialogOpen(false);
                }}
                variant="contained"
                sx={{ borderRadius: 0 }}
              >
                View in Tab
              </Button>
            )}
            <Button onClick={() => setDetailsDialogOpen(false)} sx={{ borderRadius: 0 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Day Details Dialog */}
        <Dialog
          open={dayDetailsDialogOpen}
          onClose={() => setDayDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h6">
                {selectedDayEvents.date && formatClinicalDate(selectedDayEvents.date, 'verbose')}
              </Typography>
              <IconButton onClick={() => setDayDetailsDialogOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <List>
              {selectedDayEvents.events.map((event, index) => {
                const eventType = themedEventTypes[event.resourceType];
                const navigateToResource = () => {
                  // Determine which tab to navigate to based on resource type
                  let targetTab = 'chart-review'; // default
                  switch (event.resourceType) {
                    case 'Encounter':
                      targetTab = 'encounters';
                      break;
                    case 'Observation':
                    case 'DiagnosticReport':
                      targetTab = 'results';
                      break;
                    case 'MedicationRequest':
                      targetTab = 'orders';
                      break;
                    case 'ImagingStudy':
                      targetTab = 'imaging';
                      break;
                    case 'DocumentReference':
                      targetTab = 'documentation';
                      break;
                    case 'CarePlan':
                    case 'Goal':
                      targetTab = 'care-plan';
                      break;
                    default:
                      targetTab = 'chart-review';
                  }
                  
                  // Close dialog and navigate
                  setDayDetailsDialogOpen(false);
                  onNavigateToTab(targetTab, { 
                    resourceId: event.id, 
                    resourceType: event.resourceType,
                    highlight: true 
                  });
                };

                return (
                  <React.Fragment key={event.id || index}>
                    <ListItem
                      button
                      onClick={navigateToResource}
                      sx={{
                        '&:hover': {
                          backgroundColor: alpha(eventType?.color || theme.palette.primary.main, 0.08)
                        }
                      }}
                    >
                      <ListItemIcon>
                        <Avatar
                          sx={{
                            bgcolor: alpha(eventType?.color || theme.palette.grey[500], 0.1),
                            color: eventType?.color || theme.palette.grey[700],
                            width: 40,
                            height: 40
                          }}
                        >
                          {eventType?.icon || <EventIcon />}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle1">
                              {event._title}
                            </Typography>
                            <Chip
                              label={eventType?.label || event.resourceType}
                              size="small"
                              sx={{ 
                                bgcolor: alpha(eventType?.color || theme.palette.grey[500], 0.1),
                                color: eventType?.color || theme.palette.text.primary
                              }}
                            />
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              {event._description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatClinicalDate(event._date, 'timeOnly')}
                            </Typography>
                          </Stack>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" size="small">
                          <NextIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < selectedDayEvents.events.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDayDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </motion.div>
    </Box>
  );
};

// Calendar Heatmap Component using Material-UI
const CalendarHeatmapComponent = ({ data, processedEvents, heatmapView, setHeatmapView, isDarkMode, theme, onDayClick }) => {
  // Calculate optimal box size based on container width
  const [boxSize, setBoxSize] = useState(15);
  const containerRef = useRef(null);
  
  useEffect(() => {
    const calculateBoxSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // 53 weeks * 7 days + gaps, with some margin
        const optimalSize = Math.floor((containerWidth - 150) / 60);
        setBoxSize(Math.max(12, Math.min(20, optimalSize)));
      }
    };
    
    calculateBoxSize();
    window.addEventListener('resize', calculateBoxSize);
    return () => window.removeEventListener('resize', calculateBoxSize);
  }, []);
  
  // Group data by year and week for more compact display
  const yearGroups = useMemo(() => {
    const groups = {};
    
    data.forEach(item => {
      const year = item.year;
      if (!groups[year]) {
        groups[year] = {
          year,
          weeks: {}
        };
      }
      
      const weekKey = item.week;
      if (!groups[year].weeks[weekKey]) {
        groups[year].weeks[weekKey] = [];
      }
      
      groups[year].weeks[weekKey].push(item);
    });
    
    return Object.values(groups).sort((a, b) => a.year - b.year);
  }, [data]);
  
  // Get color for a day based on value and heatmap view
  const getDayColor = (value, severity) => {
    if (value === 0 || value === -1) {
      return isDarkMode ? '#1e1e1e' : '#f5f5f5';
    }
    
    if (heatmapView === 'severity') {
      const severityColors = {
        'critical': '#f44336',
        'high': '#ff9800',
        'moderate': '#2196f3',
        'low': '#4caf50',
        'none': isDarkMode ? '#1e1e1e' : '#f5f5f5'
      };
      return severityColors[severity] || severityColors.none;
    } else if (heatmapView === 'activity') {
      // Activity gradient
      if (value === 1) return '#c6e48b';
      if (value === 2) return '#7bc96f';
      if (value === 3) return '#239a3b';
      if (value >= 4) return '#196127';
    } else {
      // Category count gradient
      if (value === 1) return '#e8f5e9';
      if (value === 2) return '#a5d6a7';
      if (value === 3) return '#66bb6a';
      if (value >= 4) return '#388e3c';
    }
    
    return isDarkMode ? '#333' : '#ddd';
  };
  
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return (
    <Box ref={containerRef} sx={{ width: '100%', overflow: 'auto' }}>
      {/* Year-based calendar layout */}
      {yearGroups.map((yearGroup) => (
        <Box key={yearGroup.year} sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {yearGroup.year}
          </Typography>
          
          {/* Month labels */}
          <Box sx={{ display: 'flex', mb: 1 }}>
            <Box sx={{ width: 30 }} />
            {monthLabels.map((month, idx) => {
              // Check if we have data for this month
              const hasData = Object.values(yearGroup.weeks).some(week => 
                week.some(day => day.month === idx)
              );
              return (
                <Box
                  key={idx}
                  sx={{
                    width: boxSize * 4.5,
                    textAlign: 'center',
                    fontSize: '11px',
                    color: hasData ? 'text.secondary' : 'text.disabled',
                    mx: 0.25
                  }}
                >
                  {month}
                </Box>
              );
            })}
          </Box>
          
          {/* Days grid */}
          <Box sx={{ display: 'flex' }}>
            {/* Day labels */}
            <Box sx={{ mr: 1 }}>
              {dayLabels.map((label, idx) => (
                <Box
                  key={idx}
                  sx={{
                    height: boxSize,
                    width: 20,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '10px',
                    color: 'text.secondary',
                    my: 0.25
                  }}
                >
                  {idx % 2 === 0 ? label : ''}
                </Box>
              ))}
            </Box>
            
            {/* Weeks */}
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              {/* Generate all 53 weeks */}
              {[...Array(53)].map((_, weekIdx) => {
                const weekData = yearGroup.weeks[weekIdx + 1] || [];
                
                return (
                  <Box key={weekIdx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {[...Array(7)].map((_, dayIdx) => {
                      const dayData = weekData.find(d => d.day === dayIdx);
                      
                      if (!dayData) {
                        return (
                          <Box
                            key={dayIdx}
                            sx={{
                              width: boxSize,
                              height: boxSize,
                              bgcolor: 'transparent'
                            }}
                          />
                        );
                      }
                      
                      return (
                        <Tooltip
                          key={dayIdx}
                          title={
                            <Box>
                              <Typography variant="subtitle2">
                                {formatClinicalDate(dayData.date, 'verbose')}
                              </Typography>
                              <Typography variant="caption">
                                {dayData.count} event{dayData.count !== 1 ? 's' : ''}
                              </Typography>
                              {dayData.events.length > 0 && (
                                <Box sx={{ mt: 0.5 }}>
                                  {dayData.events.slice(0, 3).map((event, idx) => (
                                    <Typography key={idx} variant="caption" display="block">
                                      • {event._title}
                                    </Typography>
                                  ))}
                                  {dayData.events.length > 3 && (
                                    <Typography variant="caption" color="text.secondary">
                                      ...and {dayData.events.length - 3} more
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </Box>
                          }
                        >
                          <Box
                            onClick={() => onDayClick(dayData.date, dayData.events)}
                            sx={{
                              width: boxSize,
                              height: boxSize,
                              bgcolor: getDayColor(dayData.value, dayData.severity),
                              borderRadius: '2px',
                              cursor: dayData.count > 0 ? 'pointer' : 'default',
                              border: 1,
                              borderColor: isDarkMode ? 'grey.900' : 'grey.100',
                              transition: 'all 0.2s',
                              '&:hover': dayData.count > 0 ? {
                                transform: 'scale(1.3)',
                                boxShadow: 2,
                                zIndex: 1,
                                borderColor: theme.palette.primary.main
                              } : {}
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      ))}
      
      
      {/* Legend */}
      <Box sx={{ 
        mt: 2, 
        pt: 2,
        borderTop: 1,
        borderColor: 'divider',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2
      }}>
        {/* Activity Legend */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">Activity:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">Less</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.background.default, borderRadius: '2px', border: 1, borderColor: 'divider' }} />
              <Box sx={{ width: 12, height: 12, bgcolor: alpha(theme.palette.success.light, 0.5), borderRadius: '2px' }} />
              <Box sx={{ width: 12, height: 12, bgcolor: alpha(theme.palette.success.light, 0.7), borderRadius: '2px' }} />
              <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.success.main, borderRadius: '2px' }} />
              <Box sx={{ width: 12, height: 12, bgcolor: theme.palette.success.dark, borderRadius: '2px' }} />
            </Box>
            <Typography variant="caption" color="text.secondary">More</Typography>
          </Box>
        </Box>
        
        {/* View Toggle */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant={heatmapView === 'activity' ? 'contained' : 'outlined'}
            onClick={() => setHeatmapView('activity')}
            sx={{ minWidth: 'auto', px: 2, py: 0.5, fontSize: '0.75rem' }}
          >
            Activity
          </Button>
          <Button
            size="small"
            variant={heatmapView === 'severity' ? 'contained' : 'outlined'}
            onClick={() => setHeatmapView('severity')}
            sx={{ minWidth: 'auto', px: 2, py: 0.5, fontSize: '0.75rem' }}
          >
            Severity
          </Button>
          <Button
            size="small"
            variant={heatmapView === 'type' ? 'contained' : 'outlined'}
            onClick={() => setHeatmapView('type')}
            sx={{ minWidth: 'auto', px: 2, py: 0.5, fontSize: '0.75rem' }}
          >
            Type
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(TimelineTabModern);