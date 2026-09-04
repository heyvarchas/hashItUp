FROM python:3.11-slim

WORKDIR /app

# Ensure Python outputs directly to terminal and uv uses system python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1 \
    UV_LINK_MODE=copy

# Grab prebuilt uv binary directly from official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependencies first and install with persistent BuildKit cache mount
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -r requirements.txt

# Copy application code, migrations, and datasets
COPY app ./app
COPY migrations ./migrations
COPY data ./data
COPY alembic.ini .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

