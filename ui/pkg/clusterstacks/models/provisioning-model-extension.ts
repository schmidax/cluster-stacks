/**
 * ClusterStacks ModelExtension for provisioning.cattle.io.cluster
 *
 * Rancher's provisioning cluster model has a first-class "customProvisionerHelper"
 * hook that calls this extension's useFor() / availableActions() at runtime.
 */

import { PRODUCT_NAME } from '../config/clusterstacks';

function getCurrentCluster(): string {
  const match = window.location.pathname.match(/\/c\/([^/]+)/);

  return match?.[1] || '_';
}

function buildClusterStacksUrl(path: string, query: Record<string, string>): string {
  const cluster = getCurrentCluster();
  const qs = new URLSearchParams(query);

  return `/c/${ cluster }/${ PRODUCT_NAME }${ path }?${ qs.toString() }`;
}

async function resolveCapiCoords(cluster: any): Promise<{ name: string; namespace: string } | null> {
  const labels = cluster.metadata?.labels || cluster.labels || {};
  const annotations = cluster.metadata?.annotations || cluster.annotations || {};

  const directName = labels['cluster.x-k8s.io/cluster-name']
    || annotations['cluster.x-k8s.io/cluster-name'];
  const directNs = labels['cluster.x-k8s.io/cluster-namespace']
    || annotations['cluster.x-k8s.io/cluster-namespace'];

  if (directName && directNs) {
    return { name: String(directName), namespace: String(directNs) };
  }

  const candidateName = directName
    || cluster.spec?.displayName
    || cluster.metadata?.name
    || cluster.name;

  if (!candidateName) {
    return null;
  }

  try {
    const resp = await window.fetch('/apis/cluster.x-k8s.io/v1beta2/clusters', { credentials: 'include' });

    if (!resp.ok) {
      return null;
    }

    const payload = await resp.json();
    const match = (payload?.items || []).find((item: any) => {
      const itemLabels = item?.metadata?.labels || {};

      return item?.metadata?.name === candidateName
        || itemLabels['cluster.x-k8s.io/cluster-name'] === candidateName;
    });

    if (match?.metadata?.name && match?.metadata?.namespace) {
      return {
        name: String(match.metadata.name),
        namespace: String(match.metadata.namespace),
      };
    }
  } catch {
    // Let Rancher defaults handle unresolved cases.
  }

  return null;
}

export class ClusterStacksProvisioningExtension {
  constructor(_context: any) {
    // Keep context reserved for future use.
  }

  useFor(cluster: any): boolean {
    // Only apply extension in ClusterStacks product context
    // Skip in provisioning wizard and manager/fleet contexts to avoid API conflicts
    const pathname = window?.location?.pathname || '';
    
    // Only active when in clusterstacks product context
    if (!pathname.includes('/clusterstacks/')) {
      return false;
    }
    
    // Skip during provisioning wizard
    if (pathname.includes('/provisioning.cattle.io.cluster/create')) {
      return false;
    }

    const labels = cluster.metadata?.labels || cluster.labels || {};
    const annotations = cluster.metadata?.annotations || cluster.annotations || {};
    const ns = cluster.metadata?.namespace || cluster.namespace || '';

    return (
      ns.startsWith('cso-')
      || !!labels['cluster.x-k8s.io/cluster-name']
      || !!annotations['cluster.x-k8s.io/cluster-name']
    );
  }

  availableActions(cluster: any, all: any[]): any[] {
    if (!cluster._csPatched) {
      cluster._csPatched = true;

      cluster.goToEdit = async() => {
        const coords = await resolveCapiCoords(cluster);

        if (coords) {
          window.location.assign(buildClusterStacksUrl('/clusters/create', {
            namespace: coords.namespace,
            name: coords.name,
          }));
        }
      };

      cluster.goToViewConfig = async() => {
        const coords = await resolveCapiCoords(cluster);

        if (coords) {
          window.location.assign(buildClusterStacksUrl('/clusters/create', {
            namespace: coords.namespace,
            name: coords.name,
          }));
        }
      };

      cluster.goToEditYaml = async() => {
        const coords = await resolveCapiCoords(cluster);

        if (coords) {
          window.location.assign(buildClusterStacksUrl('/clusters/detail', {
            namespace: coords.namespace,
            name: coords.name,
            tab: 'yaml',
          }));
        }
      };

      cluster.goToViewYaml = async() => {
        const coords = await resolveCapiCoords(cluster);

        if (coords) {
          window.location.assign(buildClusterStacksUrl('/clusters/detail', {
            namespace: coords.namespace,
            name: coords.name,
            tab: 'yaml',
          }));
        }
      };
    }

    return all;
  }
}
