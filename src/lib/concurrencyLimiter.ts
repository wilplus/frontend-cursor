export function createConcurrencyLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    }

    active++;

    try {
      const result = await task();
      return result;
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }

  return { run };
}

export const recordingsDetailLimiter = createConcurrencyLimiter(3);

