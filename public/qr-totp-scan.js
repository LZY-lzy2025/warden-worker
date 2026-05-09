(() => {
  const BUTTON_ID = "warden-qr-totp-btn";

  function findTotpInput() {
    return (
      document.querySelector('input[formcontrolname="totp"]') ||
      document.querySelector('input[data-testid="totp"]') ||
      null
    );
  }

  function parseOtpAuth(uri) {
    try {
      if (!uri || !uri.toLowerCase().startsWith("otpauth://")) return null;
      const url = new URL(uri);
      return url.searchParams.get("secret") || uri;
    } catch {
      return null;
    }
  }

  async function scanQrCode() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      alert("当前浏览器不支持二维码扫描，请改用粘贴 otpauth:// 链接。");
      return null;
    }

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:center;justify-content:center;";
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.style.cssText = "max-width:90vw;max-height:70vh;border-radius:10px;";
      const close = document.createElement("button");
      close.textContent = "关闭";
      close.style.cssText = "position:fixed;bottom:20px;padding:10px 16px;font-size:16px;";
      wrap.append(video, close);
      document.body.appendChild(wrap);

      let running = true;
      const stop = (value = null) => {
        if (!running) return;
        running = false;
        stream.getTracks().forEach((t) => t.stop());
        wrap.remove();
        resolve(value);
      };
      close.onclick = () => stop(null);

      const tick = async () => {
        if (!running) return;
        try {
          const codes = await detector.detect(video);
          if (codes?.length && codes[0].rawValue) {
            stop(codes[0].rawValue);
            return;
          }
        } catch {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async function onScanClick() {
    const input = findTotpInput();
    if (!input) return;
    try {
      const raw = await scanQrCode();
      if (!raw) return;
      const value = parseOtpAuth(raw);
      if (!value) {
        alert("识别到的二维码不是 otpauth 格式。");
        return;
      }
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      alert(`扫码失败：${e?.message || e}`);
    }
  }

  function ensureButton() {
    const input = findTotpInput();
    if (!input || document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.type = "button";
    btn.textContent = "扫码添加 TOTP";
    btn.style.cssText = "margin-left:8px;padding:6px 10px;border:1px solid #3c8dbc;border-radius:6px;background:#fff;color:#3c8dbc;cursor:pointer;";
    btn.onclick = onScanClick;
    input.parentElement?.appendChild(btn);
  }

  const obs = new MutationObserver(ensureButton);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", ensureButton);
  ensureButton();
})();
