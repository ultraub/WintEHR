# Old Documentation Cleanup Plan
Generated: 2025-01-27

## Categories of Documentation to Clean Up

### 1. Outdated Implementation Summaries
These files document old implementations that have been superseded:

- `ENHANCED_VS_OLD_TABS_SUMMARY.md` - Documents old vs enhanced tabs comparison
- `NAVIGATION_UI_IMPROVEMENTS_IMPLEMENTATION.md` - Old navigation implementation
- `CLINICAL_DIALOG_UI_IMPROVEMENTS.md` - Old dialog improvements
- `SPACING_IMPROVEMENTS_SUMMARY.md` - Old spacing improvements
- `DATABASE_OPTIMIZATION_SUMMARY.md` - Old database optimizations

**Action**: Move to `docs/archive/2024/` directory

### 2. Test Reports and Temporary Documentation
These were created for specific testing purposes and are no longer needed:

- `docs/CDS_MODAL_DISPLAY_TEST.md`
- `docs/CDS_OVERRIDE_TEST_INSTRUCTIONS.md`
- `backend/tests/fhir_comprehensive/TEST_FAILURE_SUMMARY.md`
- `e2e-tests/RUN_LAB_VALUE_TEST.md`

**Action**: Delete or move to `docs/archive/testing/`

### 3. Fix Documentation from Early 2025
These document fixes that have already been applied:

- `docs/DEPENDENCY_FIXES_2025-01-24.md`
- `docs/ENCOUNTER_NOTES_TEMPORAL_LINKING_FIX_2025-01-27.md`
- `docs/CDS_OVERRIDE_REASON_SAVE_FIX.md`
- `docs/CDS_MODAL_FIX_SUMMARY.md`

**Action**: Consolidate into a single `FIXES_LOG_2025.md`

### 4. Deprecated Component References
Files that reference deprecated components:

- `SEARCH_INDEXING_SCRIPTS_REVIEW.md` - References deprecated scripts
- `docs/development/components/clinical/CLAUDE.md` - Has deprecated component list

**Action**: Update to remove deprecated references

### 5. Duplicate or Redundant Documentation
- `docs/ENCOUNTER_NOTES_TEMPORAL_LINKING_FIX_2025-01-27.md`
- `docs/ENCOUNTER_NOTES_TEMPORAL_LINKING_2025-01-27.md`

**Action**: Keep the most complete version, delete duplicates

### 6. Old Performance Reports
- `PERFORMANCE_ISSUES_PLAN.md`
- `FRONTEND_IMPROVEMENT_TASKS.md`
- `FRONTEND_PRIORITY_MATRIX.md`

**Action**: Archive or update with current status

## Recommended Directory Structure

```
docs/
├── archive/
│   ├── 2024/
│   │   ├── implementations/
│   │   ├── optimizations/
│   │   └── ui-improvements/
│   ├── 2025/
│   │   └── fixes/
│   └── testing/
├── current/
│   ├── guides/
│   ├── api/
│   └── modules/
└── development/
```

## Files to Keep and Update

1. **CLAUDE.md** - Main project reference (update with current info)
2. **CLAUDE-REFERENCE.md** - Detailed reference guide
3. **DEPLOYMENT_SIMPLIFIED.md** - Current deployment guide
4. **docs/CLINICAL_DESIGN_SYSTEM.md** - Active design system
5. **docs/modules/README.md** - Module documentation index

## Execution Steps

1. Create archive directory structure
2. Move outdated files to appropriate archive folders
3. Delete truly temporary test files
4. Update references in remaining documentation
5. Create consolidated logs for historical reference
6. Update main documentation index

## Post-Cleanup Tasks

1. Update PROJECT_INDEX.md with new structure
2. Add archive README explaining historical context
3. Update CLAUDE.md to reference current documentation
4. Remove broken links from active documentation