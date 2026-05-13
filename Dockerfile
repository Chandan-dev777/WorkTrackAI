# Base image with Python
FROM --platform=linux/amd64 python:3.12-slim

# Install Node.js (needed to build the React frontend)
RUN apt-get update && \
    apt-get install -y nodejs npm curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Build the React frontend
COPY frontend-react/ frontend-react/
RUN cd frontend-react && npm install && npm run build && rm -rf node_modules

# Copy backend code
COPY backend/ backend/
COPY .env.example .env

# Create data directory for SQLite + ChromaDB
RUN mkdir -p data

# Uptimize expects port 8080
EXPOSE 8080

# Start the FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
