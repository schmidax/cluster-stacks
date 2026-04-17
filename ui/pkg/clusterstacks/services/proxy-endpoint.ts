/**
 * Helpers for managing Rancher ProxyEndpoint CRDs.
 *
 * ProxyEndpoints are cluster-scoped resources in the management.cattle.io/v3 API
 * that add hostnames to Rancher's /meta/proxy allowlist. One ProxyEndpoint is
 * maintained per unique OpenStack Keystone hostname so that /meta/proxy can
 * forward requests to the OpenStack API.
 */

const PROXY_ENDPOINT_PREFIX = 'openstack-proxy-';
const PROXY_ENDPOINT_API    = '/apis/management.cattle.io/v3/proxyendpoints';

/**
 * Extracts the hostname (without port) from an OpenStack auth URL.
 * Returns an empty string if the URL cannot be parsed.
 */
export function hostnameFromAuthUrl(authUrl: string): string {
  if (!authUrl) {
    return '';
  }

  try {
    return new URL(authUrl).hostname;
  } catch {
    return '';
  }
}

/**
 * Derives a valid Kubernetes resource name for a ProxyEndpoint from a hostname.
 *
 * The name is lowercase, with any character not allowed in DNS subdomain names
 * replaced by a hyphen. Leading/trailing non-alphanumeric characters are stripped.
 */
export function proxyEndpointName(hostname: string): string {
  const sanitized = hostname
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '')
    .slice(0, 230); // leave room for the prefix (253 max total)

  return `${ PROXY_ENDPOINT_PREFIX }${ sanitized }`;
}

/**
 * Ensures a ProxyEndpoint resource exists for the given hostname.
 * If it already exists the call is a no-op.
 */
export async function ensureProxyEndpoint(hostname: string, store: any): Promise<void> {
  const name = proxyEndpointName(hostname);

  try {
    await store.dispatch('management/request', {
      method: 'GET',
      url:    `${ PROXY_ENDPOINT_API }/${ name }`,
    });

    return; // already exists
  } catch {
    // Not found — fall through to create
  }

  await store.dispatch('management/request', {
    method:  'POST',
    url:     PROXY_ENDPOINT_API,
    headers: { 'Content-Type': 'application/json' },
    data:    JSON.stringify({
      apiVersion: 'management.cattle.io/v3',
      kind:       'ProxyEndpoint',
      metadata:   { name },
      spec:       { routes: [{ domain: hostname }] },
    }),
  });
}

/**
 * Deletes the ProxyEndpoint for the given hostname.
 * Silently ignores 404 errors (already deleted or never created).
 */
export async function deleteProxyEndpoint(hostname: string, store: any): Promise<void> {
  const name = proxyEndpointName(hostname);

  try {
    await store.dispatch('management/request', {
      method: 'DELETE',
      url:    `${ PROXY_ENDPOINT_API }/${ name }`,
    });
  } catch {
    // Ignore — resource may not exist
  }
}
