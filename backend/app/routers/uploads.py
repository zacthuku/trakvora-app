"""
File upload router.

Storage backend:
- If AWS_S3_BUCKET is configured → files go to S3 (af-south-1 by default).
- Otherwise → local filesystem under STATIC_DIR/uploads/ (dev fallback).

Security:
- Content-type allowlist enforced.
- Magic-byte verification (prevents spoofed MIME types).
- File-size limits.
- UUID-based names (prevents enumeration).
"""

import io
import logging
import os
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

UPLOAD_BASE = os.getenv("STATIC_DIR", "/app/static") + "/uploads"
PHOTO_DIR = f"{UPLOAD_BASE}/photos"
DOC_DIR   = f"{UPLOAD_BASE}/docs"
VIDEO_DIR = f"{UPLOAD_BASE}/videos"

# Directories are created at app startup (lifespan in main.py).
# Do NOT call os.makedirs here — it runs at import time and fails in CI.

MAX_BYTES       = 5  * 1024 * 1024   # 5 MB
MAX_VIDEO_BYTES = 50 * 1024 * 1024   # 50 MB

PHOTO_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
DOC_EXT   = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}
VIDEO_EXT = {
    "video/mp4":       "mp4",
    "video/quicktime": "mov",
    "video/webm":      "webm",
    "video/avi":       "avi",
    "video/x-msvideo": "avi",
}

PHOTO_MAGIC: dict[str, bytes | None] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png":  b"\x89PNG",
    "image/webp": None,
}
DOC_MAGIC: dict[str, bytes | None] = {
    "application/pdf": b"%PDF",
    "image/jpeg":      b"\xff\xd8\xff",
    "image/png":       b"\x89PNG",
}


def _check_magic(data: bytes, content_type: str, magic_map: dict) -> bool:
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    expected = magic_map.get(content_type)
    if expected is None:
        return True
    return data[: len(expected)] == expected


def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def _upload_to_s3(data: bytes, key: str, content_type: str) -> str:
    """Upload bytes to S3 and return the public HTTPS URL."""
    client = _s3_client()
    try:
        client.upload_fileobj(
            io.BytesIO(data),
            settings.aws_s3_bucket,
            key,
            ExtraArgs={"ContentType": content_type, "ACL": "public-read"},
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 upload failed for key=%s: %s", key, exc)
        raise HTTPException(500, "File storage unavailable. Please try again.")
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"


def _save_locally(data: bytes, directory: str, name: str) -> str:
    """Save bytes to local filesystem and return a root-relative path.
    The frontend resolves this against VITE_API_URL, so it works on any host.
    """
    path = os.path.join(directory, name)
    with open(path, "wb") as f:
        f.write(data)
    category = os.path.basename(directory)
    return f"/static/uploads/{category}/{name}"


def _store(data: bytes, s3_key: str, local_dir: str, local_name: str, content_type: str) -> str:
    """Route file to S3 (if configured) or local filesystem."""
    if settings.s3_enabled:
        return _upload_to_s3(data, s3_key, content_type)
    return _save_locally(data, local_dir, local_name)


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
    url  = _store(data, f"uploads/photos/{name}", PHOTO_DIR, name, file.content_type)
    return {"url": url}


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
    url  = _store(data, f"uploads/docs/{name}", DOC_DIR, name, file.content_type)
    return {"url": url}


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
    url  = _store(data, f"uploads/videos/{name}", VIDEO_DIR, name, file.content_type)
    return {"url": url}
