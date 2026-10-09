from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "best.pt"
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(
    title="Kennedy AI API",
    description="نموذج تجريبي لاكتشاف فئات صور الأسنان المدرب عليها؛ لا يصنف Kennedy I–IV مباشرةً.",
    version="0.2.0",
)
app.mount("/assets", StaticFiles(directory=BASE_DIR / "static"), name="assets")
model = None
model_error = None

@app.on_event("startup")
def load_model():
    global model, model_error
    if not MODEL_PATH.is_file():
        model_error = f"ملف النموذج غير موجود: {MODEL_PATH.name}"
        return
    try:
        from ultralytics import YOLO
        model = YOLO(str(MODEL_PATH))
        model_error = None
    except Exception as exc:
        model = None
        model_error = str(exc)[:500]

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "Kennedy AI",
        "model_ready": model is not None,
        "model_file_exists": MODEL_PATH.is_file(),
        "message": "النموذج جاهز لاكتشاف الفئات المدرب عليها." if model else "الخادم يعمل لكن النموذج غير جاهز.",
    }

@app.post("/api/predict")
async def predict(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.")
    content = await image.read(MAX_FILE_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="حجم الصورة أكبر من 10 ميغابايت.")
    try:
        with Image.open(BytesIO(content)) as img:
            img.verify()
        with Image.open(BytesIO(content)) as img:
            img = img.convert("RGB")
            width, height = img.size
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="تعذّر قراءة الصورة. جرّب JPG أو PNG أو WEBP.")

    if model is None:
        raise HTTPException(status_code=503, detail="النموذج غير جاهز على الخادم. تحقق من /api/health وسجلات Render.")
    try:
        with Image.open(BytesIO(content)) as source:
            results = model.predict(source.convert("RGB"), imgsz=640, conf=0.25, verbose=False)
        detections = []
        for result in results:
            names = result.names
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                detections.append({
                    "class_id": class_id,
                    "class_name": str(names.get(class_id, class_id)),
                    "confidence": round(float(box.conf[0].item()), 4),
                    "box": [round(float(v), 1) for v in box.xyxy[0].tolist()],
                })
        detections.sort(key=lambda item: item["confidence"], reverse=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"تعذر تحليل الصورة بالنموذج: {str(exc)[:250]}")

    return {
        "status": "ok",
        "message": "اكتمل اكتشاف الفئات التي تدرب عليها النموذج.",
        "image": {"width": width, "height": height},
        "detections": detections,
        "detection_count": len(detections),
        "kennedy_classification": None,
        "notice": "هذا النموذج مدرب على اكتشاف 10 فئات في صور OPG، وليس على تصنيف Kennedy I–IV مباشرةً. النتائج تجريبية وليست تشخيصاً طبياً.",
    }
