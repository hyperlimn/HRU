import { PanelRegistry } from '../panel-registry';
import { DimensionsPanel, LaboratoryPanel, MachinePanel, SavesPanel, SystemPanel, TimePanel, UniversePanel } from './panels';
import { EntityPanel, ObserverPanel, RenderPanel } from './observation-panels';

export const panelRegistry = new PanelRegistry();
[
  ['universe', 'Universe', UniversePanel], ['time', 'Time', TimePanel], ['observer', 'Observer', ObserverPanel],
  ['entity', 'Entity', EntityPanel], ['render', 'Render', RenderPanel], ['dimensions', 'Dimensions', DimensionsPanel],
  ['saves', 'Saves', SavesPanel], ['laboratory', 'Laboratory', LaboratoryPanel], ['machine', 'Machine / MCP', MachinePanel],
  ['system', 'System', SystemPanel],
].forEach(([id, title, Component], order) => panelRegistry.register({ id: id as string, title: title as string, Component: Component as typeof UniversePanel, order }));
