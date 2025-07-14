# BaseResourceDialog Design Specification
**MedGenEMR Frontend - Comprehensive Dialog Abstraction Architecture**

*Design Date: 2025-07-13*  
*Based On: Dialog Component Analysis Report*  
*Status: Architecture Design*

## 🎯 Design Objectives

### Primary Goals
1. **Eliminate 5,100+ lines** of duplicated dialog code (50% reduction)
2. **Standardize UX patterns** across all clinical workflows
3. **Enable rapid development** of new resource dialogs (2-3 hours vs 2-3 days)
4. **Ensure FHIR compliance** through shared validation and construction patterns
5. **Maintain flexibility** for complex clinical requirements

### Design Principles
- **Configuration over Code**: Declarative field definitions
- **Composition over Inheritance**: Pluggable sections and components
- **Type Safety**: Full TypeScript support throughout
- **Performance**: Lazy loading and optimized rendering
- **Accessibility**: WCAG 2.1 AA compliance by default

---

## 🏗️ Core Architecture

### Component Hierarchy

```
BaseResourceDialog (Container)
├── DialogHeader (Title, Status, Actions)
├── DialogContent (Scrollable)
│   ├── ErrorAlert (Conditional)
│   ├── FormSection (Configurable)
│   │   ├── FieldGroup[]
│   │   │   ├── FHIRFormField[]
│   │   │   └── CustomField[] (Slots)
│   │   └── SearchSection (Optional)
│   ├── PreviewSection (Optional)
│   └── CustomSections[] (Slots)
└── DialogActions (Cancel, Save, Delete)
```

### State Management Architecture

```typescript
interface DialogState<T> {
  // Form data
  formData: Partial<T>;
  initialData?: T;
  
  // UI state
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  
  // Validation
  errors: ValidationErrors;
  touched: TouchedFields;
  isValid: boolean;
  
  // Search
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchQuery: string;
  
  // Preview
  showPreview: boolean;
  previewData?: T;
}
```

---

## 🔧 Interface Definitions

### BaseResourceDialog Props

```typescript
interface BaseResourceDialogProps<T extends FHIRResource> {
  // Core Dialog Props
  open: boolean;
  onClose: () => void;
  
  // Mode and Context
  mode: 'add' | 'edit' | 'view';
  resourceType: FHIRResourceType;
  
  // Data Management
  initialData?: T;
  onSave: (resource: T) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  
  // Configuration
  config: DialogConfig<T>;
  
  // Customization Slots
  customSections?: CustomSection[];
  customActions?: CustomAction[];
  
  // Context
  patient?: Patient;
  encounter?: Encounter;
  
  // Feature Flags
  features?: DialogFeatures;
}
```

### Dialog Configuration

```typescript
interface DialogConfig<T> {
  // Basic Info
  title?: string | ((mode: DialogMode, data?: T) => string);
  subtitle?: string;
  
  // Form Configuration
  sections: FormSection[];
  
  // Validation
  validationRules: ValidationConfig<T>;
  
  // Search Configuration
  searchConfig?: SearchConfig;
  
  // Preview
  previewComponent?: ComponentType<{data: T}>;
  showPreview?: boolean;
  
  // Actions
  actions?: ActionConfig;
  
  // Layout
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  
  // Behavior
  closeOnSave?: boolean;
  confirmOnCancel?: boolean;
  
  // Performance
  lazy?: boolean;
  debounceValidation?: number;
}
```

### Form Section Configuration

```typescript
interface FormSection {
  id: string;
  title?: string;
  description?: string;
  
  // Layout
  columns?: 1 | 2 | 3 | 4;
  spacing?: number;
  
  // Visibility
  condition?: (data: any) => boolean;
  
  // Field Groups
  fieldGroups: FieldGroup[];
  
  // Custom Content
  customContent?: ComponentType<any>;
}

interface FieldGroup {
  id: string;
  title?: string;
  fields: FieldConfig[];
  
  // Layout
  orientation?: 'horizontal' | 'vertical';
  spacing?: number;
  
  // Behavior
  collapsible?: boolean;
  defaultExpanded?: boolean;
}
```

---

## 📝 Field Configuration System

### Core Field Types

```typescript
type FieldType = 
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'autocomplete'
  | 'date'
  | 'datetime'
  | 'period'
  | 'boolean'
  | 'radio'
  | 'checkbox-group'
  | 'rich-text'
  // FHIR-specific types
  | 'codeable-concept'
  | 'reference'
  | 'identifier'
  | 'quantity'
  | 'attachment'
  | 'address'
  | 'contact-point';
```

### Field Configuration Interface

```typescript
interface FieldConfig {
  // Identity
  key: string;
  type: FieldType;
  
  // Display
  label: string;
  placeholder?: string;
  helperText?: string;
  
  // Validation
  required?: boolean;
  validation?: ValidationRule[];
  
  // Behavior
  disabled?: boolean | ((data: any) => boolean);
  readonly?: boolean;
  
  // Options (for select/autocomplete)
  options?: OptionSource;
  
  // FHIR-specific
  fhirPath?: string;
  fhirType?: string;
  
  // Search (for autocomplete)
  searchConfig?: FieldSearchConfig;
  
  // Layout
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  
  // Conditional display
  condition?: (data: any) => boolean;
  
  // Custom props
  customProps?: Record<string, any>;
}
```

### FHIR-Specific Field Configurations

```typescript
// CodeableConcept Field
interface CodeableConceptFieldConfig extends FieldConfig {
  type: 'codeable-concept';
  
  // Value sets
  valueSet?: string;
  allowCustom?: boolean;
  
  // Search
  searchSystem?: 'snomed' | 'icd10' | 'loinc' | 'rxnorm' | 'custom';
  searchEndpoint?: string;
  
  // Display
  displayFormat?: 'code' | 'display' | 'both';
}

// Reference Field
interface ReferenceFieldConfig extends FieldConfig {
  type: 'reference';
  
  // Target resources
  targetTypes: FHIRResourceType[];
  
  // Search
  searchFields?: string[];
  displayField?: string;
  
  // Constraints
  contextFilter?: (resource: any) => boolean;
}

// Quantity Field
interface QuantityFieldConfig extends FieldConfig {
  type: 'quantity';
  
  // Units
  allowedUnits?: string[];
  defaultUnit?: string;
  unitSearch?: boolean;
  
  // Validation
  minValue?: number;
  maxValue?: number;
  decimalPlaces?: number;
}
```

---

## 🔍 Search Configuration

### Search System Architecture

```typescript
interface SearchConfig {
  // Search providers
  providers: SearchProvider[];
  
  // Default behavior
  defaultProvider?: string;
  debounceMs?: number;
  minQueryLength?: number;
  
  // Results
  maxResults?: number;
  groupBy?: string;
  
  // Caching
  cacheResults?: boolean;
  cacheTTL?: number;
}

interface SearchProvider {
  id: string;
  name: string;
  
  // Search function
  search: (query: string, context?: any) => Promise<SearchResult[]>;
  
  // Configuration
  supportedTypes?: string[];
  priority?: number;
  
  // Display
  resultTemplate?: ComponentType<{result: SearchResult}>;
  groupLabel?: string;
}

interface SearchResult {
  id: string;
  type: string;
  display: string;
  subtitle?: string;
  
  // Data
  data: any;
  
  // Metadata
  source: string;
  score?: number;
  
  // Actions
  actions?: SearchAction[];
}
```

---

## 🔐 Validation System

### Validation Configuration

```typescript
interface ValidationConfig<T> {
  // Schema validation
  schema?: ValidationSchema<T>;
  
  // Field-level rules
  fieldRules?: Record<string, ValidationRule[]>;
  
  // Cross-field validation
  crossFieldRules?: CrossFieldRule<T>[];
  
  // Async validation
  asyncRules?: AsyncValidationRule<T>[];
  
  // FHIR validation
  fhirValidation?: FHIRValidationConfig;
  
  // Behavior
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showErrorsOnTouch?: boolean;
}

interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  message: string;
  value?: any;
  validator?: (value: any, data: any) => boolean;
}

interface FHIRValidationConfig {
  // Resource validation
  validateStructure?: boolean;
  validateCardinality?: boolean;
  validateValueSets?: boolean;
  
  // Profile validation
  profiles?: string[];
  strictMode?: boolean;
  
  // Custom rules
  customRules?: FHIRValidationRule[];
}
```

---

## 🎨 UI Component Specifications

### BaseResourceDialog Component

```typescript
const BaseResourceDialog = <T extends FHIRResource>({
  open,
  onClose,
  mode,
  resourceType,
  initialData,
  onSave,
  onDelete,
  config,
  customSections = [],
  patient,
  encounter,
  features = {}
}: BaseResourceDialogProps<T>) => {
  // State management
  const [state, dispatch] = useReducer(dialogReducer, initialState);
  
  // Form handling
  const { formData, errors, touched, isValid } = useFormState(config, initialData);
  
  // Search functionality
  const { search, searchResults, searchLoading } = useSearch(config.searchConfig);
  
  // Validation
  const { validate, validateField } = useValidation(config.validationRules);
  
  // FHIR resource building
  const { buildResource } = useFHIRBuilder(resourceType, config);
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={config.maxWidth || 'md'}
      fullWidth={config.fullWidth !== false}
      PaperProps={{
        sx: { minHeight: '400px', maxHeight: '90vh' }
      }}
    >
      <DialogHeader
        title={getTitle()}
        mode={mode}
        resourceType={resourceType}
        onClose={handleClose}
      />
      
      <DialogContent dividers>
        <ErrorAlert errors={errors.global} />
        
        <FormRenderer
          sections={config.sections}
          data={formData}
          errors={errors}
          touched={touched}
          onChange={handleFieldChange}
          onBlur={handleFieldBlur}
        />
        
        {customSections.map(section => (
          <CustomSectionRenderer
            key={section.id}
            section={section}
            data={formData}
            context={{ patient, encounter }}
          />
        ))}
        
        {config.showPreview && (
          <PreviewSection
            component={config.previewComponent}
            data={buildResource(formData)}
          />
        )}
      </DialogContent>
      
      <DialogActions>
        <ActionBar
          mode={mode}
          config={config.actions}
          loading={state.saving}
          isValid={isValid}
          onCancel={handleCancel}
          onSave={handleSave}
          onDelete={handleDelete}
          customActions={customActions}
        />
      </DialogActions>
    </Dialog>
  );
};
```

### FormRenderer Component

```typescript
const FormRenderer = ({
  sections,
  data,
  errors,
  touched,
  onChange,
  onBlur
}) => {
  return (
    <Stack spacing={3}>
      {sections.map(section => (
        <SectionRenderer
          key={section.id}
          section={section}
          data={data}
          errors={errors}
          touched={touched}
          onChange={onChange}
          onBlur={onBlur}
          visible={evaluateCondition(section.condition, data)}
        />
      ))}
    </Stack>
  );
};

const SectionRenderer = ({ section, ...props }) => {
  const [expanded, setExpanded] = useState(section.defaultExpanded !== false);
  
  if (!props.visible) return null;
  
  return (
    <Card variant="outlined">
      {section.title && (
        <CardHeader
          title={section.title}
          subheader={section.description}
          action={section.collapsible && (
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        />
      )}
      
      <Collapse in={expanded}>
        <CardContent>
          <Grid container spacing={section.spacing || 2}>
            {section.fieldGroups.map(group => (
              <FieldGroupRenderer
                key={group.id}
                group={group}
                {...props}
              />
            ))}
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
};
```

---

## 🧩 FHIR Form Field Components

### Core FHIR Field Types

```typescript
// CodeableConcept Field
const CodeableConceptField = ({
  value,
  onChange,
  config,
  error,
  ...props
}) => {
  const { search, results, loading } = useCodeableConceptSearch(config);
  
  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      options={results}
      loading={loading}
      getOptionLabel={(option) => option.display || option.text}
      renderOption={(props, option) => (
        <CodeableConceptOption {...props} option={option} />
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={config.label}
          error={!!error}
          helperText={error || config.helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={20} />}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
      freeSolo={config.allowCustom}
      onInputChange={(_, value) => search(value)}
    />
  );
};

// Reference Field
const ReferenceField = ({
  value,
  onChange,
  config,
  error,
  context
}) => {
  const { search, results, loading } = useReferenceSearch(config, context);
  
  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      options={results}
      loading={loading}
      getOptionLabel={(option) => option.display}
      renderOption={(props, option) => (
        <ReferenceOption {...props} option={option} />
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={config.label}
          error={!!error}
          helperText={error || config.helperText}
        />
      )}
      onInputChange={(_, value) => search(value)}
    />
  );
};

// Quantity Field
const QuantityField = ({
  value,
  onChange,
  config,
  error
}) => {
  const [quantity, setQuantity] = useState(value?.value || '');
  const [unit, setUnit] = useState(value?.unit || config.defaultUnit || '');
  
  const handleChange = (newQuantity, newUnit) => {
    onChange({
      value: parseFloat(newQuantity) || 0,
      unit: newUnit,
      system: 'http://unitsofmeasure.org',
      code: newUnit
    });
  };
  
  return (
    <Grid container spacing={1}>
      <Grid item xs={8}>
        <TextField
          type="number"
          label={config.label}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            handleChange(e.target.value, unit);
          }}
          error={!!error}
          helperText={error || config.helperText}
        />
      </Grid>
      <Grid item xs={4}>
        {config.allowedUnits ? (
          <Select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              handleChange(quantity, e.target.value);
            }}
            displayEmpty
          >
            {config.allowedUnits.map(unitOption => (
              <MenuItem key={unitOption} value={unitOption}>
                {unitOption}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <TextField
            label="Unit"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              handleChange(quantity, e.target.value);
            }}
          />
        )}
      </Grid>
    </Grid>
  );
};
```

---

## 📱 Example Usage Patterns

### Allergy Dialog Configuration

```typescript
// allergyDialogConfig.ts
export const allergyDialogConfig: DialogConfig<AllergyIntolerance> = {
  title: (mode, data) => 
    mode === 'add' ? 'Add New Allergy' : `Edit ${data?.code?.text || 'Allergy'}`,
  
  maxWidth: 'md',
  showPreview: true,
  previewComponent: AllergyPreview,
  
  sections: [
    {
      id: 'allergen',
      title: 'Allergen Information',
      fieldGroups: [
        {
          id: 'allergen-details',
          fields: [
            {
              key: 'code',
              type: 'codeable-concept',
              label: 'Allergen',
              required: true,
              fhirPath: 'code',
              searchConfig: {
                providers: ['allergen-search'],
                minQueryLength: 2
              }
            },
            {
              key: 'type',
              type: 'select',
              label: 'Type',
              required: true,
              options: [
                { value: 'allergy', label: 'Allergy' },
                { value: 'intolerance', label: 'Intolerance' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'clinical-info',
      title: 'Clinical Information',
      fieldGroups: [
        {
          id: 'status',
          fields: [
            {
              key: 'clinicalStatus',
              type: 'select',
              label: 'Clinical Status',
              required: true,
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'resolved', label: 'Resolved' }
              ]
            },
            {
              key: 'criticality',
              type: 'select',
              label: 'Criticality',
              options: [
                { value: 'low', label: 'Low' },
                { value: 'high', label: 'High' },
                { value: 'unable-to-assess', label: 'Unable to Assess' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'reactions',
      title: 'Reactions',
      fieldGroups: [
        {
          id: 'manifestations',
          fields: [
            {
              key: 'reactions',
              type: 'multiselect',
              label: 'Manifestations',
              options: allergyManifestations,
              customProps: {
                freeSolo: true,
                multiple: true
              }
            },
            {
              key: 'severity',
              type: 'select',
              label: 'Reaction Severity',
              condition: (data) => data.reactions?.length > 0,
              options: [
                { value: 'mild', label: 'Mild' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'severe', label: 'Severe' }
              ]
            }
          ]
        }
      ]
    }
  ],
  
  validationRules: {
    fieldRules: {
      'code': [
        { type: 'required', message: 'Allergen is required' }
      ],
      'type': [
        { type: 'required', message: 'Type is required' }
      ],
      'clinicalStatus': [
        { type: 'required', message: 'Clinical status is required' }
      ]
    },
    fhirValidation: {
      validateStructure: true,
      validateCardinality: true
    }
  },
  
  searchConfig: {
    providers: [
      {
        id: 'allergen-search',
        name: 'Allergen Search',
        search: searchService.searchAllergens
      }
    ],
    debounceMs: 300,
    maxResults: 20
  }
};

// Usage in component
const AllergyDialog = ({ open, onClose, mode, allergy, onSave }) => {
  return (
    <BaseResourceDialog
      open={open}
      onClose={onClose}
      mode={mode}
      resourceType="AllergyIntolerance"
      initialData={allergy}
      onSave={onSave}
      config={allergyDialogConfig}
    />
  );
};
```

---

## ⚡ Performance Considerations

### Optimization Strategies

1. **Lazy Loading**
   ```typescript
   const LazyFormField = lazy(() => import('./FHIRFormFields'));
   
   // Load fields only when needed
   <Suspense fallback={<Skeleton />}>
     <LazyFormField {...props} />
   </Suspense>
   ```

2. **Memoization**
   ```typescript
   const MemoizedFormSection = memo(FormSection, (prev, next) => {
     return (
       prev.data === next.data &&
       prev.errors === next.errors &&
       prev.touched === next.touched
     );
   });
   ```

3. **Virtual Scrolling** for large option lists
   ```typescript
   const VirtualizedAutocomplete = ({options, ...props}) => {
     return (
       <FixedSizeList
         height={300}
         itemCount={options.length}
         itemSize={48}
       >
         {({index, style}) => (
           <div style={style}>
             <MenuItem value={options[index]}>
               {options[index].label}
             </MenuItem>
           </div>
         )}
       </FixedSizeList>
     );
   };
   ```

4. **Debounced Validation**
   ```typescript
   const useDebounceValidation = (value, validator, delay = 300) => {
     const [error, setError] = useState(null);
     
     useEffect(() => {
       const timer = setTimeout(() => {
         setError(validator(value));
       }, delay);
       
       return () => clearTimeout(timer);
     }, [value, validator, delay]);
     
     return error;
   };
   ```

---

## 🎯 Migration Strategy

### Phase 1: Core Infrastructure
1. Create BaseResourceDialog shell
2. Implement basic FormRenderer
3. Create 5 core FHIRFormField components
4. Set up validation framework

### Phase 2: Pilot Implementation
1. Create allergy dialog configuration
2. Migrate AddAllergyDialog
3. A/B test with existing implementation
4. Refine based on feedback

### Phase 3: Systematic Rollout
1. Migrate remaining dialog pairs
2. Create specialized configurations
3. Optimize performance
4. Complete documentation

### Success Metrics
- **Code Reduction**: 80%+ for migrated dialogs
- **Performance**: <16ms render time
- **Bundle Size**: <50KB additional overhead
- **Developer Experience**: 3+ hour new dialog creation

---

## 🔚 Conclusion

This BaseResourceDialog design provides a comprehensive solution for eliminating dialog code duplication while maintaining the flexibility needed for complex clinical workflows. The configuration-driven approach ensures consistency while the pluggable architecture allows for customization when needed.

The design addresses all patterns identified in the analysis and provides a clear migration path for existing dialogs. Implementation should follow the phased approach to minimize risk and ensure quality.

---

*This design will be refined based on implementation feedback and evolving requirements.*