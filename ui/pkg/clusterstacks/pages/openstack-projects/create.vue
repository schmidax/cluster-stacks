<template>
  <div class="credential-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.credentialCreate.editTitle') : t('clusterstacks.credentialCreate.title') }}</h1>
      <span v-if="projectDisplayName" class="project-context">
        {{ t('clusterstacks.credentialCreate.forProject') }}: <strong>{{ projectDisplayName }}</strong>
      </span>
    </div>

    <OpenstackCredentialForm
      :existing="existing"
      :project-id="projectId"
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
      existing:           null,
      projectId:          '',
      projectDisplayName: '',
    };
  },

  computed: {
    isEdit() {
      return !!this.$route.query.namespace;
    },
  },

  async mounted() {
    // The projectId is passed via route query from the overview page
    this.projectId = this.$route.query.projectId || '';

    if (this.projectId) {
      await this.resolveProjectName();
    }

    if (this.isEdit) {
      await this.loadExisting();
    }
  },

  methods: {
    async loadExisting() {
      const { namespace } = this.$route.query;

      if (!namespace) {
        return;
      }

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

        this.existing = secret;

        // Resolve project from namespace annotation if not already set
        if (!this.projectId) {
          this.projectId = ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '';

          if (this.projectId) {
            await this.resolveProjectName();
          }
        }
      } catch {
        // ignore
      }
    },

    async resolveProjectName() {
      try {
        const all = await this.$store.dispatch('management/findAll', { type: 'management.cattle.io.project' });
        const match = (all || []).find((p) => p.id === this.projectId);

        this.projectDisplayName = match?.spec?.displayName || match?.metadata?.name || this.projectId;
      } catch {
        this.projectDisplayName = this.projectId;
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
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 20px;
}

.project-context {
  font-size: 0.9em;
  color: var(--muted);
}
</style>
