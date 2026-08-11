from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import yaml

from build import generate, SpecError

#To start backend (need the break between python and python3)
#cd /Users/briantjpark/pyspec/python 
#python3 -m uvicorn server:app --host 127.0.0.1 --port 8001

#Then to start frontend (need the break between pyspec and python3)
#cd /Users/briantjpark/pyspec 
# python3 -m http.server 5500

#Final URLS
#BE: http://127.0.0.1:8001 (no need to visit)
#FE: http://127.0.0.1:5500/index.html

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # for now keep as wildcard but later change to the real domain address
    allow_origins=["*"],
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
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")

    try:
        files = generate(spec)
    except SpecError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"files": files}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=True)