<template>
  <div class="cluster-detail-page">
    <!-- ═══ HEADER (Rancher-style with badge + actions) ═══ -->
    <header class="with-subheader detail-masthead">
      <div class="title">
        <div class="masthead-left">
          <button class="btn btn-sm role-link mr-10" @click="goBack">
            <i class="icon icon-chevron-left" /> {{ t('clusterstacks.clusters.title') }}
          </button>
          <div class="masthead-title">
            <h1 class="m-0">{{ clusterName }}</h1>
            <BadgeState
              v-if="cluster"
              :color="stateColor(cluster.status?.phase)"
              :icon="stateIcon(cluster.status?.phase)"
              :label="cluster.status?.phase || 'Unknown'"
            />
          </div>
        </div>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container align-start">
        <div class="actions masthead-actions">
          <button class="btn role-secondary" @click="exploreCluster">
            <i class="icon icon-external-link" /> {{ t('clusterstacks.clusters.actions.explore') }}
          </button>
          <button class="btn role-secondary" @click="downloadKubeconfig">
            <i class="icon icon-download" /> {{ t('clusterstacks.clusters.actions.downloadKubeconfig') }}
          </button>
          <button class="btn role-primary" :disabled="isFleetManagedCluster" :title="isFleetManagedCluster ? FLEET_MANAGED_TOOLTIP : ''" @click="editCluster">
            <i class="icon icon-edit" /> {{ t('clusterstacks.common.edit') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Key-value summary bar (Rancher DetailTop style) -->
    <div v-if="cluster" class="detail-top">
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.namespace') }}</label>
        <span>{{ cluster.metadata.namespace }}</span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusterDetail.clusterClass') }}</label>
        <span><code>{{ topology?.classRef?.name || topology?.class || '—' }}</code></span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.version') }}</label>
        <span><code>{{ topology?.version || '—' }}</code></span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.provider') }}</label>
        <span>{{ extractProvider(topology?.classRef?.name || topology?.class) || '—' }}</span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusterDetail.created') }}</label>
        <span>{{ formatDate(cluster.metadata.creationTimestamp) }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <template v-else-if="cluster">
      <!-- ═══ TABS (Rancher Tabbed component) ═══ -->
      <Tabbed :default-tab="activeTab" :use-hash="false">
        <!-- ─── OVERVIEW TAB ──────────────────────── -->
        <Tab name="overview" :label="t('clusterstacks.clusterDetail.tabs.overview')" :weight="40">
          <!-- Status overview cards -->
          <div class="detail-grid">
            <div class="detail-card">
              <h3>{{ t('clusterstacks.clusterDetail.statusInfo') }}</h3>
              <table class="detail-kv">
                <tbody>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusters.table.phase') }}</td>
                    <td>
                      <BadgeState
                        :color="stateColor(cluster.status?.phase)"
                        :label="cluster.status?.phase || 'Unknown'"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.cpReady') }}</td>
                    <td>
                      <i :class="controlPlaneReady ? 'icon icon-checkmark text-success' : 'icon icon-warning text-warning'" />
                      {{ controlPlaneReady ? t('clusterstacks.common.yes') : t('clusterstacks.common.no') }}
                      <span class="replica-note">({{ controlPlaneReplicaSummary }})</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.infraReady') }}</td>
                    <td>
                      <i :class="infrastructureReady ? 'icon icon-checkmark text-success' : 'icon icon-warning text-warning'" />
                      {{ infrastructureReady ? t('clusterstacks.common.yes') : t('clusterstacks.common.no') }}
                      <span class="replica-note">({{ workerReplicaSummary }})</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.cpReplicas') }}</td>
                    <td>{{ capiReplicaStatus.cpDesired }}</td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.workerReplicas') }}</td>
                    <td>{{ totalWorkerReplicas }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="detail-card">
              <h3>{{ t('clusterstacks.clusterDetail.controlPlaneDetail') }}</h3>
              <table class="detail-kv">
                <tbody>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.replicas') }}</td>
                    <td>{{ topology?.controlPlane?.replicas || 0 }}</td>
                  </tr>
                  <tr v-if="varsMap.controlPlaneFlavor">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.flavor') }}</td>
                    <td><code>{{ varsMap.controlPlaneFlavor }}</code></td>
                  </tr>
                  <tr v-if="varsMap.controlPlaneRootDisk">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.rootDisk') }}</td>
                    <td>{{ varsMap.controlPlaneRootDisk }} GiB</td>
                  </tr>
                  <tr v-if="varsMap.clusterCNI">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.cni') }}</td>
                    <td><code>{{ varsMap.clusterCNI }}</code></td>
                  </tr>
                  <tr v-if="varsMap.apiServerLoadBalancer">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.apiServerLB') }}</td>
                    <td><code>{{ varsMap.apiServerLoadBalancer }}</code></td>
                  </tr>
                  <tr v-if="varsMap.imageName">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.image') }}</td>
                    <td><code>{{ varsMap.imageName }}</code></td>
                  </tr>
                  <tr v-if="varsMap.sshKeyName">
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.sshKey') }}</td>
                    <td><code>{{ varsMap.sshKeyName }}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Worker Pool Details -->
          <div class="section-header">
            <h3>{{ t('clusterstacks.clusterDetail.workerPoolsDetail') }}</h3>
          </div>
          <SortableTable
            v-if="workerPoolRows.length"
            :rows="workerPoolRows"
            :headers="workerPoolHeaders"
            key-field="id"
            :search="false"
            :paging="false"
            :table-actions="false"
            :row-actions="false"
          >
            <template #cell:name="{ row }">
              <code>{{ row.name }}</code>
            </template>
            <template #cell:class="{ row }">
              <code>{{ row.class || '—' }}</code>
            </template>
            <template #cell:overrides="{ row }">
              <code>{{ row.overrides || '—' }}</code>
            </template>
          </SortableTable>
          <div v-else class="empty-state">{{ t('clusterstacks.clusterDetail.noWorkerPools') }}</div>

          <!-- Conditions -->
          <div class="section-header">
            <h3>{{ t('clusterstacks.clusterDetail.conditions') }}</h3>
          </div>
          <SortableTable
            v-if="conditions.length"
            :rows="conditions"
            :headers="conditionHeaders"
            key-field="type"
            :search="false"
            :paging="false"
            :table-actions="false"
            :row-actions="false"
          >
            <template #cell:status="{ row }">
              <BadgeState
                :color="row.status === 'True' ? 'bg-success' : 'bg-warning'"
                :label="row.status"
              />
            </template>
            <template #cell:message="{ row }">
              <span class="condition-message">{{ row.message || '—' }}</span>
            </template>
          </SortableTable>
          <div v-else class="empty-state">{{ t('clusterstacks.clusterDetail.noConditions') }}</div>
        </Tab>

        <Tab name="clusterstacks" :label="t('clusterstacks.clusterDetail.tabs.clusterstacks')" :weight="15">
          <div class="detail-grid">
            <div class="detail-card">
              <h3>{{ t('clusterstacks.clusterDetail.clusterStacksInfo') }}</h3>
              <table class="detail-kv">
                <tbody>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.class') }}</td>
                    <td><code>{{ topology?.classRef?.name || topology?.class || '—' }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.classNamespace') }}</td>
                    <td><code>{{ topology?.classRef?.namespace || topology?.classNamespace || '—' }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.namespace') }}</td>
                    <td><code>{{ cluster?.metadata?.namespace || '—' }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.managedSecret') }}</td>
                    <td><code>{{ cluster?.metadata?.labels?.['managed-secret'] || '—' }}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="detail-card">
              <h3>{{ t('clusterstacks.clusterDetail.clusterNetwork') }}</h3>
              <table class="detail-kv">
                <tbody>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.podsCidr') }}</td>
                    <td><code>{{ clusterNetworkPodsCidr }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.servicesCidr') }}</td>
                    <td><code>{{ clusterNetworkServicesCidr }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.serviceDomain') }}</td>
                    <td><code>{{ clusterNetworkServiceDomain }}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Tab>

        <!-- ─── VARIABLES TAB ─────────────────────── -->
        <Tab name="variables" :label="t('clusterstacks.clusterDetail.tabs.variables')" :weight="30">
          <SortableTable
            v-if="variableRows.length"
            :rows="variableRows"
            :headers="variableHeaders"
            key-field="id"
            :search="true"
            :paging="true"
            :rows-per-page="20"
            :table-actions="false"
            :row-actions="false"
          >
            <template #cell:name="{ row }">
              <code>{{ row.name }}</code>
            </template>
            <template #cell:preview="{ row }">
              <code>{{ row.preview }}</code>
            </template>
            <template #cell:valueYaml="{ row }">
              <pre class="yaml-inline">{{ row.valueYaml }}</pre>
            </template>
          </SortableTable>
          <div v-else class="empty-state">{{ t('clusterstacks.clusterDetail.noVariables') }}</div>
        </Tab>

        <!-- ─── SNAPSHOTS TAB ─────────────────────── -->
        <Tab name="snapshots" :label="t('clusterstacks.clusterDetail.tabs.snapshots')" :weight="20">
          <!-- Action bar -->
          <div class="snapshot-actions">
            <button
              v-clean-tooltip="t('clusterstacks.clusterDetail.snapshots.snapshotWip')"
              class="btn btn-sm role-primary"
              disabled
            >
              <i class="icon icon-backup" />
              {{ t('clusterstacks.clusterDetail.snapshots.takeSnapshot') }}
            </button>
            <button class="btn btn-sm role-secondary" @click="loadSnapshots">
              <i class="icon icon-refresh" />
            </button>
          </div>

          <!-- ETCD Backup configuration from cluster variables -->
          <div v-if="etcdBackupConfig" class="detail-card mb-20">
            <h4>{{ t('clusterstacks.clusterDetail.snapshots.backupConfig') }}</h4>
            <table class="detail-kv">
              <tbody>
                <tr>
                  <td class="kv-label">{{ t('clusterstacks.clusterDetail.snapshots.enabled') }}</td>
                  <td>
                    <i :class="etcdBackupConfig.enabled ? 'icon icon-checkmark text-success' : 'icon icon-x text-muted'" />
                    {{ etcdBackupConfig.enabled ? t('clusterstacks.common.yes') : t('clusterstacks.common.no') }}
                  </td>
                </tr>
                <tr v-if="etcdBackupConfig.endpoint">
                  <td class="kv-label">{{ t('clusterstacks.clusterCreate.etcdBackup.endpoint') }}</td>
                  <td><code>{{ etcdBackupConfig.endpoint }}</code></td>
                </tr>
                <tr v-if="etcdBackupConfig.region">
                  <td class="kv-label">{{ t('clusterstacks.clusterCreate.etcdBackup.region') }}</td>
                  <td><code>{{ etcdBackupConfig.region }}</code></td>
                </tr>
                <tr v-if="etcdBackupConfig.bucket">
                  <td class="kv-label">{{ t('clusterstacks.clusterCreate.etcdBackup.bucket') }}</td>
                  <td><code>{{ etcdBackupConfig.bucket }}</code></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="snapshotError" class="banner bg-error mb-10">{{ snapshotError }}</div>

          <!-- Snapshot list -->
          <div v-if="loadingSnapshots" class="loading-placeholder">
            <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
          </div>

          <SortableTable
            v-else-if="snapshotRows.length"
            :rows="snapshotRows"
            :headers="snapshotHeaders"
            key-field="id"
            default-sort-by="created"
            :search="false"
            :paging="true"
            :rows-per-page="10"
            :table-actions="false"
            :row-actions="false"
          >
            <template #cell:status="{ row }">
              <BadgeState
                :color="snapshotStateColor(row.status)"
                :label="row.status"
              />
            </template>
            <template #cell:size="{ row }">
              {{ row.size || '—' }}
            </template>
          </SortableTable>

          <div v-else class="empty-state">
            <p>{{ t('clusterstacks.clusterDetail.snapshots.noData') }}</p>
            <p class="text-muted mt-5">{{ t('clusterstacks.clusterDetail.snapshots.capiHint') }}</p>
          </div>
        </Tab>

        <!-- ─── YAML TAB ─────────────────────────── -->
        <Tab name="yaml" :label="t('clusterstacks.clusterDetail.tabs.yaml')" :weight="10" class="yaml-tab">
          <div class="yaml-header">
            <button v-if="!yamlEditing" class="btn btn-sm role-secondary" :disabled="isFleetManagedCluster" :title="isFleetManagedCluster ? FLEET_MANAGED_TOOLTIP : ''" @click="startYamlEdit">
              <i class="icon icon-edit" /> {{ t('clusterstacks.common.edit') }}
            </button>
            <div v-else class="yaml-edit-actions">
              <button class="btn btn-sm role-secondary" @click="cancelYamlEdit">
                {{ t('clusterstacks.common.cancel') }}
              </button>
              <button class="btn btn-sm role-primary" :disabled="yamlSaving || isFleetManagedCluster" :title="isFleetManagedCluster ? FLEET_MANAGED_TOOLTIP : ''" @click="saveYamlEdit">
                <i v-if="yamlSaving" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.clusterCreate.save') }}
              </button>
            </div>
          </div>
          <div v-if="yamlError" class="banner bg-error mb-10">{{ yamlError }}</div>

          <div class="yaml-editor-wrapper">
            <YamlEditor
              v-if="yamlEditing"
              :value="yamlEditContent"
              :editor-mode="EDITOR_MODES.EDIT_CODE"
              class="yaml-editor"
              @onInput="onYamlInput"
            />
            <pre v-else class="yaml-view">{{ clusterYaml }}</pre>
          </div>
        </Tab>
      </Tabbed>
    </template>

    <div v-else class="empty-state lg">
      {{ t('clusterstacks.clusterDetail.notFound') }}
    </div>
  </div>
</template>

<script>
import SortableTable from '@shell/components/SortableTable';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import YamlEditor, { EDITOR_MODES } from '@shell/components/YamlEditor';
import { BadgeState } from '@rancher/components';
import jsyaml from 'js-yaml';
import { ROUTES } from '../../config/clusterstacks';
import { getCapiReplicaStatus } from '../../utils/capi-status';
import { FLEET_MANAGED_TOOLTIP, isFleetManagedResource } from '../../utils/fleet-management';

export default {
  name: 'ClusterDetail',

  components: {
    SortableTable,
    Tabbed,
    Tab,
    YamlEditor,
    BadgeState,
  },

  data() {
    return {
      EDITOR_MODES,

      cluster:         null,
      loading:         false,

      snapshots:          [],
      loadingSnapshots:   false,
      snapshotError:      null,

      // Management cluster mapping (for explore/kubeconfig)
      managementClusterId: null,

      // YAML edit
      yamlEditing:     false,
      yamlEditContent: '',
      yamlSaving:      false,
      yamlError:       null,

      refreshTimer: null,
    };
  },

  computed: {
    FLEET_MANAGED_TOOLTIP() {
      return FLEET_MANAGED_TOOLTIP;
    },

    isFleetManagedCluster() {
      return isFleetManagedResource(this.cluster);
    },

    clusterName() {
      return this.$route.query.name || '';
    },

    clusterNamespace() {
      return this.$route.query.namespace || '';
    },

    topology() {
      return this.cluster?.spec?.topology;
    },

    topologyVariables() {
      return this.topology?.variables || [];
    },

    variableRows() {
      return this.topologyVariables.map((v) => ({
        id:       v.name,
        name:     v.name,
        type:     this.varType(v.value),
        preview:  this.varPreview(v.value),
        valueYaml: this.toYaml(v.value),
      }));
    },

    workerPoolRows() {
      return this.workerPools.map((pool, idx) => {
        const overrides = (pool.variables?.overrides || [])
          .map((ov) => `${ ov.name }=${ this.formatVarValue(ov.value) }`)
          .join(', ');

        return {
          id:        `${ pool.name || 'pool' }-${ idx }`,
          name:      pool.name || `pool-${ idx + 1 }`,
          class:     pool.class || '',
          replicas:  pool.replicas ?? 0,
          overrides,
        };
      });
    },

    activeTab() {
      const tab = String(this.$route.query?.tab || '').trim();
      const allowed = new Set(['overview', 'variables', 'snapshots', 'clusterstacks', 'yaml']);

      if (allowed.has(tab)) {
        return tab;
      }

      return 'overview';
    },

    varsMap() {
      const map = {};

      for (const v of this.topologyVariables) {
        map[v.name] = v.value;
      }

      return map;
    },

    workerPools() {
      return this.topology?.workers?.machineDeployments || [];
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

    controlPlaneReplicaSummary() {
      return `${ this.capiReplicaStatus.cpReady }/${ this.capiReplicaStatus.cpDesired }`;
    },

    workerReplicaSummary() {
      return `${ this.capiReplicaStatus.workerReady }/${ this.capiReplicaStatus.workerDesired }`;
    },

    totalWorkerReplicas() {
      return this.capiReplicaStatus.workerDesired;
    },

    conditions() {
      return (this.cluster?.status?.conditions || []).map((c) => ({
        ...c,
        id: c.type,
      }));
    },

    etcdBackupConfig() {
      const etcd = this.varsMap.controlPlaneETCDBackupS3;

      if (!etcd) {
        return null;
      }

      return {
        enabled:  etcd.enabled || false,
        endpoint: etcd.endpoint || '',
        region:   etcd.region || '',
        bucket:   etcd.bucket || '',
      };
    },

    clusterNetworkPodsCidr() {
      return this.cluster?.spec?.clusterNetwork?.pods?.cidrBlocks?.[0] || '—';
    },

    clusterNetworkServicesCidr() {
      return this.cluster?.spec?.clusterNetwork?.services?.cidrBlocks?.[0] || '—';
    },

    clusterNetworkServiceDomain() {
      return this.cluster?.spec?.clusterNetwork?.serviceDomain || '—';
    },

    clusterYaml() {
      if (!this.cluster) {
        return '';
      }
      try {
        const clean = this.cleanForYaml(this.cluster);

        return jsyaml.dump(clean, { indent: 2, lineWidth: -1, noRefs: true });
      } catch {
        return '# Error converting to YAML';
      }
    },

    conditionHeaders() {
      return [
        { name: 'type',               label: 'Type',               value: 'type', sort: ['type'] },
        { name: 'status',             label: 'Status',             value: 'status', sort: ['status'], width: 100 },
        { name: 'reason',             label: 'Reason',             value: 'reason' },
        { name: 'message',            label: 'Message',            value: 'message' },
        { name: 'lastTransitionTime', label: 'Last Transition',    value: 'lastTransitionTime', width: 200 },
      ];
    },

    variableHeaders() {
      return [
        {
          name:     'name',
          label:    this.t('clusterstacks.clusterDetail.varName'),
          value:    'name',
          sort:     ['name'],
          width:    220,
        },
        {
          name:     'type',
          label:    this.t('clusterstacks.clusterDetail.varType'),
          value:    'type',
          sort:     ['type'],
          width:    120,
        },
        {
          name:     'preview',
          label:    this.t('clusterstacks.clusterDetail.varPreview'),
          value:    'preview',
          sort:     false,
        },
        {
          name:     'valueYaml',
          label:    'YAML',
          value:    'valueYaml',
          sort:     false,
          search:   false,
        },
      ];
    },

    workerPoolHeaders() {
      return [
        { name: 'name',      label: 'Name',      value: 'name', sort: ['name'] },
        { name: 'class',     label: 'Class',     value: 'class' },
        { name: 'replicas',  label: 'Replicas',  value: 'replicas', width: 120 },
        { name: 'overrides', label: 'Overrides', value: 'overrides', sort: false },
      ];
    },

    snapshotHeaders() {
      return [
        { name: 'name',    label: 'Name',    value: 'name', sort: ['name'] },
        { name: 'status',  label: 'Status',  value: 'status', width: 120 },
        { name: 'created', label: 'Created', value: 'created', sort: ['created:desc'], width: 200 },
        { name: 'size',    label: 'Size',    value: 'size', width: 100 },
      ];
    },

    snapshotRows() {
      return this.snapshots.map((s) => {
        // Extract size — k3s.cattle.io ETCDSnapshotFile stores size in status.size or spec.snapshotSize
        let sizeStr = '—';

        if (s.status?.size) {
          sizeStr = `${ Math.round(s.status.size / 1024 / 1024) } MiB`;
        } else if (s.status?.snapshotSize) {
          sizeStr = `${ Math.round(s.status.snapshotSize / 1024 / 1024) } MiB`;
        } else if (s.snapshotFile?.size) {
          sizeStr = `${ Math.round(s.snapshotFile.size / 1024 / 1024) } MiB`;
        }

        const row = {
          id:      s.metadata?.uid || s.metadata?.name,
          name:    s.spec?.snapshotName || s.metadata?.name || s.name || '',
          status:  this.resolveSnapshotStatus(s),
          created: s.metadata?.creationTimestamp || s.createdAt || '',
          size:    sizeStr,
          raw:     s,
        };

        row.availableActions = [];

        return row;
      });
    },
  },

  async mounted() {
    await this.load();
    this.refreshTimer = setInterval(() => this.load(true), 15000);
  },

  beforeUnmount() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  },

  methods: {
    async load(silent = false) {
      if (!this.clusterName || !this.clusterNamespace) {
        return;
      }

      if (!silent) {
        this.loading = true;
      }

      try {
        this.cluster = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ this.clusterNamespace }/clusters/${ this.clusterName }`,
        });
      } catch (e) {
        if (!silent) {
          this.cluster = null;
        }
      } finally {
        if (!silent) {
          this.loading = false;
        }
      }

      // Resolve management cluster ID (for explore / kubeconfig)
      await this.resolveManagementCluster();

      // Load snapshots
      await this.loadSnapshots();
    },

    /**
     * Find the Rancher management cluster that corresponds to this CAPI cluster.
     */
    async resolveManagementCluster() {
      if (this.managementClusterId) {
        return;
      }

      try {
        let mgmtClusters;

        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/apis/management.cattle.io/v3/clusters',
          });

          mgmtClusters = resp?.items || [];
        } catch {
          const result = await this.$store.dispatch('management/findAll', { type: 'management.cattle.io.cluster' });

          mgmtClusters = Array.isArray(result) ? result : (result?.data || []);
        }

        for (const mc of mgmtClusters) {
          const labels = mc.metadata?.labels || {};
          const annotations = mc.metadata?.annotations || {};
          const displayName = mc.spec?.displayName || '';

          if (
            labels['cluster.x-k8s.io/cluster-name'] === this.clusterName ||
            annotations['cluster.x-k8s.io/cluster-name'] === this.clusterName ||
            displayName === this.clusterName ||
            mc.metadata?.name === this.clusterName
          ) {
            this.managementClusterId = mc.id || mc.metadata?.name;
            break;
          }
        }
      } catch {
        // Management clusters may not be accessible
      }
    },

    /**
     * Load ETCD snapshots from multiple API sources.
     * Strategy (ordered by priority):
     *   1. Downstream cluster proxy — k3s.cattle.io/v1 etcdsnapshotfiles (local RKE2 snapshots)
     *   2. k3s.cattle.io/v1 ETCDSnapshotFile on management cluster (cluster-scoped)
     *   3. rke.cattle.io/v1 ETCDSnapshot (legacy RKE1 fallback)
     *   4. Rancher v3 etcdbackups
     */
    async loadSnapshots() {
      this.loadingSnapshots = true;
      this.snapshots = [];
      this.snapshotError = null;

      const rancherClusterName = this.cluster?.metadata?.labels?.['cluster.x-k8s.io/cluster-name'] || this.clusterName;
      let found = false;

      try {
        // ── Attempt 1: Downstream cluster proxy — local RKE2/k3s ETCDSnapshotFile ──
        // ETCDSnapshotFile is a cluster-scoped CRD on the downstream cluster itself,
        // not the Rancher management cluster. Must go via the proxy.
        if (!found && this.managementClusterId) {
          try {
            const clusterId = this.managementClusterId.includes('/')
              ? this.managementClusterId.split('/').pop()
              : this.managementClusterId;
            const result = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/k8s/clusters/${ clusterId }/apis/k3s.cattle.io/v1/etcdsnapshotfiles`,
            });
            const items = result?.items || [];

            if (items.length) {
              this.snapshots = items;
              found = true;
            }
          } catch {
            // Downstream proxy not available or CRD not installed on that cluster
          }
        }

        // ── Attempt 2: k3s.cattle.io/v1 ETCDSnapshotFile on management cluster ──
        if (!found) {
          try {
            const result = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/apis/k3s.cattle.io/v1/etcdsnapshotfiles`,
            });
            const items = result?.items || [];
            const filtered = items.filter((s) => {
              const labels = s.metadata?.labels || {};
              const name = s.metadata?.name || '';

              return labels['cluster.x-k8s.io/cluster-name'] === rancherClusterName ||
                     labels['rke.cattle.io/cluster-name'] === rancherClusterName ||
                     name.startsWith(`${ rancherClusterName }-`);
            });

            if (filtered.length) {
              this.snapshots = filtered;
              found = true;
            }
          } catch {
            // k3s.cattle.io API not available on management cluster
          }
        }

        // ── Attempt 3: rke.cattle.io/v1 ETCDSnapshot (legacy RKE1) ──
        if (!found) {
          for (const ns of [this.clusterNamespace, 'fleet-default']) {
            if (found) {
              break;
            }
            try {
              const result = await this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/apis/rke.cattle.io/v1/namespaces/${ ns }/etcdsnapshots`,
              });
              const items = result?.items || [];
              const filtered = items.filter((s) => {
                const labels = s.metadata?.labels || {};
                const name = s.metadata?.name || '';

                return labels['cluster.x-k8s.io/cluster-name'] === rancherClusterName ||
                       labels['rke.cattle.io/cluster-name'] === rancherClusterName ||
                       name.startsWith(`${ rancherClusterName }-`);
              });

              if (filtered.length) {
                this.snapshots = filtered;
                found = true;
              }
            } catch {
              // Not available
            }
          }
        }

        // ── Attempt 4: Rancher v3 etcdbackups ──
        if (!found && this.managementClusterId) {
          try {
            const mgmtId = this.managementClusterId.includes('/')
              ? this.managementClusterId.split('/').pop()
              : this.managementClusterId;
            const result = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/v3/etcdbackups?clusterId=${ mgmtId }`,
            });
            const items = Array.isArray(result) ? result : (result?.data || []);

            if (items.length) {
              this.snapshots = items;
              found = true;
            }
          } catch {
            // Not available
          }
        }
      } catch (e) {
        this.snapshotError = e.message || 'Failed to load snapshots';
      } finally {
        this.loadingSnapshots = false;
      }
    },

    /**
     * Resolve the display status of a snapshot from various CRD formats.
     */
    resolveSnapshotStatus(s) {
      // k3s.cattle.io/v1 ETCDSnapshotFile — uses spec.snapshotName + status fields
      if (s.status?.readyToUse === true) {
        return 'Ready';
      }
      if (s.status?.error?.message || s.status?.error) {
        return 'Error';
      }
      // v3 etcdbackup
      if (s.state === 'active' || s.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True')) {
        return 'Ready';
      }
      if (s.state === 'error') {
        return 'Error';
      }
      // ETCDSnapshotFile with snapshotFile set = completed
      if (s.spec?.snapshotName || s.status?.snapshotFile) {
        return 'Completed';
      }
      if (s.metadata?.creationTimestamp) {
        return 'Completed';
      }

      return 'InProgress';
    },

    // ── Navigation ──────────────────────────────────
    async exploreCluster() {
      if (this.managementClusterId) {
        const id = this.managementClusterId.includes('/') ? this.managementClusterId.split('/').pop() : this.managementClusterId;

        this.$router.push({
          name:   'c-cluster-explorer',
          params: { cluster: id },
        });
      } else {
        window.alert(this.t('clusterstacks.clusters.actions.exploreNotImported'));
      }
    },

    async downloadKubeconfig() {
      try {
        // Try fetching kubeconfig secret by CAPI convention (<cluster-name>-kubeconfig)
        const secretName = `${ this.clusterName }-kubeconfig`;
        let kubeconfigData = null;

        // Attempt 1: direct API
        try {
          const secret = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/api/v1/namespaces/${ this.clusterNamespace }/secrets/${ secretName }`,
          });

          kubeconfigData = secret?.data?.value || secret?.data?.kubeconfig;
        } catch {
          // fallback
        }

        // Attempt 2: Steve API
        if (!kubeconfigData) {
          try {
            const secret = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/v1/secrets/${ this.clusterNamespace }/${ secretName }`,
            });

            kubeconfigData = secret?.data?.value || secret?.data?.kubeconfig;
          } catch {
            // not found
          }
        }

        // Attempt 3: Rancher v3 generateKubeconfig
        if (!kubeconfigData && this.managementClusterId) {
          try {
            const mgmtId = this.managementClusterId.includes('/') ? this.managementClusterId.split('/').pop() : this.managementClusterId;
            const result = await this.$store.dispatch('management/request', {
              method: 'POST',
              url:    `/v3/clusters/${ mgmtId }?action=generateKubeconfig`,
            });

            kubeconfigData = result?.config ? btoa(result.config) : null;
          } catch {
            // not available
          }
        }

        if (!kubeconfigData) {
          window.alert(this.t('clusterstacks.clusters.kubeconfigNotFound'));

          return;
        }

        // Decode base64 and download
        const decoded = atob(kubeconfigData);
        const blob = new Blob([decoded], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `${ this.clusterName }-kubeconfig.yaml`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        window.alert(e.message || 'Failed to download kubeconfig');
      }
    },

    varType(val) {
      if (Array.isArray(val)) {
        return 'array';
      }
      if (val !== null && typeof val === 'object') {
        return 'object';
      }

      return typeof val;
    },

    varPreview(val) {
      if (typeof val === 'object' && val !== null) {
        const json = JSON.stringify(val);

        return json.length > 80 ? `${ json.substring(0, 77) }...` : json;
      }

      return String(val);
    },

    toYaml(val) {
      try {
        return jsyaml.dump(val, { indent: 2, lineWidth: -1, noRefs: true }).trimEnd();
      } catch {
        return JSON.stringify(val, null, 2);
      }
    },

    // ── YAML edit ───────────────────────────────────
    onYamlInput(val) {
      this.yamlEditContent = val;
    },

    startYamlEdit() {
      if (this.isFleetManagedCluster) {
        return;
      }

      this.yamlEditContent = this.clusterYaml;
      this.yamlEditing = true;
      this.yamlError = null;
    },

    cancelYamlEdit() {
      this.yamlEditing = false;
      this.yamlEditContent = '';
      this.yamlError = null;
    },

    async saveYamlEdit() {
      if (this.isFleetManagedCluster) {
        return;
      }

      this.yamlError = null;
      this.yamlSaving = true;

      try {
        const parsed = jsyaml.load(this.yamlEditContent);

        if (!parsed || typeof parsed !== 'object') {
          this.yamlError = 'Invalid YAML: must be an object';
          this.yamlSaving = false;

          return;
        }

        // Ensure resourceVersion is set for conflict detection
        if (this.cluster?.metadata?.resourceVersion && parsed.metadata) {
          parsed.metadata.resourceVersion = this.cluster.metadata.resourceVersion;
        }

        // Remove status before saving — it's not editable
        delete parsed.status;

        await this.$store.dispatch('management/request', {
          method:  'PUT',
          url:     `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ this.clusterNamespace }/clusters/${ this.clusterName }`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(parsed),
        });

        this.yamlEditing = false;
        await this.load();
      } catch (e) {
        this.yamlError = e.message || 'Failed to save';
      } finally {
        this.yamlSaving = false;
      }
    },

    cleanForYaml(obj, stripStatus = false) {
      const clone = JSON.parse(JSON.stringify(obj));

      if (clone.metadata) {
        delete clone.metadata.fields;
        delete clone.metadata.relationships;
        delete clone.metadata.state;
        delete clone.metadata.managedFields;
      }
      delete clone.id;
      delete clone.type;
      delete clone.links;
      delete clone.actions;

      if (stripStatus) {
        delete clone.status;
      }

      return clone;
    },

    goBack() {
      this.$router.push({ name: ROUTES.CLUSTERS });
    },

    editCluster() {
      if (this.isFleetManagedCluster) {
        return;
      }

      this.$router.push({
        name:  ROUTES.CLUSTERS_CREATE,
        query: { namespace: this.clusterNamespace, name: this.clusterName },
      });
    },

    extractProvider(classStr) {
      if (!classStr) {
        return '';
      }
      // e.g. "openstack-scs-1-29-v1" → "openstack"
      return classStr.split('-')[0];
    },

    // ── Helpers ──────────────────────────────────────
    stateColor(phase) {
      const map = {
        Provisioned:  'bg-success',
        Provisioning: 'bg-info',
        Deleting:     'bg-warning',
        Failed:       'bg-error',
        Pending:      'bg-info',
      };

      return map[phase] || 'bg-darker';
    },

    stateIcon(phase) {
      const map = {
        Provisioned:  'icon-dot-open',
        Provisioning: 'icon-spinner icon-spin',
        Deleting:     'icon-trash',
        Failed:       'icon-error',
        Pending:      'icon-tag',
      };

      return map[phase] || '';
    },

    snapshotStateColor(status) {
      const map = {
        Ready:      'bg-success',
        Completed:  'bg-success',
        InProgress: 'bg-info',
        Error:      'bg-error',
      };

      return map[status] || 'bg-darker';
    },

    formatDate(ts) {
      if (!ts) {
        return '—';
      }

      return new Date(ts).toLocaleString();
    },

    formatVarValue(val) {
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }

      return String(val);
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-detail-page {
  padding: 0 20px 20px;
}

// ── Masthead (Rancher-style) ──────────────────────────
.detail-masthead {
  padding: 16px 0 12px;
  margin-bottom: 0;
}

header.with-subheader {
  grid-template-areas:
    'type-banner type-banner'
    'title actions'
    'sub-header sub-header'
    'state-banner state-banner';
}

.title {
  align-items: flex-start;
  display: flex;
}

.sub-header {
  grid-area: sub-header;
}

.masthead-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.masthead-title {
  display: flex;
  align-items: center;
  gap: 12px;

  h1 {
    margin: 0;
    font-size: 1.4em;
    line-height: 1.2;
  }
}

.masthead-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

// ── Detail top bar (key-value summary) ────────────────
.detail-top {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 28px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background: var(--body-bg);
}

.detail-top-item {
  display: flex;
  flex-direction: column;
  gap: 2px;

  label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.04em;
  }

  span {
    font-size: 13px;
  }
}

// ── Loading / empty states ────────────────────────────
.loading-placeholder {
  padding: 60px;
  text-align: center;
  color: var(--muted);
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: var(--border-radius);

  &.lg {
    padding: 60px;
  }
}

// ── Detail grid (cards) ───────────────────────────────
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-card {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 16px;
  background: var(--body-bg);

  h3, h4 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
}

.detail-kv {
  width: 100%;
  border-collapse: collapse;

  td {
    padding: 6px 8px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
  }

  .kv-label {
    width: 160px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
}

// ── Section headers ───────────────────────────────────
.section-header {
  margin: 24px 0 12px;

  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
}

// ── Worker Pools ──────────────────────────────────────
.pool-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.pool-card {
  h4 {
    font-size: 14px;
    font-weight: 600;
    text-transform: none;
    color: var(--body-text);
  }
}

// ── Variables table (expandable) ──────────────────────
.yaml-inline {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  background: var(--accent-btn);
  white-space: pre-wrap;
  word-break: break-all;
  border-radius: 4px;
}

// ── Snapshot actions ──────────────────────────────────
.snapshot-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

// ── YAML ──────────────────────────────────────────────
.yaml-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
}

.yaml-edit-actions {
  display: flex;
  gap: 8px;
}

.yaml-tab {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.yaml-editor-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 400px;

  .yaml-editor {
    flex: 1;
    min-height: 400px;
  }

  .yaml-view {
    flex: 1;
    min-height: 400px;
    margin: 0;
    padding: 16px;
    font-family: monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    background: var(--body-bg);
    color: var(--body-text);
    tab-size: 2;
    cursor: text;
    user-select: text;
  }
}



// ── Conditions ────────────────────────────────────────
.condition-message {
  font-size: 12px;
  word-break: break-all;
}

.replica-note {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
}

// ── Utility ───────────────────────────────────────────
.mr-10 { margin-right: 10px; }
.mb-10 { margin-bottom: 10px; }
.mb-20 { margin-bottom: 20px; }
.mt-5  { margin-top: 5px; }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-muted   { color: var(--muted); }
</style>
