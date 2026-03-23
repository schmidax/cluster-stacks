<template>
  <div class="clusterstacks-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.stacks.title') }}</h1>
      <button class="btn role-secondary" @click="load">
        <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
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

    <div v-else-if="!stacks.length" class="no-data">
      {{ t('clusterstacks.stacks.noData') }}
    </div>

    <div v-else class="stacks-grid">
      <ClusterStackCard
        v-for="stack in stacks"
        :key="stack.metadata.uid"
        :stack="stack"
        :releases="releasesByStack[stack.metadata.name] || []"
        :cluster-classes="clusterClassesByStack[stack.metadata.name] || []"
      />
    </div>
  </div>
</template>

<script>
import ClusterStackCard from '../../components/ClusterStackCard.vue';

export default {
  name: 'ClusterStacksIndex',

  components: { ClusterStackCard },

  data() {
    return {
      stacks:               [],
      releases:             [],
      clusterClasses:       [],
      loading:              false,
      error:                null,
    };
  },

  computed: {
    releasesByStack() {
      const map = {};
      for (const release of this.releases) {
        const stackName = release.spec?.clusterStack?.split('-')[0] || '';
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
  },

  async mounted() {
    await this.load();
  },

  methods: {
    async load() {
      this.loading = true;
      this.error = null;

      try {
        const [stacks, releases, clusterClasses] = await Promise.all([
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstack',
          }).catch(() => []),
          this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstackrelease',
          }).catch(() => []),
          this.$store.dispatch('management/findAll', {
            type: 'cluster.x-k8s.io.clusterclass',
          }).catch(() => []),
        ]);

        this.stacks = stacks || [];
        this.releases = releases || [];
        this.clusterClasses = clusterClasses || [];
      } catch (e) {
        this.error = this.t('clusterstacks.errors.loadStacks');
        console.error(e); // eslint-disable-line no-console
      } finally {
        this.loading = false;
      }
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
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
