import type {VisualConfiguration} from '../../src/visual-lab/types';
const LEGACY_PALETTE_IDS=['hru-default','high-visibility','deep-field','monochrome','aurora'] as const;
export interface VisualMigrationResult {readonly values:VisualConfiguration;readonly warning?:string}
export function migrateLegacyPaletteSelection(values:VisualConfiguration):VisualMigrationResult {const active=values['palette.active'];if(typeof active==='string')return{values};if(typeof active==='number'&&Number.isInteger(active)&&active>=0&&active<LEGACY_PALETTE_IDS.length)return{values:{...values,'palette.active':LEGACY_PALETTE_IDS[active]!}};return{values:{...values,'palette.active':'hru-default'},warning:`Invalid legacy palette selection ${String(active)}; using hru-default`};}
