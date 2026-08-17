import { PanelRegistry } from "../panel-registry";
import {
  DimensionsPanel,
  LaboratoryPanel,
  MachinePanel,
  SavesPanel,
  SystemPanel,
  TimePanel,
  UniversePanel,
} from "./panels";
import { EntityPanel, ObserverPanel } from "./observation-panels";
import { VisualLabPanel } from "../../../visual-lab/VisualLabPanel";
import { CameraPanel } from "./CameraPanel";
import { ActivityLogPanel } from "./ActivityLogPanel";

export const panelRegistry = new PanelRegistry();
export const SIDEBAR_PANEL_ORDER = [
  "time",
  "universe",
  "dimensions",
  "observer",
  "entity",
  "camera",
  "visual-lab",
  "saves",
  "laboratory",
  "machine",
  "system",
  "activity",
] as const;
const panels = [
  ["time", "Time", TimePanel],
  ["universe", "Universe", UniversePanel],
  ["dimensions", "Dimension", DimensionsPanel],
  ["observer", "Observer", ObserverPanel],
  ["entity", "Entity", EntityPanel],
  ["camera", "Camera", CameraPanel],
  ["visual-lab", "Visual Lab", VisualLabPanel],
  ["saves", "Saves", SavesPanel],
  ["laboratory", "Laboratory", LaboratoryPanel],
  ["machine", "Machine / MCP", MachinePanel],
  ["system", "System", SystemPanel],
  ["activity", "Activity Log", ActivityLogPanel],
] as const;
panels.forEach(([id, title, Component], order) =>
  panelRegistry.register({ id, title, Component, order }),
);
