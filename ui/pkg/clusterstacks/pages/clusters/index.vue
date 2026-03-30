<template>
  <div class="clusters-page">
    <!-- Header -->
    <div class="page-header">
      <h1>{{ t('clusterstacks.clusters.title') }}</h1>
      <div class="header-actions">
        <button class="btn role-primary" @click="createCluster">
          {{ t('clusterstacks.clusters.createBtn') }}
        </button>
        <button class="btn role-secondary" @click="load">
          <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <div v-else-if="error" class="banner bg-error mb-20">
      {{ error }}
      <button class="btn btn-sm role-secondary ml-10" @click="load">
        {{ t('clusterstacks.common.retry') }}
      </button>
    </div>

    <div v-else-if="!tableRows.length" class="no-data">
      <h2>{{ t('clusterstacks.clusters.noData') }}</h2>
      <button class="btn role-primary mt-10" @click="createCluster">
        {{ t('clusterstacks.clusters.createBtn') }}
      </button>
    </div>

    <SortableTable
      v-else
      :rows="tableRows"
      :headers="headers"
      key-field="id"
      default-sort-by="name"
      :search="true"
      :paging="true"
      :rows-per-page="20"
      :table-actions="false"
      :row-actions="true"
    >
      <!-- State badge -->
      <template #cell:state="{ row }">
        <BadgeState
          :color="stateColor(row.phase)"
          :icon="stateIcon(row.phase)"
          :label="row.phase || 'Unknown'"
        />
      </template>

      <!-- Cluster name (clickable) -->
      <template #cell:name="{ row }">
        <a href="#" class="cluster-link" @click.prevent="viewCluster(row)">
          {{ row.name }}
        </a>
        <span class="text-muted cluster-namespace">{{ row.namespace }}</span>
      </template>

      <!-- K8s version -->
      <template #cell:version="{ row }">
        <span class="version-label">{{ row.version || '—' }}</span>
      </template>

      <!-- Provider -->
      <template #cell:provider="{ row }">
        {{ row.provider || '—' }}
      </template>

      <!-- Control Plane replicas -->
      <template #cell:controlPlane="{ row }">
        <span v-if="row.cpDesired > 0" class="replica-count">
          <BadgeState
            :color="row.cpReady === row.cpDesired ? 'bg-success' : 'bg-info'"
            :label="`${ row.cpReady }/${ row.cpDesired }`"
          />
        </span>
        <span v-else class="text-muted">—</span>
      </template>

      <!-- Worker replicas -->
      <template #cell:workers="{ row }">
        <span v-if="row.workerDesired > 0" class="replica-count">
          <BadgeState
            :color="row.workerReady === row.workerDesired ? 'bg-success' : 'bg-info'"
            :label="`${ row.workerReady }/${ row.workerDesired }`"
          />
        </span>
        <span v-else class="text-muted">—</span>
      </template>

      <!-- Infrastructure Ready -->
      <template #cell:infraReady="{ row }">
        <i
          class="icon"
          :class="row.infraReady ? 'icon-checkmark text-success' : 'icon-dot-open text-muted'"
        />
      </template>

      <!-- Age -->
      <template #cell:age="{ row }">
        {{ row.age }}
      </template>

      <!-- Explore button -->
      <template #cell:explore="{ row }">
        <button class="btn btn-sm role-secondary" @click.stop="exploreCluster(row)">
          <i class="icon icon-external-link" /> {{ t('clusterstacks.clusters.actions.explore') }}
        </button>
      </template>
    </SortableTable>
  </div>
</template>

<script>
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@rancher/components';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClustersIndex',

  components: { SortableTable, BadgeState },

  data() {
    return {
      clusters:       [],
      loading:        false,
      error:          null,
      refreshTimer:   null,
    };
  },

  computed: {
    headers() {
      return [
        {
          name:      'state',
          labelKey:  'clusterstacks.clusters.table.state',
          value:     'phase',
          sort:      ['phase'],
          width:     140,
        },
        {
          name:      'name',
          labelKey:  'clusterstacks.clusters.table.name',
          value:     'name',
          sort:      ['name'],
        },
        {
          name:      'version',
          labelKey:  'clusterstacks.clusters.table.version',
          value:     'version',
          sort:      ['version'],
          width:     150,
        },
        {
          name:      'provider',
          labelKey:  'clusterstacks.clusters.table.provider',
          value:     'provider',
          sort:      ['provider'],
          width:     130,
        },
        {
          name:      'controlPlane',
          labelKey:  'clusterstacks.clusters.table.controlPlane',
          value:     'cpInfo',
          width:     130,
          align:     'center',
        },
        {
          name:      'workers',
          labelKey:  'clusterstacks.clusters.table.workers',
          value:     'workerInfo',
          width:     120,
          align:     'center',
        },
        {
          name:      'infraReady',
          labelKey:  'clusterstacks.clusters.table.infraReady',
          value:     'infraReady',
          width:     80,
          align:     'center',
        },
        {
          name:      'age',
          labelKey:  'clusterstacks.clusters.table.age',
          value:     'ageSort',
          sort:      ['ageSort:desc'],
          width:     90,
        },
        {
          name:       'explore',
          label:      '',
          value:      '',
          width:      110,
          align:      'center',
          sort:       false,
          search:     false,
          formatter:  '',
        },
      ];
    },

    tableRows() {
      const self = this;

      return (this.clusters || []).map((c) => {
        const topo = c.spec?.topology;

        // Count worker pools
        const mds = topo?.workers?.machineDeployments || [];
        const workerDesired = mds.reduce((sum, md) => sum + (md.replicas || 0), 0);

        // Parse creation timestamp for age display
        const created = c.metadata?.creationTimestamp ? new Date(c.metadata.creationTimestamp) : null;
        const ageMs = created ? Date.now() - created.getTime() : 0;

        const row = {
          id:            `${ c.metadata.namespace }/${ c.metadata.name }`,
          name:          c.metadata.name,
          namespace:     c.metadata.namespace,
          version:       topo?.version || '',
          clusterClass:  topo?.class || '',
          phase:         c.status?.phase || 'Unknown',
          cpDesired:     topo?.controlPlane?.replicas || 0,
          cpReady:       c.status?.controlPlaneReady ? (topo?.controlPlane?.replicas || 0) : 0,
          workerDesired,
          workerReady:   c.status?.infrastructureReady ? workerDesired : 0,
          infraReady:    !!c.status?.infrastructureReady,
          provider:      self.extractProvider(topo?.class),
          age:           self.formatAge(ageMs),
          ageSort:       created ? created.toISOString() : '',
          cpInfo:        `${ c.status?.controlPlaneReady ? (topo?.controlPlane?.replicas || 0) : 0 }/${ topo?.controlPlane?.replicas || 0 }`,
          workerInfo:    `${ c.status?.infrastructureReady ? workerDesired : 0 }/${ workerDesired }`,
          raw:           c,

          // Rancher SortableTable row actions — these appear in the kebab menu
          availableActions: [
            {
              label:   self.t('clusterstacks.clusters.actions.explore'),
              icon:    'icon-external-link',
              action:  'exploreCluster',
            },
            {
              label:   self.t('clusterstacks.clusters.actions.viewDetail'),
              icon:    'icon-document',
              action:  'viewCluster',
            },
            {
              label:    self.t('clusterstacks.clusters.actions.downloadKubeconfig'),
              icon:     'icon-download',
              action:   'downloadKubeconfig',
            },
            { divider: true },
            {
              label:   self.t('clusterstacks.common.edit'),
              icon:    'icon-edit',
              action:  'editCluster',
            },
            { divider: true },
            {
              label:   self.t('clusterstacks.common.delete'),
              icon:    'icon-trash',
              action:  'deleteCluster',
              bulkable: false,
            },
          ],
        };

        // Bind action methods directly on the row object (SortableTable calls row[action.action]())
        row.viewCluster = () => self.viewCluster(row);
        row.exploreCluster = () => self.exploreCluster(row);
        row.editCluster = () => self.editCluster(row);
        row.deleteCluster = () => self.deleteCluster(row);
        row.downloadKubeconfig = () => self.downloadKubeconfig(row);

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
      if (!silent) {
        this.loading = true;
      }
      this.error = null;

      try {
        const result = await this.$store.dispatch('management/findAll', {
          type: 'cluster.x-k8s.io.cluster',
          opt:  { force: true },
        });

        this.clusters = result || [];
      } catch (e) {
        if (!silent) {
          this.error = this.t('clusterstacks.errors.loadClusters');
        }
      } finally {
        if (!silent) {
          this.loading = false;
        }
      }
    },

    // ── Navigation ──────────────────────────────────────
    createCluster() {
      this.$router.push({ name: ROUTES.CLUSTERS_CREATE });
    },

    viewCluster(row) {
      this.$router.push({
        name:  ROUTES.CLUSTERS_DETAIL,
        query: { namespace: row.namespace, name: row.name },
      });
    },

    editCluster(row) {
      this.$router.push({
        name:  ROUTES.CLUSTERS_CREATE,
        query: { namespace: row.namespace, name: row.name },
      });
    },

    async exploreCluster(row) {
      // Try to find the Rancher management cluster that corresponds to this CAPI cluster
      try {
        const mgmtClusters = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.cluster',
          opt:  { force: true },
        });

        // Match by label, annotation, or display name
        const match = (mgmtClusters || []).find((mc) => {
          const labels = mc.metadata?.labels || {};
          const annotations = mc.metadata?.annotations || {};
          const name = mc.spec?.displayName || mc.metadata?.name || '';

          return labels['cluster.x-k8s.io/cluster-name'] === row.name ||
                 annotations['cluster.x-k8s.io/cluster-name'] === row.name ||
                 name === row.name;
        });

        if (match) {
          const clusterId = match.metadata?.name || match.id?.replace('management.cattle.io.cluster/', '') || '';

          this.$router.push({
            name:   'c-cluster-explorer',
            params: { cluster: clusterId },
          });

          return;
        }
      } catch {
        // management clusters not accessible
      }

      // Fallback: navigate to detail page instead
      window.alert(this.t('clusterstacks.clusters.actions.exploreNotImported'));
    },

    async deleteCluster(row) {
      const msg = this.t('clusterstacks.clusters.deleteConfirm', { name: row.name });

      if (!window.confirm(msg)) {
        return;
      }

      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ row.namespace }/clusters/${ row.name }`,
        });
        await this.load();
      } catch (e) {
        console.error('Failed to delete cluster:', e); // eslint-disable-line no-console
      }
    },

    // ── Kubeconfig download ─────────────────────────────
    async downloadKubeconfig(row) {
      const ns = row.namespace;
      const secretName = `${ row.name }-kubeconfig`;

      try {
        // CAPI stores kubeconfig in a secret named <cluster>-kubeconfig
        const secret = await this.$store.dispatch('management/request', {
          url: `/api/v1/namespaces/${ ns }/secrets/${ secretName }`,
        });

        const data = secret?.data || {};
        const kubeconfigB64 = data.value || data.kubeconfig;

        if (!kubeconfigB64) {
          // Try via CAPI API directly
          const resp = await this.$store.dispatch('management/request', {
            url: `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ ns }/clusters/${ row.name }/kubeconfig`,
          });

          if (resp) {
            this.triggerDownload(`${ row.name }-kubeconfig.yaml`, typeof resp === 'string' ? resp : JSON.stringify(resp, null, 2));

            return;
          }

          window.alert(this.t('clusterstacks.clusters.actions.kubeconfigNotFound'));

          return;
        }

        const kubeconfig = atob(kubeconfigB64);

        this.triggerDownload(`${ row.name }-kubeconfig.yaml`, kubeconfig);
      } catch (e) {
        console.error('Failed to download kubeconfig:', e); // eslint-disable-line no-console

        // Fallback: try fetching the secret via Steve API
        try {
          const secret = await this.$store.dispatch('management/find', {
            type: 'secret',
            id:   `${ ns }/${ secretName }`,
          });

          const kubeconfigB64 = secret?.data?.value || secret?.data?.kubeconfig;

          if (kubeconfigB64) {
            this.triggerDownload(`${ row.name }-kubeconfig.yaml`, atob(kubeconfigB64));

            return;
          }
        } catch {
          // ignore
        }

        window.alert(this.t('clusterstacks.clusters.actions.kubeconfigError'));
      }
    },

    triggerDownload(filename, content) {
      const blob = new Blob([content], { type: 'application/x-yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    },

    // ── Helpers ─────────────────────────────────────────
    extractProvider(clusterClass) {
      if (!clusterClass) {
        return '';
      }
      const parts = clusterClass.split('-');

      return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
    },

    stateColor(phase) {
      const map = {
        Provisioned:  'bg-success',
        Provisioning: 'bg-info',
        Deleting:     'bg-warning',
        Failed:       'bg-error',
        Pending:      'bg-info',
        Unknown:      'bg-darker',
      };

      return map[phase] || 'bg-darker';
    },

    stateIcon(phase) {
      const map = {
        Provisioned:  'icon-checkmark',
        Provisioning: 'icon-spinner icon-spin',
        Deleting:     'icon-trash',
        Failed:       'icon-warning',
        Pending:      'icon-spinner icon-spin',
      };

      return map[phase] || 'icon-dot-open';
    },

    formatAge(ms) {
      if (!ms || ms < 0) {
        return '—';
      }
      const m = Math.floor(ms / 60000);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);

      if (d > 0) {
        return `${ d }d`;
      }
      if (h > 0) {
        return `${ h }h`;
      }

      return `${ m }m`;
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.clusters-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.loading-placeholder,
.no-data {
  padding: 60px;
  text-align: center;
  color: var(--muted);
}

// ── Name column ───────────────────────────────────────
.cluster-link {
  font-weight: 600;
  color: var(--link);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.cluster-namespace {
  display: block;
  font-size: 0.85em;
  line-height: 1.4;
}

// ── Version label ─────────────────────────────────────
.version-label {
  font-family: monospace;
  font-size: 13px;
}

// ── Replicas ──────────────────────────────────────────
.replica-count {
  display: inline-flex;
  align-items: center;
}

// ── Utilities ─────────────────────────────────────────
.text-success { color: var(--success); }
.text-muted   { color: var(--muted); }
.ml-10 { margin-left: 10px; }
.mt-10 { margin-top: 10px; }
.mb-20 { margin-bottom: 20px; }
</style>
