import type { RuntimePort } from '../../src/runtime/runtime-port';
import type { Command, Query } from '../../src/interface/protocol';

/** RuntimePort adapter reserved for a future MCP transport. No MCP server is exposed yet. */
export class McpSocket {
  constructor(readonly runtime: RuntimePort) {}
  readonly status = 'RUNTIME PORT ONLY (TRANSPORT NOT EXPOSED)' as const;
  command(command: Command) { return this.runtime.command(command, 'machine'); }
  query(query: Query) { return this.runtime.query(query); }
}
