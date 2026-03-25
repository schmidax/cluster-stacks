<template>
  <div class="capi-provider-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.capiProviders.editTitle') : t('clusterstacks.capiProviders.createTitle') }}</h1>
    </div>

    <CapiProviderForm
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
    return { existing: null };
  },

  computed: {
    isEdit() {
      return !!(this.$route.query.namespace && this.$route.query.name);
    },
  },

  async mounted() {
    await this.loadExisting();
  },

  methods: {
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

.page-header {
  margin-bottom: 24px;
}
</style>
