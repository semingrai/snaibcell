FROM python:3.10-slim

WORKDIR /app

# Install Python deps
RUN pip install --no-cache-dir \
    fastapi uvicorn xgboost scikit-learn pandas numpy \
    python-dotenv openai pydantic

# Copy everything needed for training
COPY snaibcell.py data_cleaned_version.csv stroke_thrombectomy_dataset.csv ./
COPY testing_data/ ./testing_data/

# Copy backend source
COPY backend/ ./backend/

# Train the model — fails loudly if pkl not produced
RUN python snaibcell.py && \
    test -f snaibcell_model.pkl && \
    echo "[docker] snaibcell_model.pkl confirmed at $(pwd)/snaibcell_model.pkl"

EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
