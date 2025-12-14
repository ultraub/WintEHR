# WintEHR

An educational electronic health record system for learning healthcare IT, FHIR, and clinical informatics.

**Important**: This is an educational platform designed for learning with synthetic patient data. It should never be used with real patient information.

## What is WintEHR?

WintEHR is a complete, working EHR system built specifically for people learning healthcare information technology. Whether you're a clinical informatics student, a developer new to healthcare, or an educator building curriculum, WintEHR provides hands-on experience with the standards, workflows, and architectures that power modern healthcare systems.

Most healthcare IT education relies on reading specifications or working with simplified examples. WintEHR fills that gap by giving you a fully functional system where you can:

- See how FHIR resources actually flow through a clinical application
- Understand how CDS Hooks integrate with clinical workflows
- Experience realistic EHR interfaces and data patterns
- Experiment with healthcare APIs without needing access to production systems

## What You'll Learn

### Healthcare Data Standards

- **FHIR R4** - The modern healthcare interoperability standard. WintEHR uses HAPI FHIR Server with 38+ resource types, so you can explore how Patient, Observation, MedicationRequest, and other resources work together in practice.

- **Clinical Terminologies** - See ICD-10, SNOMED CT, LOINC, and RxNorm codes in context. The synthetic patient data includes realistic coded diagnoses, lab results, and medications.

- **DICOM** - Medical imaging standard. WintEHR generates synthetic DICOM images and includes a viewer, so you can understand how imaging integrates with clinical records.

### Clinical Decision Support

- **CDS Hooks 2.0** - Learn the specification by using it. WintEHR implements patient-view, order-select, and order-sign hooks with working alert cards.

- **CDS Studio** - A visual builder for creating decision support rules. Understand how clinical alerts are structured and triggered.

### Clinical Workflows

Rather than abstract diagrams, you can walk through actual workflows:

- **Chart Review** - How clinicians access problem lists, medications, allergies, vital signs, and notes
- **Order Entry (CPOE)** - How orders are placed, validated, and tracked
- **Results Review** - How lab and imaging results are displayed and trended
- **Medication Management** - Prescribing, dispensing, and drug interaction checking

## Supported Clinical Workflows

| Workflow | What You Can Explore |
|----------|---------------------|
| **Patient Lookup** | Demographics, insurance, contact management, patient matching |
| **Chart Review** | Problem list, medications, allergies, vitals, clinical notes |
| **Order Entry** | Lab orders, imaging orders, medication orders with CDS alerts |
| **Results Review** | Lab results with trending, radiology reports, result status tracking |
| **Pharmacy** | Prescription management, dispensing workflow, medication history |
| **Medical Imaging** | DICOM viewer, multi-modality support (CT, MR, X-ray, Ultrasound) |
| **Clinical Alerts** | Real-time CDS cards, drug interactions, preventive care reminders |

## Getting Started

### What You'll Need

- Git
- Docker and Docker Compose (version 20.10+)
- Python 3.9+ (for configuration validation)
- 8GB RAM and 20GB disk space

### Quick Start

```bash
# Clone the repository
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR

# Optional: customize settings
cp config.example.yaml config.yaml

# Deploy (15-25 minutes the first time)
./deploy.sh

# Verify everything is running
./deploy.sh status
```

The first deployment takes longer because it downloads Docker images, initializes the database, and generates synthetic patient data. Subsequent starts take about 5 minutes.

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Clinical Portal | http://localhost:3000 | Main EHR interface |
| FHIR API | http://localhost:8888/fhir | Direct FHIR server access |
| Backend API | http://localhost:8000/docs | API documentation |

### Demo Users

| Username | Password | Role |
|----------|----------|------|
| demo | password | Physician |
| nurse | password | Nurse |
| pharmacist | password | Pharmacist |
| admin | password | Administrator |

## Architecture Overview

WintEHR is built on production-grade technologies so you're learning patterns that transfer to real-world systems:

- **Frontend**: React with Material-UI
- **Backend**: FastAPI (Python) with async support
- **FHIR Server**: HAPI FHIR JPA Server (the same server used in production healthcare)
- **Database**: PostgreSQL
- **Cache**: Redis

The system generates realistic patient data using [Synthea](https://synthea.mitre.org/), an open-source synthetic patient generator.

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Deployment Guide](docs/DEPLOYMENT.md) - Detailed setup and configuration
- [Configuration Reference](docs/CONFIGURATION.md) - All configuration options
- [Azure Deployment](docs/AZURE_DEPLOYMENT.md) - Cloud deployment guide
- [CDS Studio Guide](docs/CDS_STUDIO_QUICK_REFERENCE.md) - Building clinical decision support

## For Educators

WintEHR works well for:

- **Classroom demonstrations** - Show real FHIR queries and clinical workflows
- **Hands-on labs** - Students can modify CDS rules, explore the API, or build integrations
- **Capstone projects** - A foundation for building healthcare applications
- **Self-paced learning** - Comprehensive documentation for independent study

The synthetic data is generated fresh on each deployment, so students can experiment freely without worrying about breaking anything permanent.

## Contributing

Contributions are welcome, especially those that improve the educational value of the project. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

## Acknowledgments

WintEHR builds on excellent open-source projects:

- [HL7 FHIR](http://hl7.org/fhir/) - Healthcare interoperability standard
- [HAPI FHIR](https://hapifhir.io/) - FHIR server implementation
- [Synthea](https://synthea.mitre.org/) - Synthetic patient data
- [CDS Hooks](https://cds-hooks.org/) - Clinical decision support specification

---

Questions or feedback? Open an issue on [GitHub](https://github.com/ultraub/WintEHR/issues).
