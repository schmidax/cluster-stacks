// TypeScript interfaces for OpenStack resources used by ClusterStacks

export interface OpenStackCredential {
  name: string;
  namespace?: string;
  clouds: Record<string, CloudConfig>;
}

export interface CloudConfig {
  auth: CloudAuth;
  region_name?: string;
  interface?: string;
  identity_api_version?: number;
  volume_api_version?: number;
}

export interface CloudAuth {
  auth_url: string;
  username?: string;
  password?: string;
  project_name?: string;
  project_id?: string;
  user_domain_name?: string;
  project_domain_name?: string;
  application_credential_id?: string;
  application_credential_secret?: string;
}

// Nova (Compute) resources

export interface OpenStackFlavor {
  id: string;
  name: string;
  vcpus: number;
  ram: number;
  disk: number;
  'os-flavor-access:is_public'?: boolean;
  disabled?: boolean;
}

export interface OpenStackImage {
  id: string;
  name: string;
  status: string;
  visibility: string;
  min_disk: number;
  min_ram: number;
  size?: number;
  disk_format?: string;
  container_format?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
}

export interface OpenStackServer {
  id: string;
  name: string;
  status: string;
  addresses?: Record<string, NetworkAddress[]>;
  flavor?: { id: string };
  image?: { id: string };
  key_name?: string;
  security_groups?: Array<{ name: string }>;
  created?: string;
  updated?: string;
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface NetworkAddress {
  'OS-EXT-IPS:type': 'fixed' | 'floating';
  addr: string;
  version: number;
  'OS-EXT-IPS-MAC:mac_addr'?: string;
}

// Neutron (Network) resources

export interface OpenStackNetwork {
  id: string;
  name: string;
  status: string;
  admin_state_up: boolean;
  shared: boolean;
  external?: boolean;
  'router:external'?: boolean;
  subnets?: string[];
  provider?: {
    network_type: string;
    physical_network?: string;
    segmentation_id?: number;
  };
}

export interface OpenStackSubnet {
  id: string;
  name: string;
  network_id: string;
  cidr: string;
  ip_version: 4 | 6;
  gateway_ip?: string;
  dns_nameservers?: string[];
  enable_dhcp: boolean;
}

export interface OpenStackSecurityGroup {
  id: string;
  name: string;
  description?: string;
  security_group_rules?: OpenStackSecurityGroupRule[];
}

export interface OpenStackSecurityGroupRule {
  id: string;
  direction: 'ingress' | 'egress';
  protocol?: string;
  port_range_min?: number;
  port_range_max?: number;
  remote_ip_prefix?: string;
  ethertype: 'IPv4' | 'IPv6';
}

export interface OpenStackFloatingIP {
  id: string;
  floating_ip_address: string;
  fixed_ip_address?: string;
  status: string;
  port_id?: string;
  router_id?: string;
}

export interface OpenStackRouter {
  id: string;
  name: string;
  status: string;
  admin_state_up: boolean;
  external_gateway_info?: {
    network_id: string;
    enable_snat?: boolean;
    external_fixed_ips?: Array<{ ip_address: string; subnet_id: string }>;
  };
}

// Cinder (Volume) resources

export interface OpenStackVolume {
  id: string;
  name: string;
  status: string;
  size: number;
  volume_type?: string;
  attachments?: Array<{
    server_id: string;
    attachment_id: string;
    volume_id: string;
    device: string;
  }>;
  created_at?: string;
  availability_zone?: string;
}

// Nova Quota

export interface OpenStackQuota {
  instances: QuotaItem;
  cores: QuotaItem;
  ram: QuotaItem;
  floating_ips?: QuotaItem;
  fixed_ips?: QuotaItem;
  metadata_items?: QuotaItem;
  key_pairs?: QuotaItem;
  security_groups?: QuotaItem;
  security_group_rules?: QuotaItem;
}

export interface QuotaItem {
  in_use: number;
  limit: number;
  reserved: number;
}

export interface NetworkQuota {
  network?: QuotaItem;
  subnet?: QuotaItem;
  port?: QuotaItem;
  router?: QuotaItem;
  floatingip?: QuotaItem;
  security_group?: QuotaItem;
  security_group_rule?: QuotaItem;
}

// Swift (Object Storage)

export interface SwiftContainer {
  name: string;
  count: number;
  bytes: number;
}

// Keystone

export interface OpenStackProject {
  id: string;
  name: string;
  domain_id?: string;
  description?: string;
  enabled: boolean;
}

export interface OpenStackRegion {
  id: string;
  description?: string;
}

export interface OpenStackToken {
  value: string;
  catalog?: CatalogEntry[];
  project?: OpenStackProject;
}

export interface CatalogEntry {
  type: string;
  name?: string;
  endpoints: Endpoint[];
}

export interface Endpoint {
  id: string;
  interface: 'public' | 'internal' | 'admin';
  url: string;
  region?: string;
  region_id?: string;
}

export interface OpenStackKeyPair {
  name: string;
  fingerprint?: string;
  public_key?: string;
}
