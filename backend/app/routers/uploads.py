import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.dependencies import get_current_user
from app.models.user import User

UPLOAD_BASE = "/app/static/uploads"
PHOTO_DIR = f"{UPLOAD_BASE}/photos"
DOC_DIR   = f"{UPLOAD_BASE}/docs"
VIDEO_DIR = f"{UPLOAD_BASE}/videos"

os.makedirs(PHOTO_DIR, exist_ok=True)
os.makedirs(DOC_DIR,   exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

MAX_BYTES       = 5  * 1024 * 1024   # 5 MB
MAX_VIDEO_BYTES = 50 * 1024 * 1024   # 50 MB

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# Extension is always derived from this map — never from the client-supplied filename.
PHOTO_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DOC_EXT   = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}
VIDEO_EXT = {
    "video/mp4":       "mp4",
    "video/quicktime": "mov",
    "video/webm":      "webm",
    "video/avi":       "avi",
    "video/x-msvideo": "avi",
}

# Magic bytes — the actual first bytes of genuine files of each type.
PHOTO_MAGIC: dict[str, bytes | None] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png":  b"\x89PNG",
    "image/webp": None,   # checked separately below (RIFF + WEBP)
}
DOC_MAGIC: dict[str, bytes | None] = {
    "application/pdf": b"%PDF",
    "image/jpeg":      b"\xff\xd8\xff",
    "image/png":       b"\x89PNG",
}


def _check_magic(data: bytes, content_type: str, magic_map: dict) -> bool:
    """Return True if the file's leading bytes match the expected magic for its type."""
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    expected = magic_map.get(content_type)
    if expected is None:
        return True
    return data[: len(expected)] == expected


router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in PHOTO_EXT:
        raise HTTPException(400, "Only JPEG, PNG, or WebP images are accepted.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 5 MB limit.")
    if not _check_magic(data, file.content_type, PHOTO_MAGIC):
        raise HTTPException(400, "File contents do not match the declared image type.")
    ext  = PHOTO_EXT[file.content_type]
    name = f"{uuid.uuid4()}.{ext}"
    with open(os.path.join(PHOTO_DIR, name), "wb") as f:
        f.write(data)
    return {"url": f"{BASE_URL}/static/uploads/photos/{name}"}


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in DOC_EXT:
        raise HTTPException(400, "Only PDF, JPEG, or PNG files are accepted.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 5 MB limit.")
    if not _check_magic(data, file.content_type, DOC_MAGIC):
        raise HTTPException(400, "File contents do not match the declared document type.")
    ext  = DOC_EXT[file.content_type]
    name = f"{uuid.uuid4()}.{ext}"
    with open(os.path.join(DOC_DIR, name), "wb") as f:
        f.write(data)
    return {"url": f"{BASE_URL}/static/uploads/docs/{name}"}


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in VIDEO_EXT:
        raise HTTPException(400, "Only MP4, MOV, WebM, or AVI video accepted.")
    data = await file.read()
    if len(data) > MAX_VIDEO_BYTES:
        raise HTTPException(400, "Video exceeds 50 MB limit.")
    ext  = VIDEO_EXT[file.content_type]
    name = f"{uuid.uuid4()}.{ext}"
    with open(os.path.join(VIDEO_DIR, name), "wb") as f:
        f.write(data)
    return {"url": f"{BASE_URL}/static/uploads/videos/{name}"}
