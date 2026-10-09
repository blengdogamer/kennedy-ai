const input = document.getElementById('imageInput');
const dropzone = document.getElementById('dropzone');
const previewWrap = document.getElementById('previewWrap');
const imagePreview = document.getElementById('imagePreview');
const imageMeta = document.getElementById('imageMeta');
const message = document.getElementById('message');
const analyzeButton = document.getElementById('analyzeButton');
const result = document.getElementById('result');
const removeImageButton = document.getElementById('removeImage');
const MAX_SIZE = 10 * 1024 * 1024;
let previewUrl = null;
let selectedFile = null;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#a24b42' : '';
}

function clearImage() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  input.value = '';
  imagePreview.removeAttribute('src');
  previewWrap.classList.add('hidden');
  result.classList.add('hidden');
  analyzeButton.disabled = true;
  analyzeButton.textContent = 'تحقق من الصورة عبر الخادم ←';
  showMessage('اختر صورة لتظهر المعاينة هنا.');
}

function loadImage(file) {
  result.classList.add('hidden');
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    clearImage();
    showMessage('نوع الملف غير مدعوم. اختر صورة بصيغة JPG أو PNG أو WEBP.', true);
    return;
  }
  if (file.size > MAX_SIZE) {
    clearImage();
    showMessage('حجم الصورة أكبر من 10 ميغابايت. اختر صورة أصغر.', true);
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  imagePreview.src = previewUrl;
  imageMeta.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  previewWrap.classList.remove('hidden');
  analyzeButton.disabled = false;
  analyzeButton.textContent = 'التحقق من الصورة عبر الخادم ←';
  showMessage('تمت معاينة الصورة. عند المتابعة ستُرسل للخادم للتحقق من الملف فقط، ولن تُصنّف بعد.');
}

input.addEventListener('change', () => loadImage(input.files && input.files[0]));
removeImageButton.addEventListener('click', clearImage);

['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});
dropzone.addEventListener('drop', event => {
  const file = event.dataTransfer && event.dataTransfer.files[0];
  loadImage(file);
});

analyzeButton.addEventListener('click', async () => {
  if (!selectedFile) return;
  analyzeButton.disabled = true;
  analyzeButton.textContent = 'جارٍ التحقق…';
  result.classList.add('hidden');
  const formData = new FormData();
  formData.append('image', selectedFile);
  try {
    const response = await fetch('/api/predict', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'حدث خطأ أثناء التحقق من الصورة.');
    result.textContent = `${data.message} أبعاد الصورة: ${data.image.width} × ${data.image.height} بكسل. لم يتم حفظ الصورة في ملف بواسطة التطبيق.`;
    result.classList.remove('hidden');
    showMessage('اكتمل التحقق من الملف. التصنيف الآلي غير متاح حتى ربط نموذج مدرّب.');
  } catch (error) {
    result.textContent = error.message || 'تعذر الاتصال بالخادم. تحقق من نشر الموقع ثم حاول مجدداً.';
    result.classList.remove('hidden');
    showMessage('لم تكتمل العملية.', true);
  } finally {
    analyzeButton.disabled = !selectedFile;
    analyzeButton.textContent = 'التحقق من الصورة عبر الخادم ←';
  }
});
