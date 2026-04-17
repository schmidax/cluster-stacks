<template>
  <div class="objectstorage-page">
    <header v-if="!embedded" class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.objectstorage.title') }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <!-- Slot content -->
        </div>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="loading">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.objectstorage.loading') }}
    </div>

    <!-- No data -->
    <div v-else-if="!credentials.length" class="no-data">
      {{ t('clusterstacks.objectstorage.noData') }}
    </div>

    <!-- Credential cards -->
    <div v-else class="credential-cards">
      <div v-if="!embedded" class="global-actions">
        <button class="btn btn-sm role-secondary" @click="toggleAll">
          {{ allExpanded ? t('clusterstacks.objectstorage.collapseAll') : t('clusterstacks.objectstorage.expandAll') }}
        </button>
        <button class="btn btn-sm role-secondary" @click="refresh">
          <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
        </button>
      </div>

      <div
        v-for="cred in credentials"
        :key="cred.namespace"
        class="credential-card"
        :class="{ expanded: embedded || expandedCredentials[cred.namespace] }"
      >
        <!-- Card header -->
        <div v-if="!embedded" class="card-header" @click="toggleCredential(cred.namespace)">
          <i class="icon" :class="expandedCredentials[cred.namespace] ? 'icon-chevron-down' : 'icon-chevron-right'" />
          <div class="header-info">
            <span class="cred-name">{{ cred.name }}</span>
            <span class="cred-meta">{{ cred.authUrl }} — {{ cred.osProjectName }}</span>
          </div>
          <div class="header-badges">
            <span v-if="cred.ec2Credentials && cred.ec2Credentials.length" class="badge ec2-badge" :title="t('clusterstacks.objectstorage.ec2Credentials')">
              EC2: {{ cred.ec2Credentials.length }}
            </span>
            <span v-if="cred.containers" class="badge container-badge" :title="t('clusterstacks.objectstorage.containers')">
              <i class="icon icon-folder" /> {{ cred.containers.length }}
            </span>
            <span v-if="cred.loadingData" class="badge loading-badge">
              <i class="icon icon-spinner icon-spin" />
            </span>
          </div>
        </div>

        <!-- Expanded content -->
        <div v-if="embedded || expandedCredentials[cred.namespace]" class="card-body">
          <!-- Loading per credential -->
          <div v-if="cred.loadingData" class="loading-inline">
            <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
          </div>

          <template v-else>
            <!-- EC2 Credentials section -->
            <div class="section ec2-section">
              <div class="section-header">
                <h3>{{ t('clusterstacks.objectstorage.ec2Credentials') }}</h3>
                <button class="btn btn-sm role-primary" @click="createEc2(cred)">
                  <i class="icon icon-plus" /> {{ t('clusterstacks.objectstorage.createEc2') }}
                </button>
              </div>

              <div v-if="cred.ec2Error" class="banner banner-error">
                {{ cred.ec2Error }}
              </div>

              <div v-else-if="!cred.ec2Credentials || !cred.ec2Credentials.length" class="no-data-inline">
                {{ t('clusterstacks.objectstorage.noEc2') }}
              </div>

              <table v-else class="sortable-table">
                <thead>
                  <tr>
                    <th>{{ t('clusterstacks.objectstorage.accessKey') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.secretKey') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ec2 in cred.ec2Credentials" :key="ec2.id">
                    <td class="access-key-cell">
                      <code>{{ ec2.parsedBlob?.access || ec2.id }}</code>
                    </td>
                    <td class="secret-key-cell">
                      <code v-if="visibleSecrets[ec2.id]">{{ ec2.parsedBlob?.secret || '—' }}</code>
                      <code v-else>••••••••••••</code>
                      <button class="btn btn-sm role-link secret-toggle" @click.stop="toggleSecret(ec2.id)">
                        {{ visibleSecrets[ec2.id] ? t('clusterstacks.objectstorage.hideSecret') : t('clusterstacks.objectstorage.showSecret') }}
                      </button>
                    </td>
                    <td>
                      <button
                        class="btn btn-sm role-link has-tooltip"
                        :title="t('clusterstacks.objectstorage.deleteEc2')"
                        @click="deleteEc2(cred, ec2)"
                      >
                        <i class="icon icon-trash" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Containers section -->
            <div class="section containers-section">
              <div class="section-header">
                <h3>{{ t('clusterstacks.objectstorage.containers') }}</h3>
              </div>

              <div v-if="cred.containerError" class="banner banner-error">
                {{ cred.containerError }}
              </div>

              <div v-else-if="!cred.containers || !cred.containers.length" class="no-data-inline">
                {{ t('clusterstacks.objectstorage.noContainers') }}
              </div>

              <table v-else class="sortable-table">
                <thead>
                  <tr>
                    <th>{{ t('clusterstacks.objectstorage.containerName') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.objects') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.size') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.inUse') }}</th>
                    <th>{{ t('clusterstacks.objectstorage.actions') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in cred.containers" :key="c.name">
                    <td><code>{{ c.name }}</code></td>
                    <td>{{ c.count }}</td>
                    <td>{{ formatBytes(c.bytes) }}</td>
                    <td>
                      <span v-if="getContainerUsage(cred.namespace, c.name)" class="in-use-badge" :title="getContainerUsageTooltip(cred.namespace, c.name)">
                        <i class="icon icon-dot-open text-warning" />
                        {{ t('clusterstacks.objectstorage.inUse') }}
                      </span>
                      <span v-else class="not-in-use">—</span>
                    </td>
                    <td>
                      <button
                        class="btn btn-sm role-link has-tooltip"
                        :disabled="!!getContainerUsage(cred.namespace, c.name)"
                        :title="getContainerUsage(cred.namespace, c.name) ? t('clusterstacks.objectstorage.cannotDelete') : t('clusterstacks.objectstorage.deleteContainer')"
                        @click="deleteContainer(cred, c)"
                      >
                        <i class="icon icon-trash" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Create container -->
              <div class="create-container-row">
                <div class="create-container-input">
                  <LabeledInput
                    :value="newContainerNames[cred.namespace] || ''"
                    :label="t('clusterstacks.objectstorage.containerName')"
                    :placeholder="t('clusterstacks.objectstorage.containerNamePlaceholder')"
                    @update:value="newContainerNames = { ...newContainerNames, [cred.namespace]: $event }"
                  />
                </div>
                <button
                  class="btn btn-sm role-primary"
                  :disabled="!newContainerNames[cred.namespace] || cred.creatingContainer"
                  @click="createContainer(cred)"
                >
                  <i v-if="cred.creatingContainer" class="icon icon-spinner icon-spin" />
                  <i v-else class="icon icon-plus" />
                  {{ t('clusterstacks.objectstorage.createContainer') }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import { OpenStackApiService, parseCloudsYaml } from '../../services/openstack-api';

export default {
  name: 'ObjectStoragePage',

  props: {
    forcedCredentialNamespace: {
      type:    String,
      default: '',
    },
    embedded: {
      type:    Boolean,
      default: false,
    },
  },

  components: { LabeledInput },

  data() {
    return {
      loading:               true,
      credentials:           [],
      expandedCredentials:   {},
      newContainerNames:     {},
      visibleSecrets:        {},
      clustersByNamespace:   {},
    };
  },

  computed: {
    allExpanded() {
      return this.credentials.length > 0
        && this.credentials.every((c) => this.expandedCredentials[c.namespace]);
    },
  },

  watch: {
    forcedCredentialNamespace() {
      this.refresh();
    },
  },

  async mounted() {
    await this.loadAll();
  },

  methods: {
    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },

    // ── Data loading ──────────────────────────────────────────────────

    async loadAll() {
      this.loading = true;

      try {
        let visibleNamespaces = [];

        try {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });
          visibleNamespaces = (nsResponse?.items || []).filter(
            (ns) => {
              const nsName = ns.metadata?.name || '';

              return nsName.startsWith('cso-') && nsName !== 'cso-system';
            },
          );
        } catch {
          const nsList = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
          });

          visibleNamespaces = (nsList || [])
            .filter((ns) => {
              const nsName = ns.metadata?.name || '';

              return nsName.startsWith('cso-') && nsName !== 'cso-system';
            })
            .map((ns) => ({ metadata: { name: ns.metadata?.name || '' } }))
            .filter((ns) => ns.metadata.name);
        }

        // Load credentials + clusters per namespace
        const results = await Promise.allSettled(
          visibleNamespaces.map(async(ns) => {
            const nsName = ns.metadata.name;
            const [secretResult, clusterResult] = await Promise.allSettled([
              this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/api/v1/namespaces/${ nsName }/secrets/openstack`,
              }),
              this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ nsName }/clusters`,
              }),
            ]);

            if (secretResult.status === 'rejected') {
              return null;
            }

            return {
              secret:   secretResult.value,
              clusters: clusterResult.status === 'fulfilled'
                ? (clusterResult.value?.items || [])
                : [],
            };
          }),
        );

        const creds = [];

        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value) {
            continue;
          }

          const { secret: s, clusters } = r.value;
          const ns = s.metadata.namespace;
          const cloudsYaml = atob(s.data?.['clouds.yaml'] || '');
          let authUrl = '';
          let osProjectName = '';

          try {
            const parsed = parseCloudsYaml(cloudsYaml);

            authUrl       = parsed.authUrl || '';
            osProjectName = parsed.projectName || '';
          } catch { /* ignore */ }

          this.clustersByNamespace[ns] = clusters;

          creds.push({
            name:               ns.startsWith('cso-') ? ns.slice(4) : ns,
            namespace:          ns,
            authUrl,
            osProjectName,
            cloudsYaml,
            ec2Credentials:     null,
            ec2Error:           null,
            containers:         null,
            containerError:     null,
            loadingData:        false,
            creatingContainer:  false,
          });
        }

        const forcedNamespace = String(this.forcedCredentialNamespace || '').trim();
        const filteredCreds = forcedNamespace
          ? creds.filter((cred) => cred.namespace === forcedNamespace)
          : creds;

        this.credentials = filteredCreds;

        // Pre-load summary data (EC2 + container counts) for all credentials
        await this.loadAllSummaries();

        // Auto-expand and load data for single credential in standalone mode.
        if (!this.embedded && this.credentials.length === 1) {
          this.toggleCredential(this.credentials[0].namespace);
        } else if (this.embedded && this.credentials.length === 1) {
          await this.loadCredentialData(this.credentials[0]);
        }
      } catch {
        this.credentials = [];
      } finally {
        this.loading = false;
      }
    },

    async loadAllSummaries() {
      await Promise.allSettled(
        this.credentials.map(async(cred, idx) => {
          try {
            const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

            await api.getToken();

            const [ec2Result, containerResult] = await Promise.allSettled([
              api.listEC2Credentials(),
              api.listContainers(),
            ]);

            const patch = {};

            if (ec2Result.status === 'fulfilled') {
              patch.ec2Credentials = ec2Result.value;
            } else {
              patch.ec2Credentials = [];
            }

            if (containerResult.status === 'fulfilled') {
              patch.containers = containerResult.value;
            } else {
              patch.containers = [];
            }

            this.updateCred(idx, patch);
          } catch {
            // Silently ignore — detail loading will retry when expanding
          }
        }),
      );
    },

    async loadCredentialData(cred) {
      const idx = this.credentials.findIndex((c) => c.namespace === cred.namespace);

      if (idx < 0 || cred.loadingData) {
        return;
      }

      this.updateCred(idx, { loadingData: true, ec2Error: null, containerError: null });

      try {
        const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

        await api.getToken();

        // Load EC2 credentials + containers in parallel
        const [ec2Result, containerResult] = await Promise.allSettled([
          api.listEC2Credentials(),
          api.listContainers(),
        ]);

        const patch = {};

        if (ec2Result.status === 'fulfilled') {
          patch.ec2Credentials = ec2Result.value;
        } else {
          patch.ec2Error = this.t('clusterstacks.objectstorage.errors.loadEc2');
          patch.ec2Credentials = [];
        }

        if (containerResult.status === 'fulfilled') {
          patch.containers = containerResult.value;
        } else {
          patch.containerError = this.t('clusterstacks.objectstorage.errors.loadContainers');
          patch.containers = [];
        }

        this.updateCred(idx, { ...patch, loadingData: false });
      } catch {
        this.updateCred(idx, {
          ec2Error:       this.t('clusterstacks.objectstorage.errors.loadEc2'),
          containerError: this.t('clusterstacks.objectstorage.errors.loadContainers'),
          ec2Credentials: [],
          containers:     [],
          loadingData:    false,
        });
      }
    },

    // ── Expand / collapse ─────────────────────────────────────────────

    toggleCredential(ns) {
      const current = !!this.expandedCredentials[ns];
      const newVal = { ...this.expandedCredentials, [ns]: !current };

      this.expandedCredentials = newVal;

      if (!current) {
        const cred = this.credentials.find((c) => c.namespace === ns);

        if (cred && cred.containers === null) {
          this.loadCredentialData(cred);
        }
      }
    },

    toggleAll() {
      if (this.allExpanded) {
        this.expandedCredentials = {};
      } else {
        const map = {};

        for (const c of this.credentials) {
          map[c.namespace] = true;

          if (c.containers === null) {
            this.loadCredentialData(c);
          }
        }
        this.expandedCredentials = map;
      }
    },

    // ── Container CRUD ────────────────────────────────────────────────

    async createContainer(cred) {
      const name = (this.newContainerNames[cred.namespace] || '').trim();
      const idx = this.credentials.findIndex((c) => c.namespace === cred.namespace);

      if (!name || idx < 0) {
        return;
      }

      this.updateCred(idx, { creatingContainer: true });

      try {
        const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

        await api.createContainer(name);

        this.newContainerNames = { ...this.newContainerNames, [cred.namespace]: '' };

        // Reload containers
        const containers = await api.listContainers();

        this.updateCred(idx, { containers, creatingContainer: false });
      } catch {
        this.updateCred(idx, {
          containerError:    this.t('clusterstacks.objectstorage.errors.createContainer'),
          creatingContainer: false,
        });
      }
    },

    async deleteContainer(cred, container) {
      if (this.getContainerUsage(cred.namespace, container.name)) {
        return;
      }

      const msg = this.t('clusterstacks.objectstorage.deleteContainerConfirm', { name: container.name });

      if (!window.confirm(msg)) {
        return;
      }

      const idx = this.credentials.findIndex((c) => c.namespace === cred.namespace);

      try {
        const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

        await api.deleteContainer(container.name);

        if (idx >= 0) {
          this.updateCred(idx, {
            containers: (cred.containers || []).filter((c) => c.name !== container.name),
          });
        }
      } catch {
        if (idx >= 0) {
          this.updateCred(idx, {
            containerError: this.t('clusterstacks.objectstorage.errors.deleteContainer'),
          });
        }
      }
    },

    // ── EC2 Credential CRUD ───────────────────────────────────────────

    async createEc2(cred) {
      const idx = this.credentials.findIndex((c) => c.namespace === cred.namespace);

      if (idx < 0) {
        return;
      }

      try {
        const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

        await api.createEC2Credential();

        // Reload EC2 credentials
        const ec2 = await api.listEC2Credentials();

        this.updateCred(idx, { ec2Credentials: ec2, ec2Error: null });
      } catch {
        this.updateCred(idx, { ec2Error: this.t('clusterstacks.objectstorage.errors.createEc2') });
      }
    },

    async deleteEc2(cred, ec2) {
      const access = ec2.parsedBlob?.access || ec2.id;
      const msg = this.t('clusterstacks.objectstorage.deleteEc2Confirm', { access });

      if (!window.confirm(msg)) {
        return;
      }

      const idx = this.credentials.findIndex((c) => c.namespace === cred.namespace);

      try {
        const api = new OpenStackApiService(cred.cloudsYaml, this.$store);

        await api.deleteEC2Credential(ec2.id);

        if (idx >= 0) {
          this.updateCred(idx, {
            ec2Credentials: (cred.ec2Credentials || []).filter((e) => e.id !== ec2.id),
          });
        }
      } catch {
        if (idx >= 0) {
          this.updateCred(idx, { ec2Error: this.t('clusterstacks.objectstorage.errors.deleteEc2') });
        }
      }
    },

    // ── Cluster usage check ───────────────────────────────────────────

    getContainerUsage(namespace, containerName) {
      const clusters = this.clustersByNamespace[namespace] || [];

      for (const cluster of clusters) {
        const variables = cluster.spec?.topology?.variables || [];

        for (const v of variables) {
          // Check direct variable value
          if (v.name === 'etcdBackupContainer' && v.value === containerName) {
            return cluster.metadata?.name || 'unknown';
          }

          // Check nested value.bucket (as user described)
          if (v.value && typeof v.value === 'object' && v.value.bucket === containerName) {
            return cluster.metadata?.name || 'unknown';
          }
        }
      }

      return null;
    },

    getContainerUsageTooltip(namespace, containerName) {
      const clusterName = this.getContainerUsage(namespace, containerName);

      if (!clusterName) {
        return '';
      }

      return this.t('clusterstacks.objectstorage.inUseByCluster', { name: clusterName });
    },

    // ── Secret visibility toggle ──────────────────────────────────────

    toggleSecret(id) {
      this.visibleSecrets = { ...this.visibleSecrets, [id]: !this.visibleSecrets[id] };
    },

    // ── Helpers ───────────────────────────────────────────────────────

    formatBytes(bytes) {
      if (!bytes || bytes === 0) {
        return '0 B';
      }

      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      const val = bytes / Math.pow(1024, i);

      return `${ val.toFixed(i > 0 ? 1 : 0) } ${ units[i] }`;
    },

    /**
     * Update a credential object immutably so Vue 3 picks up the change.
     */
    updateCred(idx, patch) {
      const old = this.credentials[idx];

      this.credentials.splice(idx, 1, { ...old, ...patch });
    },

    async refresh() {
      this.expandedCredentials = {};
      this.clustersByNamespace = {};
      await this.loadAll();
    },
  },
};
</script>

<style lang="scss" scoped>
.objectstorage-page {
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

.loading {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;

  .icon {
    margin-right: 6px;
  }
}

.loading-inline {
  padding: 20px;
  text-align: center;
  color: var(--muted);
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.no-data-inline {
  padding: 12px 0;
  color: var(--muted);
  font-style: italic;
}

.global-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  justify-content: flex-end;
}

// ── Credential cards ──────────────────────────────────────────────────

.credential-card {
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  margin-bottom: 12px;
  overflow: hidden;

  &.expanded {
    border-color: var(--primary);
  }
}

.card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  gap: 12px;
  transition: background 0.15s;

  &:hover {
    background: var(--accent-btn);
  }

  > .icon {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--muted);
  }
}

.header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cred-name {
  font-weight: 600;
  font-size: 14px;
}

.cred-meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-badges {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.ec2-badge {
  background: var(--info-banner-bg, rgba(0, 123, 255, 0.1));
  color: var(--info);
}

.container-badge {
  background: var(--success-banner-bg, rgba(40, 167, 69, 0.1));
  color: var(--success);
}

.loading-badge {
  color: var(--muted);
}

// ── Card body ─────────────────────────────────────────────────────────

.card-body {
  border-top: 1px solid var(--border);
  padding: 16px;
}

.section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
}

// ── Tables ────────────────────────────────────────────────────────────

.sortable-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--muted);
    background: var(--accent-btn);
  }

  tr:last-child td {
    border-bottom: none;
  }

  code {
    font-size: 12px;
    background: var(--accent-btn);
    padding: 2px 6px;
    border-radius: 3px;
  }
}

.access-key-cell {
  font-family: monospace;
}

.secret-key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.secret-toggle {
  font-size: 11px !important;
  padding: 0 4px !important;
}

.in-use-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--warning);
  font-weight: 600;
  font-size: 12px;
}

.not-in-use {
  color: var(--muted);
}

.text-warning {
  color: var(--warning);
}

// ── Create container row ──────────────────────────────────────────────

.create-container-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}

.create-container-input {
  flex: 1;
  max-width: 360px;

  :deep(.labeled-input) {
    margin-bottom: 0;
  }
}

// ── Banner ────────────────────────────────────────────────────────────

.banner {
  padding: 10px 14px;
  border-radius: var(--border-radius);
  margin-bottom: 10px;
  font-size: 13px;
}

.banner-error {
  background: var(--error-banner-bg, rgba(220, 53, 69, 0.1));
  color: var(--error);
  border: 1px solid var(--error);
}
</style>
