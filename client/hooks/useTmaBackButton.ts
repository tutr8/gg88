import { useEffect } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export function useTelegramBackButton(visible: boolean, onBack?: () => void) {
  useEffect(() => {
    const webApp =
      typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    const back = webApp?.BackButton;
    if (!back) return;

    const handler = () => {
      try {
        onBack?.();
      } catch {}
    };

    try {
      back.onClick(handler);
      if (visible) back.show();
      else back.hide();
    } catch {}

    return () => {
      try {
        back.offClick(handler);
      } catch {}
      try {
        back.hide();
      } catch {}
    };
  }, [visible, onBack]);
}
