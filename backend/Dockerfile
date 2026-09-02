FROM python:3.11-slim

WORKDIR /app

# Install dependencies first so Docker can cache this layer
# and rebuilds are fast when only app code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

EXPOSE 8000

# --reload is fine for local/hackathon dev; drop it for anything
# resembling production and add --workers instead.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
