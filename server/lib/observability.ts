import { performance } from "node:perf_hooks";
import type { IncomingMessage, ServerResponse } from "http";

// Динамический импорт Sentry для избежания проблем с типами
let Sentry: any = null;

const SENTRY_DSN = process.env.SENTRY_DSN;

// Безопасная проверка инициализации Sentry
const isSentryEnabled = () => {
  return Boolean(SENTRY_DSN && Sentry);
};

// Инициализируем Sentry асинхронно если нужно
if (SENTRY_DSN) {
  try {
    // Динамический импорт чтобы избежать проблем с типами во время компиляции
    import("@sentry/node").then((sentryModule) => {
      Sentry = sentryModule;
      if (Sentry && !Sentry.getCurrentHub().getClient()) {
        Sentry.init({
          dsn: SENTRY_DSN,
          tracesSampleRate: 0.2,
        });
      }
    }).catch((error) => {
      console.error("Failed to load Sentry:", error);
    });
  } catch (error) {
    console.error("Sentry initialization failed:", error);
  }
}

interface MessageMetric {
  channel: string;
  status: string;
  latencyMs: number;
}

const metricState = {
  totalSent: 0,
  errors: 0,
  channelVolume: new Map<string, number>(),
  statusCounters: new Map<string, number>(),
  latencySamples: [] as MessageMetric[],
};

export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (isSentryEnabled() && Sentry) {
    try {
      Sentry.withScope((scope: any) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) =>
            scope.setContext(key, { value })
          );
        }
        Sentry.captureException(error);
      });
    } catch (sentryError) {
      console.error("Sentry error capture failed:", sentryError);
    }
  } else {
    // Fallback logging when Sentry is not available
    console.error("Error captured:", error, context);
  }
}

export function recordMessageMetric(metric: MessageMetric) {
  metricState.totalSent += 1;
  metricState.channelVolume.set(
    metric.channel,
    (metricState.channelVolume.get(metric.channel) ?? 0) + 1,
  );
  metricState.statusCounters.set(
    metric.status,
    (metricState.statusCounters.get(metric.status) ?? 0) + 1,
  );
  metricState.latencySamples.push(metric);
  if (metric.status !== "delivered") {
    metricState.errors += 1;
  }
  
  // Keep only last 1000 samples to prevent memory leaks
  if (metricState.latencySamples.length > 1000) {
    metricState.latencySamples = metricState.latencySamples.slice(-500);
  }
}

export function getMetricsSnapshot() {
  const latencyValues = metricState.latencySamples.map((m) => m.latencyMs);
  const avgLatency = latencyValues.length
    ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length
    : 0;
  const p95Latency = percentile(latencyValues, 0.95);
  return {
    totalSent: metricState.totalSent,
    errors: metricState.errors,
    channelVolume: Object.fromEntries(metricState.channelVolume.entries()),
    statusCounters: Object.fromEntries(metricState.statusCounters.entries()),
    avgLatency,
    p95Latency,
    sampleSize: metricState.latencySamples.length,
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export async function traceMessage<T>(
  channel: string,
  action: string,
  fn: () => Promise<T>,
) {
  const start = performance.now();
  try {
    const result = await fn();
    recordMessageMetric({
      channel,
      status: "delivered",
      latencyMs: performance.now() - start,
    });
    return result;
  } catch (error) {
    recordMessageMetric({
      channel,
      status: "failed",
      latencyMs: performance.now() - start,
    });
    captureError(error, { action, channel });
    throw error;
  }
}

export function registerRequestBreadcrumb(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!isSentryEnabled() || !Sentry) return;
  
  const start = performance.now();
  res.once("finish", () => {
    const duration = performance.now() - start;
    try {
      Sentry.addBreadcrumb({
        category: "http",
        type: "http",
        data: {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
        },
      });
    } catch (error) {
      console.error("Failed to add Sentry breadcrumb:", error);
    }
  });
}

// Утилита для ручного логирования
export function logInfo(message: string, context?: Record<string, unknown>) {
  console.log(`[INFO] ${message}`, context || '');
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  console.warn(`[WARN] ${message}`, context || '');
}