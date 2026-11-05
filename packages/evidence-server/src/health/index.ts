import { getServerEnv } from "../env";

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime_seconds: number;
  environment: string;
  demo_mode: boolean;
  version: string;
}

const startTime = Date.now();

export function getHealthStatus(): HealthCheckResponse {
  const env = getServerEnv();
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    environment: env.NODE_ENV,
    demo_mode: env.DEMO_MODE,
    version: "1.0.0"
  };
}
