<template>
  <div class="clusterstack-create-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.stackForm.createTitle') }}</h1>
    </div>

    <ClusterStackForm
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
</style>
