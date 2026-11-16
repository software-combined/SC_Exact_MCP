import type { Server } from "node:http";

export const SHUTDOWN_EVENT = "scg:shutdown";

export function installShutdown(server: Server) {
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.emit(SHUTDOWN_EVENT);
    server.close(); // Active credential I/O must drain after its HTTP caller disconnects.
    server.closeAllConnections(); // Existing request cancellation prevents new issuance after preflight.
    setTimeout(() => process.exit(1), 35_000).unref();
  };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
