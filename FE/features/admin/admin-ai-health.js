// ==========================================
// PREPMATE - Admin AI Health & Gateway Management (WI-AI-PROVIDER-CONFIG)
// Provides complete multi-provider preset support, DataProtection credential display,
// robust error handling, and truthful health status inspection.
// ==========================================

function applyProviderPreset(preset) {
    const providerEl = document.getElementById('config-ai-provider');
    const baseUrlEl = document.getElementById('config-ai-base-url');
    const modelEl = document.getElementById('config-ai-model');
    const protocolEl = document.getElementById('config-ai-protocol');
    // Note: Presets intentionally DO NOT modify or overwrite config-api-key to protect credentials
    if (!preset) return;

    if (protocolEl) protocolEl.value = 'openai-chat-completions';

    switch (preset) {
        case 'openai':
            if (providerEl) providerEl.value = 'OpenAI';
            if (baseUrlEl) baseUrlEl.value = 'https://api.openai.com/v1/';
            if (modelEl) modelEl.value = 'gpt-4o-mini';
            break;
        case 'gemini-openai':
            if (providerEl) providerEl.value = 'Google Gemini';
            if (baseUrlEl) baseUrlEl.value = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            if (modelEl) modelEl.value = 'gemini-1.5-flash';
            break;
        case 'groq':
            if (providerEl) providerEl.value = 'Groq Cloud';
            if (baseUrlEl) baseUrlEl.value = 'https://api.groq.com/openai/v1/';
            if (modelEl) modelEl.value = 'llama-3.3-70b-versatile';
            break;
        case 'deepseek':
            if (providerEl) providerEl.value = 'DeepSeek';
            if (baseUrlEl) baseUrlEl.value = 'https://api.deepseek.com/v1/';
            if (modelEl) modelEl.value = 'deepseek-chat';
            break;
        case 'vilao':
            if (providerEl) providerEl.value = 'Vilao AI';
            if (baseUrlEl) baseUrlEl.value = 'https://api.vilao.ai/v1/';
            if (modelEl) modelEl.value = 'ag/gemini-2.0-flash';
            break;
        case 'local-ollama':
            if (providerEl) providerEl.value = 'Local Ollama / vLLM';
            if (baseUrlEl) baseUrlEl.value = 'http://127.0.0.1:11434/v1/';
            if (modelEl) modelEl.value = 'llama3.2';
            break;
    }
}

function renderAiHealth(health) {
    const badge = document.getElementById('ai-health-badge');
    const detail = document.getElementById('ai-health-detail');
    const checkedAtEl = document.getElementById('ai-health-checked-at');
    const guidanceEl = document.getElementById('ai-health-guidance');
    if (!badge || !detail) return;

    if (!health) {
        badge.style.background = '#e2e8f0';
        badge.style.color = '#475569';
        badge.innerText = 'Không xác định';
        detail.innerText = 'Chưa tải được thông tin kết nối.';
        if (guidanceEl) guidanceEl.style.display = 'none';
        return;
    }

    const state = (health.state || 'NOT_CHECKED').toUpperCase();
    if (state === 'HEALTHY') {
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
        badge.innerHTML = '🟢 Hoạt động tốt (Healthy)';
    } else if (state === 'UNHEALTHY') {
        badge.style.background = '#fee2e2';
        badge.style.color = '#b91c1c';
        badge.innerHTML = '🔴 Lỗi kết nối (Unhealthy)';
    } else if (state === 'NOT_CONFIGURED') {
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        badge.innerHTML = '⚠️ Chưa cấu hình key';
    } else { // NOT_CHECKED
        badge.style.background = '#e0f2fe';
        badge.style.color = '#0369a1';
        badge.innerHTML = '🕒 Chưa kiểm tra kết nối';
    }

    let srcText = '';
    const escape = typeof escapeHtml === 'function' ? escapeHtml : (str => str || '');

    if (health.isEnvironmentManaged) {
        srcText = `<div style="margin-top:6px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px;color:#166534;">
            <strong>🔐 Nguồn khóa:</strong> Máy chủ đang ưu tiên sử dụng biến môi trường <code>${escape(health.credentialSource)}</code>.
        </div>`;
    } else if (health.credentialSource === 'admin:encrypted' || health.credentialStorageStatus === 'encrypted') {
        srcText = `<div style="margin-top:6px;padding:6px 10px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:4px;font-size:12px;color:#1e3a8a;">
            <strong>🛡️ Nguồn khóa:</strong> Quản trị viên quản lý (Mã hóa an toàn bằng ASP.NET Core Data Protection).
        </div>`;
    } else if (health.credentialSource === 'admin:legacy_plaintext' || health.credentialStorageStatus === 'legacy_plaintext') {
        srcText = `<div style="margin-top:6px;padding:6px 10px;background:#fffbeb;border-left:3px solid #d97706;border-radius:4px;font-size:12px;color:#92400e;">
            <strong>⚠️ Nguồn khóa:</strong> Lưu trong FileDb ở dạng plaintext cũ. Nhập lại key và lưu để kích hoạt mã hóa bảo vệ.
        </div>`;
    } else {
        srcText = `<div style="margin-top:6px;font-size:12px;color:#94a3b8;">
            <strong>Nguồn khóa:</strong> Chưa có khóa nào được nạp.
        </div>`;
    }

    const latencyText = typeof health.latencyMs === 'number' && health.latencyMs > 0 ? ` (Độ trễ: ${health.latencyMs}ms)` : '';
    detail.innerHTML = `<div>${escape(health.message || '')}${latencyText}</div>${srcText}`;

    if (checkedAtEl) {
        checkedAtEl.innerText = health.lastCheckedAt 
            ? `Lần kiểm tra gần nhất: ${new Date(health.lastCheckedAt).toLocaleString('vi-VN')}` 
            : '';
    }

    // Actionable guidance based on error category
    if (guidanceEl) {
        const errorCategory = health.errorCategory || '';
        const msg = health.message || '';

        if (errorCategory === 'ModelInactive' || msg.includes('MODEL_INACTIVE') || msg.includes('inactive')) {
            guidanceEl.style.display = 'block';
            guidanceEl.style.background = '#fffbeb';
            guidanceEl.style.color = '#92400e';
            guidanceEl.style.border = '1px solid #fde68a';
            guidanceEl.innerHTML = `<strong>⚠️ Mô hình AI đang ngừng hoạt động (MODEL_INACTIVE):</strong><br>
                Nhà cung cấp đã vô hiệu hóa mô hình <code>${escape(health.model || '')}</code>.<br>
                <strong>Mô hình khuyến nghị thay thế:</strong>
                <ul style="margin:4px 0 0 16px;padding:0;">
                    <li><strong>Vilao AI Gateway:</strong> Đổi sang <code>ag/gemini-2.0-flash</code> hoặc <code>ag/gemini-1.5-flash</code>.</li>
                    <li><strong>Google Gemini:</strong> Đổi sang <code>gemini-1.5-flash</code> hoặc <code>gemini-2.0-flash</code>.</li>
                    <li><strong>OpenAI:</strong> Đổi sang <code>gpt-4o-mini</code> hoặc <code>gpt-4o</code>.</li>
                </ul>
                <div style="margin-top:6px;"><em>Sau khi chọn mô hình mới, nhấn <strong>Lưu cài đặt hệ thống</strong> rồi kiểm tra lại kết nối.</em></div>`;
        } else if (errorCategory === 'AuthFailure') {
            guidanceEl.style.display = 'block';
            guidanceEl.style.background = '#fee2e2';
            guidanceEl.style.color = '#b91c1c';
            guidanceEl.style.border = '1px solid #fecaca';
            guidanceEl.innerHTML = `<strong>🔑 Lỗi xác thực khóa API:</strong><br>
                Nhà cung cấp từ chối khóa API. Hãy kiểm tra lại chuỗi API key, đảm bảo key còn hiệu lực và có quyền gọi mô hình.`;
        } else if (errorCategory === 'RateLimitOrQuota') {
            guidanceEl.style.display = 'block';
            guidanceEl.style.background = '#fef3c7';
            guidanceEl.style.color = '#b45309';
            guidanceEl.style.border = '1px solid #fde68a';
            guidanceEl.innerHTML = `<strong>⏳ Hạn mức API hoặc quá tải:</strong><br>
                Tài khoản đã hết hạn ngạch hoặc gửi yêu cầu quá nhanh. Vui lòng kiểm tra số dư credit trên portal nhà cung cấp.`;
        } else {
            guidanceEl.style.display = 'none';
        }
    }
}

async function triggerAiHealthCheck() {
    const btn = document.getElementById('btn-test-ai-health');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Đang kiểm tra kết nối...';
    }

    try {
        const authHeaders = typeof getAdminAuthHeaders === 'function' ? getAdminAuthHeaders() : {};
        const baseUrl = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
        const res = await fetch(`${baseUrl}/api/admin/ai/health-check`, {
            method: 'POST',
            headers: authHeaders
        });

        const data = await res.json();
        renderAiHealth(data);

        if (data.state === 'HEALTHY') {
            if (typeof showToast === 'function') showToast('Kiểm tra kết nối AI thành công! Upstream phản hồi tốt.', 'success');
        } else if (data.state === 'NOT_CONFIGURED') {
            if (typeof showToast === 'function') showToast('Chưa cấu hình API key. Vui lòng nhập key hoặc thiết lập biến môi trường.', 'warning');
        } else {
            if (typeof showToast === 'function') showToast(`Kiểm tra AI thất bại: ${data.message}`, 'danger');
        }
    } catch (err) {
        console.warn('[AI HEALTH CHECK ERROR]', err);
        if (typeof showToast === 'function') showToast(`Lỗi gửi yêu cầu kiểm tra kết nối: ${err.message}`, 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function loadSystemConfig() {
    const baseUrl = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
    const authHeaders = typeof getAdminAuthHeaders === 'function' ? getAdminAuthHeaders() : {};
    const escape = typeof escapeHtml === 'function' ? escapeHtml : (str => str || '');

    try {
        const res = await fetch(`${baseUrl}/api/admin/ai/config`, { headers: authHeaders });
        if (res.ok) {
            const config = await res.json();
            const providerInput = document.getElementById('config-ai-provider');
            if (providerInput && config.provider) providerInput.value = config.provider;

            const protocolSelect = document.getElementById('config-ai-protocol');
            if (protocolSelect && config.protocol) protocolSelect.value = config.protocol;

            const baseUrlInput = document.getElementById('config-ai-base-url');
            if (baseUrlInput && config.baseUrl) baseUrlInput.value = config.baseUrl;

            const modelInput = document.getElementById('config-ai-model');
            if (modelInput && config.model) modelInput.value = config.model;

            const credModeSelect = document.getElementById('config-credential-mode');
            if (credModeSelect && config.credentialMode) credModeSelect.value = config.credentialMode;

            const apiKeyInput = document.getElementById('config-api-key');
            const clearKeyCb = document.getElementById('config-clear-api-key');
            if (clearKeyCb) clearKeyCb.checked = false;

            const keyStatusEl = document.getElementById('config-api-key-status');
            if (apiKeyInput) {
                apiKeyInput.value = '';
                if (config.isEnvironmentManaged) {
                    apiKeyInput.placeholder = '•••••••• (Quản lý bởi biến môi trường máy chủ)';
                    if (keyStatusEl) {
                        keyStatusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Máy chủ đang sử dụng biến môi trường (${escape(config.credentialSource)}).</span> Nhập key ở đây sẽ lưu vào database an toàn (mã hóa Data Protection).`;
                    }
                } else if (config.apiKeyConfigured) {
                    const storageBadge = config.credentialStorageStatus === 'encrypted'
                        ? 'Đã mã hóa an toàn bằng ASP.NET Core Data Protection'
                        : 'Lưu plaintext (legacy)';
                    apiKeyInput.placeholder = `•••••••• (${storageBadge})`;
                    if (keyStatusEl) {
                        keyStatusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Khóa API đã được lưu trong cơ sở dữ liệu (${storageBadge}).</span> Để trống nếu muốn giữ nguyên khóa này.`;
                    }
                } else {
                    apiKeyInput.placeholder = 'Nhập khóa API mới...';
                    if (keyStatusEl) {
                        keyStatusEl.innerHTML = '<span style="color:#d97706;font-weight:600;">⚠️ Chưa cấu hình API Key.</span> Vui lòng nhập khóa API hoặc thiết lập biến môi trường để kích hoạt tính năng phỏng vấn AI.';
                    }
                }
            }

            if (typeof config.temperature === 'number') {
                const tempInput = document.getElementById('config-temperature');
                const tempVal = document.getElementById('temp-val');
                if (tempInput) tempInput.value = config.temperature;
                if (tempVal) tempVal.innerText = config.temperature;
            }
            if (typeof config.maxTokens === 'number') {
                const maxTokensInput = document.getElementById('config-max-tokens');
                if (maxTokensInput) maxTokensInput.value = config.maxTokens;
            }
            if (config.enabled !== undefined) {
                const aiEnabledCb = document.getElementById('config-ai-enabled');
                if (aiEnabledCb) aiEnabledCb.checked = Boolean(config.enabled);
            }
        } else if (res.status === 401 || res.status === 403) {
            console.warn(`[ADMIN CONFIG] Backend authentication error: HTTP ${res.status}`);
            if (typeof showToast === 'function') showToast('Không thể tải cấu hình AI: Yêu cầu quyền Quản trị viên (Admin).', 'warning');
        } else {
            console.warn(`[ADMIN CONFIG] Backend returned error: HTTP ${res.status}`);
        }
    } catch (err) {
        console.warn('[ADMIN CONFIG] Network error while fetching AI config:', err.message);
    }

    // Also load truthful AI health state
    try {
        const healthRes = await fetch(`${baseUrl}/api/admin/ai/health`, { headers: authHeaders });
        if (healthRes.ok) {
            const healthData = await healthRes.json();
            renderAiHealth(healthData);
        }
    } catch (hErr) {
        console.warn('[ADMIN HEALTH LOAD] Failed to load health:', hErr);
    }

    try {
        const storageKey = typeof STORAGE_CONFIG === 'string' ? STORAGE_CONFIG : 'prepmate_system_config';
        const localSys = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (localSys.freeQuota && document.getElementById('config-free-quota')) document.getElementById('config-free-quota').value = localSys.freeQuota;
        if (localSys.enableVoice !== undefined && document.getElementById('config-enable-voice')) document.getElementById('config-enable-voice').checked = localSys.enableVoice;
    } catch (e) {}
}

async function saveSystemConfig() {
    const role = typeof activeRoleView === 'string' ? activeRoleView : 'admin';
    if (role !== 'admin') {
        if (typeof showToast === 'function') showToast('Chỉ Quản trị viên (Admin) mới có quyền lưu cấu hình hệ thống.', 'warning');
        else alert('Chỉ Quản trị viên (Admin) mới có quyền lưu cấu hình hệ thống.');
        return;
    }
    const saveBtn = document.getElementById('btn-save-config');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span>⏳</span> Đang lưu lên máy chủ...'; }

    const baseUrl = typeof API_BASE_URL === 'string' ? API_BASE_URL : '';
    const authHeaders = typeof getAdminAuthHeaders === 'function' ? getAdminAuthHeaders({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
    const escape = typeof escapeHtml === 'function' ? escapeHtml : (str => str || '');

    try {
        const provider = (document.getElementById('config-ai-provider')?.value || '').trim() || 'OpenAI-Compatible';
        const protocol = (document.getElementById('config-ai-protocol')?.value || '').trim() || 'openai-chat-completions';
        let aiBaseUrl = (document.getElementById('config-ai-base-url')?.value || '').trim() || 'https://api.openai.com/v1/';
        const model = (document.getElementById('config-ai-model')?.value || '').trim() || 'gpt-4o-mini';
        const apiKeyRaw = (document.getElementById('config-api-key')?.value || '').trim();
        const clearApiKey = Boolean(document.getElementById('config-clear-api-key')?.checked);
        const credentialMode = (document.getElementById('config-credential-mode')?.value || '').trim() || 'auto';
        const temperature = parseFloat(document.getElementById('config-temperature')?.value) || 0.7;
        const maxTokens = parseInt(document.getElementById('config-max-tokens')?.value, 10) || 1000;
        const enabled = document.getElementById('config-ai-enabled') ? document.getElementById('config-ai-enabled').checked : true;

        if (!provider) throw new Error('Tên nhà cung cấp (Provider) không được để trống.');
        if (!aiBaseUrl) throw new Error('Base URL máy chủ AI không được để trống.');
        if (!aiBaseUrl.startsWith('http://') && !aiBaseUrl.startsWith('https://')) {
            throw new Error('Base URL phải là một URL tuyệt đối hợp lệ bắt đầu bằng http:// hoặc https://.');
        }

        // Normalize trailing slash
        if (!aiBaseUrl.endsWith('/')) {
            aiBaseUrl += '/';
        }

        // HTTPS validation for non-loopback
        const isLoopback = aiBaseUrl.includes('localhost') || aiBaseUrl.includes('127.0.0.1') || aiBaseUrl.includes('::1');
        if (aiBaseUrl.startsWith('http://') && !isLoopback) {
            throw new Error('Giao thức HTTP không được phép cho endpoint máy chủ từ xa. Vui lòng sử dụng HTTPS để bảo vệ API key.');
        }

        if (!model) throw new Error('Mô hình AI không được để trống.');
        if (temperature < 0.0 || temperature > 2.0) throw new Error('Nhiệt độ (Temperature) phải nằm trong khoảng từ 0.0 đến 2.0.');
        if (maxTokens < 1 || maxTokens > 32000) throw new Error('MaxTokens phải nằm trong khoảng từ 1 đến 32000.');

        const payload = {
            provider,
            protocol,
            baseUrl: aiBaseUrl,
            apiKey: apiKeyRaw,
            clearApiKey,
            credentialMode,
            model,
            enabled,
            temperature,
            maxTokens
        };

        const res = await fetch(`${baseUrl}/api/admin/ai/config`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify(payload)
        });
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(data?.error || `Máy chủ phản hồi mã lỗi HTTP ${res.status}`);

        const apiKeyInput = document.getElementById('config-api-key');
        const clearKeyCb = document.getElementById('config-clear-api-key');
        if (clearKeyCb) clearKeyCb.checked = false;

        if (apiKeyInput) {
            apiKeyInput.value = '';
            if (data.isEnvironmentManaged) {
                apiKeyInput.placeholder = '•••••••• (Quản lý bởi biến môi trường máy chủ)';
            } else if (data.apiKeyConfigured) {
                const storageBadge = data.credentialStorageStatus === 'encrypted'
                    ? 'Đã mã hóa an toàn bằng ASP.NET Core Data Protection'
                    : 'Lưu plaintext (legacy)';
                apiKeyInput.placeholder = `•••••••• (${storageBadge})`;
            } else {
                apiKeyInput.placeholder = 'Nhập khóa API mới...';
            }
        }

        const keyStatusEl = document.getElementById('config-api-key-status');
        if (keyStatusEl) {
            if (data.isEnvironmentManaged) {
                keyStatusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Máy chủ đang sử dụng biến môi trường (${escape(data.credentialSource)}).</span> Cấu hình hệ thống đã cập nhật.`;
            } else if (data.apiKeyConfigured) {
                const storageBadge = data.credentialStorageStatus === 'encrypted'
                    ? 'Mã hóa an toàn bằng ASP.NET Core Data Protection'
                    : 'Lưu plaintext (legacy)';
                keyStatusEl.innerHTML = `<span style="color:#059669;font-weight:600;">✓ Khóa API đã được lưu an toàn (${storageBadge}).</span> Để trống nếu muốn giữ nguyên khóa này.`;
            } else {
                keyStatusEl.innerHTML = '<span style="color:#d97706;font-weight:600;">⚠️ Chưa cấu hình API Key.</span> Vui lòng nhập khóa API mới.';
            }
        }

        // Refresh health status after save (reflects invalidated NOT_CHECKED state)
        try {
            const healthRes = await fetch(`${baseUrl}/api/admin/ai/health`, { headers: typeof getAdminAuthHeaders === 'function' ? getAdminAuthHeaders() : {} });
            if (healthRes.ok) {
                const healthData = await healthRes.json();
                renderAiHealth(healthData);
            }
        } catch (hErr) {}

        const freeQuota = Number(document.getElementById('config-free-quota')?.value) || 3;
        const enableVoice = document.getElementById('config-enable-voice')?.checked ?? true;
        try {
            const storageKey = typeof STORAGE_CONFIG === 'string' ? STORAGE_CONFIG : 'prepmate_system_config';
            const localSys = JSON.parse(localStorage.getItem(storageKey) || '{}');
            localSys.freeQuota = freeQuota;
            localSys.enableVoice = enableVoice;
            localStorage.setItem(storageKey, JSON.stringify(localSys));
        } catch (e) {}

        if (typeof addAuditLog === 'function') {
            addAuditLog('CONFIG_CHANGE', 'Cập nhật cấu hình AI máy chủ', 'AI Gateway', `Nhà cung cấp: ${data.provider}, Mô hình: ${data.model}, BaseUrl: ${data.baseUrl}`);
        }
        if (typeof showToast === 'function') showToast('Đã lưu cấu hình AI lên máy chủ thành công!', 'success');
        else alert('Đã lưu cấu hình AI lên máy chủ thành công!');
    } catch (err) {
        console.error('[ADMIN CONFIG] Save failed:', err.message);
        const userMsg = err.message || 'Không thể lưu cấu hình hệ thống.';
        if (typeof showToast === 'function') showToast(`Lỗi: ${userMsg}`, 'danger');
        else alert(`Lỗi: ${userMsg}`);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml || '<span>💾</span> Lưu cài đặt hệ thống'; }
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('config-api-key');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// Attach to window object for global availability
window.applyProviderPreset = applyProviderPreset;
window.renderAiHealth = renderAiHealth;
window.triggerAiHealthCheck = triggerAiHealthCheck;
window.loadSystemConfig = loadSystemConfig;
window.saveSystemConfig = saveSystemConfig;
window.toggleApiKeyVisibility = toggleApiKeyVisibility;
