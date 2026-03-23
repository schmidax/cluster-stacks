<template>
  <div class="cluster-create-page">
    <div class="page-header">
      <h1>{{ isEdit ? t('clusterstacks.clusterCreate.editTitle') : t('clusterstacks.clusterCreate.title') }}</h1>
    </div>

    <ClusterForm
      :existing-cluster="existingCluster"
      :cluster-stacks="clusterStacks"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>

<script>
import ClusterForm from '../../components/ClusterForm.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'ClusterCreate',

  components: { ClusterForm },

  data() {
    return {
      existingCluster: null,
      clusterStacks:   [],
    };
  },

  computed: {
    isEdit() {
      return !!(this.$route.query.name && this.$route.query.namespace);
    },
  },

  async mounted() {
    await Promise.all([
      this.loadExistingCluster(),
      this.loadClusterStacks(),
    ]);
  },

  methods: {
    async loadExistingCluster() {
      const { name, namespace } = this.$route.query;
      if (!name || !namespace) {
        return;
      }
      try {
        this.existingCluster = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${namespace}/clusters/${name}`,
        });
      } catch (e) {
        console.error('Failed to load cluster:', e); // eslint-disable-line no-console
      }
    },

    async loadClusterStacks() {
      try {
        this.clusterStacks = await this.$store.dispatch('management/findAll', {
          type: 'clusterstack.x-k8s.io.clusterstack',
        }) || [];
      } catch {
        this.clusterStacks = [];
      }
    },

    onSave() {
      this.$router.push({ name: ROUTES.CLUSTERS });
    },

    onCancel() {
      this.$router.push({ name: ROUTES.CLUSTERS });
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-create-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}
</style>
