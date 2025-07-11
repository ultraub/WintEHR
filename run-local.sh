#!/bin/bash

# Run both backend and frontend locally with hot reload

echo "Starting MedGenEMR in local development mode..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start backend in background
echo "Starting backend server..."
./run-backend-local.sh &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
until curl -s http://localhost:8000/api/health > /dev/null 2>&1; do
    sleep 1
done
echo "Backend ready!"

# Start frontend
echo "Starting frontend server..."
./run-frontend-local.sh &
FRONTEND_PID=$!

# Wait for both processes
echo ""
echo "Both servers running. Press Ctrl+C to stop."
wait