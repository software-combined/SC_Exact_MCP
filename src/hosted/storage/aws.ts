export const awsClientOptions = { maxAttempts: 1,
  requestHandler: { requestTimeout: 3000, connectionTimeout: 1000, throwOnRequestTimeout: true } };

/** Bound the complete SDK call, including credentials and response deserialization. */
export async function awsRequest<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(new Error("AWS request timed out."), { name: "TimeoutError" });
      reject(error); controller.abort(error);
    }, 3000);
  });
  try { return await Promise.race([request(controller.signal), deadline]); }
  finally { clearTimeout(timer); }
}
