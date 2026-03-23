<template>
  <div class="clusterstacks-dashboard">
    <div class="dashboard-header">
      <h1>{{ t('clusterstacks.dashboard.title') }}</h1>
      <p class="description">{{ t('clusterstacks.dashboard.description') }}</p>
    </div>

    <div class="dashboard-cards">
      <div class="dashboard-card" @click="navigate('clusters')">
        <div class="card-icon">
          <i class="icon icon-cluster" />
        </div>
        <div class="card-content">
          <h3>{{ t('clusterstacks.dashboard.cards.clusters.title') }}</h3>
          <p>{{ t('clusterstacks.dashboard.cards.clusters.description') }}</p>
          <div class="card-stat" v-if="clusterCount !== null">
            {{ clusterCount }} {{ t('clusterstacks.nav.clusters') }}
          </div>
        </div>
      </div>

      <div class="dashboard-card" @click="navigate('stacks')">
        <div class="card-icon">
          <i class="icon icon-copy" />
        </div>
        <div class="card-content">
          <h3>{{ t('clusterstacks.dashboard.cards.stacks.title') }}</h3>
          <p>{{ t('clusterstacks.dashboard.cards.stacks.description') }}</p>
          <div class="card-stat" v-if="stackCount !== null">
            {{ stackCount }} {{ t('clusterstacks.nav.stacks') }}
          </div>
        </div>
      </div>

      <div class="dashboard-card" @click="navigate('openstack')">
        <div class="card-icon">
          <i class="icon icon-globe" />
        </div>
        <div class="card-content">
          <h3>{{ t('clusterstacks.dashboard.cards.openstack.title') }}</h3>
          <p>{{ t('clusterstacks.dashboard.cards.openstack.description') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ROUTES } from '../config/clusterstacks';

export default {
  name: 'ClusterStacksDashboard',

  data() {
    return {
      clusterCount: null,
      stackCount:   null,
    };
  },

  async mounted() {
    await this.loadStats();
  },

  methods: {
    async loadStats() {
      try {
        const clusters = await this.$store.dispatch('management/findAll', {
          type: 'cluster.x-k8s.io.cluster',
        });
        this.clusterCount = clusters?.length ?? 0;
      } catch {
        this.clusterCount = 0;
      }

      try {
        const stacks = await this.$store.dispatch('management/findAll', {
          type: 'clusterstack.x-k8s.io.clusterstack',
        });
        this.stackCount = stacks?.length ?? 0;
      } catch {
        this.stackCount = 0;
      }
    },

    navigate(section) {
      const routeMap = {
        clusters:  ROUTES.CLUSTERS,
        stacks:    ROUTES.STACKS,
        openstack: ROUTES.OPENSTACK,
      };
      this.$router.push({ name: routeMap[section] });
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.clusterstacks-dashboard {
  padding: 20px;
}

.dashboard-header {
  margin-bottom: 30px;

  h1 {
    margin-bottom: 8px;
  }

  .description {
    color: var(--muted);
  }
}

.dashboard-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.dashboard-card {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: box-shadow 0.2s;
  background: var(--box-bg);

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-color: var(--primary);
  }

  .card-icon {
    margin-right: 16px;
    font-size: 2em;
    color: var(--primary);
  }

  .card-content {
    h3 {
      margin: 0 0 6px 0;
    }

    p {
      margin: 0 0 8px 0;
      color: var(--muted);
      font-size: 0.9em;
    }

    .card-stat {
      font-weight: 600;
      color: var(--primary);
    }
  }
}
</style>
