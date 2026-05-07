/**
 * OpenStack Quota Validator for ClusterStacks.
 *
 * Fetches current quota usage and validates whether a new cluster can be
 * created given the requested configuration. Also accounts for rolling
 * update headroom (+1 control plane node, +1 worker node).
 */

import { OpenStackApiService } from './openstack-api';
import { OpenStackQuota, NetworkQuota, VolumeQuota } from '../types/openstack';

export interface ClusterRequirements {
  controlPlaneReplicas: number;
  workerReplicas: number;
  bastionEnabled: boolean;
  controlPlaneFlavor: string;
  workerFlavor: string;
  bastionFlavor?: string;
  // vCPUs and RAM per flavor – resolved before calling validate()
  controlPlaneCpus: number;
  controlPlaneRamMb: number;
  workerCpus: number;
  workerRamMb: number;
  bastionCpus?: number;
  bastionRamMb?: number;
  controlPlaneRootDiskGb?: number;
  workerRootDiskGb?: number;
  bastionRootDiskGb?: number;
}

export interface ExistingClusterResources {
  instances: number;
  cpus: number;
  ramMb: number;
  diskGb: number;
}

export interface QuotaMetric {
  label: string;
  used: number;
  reserved: number;
  limit: number;
  unit: string;
  requested?: number;
  buffer?: number;
  projected?: number;
  freed?: number;
}

export interface QuotaValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  cpu?: QuotaMetric;
  ram?: QuotaMetric;
  instances?: QuotaMetric;
  disk?: QuotaMetric;
  hasCredentials?: boolean;
}

// Rolling-update headroom: keep enough spare capacity for +1 of each
const ROLLING_UPDATE_BUFFER = 1;

// Warn when remaining quota (after allocation) falls below this percentage
const WARN_THRESHOLD_PERCENT = 15;

export async function validateQuota(
  api: OpenStackApiService,
  requirements: ClusterRequirements,
  projectId?: string,
  existingResources?: ExistingClusterResources,
): Promise<QuotaValidationResult> {
  const result: QuotaValidationResult = {
    valid:    true,
    warnings: [],
    errors:   [],
    hasCredentials: false,
  };

  let computeQuota: OpenStackQuota | null = null;
  let networkQuota: NetworkQuota | null = null;
  let volumeQuota: VolumeQuota | null = null;

  try {
    computeQuota = await api.getComputeQuota(projectId);
  } catch (e: any) {
    result.warnings.push(`Could not fetch compute quota: ${e?.message || e}`);
  }

  try {
    networkQuota = await api.getNetworkQuota(projectId);
  } catch (e: any) {
    result.warnings.push(`Could not fetch network quota: ${e?.message || e}`);
  }

  try {
    volumeQuota = await api.getVolumeQuota(projectId);
  } catch (e: any) {
    result.warnings.push(`Could not fetch volume quota: ${e?.message || e}`);
  }

  // Set hasCredentials to true if we successfully fetched any quota data
  if (computeQuota || volumeQuota) {
    result.hasCredentials = true;
  }

  if (computeQuota) {
    checkComputeQuota(computeQuota, requirements, result, existingResources);
  } else {
    // Set default empty metrics if compute quota failed
    result.cpu = {
      label: 'vCPU',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: '',
    };
    result.ram = {
      label: 'RAM',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: 'MiB',
    };
    result.instances = {
      label: 'Instances',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: '',
    };
  }

  if (networkQuota) {
    checkNetworkQuota(networkQuota, requirements, result);
  }

  if (volumeQuota) {
    checkVolumeQuota(volumeQuota, requirements, result, existingResources);
  }

  if (!result.disk) {
    // Set default empty storage metric if volume quota failed or not available
    result.disk = {
      label: 'Storage',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: 'GB',
    };
  }

  return result;
}

export function getDefaultQuotaResult(): QuotaValidationResult {
  return {
    valid: true,
    warnings: [],
    errors: [],
    hasCredentials: false,
    cpu: {
      label: 'vCPU',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: '',
    },
    ram: {
      label: 'RAM',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: 'MiB',
    },
    instances: {
      label: 'Instances',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: '',
    },
    disk: {
      label: 'Disk Space',
      used: 0,
      reserved: 0,
      limit: 0,
      unit: 'GB',
    },
  };
}

function checkComputeQuota(
  quota: OpenStackQuota,
  req: ClusterRequirements,
  result: QuotaValidationResult,
  existing?: ExistingClusterResources,
): void {
  // Cluster nodes without rolling-update buffer
  const cpNodesBase = req.controlPlaneReplicas;
  const workerNodesBase = req.workerReplicas;
  const bastionNodesBase = req.bastionEnabled ? 1 : 0;
  const baseVms = cpNodesBase + workerNodesBase + bastionNodesBase;

  // Base resources (cluster itself)
  const baseCpus =
    cpNodesBase * req.controlPlaneCpus +
    workerNodesBase * req.workerCpus +
    bastionNodesBase * (req.bastionCpus || 0);
  const baseRamMb =
    cpNodesBase * req.controlPlaneRamMb +
    workerNodesBase * req.workerRamMb +
    bastionNodesBase * (req.bastionRamMb || 0);

  // Buffer resources (rolling update: only the largest VM, not all)
  const largestVmCpus = Math.max(
    req.controlPlaneCpus || 0,
    req.workerCpus || 0,
    req.bastionCpus || 0,
  );
  const largestVmRamMb = Math.max(
    req.controlPlaneRamMb || 0,
    req.workerRamMb || 0,
    req.bastionRamMb || 0,
  );
  const bufferVms = 1; // Only one VM for rolling update
  const bufferCpus = largestVmCpus;
  const bufferRamMb = largestVmRamMb;

  // When editing, subtract resources the existing cluster already uses
  // (they are already counted in OpenStack's in_use numbers)
  const existVms = existing?.instances || 0;
  const existCpus = existing?.cpus || 0;
  const existRamMb = existing?.ramMb || 0;

  // Net change: positive = need more, negative = freeing resources
  const requestedVms = Math.max(0, baseVms - existVms);
  const requestedCpus = Math.max(0, baseCpus - existCpus);
  const requestedRamMb = Math.max(0, baseRamMb - existRamMb);
  const freedVms = Math.max(0, existVms - baseVms);
  const freedCpus = Math.max(0, existCpus - baseCpus);
  const freedRamMb = Math.max(0, existRamMb - baseRamMb);

  // Total additional resources needed (net of existing)
  const neededVms = requestedVms + bufferVms;
  const neededCpus = requestedCpus + bufferCpus;
  const neededRamMb = requestedRamMb + bufferRamMb;

  const currentInstances = quota.instances.in_use + quota.instances.reserved;
  const currentCpus = quota.cores.in_use + quota.cores.reserved;
  const currentRamMb = quota.ram.in_use + quota.ram.reserved;

  // Store metric data with base and buffer separated
  result.instances = {
    label: 'Instances',
    used: currentInstances,
    reserved: 0,
    limit: quota.instances.limit,
    unit: '',
    requested: requestedVms,
    buffer: bufferVms,
    freed: freedVms,
    projected: currentInstances - freedVms + requestedVms + bufferVms,
  };
  result.cpu = {
    label: 'vCPU',
    used: currentCpus,
    reserved: 0,
    limit: quota.cores.limit,
    unit: '',
    requested: requestedCpus,
    buffer: bufferCpus,
    freed: freedCpus,
    projected: currentCpus - freedCpus + requestedCpus + bufferCpus,
  };
  result.ram = {
    label: 'RAM',
    used: currentRamMb,
    reserved: 0,
    limit: quota.ram.limit,
    unit: 'MiB',
    requested: requestedRamMb,
    buffer: bufferRamMb,
    freed: freedRamMb,
    projected: currentRamMb - freedRamMb + requestedRamMb + bufferRamMb,
  };

  // Instance check – freed resources become available for the net request
  if (quota.instances.limit > 0) {
    const available = quota.instances.limit - quota.instances.in_use - quota.instances.reserved + freedVms;
    if (available < neededVms) {
      result.valid = false;
      result.errors.push(
        `Not enough instance quota. Need ${neededVms} additional (incl. rolling update buffer), only ${available} available.`,
      );
    } else if (isLow(available - neededVms, quota.instances.limit)) {
      result.warnings.push(
        `Instance quota is running low after changes: ${available - neededVms} remaining of ${quota.instances.limit}.`,
      );
    }
  }

  // CPU check
  if (quota.cores.limit > 0) {
    const available = quota.cores.limit - quota.cores.in_use - quota.cores.reserved + freedCpus;
    if (available < neededCpus) {
      result.valid = false;
      result.errors.push(
        `Not enough vCPU quota. Need ${neededCpus} additional (incl. rolling update buffer), only ${available} available.`,
      );
    } else if (isLow(available - neededCpus, quota.cores.limit)) {
      result.warnings.push(
        `vCPU quota is running low after changes: ${available - neededCpus} remaining of ${quota.cores.limit}.`,
      );
    }
  }

  // RAM check
  if (quota.ram.limit > 0) {
    const available = quota.ram.limit - quota.ram.in_use - quota.ram.reserved + freedRamMb;
    if (available < neededRamMb) {
      result.valid = false;
      result.errors.push(
        `Not enough RAM quota. Need ${formatRam(neededRamMb)} additional (incl. rolling update buffer), only ${formatRam(available)} available.`,
      );
    } else if (isLow(available - neededRamMb, quota.ram.limit)) {
      result.warnings.push(
        `RAM quota is running low after changes: ${formatRam(available - neededRamMb)} remaining of ${formatRam(quota.ram.limit)}.`,
      );
    }
  }

  // Floating IP check (at minimum 1 for the bastion / API endpoint)
  if (quota.floating_ips && quota.floating_ips.limit > 0) {
    const available = quota.floating_ips.limit - quota.floating_ips.in_use - quota.floating_ips.reserved;
    const needed = req.bastionEnabled ? 1 : 1; // at least one for API endpoint
    if (available < needed) {
      result.valid = false;
      result.errors.push(`Not enough floating IP quota. Need ${needed}, only ${available} available.`);
    }
  }
}

function checkVolumeQuota(
  quota: VolumeQuota,
  req: ClusterRequirements,
  result: QuotaValidationResult,
  existing?: ExistingClusterResources,
): void {
  if (!quota.gigabytes) {
    return;
  }

  const cpNodesBase = req.controlPlaneReplicas;
  const workerNodesBase = req.workerReplicas;
  const bastionNodesBase = req.bastionEnabled ? 1 : 0;

  const baseDiskGb =
    cpNodesBase * (req.controlPlaneRootDiskGb || 0) +
    workerNodesBase * (req.workerRootDiskGb || 0) +
    bastionNodesBase * (req.bastionRootDiskGb || 0);

  // Buffer resources (rolling update: only the largest VM disk)
  const largestVmDiskGb = Math.max(
    req.controlPlaneRootDiskGb || 0,
    req.workerRootDiskGb || 0,
    req.bastionRootDiskGb || 0,
  );
  const bufferDiskGb = largestVmDiskGb;

  // When editing, subtract existing cluster disk usage
  const existDiskGb = existing?.diskGb || 0;
  const requestedDiskGb = Math.max(0, baseDiskGb - existDiskGb);
  const freedDiskGb = Math.max(0, existDiskGb - baseDiskGb);
  const neededDiskGb = requestedDiskGb + bufferDiskGb;

  const currentDiskGb = quota.gigabytes.in_use + quota.gigabytes.reserved;

  result.disk = {
    label: 'Disk Space',
    used: currentDiskGb,
    reserved: 0,
    limit: quota.gigabytes.limit,
    unit: 'GB',
    requested: requestedDiskGb,
    buffer: bufferDiskGb,
    freed: freedDiskGb,
    projected: currentDiskGb - freedDiskGb + requestedDiskGb + bufferDiskGb,
  };

  if (quota.gigabytes.limit > 0) {
    const available = quota.gigabytes.limit - quota.gigabytes.in_use - quota.gigabytes.reserved + freedDiskGb;

    if (available < neededDiskGb) {
      result.valid = false;
      result.errors.push(
        `Not enough storage quota. Need ${neededDiskGb} GB additional (incl. rolling update buffer), only ${available} GB available.`,
      );
    } else if (isLow(available - neededDiskGb, quota.gigabytes.limit)) {
      result.warnings.push(
        `Storage quota is running low after changes: ${available - neededDiskGb} GB remaining of ${quota.gigabytes.limit} GB.`,
      );
    }
  }
}

function checkNetworkQuota(
  quota: NetworkQuota,
  _req: ClusterRequirements,
  result: QuotaValidationResult,
): void {
  // ClusterStacks typically needs 1 network, 1 subnet, 1 router per cluster
  if (quota.network && quota.network.limit > 0) {
    const available = quota.network.limit - quota.network.in_use - quota.network.reserved;
    if (available < 1) {
      result.valid = false;
      result.errors.push(`Not enough network quota. Need 1 additional network, but quota is exhausted.`);
    } else if (isLow(available - 1, quota.network.limit)) {
      result.warnings.push(`Network quota is running low: ${available - 1} networks remaining after cluster.`);
    }
  }

  if (quota.subnet && quota.subnet.limit > 0) {
    const available = quota.subnet.limit - quota.subnet.in_use - quota.subnet.reserved;
    if (available < 1) {
      result.valid = false;
      result.errors.push(`Not enough subnet quota. Need 1 additional subnet, but quota is exhausted.`);
    }
  }

  if (quota.router && quota.router.limit > 0) {
    const available = quota.router.limit - quota.router.in_use - quota.router.reserved;
    if (available < 1) {
      result.valid = false;
      result.errors.push(`Not enough router quota. Need 1 additional router, but quota is exhausted.`);
    }
  }

  if (quota.security_group && quota.security_group.limit > 0) {
    const available = quota.security_group.limit - quota.security_group.in_use - quota.security_group.reserved;
    if (available < 3) {
      result.warnings.push(`Security group quota is running low: ${available} groups available, at least 3 recommended.`);
    }
  }
}

function isLow(remaining: number, limit: number): boolean {
  if (limit <= 0) {
    return false;
  }
  return (remaining / limit) * 100 < WARN_THRESHOLD_PERCENT;
}

function formatRam(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GiB`;
  }
  return `${mb} MiB`;
}
