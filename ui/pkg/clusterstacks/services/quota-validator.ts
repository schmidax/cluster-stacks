/**
 * OpenStack Quota Validator for ClusterStacks.
 *
 * Fetches current quota usage and validates whether a new cluster can be
 * created given the requested configuration. Also accounts for rolling
 * update headroom (+1 control plane node, +1 worker node).
 */

import { OpenStackApiService } from './openstack-api';
import { OpenStackQuota, NetworkQuota } from '../types/openstack';

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
}

export interface QuotaValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// Rolling-update headroom: keep enough spare capacity for +1 of each
const ROLLING_UPDATE_BUFFER = 1;

// Warn when remaining quota (after allocation) falls below this percentage
const WARN_THRESHOLD_PERCENT = 15;

export async function validateQuota(
  api: OpenStackApiService,
  requirements: ClusterRequirements,
  projectId?: string,
): Promise<QuotaValidationResult> {
  const result: QuotaValidationResult = {
    valid:    true,
    warnings: [],
    errors:   [],
  };

  let computeQuota: OpenStackQuota | null = null;
  let networkQuota: NetworkQuota | null = null;

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

  if (computeQuota) {
    checkComputeQuota(computeQuota, requirements, result);
  }

  if (networkQuota) {
    checkNetworkQuota(networkQuota, requirements, result);
  }

  return result;
}

function checkComputeQuota(
  quota: OpenStackQuota,
  req: ClusterRequirements,
  result: QuotaValidationResult,
): void {
  // Total VMs needed including rolling-update buffer
  const cpNodes = req.controlPlaneReplicas + ROLLING_UPDATE_BUFFER;
  const workerNodes = req.workerReplicas + ROLLING_UPDATE_BUFFER;
  const bastionNodes = req.bastionEnabled ? 1 : 0;
  const totalVms = cpNodes + workerNodes + bastionNodes;

  // Total vCPUs needed
  const totalCpus =
    cpNodes * req.controlPlaneCpus +
    workerNodes * req.workerCpus +
    bastionNodes * (req.bastionCpus || 0);

  // Total RAM needed (MiB)
  const totalRamMb =
    cpNodes * req.controlPlaneRamMb +
    workerNodes * req.workerRamMb +
    bastionNodes * (req.bastionRamMb || 0);

  // Instance check
  if (quota.instances.limit > 0) {
    const available = quota.instances.limit - quota.instances.in_use - quota.instances.reserved;
    if (available < totalVms) {
      result.valid = false;
      result.errors.push(
        `Not enough instance quota. Need ${totalVms} (incl. rolling update buffer), only ${available} available.`,
      );
    } else if (isLow(available - totalVms, quota.instances.limit)) {
      result.warnings.push(
        `Instance quota is running low after cluster creation: ${available - totalVms} remaining of ${quota.instances.limit}.`,
      );
    }
  }

  // CPU check
  if (quota.cores.limit > 0) {
    const available = quota.cores.limit - quota.cores.in_use - quota.cores.reserved;
    if (available < totalCpus) {
      result.valid = false;
      result.errors.push(
        `Not enough vCPU quota. Need ${totalCpus} (incl. rolling update buffer), only ${available} available.`,
      );
    } else if (isLow(available - totalCpus, quota.cores.limit)) {
      result.warnings.push(
        `vCPU quota is running low after cluster creation: ${available - totalCpus} remaining of ${quota.cores.limit}.`,
      );
    }
  }

  // RAM check
  if (quota.ram.limit > 0) {
    const available = quota.ram.limit - quota.ram.in_use - quota.ram.reserved;
    if (available < totalRamMb) {
      result.valid = false;
      result.errors.push(
        `Not enough RAM quota. Need ${formatRam(totalRamMb)} (incl. rolling update buffer), only ${formatRam(available)} available.`,
      );
    } else if (isLow(available - totalRamMb, quota.ram.limit)) {
      result.warnings.push(
        `RAM quota is running low after cluster creation: ${formatRam(available - totalRamMb)} remaining of ${formatRam(quota.ram.limit)}.`,
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
