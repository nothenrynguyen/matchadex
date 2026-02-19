type LogLevel = "info" | "error";

type LogContext = {
  route?: string;
  method?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
}

async function sendMonitoringWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.MONITORING_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow monitoring transport errors to avoid affecting app traffic
  }
}

async function log(level: LogLevel, message: string, context: LogContext, error?: unknown) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    route: context.route ?? null,
    method: context.method ?? null,
    userId: context.userId ?? null,
    metadata: context.metadata ?? null,
    error: error ? toErrorMessage(error) : null,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }

  await sendMonitoringWebhook(payload);
}

export async function logInfo(message: string, context: LogContext = {}) {
  await log("info", message, context);
}

export async function logError(message: string, error: unknown, context: LogContext = {}) {
  await log("error", message, context, error);
}
