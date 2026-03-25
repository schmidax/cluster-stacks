<template>
  <div class="capi-providers-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.capiProviders.title') }}</h1>
      <button class="btn role-primary" @click="createProvider">
        {{ t('clusterstacks.capiProviders.createBtn') }}
      </button>
    </div>

    <div v-if="loading" class="no-data">
      {{ t('clusterstacks.common.loading') }}
    </div>

    <div v-else-if="!providers.length" class="no-data">
      {{ t('clusterstacks.capiProviders.noData') }}
    </div>

    <table v-else class="provider-table">
      <thead>
        <tr>
          <th>{{ t('clusterstacks.capiProviders.table.name') }}</th>
          <th>{{ t('clusterstacks.capiProviders.table.type') }}</th>
          <th>{{ t('clusterstacks.capiProviders.table.version') }}</th>
          <th>{{ t('clusterstacks.capiProviders.table.namespace') }}</th>
          <th>{{ t('clusterstacks.capiProviders.table.status') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="provider in providers" :key="provider.uid">
          <td class="cell-name">{{ provider.name }}</td>
          <td>
            <span class="type-badge" :class="`type-${provider.type.toLowerCase()}`">
              {{ provider.type }}
            </span>
          </td>
          <td>{{ provider.version || t('clusterstacks.common.na') }}</td>
          <td class="cell-mono">{{ provider.namespace }}</td>
          <td>
            <span
              class="status-badge"
              :class="provider.ready ? 'status-ready' : 'status-pending'"
            >
              {{ provider.ready ? t('clusterstacks.capiProviders.table.ready') : t('clusterstacks.capiProviders.table.notReady') }}
            </span>
          </td>
          <td class="cell-actions">
            <button
              class="btn btn-sm btn-edit"
              @click="editProvider(provider)"
            >
              {{ t('clusterstacks.common.edit') }}
            </button>
            <button
              class="btn btn-sm btn-delete"
              @click="requestDelete(provider)"
            >
              {{ t('clusterstacks.common.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ConfirmDeleteDialog
      :is-open="showDeleteDialog"
      :confirmation-value="pendingDelete ? pendingDelete.name : ''"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script>
import { ROUTES } from '../../config/clusterstacks';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog.vue';

export default {
  name: 'CapiProvidersList',

  components: { ConfirmDeleteDialog },

  data() {
    return {
      loading:          true,
      providers:        [],
      showDeleteDialog: false,
      pendingDelete:    null,
    };
  },

  async mounted() {
    await this.loadProviders();
  },

  methods: {
    async loadProviders() {
      this.loading = true;
      try {
        const response = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/apis/turtles-capi.cattle.io/v1alpha1/capiproviders',
        });

        this.providers = (response?.items || []).map((item) => {
          const conditions = item.status?.conditions || [];
          const readyCond  = conditions.find((c) => c.type === 'Ready');

          return {
            uid:       item.metadata?.uid || `${ item.metadata?.namespace }/${ item.metadata?.name }`,
            name:      item.metadata?.name || item.spec?.name || '',
            namespace: item.metadata?.namespace || '',
            type:      item.spec?.type || '',
            version:   item.spec?.version || '',
            ready:     readyCond?.status === 'True',
            raw:       item,
          };
        });
      } catch {
        this.providers = [];
      } finally {
        this.loading = false;
      }
    },

    createProvider() {
      this.$router.push({ name: ROUTES.CAPI_PROVIDERS_CREATE });
    },

    editProvider(provider) {
      this.$router.push({
        name:  ROUTES.CAPI_PROVIDERS_CREATE,
        query: { namespace: provider.namespace, name: provider.name },
      });
    },

    requestDelete(provider) {
      this.pendingDelete    = provider;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
      this.pendingDelete    = null;
    },

    async confirmDelete() {
      const provider = this.pendingDelete;

      this.showDeleteDialog = false;
      this.pendingDelete    = null;

      if (!provider) {
        return;
      }

      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ provider.namespace }/capiproviders/${ provider.name }`,
        });
        await this.loadProviders();
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.capi-providers-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.provider-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;

  th {
    text-align: left;
    padding: 10px 14px;
    font-weight: 700;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    border-bottom: 2px solid var(--border);
  }

  td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--body-text);
    vertical-align: middle;
  }

  tbody tr:hover {
    background: var(--hover-bg, rgba(0, 0, 0, 0.03));
  }
}

.cell-name {
  font-weight: 600;
}

.cell-mono {
  font-family: monospace;
  font-size: 0.85em;
}

.cell-actions {
  text-align: right;
  white-space: nowrap;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 600;
  background: var(--accent-btn, rgba(0, 0, 0, 0.08));
  color: var(--body-text);

  &.type-infrastructure  { background: #dbeafe; color: #1e40af; }
  &.type-controlplane    { background: #d1fae5; color: #065f46; }
  &.type-bootstrap       { background: #fef3c7; color: #92400e; }
  &.type-core            { background: #ede9fe; color: #5b21b6; }
  &.type-addon           { background: #fce7f3; color: #9d174d; }
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 600;

  &.status-ready   { background: #d1fae5; color: #065f46; }
  &.status-pending { background: #fef3c7; color: #92400e; }
}

.btn-edit {
  background-color: var(--primary);
  border-color: var(--primary);
  color: #fff;
  margin-right: 6px;

  &:not(:disabled):hover {
    opacity: 0.85;
  }
}

.btn-delete {
  background-color: var(--error, #b91c1c);
  border-color: var(--error, #b91c1c);
  color: #fff;

  &:not(:disabled):hover {
    background-color: var(--error-hover, #991b1b);
    border-color: var(--error-hover, #991b1b);
  }
}
</style>
