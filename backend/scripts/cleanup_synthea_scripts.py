#!/usr/bin/env python3
"""
Cleanup Script for Synthea Script Consolidation

This script:
1. Archives redundant/obsolete scripts
2. Creates backup of important scripts
3. Updates documentation
4. Provides transition guide
"""

import shutil
import os
from pathlib import Path
from datetime import datetime

def main():
    """Clean up and archive old Synthea scripts."""
    
    print("🧹 Cleaning up Synthea scripts...")
    print("=" * 50)
    
    # Create archive directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_dir = Path(f"archive/synthea_consolidation_{timestamp}")
    archive_dir.mkdir(parents=True, exist_ok=True)
    
    # Scripts to archive (move to archive)
    scripts_to_archive = [
        "synthea_import_with_validation.py",
        "synthea_import_unified.py", 
        "setup_synthea_local.sh",
        "run_synthea_local.sh"
    ]
    
    # Scripts to keep but note as superseded
    scripts_to_note = [
        "synthea_workflow.py",  # Keep as reference, but master script is primary
        "synthea_import.py"     # Keep as fallback/reference
    ]
    
    print("📦 Archiving redundant scripts:")
    for script in scripts_to_archive:
        script_path = Path(script)
        if script_path.exists():
            archive_path = archive_dir / script
            shutil.move(str(script_path), str(archive_path))
            print(f"  ✅ Archived: {script} → {archive_path}")
        else:
            print(f"  ⚠️ Not found: {script}")
    
    print(f"\n📁 Scripts archived to: {archive_dir}")
    
    # Create transition guide
    guide_content = f"""# Synthea Scripts Consolidation Guide

**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 🎯 What Changed

The Synthea-related scripts have been consolidated into a single master script: `synthea_master.py`

## 📋 Script Mapping

### ❌ Archived Scripts (moved to `{archive_dir}/`)
- `synthea_import_with_validation.py` → Use `synthea_master.py import --validation-mode strict`
- `synthea_import_unified.py` → Use `synthea_master.py import --validation-mode <mode>`
- `setup_synthea_local.sh` → Use `synthea_master.py setup`
- `run_synthea_local.sh` → Use `synthea_master.py generate`

### ✅ Kept Scripts (for reference/fallback)
- `synthea_workflow.py` - Original workflow script (superseded by master)
- `synthea_import.py` - Basic import script (fallback option)
- `test_synthea_detection.py` - Debugging tool
- `generate_dicom_for_synthea.py` - Specialized DICOM generation

## 🚀 New Usage

### Complete Workflow
```bash
# Replace: ./setup_synthea_local.sh && ./run_synthea_local.sh && python synthea_import.py
python synthea_master.py full --count 10
```

### Individual Operations
```bash
# Setup Synthea
python synthea_master.py setup

# Generate data
python synthea_master.py generate --count 20 --state California

# Wipe database
python synthea_master.py wipe

# Import with validation
python synthea_master.py import --validation-mode light

# Validate existing data
python synthea_master.py validate

# Generate DICOM files
python synthea_master.py dicom
```

### Advanced Options
```bash
# Full workflow with DICOM generation
python synthea_master.py full --count 5 --include-dicom --validation-mode strict

# Generate with specific location
python synthea_master.py generate --count 50 --state Texas --city Houston

# Import with strict validation and reporting
python synthea_master.py import --validation-mode strict --report-file validation_report.json
```

## 🔧 Build Script Updates

Update any build scripts or documentation to use the new master script:

### Old Commands:
```bash
cd backend && python scripts/synthea_workflow.py full --count 5
./setup_synthea_local.sh && ./run_synthea_local.sh
python scripts/synthea_import_unified.py --validation-mode light
```

### New Commands:
```bash
cd backend && python scripts/synthea_master.py full --count 5
python scripts/synthea_master.py setup && python scripts/synthea_master.py generate --count 5
python scripts/synthea_master.py import --validation-mode light
```

## 📊 Benefits

1. **Single Source of Truth**: One script for all Synthea operations
2. **Consistent Interface**: Unified command-line interface
3. **Better Error Handling**: Comprehensive logging and error reporting
4. **Configurable Validation**: Multiple validation modes for different use cases
5. **Complete Workflow**: End-to-end automation with single command
6. **Extensible**: Easy to add new features and operations

## 🛠️ Migration Checklist

- [ ] Update CI/CD scripts to use `synthea_master.py`
- [ ] Update documentation to reference new script
- [ ] Update `start.sh` or other build scripts if they reference old scripts
- [ ] Test new workflow in development environment
- [ ] Update any container/Docker configurations
- [ ] Notify team of new script usage

## 🆘 Rollback Plan

If issues arise, archived scripts can be restored from `{archive_dir}/`

## 📝 Notes

- The master script maintains backward compatibility with existing database schema
- All validation modes from the unified import script are preserved
- DICOM generation is now integrated into the workflow
- Comprehensive logging and reporting are built-in
"""
    
    guide_path = Path("SYNTHEA_CONSOLIDATION_GUIDE.md")
    with open(guide_path, "w") as f:
        f.write(guide_content)
    
    print(f"\n📖 Created transition guide: {guide_path}")
    
    # Create quick reference
    reference_content = """# Synthea Master Script Quick Reference

## Common Commands

```bash
# Complete workflow (most common)
python synthea_master.py full --count 10

# Setup only (first time)
python synthea_master.py setup

# Generate data only
python synthea_master.py generate --count 20

# Import existing data
python synthea_master.py import --validation-mode transform_only

# Wipe database
python synthea_master.py wipe

# Validate imported data
python synthea_master.py validate
```

## Validation Modes

- `none` - No validation, fastest import
- `transform_only` - Validate after transformation (recommended)
- `light` - Validate but continue on errors
- `strict` - Validate and skip resources that fail

## Full Help

```bash
python synthea_master.py --help
python synthea_master.py <command> --help
```
"""
    
    reference_path = Path("SYNTHEA_QUICK_REFERENCE.md")
    with open(reference_path, "w") as f:
        f.write(reference_content)
    
    print(f"📖 Created quick reference: {reference_path}")
    
    print("\n✅ Cleanup complete!")
    print("\n🔄 Next steps:")
    print("1. Review the transition guide")
    print("2. Update any build scripts or documentation")
    print("3. Test the new master script")
    print("4. Remove archived scripts when confident in new system")

if __name__ == "__main__":
    main()