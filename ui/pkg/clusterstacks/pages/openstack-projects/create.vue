<template>
  <div class="credential-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.credentialCreate.editTitle') : t('clusterstacks.credentialCreate.title') }}</h1>
    </div>

    <OpenstackCredentialForm
      :existing="existing"
      :existing-project-id="existingProjectId"
      :projects="projects"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>

<script>
import OpenstackCredentialForm from '../../components/OpenstackCredentialForm.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'OpenstackProjectCreate',

  components: { OpenstackCredentialForm },

  data() {
    return {
      existing:          null,
      existingProjectId: '',
      projects:          [],
    };
  },

  computed: {
    isEdit() {
      return !!this.$route.query.namespace;
    },
  },

  async mounted() {
    await Promise.all([this.loadExisting(), this.loadProjects()]);
  },

  methods: {
    async loadExisting() {
      const { namespace } = this.$route.query;
      if (namespace) {
        try {
          const [secret, ns] = await Promise.all([
            this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${namespace}/secrets/openstack`,
            }),
            this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${namespace}`,
            }),
          ]);

          this.existing          = secret;
          this.existingProjectId = ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '';
        } catch {
          // ignore
        }
      }
    },

    async loadProjects() {
      try {
        const clusterId = this.$route.params.cluster;
        const all = await this.$store.dispatch('management/findAll', { type: 'management.cattle.io.project' });

        // Projects are namespaced to their cluster in the Steve API (metadata.namespace = clusterId)
        this.projects = (all || []).filter((p) => (p.metadata?.namespace || p.spec?.clusterName) === clusterId);
      } catch {
        this.projects = [];
      }
    },

    onSave() {
      this.$router.push({ name: ROUTES.OPENSTACK });
    },

    onCancel() {
      this.$router.push({ name: ROUTES.OPENSTACK });
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.credential-create-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}
</style>
