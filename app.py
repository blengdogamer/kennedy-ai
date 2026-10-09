from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

BASE_DIR = Path(__file__).resolve().parent
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(
    title="Kennedy AI API",
    description="واجهة تجريبية لتحضير صور تصنيف كينيدي. النموذج الطبي لم يتم ربطه بعد.",
    version="0.1.0",
)

# Serve the front-end files from the same Python web service.
app.mount("/assets", StaticFiles(directory=BASE_DIR / "static"), name="assets")


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "Kennedy AI",
        "model_ready": False,
        "message": "الخادم يعمل، لكن نموذج التصنيف غير مربوط بعد.",
    }


@app.post("/api/predict")
async def predict(image: UploadFile = File(...)):
    """Validate an uploaded image without claiming an AI prediction.

    This deliberately does not classify the image. A verified, trained model
    must be added and evaluated before enabling real predictions.
    """
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.",
        )

    content = await image.read(MAX_FILE_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="حجم الصورة أكبر من 10 ميغابايت. اختر صورة أصغر.",
        )

    try:
        with Image.open(BytesIO(content)) as img:
            img.verify()
        with Image.open(BytesIO(content)) as img:
            width, height = img.size
            image_format = (img.format or "unknown").upper()
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="تعذّر قراءة الصورة. جرّب ملف صورة سليماً بصيغة JPG أو PNG أو WEBP.",
        )

    # No model is included yet, so never invent a class or confidence score.
    # The image is only processed in memory and is not saved by this app.
    return {
        "status": "model_not_ready",
        "message": (
            "تم استلام الصورة والتحقق من سلامتها بنجاح. "
            "لكن نموذج الذكاء الاصطناعي غير مربوط بعد، لذلك لم يتم إصدار تصنيف."
        ),
        "image": {
            "format": image_format,
            "width": width,
            "height": height,
        },
        "prediction": None,
        "confidence": None,
    }
