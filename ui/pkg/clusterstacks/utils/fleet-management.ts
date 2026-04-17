export const FLEET_MANAGED_LABEL_KEY = 'managed-by-fleet';
export const FLEET_MANAGED_TOOLTIP = 'Fleet-Managed';

export function isFleetManagedResource(resource: any): boolean {
  const labels = resource?.metadata?.labels || resource?.labels || {};
  const raw = labels[FLEET_MANAGED_LABEL_KEY];

  if (typeof raw === 'boolean') {
    return raw;
  }

  if (typeof raw === 'number') {
    return raw === 1;
  }

  return String(raw || '').toLowerCase() === 'true';
}
