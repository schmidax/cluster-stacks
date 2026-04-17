import { PRODUCT_NAME } from '../config/clusterstacks';

function getCurrentClusterParam() {
  const match = window.location.pathname.match(/\/c\/([^/]+)/);

  return match?.[1] || '_';
}

function buildClusterStacksUrl(path, query) {
  const cluster = getCurrentClusterParam();
  const qs = new URLSearchParams(query);

  return `/c/${ cluster }/${ PRODUCT_NAME }${ path }?${ qs.toString() }`;
}

async function resolveCapiCoordinates(resource) {
  const metadata = resource?.metadata || {};
  const labels = metadata.labels || {};
  const annotations = metadata.annotations || {};

  const directName = labels['cluster.x-k8s.io/cluster-name'] || annotations['cluster.x-k8s.io/cluster-name'];
  const directNs = labels['cluster.x-k8s.io/cluster-namespace'] || annotations['cluster.x-k8s.io/cluster-namespace'];

  if (directName && directNs) {
    return {
      namespace: String(directNs),
      name:      String(directName),
    };
  }

  if (resource?.type === 'cluster.x-k8s.io.cluster' && metadata?.name && metadata?.namespace) {
    return {
      namespace: String(metadata.namespace),
      name:      String(metadata.name),
    };
  }

  const provisioningClusterId = resource?.provisioningClusterId;

  if (typeof provisioningClusterId === 'string' && provisioningClusterId.includes('/')) {
    const [namespace, name] = provisioningClusterId.split('/');

    if (namespace && name) {
      return { namespace, name };
    }
  }

  const fallbackName = directName || metadata?.name || resource?.provisioningClusterName || resource?.spec?.displayName;

  if (!fallbackName) {
    return null;
  }

  try {
    const resp = await window.fetch('/apis/cluster.x-k8s.io/v1beta2/clusters', { credentials: 'include' });

    if (!resp.ok) {
      return null;
    }

    const payload = await resp.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const match = items.find((item) => {
      const itemMeta = item?.metadata || {};
      const itemLabels = itemMeta.labels || {};

      return itemMeta.name === fallbackName || itemLabels['cluster.x-k8s.io/cluster-name'] === fallbackName;
    });

    if (match?.metadata?.name && match?.metadata?.namespace) {
      return {
        namespace: String(match.metadata.namespace),
        name:      String(match.metadata.name),
      };
    }
  } catch {
    // ignore lookup errors and keep default Rancher behavior
  }

  return null;
}

async function redirectToClusterStacks(resource, mode) {
  const coords = await resolveCapiCoordinates(resource);

  if (!coords) {
    return false;
  }

  if (mode === 'yaml') {
    window.location.assign(buildClusterStacksUrl('/clusters/detail', {
      namespace: coords.namespace,
      name:      coords.name,
      tab:       'yaml',
    }));

    return true;
  }

  window.location.assign(buildClusterStacksUrl('/clusters/create', {
    namespace: coords.namespace,
    name:      coords.name,
  }));

  return true;
}

export async function maybeRedirectClusterStacksConfig(resource) {
  return redirectToClusterStacks(resource, 'config');
}

export async function maybeRedirectClusterStacksYaml(resource) {
  return redirectToClusterStacks(resource, 'yaml');
}
