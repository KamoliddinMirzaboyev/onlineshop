FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Root'da ishlamaymiz: konteynerdan chiqib ketish xatosi bo'lsa ham host'da
# root huquqi bo'lmasin. uploads/ — compose'dan mount qilinadi, shuning uchun
# egalikni oldindan beramiz.
RUN useradd --system --uid 10001 --create-home app \
    && mkdir -p /app/uploads \
    && chown -R app:app /app
USER app

EXPOSE 8000

# WEB_CONCURRENCY: gunicorn worker (process) soni — har biri o'z DB pool'i va
# event loop'iga ega, so'rovlar ko'p core bo'ylab tarqaladi (bitta uvicorn
# process'da hammasi bitta core'da serialize bo'lardi).
CMD gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-4} -b 0.0.0.0:8000 --timeout 60 --access-logfile - --error-logfile -
