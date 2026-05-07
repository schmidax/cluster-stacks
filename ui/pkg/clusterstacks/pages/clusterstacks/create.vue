<template>
  <div class="clusterstack-create-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ isEdit ? t('clusterstacks.stackForm.editTitle') : t('clusterstacks.stackForm.createTitle') }}</h1>
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

    <div v-else-if="loading" class="loading-placeholder">
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
      hasAdminAccess: null,
    };
  },

  computed: {
    isEdit() {
      return !!this.$route.query?.name;
    },
  },

  async mounted() {
    const isAdmin = this.isAdminUser();

    this.hasAdminAccess = isAdmin;

    if (!isAdmin) {
      return;
    }

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
    isAdminUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');
      return !!(schema?.resourceMethods || []).includes('PUT');
    },

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

.loading-placeholder {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

</style>
