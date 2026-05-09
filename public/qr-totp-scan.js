(() => {
  const FAB_ID = "warden-qr-fab";
  const PANEL_ID = "warden-qr-panel";

  function parseOtpAuth(raw) {
    try {
      if (!raw || !raw.toLowerCase().startsWith("otpauth://")) return null;
      const u = new URL(raw);
      return u.searchParams.get("secret") || raw;
    } catch {
      return null;
    }
  }

  function findTotpInput() {
    return (
      document.querySelector('input[formcontrolname="totp"]') ||
      document.querySelector('input[placeholder*="TOTP"]') ||
      document.querySelector('input[placeholder*="Authenticator"]') ||
      null
    );
  }

  function applySecret(secret) {
    const input = findTotpInput() || document.activeElement;
    if (input && input.tagName === "INPUT") {
      input.value = secret;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  async function detectFromImageBitmap(bitmap) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(bitmap);
    return codes?.[0]?.rawValue || null;
  }

  function toast(msg) {
    alert(msg);
  }

  async function scanByCamera(output) {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      toast("浏览器不支持摄像头扫码，请使用“上传二维码图片”。");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    output.innerHTML = "";
    output.appendChild(video);
    output.style.display = "block";

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      output.style.display = "none";
      output.innerHTML = "";
    };

    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes?.[0]?.rawValue;
        if (raw) {
          const secret = parseOtpAuth(raw);
          if (!secret) {
            toast("识别成功，但不是 otpauth 二维码。");
          } else if (applySecret(secret)) {
            toast("已自动填入 TOTP。");
          } else {
            await navigator.clipboard?.writeText(secret);
            toast("未找到 TOTP 输入框，已复制到剪贴板。");
          }
          stop();
          return;
        }
      } catch {}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return stop;
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = "position:fixed;right:20px;bottom:80px;z-index:99999;background:#fff;border:1px solid #d0d7de;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:14px;width:320px;display:none;";
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:10px;">扫描二维码添加 TOTP</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button id="warden-scan-camera" type="button" style="flex:1;padding:8px;">📷 摄像头扫描</button>
        <button id="warden-scan-upload" type="button" style="flex:1;padding:8px;">🖼️ 上传图片</button>
      </div>
      <input id="warden-qr-file" type="file" accept="image/*" style="display:none;" />
      <div id="warden-scan-output" style="display:none;overflow:hidden;border-radius:8px;"></div>
      <div style="margin-top:8px;text-align:right;">
        <button id="warden-scan-close" type="button" style="padding:6px 10px;">关闭</button>
      </div>`;
    document.body.appendChild(panel);

    const output = panel.querySelector("#warden-scan-output");
    const fileInput = panel.querySelector("#warden-qr-file");
    let stopCamera = null;

    panel.querySelector("#warden-scan-camera").onclick = async () => {
      try {
        if (stopCamera) stopCamera();
        stopCamera = await scanByCamera(output);
      } catch (e) {
        toast(`摄像头不可用：${e?.message || e}`);
      }
    };
    panel.querySelector("#warden-scan-upload").onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (!("BarcodeDetector" in window)) {
          toast("浏览器不支持图片二维码识别。");
          return;
        }
        const bitmap = await createImageBitmap(file);
        const raw = await detectFromImageBitmap(bitmap);
        const secret = parseOtpAuth(raw);
        if (!secret) {
          toast("未识别到 otpauth 二维码。");
          return;
        }
        if (applySecret(secret)) toast("已自动填入 TOTP。");
        else toast("未找到 TOTP 输入框，请先打开登录项编辑弹窗。");
      } catch (err) {
        toast(`图片识别失败：${err?.message || err}`);
      } finally {
        fileInput.value = "";
      }
    };
    panel.querySelector("#warden-scan-close").onclick = () => {
      panel.style.display = "none";
      if (stopCamera) stopCamera();
    };
    return panel;
  }

  function ensureUi() {
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement("button");
    fab.id = FAB_ID;
    fab.type = "button";
    fab.textContent = "扫码TOTP";
    fab.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:99999;padding:10px 14px;border:none;border-radius:22px;background:#175ddc;color:#fff;font-weight:600;";
    document.body.appendChild(fab);
    const panel = createPanel();
    fab.onclick = () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    };
  }

  document.addEventListener("DOMContentLoaded", ensureUi);
  ensureUi();
})();
