<template>
  <div class="cluster-detail-page">
    <!-- ═══ HEADER (Rancher-style with badge + actions) ═══ -->
    <div class="detail-masthead">
      <div class="masthead-left">
        <button class="btn btn-sm role-link mr-10" @click="goBack">
          <i class="icon icon-chevron-left" /> {{ t('clusterstacks.clusters.title') }}
        </button>
        <div class="masthead-title">
          <h1>{{ clusterName }}</h1>
          <BadgeState
            v-if="cluster"
            :color="stateColor(cluster.status?.phase)"
            :icon="stateIcon(cluster.status?.phase)"
            :label="cluster.status?.phase || 'Unknown'"
          />
        </div>
      </div>
      <div class="masthead-actions">
        <button class="btn role-secondary" @click="exploreCluster">
          <i class="icon icon-external-link" /> {{ t('clusterstacks.clusters.actions.explore') }}
        </button>
        <button class="btn role-secondary" @click="downloadKubeconfig">
          <i class="icon icon-download" /> {{ t('clusterstacks.clusters.actions.downloadKubeconfig') }}
        </button>
        <button class="btn role-primary" @click="editCluster">
          <i class="icon icon-edit" /> {{ t('clusterstacks.common.edit') }}
        </button>
      </div>
    </div>

    <!-- Key-value summary bar (Rancher DetailTop style) -->
    <div v-if="cluster" class="detail-top">
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.namespace') }}</label>
        <span>{{ cluster.metadata.namespace }}</span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusterDetail.clusterClass') }}</label>
        <span><code>{{ topology?.class || '—' }}</code></span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.version') }}</label>
        <span><code>{{ topology?.version || '—' }}</code></span>
      </div>
      <div class="detail-top-item">
        <label>{{ t('clusterstacks.clusters.table.provider') }}</label>
        <span>{{ extractProvider(topology?.class) || '—' }}</span>
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
      <Tabbed :default-tab="'overview'" :use-hash="false">
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
                      <i :class="cluster.status?.controlPlaneReady ? 'icon icon-checkmark text-success' : 'icon icon-warning text-warning'" />
                      {{ cluster.status?.controlPlaneReady ? t('clusterstacks.common.yes') : t('clusterstacks.common.no') }}
                    </td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.infraReady') }}</td>
                    <td>
                      <i :class="cluster.status?.infrastructureReady ? 'icon icon-checkmark text-success' : 'icon icon-warning text-warning'" />
                      {{ cluster.status?.infrastructureReady ? t('clusterstacks.common.yes') : t('clusterstacks.common.no') }}
                    </td>
                  </tr>
                  <tr>
                    <td class="kv-label">{{ t('clusterstacks.clusterDetail.cpReplicas') }}</td>
                    <td>{{ topology?.controlPlane?.replicas || 0 }}</td>
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
                    <td class="kv-label">Replicas</td>
                    <td>{{ topology?.controlPlane?.replicas || 0 }}</td>
                  </tr>
                  <tr v-if="varsMap.controlPlaneFlavor">
                    <td class="kv-label">Flavor</td>
                    <td><code>{{ varsMap.controlPlaneFlavor }}</code></td>
                  </tr>
                  <tr v-if="varsMap.controlPlaneRootDisk">
                    <td class="kv-label">Root Disk</td>
                    <td>{{ varsMap.controlPlaneRootDisk }} GiB</td>
                  </tr>
                  <tr v-if="varsMap.clusterCNI">
                    <td class="kv-label">CNI</td>
                    <td><code>{{ varsMap.clusterCNI }}</code></td>
                  </tr>
                  <tr v-if="varsMap.apiServerLoadBalancer">
                    <td class="kv-label">API Server LB</td>
                    <td><code>{{ varsMap.apiServerLoadBalancer }}</code></td>
                  </tr>
                  <tr v-if="varsMap.imageName">
                    <td class="kv-label">Image</td>
                    <td><code>{{ varsMap.imageName }}</code></td>
                  </tr>
                  <tr v-if="varsMap.sshKeyName">
                    <td class="kv-label">SSH Key</td>
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
          <div v-if="workerPools.length" class="pool-list">
            <div v-for="(pool, idx) in workerPools" :key="idx" class="detail-card pool-card">
              <h4>{{ pool.name }}</h4>
              <table class="detail-kv">
                <tbody>
                  <tr>
                    <td class="kv-label">Class</td>
                    <td><code>{{ pool.class }}</code></td>
                  </tr>
                  <tr>
                    <td class="kv-label">Replicas</td>
                    <td>{{ pool.replicas }}</td>
                  </tr>
                  <tr v-for="ov in (pool.variables?.overrides || [])" :key="ov.name">
                    <td class="kv-label">{{ ov.name }}</td>
                    <td><code>{{ formatVarValue(ov.value) }}</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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

        <!-- ─── VARIABLES TAB ─────────────────────── -->
        <Tab name="variables" :label="t('clusterstacks.clusterDetail.tabs.variables')" :weight="30">
          <div v-if="topologyVariables.length" class="variables-table">
            <table class="kv-table">
              <thead>
                <tr>
                  <th class="kv-expand-col" />
                  <th>{{ t('clusterstacks.clusterDetail.varName') }}</th>
                  <th>{{ t('clusterstacks.clusterDetail.varType') }}</th>
                  <th>{{ t('clusterstacks.clusterDetail.varPreview') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="v in topologyVariables" :key="v.name">
                  <tr class="kv-row" :class="{ expandable: isComplexVar(v.value) }" @click="toggleVar(v.name)">
                    <td class="kv-expand-col">
                      <i v-if="isComplexVar(v.value)" class="icon" :class="expandedVars[v.name] ? 'icon-chevron-down' : 'icon-chevron-right'" />
                    </td>
                    <td class="kv-name"><code>{{ v.name }}</code></td>
                    <td class="kv-type">{{ varType(v.value) }}</td>
                    <td class="kv-preview"><code>{{ varPreview(v.value) }}</code></td>
                  </tr>
                  <tr v-if="expandedVars[v.name]" :key="v.name + '-expanded'" class="kv-expanded">
                    <td colspan="4">
                      <pre class="yaml-inline">{{ toYaml(v.value) }}</pre>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
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
            <button v-if="!yamlEditing" class="btn btn-sm role-secondary" @click="startYamlEdit">
              <i class="icon icon-edit" /> {{ t('clusterstacks.common.edit') }}
            </button>
            <div v-else class="yaml-edit-actions">
              <button class="btn btn-sm role-secondary" @click="cancelYamlEdit">
                {{ t('clusterstacks.common.cancel') }}
              </button>
              <button class="btn btn-sm role-primary" :disabled="yamlSaving" @click="saveYamlEdit">
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

      // Expanded variables
      expandedVars: {},

      // Snapshots
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

    totalWorkerReplicas() {
      return this.workerPools.reduce((sum, md) => sum + (md.replicas || 0), 0);
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
          url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ this.clusterNamespace }/clusters/${ this.clusterName }`,
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
        const mgmtClusters = await this.$store.dispatch('management/findAll', { type: 'management.cattle.io.cluster' });
        const list = Array.isArray(mgmtClusters) ? mgmtClusters : (mgmtClusters?.data || []);

        for (const mc of list) {
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
     *   1. k3s.cattle.io/v1 ETCDSnapshotFile (primary — the actual CRD for RKE2/k3s snapshots)
     *   2. Downstream cluster proxy k3s.cattle.io/v1 etcdsnapshotfiles
     *   3. Steve API v1/k3s.cattle.io.etcdsnapshotfiles
     *   4. rke.cattle.io/v1 ETCDSnapshot (legacy fallback)
     *   5. Rancher v3 etcdbackups
     */
    async loadSnapshots() {
      this.loadingSnapshots = true;
      this.snapshots = [];
      this.snapshotError = null;

      const rancherClusterName = this.cluster?.metadata?.labels?.['cluster.x-k8s.io/cluster-name'] || this.clusterName;
      let found = false;

      try {
        // ── Attempt 1: k3s.cattle.io/v1 ETCDSnapshotFile (cluster-scoped) ──
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
            // k3s.cattle.io API not available
          }
        }

        // ── Attempt 2: Downstream cluster proxy — k3s.cattle.io/v1 etcdsnapshotfiles ──
        if (!found && this.managementClusterId) {
          try {
            const result = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/k8s/clusters/${ this.managementClusterId }/apis/k3s.cattle.io/v1/etcdsnapshotfiles`,
            });
            const items = result?.items || [];

            if (items.length) {
              this.snapshots = items;
              found = true;
            }
          } catch {
            // Downstream proxy not available
          }
        }

        // ── Attempt 3: Steve API v1/k3s.cattle.io.etcdsnapshotfiles ──
        if (!found) {
          try {
            const provResult = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/v1/k3s.cattle.io.etcdsnapshotfiles`,
            });
            const items = Array.isArray(provResult) ? provResult : (provResult?.data || []);
            const filtered = items.filter((s) => {
              const labels = s.metadata?.labels || {};
              const ns = s.metadata?.namespace || '';

              return labels['rke.cattle.io/cluster-name'] === rancherClusterName ||
                     labels['cluster.x-k8s.io/cluster-name'] === rancherClusterName ||
                     ns === this.clusterNamespace;
            });

            if (filtered.length) {
              this.snapshots = filtered;
              found = true;
            }
          } catch {
            // Steve API not available
          }
        }

        // ── Attempt 4: rke.cattle.io/v1 ETCDSnapshot (legacy) ──
        if (!found) {
          const namespacesToTry = [this.clusterNamespace, 'fleet-default'];

          for (const ns of namespacesToTry) {
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

        // ── Attempt 5: Rancher v3 etcdbackups ──
        if (!found && this.managementClusterId) {
          try {
            const mgmtId = this.managementClusterId.includes('/') ? this.managementClusterId.split('/').pop() : this.managementClusterId;
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

    // ── Variable display helpers ────────────────────
    toggleVar(name) {
      const updated = { ...this.expandedVars };

      updated[name] = !updated[name];
      this.expandedVars = updated;
    },

    isComplexVar(val) {
      return typeof val === 'object' && val !== null;
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
          url:     `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ this.clusterNamespace }/clusters/${ this.clusterName }`,
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0 12px;
  margin-bottom: 0;
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
.variables-table {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.kv-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 8px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    background: var(--accent-btn);
    border-bottom: 1px solid var(--border);
  }

  .kv-expand-col {
    width: 30px;
    text-align: center;
    padding: 0 4px;

    .icon {
      font-size: 12px;
      cursor: pointer;
    }
  }
}

.kv-row {
  td {
    padding: 8px 12px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  &.expandable {
    cursor: pointer;
    &:hover { background: var(--accent-btn); }
  }
}

.kv-name code { font-weight: 600; font-size: 13px; }
.kv-type { color: var(--muted); font-size: 12px; }
.kv-preview code { font-size: 12px; word-break: break-all; }

.kv-expanded td {
  padding: 0;
  border-bottom: 1px solid var(--border);
  background: var(--accent-btn);
}

.yaml-inline {
  margin: 0;
  padding: 12px 16px 12px 54px;
  font-size: 12px;
  line-height: 1.5;
  background: none;
  white-space: pre-wrap;
  word-break: break-all;
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

// ── Utility ───────────────────────────────────────────
.mr-10 { margin-right: 10px; }
.mb-10 { margin-bottom: 10px; }
.mb-20 { margin-bottom: 20px; }
.mt-5  { margin-top: 5px; }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-muted   { color: var(--muted); }
</style>
