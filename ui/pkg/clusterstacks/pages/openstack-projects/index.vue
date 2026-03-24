<template>
  <div class="openstack-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.openstack.credentials.title') }}</h1>
      <button class="btn role-primary" @click="createCredential">
        {{ t('clusterstacks.openstack.createBtn') }}
      </button>
    </div>

    <div v-if="!credentials.length" class="no-data">
      {{ t('clusterstacks.openstack.noData') }}
    </div>

    <div v-else>
      <div
        v-for="group in groupedCredentials"
        :key="group.projectId"
        class="project-group"
      >
        <h2 class="project-group-title">{{ group.projectName }}</h2>
        <div class="credential-list">
          <div
            v-for="cred in group.credentials"
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
      credentials: [],
      projects:    [],
    };
  },

  computed: {
    projectMap() {
      // Map from project id (may be "clusterId:projectId" or short id) to display name
      const map = {};

      for (const p of this.projects) {
        // Prefer the human-readable display name; fall back to the short project id (never
        // to the compound "clusterId:projectId" form, which would look like two segments).
        const displayName = p.spec?.displayName || p.name || p.metadata?.name || p.id;

        // Rancher v3 projects have an id like "c-xxxxx:p-xxxxx"
        if (p.id) {
          map[p.id] = displayName;
        }
        if (p.metadata?.name) {
          map[p.metadata.name] = displayName;
        }
      }

      return map;
    },

    groupedCredentials() {
      const groups = {};
      const noProjectKey = '__no_project__';

      for (const cred of this.credentials) {
        const key = cred.projectId || noProjectKey;
        if (!groups[key]) {
          let projectName;

          if (key === noProjectKey) {
            projectName = this.t('clusterstacks.openstack.credentials.noProject');
          } else {
            // projectMap[key] returns the human-readable name when projects are loaded.
            // Fall back to just the short project-id part (after the colon in
            // "clusterId:projectId") so the header never shows a compound identifier.
            const shortKey = key.includes(':') ? key.split(':').slice(1).join(':') : key;

            projectName = this.projectMap[key] || shortKey;
          }

          groups[key] = {
            projectId:   key,
            projectName,
            credentials: [],
          };
        }
        groups[key].credentials.push(cred);
      }

      // Sort: real projects first (alphabetically), then the no-project bucket
      return Object.values(groups).sort((a, b) => {
        if (a.projectId === noProjectKey) {
          return 1;
        }
        if (b.projectId === noProjectKey) {
          return -1;
        }

        return a.projectName.localeCompare(b.projectName);
      });
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
          .map((r) => {
            const s = r.value;
            const ns = s.metadata.namespace;
            const nsObj = csoNamespaces.find((n) => n.metadata.name === ns);
            // Rancher annotates namespaces with the full "clusterId:projectId"
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

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.project-group {
  margin-bottom: 28px;
}

.project-group-title {
  font-size: 1em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
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
    flex: 0 0 200px;
    color: var(--muted);
    font-size: 0.85em;
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

