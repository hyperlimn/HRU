export const RENDER_CHANNEL_IDS = [
  'entities', 'positive-bonds', 'repulsion', 'clusters', 'contexts',
  'phase-effects', 'ancestry', 'condensed-entities', 'dimension-effects',
] as const;

export type RenderChannelId = (typeof RENDER_CHANNEL_IDS)[number];
export interface RenderChannel { readonly id: RenderChannelId; readonly label: string; readonly defaultVisible: boolean }

export const renderChannels: readonly RenderChannel[] = RENDER_CHANNEL_IDS.map((id) => ({
  id,
  label: id.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' '),
  defaultVisible: ['entities', 'positive-bonds', 'repulsion', 'clusters', 'phase-effects', 'condensed-entities', 'dimension-effects'].includes(id),
}));
