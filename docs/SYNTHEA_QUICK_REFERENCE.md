# Synthea Master - Quick Reference Card

**🎯 One Script, All Operations**: `synthea_master.py`

## 🚀 **Most Common Commands**

```bash
# ✨ Complete workflow (most common)
python synthea_master.py full --count 10

# 🔍 Check current data status  
python synthea_master.py validate

# 🧬 Generate new data only
python synthea_master.py generate --count 20

# 📥 Import existing data
python synthea_master.py import --validation-mode light
```

## 🎛️ **All Available Commands**

| Command | Purpose | Example |
|---------|---------|---------|
| `setup` | Install/configure Synthea | `python synthea_master.py setup` |
| `generate` | Generate patient data | `python synthea_master.py generate --count 20` |
| `wipe` | Clear database | `python synthea_master.py wipe` |
| `import` | Import FHIR data | `python synthea_master.py import --validation-mode light` |
| `validate` | Check data integrity | `python synthea_master.py validate` |
| `dicom` | Generate DICOM files | `python synthea_master.py dicom` |
| `full` | Complete workflow | `python synthea_master.py full --count 10` |

## ⚙️ **Key Options**

### **Patient Count**
```bash
--count 5          # Development (fast)
--count 10         # Default (recommended)
--count 50         # Production (comprehensive)
```

### **Validation Modes**
```bash
--validation-mode none           # Fastest (no validation)
--validation-mode transform_only # Recommended (default)  
--validation-mode light          # Basic validation
--validation-mode strict         # Full FHIR validation (slowest)
```

### **Geographic Options**
```bash
--state California --city "Los Angeles"
--state "New York" --city "New York City"
--state Massachusetts  # Default
```

### **Advanced Options**
```bash
--include-dicom     # Add DICOM generation to workflow
--batch-size 100    # Larger import batches (faster)
--verbose           # Detailed logging
--seed 123          # Reproducible data generation
```

## 📋 **Common Workflows**

### **🔄 Development Workflow**
```bash
# Quick data refresh for development
python synthea_master.py full --count 5 --validation-mode none
```

### **🏥 Production Setup**
```bash
# Comprehensive production data
python synthea_master.py full --count 50 --validation-mode light --include-dicom
```

### **🐛 Debugging Workflow**
```bash
# Generate data with full validation and logging
python synthea_master.py full --count 10 --validation-mode strict --verbose
```

### **🧪 Testing Workflow**
```bash
# Specific location data for testing
python synthea_master.py generate --count 20 --state California --city "San Francisco"
python synthea_master.py import --validation-mode light
python synthea_master.py validate
```

### **🔧 Maintenance Workflow**
```bash
# Check current system status
python synthea_master.py validate

# Clean start
python synthea_master.py wipe
python synthea_master.py generate --count 10
python synthea_master.py import --validation-mode transform_only
```

## 🆘 **Troubleshooting**

### **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| "Java not found" | Install Java 11+: `brew install openjdk@11` |
| "Synthea not found" | Run: `python synthea_master.py setup` |
| Import fails | Try: `--validation-mode none` or `--batch-size 25` |
| Generation slow | Reduce `--count` or check disk space |
| Database errors | Run: `python synthea_master.py wipe` first |

### **Debug Commands**
```bash
# Get detailed logs
python synthea_master.py validate --verbose

# Check what's available
ls -la synthea/output/fhir/

# Manual validation
python synthea_master.py import --validation-mode strict --verbose
```

## 🎯 **Environment Variables**

```bash
# For automation/CI/CD
export SYNTHEA_PATIENT_COUNT=20
export SYNTHEA_VALIDATION_MODE=light  
export SYNTHEA_STATE="California"
export SYNTHEA_CITY="Los Angeles"

# Use in scripts
python synthea_master.py full \
  --count ${SYNTHEA_PATIENT_COUNT:-10} \
  --validation-mode ${SYNTHEA_VALIDATION_MODE:-transform_only} \
  --state "${SYNTHEA_STATE:-Massachusetts}"
```

## 📊 **Performance Guide**

| Use Case | Recommended Settings | Time Estimate |
|----------|---------------------|---------------|
| **Quick Test** | `--count 5 --validation-mode none` | ~2 minutes |
| **Development** | `--count 10 --validation-mode transform_only` | ~5 minutes |
| **Production** | `--count 50 --validation-mode light` | ~20 minutes |
| **Full Featured** | `--count 50 --validation-mode strict --include-dicom` | ~45 minutes |

## 🔄 **Migration from Old Scripts**

| Old Command | New Command |
|-------------|-------------|
| `./setup_synthea_local.sh` | `python synthea_master.py setup` |
| `./run_synthea_local.sh` | `python synthea_master.py generate --count 5` |
| `python synthea_import.py` | `python synthea_master.py import` |
| `python synthea_workflow.py full` | `python synthea_master.py full` |
| Multiple steps | `python synthea_master.py full --count 10` |

---

**💡 Pro Tip**: Use `python synthea_master.py --help` for complete documentation and examples!