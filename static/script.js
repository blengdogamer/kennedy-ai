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

function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
}

const arabicClasses = {
  Broken_Root: "جذر مكسور",
  PCT: "تاج جزئي",
  Free_R_Max: "امتداد خلفي حر — الفك العلوي الأيمن",
  Free_L_Max: "امتداد خلفي حر — الفك العلوي الأيسر",
  Not_Free_Max: "فقد أسنان غير حر — الفك العلوي",
  Not_Free_Center_Max: "فقد أسنان غير حر مركزي — الفك العلوي",
  Free_R_Mand: "امتداد خلفي حر — الفك السفلي الأيمن",
  Free_L_Mand: "امتداد خلفي حر — الفك السفلي الأيسر",
  Not_Free_Mand: "فقد أسنان غير حر — الفك السفلي",
  Not_Free_Center_Mand: "فقد أسنان غير حر مركزي — الفك السفلي"
};

function getArabicClass(className) {
  return arabicClasses[className] || className;
}

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
  analyzeButton.textContent = 'تحليل الصورة بالنموذج ←';
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
  analyzeButton.textContent = 'التحليل الصورة بالنموذج ←';
  showMessage('تمت معاينة الصورة. عند المتابعة سيحاول النموذج اكتشاف الفئات التي تدرب عليها.');
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
    const rows = (data.detections || []).map((item, index) =>
      `<div class="detection-row"><strong>${index + 1}. ${escapeHtml(getArabicClass(item.class_name))}</strong><span>${(item.confidence * 100).toFixed(1)}%</span><small>الصندوق: ${item.box.map(n => Math.round(n)).join(', ')}</small></div>`
    ).join('');
    result.innerHTML = `<strong>${escapeHtml(data.message || 'اكتمل التحليل')}</strong><p>أبعاد الصورة: ${data.image.width} × ${data.image.height} بكسل · عدد الاكتشافات: ${data.detection_count ?? 0}</p>${rows || '<p>لم يعثر النموذج على فئات تتجاوز حد الثقة الحالي.</p>'}<p class="model-notice">${escapeHtml(data.notice || '')}</p>`;
    result.classList.remove('hidden');
    showMessage('انتهى التحليل التجريبي. راجع تنبيه حدود النموذج أسفل النتائج.');
  } catch (error) {
    result.textContent = error.message || 'تعذر الاتصال بالخادم. تحقق من نشر الموقع ثم حاول مجدداً.';
    result.classList.remove('hidden');
    showMessage('لم تكتمل العملية.', true);
  } finally {
    analyzeButton.disabled = !selectedFile;
    analyzeButton.textContent = 'التحليل الصورة بالنموذج ←';
  }
});
