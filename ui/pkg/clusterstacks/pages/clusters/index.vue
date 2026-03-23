<template>
  <div class="clusters-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.clusters.title') }}</h1>
      <button
        class="btn role-primary"
        @click="createCluster"
      >
        {{ t('clusterstacks.clusters.createBtn') }}
      </button>
    </div>

    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <div v-else-if="error" class="banner banner-error">
      {{ error }}
      <button class="btn btn-sm role-secondary" @click="load">
        {{ t('clusterstacks.common.retry') }}
      </button>
    </div>

    <div v-else-if="!clusters.length" class="no-data">
      {{ t('clusterstacks.clusters.noData') }}
    </div>

    <SortableTable
      v-else
      :rows="clusters"
      :headers="headers"
      key-field="id"
      :search="true"
      :paging="true"
    >
      <template #cell:name="{ row }">
        <a href="#" @click.prevent="editCluster(row)">{{ row.metadata.name }}</a>
      </template>
      <template #cell:version="{ row }">
        {{ row.spec?.topology?.version || t('clusterstacks.common.na') }}
      </template>
      <template #cell:phase="{ row }">
        <span :class="phaseClass(row.status?.phase)">
          {{ row.status?.phase || t('clusterstacks.common.na') }}
        </span>
      </template>
      <template #cell:ready="{ row }">
        <i
          :class="row.status?.controlPlaneReady && row.status?.infrastructureReady
            ? 'icon icon-checkmark text-success'
            : 'icon icon-warning text-warning'"
        />
      </template>
      <template #cell:actions="{ row }">
        <button class="btn btn-sm role-secondary" @click="editCluster(row)">
          {{ t('clusterstacks.common.edit') }}
        </button>
        <button class="btn btn-sm role-danger" @click="deleteCluster(row)">
          {{ t('clusterstacks.common.delete') }}
        </button>
      </template>
    </SortableTable>
  </div>
</template>

<script>
import SortableTable from '@shell/components/SortableTable';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClustersIndex',

  components: { SortableTable },

  data() {
    return {
      clusters: [],
      loading:  false,
      error:    null,
    };
  },

  computed: {
    headers() {
      return [
        {
          name:      'name',
          labelKey:  'clusterstacks.clusters.table.name',
          value:     'metadata.name',
          sort:      ['metadata.name'],
        },
        {
          name:      'namespace',
          labelKey:  'clusterstacks.clusters.table.namespace',
          value:     'metadata.namespace',
          sort:      ['metadata.namespace'],
        },
        {
          name:      'version',
          labelKey:  'clusterstacks.clusters.table.version',
          value:     'spec.topology.version',
          sort:      ['spec.topology.version'],
        },
        {
          name:      'phase',
          labelKey:  'clusterstacks.clusters.table.phase',
          value:     'status.phase',
          sort:      ['status.phase'],
        },
        {
          name:     'ready',
          labelKey: 'clusterstacks.clusters.table.ready',
          value:    'status.controlPlaneReady',
        },
        {
          name:  'actions',
          label: '',
          value: '',
        },
      ];
    },
  },

  async mounted() {
    await this.load();
  },

  methods: {
    async load() {
      this.loading = true;
      this.error = null;
      try {
        const result = await this.$store.dispatch('management/findAll', {
          type: 'cluster.x-k8s.io.cluster',
        });
        this.clusters = result || [];
      } catch (e) {
        this.error = this.t('clusterstacks.errors.loadClusters');
        console.error(e); // eslint-disable-line no-console
      } finally {
        this.loading = false;
      }
    },

    createCluster() {
      this.$router.push({ name: ROUTES.CLUSTERS_CREATE });
    },

    editCluster(cluster) {
      this.$router.push({
        name:   ROUTES.CLUSTERS_CREATE,
        query:  { namespace: cluster.metadata.namespace, name: cluster.metadata.name },
      });
    },

    async deleteCluster(cluster) {
      if (!window.confirm(`Delete cluster ${cluster.metadata.name}?`)) {
        return;
      }
      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${cluster.metadata.namespace}/clusters/${cluster.metadata.name}`,
        });
        await this.load();
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }
    },

    phaseClass(phase) {
      const map = {
        Provisioned: 'text-success',
        Provisioning: 'text-warning',
        Deleting: 'text-error',
        Failed: 'text-error',
      };
      return map[phase] || '';
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
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

.loading-placeholder,
.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}
</style>
