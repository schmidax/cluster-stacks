function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);

  return Number.isFinite(num) ? num : fallback;
}

type AnyRecord = Record<string, any>;

function conditionIsTrue(cluster: AnyRecord | null | undefined, types: string[] = []): boolean {
  const status = cluster?.status || {};
  const allConditions = [
    ...(Array.isArray(status.conditions) ? status.conditions : []),
    ...(Array.isArray(status?.v1beta2?.conditions) ? status.v1beta2.conditions : []),
  ];

  for (const type of types) {
    const cond = allConditions.find((c: AnyRecord) => c?.type === type);

    if (cond?.status === 'True') {
      return true;
    }
  }

  return false;
}

export function getCapiReplicaStatus(cluster: AnyRecord | null | undefined) {
  const spec = cluster?.spec || {};
  const topology = spec?.topology || {};
  const status = cluster?.status || {};
  const v1beta2 = status?.v1beta2 || {};

  const cpStatus = v1beta2?.controlPlane || status?.controlPlane || {};
  const workerStatus = v1beta2?.workers || status?.workers || {};

  const cpDesiredFromTopology = asNumber(topology?.controlPlane?.replicas, 0);
  const workerDesiredFromTopology = (topology?.workers?.machineDeployments || []).reduce(
    (sum: number, md: AnyRecord) => sum + asNumber(md?.replicas, 0),
    0,
  );

  const cpDesired = asNumber(cpStatus?.replicas, cpDesiredFromTopology);
  const cpReady = asNumber(cpStatus?.readyReplicas, asNumber(cpStatus?.availableReplicas, -1));

  const workerDesired = asNumber(workerStatus?.replicas, workerDesiredFromTopology);
  const workerReady = asNumber(workerStatus?.readyReplicas, asNumber(workerStatus?.availableReplicas, -1));

  const controlPlaneReady = cpReady >= 0
    ? (cpDesired > 0 ? cpReady >= cpDesired : cpReady > 0)
    : (typeof status?.controlPlaneReady === 'boolean'
      ? status.controlPlaneReady
      : conditionIsTrue(cluster, ['ControlPlaneReady', 'ControlPlaneAvailable']));

  const infrastructureReady = workerReady >= 0
    ? (workerDesired > 0 ? workerReady >= workerDesired : workerReady > 0)
    : (typeof status?.infrastructureReady === 'boolean'
      ? status.infrastructureReady
      : conditionIsTrue(cluster, ['InfrastructureReady', 'InfrastructureClusterReady', 'WorkersAvailable']));

  return {
    cpDesired,
    cpReady: cpReady >= 0 ? cpReady : (controlPlaneReady ? cpDesired : 0),
    workerDesired,
    workerReady: workerReady >= 0 ? workerReady : (infrastructureReady ? workerDesired : 0),
    controlPlaneReady,
    infrastructureReady,
  };
}
