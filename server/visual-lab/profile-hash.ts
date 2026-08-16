import { createHash } from 'node:crypto';
import type { VisualProfile } from '../../src/visual-lab/types';
import { normalizeVisualConfiguration,visualRegistry } from '../../src/visual-lab/registry';
export function canonicalProfile(profile:VisualProfile):string{const values=normalizeVisualConfiguration(profile.values);return JSON.stringify({formatVersion:profile.formatVersion,name:profile.name,schemaVersion:profile.schemaVersion,description:profile.description??'',values:Object.fromEntries(visualRegistry.list().map((definition)=>[definition.id,values[definition.id]]))})}
export function visualProfileHash(profile:VisualProfile):string{return createHash('sha256').update(canonicalProfile(profile)).digest('hex')}
