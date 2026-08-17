import type { Command, CommandResult, Query, QueryResult } from '../interface/protocol';
import type { ActivityOrigin } from '../activity/activity-events';

export interface RuntimePort {
  command(command: Command, origin?: ActivityOrigin): Promise<CommandResult>;
  query(query: Query): Promise<QueryResult>;
}
