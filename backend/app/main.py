"""CivicLens AI — FastAPI application entry point.

Run:  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.routes import ai, auth, duplicates, incidents, reports
from app.routes.misc import (admin_router, analytics_router, files_router, health_router, map_router,
                             priority_router)
from app.services.ai import provider_status

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("civiclens")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    settings.upload_path  # ensure folder exists
    if settings.SEED_DEMO_DATA:
        from app.seed import seed
        with SessionLocal() as db:
            if seed(db):
                logger.info("Fictional demonstration data seeded (SEED_DEMO_DATA=true).")
    st = provider_status()
    logger.info("AI provider: %s — %s", st["provider"], st["message"])
    yield


app = FastAPI(
    title="CivicLens AI API",
    version="1.0.0",
    description="AI-assisted civic issue intelligence: image analysis, duplicate detection, "
                "incident grouping and transparent prioritisation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    if request.url.path.startswith("/api"):
        logger.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code, ms)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e.get("loc", []) if x not in ("body", "query", "path"))
        msg = str(e.get("msg", "Invalid value")).removeprefix("Value error, ")
        errors.append({"field": loc, "message": msg})
    first = errors[0] if errors else {"field": "", "message": "Invalid request"}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})


for r in (auth.router, reports.router, ai.router, duplicates.router, incidents.router, priority_router,
          analytics_router, map_router, admin_router, files_router, health_router):
    app.include_router(r)


@app.get("/", include_in_schema=False)
def root():
    return {"app": "CivicLens AI API", "docs": "/docs", "health": "/api/health"}
