"""Image uploads to Cloudinary (signed upload, standard library only — no extra packages needed)."""
import hashlib, json, secrets, time, urllib.error, urllib.request
from fastapi import HTTPException
from app.core.config import settings

MAX_BYTES = 2 * 1024 * 1024  # 2 MB
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

def _sniff(data: bytes) -> str | None:
    """Trust the file's real bytes, not the Content-Type header the browser sent."""
    if data[:3] == b"\xff\xd8\xff": return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n": return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP": return "image/webp"
    return None

def validate(data: bytes) -> str:
    if not data:
        raise HTTPException(400, "No image received")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is too large. Maximum size is 2 MB.")
    kind = _sniff(data)
    if kind not in ALLOWED:
        raise HTTPException(415, "Only JPG, PNG or WebP images are allowed.")
    return kind

def upload_image(data: bytes, folder: str) -> str:
    """Validate and upload; returns the permanent https URL."""
    kind = validate(data)
    if not (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET):
        raise HTTPException(503, "Image uploads are not configured yet (Cloudinary keys missing on the server).")
    ts = str(int(time.time()))
    # Cloudinary signature: sha1 of the sorted "key=value" pairs joined by '&', plus the API secret.
    sig = hashlib.sha1(f"folder={folder}&timestamp={ts}{settings.CLOUDINARY_API_SECRET}".encode()).hexdigest()
    boundary = "----pm" + secrets.token_hex(12)
    fields = {"api_key": settings.CLOUDINARY_API_KEY, "timestamp": ts, "folder": folder, "signature": sig}
    body = b""
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload.{ALLOWED[kind]}"\r\n'
             f'Content-Type: {kind}\r\n\r\n').encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload",
                                 data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())["secure_url"]
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"Image host rejected the upload ({e.code}). Check the Cloudinary keys.")
    except Exception:
        raise HTTPException(502, "Could not reach the image host. Please try again.")
