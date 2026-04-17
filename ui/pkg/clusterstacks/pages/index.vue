<template>
  <div class="clusterstacks-dashboard">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.dashboard.title') }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <button class="btn role-secondary" @click="loadOverview">
            <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
          </button>
        </div>
      </div>
    </header>

    <p class="dashboard-description">{{ t('clusterstacks.dashboard.description') }}</p>

    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <div v-else>
      <section class="dashboard-section">
        <div class="section-header">
          <h2>{{ t('clusterstacks.dashboard.quickStart.title') }}</h2>
          <p class="text-muted">{{ quickStartSubtitle }}</p>
        </div>

        <div class="quick-start-grid">
          <button
            v-for="item in quickStartItems"
            :key="item.key"
            class="quick-start-card"
            @click="go(item.route, item.query || {})"
          >
            <i class="icon" :class="item.icon" />
            <span class="quick-start-title">{{ item.title }}</span>
            <span class="quick-start-text">{{ item.description }}</span>
          </button>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-header">
          <h2>{{ t('clusterstacks.dashboard.overview.title') }}</h2>
          <p class="text-muted">{{ t('clusterstacks.dashboard.overview.subtitle') }}</p>
        </div>

        <div class="resource-grid">
          <button class="resource-card" @click="go(ROUTES.CLUSTERS)">
            <span class="resource-label">{{ t('clusterstacks.dashboard.overview.metrics.clusters') }}</span>
            <strong class="resource-value">{{ metrics.clusters }}</strong>
            <span v-if="metrics.clusters > 0" class="resource-status">
              {{ metrics.clustersProvisioned }} {{ t('clusterstacks.dashboard.overview.metrics.provisioned') }} &middot; {{ metrics.clusters - metrics.clustersProvisioned }} {{ t('clusterstacks.dashboard.overview.metrics.other') }}
            </span>
          </button>
          <button class="resource-card" @click="go(ROUTES.STACKS)">
            <span class="resource-label">{{ t('clusterstacks.dashboard.overview.metrics.stacks') }}</span>
            <strong class="resource-value">{{ metrics.stacks }}</strong>
          </button>
          <button class="resource-card" @click="go(ROUTES.OPENSTACK)">
            <span class="resource-label">{{ t('clusterstacks.dashboard.overview.metrics.projects') }}</span>
            <strong class="resource-value">{{ metrics.projects }}</strong>
          </button>
          <button class="resource-card" @click="go(ROUTES.OPENSTACK)">
            <span class="resource-label">{{ t('clusterstacks.dashboard.overview.metrics.credentials') }}</span>
            <strong class="resource-value">{{ metrics.credentials }}</strong>
          </button>
          <button v-if="currentUserIsAdmin" class="resource-card" @click="go(ROUTES.CAPI_PROVIDERS)">
            <span class="resource-label">{{ t('clusterstacks.dashboard.overview.metrics.providers') }}</span>
            <strong class="resource-value">{{ metrics.providers }}</strong>
          </button>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-header">
          <h2>{{ t('clusterstacks.dashboard.lists.title') }}</h2>
        </div>

        <div class="lists-grid">
          <div class="list-card">
            <div class="list-header">
              <h3>{{ t('clusterstacks.dashboard.lists.clusters') }}</h3>
              <button class="btn btn-sm role-secondary" @click="go(ROUTES.CLUSTERS)">
                {{ t('clusterstacks.dashboard.links.viewAllClusters') }}
              </button>
            </div>
            <div v-if="!recentClusters.length" class="text-muted">
              {{ t('clusterstacks.dashboard.lists.noClusters') }}
            </div>
            <ul v-else class="overview-list">
              <li v-for="cluster in recentClusters" :key="cluster.id">
                <button class="link-btn" @click="go(ROUTES.CLUSTERS_DETAIL, { namespace: cluster.namespace, name: cluster.name })">
                  <span class="name">{{ cluster.name }}</span>
                  <span class="meta">{{ cluster.namespace }} · {{ cluster.phase || 'Unknown' }} · {{ cluster.age }}</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="list-card">
            <div class="list-header">
              <h3>{{ t('clusterstacks.dashboard.lists.credentials') }}</h3>
              <button class="btn btn-sm role-secondary" @click="go(ROUTES.OPENSTACK)">
                {{ t('clusterstacks.dashboard.links.viewAllCredentials') }}
              </button>
            </div>
            <div v-if="!recentProjects.length" class="text-muted">
              {{ t('clusterstacks.dashboard.lists.noCredentials') }}
            </div>
            <ul v-else class="overview-list">
              <li v-for="cred in recentProjects" :key="cred.id">
                <button class="link-btn" @click="go(ROUTES.OPENSTACK_DETAIL, { namespace: cred.id, credential: 'openstack' })">
                  <span class="name">{{ cred.displayName }}<span v-if="cred.projectLabel" class="project-label"> ({{ cred.projectLabel }})</span></span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { ROUTES } from '../config/clusterstacks';

const SHARED_CLUSTERSTACKS_NAMESPACE = 'clusterstacks';

export default {
  name: 'ClusterStacksDashboard',

  data() {
    return {
      loading: false,
      currentUserIsAdmin: false,
      metrics: {
        clusters:            0,
        clustersProvisioned: 0,
        stacks:              0,
        projects:            0,
        credentials:         0,
        providers:           0,
      },
      recentClusters: [],
      recentProjects: [],
    };
  },

  computed: {
    ROUTES() {
      return ROUTES;
    },

    quickStartSubtitle() {
      return this.currentUserIsAdmin
        ? this.t('clusterstacks.dashboard.quickStart.subtitleAdmin')
        : this.t('clusterstacks.dashboard.quickStart.subtitleTenant');
    },

    quickStartItems() {
      if (this.currentUserIsAdmin) {
        return [
          {
            key:         'openstack-overview',
            icon:        'icon-globe',
            title:       this.t('clusterstacks.dashboard.quickStart.actions.openstack.title'),
            description: this.t('clusterstacks.dashboard.quickStart.actions.openstack.description'),
            route:       ROUTES.OPENSTACK,
          },
          {
            key:         'create-cluster',
            icon:        'icon-cluster',
            title:       this.t('clusterstacks.dashboard.quickStart.actions.createCluster.title'),
            description: this.t('clusterstacks.dashboard.quickStart.actions.createCluster.description'),
            route:       ROUTES.CLUSTERS_CREATE,
          },
          {
            key:         'management',
            icon:        'icon-gear',
            title:       this.t('clusterstacks.dashboard.quickStart.actions.management.title'),
            description: this.t('clusterstacks.dashboard.quickStart.actions.management.description'),
            route:       ROUTES.CSO_MANAGEMENT,
          },
          {
            key:         'providers',
            icon:        'icon-cluster-management',
            title:       this.t('clusterstacks.dashboard.quickStart.actions.providers.title'),
            description: this.t('clusterstacks.dashboard.quickStart.actions.providers.description'),
            route:       ROUTES.CAPI_PROVIDERS,
          },
        ];
      }

      return [
        {
          key:         'openstack-overview',
          icon:        'icon-globe',
          title:       this.t('clusterstacks.dashboard.quickStart.actions.openstack.title'),
          description: this.t('clusterstacks.dashboard.quickStart.actions.openstack.description'),
          route:       ROUTES.OPENSTACK,
        },
        {
          key:         'create-cluster',
          icon:        'icon-cluster',
          title:       this.t('clusterstacks.dashboard.quickStart.actions.createCluster.title'),
          description: this.t('clusterstacks.dashboard.quickStart.actions.createCluster.description'),
          route:       ROUTES.CLUSTERS_CREATE,
        },
      ];
    },
  },

  async mounted() {
    this.loadCurrentUser();
    await this.loadOverview();
  },

  methods: {
    loadCurrentUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');

      this.currentUserIsAdmin = !!(schema?.resourceMethods || []).includes('PUT');
    },

    async loadOverview() {
      this.loading = true;

      try {
        const namespaces = await this.discoverCsoNamespaces();
        const [clusters, stacks, projects, credentials, providers] = await Promise.all([
          this.loadClusters(namespaces),
          this.loadStacks(namespaces),
          this.loadProjects(namespaces),
          this.loadCredentialCount(namespaces),
          this.loadProviderCount(),
        ]);

        this.metrics.clusters = clusters.length;
        this.metrics.clustersProvisioned = clusters.filter(
          (c) => (c.status?.phase || c.metadata?.labels?.['cluster.x-k8s.io/cluster-phase']) === 'Provisioned',
        ).length;
        this.metrics.stacks = stacks.length;
        this.metrics.projects = projects.length;
        this.metrics.credentials = credentials;
        this.metrics.providers = providers;

        this.recentClusters = clusters
          .slice()
          .sort((a, b) => {
            const aTs = new Date(a.metadata?.creationTimestamp || 0).getTime();
            const bTs = new Date(b.metadata?.creationTimestamp || 0).getTime();

            return bTs - aTs;
          })
          .slice(0, 5)
          .map((c) => ({
            id:        `${ c.metadata?.namespace || '' }/${ c.metadata?.name || '' }`,
            name:      c.metadata?.name || '',
            namespace: c.metadata?.namespace || '',
            phase:     c.status?.phase || '',
            age:       this.formatAge(c.metadata?.creationTimestamp),
          }));

        this.recentProjects = projects.slice(0, 5);
      } catch {
        this.metrics = {
          clusters:            0,
          clustersProvisioned: 0,
          stacks:              0,
          projects:            0,
          credentials:         0,
          providers:           0,
        };
        this.recentClusters = [];
        this.recentProjects = [];
      } finally {
        this.loading = false;
      }
    },

    async loadClusters(namespaces) {
      try {
        const all = await this.$store.dispatch('management/findAll', {
          type: 'cluster.x-k8s.io.cluster',
        });

        if (Array.isArray(all) && all.length) {
          return this.filterLocalCluster(all);
        }
      } catch {
        // namespace fallback below
      }

      const clusters = [];
      const results = await Promise.allSettled(
        namespaces.map(async(ns) => {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ ns }/clusters`,
          });

          return resp?.items || [];
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          clusters.push(...r.value);
        }
      }

      return this.filterLocalCluster(clusters);
    },

    filterLocalCluster(clusters) {
      // Hide local cluster from non-admin users
      if (this.currentUserIsAdmin) {
        return clusters;
      }

      return clusters.filter((c) => c.metadata?.name !== 'local');
    },

    async loadStacks(namespaces) {
      try {
        const all = await this.$store.dispatch('management/findAll', {
          type: 'clusterstack.x-k8s.io.clusterstack',
        });

        if (Array.isArray(all) && all.length) {
          return all;
        }
      } catch {
        // namespace fallback below
      }

      const stacks = [];
      const results = await Promise.allSettled(
        namespaces.map(async(ns) => {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstacks`,
          });

          return resp?.items || [];
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          stacks.push(...r.value);
        }
      }

      return stacks;
    },

    async loadProjects(namespaces) {
      // Build project display-name lookup
      const projectNames = {};

      try {
        const all = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.project',
        });

        for (const p of (all || [])) {
          const displayName = p.spec?.displayName || p.metadata?.name || p.id || '';
          const rawId = String(p.id || '').trim();
          const rawName = String(p.metadata?.name || '').trim();
          const normalizedId = rawId.replace('/', ':');
          const shortId = normalizedId.includes(':') ? normalizedId.split(':').slice(1).join(':') : normalizedId;

          for (const key of [rawId, rawName, normalizedId, shortId]) {
            if (key) {
              projectNames[key] = displayName;
            }
          }
        }
      } catch { /* project lookup optional */ }

      const results = await Promise.allSettled(
        namespaces.map(async(ns) => {
          try {
            const nsObj = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ ns }`,
            });
            const projectId = nsObj?.metadata?.annotations?.['field.cattle.io/projectId'] || '';
            const normalizedId = String(projectId).replace('/', ':');
            const shortId = normalizedId.includes(':') ? normalizedId.split(':').slice(1).join(':') : normalizedId;
            const projectLabel = projectNames[projectId] || projectNames[normalizedId] || projectNames[shortId] || shortId || '';

            return {
              id:           ns,
              displayName:  ns,
              projectLabel,
            };
          } catch {
            return {
              id:           ns,
              displayName:  ns,
              projectLabel: '',
            };
          }
        }),
      );

      return results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);
    },

    async loadCredentialCount(namespaces) {
      const results = await Promise.allSettled(
        namespaces.map(async(ns) => {
          try {
            const secret = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ ns }/secrets/openstack`,
            });

            return secret?.data?.['clouds.yaml'] ? 1 : 0;
          } catch {
            return 0;
          }
        }),
      );

      return results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
    },

    async loadProviderCount() {
      if (!this.currentUserIsAdmin) {
        return 0;
      }

      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/apis/turtles-capi.cattle.io/v1alpha1/capiproviders',
        });

        return (resp?.items || []).length;
      } catch {
        return 0;
      }
    },

    async discoverCsoNamespaces() {
      let namespaces = [];
      const visibleProjectIds = new Set();

      try {
        const projects = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.project',
          opt:  { force: true },
        });

        for (const project of (projects || [])) {
          const rawId = String(project?.id || '').trim();
          const rawName = String(project?.metadata?.name || '').trim();
          const normalizedId = rawId.replace('/', ':');
          const shortId = normalizedId.includes(':') ? normalizedId.split(':').slice(1).join(':') : normalizedId;

          for (const key of [rawId, rawName, normalizedId, shortId]) {
            if (key) {
              visibleProjectIds.add(key);
            }
          }
        }
      } catch {
        // Without visible projects we keep the namespace result empty to avoid leaking cross-project namespaces.
      }

      try {
        const nsResp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });

        namespaces = (nsResp?.items || [])
          .filter((ns) => {
            const nsName = ns?.metadata?.name;

            if (nsName === SHARED_CLUSTERSTACKS_NAMESPACE) {
              return true;
            }

            if (!nsName || !nsName.startsWith('cso-') || nsName === 'cso-system') {
              return false;
            }

            if (!visibleProjectIds.size) {
              return false;
            }

            const projectId = String(ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '').trim();
            const normalizedProjectId = projectId.replace('/', ':');
            const shortProjectId = normalizedProjectId.includes(':') ? normalizedProjectId.split(':').slice(1).join(':') : normalizedProjectId;

            return visibleProjectIds.has(projectId)
              || visibleProjectIds.has(normalizedProjectId)
              || visibleProjectIds.has(shortProjectId);
          })
          .map((ns) => ns.metadata?.name);
      } catch {
        try {
          const nsResult = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
            opt:  { force: true },
          });

          namespaces = (nsResult || [])
            .filter((ns) => {
              const nsName = ns?.metadata?.name || ns?.id;

              if (nsName === SHARED_CLUSTERSTACKS_NAMESPACE) {
                return true;
              }

              if (!nsName || !nsName.startsWith('cso-') || nsName === 'cso-system') {
                return false;
              }

              if (!visibleProjectIds.size) {
                return false;
              }

              const projectId = String(ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '').trim();
              const normalizedProjectId = projectId.replace('/', ':');
              const shortProjectId = normalizedProjectId.includes(':') ? normalizedProjectId.split(':').slice(1).join(':') : normalizedProjectId;

              return visibleProjectIds.has(projectId)
                || visibleProjectIds.has(normalizedProjectId)
                || visibleProjectIds.has(shortProjectId);
            })
            .map((ns) => ns.metadata?.name || ns.id);
        } catch {
          namespaces = [];
        }
      }

      return Array.from(new Set([...namespaces, SHARED_CLUSTERSTACKS_NAMESPACE]));
    },

    go(route, query = {}) {
      this.$router.push({ name: route, query });
    },

    formatAge(ts) {
      if (!ts) {
        return '—';
      }

      const created = new Date(ts).getTime();

      if (!created || Number.isNaN(created)) {
        return '—';
      }

      const ms = Date.now() - created;
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

.dashboard-description {
  color: var(--muted);
  margin: 0 0 18px 0;
}

.loading-placeholder {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.dashboard-section {
  margin-bottom: 22px;
}

.section-header {
  margin-bottom: 10px;

  h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.3;
  }

  p {
    margin: 4px 0 0 0;
  }
}

.quick-start-grid,
.resource-grid,
.lists-grid {
  display: grid;
  gap: 12px;
}

.quick-start-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.resource-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.lists-grid {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.quick-start-card,
.resource-card,
.list-card {
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.quick-start-card,
.resource-card {
  text-align: left;
  padding: 14px;
  cursor: pointer;
}

.quick-start-card {
  display: grid;
  gap: 6px;

  .icon {
    color: var(--link);
  }

  .quick-start-title {
    font-weight: 600;
  }

  .quick-start-text {
    color: var(--muted);
    font-size: 0.92em;
    line-height: 1.35;
  }
}

.resource-card {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .resource-label {
    color: var(--muted);
    font-size: 0.9em;
  }

  .resource-value {
    font-size: 1.4rem;
    line-height: 1.2;
  }

  .resource-status {
    color: var(--muted);
    font-size: 0.8em;
    line-height: 1.3;
  }
}

.list-card {
  padding: 14px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.overview-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.link-btn {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  background: var(--box-bg);
  cursor: pointer;
  display: grid;
  gap: 2px;

  &:hover {
    border-color: var(--link);
  }

  .name {
    font-weight: 600;
    color: var(--body-text);
  }

  .meta {
    color: var(--muted);
    font-size: 0.86em;
  }
    .project-label {
      font-weight: 400;
      color: var(--muted);
    }
}

@media (max-width: 700px) {
  header.with-subheader {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .lists-grid {
    grid-template-columns: 1fr;
  }

  .list-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
