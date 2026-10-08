let convaiSocket = null;

if (typeof window !== "undefined" && !window.__positivoConvaiHook) {
  window.__positivoConvaiHook = true;
  const Original = window.WebSocket;
  window.WebSocket = class ConvaiWebSocket extends Original {
    constructor(url, protocols) {
      super(url, protocols);
      if (/elevenlabs\.io|convai/i.test(String(url))) {
        convaiSocket = this;
        this.addEventListener("close", () => {
          if (convaiSocket === this) convaiSocket = null;
        });
      }
    }
  };
}

export function sendContextualUpdate(text) {
  if (!convaiSocket || convaiSocket.readyState !== WebSocket.OPEN || !text) return false;
  convaiSocket.send(JSON.stringify({ type: "contextual_update", text }));
  return true;
}

export const AGENT_ID = "agent_6701m4byckmre5sb3rasppewkak7";
