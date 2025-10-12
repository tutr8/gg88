import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export function useTelegramPlatform() {
  const [isReady, setReady] = useState(false);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const webApp =
    typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

  const platform =
    webApp?.platform ||
    (/(Android)/i.test(ua)
      ? "android"
      : /(iPhone|iPad|iPod|iOS)/i.test(ua)
        ? "ios"
        : "unknown");
  const isAndroid = String(platform).toLowerCase() === "android";
  const isTma = !!webApp;

  useEffect(() => {
    if (!webApp) return;
    try {
      webApp.ready();
      if (isAndroid) {
        // Fill the whole screen on Android
        if (typeof webApp.expand === "function") webApp.expand();
        if (typeof webApp.enableClosingConfirmation === "function")
          webApp.enableClosingConfirmation(false);
      } else {
        // Fullsize behavior (no extra top offset)
        if (typeof webApp.disableVerticalSwipes === "function")
          webApp.disableVerticalSwipes();
      }
      setReady(true);
    } catch {
      // ignore
    }
  }, [isAndroid, webApp]);

  return useMemo(
    () => ({ isTma, platform, isAndroid, isReady }),
    [isTma, platform, isAndroid, isReady],
  );
}
