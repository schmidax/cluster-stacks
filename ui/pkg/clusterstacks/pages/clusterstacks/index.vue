<template>
  <div class="clusterstacks-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.stacks.title') }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <button
            v-if="canManageStacks"
            class="btn role-primary mr-10"
            @click="goCreate"
          >
            + {{ t('clusterstacks.stacks.createBtn') }}
          </button>
          <button class="btn role-secondary" @click="load">
            <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
          </button>
        </div>
      </div>
    </header>

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
        :read-only="!canManageStacks"
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
import { isFleetManagedResource } from '../../utils/fleet-management';

const SHARED_CLUSTERSTACKS_NAMESPACE = 'clusterstacks';

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
      currentUser:          {
        isAdmin: false,
      },
    };
  },

  computed: {
    canManageStacks() {
      return !!this.currentUser.isAdmin;
    },
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
        const releasePrefix = releaseName.replace(/-v\d+(?:[-.][a-z0-9]+(?:[.-][a-z0-9]+)*)?$/i, '');

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
     * Supports both v1beta1 (spec.topology.class) and v1beta2 (spec.topology.classRef.name).
     * A release whose name matches a used ClusterClass is considered "in use".
     */
    usedClusterClassNames() {
      const names = new Set();

      for (const cluster of this.clusters) {
        // v1beta1: spec.topology.class (string)
        // v1beta2: spec.topology.classRef.name (object)
        const className = cluster.spec?.topology?.class || cluster.spec?.topology?.classRef?.name;

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
    await this.loadCurrentUser();
    await this.load();
  },

  methods: {
    loadCurrentUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');
      const isAdmin = !!(schema?.resourceMethods || []).includes('PUT');
      this.currentUser = { isAdmin };
    },


    goCreate() {
      if (!this.canManageStacks) {
        return;
      }

      this.$router.push({ name: ROUTES.STACKS_CREATE });
    },

    onEditStack(stack) {
      if (!this.canManageStacks) {
        return;
      }

      if (isFleetManagedResource(stack)) {
        return;
      }

      this.$router.push({
        name:  ROUTES.STACKS_CREATE,
        query: {
          namespace: stack.metadata?.namespace || 'clusterstacks',
          name:      stack.metadata?.name,
        },
      });
    },

    async onDeleteStack(stack) {
      if (!this.canManageStacks) {
        return;
      }

      if (isFleetManagedResource(stack)) {
        return;
      }

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
      if (!this.canManageStacks) {
        return;
      }

      if (isFleetManagedResource(release)) {
        return;
      }

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
        let stacks = [];
        let releases = [];
        let clusterClasses = [];
        let clusters = [];

        // Try cluster-wide first
        const [stacksRes, releasesRes, classesRes, clustersRes] = await Promise.all([
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstack',
          }).catch(() => null),
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstackrelease',
          }).catch(() => null),
          this.$store.dispatch('management/findAll', {
            type: 'cluster.x-k8s.io.clusterclass',
          }).catch(() => null),
          this.$store.dispatch('management/findAll', {
            type: 'cluster.x-k8s.io.cluster',
          }).catch(() => null),
        ]);

        stacks = stacksRes || [];
        releases = releasesRes || [];
        clusterClasses = classesRes || [];
        clusters = clustersRes || [];

        // Namespace-scoped fallback for non-admin users
        const needsFallback = !stacks.length && !releases.length;

        if (needsFallback) {
          const namespaces = await this.discoverCsoNamespaces();

          const [nsSt, nsRel, nsCls] = await Promise.all([
            this.loadNamespaceScoped(namespaces, '/apis/clusterstack.x-k8s.io/v1alpha1', 'clusterstacks'),
            this.loadNamespaceScoped(namespaces, '/apis/clusterstack.x-k8s.io/v1alpha1', 'clusterstackreleases'),
            this.loadNamespaceScoped(namespaces, '/apis/cluster.x-k8s.io/v1beta2', 'clusterclasses'),
          ]);

          stacks = nsSt;
          releases = nsRel;
          clusterClasses = nsCls;
        }

        // Always attempt namespace-scoped cluster load when cluster-wide returned nothing
        // (non-admin users have namespace-scoped access via clusterstacks-capi-access RoleTemplate)
        if (!clusters.length) {
          const namespaces = await this.discoverCsoNamespaces();
          const nsCl = await this.loadNamespaceScoped(namespaces, '/apis/cluster.x-k8s.io/v1beta2', 'clusters');

          clusters = nsCl;
        }

        this.stacks = stacks;
        this.releases = releases;
        this.clusterClasses = clusterClasses;
        this.clusters = clusters;
      } catch (e) {
        this.error = this.t('clusterstacks.errors.loadStacks');
        console.error(e); // eslint-disable-line no-console
      } finally {
        this.loading = false;
      }
    },

    async discoverCsoNamespaces() {
      let namespaces = [];

      try {
        const nsResp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });

        namespaces = (nsResp?.items || [])
          .map((ns) => ns.metadata?.name)
          .filter((ns) => ns && ns.startsWith('cso-') && ns !== 'cso-system');
      } catch {
        try {
          const nsResult = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
            opt:  { force: true },
          });

          namespaces = (nsResult || [])
            .map((ns) => ns.metadata?.name || ns.id)
            .filter((ns) => ns && ns.startsWith('cso-') && ns !== 'cso-system');
        } catch {
          // no namespace access
        }
      }

      return Array.from(new Set([...namespaces, SHARED_CLUSTERSTACKS_NAMESPACE]));
    },

    async loadNamespaceScoped(namespaces, apiBase, resource) {
      const items = [];

      const results = await Promise.allSettled(
        namespaces.map(async(ns) => {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `${ apiBase }/namespaces/${ ns }/${ resource }`,
          });

          return resp?.items || [];
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          items.push(...r.value);
        }
      }

      return items;
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
