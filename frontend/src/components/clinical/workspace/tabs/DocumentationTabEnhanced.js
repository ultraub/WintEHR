/**
 * Documentation Tab Component - Enhanced
 * Clinical notes, forms, and documentation management with tree view
 * Part of the Clinical UI Improvements Initiative
 */
import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Snackbar,
  Collapse,
  Badge,
  Fade,
  Avatar
} from '@mui/material';
// TreeView components removed - using custom implementation
import {
  Description as NoteIcon,
  Assignment as FormIcon,
  AttachFile as AttachmentIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Lock as SignedIcon,
  LockOpen as UnsignedIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
  Person as AuthorIcon,
  LocalOffer as TagIcon,
  History as HistoryIcon,
  Notes as SOAPIcon,
  Assessment as AssessmentIcon,
  EventNote as ProgressIcon,
  MedicalServices as ConsultIcon,
  Receipt as DischargeIcon,
  Visibility as VisibilityIcon,
  ChevronRight as ChevronRightIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  AccountTree as TreeIcon,
  ViewList as ListIcon,
  ViewModule as CardViewIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendUpIcon,
  AccessTime as RecentIcon,
  StarBorder as StarIcon,
  Star as StarFilledIcon,
  PushPin as PinIcon,
  Label as LabelIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as DraftIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  ContentCopy as DuplicateIcon,
  Compare as CompareIcon,
  Group as CollaboratorsIcon,
  Close as CloseIcon
} from '@mui/icons-material';
// Removed framer-motion for better performance
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { fhirClient } from '../../../../core/fhir/services/fhirClient';
import { printDocument, formatClinicalNoteForPrint, exportClinicalNote } from '../../../../core/export/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import EnhancedNoteEditor from '../dialogs/EnhancedNoteEditor';
import NoteTemplateWizard from '../dialogs/NoteTemplateWizard';
import { NOTE_TEMPLATES } from '../../../../services/noteTemplatesService';
import { 
  extractDocumentContent, 
  formatDocumentForDisplay, 
  processDocumentForDisplay
} from '../../../../core/documents/documentUtils';
// Import shared clinical components
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';
import { DocumentCardTemplate } from '../../shared/templates';
import { ContextualFAB } from '../../ui/QuickActionFAB';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';

// Custom hooks
const useDensity = () => {
  const [density, setDensity] = useState('comfortable');
  return { density, setDensity };
};

// Note type configuration with enhanced metadata
const noteTypes = {
  // LOINC codes from actual data
  '34117-2': { icon: <AssessmentIcon />, label: 'History & Physical', color: 'primary', category: 'assessment' },
  '51847-2': { icon: <ProgressIcon />, label: 'Evaluation & Plan', color: 'info', category: 'clinical' },
  // Common note types
  'progress': { icon: <ProgressIcon />, label: 'Progress Note', color: 'primary', category: 'clinical' },
  'soap': { icon: <SOAPIcon />, label: 'SOAP Note', color: 'info', category: 'clinical' },
  'consult': { icon: <ConsultIcon />, label: 'Consultation', color: 'secondary', category: 'specialty' },
  'discharge': { icon: <DischargeIcon />, label: 'Discharge Summary', color: 'warning', category: 'administrative' },
  'assessment': { icon: <AssessmentIcon />, label: 'Assessment', color: 'success', category: 'assessment' },
  'clinical-note': { icon: <NoteIcon />, label: 'Clinical Note', color: 'primary', category: 'clinical' },
  'other': { icon: <NoteIcon />, label: 'Other', color: 'default', category: 'other' }
};

// Document categories for tree view
const documentCategories = {
  clinical: { label: 'Clinical Notes', icon: <NoteIcon />, color: 'primary' },
  assessment: { label: 'Assessments', icon: <AssessmentIcon />, color: 'success' },
  specialty: { label: 'Specialty Consults', icon: <ConsultIcon />, color: 'secondary' },
  administrative: { label: 'Administrative', icon: <FormIcon />, color: 'warning' },
  other: { label: 'Other Documents', icon: <AttachmentIcon />, color: 'default' }
};

// Enhanced Note Card Component using shared components
const EnhancedNoteCard = memo(({ note, onEdit, onView, onSign, onPrint, onExport, onFavorite, onPin, density = 'comfortable', isAlternate = false }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const noteType = note.type?.coding?.[0]?.code || 'other';
  const typeConfig = noteTypes[noteType] || noteTypes.other;
  const author = note.author?.[0]?.display || 'Unknown';
  const date = note.date || note.meta?.lastUpdated;
  const isSigned = note.docStatus === 'final';
  
  // Determine severity based on note status
  const getSeverity = () => {
    if (note.docStatus === 'draft') return 'high';
    if (note.docStatus === 'preliminary') return 'moderate';
    if (noteType === 'discharge') return 'high';
    if (noteType === 'consult') return 'moderate';
    return 'normal';
  };
  
  const getStatusColor = () => {
    if (note.docStatus === 'draft') return 'warning';
    if (note.docStatus === 'final') return 'success';
    return 'info';
  };
  
  const details = [
    { label: 'Type', value: typeConfig.label },
    { label: 'Author', value: author },
    { label: 'Date', value: format(parseISO(date), 'MMM d, yyyy h:mm a') },
    { label: 'Status', value: note.docStatus || 'unknown' }
  ];
  
  if (note.displayContent) {
    details.push({ label: 'Words', value: note.displayContent.split(/\s+/).length });
  }
  
  const actions = [
    {
      label: 'View',
      icon: <VisibilityIcon />,
      onClick: () => onView(note)
    },
    !isSigned && {
      label: 'Edit',
      icon: <EditIcon />,
      onClick: () => onEdit(note)
    },
    {
      label: 'Print',
      icon: <PrintIcon />,
      onClick: () => onPrint(note)
    },
    {
      label: note.isFavorite ? 'Unfavorite' : 'Favorite',
      icon: note.isFavorite ? <StarFilledIcon /> : <StarIcon />,
      onClick: () => onFavorite?.(note)
    },
    {
      label: note.isPinned ? 'Unpin' : 'Pin',
      icon: <PinIcon />,
      onClick: () => onPin?.(note)
    }
  ].filter(Boolean);
  
  // Extract tags from note metadata
  const tags = note.meta?.tag?.map(tag => tag.display || tag.code) || [];
  
  return (
    <ClinicalResourceCard
      severity="normal"
      title={typeConfig.label}
      subtitle={note.description || 'Clinical Note'}
      status={isSigned ? 'Signed' : note.docStatus === 'preliminary' ? 'Ready for Review' : 'Draft'}
      actions={actions}
      density={density}
      icon={typeConfig.icon}
      timestamp={date}
      expandable
      statusIcon={isSigned ? <SignedIcon /> : <UnsignedIcon />}
      tags={tags}
    >
      <Stack spacing={2}>
        {/* Author and metadata */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip
            icon={<AuthorIcon />}
            label={author}
            size="small"
            variant="outlined"
          />
          {note.relatesTo?.length > 0 && (
            <Chip
              label={`${note.relatesTo[0].code} to previous note`}
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Stack>
        
        {/* Content preview */}
        <Typography 
          variant="body2" 
          sx={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
            whiteSpace: 'pre-line'
          }}
        >
          {note.displayContent || note.text?.div || note.text || 'No content available'}
        </Typography>
        
        {/* Section accordion for structured notes */}
        {note.section && note.section.length > 0 && (
          <Box>
            {note.section.map((section, index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">
                    {section.title || 'Section'}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    {section.text?.div || section.text || ''}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
        
        {/* Action buttons */}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {!isSigned && (
            <Button size="small" color="primary" onClick={() => onSign(note)}>
              Sign Note
            </Button>
          )}
          {isSigned && (
            <>
              <Button 
                size="small" 
                startIcon={<AddIcon />}
                onClick={() => onEdit({ ...note, isAddendum: true })}
              >
                Addendum
              </Button>
              <Button 
                size="small" 
                startIcon={<EditIcon />}
                onClick={() => onEdit({ ...note, isAmendment: true })}
                color="warning"
              >
                Amend
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </ClinicalResourceCard>
  );
});

EnhancedNoteCard.displayName = 'EnhancedNoteCard';

// Custom Collapsible Category Component
const CollapsibleCategory = memo(({ category, categoryKey, documents, selectedCategory, onSelectCategory }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  
  const handleToggle = () => {
    setExpanded(!expanded);
  };
  
  const handleSelect = () => {
    onSelectCategory(categoryKey);
  };
  
  const isSelected = selectedCategory === `category-${categoryKey}`;
  
  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton 
        onClick={handleSelect}
        selected={isSelected}
        sx={{ 
          borderRadius: 0,
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.04)
          }
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            sx={{ p: 0.5 }}
          >
            {expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          </IconButton>
        </ListItemIcon>
        <ListItemIcon sx={{ minWidth: 40, color: theme.palette[category.color || 'primary'].main }}>
          {category.icon}
        </ListItemIcon>
        <ListItemText 
          primary={category.label}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
        />
        {documents.length > 0 && (
          <Chip 
            label={documents.length} 
            size="small" 
            sx={{ 
              height: 20, 
              fontSize: '0.75rem',
              bgcolor: alpha(theme.palette[category.color || 'primary'].main, 0.1),
              color: theme.palette[category.color || 'primary'].main
            }} 
          />
        )}
      </ListItemButton>
      
      <Collapse in={expanded}>
        <List sx={{ pl: 4 }}>
          {Object.entries(category.types || {}).map(([typeKey, typeData]) => {
            const typeDocCount = typeData.documents?.length || 0;
            const isTypeSelected = selectedCategory === `type-${typeKey}`;
            
            return (
              <ListItemButton
                key={typeKey}
                onClick={() => onSelectCategory(`type-${typeKey}`)}
                selected={isTypeSelected}
                sx={{ 
                  py: 0.5,
                  borderRadius: 0,
                  bgcolor: isTypeSelected ? alpha(theme.palette.primary.main, 0.04) : 'transparent'
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: theme.palette[typeData.color || 'inherit'].main }}>
                  {typeData.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={typeData.label}
                  primaryTypographyProps={{ variant: 'caption' }}
                />
                {typeDocCount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {typeDocCount}
                  </Typography>
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Collapse>
    </Box>
  );
});

CollapsibleCategory.displayName = 'CollapsibleCategory';

const DocumentationTabEnhanced = ({ patientId, onNotificationUpdate, newNoteDialogOpen, onNewNoteDialogClose, department = 'general' }) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient, searchResources } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  const { density, setDensity } = useDensity();
  
  const [viewMode, setViewMode] = useState('tree'); // tree, cards, table, timeline
  const [selectedCategory, setSelectedCategory] = useState('root');
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [enhancedEditorOpen, setEnhancedEditorOpen] = useState(false);
  const [templateWizardOpen, setTemplateWizardOpen] = useState(false);
  const [amendmentMode, setAmendmentMode] = useState(false);
  const [originalNoteForAmendment, setOriginalNoteForAmendment] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [viewNoteDialogOpen, setViewNoteDialogOpen] = useState(false);
  const [selectedNoteForView, setSelectedNoteForView] = useState(null);
  const [addendumDialogOpen, setAddendumDialogOpen] = useState(false);
  const [selectedNoteForAddendum, setSelectedNoteForAddendum] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedNotesForCompare, setSelectedNotesForCompare] = useState([]);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Load DocumentReference resources on-demand
  useEffect(() => {
    const loadDocuments = async () => {
      if (patientId) {
        const existingDocs = getPatientResources(patientId, 'DocumentReference');
        if (!existingDocs || existingDocs.length === 0) {
          try {
            await searchResources('DocumentReference', {
              patient: patientId,
              _count: 50,
              _sort: '-date'
            });
          } catch (error) {
            // Handle error
          }
        }
      }
    };

    loadDocuments();
  }, [patientId, searchResources, getPatientResources]);

  // Get documentation resources
  const documentReferences = getPatientResources(patientId, 'DocumentReference') || [];
  const compositions = getPatientResources(patientId, 'Composition') || [];
  const clinicalImpressions = getPatientResources(patientId, 'ClinicalImpression') || [];
  const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport') || [];
  
  // Process all documents
  const processedDocumentReferences = documentReferences.map(doc => {
    return processDocumentForDisplay(doc);
  });
  
  const processedDiagnosticReports = diagnosticReports.map(report => {
    const extractedContent = extractDocumentContent({
      content: report.presentedForm || []
    });
    
    return {
      ...report,
      resourceType: 'DocumentReference',
      noteType: 'assessment',
      typeDisplay: 'Assessment Report',
      type: { coding: [{ code: 'assessment', display: 'Assessment' }] },
      status: report.status || 'final',
      docStatus: 'final',
      isSigned: true,
      date: report.issued || report.effectiveDateTime,
      author: report.performer?.[0]?.display || 'System',
      title: 'Diagnostic Report',
      displayContent: extractedContent.content || report.conclusion || 'No content available',
      contentType: extractedContent.type,
      sections: extractedContent.sections,
      hasContent: !!extractedContent.content,
      text: extractedContent.content || report.conclusion || 'No content available'
    };
  });

  const allDocuments = [...processedDocumentReferences, ...compositions, ...clinicalImpressions, ...processedDiagnosticReports];

  // Extract unique authors
  const authors = useMemo(() => {
    const authorSet = new Set();
    allDocuments.forEach(doc => {
      const author = doc.author?.[0]?.display;
      if (author) authorSet.add(author);
    });
    return Array.from(authorSet);
  }, [allDocuments]);

  // Filter documents
  const filterDocuments = useCallback((docs) => {
    return docs.filter(doc => {
      // Category filter based on selected tree node
      if (selectedCategory && selectedCategory !== 'root') {
        const noteType = doc.type?.coding?.[0]?.code || 'other';
        const typeConfig = noteTypes[noteType] || noteTypes.other;
        if (selectedCategory.startsWith('category-') && typeConfig.category !== selectedCategory.replace('category-', '')) {
          return false;
        }
        if (selectedCategory.startsWith('type-') && noteType !== selectedCategory.replace('type-', '')) {
          return false;
        }
      }
      
      // Type filter
      if (filterType !== 'all') {
        const docType = doc.type?.coding?.[0]?.code;
        if (docType !== filterType) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && doc.status !== filterStatus) {
        return false;
      }

      // Author filter
      if (filterAuthor !== 'all' && doc.author?.[0]?.display !== filterAuthor) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const docDate = doc.date || doc.meta?.lastUpdated;
        if (docDate) {
          const date = parseISO(docDate);
          const periodMap = {
            'today': subDays(new Date(), 0),
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '3m': subMonths(new Date(), 3),
            '6m': subMonths(new Date(), 6),
            '1y': subMonths(new Date(), 12)
          };
          if (!isWithinInterval(date, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          doc.type?.text,
          doc.type?.coding?.[0]?.display,
          doc.text?.div,
          doc.text,
          doc.title,
          doc.description,
          doc.displayContent,
          doc.author?.[0]?.display
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [selectedCategory, filterType, filterStatus, filterAuthor, filterPeriod, searchTerm]);

  const filteredDocuments = filterDocuments(allDocuments);
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    const dateA = new Date(a.date || a.meta?.lastUpdated || 0);
    const dateB = new Date(b.date || b.meta?.lastUpdated || 0);
    return dateB - dateA;
  });

  // Group documents for tree view
  const documentTree = useMemo(() => {
    const tree = {};
    
    // Initialize categories
    Object.entries(documentCategories).forEach(([key, config]) => {
      tree[key] = {
        ...config,
        documents: [],
        types: {}
      };
    });
    
    // Group documents
    allDocuments.forEach(doc => {
      const noteType = doc.type?.coding?.[0]?.code || 'other';
      const typeConfig = noteTypes[noteType] || noteTypes.other;
      const category = typeConfig.category || 'other';
      
      if (!tree[category]) {
        tree[category] = {
          label: 'Other',
          icon: <FolderIcon />,
          color: 'default',
          documents: [],
          types: {}
        };
      }
      
      tree[category].documents.push(doc);
      
      if (!tree[category].types[noteType]) {
        tree[category].types[noteType] = {
          ...typeConfig,
          documents: []
        };
      }
      tree[category].types[noteType].documents.push(doc);
    });
    
    return tree;
  }, [allDocuments]);

  // Calculate metrics for MetricsBar
  const metrics = useMemo(() => {
    const draftCount = allDocuments.filter(d => d.status === 'draft').length;
    const signedCount = allDocuments.filter(d => d.status === 'final').length;
    const recentCount = allDocuments.filter(d => {
      const date = d.date || d.meta?.lastUpdated;
      if (!date) return false;
      const daysSince = Math.floor((new Date() - parseISO(date)) / (1000 * 60 * 60 * 24));
      return daysSince <= 7;
    }).length;
    
    return [
      {
        label: 'Total Notes',
        value: allDocuments.length,
        icon: <NoteIcon />,
        color: 'primary'
      },
      {
        label: 'Signed',
        value: signedCount,
        icon: <SignedIcon />,
        color: 'success'
      },
      {
        label: 'Draft',
        value: draftCount,
        icon: <DraftIcon />,
        color: 'warning',
        severity: draftCount > 5 ? 'warning' : 'normal'
      },
      {
        label: 'This Week',
        value: recentCount,
        icon: <RecentIcon />,
        color: 'info',
        trend: recentCount > 0 ? 'up' : null
      }
    ];
  }, [allDocuments]);

  // Timeline resources
  const timelineResources = useMemo(() => {
    return sortedDocuments.map(doc => ({
      ...doc,
      resourceType: 'DocumentReference',
      meta: {
        ...doc.meta,
        lastUpdated: doc.date || doc.meta?.lastUpdated
      }
    }));
  }, [sortedDocuments]);

  // Table columns configuration
  const tableColumns = [
    {
      id: 'type',
      label: 'Type',
      width: '150px',
      render: (value, row) => {
        const noteType = row.type?.coding?.[0]?.code || 'other';
        const typeConfig = noteTypes[noteType] || noteTypes.other;
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ color: (theme) => theme.palette[typeConfig.color].main }}>
              {typeConfig.icon}
            </Box>
            <Typography variant="body2">{typeConfig.label}</Typography>
          </Stack>
        );
      }
    },
    {
      id: 'description',
      label: 'Title/Description',
      render: (value, row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.description || row.title || 'Clinical Note'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
            {row.displayContent?.substring(0, 100)}...
          </Typography>
        </Box>
      )
    },
    {
      id: 'author',
      label: 'Author',
      width: '150px',
      render: (value, row) => (
        <Chip
          label={row.author?.[0]?.display || 'Unknown'}
          size="small"
          variant="outlined"
          icon={<AuthorIcon />}
        />
      )
    },
    {
      id: 'date',
      label: 'Date',
      width: '150px',
      type: 'date',
      render: (value, row) => {
        const date = row.date || row.meta?.lastUpdated;
        if (!date) return '-';
        return (
          <Box>
            <Typography variant="body2">
              {format(parseISO(date), 'MMM d, yyyy')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(parseISO(date), { addSuffix: true })}
            </Typography>
          </Box>
        );
      }
    },
    {
      id: 'status',
      label: 'Status',
      width: '120px',
      render: (value, row) => {
        const isSigned = row.docStatus === 'final';
        return (
          <Chip
            icon={isSigned ? <SignedIcon /> : <UnsignedIcon />}
            label={isSigned ? 'Signed' : row.docStatus === 'preliminary' ? 'Review' : 'Draft'}
            size="small"
            color={isSigned ? 'success' : row.docStatus === 'preliminary' ? 'info' : 'warning'}
          />
        );
      }
    }
  ];


  const handleNewNote = () => {
    setSelectedNote(null);
    setSelectedTemplate(null);
    setTemplateWizardOpen(true);
  };

  const handleTemplateSelected = (templateWizardData) => {
    setSelectedTemplate(templateWizardData.templateId);
    setTemplateData({
      templateId: templateWizardData.templateId,
      visitType: templateWizardData.visitType,
      chiefComplaint: templateWizardData.chiefComplaint,
      autoPopulate: templateWizardData.autoPopulate || false
    });
    setTemplateWizardOpen(false);
    setEnhancedEditorOpen(true);
  };

  const handleEditNote = (note) => {
    if (note.isAddendum) {
      setSelectedNoteForAddendum(note);
      setAddendumDialogOpen(true);
    } else if (note.isAmendment) {
      setSelectedNote(null);
      setSelectedTemplate(null);
      setAmendmentMode(true);
      setOriginalNoteForAmendment(note);
      setEnhancedEditorOpen(true);
    } else {
      setSelectedNote(note);
      setSelectedTemplate(null);
      setEnhancedEditorOpen(true);
    }
  };

  const handleViewNote = (note) => {
    setSelectedNoteForView(note);
    setViewNoteDialogOpen(true);
  };

  const handleSignNote = async (note) => {
    try {
      let currentResource;
      try {
        currentResource = await fhirClient.read('DocumentReference', note.id);
      } catch (error) {
        let alternativeId = null;
        if (note.synthea_id && note.synthea_id !== note.id) {
          alternativeId = note.synthea_id;
        } else if (note.resourceId && note.resourceId !== note.id) {
          alternativeId = note.resourceId;
        }
        
        if (alternativeId) {
          try {
            currentResource = await fhirClient.read('DocumentReference', alternativeId);
          } catch (altError) {
            throw new Error(`Could not find DocumentReference with ID: ${note.id}`);
          }
        } else {
          throw new Error(`Could not find DocumentReference with ID: ${note.id}`);
        }
      }

      const updatedResource = {
        ...currentResource,
        docStatus: 'final'
      };
      
      const result = await fhirClient.update('DocumentReference', note.id, updatedResource);
      
      if (result) {
        await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
          ...updatedResource,
          noteType: note.type?.coding?.[0]?.display || 'Clinical Note',
          isUpdate: true,
          isSigned: true,
          patientId,
          timestamp: new Date().toISOString()
        });
        
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: 'Note signed successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to sign note: ' + error.message,
        severity: 'error'
      });
    }
  };

  const handleFavoriteNote = (note) => {
    // Toggle favorite status (would normally update in backend)
    note.isFavorite = !note.isFavorite;
    setSnackbar({
      open: true,
      message: note.isFavorite ? 'Note added to favorites' : 'Note removed from favorites',
      severity: 'success'
    });
  };

  const handlePinNote = (note) => {
    // Toggle pin status (would normally update in backend)
    note.isPinned = !note.isPinned;
    setSnackbar({
      open: true,
      message: note.isPinned ? 'Note pinned' : 'Note unpinned',
      severity: 'success'
    });
  };

  const handlePrintNote = (note) => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender
    };

    const template = getTemplateForNote(note);
    const printOptions = formatClinicalNoteForPrint(note, patientInfo, template);
    printDocument(printOptions);
  };

  const handleExportNote = async (note) => {
    const patientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      id: currentPatient?.id
    };

    const template = getTemplateForNote(note);
    
    try {
      const blob = await exportClinicalNote({
        note,
        patient: patientInfo,
        template,
        format: 'txt'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.label}_${patientInfo.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSnackbar({
        open: true,
        message: 'Note exported successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error exporting note: ' + error.message,
        severity: 'error'
      });
    }
  };

  const getTemplateForNote = (note) => {
    const loincCode = note.type?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    const templateId = Object.keys(NOTE_TEMPLATES).find(key => 
      NOTE_TEMPLATES[key].code === loincCode
    ) || 'progress';
    return NOTE_TEMPLATES[templateId];
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <ClinicalLoadingState.SummaryCards count={4} />
        <Box sx={{ mt: 3 }}>
          <ClinicalLoadingState.FilterPanel />
        </Box>
        <Box sx={{ mt: 3 }}>
          <ClinicalLoadingState.ResourceCard count={5} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Header with inline stats */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          {/* Inline Statistics */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {allDocuments.length} total documents
            </Typography>
            {metrics.find(m => m.label === 'Signed')?.value > 0 && (
              <Chip
                icon={<SignedIcon fontSize="small" />}
                label={`${metrics.find(m => m.label === 'Signed').value} signed`}
                size="small"
                color="success"
                sx={{ borderRadius: '4px' }}
              />
            )}
            {metrics.find(m => m.label === 'Draft')?.value > 0 && (
              <Chip
                icon={<DraftIcon fontSize="small" />}
                label={`${metrics.find(m => m.label === 'Draft').value} draft`}
                size="small"
                color="warning"
                sx={{ borderRadius: '4px' }}
              />
            )}
            {searchTerm && (
              <Chip
                label={`"${searchTerm}"`}
                size="small"
                onDelete={() => setSearchTerm('')}
                sx={{ borderRadius: '4px' }}
              />
            )}
          </Stack>
          
          {/* View Controls */}
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { borderRadius: 0 } }}
            >
              <ToggleButton value="tree">
                <Tooltip title="Tree View">
                  <TreeIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="cards">
                <Tooltip title="Card View">
                  <CardViewIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="table">
                <Tooltip title="Table View">
                  <ListIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="timeline">
                <Tooltip title="Timeline View">
                  <TimelineIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Divider orientation="vertical" flexItem />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewNote}
              size="small"
              sx={{ borderRadius: 0 }}
            >
              New Note
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', p: 2 }}>
        {/* Tree View Sidebar with Custom Implementation */}
        {viewMode === 'tree' && (
          <Box sx={{ width: 280, flexShrink: 0, mr: 2 }}>
            <Paper sx={{ p: 2, height: '100%', overflow: 'auto', borderRadius: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Categories
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => setSelectedCategory('root')}
                  title="Clear selection"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              
              <List sx={{ width: '100%' }}>
                {Object.entries(documentTree).map(([categoryKey, categoryData]) => (
                  <CollapsibleCategory
                    key={categoryKey}
                    category={categoryData}
                    categoryKey={categoryKey}
                    documents={categoryData.documents}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                ))}
              </List>
            </Paper>
          </Box>
        )}
        
        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filters using ClinicalFilterPanel */}
          <ClinicalFilterPanel
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            dateRange={filterPeriod}
            onDateRangeChange={setFilterPeriod}
            onRefresh={() => window.location.reload()}
            compact
            customFilters={
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {viewMode !== 'tree' && (
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      label="Type"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      {Object.entries(noteTypes).map(([key, config]) => (
                        <MenuItem key={key} value={key}>{config.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Author</InputLabel>
                  <Select
                    value={filterAuthor}
                    onChange={(e) => setFilterAuthor(e.target.value)}
                    label="Author"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                  >
                    <MenuItem value="all">All Authors</MenuItem>
                    {authors.map(author => (
                      <MenuItem key={author} value={author}>{author}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Status"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="preliminary">Review</MenuItem>
                    <MenuItem value="final">Signed</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <InputLabel>Density</InputLabel>
                  <Select
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                    label="Density"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                  >
                    <MenuItem value="comfortable">Comfort</MenuItem>
                    <MenuItem value="compact">Compact</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            }
          />

          {/* Content Views */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {viewMode === 'timeline' && (
              <Box sx={{ p: 2 }}>
                <ResourceTimeline
                  resources={timelineResources}
                  onResourceClick={(resource) => handleViewNote(resource)}
                  height={600}
                  showLegend
                  showRangeSelector
                  enableZoom
                  groupByType
                  customMarkers={[
                    { date: new Date().toISOString(), label: 'Today', color: 'primary' }
                  ]}
                />
              </Box>
            )}
            
            {(viewMode === 'cards' || viewMode === 'tree') && (
              <Box sx={{ p: 2 }}>
                <Stack spacing={density === 'compact' ? 1 : 2}>
                  {sortedDocuments.length === 0 ? (
                    <Alert severity="info">
                      No documentation found matching your criteria
                    </Alert>
                  ) : (
                    sortedDocuments.map((document) => (
                      <EnhancedNoteCard
                        key={document.id}
                        note={document}
                        onEdit={handleEditNote}
                        onView={handleViewNote}
                        onSign={handleSignNote}
                        onPrint={handlePrintNote}
                        onExport={handleExportNote}
                        onFavorite={handleFavoriteNote}
                        onPin={handlePinNote}
                        density={density}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            )}
            
            {viewMode === 'table' && (
              <Box sx={{ p: 2 }}>
                <SmartTable
                  columns={tableColumns}
                  data={sortedDocuments}
                  density={density}
                  onRowClick={(row) => handleViewNote(row)}
                  sortable
                  hoverable
                  stickyHeader
                  emptyMessage="No documentation found"
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Template Wizard Dialog */}
      <NoteTemplateWizard
        open={templateWizardOpen}
        onClose={() => setTemplateWizardOpen(false)}
        onTemplateSelected={handleTemplateSelected}
        patientConditions={
          getPatientResources(patientId, 'Condition')
            ?.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active')
            .map(c => c.code?.text || c.code?.coding?.[0]?.display || 'Unknown condition')
            .slice(0, 10) || []
        }
      />

      {/* Enhanced Note Editor Dialog */}
      <EnhancedNoteEditor
        open={enhancedEditorOpen}
        onClose={() => {
          setEnhancedEditorOpen(false);
          setAmendmentMode(false);
          setOriginalNoteForAmendment(null);
          setTemplateData(null);
        }}
        note={selectedNote}
        patientId={patientId}
        defaultTemplate={selectedTemplate}
        templateData={templateData}
        amendmentMode={amendmentMode}
        originalNote={originalNoteForAmendment}
      />

      {/* View Note Dialog */}
      <Dialog
        open={viewNoteDialogOpen}
        onClose={() => {
          setViewNoteDialogOpen(false);
          setSelectedNoteForView(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>View Note</DialogTitle>
        <DialogContent>
          {selectedNoteForView && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Title</Typography>
                  <Typography variant="body1">{selectedNoteForView.title || 'Untitled Note'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Type</Typography>
                  <Typography variant="body1">{selectedNoteForView.type?.coding?.[0]?.display || 'Unknown'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Typography variant="body1">{selectedNoteForView.status || 'current'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">
                    {selectedNoteForView.date ? format(parseISO(selectedNoteForView.date), 'MMM d, yyyy h:mm a') : 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Content</Typography>
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 0, maxHeight: 400, overflow: 'auto' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedNoteForView.displayContent || 'No content available'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setViewNoteDialogOpen(false);
            setSelectedNoteForView(null);
          }}>
            Close
          </Button>
          {selectedNoteForView && (
            <Button 
              variant="contained" 
              onClick={() => {
                setViewNoteDialogOpen(false);
                handleEditNote(selectedNoteForView);
              }}
            >
              Edit Note
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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
      
      {/* Floating Action Button */}
      <ContextualFAB
        currentModule="documentation"
        actions={[
          {
            icon: <NoteIcon />,
            name: 'Progress Note',
            shortcut: 'Ctrl+P',
            onClick: () => {
              setSelectedTemplate('progress');
              setEnhancedEditorOpen(true);
            }
          },
          {
            icon: <SOAPIcon />,
            name: 'SOAP Note',
            shortcut: 'Ctrl+S',
            onClick: () => {
              setSelectedTemplate('soap');
              setEnhancedEditorOpen(true);
            }
          },
          {
            icon: <ConsultIcon />,
            name: 'Consultation',
            onClick: () => {
              setSelectedTemplate('consult');
              setEnhancedEditorOpen(true);
            }
          },
          {
            icon: <UploadIcon />,
            name: 'Import Document',
            onClick: () => {/* Handle import */}
          }
        ]}
        position="bottom-right"
        offsetY={density === 'compact' ? 16 : 24}
      />
    </Box>
  );
};

export default React.memo(DocumentationTabEnhanced);