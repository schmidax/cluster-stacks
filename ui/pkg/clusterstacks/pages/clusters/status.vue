<template>
  <div class="cluster-status-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.clusterStatus.title') }}</h1>
      </div>
      <div class="sub-header">
        <p class="text-muted">
          {{ t('clusterstacks.clusterStatus.description', { name: clusterName }) }}
        </p>
      </div>
      <div class="actions-container">
        <div class="actions">
          <!-- Slot content -->
        </div>
      </div>
    </header>

    <div v-if="!clusterName || !clusterNamespace" class="banner banner-error">
      {{ t('clusterstacks.clusterStatus.invalidContext') }}
    </div>

    <div v-else>
      <div class="status-grid mb-20">
        <div class="status-card">
          <h3>{{ t('clusterstacks.clusterStatus.capiStatus') }}</h3>
          <table class="status-kv">
            <tbody>
              <tr>
                <td class="label">{{ t('clusterstacks.clusters.table.phase') }}</td>
                <td>
                  <BadgeState
                    :color="stateColor(cluster?.status?.phase)"
                    :icon="stateIcon(cluster?.status?.phase)"
                    :label="cluster?.status?.phase || 'Unknown'"
                  />
                </td>
              </tr>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterDetail.cpReady') }}</td>
                <td>
                  <i :class="controlPlaneReady ? 'icon icon-checkmark text-success' : 'icon icon-dot-open text-muted'" />
                  <span class="ml-8">{{ cpReplicaSummary }}</span>
                </td>
              </tr>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterDetail.infraReady') }}</td>
                <td>
                  <i :class="infrastructureReady ? 'icon icon-checkmark text-success' : 'icon icon-dot-open text-muted'" />
                  <span class="ml-8">{{ workerReplicaSummary }}</span>
                </td>
              </tr>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterStatus.observedGeneration') }}</td>
                <td>{{ cluster?.status?.observedGeneration || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="status-card">
          <h3>{{ t('clusterstacks.clusterStatus.importStatus') }}</h3>
          <table class="status-kv">
            <tbody>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterStatus.autoImport') }}</td>
                <td>
                  <BadgeState
                    :color="isImported ? 'bg-success' : 'bg-info'"
                    :icon="isImported ? 'icon-checkmark' : 'icon-spinner icon-spin'"
                    :label="isImported ? t('clusterstacks.clusterStatus.imported') : t('clusterstacks.clusterStatus.waiting')"
                  />
                </td>
              </tr>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterStatus.managementClusterId') }}</td>
                <td><code>{{ managementClusterId || '—' }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="status-card" v-if="isImported">
          <h3>{{ t('clusterstacks.clusterStatus.dashboardAccess') }}</h3>
          <table class="status-kv">
            <tbody>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterStatus.fleetWorkspace') }}</td>
                <td>
                  <BadgeState
                    :color="dashboardAccess.fleetOk ? 'bg-success' : 'bg-warning'"
                    :icon="dashboardAccess.fleetOk ? 'icon-checkmark' : 'icon-warning'"
                    :label="dashboardAccess.fleetOk ? dashboardAccess.fleetValue : t('clusterstacks.clusterStatus.fleetNotSet', { current: dashboardAccess.fleetValue || 'empty', expected: clusterNamespace })"
                  />
                </td>
              </tr>
              <tr>
                <td class="label">{{ t('clusterstacks.clusterStatus.rancherClusterOwner') }}</td>
                <td>
                  <BadgeState
                    :color="dashboardAccess.accessOk ? 'bg-success' : 'bg-warning'"
                    :icon="dashboardAccess.accessOk ? 'icon-checkmark' : 'icon-warning'"
                    :label="dashboardAccess.accessOk ? t('clusterstacks.clusterStatus.statusAssigned') : t('clusterstacks.clusterStatus.statusPending')"
                  />
                </td>
              </tr>
              <tr v-if="!dashboardAccess.accessOk || !dashboardAccess.fleetOk">
                <td colspan="2">
                  <div class="banner banner-warning mt-10">
                    <strong>{{ t('clusterstacks.clusterStatus.syncInProgress') }}</strong>
                    {{ t('clusterstacks.clusterStatus.syncDescription') }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="status-card mb-20" v-if="conditionRows.length">
        <h3>{{ t('clusterstacks.clusterDetail.conditions') }}</h3>
        <SortableTable
          :rows="conditionRows"
          :headers="conditionHeaders"
          key-field="type"
          :search="false"
          :paging="false"
          :table-actions="false"
          :row-actions="false"
        >
          <template #cell:status="{ row }">
            <BadgeState
              :color="row.status === 'True' ? 'bg-success' : 'bg-info'"
              :label="row.status"
            />
          </template>
        </SortableTable>
      </div>
    </div>
  </div>
</template>

<script>
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@rancher/components';
import { getCapiReplicaStatus } from '../../utils/capi-status';

export default {
  name: 'ClusterStatus',

  components: {
    SortableTable,
    BadgeState,
  },

  data() {
    return {
      cluster:              null,
      managementClusterId:  '',
      managementClusterObj: null,
      timer:                null,
      dashboardAccess:      {
        fleetOk:    false,
        fleetValue: '',
        accessOk:   false,
        checked:    false,
      },
      manualFleetWorkspace: '',
      adminCmdCopied:       false,
    };
  },

  computed: {
    clusterName() {
      return this.$route.query?.name || '';
    },

    clusterNamespace() {
      return this.$route.query?.namespace || '';
    },

    isImported() {
      return !!this.managementClusterId;
    },

    capiReplicaStatus() {
      return getCapiReplicaStatus(this.cluster);
    },

    controlPlaneReady() {
      return this.capiReplicaStatus.controlPlaneReady;
    },

    infrastructureReady() {
      return this.capiReplicaStatus.infrastructureReady;
    },

    cpReplicaSummary() {
      return `${ this.capiReplicaStatus.cpReady }/${ this.capiReplicaStatus.cpDesired }`;
    },

    workerReplicaSummary() {
      return `${ this.capiReplicaStatus.workerReady }/${ this.capiReplicaStatus.workerDesired }`;
    },

    conditionRows() {
      const status = this.cluster?.status || {};
      const all = [
        ...(Array.isArray(status.conditions) ? status.conditions : []),
        ...(Array.isArray(status?.v1beta2?.conditions) ? status.v1beta2.conditions : []),
      ];

      return all.map((c) => ({ ...c, id: `${ c.type }-${ c.lastTransitionTime || '' }` }));
    },

    conditionHeaders() {
      return [
        { name: 'type', label: 'Type', value: 'type', sort: ['type'] },
        { name: 'status', label: 'Status', value: 'status', width: 110 },
        { name: 'reason', label: 'Reason', value: 'reason' },
        { name: 'message', label: 'Message', value: 'message' },
      ];
    },

    // Triggers Rancher's native clusterLifecycle.Sync() to auto-create
    // creator-cluster-owner CRTB + scoped ClusterRoleBinding for the user.
    // Source: pkg/controllers/management/auth/project_cluster/cluster_handler.go
    adminAnnotateCmd() {
      const id = this.managementClusterId || '<cluster-id>';
      const authUser = this.$store.getters['auth/user'] || {};
      const userId = authUser?.id || authUser?.metadata?.name || '<user-id>';
      const required = JSON.stringify({ created: [], required: ['cluster-owner'] });

      return `kubectl annotate cluster.management.cattle.io ${ id } \\\n  field.cattle.io/creatorId=${ userId } \\\n  authz.management.cattle.io/creator-role-bindings='${ required }' \\\n  --overwrite`;
    },

    adminFleetCmd() {
      const id = this.managementClusterId || '<cluster-id>';
      const ws = this.manualFleetWorkspace || this.clusterNamespace || '<workspace>';
      const patch = JSON.stringify({ spec: { fleetWorkspaceName: ws } });

      return `kubectl patch cluster.management.cattle.io ${ id } --type=merge -p '${ patch }'`;
    },
  },

  async mounted() {
    await this.refresh();
    this.timer = setInterval(this.refresh, 8000);
  },

  beforeUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },

  methods: {
    hasManagementMethod(type, method) {
      const schema = this.$store.getters['management/schemaFor'](type);
      const methods = schema?.resourceMethods || [];

      return methods.includes(String(method || '').toUpperCase());
    },

    isBlockedLink(link) {
      return /(^\/|\/)blocked(?:\/|$|\?)/.test(String(link || '').trim().toLowerCase());
    },

    async refresh() {
      if (!this.clusterName || !this.clusterNamespace) {
        return;
      }

      await Promise.all([
        this.loadCluster(),
        this.resolveManagementCluster(),
      ]);
    },

    async loadCluster() {
      try {
        this.cluster = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ this.clusterNamespace }/clusters/${ this.clusterName }`,
        });
      } catch {
        this.cluster = null;
      }
    },

    async resolveManagementCluster() {
      try {
        if (!this.hasManagementMethod('management.cattle.io.cluster', 'GET')) {
          this.managementClusterId = '';
          this.managementClusterObj = null;

          return;
        }

        const mgmtClusters = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.cluster',
          opt:  { force: true },
        }) || [];

        const match = mgmtClusters.find((mc) => {
          const labels = mc.metadata?.labels || {};
          const annotations = mc.metadata?.annotations || {};
          const displayName = mc.spec?.displayName || mc.metadata?.name || '';

          return labels['cluster.x-k8s.io/cluster-name'] === this.clusterName
            || annotations['cluster.x-k8s.io/cluster-name'] === this.clusterName
            || displayName === this.clusterName;
        });

        this.managementClusterId = match?.metadata?.name || '';
        this.managementClusterObj = match || null;

        if (!this.manualFleetWorkspace) {
          this.manualFleetWorkspace = match?.spec?.fleetWorkspaceName || this.clusterNamespace;
        }

        if (match) {
          this.checkDashboardAccess(match);
        }
      } catch {
        this.managementClusterId = '';
        this.managementClusterObj = null;
      }
    },

    // Pure read-only status check – no writes, no CRTB creation.
    // Cluster ownership is handled exclusively by Rancher after admin runs
    // CSO Management → Cluster Dashboard Access → Fix (which sets the
    // field.cattle.io/creatorId annotation and triggers native CRTB creation).
    checkDashboardAccess(mgmtCluster) {
      const currentFleet = mgmtCluster.spec?.fleetWorkspaceName || '';

      this.dashboardAccess.fleetValue = currentFleet;
      this.dashboardAccess.fleetOk = currentFleet === this.clusterNamespace;

      // A non-blocked update link means Rancher's cluster-owner CRTB is active,
      // which auto-creates a resourceNames-restricted ClusterRoleBinding.
      const updateLink = String(mgmtCluster.links?.update || '');

      this.dashboardAccess.accessOk = !!(updateLink && !this.isBlockedLink(updateLink));
      this.dashboardAccess.checked = true;
    },

    async copyAdminAnnotateCmd() {
      try {
        await navigator.clipboard.writeText(this.adminAnnotateCmd);
        this.adminCmdCopied = true;
        setTimeout(() => {
          this.adminCmdCopied = false;
        }, 2000);
      } catch {
        // clipboard not available
      }
    },

    stateColor(phase) {
      const map = {
        Provisioned:  'bg-success',
        Provisioning: 'bg-info',
        Deleting:     'bg-warning',
        Failed:       'bg-error',
      };

      return map[phase] || 'bg-info';
    },

    stateIcon(phase) {
      const map = {
        Provisioned:  'icon-checkmark',
        Provisioning: 'icon-spinner icon-spin',
        Deleting:     'icon-warning',
        Failed:       'icon-error',
      };

      return map[phase] || 'icon-dot-open';
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-status-page {
  padding: 20px;
}

header {
  margin-bottom: 20px;
}

.title {
  align-items: center;
  display: flex;
}

header.with-subheader {
  grid-template-areas:
    'type-banner type-banner'
    'title actions'
    'sub-header sub-header'
    'state-banner state-banner';
}

.sub-header {
  grid-area: sub-header;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.status-card {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background: var(--body-bg);
  padding: 14px;

  h3 {
    margin: 0 0 10px;
    font-size: 13px;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.03em;
  }
}

.status-kv {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 6px;
    border-bottom: 1px solid var(--border);
  }

  .label {
    color: var(--muted);
    width: 190px;
  }
}

.status-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.fleet-manual-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.fleet-manual-input {
  min-width: 180px;
  width: 100%;
  max-width: 280px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 0 8px;
  background: var(--body-bg);
  color: var(--body-text);
}

.banner {
  padding: 10px 12px;
  border-radius: var(--border-radius);
}

.banner-error {
  border: 1px solid var(--error, #d4333f);
  background: rgba(212, 51, 63, 0.1);
}

.text-success { color: var(--success); }
.text-muted { color: var(--muted); }
.ml-8 { margin-left: 8px; }
.mb-20 { margin-bottom: 20px; }
</style>
