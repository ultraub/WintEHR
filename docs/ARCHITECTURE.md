# WintEHR Architecture

**Last Updated**: 2025-01-26

This document provides a detailed overview of the WintEHR system architecture. The system is designed to be a modern, scalable, and maintainable Electronic Medical Record (EMR) application, with a strong focus on FHIR R4 compliance and a clear separation of concerns.

## High-Level Overview

The WintEHR system is composed of three main components:

1.  **Frontend**: A React-based single-page application (SPA) that provides the user interface for the EMR.
2.  **Backend**: A FastAPI application that serves as the main API, providing a complete FHIR R4 interface, as well as other EMR-specific services.
3.  **Database**: A PostgreSQL database that stores all the application data, including the FHIR resources.

The entire system is containerized using Docker, and Docker Compose is used to orchestrate the different services.

## Frontend Architecture

The frontend is a modern React application that uses a combination of best-in-class libraries and a well-defined structure to ensure a high-quality user experience and a maintainable codebase.

*   **Framework**: The application is built with [React](https://reactjs.org/) 18, using functional components and hooks.
*   **Component Library**: The user interface is built with [Material-UI](https://mui.com/), a popular and comprehensive React component library that implements Google's Material Design.
*   **Routing**: Client-side routing is handled by [React Router](https://reactrouter.com/), which allows for a seamless, single-page application experience.
*   **State Management**: Application-wide state is managed using React's built-in [Context API](https://reactjs.org/docs/context.html). This provides a lightweight and idiomatic way to share state between components without relying on a heavy third-party library.
*   **Data Fetching**: API requests to the backend are made using [axios](https://axios-http.com/), a popular and powerful HTTP client for the browser.
*   **Charting and Visualization**: The application uses a combination of [Chart.js](https://www.chartjs.org/), [Recharts](https://recharts.org/), and [D3.js](https://d3js.org/) to create rich and interactive data visualizations.
*   **Medical Imaging**: The frontend includes a complete DICOM viewer, powered by [Cornerstone.js](https://www.cornerstonejs.org/), which allows for the display and manipulation of medical images directly in the browser.
*   **Build System**: The application is built with [Create React App](https://create-react-app.dev/), and the build configuration is customized with [craco](https://craco.js.org/) to allow for more advanced build-time optimizations.

### Frontend Directory Structure

The `frontend/src` directory is organized as follows:

*   `components/`: Contains reusable UI components that are used throughout the application.
*   `contexts/`: Defines the React contexts that are used for application-wide state management.
*   `hooks/`: Contains custom React hooks that encapsulate reusable component logic.
*   `modules/` or `pages/`: These directories contain the main application views, which are composed of the smaller components.
*   `router/`: Defines the application's routes and navigation structure.
*   `services/`: Contains the API clients and other services that are used to interact with the backend and other external APIs.

## Backend Architecture

The backend is a high-performance, asynchronous API built with Python and FastAPI. It is designed to be a robust and scalable foundation for the EMR system.

*   **Framework**: The API is built with [FastAPI](https://fastapi.tiangolo.com/), a modern, high-performance Python web framework that is known for its speed, ease of use, and automatic API documentation.
*   **Asynchronous Programming**: The entire backend is built using Python's `asyncio` framework, which allows for high-concurrency and non-blocking I/O. This makes the API highly performant and scalable.
*   **Database Integration**: The backend uses [SQLAlchemy](https://www.sqlalchemy.org/) for object-relational mapping (ORM), and `asyncpg` as the driver for the PostgreSQL database. This provides a powerful and flexible way to interact with the database.
*   **FHIR R4 Compliance**: The backend provides a complete and compliant FHIR R4 REST API. This allows for seamless interoperability with other healthcare systems and applications.
*   **Modular Design**: The API is organized into a series of modular routers, each of which is responsible for a specific set of related endpoints. This makes the API easy to understand, maintain, and extend.

### Backend Directory Structure

The `backend/api` directory is organized as follows:

*   `admin/`: Contains the API endpoints for administrative tasks.
*   `analytics/`: Contains the endpoints for data analytics and reporting.
*   `auth/`: Contains the endpoints for user authentication and authorization.
*   `cds_hooks/`: Implements the CDS Hooks standard for clinical decision support.
*   `clinical/`: Contains the endpoints for the core clinical workflows of the EMR.
*   `dicom/`: Provides the API for the DICOM medical imaging features.
*   `fhir/`: Contains the implementation of the FHIR R4 REST API.

## Database Architecture

The database is a [PostgreSQL](https://www.postgresql.org/) database that is used to store all the application data. The database schema is designed to be a faithful representation of the FHIR R4 standard, with each FHIR resource being stored in a dedicated table.

*   **FHIR Schema**: The database schema is based on the official FHIR R4 specification, which ensures that the data is stored in a standardized and interoperable format.
*   **JSONB for Flexibility**: The FHIR resources are stored in `JSONB` columns, which provides a high degree of flexibility and allows for the storage of complex and nested data structures.
*   **Alembic for Migrations**: Database migrations are managed with [Alembic](https://alembic.sqlalchemy.org/), which provides a simple and reliable way to manage changes to the database schema over time.

## Containerization and Deployment

The entire WintEHR system is containerized with [Docker](https://www.docker.com/), and the different services are orchestrated with [Docker Compose](https://docs.docker.com/compose/). This provides a number of benefits, including:

*   **Portability**: The application can be run on any machine that has Docker installed, regardless of the underlying operating system.
*   **Consistency**: The development, testing, and production environments are all identical, which reduces the risk of environment-specific bugs.
*   **Scalability**: The different services can be scaled independently of each other, which allows for a high degree of scalability and performance.

For more information on how to deploy the application, please see the [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).
