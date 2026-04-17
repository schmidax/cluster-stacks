<template>
  <div class="openstack-detail-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ credentialLabel }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <button class="btn btn-sm role-link" @click="goBack">
            <i class="icon icon-chevron-left" />
            {{ t('clusterstacks.openstack.title') }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="!credentialNamespace" class="banner bg-error mb-10">
      {{ t('clusterstacks.openstack.resources.selectCredential') }}
    </div>

    <Tabbed
      v-else
      ref="tabs"
      :default-tab="activeTab"
      :use-hash="false"
      @changed="onTabChanged"
    >
      <Tab name="resources" :label="t('clusterstacks.nav.openstackResources')" :weight="20">
        <OpenstackResourcesPage
          :forced-credential-namespace="credentialNamespace"
          :embedded="true"
        />
      </Tab>

      <Tab name="object-storage" :label="t('clusterstacks.nav.openstackObjectstorage')" :weight="10">
        <ObjectStoragePage
          :forced-credential-namespace="credentialNamespace"
          :embedded="true"
        />
      </Tab>
    </Tabbed>
  </div>
</template>

<script>
import Tab from '@shell/components/Tabbed/Tab';
import Tabbed from '@shell/components/Tabbed';
import OpenstackResourcesPage from './resources.vue';
import ObjectStoragePage from './objectstorage.vue';
import { ROUTES } from '../../config/clusterstacks';

export default {
  name: 'OpenstackCredentialDetailPage',

  components: {
    OpenstackResourcesPage,
    ObjectStoragePage,
    Tab,
    Tabbed,
  },

  watch: {
    activeTab(nextTab) {
      this.$nextTick(() => {
        this.$refs.tabs?.select?.(nextTab);
      });
    },
  },

  computed: {
    credentialNamespace() {
      return String(this.$route.query?.namespace || '').trim();
    },

    credentialName() {
      return String(this.$route.query?.credential || '').trim();
    },

    credentialLabel() {
      return this.credentialName || this.credentialNamespace || this.t('clusterstacks.openstack.title');
    },

    activeTab() {
      const tab = String(this.$route.query?.tab || '').trim();

      return tab === 'object-storage' ? 'object-storage' : 'resources';
    },
  },

  methods: {
    onTabChanged(payload) {
      const nextTab = payload?.tab?.name || payload?.name || payload?.selectedName;

      if (!nextTab || nextTab === this.activeTab) {
        return;
      }

      this.$router.replace({
        query: {
          ...this.$route.query,
          tab: nextTab,
        },
      }).catch(() => {});
    },

    goBack() {
      this.$router.push({
        name:   ROUTES.OPENSTACK,
        params: { cluster: this.$route.params.cluster || '_' },
      });
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.openstack-detail-page {
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
</style>
