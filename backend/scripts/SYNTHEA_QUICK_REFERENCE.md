# Synthea Master Script Quick Reference

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
