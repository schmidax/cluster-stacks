import CruClusterStacks from './components/CruClusterStacks.vue';
import { Component } from 'vue';

/**
 * Minimal interface matching Rancher's IClusterProvisioner.
 * At build time, the Rancher Shell resolves these types automatically.
 * Declared here for IDE support without requiring @shell/core/types-provisioning.
 */
interface ClusterProvisionerContext {
  dispatch: any;
  getters: any;
  axios: any;
  $plugin: any;
  $extension: any;
  t: (key: string) => string;
  isCreate: boolean;
  isEdit: boolean;
  isView: boolean;
}

/**
 * ClusterStacks (OpenStack) – Rancher Cluster Provisioner
 *
 * Registers in the standard Rancher "Create Cluster" wizard
 * alongside EKS, GKE, AKS, Custom, etc.
 */
export class ClusterStacksProvisioner {
  static ID = 'clusterstacks-openstack';

  constructor(private context: ClusterProvisionerContext) {}

  get id(): string {
    return ClusterStacksProvisioner.ID;
  }

  get icon(): any {
    return require('./assets/SCS_logo.svg');
  }

  get group(): string {
    return 'custom2';
  }

  get label(): string {
    return this.context.t('clusterstacks.provisioner.label');
  }

  get description(): string {
    return this.context.t('clusterstacks.provisioner.description');
  }

  get component(): Component {
    return CruClusterStacks;
  }

  get hidden(): boolean {
    return false;
  }

  get detailTabs(): any {
    return {
      machines:     false,
      logs:         false,
      registration: false,
      snapshots:    false,
      related:      true,
      events:       true,
      conditions:   true,
    };
  }
}
