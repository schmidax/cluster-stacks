<template>
  <div class="credential-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.credentialCreate.editTitle') : t('clusterstacks.credentialCreate.title') }}</h1>
    </div>

    <OpenstackCredentialForm
      :existing="existing"
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
      existing: null,
      projects: [],
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
          this.existing = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/api/v1/namespaces/${namespace}/secrets/openstack`,
          });
        } catch {
          // ignore
        }
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
