# MedGenEMR Deployment Guide

This guide provides detailed instructions on how to deploy the MedGenEMR application in different environments. The application is designed to be deployed with Docker and Docker Compose, which provides a consistent and reliable deployment experience across all environments.

## Environments

The application can be deployed in three different environments:

*   **Development**: This environment is designed for local development and testing. It includes features like hot-reloading and detailed logging to make the development process as smooth as possible.
*   **Testing**: This environment is designed for automated testing and quality assurance. It is typically used in a continuous integration (CI) pipeline to run tests and other checks before deploying to production.
*   **Production**: This environment is designed for live, production use. It is optimized for performance, security, and reliability.

## Dockerized Deployment

The recommended way to deploy the application is to use the provided Docker Compose configuration. This will ensure that all the services are configured correctly and that the application is running in a consistent and reliable environment.

### Development Deployment

To deploy the application in a development environment, you can use the `start-dev.sh` script:

```bash
./start-dev.sh
```

This script will build and start all the necessary Docker containers, including the frontend, backend, and database. It will also set up hot-reloading for both the frontend and backend, so that any changes you make to the code will be automatically reflected in the running application.

### Production Deployment

To deploy the application in a production environment, you can use the `docker-compose.yml` file directly:

```bash
docker-compose up -d
```

This will start all the services in detached mode, which means they will run in the background. The production deployment is optimized for performance and security, and it does not include the development-specific features like hot-reloading.

## Manual Deployment

While the Dockerized deployment is recommended, it is also possible to deploy the application manually. This can be useful if you want to have more control over the deployment process or if you are deploying to an environment that does not support Docker.

### Backend

1.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the database migrations:**
    ```bash
    alembic upgrade head
    ```

3.  **Start the backend server:**
    ```bash
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```

### Frontend

1.  **Install the dependencies:**
    ```bash
    npm install
    ```

2.  **Build the frontend application:**
    ```bash
    npm run build
    ```

3.  **Serve the frontend application:**
    You can use a static file server like `serve` to serve the built frontend application:
    ```bash
    serve -s build
    ```

## Configuration

The application can be configured using environment variables. The available environment variables are defined in the `.env.example` file. You can create a `.env` file in the root of the project to override the default values.
