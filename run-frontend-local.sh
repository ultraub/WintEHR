#!/bin/bash

# Run frontend server locally with hot reload

cd frontend

# Set environment variables for local development
export REACT_APP_API_URL=http://localhost:8000
export REACT_APP_WS_URL=ws://localhost:8000/api/ws
export PORT=3000

# Start React development server with hot reload
npm start