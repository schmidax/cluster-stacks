// TypeScript interfaces for ClusterStack CRDs

export interface ObjectMeta {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  resourceVersion?: string;
  uid?: string;
}

export interface Condition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

// clusterstack.x-k8s.io/v1alpha1

export interface ClusterStack {
  apiVersion: 'clusterstack.x-k8s.io/v1alpha1';
  kind: 'ClusterStack';
  metadata: ObjectMeta;
  spec: ClusterStackSpec;
  status?: ClusterStackStatus;
}

export interface ClusterStackSpec {
  provider: string;
  name: string;
  kubernetesVersion: string;
  channel: 'stable' | 'custom';
  autoSubscribe: boolean;
  noProvider?: boolean;
  versions?: string[];
}

export interface ClusterStackStatus {
  conditions?: Condition[];
  usableVersions?: string[];
  summary?: string;
}

export interface ClusterStackRelease {
  apiVersion: 'clusterstack.x-k8s.io/v1alpha1';
  kind: 'ClusterStackRelease';
  metadata: ObjectMeta;
  spec: ClusterStackReleaseSpec;
  status?: ClusterStackReleaseStatus;
}

export interface ClusterStackReleaseSpec {
  clusterStack: string;
}

export interface ClusterStackReleaseStatus {
  conditions?: Condition[];
  ready?: boolean;
  kubernetesVersion?: string;
}

// cluster.x-k8s.io/v1beta1

export interface ClusterClass {
  apiVersion: 'cluster.x-k8s.io/v1beta1';
  kind: 'ClusterClass';
  metadata: ObjectMeta;
  spec: ClusterClassSpec;
  status?: ClusterClassStatus;
}

export interface ClusterClassSpec {
  infrastructure?: {
    ref: {
      apiVersion: string;
      kind: string;
      name: string;
      namespace: string;
    };
  };
  controlPlane?: {
    ref: {
      apiVersion: string;
      kind: string;
      name: string;
      namespace: string;
    };
  };
  workers?: {
    machineDeployments?: MachineDeploymentClass[];
  };
  variables?: ClusterClassVariable[];
  patches?: ClusterClassPatch[];
}

export interface ClusterClassStatus {
  conditions?: Condition[];
  observedGeneration?: number;
  variables?: Record<string, any>;
}

export interface MachineDeploymentClass {
  class: string;
  template: {
    infrastructure: {
      ref: {
        apiVersion: string;
        kind: string;
        name: string;
        namespace: string;
      };
    };
    bootstrap?: {
      ref: {
        apiVersion: string;
        kind: string;
        name: string;
        namespace: string;
      };
    };
  };
}

export interface ClusterClassVariable {
  name: string;
  required: boolean;
  schema: {
    openAPIV3Schema: Record<string, any>;
  };
}

export interface ClusterClassPatch {
  name: string;
  definitions?: any[];
  enabledIf?: string;
}

export interface Cluster {
  apiVersion: 'cluster.x-k8s.io/v1beta1';
  kind: 'Cluster';
  metadata: ObjectMeta;
  spec: ClusterSpec;
  status?: ClusterStatus;
}

export interface ClusterSpec {
  clusterNetwork?: {
    pods?: { cidrBlocks: string[] };
    services?: { cidrBlocks: string[] };
  };
  topology?: ClusterTopology;
  infrastructureRef?: {
    apiVersion: string;
    kind: string;
    name: string;
    namespace: string;
  };
  controlPlaneRef?: {
    apiVersion: string;
    kind: string;
    name: string;
    namespace: string;
  };
}

export interface ClusterTopology {
  class: string;
  version: string;
  controlPlane?: {
    replicas?: number;
    metadata?: ObjectMeta;
  };
  workers?: {
    machineDeployments?: MachineDeploymentTopology[];
  };
  variables?: ClusterVariable[];
}

export interface MachineDeploymentTopology {
  class: string;
  name: string;
  replicas?: number;
  metadata?: ObjectMeta;
}

export interface ClusterVariable {
  name: string;
  value: any;
}

export interface ClusterStatus {
  conditions?: Condition[];
  phase?: string;
  infrastructureReady?: boolean;
  controlPlaneReady?: boolean;
  observedGeneration?: number;
}

// ClusterStacks OpenStack variables (passed via ClusterTopology.variables)
export interface ClusterStacksOpenstackVariables {
  externalNetworkId: string;
  imageName: string;
  controlPlaneFlavor: string;
  workerFlavor: string;
  bastionFlavor?: string;
  bastionEnabled: boolean;
  workerReplicas: number;
  controlPlaneReplicas: number;
  dnsNameservers?: string[];
  etcdBackupEnabled?: boolean;
  etcdBackupS3BucketName?: string;
  etcdBackupS3Endpoint?: string;
  etcdBackupS3AccessKeyId?: string;
  etcdBackupS3SecretAccessKey?: string;
}
