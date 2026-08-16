import type { ComponentType } from 'react';

export interface PanelDefinition { readonly id: string; readonly title: string; readonly order: number; readonly Component: ComponentType }

export class PanelRegistry {
  private readonly panels = new Map<string, PanelDefinition>();
  register(panel: PanelDefinition): void {
    if (this.panels.has(panel.id)) throw new Error(`Panel already registered: ${panel.id}`);
    this.panels.set(panel.id, panel);
  }
  list(): readonly PanelDefinition[] { return [...this.panels.values()].sort((a, b) => a.order - b.order); }
}
