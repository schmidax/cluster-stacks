/**
 * OpenStack API Service for ClusterStacks UI Extension.
 *
 * Accepts a raw clouds.yaml string, parses it internally, and provides
 * authenticated access to:
 *   - Keystone (identity)
 *   - Nova (compute, quota)
 *   - Neutron (network)
 *   - Cinder (volumes)
 *   - Glance (images)
 *   - Swift (object storage for etcd backup)
 */

import {
  OpenStackFlavor,
  OpenStackImage,
  OpenStackServer,
  OpenStackNetwork,
  OpenStackSubnet,
  OpenStackSecurityGroup,
  OpenStackFloatingIP,
  OpenStackRouter,
  OpenStackVolume,
  OpenStackQuota,
  NetworkQuota,
  SwiftContainer,
  OpenStackProject,
  OpenStackRegion,
  OpenStackKeyPair,
  CatalogEntry,
  Endpoint,
} from '../types/openstack';

const PROXY_BASE = '/meta/proxy';

// ─── Internal parsed representation of a clouds.yaml entry ─────────────────

interface ParsedCloud {
  authUrl: string;
  regionName: string;
  // user/password auth
  username?: string;
  password?: string;
  projectName?: string;
  projectId?: string;
  domainName?: string;
  // application-credential auth
  applicationCredentialId?: string;
  applicationCredentialSecret?: string;
}

/**
 * Minimal clouds.yaml parser.
 *
 * Scans every line for `key: value` pairs regardless of indentation level.
 * This covers all standard clouds.yaml keys without requiring a full YAML parser.
 * Quoted values and inline comments are handled.
 *
 * The following keys are extracted (first occurrence wins):
 *   auth_url, username, password, project_name, project_id,
 *   user_domain_name / domain_name, region_name,
 *   application_credential_id, application_credential_secret
 */
export function parseCloudsYaml(text: string): ParsedCloud {
  const seen: Record<string, string> = {};

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    // Skip lines whose value is empty (they are parent / mapping keys)
    if (!val) {
      continue;
    }

    // Remove trailing inline comments
    val = val.replace(/\s+#.*$/, '');

    // Strip surrounding single or double quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (val && !(key in seen)) {
      seen[key] = val;
    }
  }

  const authUrl = (seen['auth_url'] || '').replace(/\/+$/, '');
  if (!authUrl) {
    throw new Error('auth_url not found in clouds.yaml');
  }

  return {
    authUrl,
    regionName:                   seen['region_name'] || '',
    username:                     seen['username'],
    password:                     seen['password'],
    projectName:                  seen['project_name'],
    projectId:                    seen['project_id'],
    domainName:                   seen['user_domain_name'] || seen['domain_name'] || 'Default',
    applicationCredentialId:      seen['application_credential_id'],
    applicationCredentialSecret:  seen['application_credential_secret'],
  };
}

/**
 * Normalise a Keystone auth URL so that it always ends in `/v3`.
 *
 * Handles inputs like:
 *   https://identity.example.com:5000
 *   https://identity.example.com:5000/
 *   https://identity.example.com:5000/v3
 *   https://identity.example.com:5000/v3/
 */
function normaliseAuthUrl(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/v\d+$/, '') + '/v3';
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class OpenStackApiService {
  private cloud: ParsedCloud;
  private store: any;
  private token: string | null = null;
  private catalog: CatalogEntry[] = [];
  private currentProjectId: string | null = null;

  /**
   * @param cloudsYaml  Raw text content of a clouds.yaml file, or a pre-parsed credential object.
   * @param store       Rancher Vuex store (used for proxied HTTP requests).
   */
  constructor(cloudsYaml: string | ParsedCloud, store: any) {
    this.cloud = typeof cloudsYaml === 'string' ? parseCloudsYaml(cloudsYaml) : cloudsYaml as ParsedCloud;
    this.store = store;
  }

  /** The project name extracted from clouds.yaml (populated after getToken()). */
  getProjectName(): string {
    return this.cloud.projectName || '';
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    const authBody = this.buildAuthBody();
    const keystoneBase = normaliseAuthUrl(this.cloud.authUrl);
    const url = `${PROXY_BASE}/${keystoneBase.replace(/^https?:\/\//, '')}/auth/tokens`;

    const response = await this.store.dispatch('management/request', {
      method:               'POST',
      url,
      headers:              { 'Content-Type': 'application/json' },
      data:                 JSON.stringify(authBody),
      redirectUnauthorized: false,
    });

    this.token = response.headers?.['x-subject-token'] || response._headers?.['x-subject-token'];
    if (response.token?.catalog) {
      this.catalog = response.token.catalog;
    }
    if (response.token?.project?.id) {
      this.currentProjectId = response.token.project.id;
    }
    // Prefer the project name returned by Keystone over the parsed one
    if (response.token?.project?.name) {
      this.cloud.projectName = response.token.project.name;
    }

    if (!this.token) {
      throw new Error('Keystone did not return a token (x-subject-token header missing)');
    }

    return this.token;
  }

  private buildAuthBody(): object {
    const { applicationCredentialId, applicationCredentialSecret } = this.cloud;

    if (applicationCredentialId) {
      return {
        auth: {
          identity: {
            methods:                ['application_credential'],
            application_credential: {
              id:     applicationCredentialId,
              secret: applicationCredentialSecret || '',
            },
          },
        },
      };
    }

    const { username, password, projectName, projectId, domainName } = this.cloud;
    const domain = { name: domainName || 'Default' };

    return {
      auth: {
        identity: {
          methods:  ['password'],
          password: {
            user: {
              name:     username || '',
              password: password || '',
              domain,
            },
          },
        },
        scope: {
          project: projectId
            ? { id: projectId }
            : { name: projectName || '', domain },
        },
      },
    };
  }

  // ─── Endpoint Resolution ─────────────────────────────────────────────────

  private getEndpointUrl(type: string, iface: 'public' | 'internal' = 'public'): string | null {
    const entry = this.catalog.find((e) => e.type === type);
    if (!entry) {
      return null;
    }

    const region = this.cloud.regionName;
    let endpoint: Endpoint | undefined;

    if (region) {
      endpoint = entry.endpoints.find(
        (e) => e.interface === iface && (e.region === region || e.region_id === region),
      );
    }
    if (!endpoint) {
      endpoint = entry.endpoints.find((e) => e.interface === iface);
    }

    return endpoint?.url || null;
  }

  private async makeRequest(endpointType: string, path: string, method = 'GET', data?: any): Promise<any> {
    await this.getToken();
    const baseUrl = this.getEndpointUrl(endpointType);
    if (!baseUrl) {
      throw new Error(`No endpoint found for service type: ${endpointType}`);
    }

    const proxyUrl = `${PROXY_BASE}/${baseUrl.replace(/^https?:\/\//, '')}${path}`;

    return await this.store.dispatch('management/request', {
      method,
      url:                  proxyUrl,
      headers:              {
        'X-Auth-Token': this.token,
        'Content-Type': 'application/json',
      },
      data:                 data ? JSON.stringify(data) : undefined,
      redirectUnauthorized: false,
    });
  }

  // ─── Nova (Compute) ───────────────────────────────────────────────────────

  async getFlavors(): Promise<OpenStackFlavor[]> {
    const response = await this.makeRequest('compute', '/flavors/detail');
    return response.flavors || [];
  }

  async getImages(): Promise<OpenStackImage[]> {
    const response = await this.makeRequest('image', '/v2/images?limit=1000');
    return response.images || [];
  }

  async getServers(): Promise<OpenStackServer[]> {
    const response = await this.makeRequest('compute', '/servers/detail');
    return response.servers || [];
  }

  async getKeyPairs(): Promise<OpenStackKeyPair[]> {
    const response = await this.makeRequest('compute', '/os-keypairs');
    return (response.keypairs || []).map((kp: any) => kp.keypair);
  }

  async getAvailabilityZones(): Promise<string[]> {
    const response = await this.makeRequest('compute', '/os-availability-zone');
    return (response.availabilityZoneInfo || [])
      .filter((az: any) => az.zoneState?.available)
      .map((az: any) => az.zoneName as string);
  }

  // ─── Nova Quota ───────────────────────────────────────────────────────────

  async getComputeQuota(projectId?: string): Promise<OpenStackQuota> {
    await this.getToken();
    const pid = projectId || this.currentProjectId;
    if (!pid) {
      throw new Error('No project ID available for quota query');
    }
    const response = await this.makeRequest('compute', `/os-quota-sets/${pid}/detail`);
    return response.quota_set as OpenStackQuota;
  }

  // ─── Neutron (Network) ────────────────────────────────────────────────────

  async getNetworks(): Promise<OpenStackNetwork[]> {
    const response = await this.makeRequest('network', '/v2.0/networks');
    return response.networks || [];
  }

  async getExternalNetworks(): Promise<OpenStackNetwork[]> {
    const response = await this.makeRequest('network', '/v2.0/networks?router%3Aexternal=true');
    return response.networks || [];
  }

  async getSubnets(networkId?: string): Promise<OpenStackSubnet[]> {
    const filter = networkId ? `?network_id=${networkId}` : '';
    const response = await this.makeRequest('network', `/v2.0/subnets${filter}`);
    return response.subnets || [];
  }

  async getSecurityGroups(): Promise<OpenStackSecurityGroup[]> {
    const response = await this.makeRequest('network', '/v2.0/security-groups');
    return response.security_groups || [];
  }

  async getFloatingIPs(): Promise<OpenStackFloatingIP[]> {
    const response = await this.makeRequest('network', '/v2.0/floatingips');
    return response.floatingips || [];
  }

  async getRouters(): Promise<OpenStackRouter[]> {
    const response = await this.makeRequest('network', '/v2.0/routers');
    return response.routers || [];
  }

  async getNetworkQuota(projectId?: string): Promise<NetworkQuota> {
    await this.getToken();
    const pid = projectId || this.currentProjectId;
    if (!pid) {
      throw new Error('No project ID available for network quota query');
    }
    const response = await this.makeRequest('network', `/v2.0/quotas/${pid}/details`);
    return response.quota as NetworkQuota;
  }

  // ─── Cinder (Block Storage) ───────────────────────────────────────────────

  async getVolumes(): Promise<OpenStackVolume[]> {
    const response = await this.makeRequest('volumev3', '/volumes/detail');
    return response.volumes || [];
  }

  // ─── Glance (Image) ───────────────────────────────────────────────────────

  async getGlanceImages(filters?: Record<string, string>): Promise<OpenStackImage[]> {
    let query = '?limit=1000';
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }
    const response = await this.makeRequest('image', `/v2/images${query}`);
    return response.images || [];
  }

  // ─── Swift (Object Storage) ───────────────────────────────────────────────

  async listContainers(): Promise<SwiftContainer[]> {
    const response = await this.makeRequest('object-store', '?format=json');
    return Array.isArray(response) ? response : [];
  }

  async createContainer(containerName: string): Promise<void> {
    await this.makeRequest('object-store', `/${containerName}`, 'PUT');
  }

  async deleteContainer(containerName: string): Promise<void> {
    await this.makeRequest('object-store', `/${containerName}`, 'DELETE');
  }

  async getSwiftEndpoint(): Promise<string | null> {
    await this.getToken();
    return this.getEndpointUrl('object-store');
  }

  // ─── Keystone (Identity) ──────────────────────────────────────────────────

  private keystoneUrl(path: string): string {
    const base = normaliseAuthUrl(this.cloud.authUrl);
    return `${PROXY_BASE}/${base.replace(/^https?:\/\//, '')}${path}`;
  }

  async getProjects(): Promise<OpenStackProject[]> {
    const response = await this.store.dispatch('management/request', {
      method:               'GET',
      url:                  this.keystoneUrl('/auth/projects'),
      headers:              { 'X-Auth-Token': await this.getToken() },
      redirectUnauthorized: false,
    });
    return response.projects || [];
  }

  async getRegions(): Promise<OpenStackRegion[]> {
    const response = await this.store.dispatch('management/request', {
      method:               'GET',
      url:                  this.keystoneUrl('/regions'),
      headers:              { 'X-Auth-Token': await this.getToken() },
      redirectUnauthorized: false,
    });
    return response.regions || [];
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }
}
