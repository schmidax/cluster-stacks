<template>
  <div class="openstack-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.openstack.credentials.title') }}</h1>
      <button class="btn role-primary" @click="createCredential">
        {{ t('clusterstacks.openstack.createBtn') }}
      </button>
    </div>

    <!-- Rancher project filter -->
    <div v-if="projects.length" class="project-filter">
      <label class="project-filter-label">{{ t('clusterstacks.openstack.credentials.filterByProject') }}</label>
      <select v-model="selectedProject" class="project-select">
        <option value="">{{ t('clusterstacks.openstack.credentials.allProjects') }}</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">
          {{ p.spec && p.spec.displayName ? p.spec.displayName : p.id }}
        </option>
      </select>
    </div>

    <div v-if="!filteredCredentials.length" class="no-data">
      {{ t('clusterstacks.openstack.noData') }}
    </div>

    <div v-else class="credential-list">
      <div
        v-for="cred in filteredCredentials"
        :key="cred.name"
        class="credential-item"
      >
        <div class="cred-name">{{ cred.name }}</div>
        <div class="cred-detail">{{ cred.authUrl }}</div>
        <div class="cred-actions">
          <button class="btn btn-sm role-secondary" @click="editCredential(cred)">
            {{ t('clusterstacks.common.edit') }}
          </button>
          <button class="btn btn-sm role-danger" @click="deleteCredential(cred)">
            {{ t('clusterstacks.common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ROUTES } from '../../config/clusterstacks';
import { parseCloudsYaml } from '../../services/openstack-api';

export default {
  name: 'OpenstackCredentialsList',

  data() {
    return {
      credentials:     [],
      projects:        [],
      selectedProject: '',
    };
  },

  computed: {
    filteredCredentials() {
      if (!this.selectedProject) {
        return this.credentials;
      }

      return this.credentials.filter(
        (cred) => cred.projectId === this.selectedProject,
      );
    },
  },

  async mounted() {
    await Promise.all([this.loadCredentials(), this.loadProjects()]);
  },

  methods: {
    async loadCredentials() {
      try {
        const nsResponse = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });
        const csoNamespaces = (nsResponse?.items || []).filter(
          (ns) => ns.metadata.name.startsWith('cso-') && ns.metadata.name !== 'cso-system',
        );

        const results = await Promise.allSettled(
          csoNamespaces.map((ns) => this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/api/v1/namespaces/${ns.metadata.name}/secrets/openstack`,
          })),
        );

        this.credentials = results
          .filter((r) => r.status === 'fulfilled')
          .map((r, i) => {
            const s = r.value;
            const ns = s.metadata.namespace;
            const nsObj = csoNamespaces.find((n) => n.metadata.name === ns);
            const projectId = nsObj?.metadata?.annotations?.['field.cattle.io/projectId'] || '';
            const cloudsYaml = atob(s.data?.['clouds.yaml'] || '');
            let authUrl = '';

            try {
              authUrl = parseCloudsYaml(cloudsYaml).authUrl;
            } catch {}

            return {
              name:      ns.startsWith('cso-') ? ns.slice(4) : ns,
              namespace: ns,
              authUrl,
              cloudsYaml,
              projectId,
              raw:       s,
            };
          });
      } catch {
        this.credentials = [];
      }
    },

    async loadProjects() {
      try {
        const clusterId = this.$route.params.cluster;
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/v3/projects?clusterId=${clusterId}`,
        });

        this.projects = resp?.data || [];
      } catch {
        this.projects = [];
      }
    },

    createCredential() {
      this.$router.push({ name: ROUTES.OPENSTACK_CREATE });
    },

    editCredential(cred) {
      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { namespace: cred.namespace },
      });
    },

    async deleteCredential(cred) {
      if (!window.confirm(`Delete credentials for project "${cred.name}"?`)) {
        return;
      }
      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/api/v1/namespaces/${cred.namespace}/secrets/openstack`,
        });
        await this.loadCredentials();
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
.openstack-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.project-filter {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;

  .project-filter-label {
    font-weight: 600;
    white-space: nowrap;
  }

  .project-select {
    min-width: 200px;
  }
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.credential-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.credential-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--box-bg);

  .cred-name {
    font-weight: 600;
    flex: 0 0 200px;
  }

  .cred-detail {
    flex: 1;
    color: var(--muted);
    font-size: 0.9em;
    font-family: monospace;
  }

  .cred-actions {
    display: flex;
    gap: 8px;
  }
}
</style>

