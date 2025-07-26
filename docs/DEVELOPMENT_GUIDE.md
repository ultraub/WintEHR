# WintEHR Development Guide

**Last Updated**: 2025-01-26

This guide provides a comprehensive overview of the development process for the MedGenEMR application. It covers how to set up a local development environment, run the application, and contribute to the project.

## Getting Started

### Prerequisites

*   Docker Desktop
*   Git
*   Node.js (for running the frontend locally)
*   Python (for running the backend locally)

### Setting up a Local Development Environment

The recommended way to set up a local development environment is to use the provided Docker Compose configuration. This will ensure that your development environment is as close as possible to the production environment.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/WintEHR.git
    cd WintEHR
    ```

2.  **Run the simplified deployment script:**
    ```bash
    ./deploy.sh dev              # Development mode with 20 patients
    ./deploy.sh dev --patients 50    # Custom patient count
    ```
    This script will build and start all the necessary Docker containers, including the frontend, backend, and database. It automatically handles database initialization, data loading, and search parameter indexing.

3.  **Access the application:**
    *   **EMR Frontend**: [http://localhost:3000](http://localhost:3000)
    *   **FHIR API**: [http://localhost:8000/fhir/R4](http://localhost:8000/fhir/R4)
    *   **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Running the Frontend and Backend Locally

If you prefer to run the frontend and backend services locally on your host machine, you can do so by following these steps:

#### Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

3.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the backend server:**
    ```bash
    uvicorn main:app --reload
    ```

#### Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install the dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend development server:**
    ```bash
    npm start
    ```

### Data Management

All data operations are handled through a single management script:

```bash
# Load patient data
docker exec emr-backend python scripts/manage_data.py load --patients 20

# Validate data integrity
docker exec emr-backend python scripts/manage_data.py validate

# Check system status
docker exec emr-backend python scripts/manage_data.py status

# Index search parameters
docker exec emr-backend python scripts/manage_data.py index
```

### Other Operations

```bash
# Check system status
./deploy.sh status

# Stop all services
./deploy.sh stop

# Clean deployment (removes all data)
./deploy.sh clean
```

## Development Workflow

### Making Changes

1.  **Create a new branch:**
    ```bash
    git checkout -b my-new-feature
    ```

2.  **Make your changes** to the frontend or backend code.

3.  **Test your changes** to ensure that they work as expected.

4.  **Commit your changes:**
    ```bash
    git commit -m "Add my new feature"
    ```

5.  **Push your changes** to the remote repository:
    ```bash
    git push origin my-new-feature
    ```

6.  **Create a pull request** on GitHub.

### Running Tests

The project includes a suite of tests for both the frontend and backend. To run the tests, you can use the following commands:

*   **Backend**:
    ```bash
    cd backend
    pytest
    ```

*   **Frontend**:
    ```bash
    cd frontend
    npm test
    ```

## Contributing

We welcome contributions from the community! If you're interested in contributing, please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.
