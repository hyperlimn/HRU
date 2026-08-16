import type { Command, CommandResult, Query, QueryResult } from '../interface/protocol';

export interface RuntimePort {
  command(command: Command): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}
