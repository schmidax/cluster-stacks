<template>
  <div class="capi-provider-create-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ isEdit ? t('clusterstacks.capiProviders.editTitle') : t('clusterstacks.capiProviders.createTitle') }}</h1>
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

    <div v-if="hasAdminAccess === false" class="banner banner-warning clusterstacks-permission-warning">
      <i class="icon icon-warning" />
      <span>{{ t('clusterstacks.common.permissionDenied') }}</span>
    </div>

    <CapiProviderForm
      v-else
      :existing="existing"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>

<script>
import CapiProviderForm from '../../components/CapiProviderForm.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'CapiProviderCreate',

  components: { CapiProviderForm },

  data() {
    return {
      existing:       null,
      hasAdminAccess: null,
    };
  },

  computed: {
    isEdit() {
      return !!(this.$route.query.namespace && this.$route.query.name);
    },
  },

  async mounted() {
    const isAdmin = this.isAdminUser();

    this.hasAdminAccess = isAdmin;

    if (!isAdmin) {
      return;
    }

    await this.loadExisting();
  },

  methods: {
    isAdminUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');
      return !!(schema?.resourceMethods || []).includes('PUT');
    },
    async loadExisting() {
      const { namespace, name } = this.$route.query;

      if (namespace && name) {
        try {
          this.existing = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ namespace }/capiproviders/${ name }`,
          });
        } catch {
          // ignore – fall back to create mode
        }
      }
    },

    onSave() {
      this.$router.push({ name: ROUTES.CAPI_PROVIDERS });
    },

    onCancel() {
      this.$router.push({ name: ROUTES.CAPI_PROVIDERS });
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.capi-provider-create-page {
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

.clusterstacks-permission-warning {
  min-height: 48px;
}
</style>
