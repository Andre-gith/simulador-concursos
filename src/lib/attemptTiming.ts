export type AttemptTiming = {
  hasTimeLimit: boolean;
  expiresAt: Date | null;
  remainingMilliseconds: number | null;
  isExpired: boolean;
};

export function getAttemptTiming(
  startedAt: Date,
  durationMinutes: number | null,
  now = new Date(),
): AttemptTiming {
  if (durationMinutes === null) {
    return {
      hasTimeLimit: false,
      expiresAt: null,
      remainingMilliseconds: null,
      isExpired: false,
    };
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error("A duração deve ser um número inteiro positivo.");
  }

  const expiresAt = new Date(
    startedAt.getTime() + durationMinutes * 60_000,
  );
  const remainingMilliseconds = Math.max(
    0,
    expiresAt.getTime() - now.getTime(),
  );

  return {
    hasTimeLimit: true,
    expiresAt,
    remainingMilliseconds,
    isExpired: now.getTime() >= expiresAt.getTime(),
  };
}
