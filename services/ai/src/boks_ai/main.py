from fastapi import FastAPI

app = FastAPI(title="BOKS AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "boks-ai", "status": "ok", "version": "0.1.0"}
