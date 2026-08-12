"""Lightweight HTTP API exposing the existing summary/comparison generators.

Run from the Backend directory with:
    uvicorn api:app --reload --port 8000
"""

import os

# main.py's generate_summary/generate_comparison use paths relative to the
# Backend directory (e.g. "prompts/...", "Outputs/..."). Pin the working
# directory so the API behaves the same regardless of where uvicorn is
# launched from.
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from main import (
    COMPARISON_MODEL,
    SUMMARY_MODEL,
    VALID_MODELS,
    generate_comparison,
    generate_summary,
)

app = FastAPI(title="Fashion Transparency AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary/{brand}")
def get_summary(
    brand: str,
    model: str = Query(SUMMARY_MODEL, enum=list(VALID_MODELS)),
    refresh: bool = False,
):
    brand = brand.strip()
    if not brand:
        raise HTTPException(status_code=400, detail="brand is required")

    try:
        summary = generate_summary(brand, model=model, refresh=refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate summary: {exc}") from exc

    return {"brand": brand, "model": model, "summary": summary}


@app.get("/api/comparison")
def get_comparison(
    brand_a: str = Query(..., alias="brandA"),
    brand_b: str = Query(..., alias="brandB"),
    model: str = Query(COMPARISON_MODEL, enum=list(VALID_MODELS)),
    summary_model: str = Query(SUMMARY_MODEL, alias="summaryModel", enum=list(VALID_MODELS)),
    refresh: bool = False,
):
    brand_a, brand_b = brand_a.strip(), brand_b.strip()
    if not brand_a or not brand_b:
        raise HTTPException(status_code=400, detail="brandA and brandB are required")

    try:
        summary_a = generate_summary(brand_a, model=summary_model)
        summary_b = generate_summary(brand_b, model=summary_model)
        comparison = generate_comparison(
            brand_a, brand_b, summary_a, summary_b, model=model, refresh=refresh
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate comparison: {exc}") from exc

    return {"brands": [brand_a, brand_b], "model": model, "comparison": comparison}
