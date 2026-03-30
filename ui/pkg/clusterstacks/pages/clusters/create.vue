<template>
  <div class="cluster-create-page">
    <!-- ─── EDIT MODE: skip tile selector ─── -->
    <template v-if="isEdit">
      <div class="page-header">
        <h1>{{ t('clusterstacks.clusterCreate.editTitle') }}</h1>
      </div>
      <ClusterForm
        :existing-cluster="existingCluster"
        :cluster-stacks="clusterStacks"
        :selected-stack="selectedStack"
        @save="onSave"
        @cancel="onCancel"
      />
    </template>

    <!-- ─── CREATE MODE ─── -->
    <template v-else>
      <!-- STEP 1: Tile Selector -->
      <template v-if="!selectedStack">
        <div class="page-header">
          <h1>{{ t('clusterstacks.clusterCreate.title') }}</h1>
        </div>
        <p class="step-description">{{ t('clusterstacks.clusterCreate.selectStack') }}</p>

        <div v-if="loadingStacks" class="loading-placeholder">
          <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
        </div>

        <div v-else-if="!stackTiles.length" class="no-data">
          {{ t('clusterstacks.clusterCreate.noStacks') }}
        </div>

        <div v-else class="tile-grid">
          <div
            v-for="tile in stackTiles"
            :key="tile.id"
            class="tile-card"
            @click="selectStack(tile)"
          >
            <div class="tile-icon">
              <i :class="providerIcon(tile.provider)" />
            </div>
            <div class="tile-body">
              <h3 class="tile-title">{{ tile.displayName }}</h3>
              <div class="tile-meta">
                <span class="tile-provider">{{ tile.provider }}</span>
                <span class="tile-sep">·</span>
                <span class="tile-k8s">K8s {{ tile.kubernetesVersion }}</span>
              </div>
              <div v-if="tile.versions.length" class="tile-versions">
                <span class="tile-versions-label">Releases:</span>
                <span v-for="v in tile.versions" :key="v" class="version-badge">{{ v }}</span>
              </div>
              <div class="tile-channel">
                <span class="channel-label" :class="tile.channel">{{ tile.channel }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn role-secondary" @click="onCancel">
            {{ t('clusterstacks.common.cancel') }}
          </button>
        </div>
      </template>

      <!-- STEP 2: Cluster Form -->
      <template v-else>
        <div class="page-header">
          <h1>{{ t('clusterstacks.clusterCreate.title') }}</h1>
          <button class="btn btn-sm role-secondary" @click="selectedStack = null">
            <i class="icon icon-chevron-left" /> {{ t('clusterstacks.clusterCreate.changeStack') }}
          </button>
        </div>
        <div class="selected-stack-banner">
          <i :class="providerIcon(selectedStack.provider)" />
          <span>{{ selectedStack.displayName }}</span>
          <span class="stack-meta">{{ selectedStack.provider }} · K8s {{ selectedStack.kubernetesVersion }}</span>
        </div>
        <ClusterForm
          :existing-cluster="null"
          :cluster-stacks="clusterStacks"
          :selected-stack="selectedStack"
          @save="onSave"
          @cancel="onCancel"
        />
      </template>
    </template>
  </div>
</template>

<script>
import ClusterForm from '../../components/ClusterForm.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClusterCreate',

  components: { ClusterForm },

  data() {
    return {
      existingCluster: null,
      clusterStacks:   [],
      selectedStack:   null,
      loadingStacks:   false,
    };
  },

  computed: {
    isEdit() {
      return !!(this.$route.query.name && this.$route.query.namespace);
    },

    stackTiles() {
      return this.clusterStacks.map((s) => {
        const spec = s.spec || {};
        const status = s.status || {};

        // usableVersions are ClusterStack release versions (v1, v2, v3), always ensure it's an array
        const rawVersions = status.usableVersions || spec.versions || [];
        const versions = Array.isArray(rawVersions) ? rawVersions : [rawVersions];

        return {
          id:                s.metadata?.uid || s.metadata?.name,
          name:              spec.name || s.metadata?.name || '',
          displayName:       `${ spec.provider || 'unknown' }-${ spec.name || '' }-${ spec.kubernetesVersion || '' }`,
          provider:          spec.provider || 'unknown',
          kubernetesVersion: spec.kubernetesVersion || '',
          channel:           spec.channel || 'stable',
          versions,
          clusterClassName:  s.metadata?.name || '',
          raw:               s,
        };
      });
    },
  },

  async mounted() {
    await Promise.all([
      this.loadExistingCluster(),
      this.loadClusterStacks(),
    ]);

    // In edit mode, auto-select stack from existing cluster's clusterClass
    if (this.isEdit && this.existingCluster) {
      const cc = this.existingCluster.spec?.topology?.class;

      if (cc) {
        const match = this.stackTiles.find((t) => t.clusterClassName === cc || cc.startsWith(t.clusterClassName));

        if (match) {
          this.selectedStack = match;
        }
      }
    }
  },

  methods: {
    async loadExistingCluster() {
      const { name, namespace } = this.$route.query;

      if (!name || !namespace) {
        return;
      }
      try {
        this.existingCluster = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ namespace }/clusters/${ name }`,
        });
      } catch (e) {
        console.error('Failed to load cluster:', e); // eslint-disable-line no-console
      }
    },

    async loadClusterStacks() {
      this.loadingStacks = true;
      try {
        this.clusterStacks = await this.$store.dispatch('management/findAll', {
          type: 'clusterstack.x-k8s.io.clusterstack',
        }) || [];
      } catch {
        this.clusterStacks = [];
      } finally {
        this.loadingStacks = false;
      }
    },

    selectStack(tile) {
      this.selectedStack = tile;
    },

    providerIcon(provider) {
      const map = {
        openstack: 'icon icon-globe',
        aws:       'icon icon-cloud',
        azure:     'icon icon-cloud',
        docker:    'icon icon-container',
        gcp:       'icon icon-cloud',
      };

      return map[(provider || '').toLowerCase()] || 'icon icon-cluster';
    },

    onSave() {
      this.$router.push({ name: ROUTES.CLUSTERS });
    },

    onCancel() {
      this.$router.push({ name: ROUTES.CLUSTERS });
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-create-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.step-description {
  color: var(--muted);
  margin-bottom: 20px;
  font-size: 14px;
}

.loading-placeholder,
.no-data {
  padding: 60px;
  text-align: center;
  color: var(--muted);
}

// ── Tile Grid ────────────────────────────────────
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.tile-card {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  background: var(--body-bg);

  &:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }
}

.tile-icon {
  font-size: 28px;
  color: var(--primary);
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.tile-body {
  flex: 1;
  min-width: 0;
}

.tile-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
  word-break: break-all;
}

.tile-meta {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}

.tile-sep {
  margin: 0 4px;
}

.tile-versions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
  align-items: center;
}

.tile-versions-label {
  font-size: 11px;
  color: var(--muted);
  margin-right: 2px;
}

.version-badge {
  display: inline-block;
  padding: 1px 6px;
  background: var(--accent-btn);
  border-radius: 10px;
  font-size: 11px;
  font-family: monospace;
}

.tile-channel {
  margin-top: 4px;
}

.channel-label {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;

  &.stable {
    background: rgba(40, 167, 69, 0.12);
    color: var(--success);
  }

  &.custom {
    background: rgba(0, 123, 255, 0.12);
    color: var(--info);
  }
}

// ── Selected stack banner ────────────────────────
.selected-stack-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--accent-btn);
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  margin-bottom: 20px;
  font-weight: 600;

  .icon {
    font-size: 20px;
    color: var(--primary);
  }

  .stack-meta {
    font-weight: 400;
    color: var(--muted);
    margin-left: auto;
    font-size: 13px;
  }
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
