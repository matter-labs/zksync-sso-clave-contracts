/* eslint-disable @typescript-eslint/no-explicit-any */
type AsyncFunction<T extends any[], U> = (...args: T) => Promise<U>;

export function useAsync<T extends any[], U>(asyncFunction: AsyncFunction<T, U>) {
  const inProgress: Ref<boolean> = ref(false);
  const error: Ref<Error | null> = ref(null);
  const result: Ref<U | null> = ref(null);
  const payload: Ref<T | null> = ref(null);

  async function execute(...args: T): Promise<U | undefined> {
    payload.value = args;
    inProgress.value = true;
    error.value = null;
    try {
      const response = await asyncFunction(...args);
      result.value = response;
      return response;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("An unexpected error occurred.");
      error.value = err;
      if (err) {
        throw err;
      }
    } finally {
      inProgress.value = false;
    }
  }

  return {
    result,
    inProgress,
    payload,
    error,
    execute,
  };
}
