# WintEHR - A Modern, FHIR-Native Electronic Medical Record System

WintEHR is a comprehensive, open-source Electronic Medical Record (EMR) system designed for educational and research purposes. It is built on a modern technology stack, featuring a React-based frontend and a Python FastAPI backend. The system is fully compliant with the FHIR R4 standard, providing a real-world environment for learning and experimenting with clinical workflows, medical imaging, and health data interoperability.

## 🌟 Key Features

*   **Complete Clinical Workflows**: Simulate real-world clinical practice with modules for chart review, lab results, ordering, encounter documentation, pharmacy, and more.
*   **FHIR R4 Native**: The entire system is built around the FHIR R4 standard, ensuring all data is stored and exchanged in a compliant format.
*   **Medical Imaging**: Includes a DICOM viewer for viewing and analyzing medical images (CT, MRI, X-ray) directly within the EMR.
*   **Clinical Decision Support (CDS)**: Integrated with CDS Hooks to provide real-time clinical guidance and alerts.
*   **Synthetic Patient Data**: Comes with a powerful data generator, powered by Synthea™, to create realistic patient populations with rich medical histories.
*   **Modern Tech Stack**: Built with React, FastAPI, PostgreSQL, and Docker for a scalable, maintainable, and high-performance system.

## 🚀 Getting Started

### Prerequisites

*   Docker Desktop
*   Git

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/MedGenEMR.git
    cd MedGenEMR
    ```

2.  **Run the deployment script:**
    ```bash
    ./start-dev.sh
    ```
    This script will build and start all the necessary Docker containers, initialize the database, and generate synthetic patient data.

3.  **Access the application:**
    *   **EMR Frontend**: [http://localhost:3000](http://localhost:3000)
    *   **FHIR API**: [http://localhost:8000/fhir/R4](http://localhost:8000/fhir/R4)
    *   **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🏗️ Architecture

WintEHR is built with a modern, container-based architecture that separates the frontend and backend services.

*   **Frontend**: A React single-page application (SPA) using the Material-UI component library.
*   **Backend**: A FastAPI application that provides a complete FHIR R4 REST API, as well as other EMR-specific services.
*   **Database**: A PostgreSQL database with the FHIR schema, using SQLAlchemy for object-relational mapping.
*   **Containerization**: The entire system is containerized with Docker and orchestrated with Docker Compose for easy deployment and scalability.

For a more detailed overview of the architecture, please see the [Architecture Documentation](docs/ARCHITECTURE.md).

## 🛠️ Development

The development environment is containerized and supports hot-reloading for a seamless development experience. For detailed instructions on how to set up your development environment and contribute to the project, please see the [Development Guide](docs/DEVELOPMENT_GUIDE.md).

## 📦 Deployment

The application can be deployed in various environments, including local development, testing, and production. For detailed instructions on how to deploy the application, please see the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).

## 🤝 Contributing

We welcome contributions from the community! If you're interested in contributing, please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
