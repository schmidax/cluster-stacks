<template>
  <div class="clusterstacks-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.stacks.title') }}</h1>
      <div class="page-header-actions">
        <button class="btn role-primary" @click="goCreate">
          + {{ t('clusterstacks.stacks.createBtn') }}
        </button>
        <button class="btn role-secondary" @click="load">
          <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
        </button>
      </div>
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

    <div v-else-if="!stacks.length" class="no-data">
      {{ t('clusterstacks.stacks.noData') }}
    </div>

    <div v-else class="stacks-grid">
      <ClusterStackCard
        v-for="stack in stacks"
        :key="stack.metadata.uid"
        :stack="stack"
        :releases="releasesByStack[stack.metadata.name] || []"
        :used-release-names="usedReleaseNames"
        @delete-release="onDeleteRelease"
        @edit-stack="onEditStack"
        @delete-stack="onDeleteStack"
      />
    </div>

    <ConfirmDeleteDialog
      :is-open="showDeleteDialog"
      :confirmation-value="pendingDelete ? pendingDelete.name : ''"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script>
import ClusterStackCard from '../../components/ClusterStackCard.vue';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClusterStacksIndex',

  components: { ClusterStackCard, ConfirmDeleteDialog },

  data() {
    return {
      stacks:               [],
      releases:             [],
      clusterClasses:       [],
      clusters:             [],
      loading:              false,
      error:                null,
      showDeleteDialog:     false,
      pendingDelete:        null,
    };
  },

  computed: {
    releasesByStack() {
      const map = {};

      // Build a lookup: release-name-prefix → stack metadata.name
      // Release naming convention: <provider>-<name>-<k8sVersion>-<version>
      // e.g. "openstack-rke2-1-33-v3"
      // Stack spec fields: provider, name, kubernetesVersion
      const prefixToStackName = {};

      for (const stack of this.stacks) {
        const provider   = stack.spec?.provider || '';
        const name       = stack.spec?.name || '';
        const k8sVersion = (stack.spec?.kubernetesVersion || '').replace(/\./g, '-');

        if (provider && name && k8sVersion) {
          const prefix = `${ provider }-${ name }-${ k8sVersion }`;

          prefixToStackName[prefix] = stack.metadata.name;
        }
      }

      for (const release of this.releases) {
        const releaseName = release.metadata?.name || '';
        // Strip trailing version suffix: e.g. "openstack-rke2-1-33-v3" → "openstack-rke2-1-33"
        const releasePrefix = releaseName.replace(/-v\d+$/, '');

        const stackName = prefixToStackName[releasePrefix];

        if (!stackName) {
          continue;
        }
        if (!map[stackName]) {
          map[stackName] = [];
        }
        map[stackName].push(release);
      }

      return map;
    },

    clusterClassesByStack() {
      const map = {};
      for (const cc of this.clusterClasses) {
        // ClusterClass naming convention: <stackName>-<version>
        const parts = cc.metadata.name.split('-');
        const stackName = parts.slice(0, -1).join('-');
        if (!map[stackName]) {
          map[stackName] = [];
        }
        map[stackName].push(cc);
      }
      return map;
    },

    /**
     * Set of ClusterClass names currently referenced by at least one Cluster.
     * A release whose name matches a used ClusterClass is considered "in use".
     */
    usedClusterClassNames() {
      const names = new Set();

      for (const cluster of this.clusters) {
        const className = cluster.spec?.topology?.class;

        if (className) {
          names.add(className);
        }
      }

      return names;
    },

    /**
     * Set of ClusterStackRelease names that are in use (i.e. their
     * corresponding ClusterClass is referenced by a cluster).
     */
    usedReleaseNames() {
      const names = new Set();

      for (const release of this.releases) {
        const releaseName = release.metadata?.name || '';

        if (this.usedClusterClassNames.has(releaseName)) {
          names.add(releaseName);
        }
      }

      return names;
    },
  },

  async mounted() {
    await this.load();
  },

  methods: {
    goCreate() {
      this.$router.push({ name: ROUTES.STACKS_CREATE });
    },

    onEditStack(stack) {
      this.$router.push({
        name:  ROUTES.STACKS_CREATE,
        query: {
          namespace: stack.metadata?.namespace || 'clusterstacks',
          name:      stack.metadata?.name,
        },
      });
    },

    async onDeleteStack(stack) {
      const ns   = stack.metadata?.namespace || 'clusterstacks';
      const name = stack.metadata?.name;

      if (!name) {
        return;
      }
      this.pendingDelete = {
        type: 'stack',
        name,
        ns,
      };
      this.showDeleteDialog = true;
    },

    async onDeleteRelease(release) {
      const ns   = release.metadata?.namespace || 'clusterstacks';
      const name = release.metadata?.name;

      if (!name) {
        return;
      }
      this.pendingDelete = {
        type: 'release',
        name,
        ns,
      };
      this.showDeleteDialog = true;
    },

    async confirmDelete() {
      this.showDeleteDialog = false;
      const { type, name, ns } = this.pendingDelete || {};

      this.pendingDelete = null;

      if (!name) {
        return;
      }

      try {
        if (type === 'stack') {
          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstacks/${ name }`,
          });
        } else {
          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstackreleases/${ name }`,
          });
        }
        await this.load();
      } catch (e) {
        this.error = e?.message || this.t(
          type === 'stack' ? 'clusterstacks.errors.deleteStack' : 'clusterstacks.errors.deleteRelease'
        );
      }
    },

    cancelDelete() {
      this.showDeleteDialog = false;
      this.pendingDelete    = null;
    },

    async load() {
      this.loading = true;
      this.error = null;

      try {
        const [stacks, releases, clusterClasses, clusters] = await Promise.all([
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstack',
          }).catch(() => []),
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstackrelease',
          }).catch(() => []),
          this.$store.dispatch('management/findAll', {
            type: 'cluster.x-k8s.io.clusterclass',
          }).catch(() => []),
          this.$store.dispatch('management/findAll', {
            type: 'cluster.x-k8s.io.cluster',
          }).catch(() => []),
        ]);

        this.stacks = stacks || [];
        this.releases = releases || [];
        this.clusterClasses = clusterClasses || [];
        this.clusters = clusters || [];
      } catch (e) {
        this.error = this.t('clusterstacks.errors.loadStacks');
        console.error(e); // eslint-disable-line no-console
      } finally {
        this.loading = false;
      }
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.clusterstacks-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header-actions {
  display: flex;
  gap: 8px;
}

.loading-placeholder,
.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.stacks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}
</style>
