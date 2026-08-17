import type { ClientMessage, ServerMessage } from '../../src/interface/protocol';
import type { RuntimePort } from '../../src/runtime/runtime-port';

export class CommandRouter {
  constructor(private readonly runtime: RuntimePort) {}
  async handle(message: ClientMessage): Promise<ServerMessage> {
    let payload;
    try {
      payload = message.kind === 'command'
        ? await this.runtime.command(message.payload, message.origin ?? 'human-ui')
        : await this.runtime.query(message.payload);
    } catch (error) {
      payload = { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    return { kind: 'response', requestId: message.requestId, payload };
  }
}
