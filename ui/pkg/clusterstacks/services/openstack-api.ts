/**
 * OpenStack API Service for ClusterStacks UI Extension.
 *
 * Extends the patterns from rancher/ui-plugin-examples node-driver/openstack.ts
 * to cover additional OpenStack APIs needed for ClusterStacks:
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
  OpenStackToken,
  OpenStackKeyPair,
  CatalogEntry,
  Endpoint,
} from '../types/openstack';

const PROXY_BASE = '/meta/proxy';

export interface OpenStackConfig {
  authUrl: string;
  username?: string;
  password?: string;
  projectName?: string;
  projectId?: string;
  domainName?: string;
  regionName?: string;
  applicationCredentialId?: string;
  applicationCredentialSecret?: string;
}

export class OpenStackApiService {
  private config: OpenStackConfig;
  private store: any;
  private token: string | null = null;
  private catalog: CatalogEntry[] = [];
  private currentProjectId: string | null = null;

  constructor(config: OpenStackConfig, store: any) {
    this.config = config;
    this.store = store;
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    const authBody = this.buildAuthBody();
    const url = `${PROXY_BASE}/${this.config.authUrl.replace(/^https?:\/\//, '')}/v3/auth/tokens`;

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

    return this.token!;
  }

  private buildAuthBody(): any {
    if (this.config.applicationCredentialId) {
      return {
        auth: {
          identity: {
            methods:                ['application_credential'],
            application_credential: {
              id:     this.config.applicationCredentialId,
              secret: this.config.applicationCredentialSecret,
            },
          },
        },
      };
    }

    return {
      auth: {
        identity: {
          methods:  ['password'],
          password: {
            user: {
              name:     this.config.username,
              password: this.config.password,
              domain:   { name: this.config.domainName || 'Default' },
            },
          },
        },
        scope: {
          project: this.config.projectId
            ? { id: this.config.projectId }
            : {
                name:   this.config.projectName,
                domain: { name: this.config.domainName || 'Default' },
              },
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

    const region = this.config.regionName;
    let endpoint: Endpoint | undefined;

    if (region) {
      endpoint = entry.endpoints.find((e) => e.interface === iface && (e.region === region || e.region_id === region));
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
      throw new Error(`No endpoint found for type: ${endpointType}`);
    }

    const proxyUrl = `${PROXY_BASE}/${baseUrl.replace(/^https?:\/\//, '')}${path}`;

    return await this.store.dispatch('management/request', {
      method:               method,
      url:                  proxyUrl,
      headers:              {
        'X-Auth-Token':  this.token,
        'Content-Type':  'application/json',
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

  async getProjects(): Promise<OpenStackProject[]> {
    const url = `${PROXY_BASE}/${this.config.authUrl.replace(/^https?:\/\//, '')}/v3/auth/projects`;
    const response = await this.store.dispatch('management/request', {
      method:               'GET',
      url,
      headers:              { 'X-Auth-Token': await this.getToken() },
      redirectUnauthorized: false,
    });
    return response.projects || [];
  }

  async getRegions(): Promise<OpenStackRegion[]> {
    const url = `${PROXY_BASE}/${this.config.authUrl.replace(/^https?:\/\//, '')}/v3/regions`;
    const response = await this.store.dispatch('management/request', {
      method:               'GET',
      url,
      headers:              { 'X-Auth-Token': await this.getToken() },
      redirectUnauthorized: false,
    });
    return response.regions || [];
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }
}
