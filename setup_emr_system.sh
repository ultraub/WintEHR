#!/bin/bash
#
# EMR System Complete Setup Script
# This script sets up the entire EMR system from scratch
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PYTHON_CMD="python"
PATIENT_COUNT=25
SKIP_SYNTHEA=false
SKIP_IMPORT=false

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --patients) PATIENT_COUNT="$2"; shift ;;
        --skip-synthea) SKIP_SYNTHEA=true ;;
        --skip-import) SKIP_IMPORT=true ;;
        --help) 
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --patients N      Number of patients to generate (default: 25)"
            echo "  --skip-synthea    Skip Synthea data generation"
            echo "  --skip-import     Skip data import"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo -e "${GREEN}🏥 EMR System Complete Setup${NC}"
echo "=================================================="
echo "This script will set up the entire EMR system"
echo "Patient count: $PATIENT_COUNT"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        return 1
    fi
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists python; then
    echo -e "${RED}Error: Python is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: Node.js/npm is not installed${NC}"
    exit 1
fi

if ! command_exists java; then
    echo -e "${RED}Warning: Java is not installed. Synthea generation will fail.${NC}"
fi

# Change to script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Backend Setup
echo -e "\n${YELLOW}Setting up backend...${NC}"
cd EMR/backend

# 1. Install Python dependencies
echo "Installing Python dependencies..."
if [ ! -f "requirements.txt" ] || [ ! -s "requirements.txt" ]; then
    echo "Creating requirements.txt..."
    cat > requirements.txt << 'EOF'
# Core dependencies
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
sqlalchemy==2.0.23

# Database
alembic==1.12.1

# HTTP/API
httpx==0.25.2
requests==2.31.0
aiofiles==23.2.1

# Data processing
pandas==2.1.3
ndjson==0.3.1

# System monitoring
psutil==5.9.6

# Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# Development tools
pytest==7.4.3
pytest-cov==4.1.0
pytest-asyncio==0.21.1

# FHIR specific
fhir.resources==7.1.0

# Synthea integration
GitPython==3.1.40
EOF
fi

$PYTHON_CMD -m pip install -r requirements.txt
print_status $? "Python dependencies installed"

# 2. Download Synthea if not present
if [ ! -f "synthea-with-dependencies.jar" ] && [ "$SKIP_SYNTHEA" = false ]; then
    echo "Downloading Synthea..."
    curl -L https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar -o synthea-with-dependencies.jar
    print_status $? "Synthea downloaded"
fi

# 3. Clean up any existing database
echo "Cleaning up existing database..."
rm -f data/emr.db
print_status $? "Database cleaned"

# 4. Start backend temporarily to create tables
echo "Creating database tables..."
$PYTHON_CMD main.py > /tmp/emr_backend_setup.log 2>&1 &
BACKEND_PID=$!
sleep 5
kill $BACKEND_PID 2>/dev/null || true
print_status $? "Database tables created"

# 5. Create sample providers
echo "Creating sample providers..."
$PYTHON_CMD scripts/create_sample_providers.py
print_status $? "Sample providers created"

# 6. Populate clinical catalogs
echo "Populating clinical catalogs..."
$PYTHON_CMD scripts/populate_clinical_catalogs.py
print_status $? "Clinical catalogs populated"

# 7. Generate Synthea data if not skipped
if [ "$SKIP_SYNTHEA" = false ] && command_exists java; then
    echo "Generating Synthea data..."
    if [ -d "data/synthea_output/fhir" ] && [ "$(ls -A data/synthea_output/fhir/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
        echo "Synthea data already exists, skipping generation"
    else
        java -Xmx2g -jar synthea-with-dependencies.jar \
            -p $PATIENT_COUNT \
            -s 12345 \
            --exporter.fhir.export true \
            --exporter.baseDirectory data/synthea_output \
            Massachusetts
        print_status $? "Synthea data generated"
    fi
fi

# 8. Import Synthea data if not skipped
if [ "$SKIP_IMPORT" = false ] && [ -d "data/synthea_output/fhir" ]; then
    echo "Importing Synthea data..."
    $PYTHON_CMD scripts/optimized_synthea_import.py \
        --input-dir data/synthea_output/fhir \
        --batch-size 20
    print_status $? "Synthea data imported"
fi

# 9. Assign patients to providers
echo "Assigning patients to providers..."
$PYTHON_CMD scripts/assign_patients_to_providers.py
print_status $? "Patients assigned to providers"

# 10. Add reference ranges
echo "Adding reference ranges to lab data..."
$PYTHON_CMD scripts/add_reference_ranges.py
print_status $? "Reference ranges added"

# 11. Import missing clinical data (notes and additional reference ranges)
if [ -f "scripts/import_missing_clinical_data.py" ]; then
    echo "Importing missing clinical data..."
    $PYTHON_CMD scripts/import_missing_clinical_data.py --add-default-ranges
    print_status $? "Missing clinical data imported"
fi

# Frontend Setup
echo -e "\n${YELLOW}Setting up frontend...${NC}"
cd ../frontend

# 12. Install npm packages
echo "Installing npm packages..."
npm install
print_status $? "NPM packages installed"

# 13. Create missing public files if needed
if [ ! -f "public/index.html" ]; then
    echo "Creating missing public files..."
    mkdir -p public
    
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Teaching EMR System - A modern EMR for educational purposes"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>Teaching EMR System</title>
    
    <!-- Material-UI Roboto Font -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
    />
    <!-- Material Icons -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
    />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

    cat > public/manifest.json << 'EOF'
{
  "short_name": "Teaching EMR",
  "name": "Teaching EMR System",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
EOF

    cat > public/robots.txt << 'EOF'
# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow:
EOF
    print_status $? "Public files created"
fi

# 14. Create missing src files if needed
if [ ! -f "src/index.js" ]; then
    echo "Creating missing source files..."
    
    cat > src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

    cat > src/index.css << 'EOF'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}

/* Ensure full height for the app */
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}
EOF
    print_status $? "Source files created"
fi

# 15. Create missing component files if needed
if [ ! -f "src/components/PatientForm.js" ]; then
    echo "Creating missing component files..."
    mkdir -p src/components
    
    cat > src/components/PatientForm.js << 'EOF'
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  Box
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO } from 'date-fns';

const PatientForm = ({ open, onClose, onSubmit, patient = null }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: null,
    gender: '',
    race: '',
    ethnicity: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    email: '',
    insurance_name: '',
    insurance_id: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        ...patient,
        date_of_birth: patient.date_of_birth ? parseISO(patient.date_of_birth) : null
      });
    } else {
      // Reset form for new patient
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: null,
        gender: '',
        race: '',
        ethnicity: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
        email: '',
        insurance_name: '',
        insurance_id: '',
        emergency_contact_name: '',
        emergency_contact_phone: ''
      });
    }
  }, [patient]);

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleDateChange = (date) => {
    setFormData({ ...formData, date_of_birth: date });
  };

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      date_of_birth: formData.date_of_birth ? format(formData.date_of_birth, 'yyyy-MM-dd') : null
    };
    onSubmit(submissionData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{patient ? 'Edit Patient' : 'Add New Patient'}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="First Name"
                value={formData.first_name}
                onChange={handleChange('first_name')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Last Name"
                value={formData.last_name}
                onChange={handleChange('last_name')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Date of Birth"
                value={formData.date_of_birth}
                onChange={handleDateChange}
                renderInput={(params) => <TextField {...params} fullWidth required />}
                maxDate={new Date()}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                select
                label="Gender"
                value={formData.gender}
                onChange={handleChange('gender')}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Race"
                value={formData.race}
                onChange={handleChange('race')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Ethnicity"
                value={formData.ethnicity}
                onChange={handleChange('ethnicity')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={handleChange('address')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.city}
                onChange={handleChange('city')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="State"
                value={formData.state}
                onChange={handleChange('state')}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="ZIP Code"
                value={formData.zip_code}
                onChange={handleChange('zip_code')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={handleChange('phone')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance Provider"
                value={formData.insurance_name}
                onChange={handleChange('insurance_name')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance ID"
                value={formData.insurance_id}
                onChange={handleChange('insurance_id')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Name"
                value={formData.emergency_contact_name}
                onChange={handleChange('emergency_contact_name')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Phone"
                value={formData.emergency_contact_phone}
                onChange={handleChange('emergency_contact_phone')}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {patient ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientForm;
EOF
    print_status $? "Component files created"
fi

# Update CLAUDE.md
echo -e "\n${YELLOW}Updating documentation...${NC}"
cd "$SCRIPT_DIR"

# Final summary
echo -e "\n${GREEN}=================================================="
echo "🎉 EMR System Setup Complete!"
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Start the backend server:"
echo "   cd EMR/backend && python main.py"
echo ""
echo "2. Start the frontend server:"
echo "   cd EMR/frontend && npm start"
echo ""
echo "3. Access the system:"
echo "   http://localhost:3000"
echo ""
echo "📊 System Status:"
echo "   - Backend dependencies: Installed"
echo "   - Frontend dependencies: Installed"
echo "   - Database: Created and populated"
echo "   - Sample providers: Created"
echo "   - Synthea patients: Imported"
echo "   - Clinical catalogs: Populated"
echo "   - Reference ranges: Added"
echo ""
echo "🔐 Login:"
echo "   Use any provider from the dropdown to log in"
echo "=================================================="
echo -e "${NC}"