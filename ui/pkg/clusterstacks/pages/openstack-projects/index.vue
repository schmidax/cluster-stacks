<template>
  <div class="openstack-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.openstack.title') }}</h1>
      <button class="btn role-primary" @click="createCredential">
        {{ t('clusterstacks.openstack.createBtn') }}
      </button>
    </div>

    <div v-if="!credentials.length" class="no-data">
      {{ t('clusterstacks.openstack.noData') }}
    </div>

    <div v-else>
      <!-- Credential selector -->
      <div class="credential-list">
        <div
          v-for="cred in credentials"
          :key="cred.name"
          class="credential-item"
          :class="{ active: selectedCredential === cred.name }"
          @click="selectCredential(cred)"
        >
          <div class="cred-name">{{ cred.name }}</div>
          <div class="cred-detail">{{ cred.authUrl }}</div>
          <div class="cred-actions">
            <button class="btn btn-sm role-secondary" @click.stop="editCredential(cred)">
              {{ t('clusterstacks.common.edit') }}
            </button>
            <button class="btn btn-sm role-danger" @click.stop="deleteCredential(cred)">
              {{ t('clusterstacks.common.delete') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Resources panel -->
      <div v-if="activeCredential" class="resources-panel">
        <h2>{{ t('clusterstacks.openstack.resources.title') }}</h2>
        <OpenstackResourceList :credential="activeCredential" />
      </div>
    </div>
  </div>
</template>

<script>
import OpenstackResourceList from '../../components/OpenstackResourceList.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'OpenstackProjectsIndex',

  components: { OpenstackResourceList },

  data() {
    return {
      credentials:        [],
      selectedCredential: null,
      activeCredential:   null,
    };
  },

  async mounted() {
    await this.loadCredentials();
  },

  methods: {
    async loadCredentials() {
      try {
        // Credentials are stored as Kubernetes Secrets with label
        // clusterstack.x-k8s.io/credential=openstack
        const secrets = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/secrets?labelSelector=clusterstack.x-k8s.io%2Fcredential%3Dopenstack',
        });
        this.credentials = (secrets?.items || []).map((s) => ({
          name:      s.metadata.name,
          namespace: s.metadata.namespace,
          authUrl:   atob(s.data?.authUrl || ''),
          raw:       s,
        }));
      } catch {
        this.credentials = [];
      }
    },

    selectCredential(cred) {
      this.selectedCredential = cred.name;
      this.activeCredential = cred;
    },

    createCredential() {
      this.$router.push({ name: ROUTES.OPENSTACK_CREATE });
    },

    editCredential(cred) {
      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { name: cred.name, namespace: cred.namespace },
      });
    },

    async deleteCredential(cred) {
      if (!window.confirm(`Delete credential "${cred.name}"?`)) {
        return;
      }
      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/api/v1/namespaces/${cred.namespace}/secrets/${cred.name}`,
        });
        await this.loadCredentials();
        if (this.selectedCredential === cred.name) {
          this.selectedCredential = null;
          this.activeCredential = null;
        }
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

.credential-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.credential-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background: var(--box-bg);
  transition: border-color 0.2s;

  &:hover,
  &.active {
    border-color: var(--primary);
  }

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
