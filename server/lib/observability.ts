import { performance } from "node:perf_hooks";
import { performance } from "node:perf_hooks";
import type { IncomingMessage, ServerResponse } from "http";
import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN;
const isSentryEnabled = () => Boolean(Sentry.getCurrentHub().getClient());
if (SENTRY_DSN && !isSentryEnabled()) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
  });
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
  if (isSentryEnabled()) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) =>
          scope.setContext(key, { value }),
        );
      }
      Sentry.captureException(error);
    });
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
    captureError(error, { action });
    throw error;
  }
}

export function registerRequestBreadcrumb(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (!isSentryEnabled()) return;
  const start = performance.now();
  res.once("finish", () => {
    const duration = performance.now() - start;
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
  });
}
