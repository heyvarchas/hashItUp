FROM python:3.11-slim

WORKDIR /app

# Install dependencies first so Docker can cache this layer
# and rebuilds are fast when only app code changes.
# Grab prebuilt uv binary directly from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

# Copy application code and migrations
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .

EXPOSE 8000

# --reload is fine for local/hackathon dev; drop it for anything
# resembling production and add --workers instead.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
