import type { RuntimePort } from '../../src/runtime/runtime-port';

/** Future MCP transport adapter. It will delegate to the same RuntimePort as WebSocket and human UI. */
export class McpSocket {
  constructor(readonly runtime: RuntimePort) {}
  readonly status = 'PLACEHOLDER' as const;
}
