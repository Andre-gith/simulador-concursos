export function prepareFinishedHistory<
  T extends { finishedAt: Date | null },
>(attempts: T[]): Array<T & { finishedAt: Date }> {
  return attempts
    .filter(
      (attempt): attempt is T & { finishedAt: Date } =>
        attempt.finishedAt !== null,
    )
    .sort(
      (left, right) =>
        right.finishedAt.getTime() - left.finishedAt.getTime(),
    );
}
