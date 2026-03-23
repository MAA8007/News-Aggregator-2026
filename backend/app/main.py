from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routers.articles import router as articles_router
from app.routers.auth import router as auth_router
from app.routers.user_data import router as user_data_router
from app.routers.sports import router as sports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(
    title="News Aggregator API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles_router)
app.include_router(auth_router)
app.include_router(user_data_router)
app.include_router(sports_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
