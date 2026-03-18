const REQUIRED_SECRETS = [
  "DATABASE_URL",
  "AUTH_CODE_SECRET",
  "JUDGE_CALLBACK_SECRET",
] as const;

const PRODUCTION_DANGEROUS = {
  DEBUG_AUTH_CODES: "true",
  ENABLE_LOCAL_RUNNER: "true",
} as const;

export function validateEnv() {
  const missing = REQUIRED_SECRETS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[env-check] Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (process.env.NODE_ENV === "production") {
    for (const [key, dangerous] of Object.entries(PRODUCTION_DANGEROUS)) {
      if (process.env[key] === dangerous) {
        console.warn(
          `[env-check] WARNING: ${key}=${dangerous} is unsafe in production`
        );
      }
    }

    const secret = process.env.AUTH_CODE_SECRET!;
    if (secret.length < 16 || /^(change.?me|dev|test|secret)$/i.test(secret)) {
      console.warn(
        "[env-check] WARNING: AUTH_CODE_SECRET appears to be a weak/default value"
      );
    }

    const judgeSecret = process.env.JUDGE_CALLBACK_SECRET!;
    if (judgeSecret.length < 16 || /^(dev|test|secret)/i.test(judgeSecret)) {
      console.warn(
        "[env-check] WARNING: JUDGE_CALLBACK_SECRET appears to be a weak/default value"
      );
    }
  }
}
