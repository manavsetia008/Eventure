# One container that serves both the API and the built React app on port 8000.
#   docker build -t eventure .
#   docker run -p 8000:8000 -e SECRET_KEY=change-me eventure
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn psycopg2-binary
COPY backend backend
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
ENV TZ=Asia/Kolkata TRUST_PROXY=1 FRONTEND_URL=""
EXPOSE 8000
# One worker so the reminder scheduler runs once; threads handle concurrent requests.
CMD ["gunicorn", "-b", "0.0.0.0:8000", "-w", "1", "--threads", "4", "run:app"]
