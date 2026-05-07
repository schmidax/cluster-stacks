<template>
  <div class="credential-create-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ isEdit ? t('clusterstacks.credentialCreate.editTitle') : t('clusterstacks.credentialCreate.title') }}</h1>
      </div>
      <div class="sub-header">
        <span v-if="projectDisplayName" class="project-context">
          {{ t('clusterstacks.credentialCreate.forProject') }}: <strong>{{ projectDisplayName }}</strong>
        </span>
      </div>
      <div class="actions-container">
        <div class="actions">
          <!-- Slot content -->
        </div>
      </div>
    </header>

    <div v-if="projectIdInvalid" class="banner banner-warning">
      {{ t('clusterstacks.credentialCreate.invalidProjectContext') }}
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
      projectIdInvalid:   false,
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
        const namespaceProjectId = ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '';

        if (this.projectId && namespaceProjectId && this.projectId !== namespaceProjectId) {
          // Never trust a mismatching query projectId for an existing namespace.
          this.projectId = namespaceProjectId;
          this.projectIdInvalid = true;
        }

        if (!this.projectId) {
          this.projectId = namespaceProjectId;

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
        const steveId = String(this.projectId || '').replace(':', '/');
        const direct = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/v1/management.cattle.io.projects/${ steveId }`,
        });

        this.projectDisplayName = direct?.spec?.displayName || direct?.metadata?.name || this.projectId;

        return;
      } catch {
        // Fall back to list-based lookup.
      }

      try {
        const all = await this.$store.dispatch('management/findAll', { type: 'management.cattle.io.project' });
        const match = (all || []).find((p) => p.id === this.projectId);

        this.projectDisplayName = match?.spec?.displayName || match?.metadata?.name || this.projectId;
      } catch {
        this.projectDisplayName = this.projectId;
      }
    },

    onSave() {
      this.$router.push({
        name:   ROUTES.OPENSTACK,
        params: { cluster: this.$route.params.cluster || '_' },
        query:  {
          refreshAfterCredentialSave: '1',
          refreshToken:               String(Date.now()),
        },
      });
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

.project-context {
  font-size: 0.9em;
  color: var(--muted);
}

.banner {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 0.9em;
  margin-bottom: 16px;

  &.banner-warning {
    background: var(--warning-banner-bg, rgba(244, 175, 61, 0.14));
    border: 1px solid var(--warning, #f4af3d);
    color: var(--body-text);
  }
}
</style>
