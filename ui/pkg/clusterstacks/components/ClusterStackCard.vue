<template>
  <div class="cluster-stack-card">
    <div class="card-header">
      <div class="card-title">
        <h3>{{ stack.metadata.name }}</h3>
        <span class="badge" :class="channelClass">{{ stack.spec?.channel || 'stable' }}</span>
      </div>
      <div class="card-meta">
        <span class="meta-item">
          <i class="icon icon-kubernetes" />
          {{ stack.spec?.kubernetesVersion || t('clusterstacks.common.na') }}
        </span>
        <span class="meta-item">
          <i class="icon icon-tag" />
          {{ stack.spec?.provider || t('clusterstacks.common.na') }}
        </span>
      </div>
    </div>

    <div class="card-body">
      <!-- Health / Conditions -->
      <div class="card-status">
        <span :class="healthClass">
          <i :class="healthIcon" />
          {{ healthLabel }}
        </span>
      </div>

      <!-- Releases -->
      <div class="releases-section">
        <h4>{{ t('clusterstacks.stacks.card.versions') }}</h4>
        <div v-if="!releases.length" class="no-releases">
          {{ t('clusterstacks.stacks.card.noReleases') }}
        </div>
        <div v-else class="release-chips">
          <span
            v-for="release in releases"
            :key="release.metadata.name"
            class="release-chip"
            :class="releaseStatusClass(release)"
            :title="release.metadata.name"
          >
            {{ releaseVersion(release) }}
          </span>
        </div>
      </div>

      <!-- ClusterClasses -->
      <div v-if="clusterClasses.length" class="cc-section">
        <h4>{{ t('clusterstacks.stacks.card.clusterClass') }}</h4>
        <div class="cc-chips">
          <span
            v-for="cc in clusterClasses"
            :key="cc.metadata.name"
            class="cc-chip"
          >
            {{ cc.metadata.name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ClusterStackCard',

  props: {
    stack: {
      type:     Object,
      required: true,
    },
    releases: {
      type:    Array,
      default: () => [],
    },
    clusterClasses: {
      type:    Array,
      default: () => [],
    },
  },

  computed: {
    channelClass() {
      return this.stack.spec?.channel === 'custom' ? 'badge-warning' : 'badge-success';
    },

    readyCondition() {
      return (this.stack.status?.conditions || []).find((c) => c.type === 'Ready');
    },

    healthClass() {
      if (!this.readyCondition) {
        return 'status-unknown';
      }
      return this.readyCondition.status === 'True' ? 'status-ok' : 'status-error';
    },

    healthIcon() {
      if (!this.readyCondition) {
        return 'icon icon-question-mark';
      }
      return this.readyCondition.status === 'True'
        ? 'icon icon-checkmark text-success'
        : 'icon icon-warning text-error';
    },

    healthLabel() {
      if (!this.readyCondition) {
        return this.t('clusterstacks.common.na');
      }
      return this.readyCondition.status === 'True'
        ? this.readyCondition.type
        : (this.readyCondition.reason || this.readyCondition.message || 'Not Ready');
    },
  },

  methods: {
    releaseVersion(release) {
      // Extract version from name pattern: <stack-name>-<version>
      const name = release.metadata.name || '';
      const parts = name.split('-');
      return parts[parts.length - 1] || name;
    },

    releaseStatusClass(release) {
      const ready = release.status?.ready;
      if (ready === true) {
        return 'chip-success';
      }
      if (ready === false) {
        return 'chip-error';
      }
      return 'chip-pending';
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-stack-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--box-bg);
  overflow: hidden;
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  background: var(--nav-bg);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;

  h3 {
    margin: 0;
    font-size: 1.05em;
  }
}

.badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;

  &.badge-success { background: var(--success-banner-bg); color: var(--success); }
  &.badge-warning { background: var(--warning-banner-bg); color: var(--warning); }
}

.card-meta {
  display: flex;
  gap: 16px;

  .meta-item {
    font-size: 0.9em;
    color: var(--muted);

    i { margin-right: 4px; }
  }
}

.card-body {
  padding: 16px;
}

.card-status {
  margin-bottom: 12px;

  .status-ok    { color: var(--success); }
  .status-error { color: var(--error); }
  .status-unknown { color: var(--muted); }
}

.releases-section,
.cc-section {
  margin-top: 12px;

  h4 {
    margin: 0 0 8px 0;
    font-size: 0.8em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
}

.release-chips,
.cc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.release-chip,
.cc-chip {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-family: monospace;

  &.chip-success { background: var(--success-banner-bg); color: var(--success); }
  &.chip-error   { background: var(--error-banner-bg);   color: var(--error); }
  &.chip-pending { background: var(--info-banner-bg);    color: var(--info); }
}

.cc-chip {
  background: var(--accent-btn);
  color: var(--primary);
}

.no-releases {
  font-size: 0.9em;
  color: var(--muted);
  font-style: italic;
}
</style>
