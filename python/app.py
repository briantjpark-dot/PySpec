from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import yaml

from build import generate, SpecError
from yaml_errors import friendly_yaml_error

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://py-spec.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class BuildRequest(BaseModel):
    spec: str


@app.get("/")
def home():
    return {"message": "The server is up and running"}

# 400 is a bad request


@app.post("/build")
def build_endpoint(request: BuildRequest):
    try:
        spec = yaml.safe_load(request.spec)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=friendly_yaml_error(e, request.spec))

    try:
        files = generate(spec)
    except SpecError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"files": files}


if __name__ == "__main__":
    import os
    import uvicorn
    # 8001 for local, "PORT" for Cloud
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
