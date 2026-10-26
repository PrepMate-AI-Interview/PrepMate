// ==========================================
// PREPMATE — CV EXTRACTION & UPLOAD MODULE
// ARCHITECTURE: SETUP UTILITIES & FILE PARSING
// ==========================================

// PDF.js worker setup
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

function extractTextFromTxt(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, "UTF-8");
  });
}

async function handleCvUpload(fileOrEvent) {
  const file =
    fileOrEvent && fileOrEvent.target && fileOrEvent.target.files
      ? fileOrEvent.target.files[0]
      : fileOrEvent;
  if (!file) return;

  const uploadBox = document.getElementById("upload-box");
  const uploadStatus = document.getElementById("upload-status");
  const filenameSpan = document.getElementById("status-filename");
  const filesizeSpan = document.getElementById("status-filesize");
  const jdTextarea = document.getElementById("jd-text");

  if (!uploadBox || !uploadStatus || !filenameSpan || !filesizeSpan || !jdTextarea) {
    return;
  }

  filenameSpan.innerText = `Đang trích xuất: ${file.name}...`;
  filesizeSpan.innerText = "";
  uploadBox.classList.add("hidden");
  uploadStatus.classList.remove("hidden");

  try {
    let extractedText = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (typeof pdfjsLib === "undefined") {
        throw new Error("Thư viện PDF.js chưa được tải. Vui lòng tải lại trang.");
      }
      extractedText = await extractTextFromPdf(file);
    } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      extractedText = await extractTextFromTxt(file);
    } else {
      throw new Error("Định dạng file không được hỗ trợ. Vui lòng chọn .pdf hoặc .txt");
    }

    if (!extractedText.trim()) {
      throw new Error("Tệp tin trống hoặc không thể trích xuất chữ.");
    }

    const cvTextarea = document.getElementById("cv-text");
    if (cvTextarea) {
      cvTextarea.value = extractedText;
    }
    window._extractedCvText = extractedText;

    filenameSpan.innerText = file.name;
    const sizeKb = (file.size / 1024).toFixed(1);
    filesizeSpan.innerText = `(${sizeKb} KB)`;

    const jobTitle = document.getElementById("job-title")?.value.trim() || "";
    const userDesc = document.getElementById("user-description")?.value.trim() || "";
    const lang = document.getElementById("interview-language")?.value || "vi";

    // WI-INTERVIEW-PREFLIGHT-01: Upload DOES NOT trigger auto-analysis.
    // Invalidate any stale analysis from previous files or roles
    window._cvAnalysisResult = null;
    window._cvAnalysisDoneForRole = null;
    if (window._currentCvAnalysisAbortController) {
      try { window._currentCvAnalysisAbortController.abort(); } catch (e) {}
    }
    const analysisPanel = document.getElementById("cv-analysis-panel");
    if (analysisPanel) {
      analysisPanel.classList.add("hidden");
    }
    const outdatedWarning = document.getElementById("cv-analysis-outdated-warning");
    if (outdatedWarning) {
      outdatedWarning.classList.add("hidden");
    }

    // H1: Server-persisted CV sync for authenticated session setup
    const authToken = (typeof getAuthToken === "function" ? getAuthToken() : (typeof getCurrentUser === "function" ? getCurrentUser()?.token : null)) || localStorage.getItem("prepmate_auth_token") || sessionStorage.getItem("prepmate_auth_token");
    if (authToken) {
      const base = (typeof window !== "undefined" && typeof window.API_BASE_URL === "string")
        ? window.API_BASE_URL
        : (typeof API_BASE_URL === "string" ? API_BASE_URL : "");
      fetch(`${base}/api/cv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.name.split(".").pop() || "pdf",
          rawText: extractedText
        })
      }).catch(e => console.warn("[CV] Background server sync warning:", e));
    }

  } catch (err) {
    console.error("[CV] Extraction failed:", err);
    if (typeof showToast === "function") {
      showToast("Lỗi trích xuất CV: " + err.message, "danger");
    } else {
      alert("Lỗi trích xuất CV: " + err.message);
    }
    removeUploadedCv();
  }
}
window.handleCvUpload = handleCvUpload;

function removeUploadedCv(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  const fileInput = document.getElementById("cv-file");
  const uploadBox = document.getElementById("upload-box");
  const uploadStatus = document.getElementById("upload-status");
  const cvTextarea = document.getElementById("cv-text");

  if (fileInput) fileInput.value = "";
  if (cvTextarea) cvTextarea.value = "";
  window._extractedCvText = "";

  // WI-INTERVIEW-PREFLIGHT-01: Invalidate and cancel any running analysis
  window._cvAnalysisResult = null;
  window._cvAnalysisDoneForRole = null;
  if (window._currentCvAnalysisAbortController) {
    try { window._currentCvAnalysisAbortController.abort(); } catch (e) {}
  }
  const analysisPanel = document.getElementById("cv-analysis-panel");
  if (analysisPanel) {
    analysisPanel.classList.add("hidden");
  }
  const outdatedWarning = document.getElementById("cv-analysis-outdated-warning");
  if (outdatedWarning) {
    outdatedWarning.classList.add("hidden");
  }
  if (uploadStatus) uploadStatus.classList.add("hidden");
  if (uploadBox) uploadBox.classList.remove("hidden");
}
window.removeUploadedCv = removeUploadedCv;
