<template>
  <div class="clusterstack-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.stackForm.editTitle') : t('clusterstacks.stackForm.createTitle') }}</h1>
    </div>

    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <ClusterStackForm
      v-else
      :existing-stack="existingStack"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>

<script>
import ClusterStackForm from '../../components/ClusterStackForm.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClusterStackCreate',

  components: { ClusterStackForm },

  data() {
    return {
      existingStack: null,
      loading:       false,
    };
  },

  computed: {
    isEdit() {
      return !!this.$route.query?.name;
    },
  },

  async mounted() {
    const { namespace, name } = this.$route.query || {};

    if (name) {
      this.loading = true;
      try {
        const ns = namespace || 'clusterstacks';
        const result = await this.$store.dispatch('management/request', {
          url: `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstacks/${ name }`,
        });

        this.existingStack = result;
      } catch (e) {
        console.error('Failed to load ClusterStack for editing:', e); // eslint-disable-line no-console
      } finally {
        this.loading = false;
      }
    }
  },

  methods: {
    onSave() {
      this.$router.push({ name: ROUTES.STACKS });
    },

    onCancel() {
      this.$router.push({ name: ROUTES.STACKS });
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.clusterstack-create-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.loading-placeholder {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}
</style>
