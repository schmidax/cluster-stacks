<template>
  <div class="openstack-resource-list">
    <div v-if="loading" class="loading">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <div v-else-if="error" class="banner banner-error">
      {{ error }}
      <button class="btn btn-sm role-secondary" @click="load">
        {{ t('clusterstacks.common.retry') }}
      </button>
    </div>

    <div v-else>
      <!-- Tabs -->
      <div class="resource-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ t(tab.labelKey) }}
          <span v-if="getCount(tab.id) !== null" class="count">{{ getCount(tab.id) }}</span>
        </button>
      </div>

      <!-- Instances -->
      <div v-show="activeTab === 'instances'">
        <div v-if="!resources.servers.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.instances.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.servers"
          :headers="instanceHeaders"
          key-field="id"
        />
      </div>

      <!-- Networks -->
      <div v-show="activeTab === 'networks'">
        <div v-if="!resources.networks.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.networks.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.networks"
          :headers="networkHeaders"
          key-field="id"
        />
      </div>

      <!-- Security Groups -->
      <div v-show="activeTab === 'securityGroups'">
        <div v-if="!resources.securityGroups.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.securityGroups.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.securityGroups"
          :headers="sgHeaders"
          key-field="id"
        />
      </div>

      <!-- Floating IPs -->
      <div v-show="activeTab === 'floatingIPs'">
        <div v-if="!resources.floatingIPs.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.floatingIPs.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.floatingIPs"
          :headers="fipHeaders"
          key-field="id"
        />
      </div>

      <!-- Volumes -->
      <div v-show="activeTab === 'volumes'">
        <div v-if="!resources.volumes.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.volumes.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.volumes"
          :headers="volumeHeaders"
          key-field="id"
        />
      </div>

      <!-- Flavors -->
      <div v-show="activeTab === 'flavors'">
        <div v-if="!resources.flavors.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.flavors.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.flavors"
          :headers="flavorHeaders"
          key-field="id"
        />
      </div>

      <!-- Images -->
      <div v-show="activeTab === 'images'">
        <div v-if="!resources.images.length" class="no-data">
          {{ t('clusterstacks.openstack.resources.images.noData') }}
        </div>
        <SortableTable
          v-else
          :rows="resources.images"
          :headers="imageHeaders"
          key-field="id"
        />
      </div>
    </div>
  </div>
</template>

<script>
import SortableTable from '@shell/components/SortableTable';
import { OpenStackApiService } from '../services/openstack-api';

export default {
  name: 'OpenstackResourceList',

  components: { SortableTable },

  props: {
    credential: {
      type:     Object,
      required: true,
    },
  },

  data() {
    return {
      activeTab: 'instances',
      loading:   false,
      error:     null,
      api:       null,

      resources: {
        servers:        [],
        networks:       [],
        securityGroups: [],
        floatingIPs:    [],
        volumes:        [],
        flavors:        [],
        images:         [],
      },
    };
  },

  computed: {
    tabs() {
      return [
        { id: 'instances',      labelKey: 'clusterstacks.openstack.resources.tabs.instances' },
        { id: 'networks',       labelKey: 'clusterstacks.openstack.resources.tabs.networks' },
        { id: 'securityGroups', labelKey: 'clusterstacks.openstack.resources.tabs.securityGroups' },
        { id: 'floatingIPs',    labelKey: 'clusterstacks.openstack.resources.tabs.floatingIPs' },
        { id: 'volumes',        labelKey: 'clusterstacks.openstack.resources.tabs.volumes' },
        { id: 'flavors',        labelKey: 'clusterstacks.openstack.resources.tabs.flavors' },
        { id: 'images',         labelKey: 'clusterstacks.openstack.resources.tabs.images' },
      ];
    },

    instanceHeaders() {
      return [
        { name: 'name', labelKey: 'clusterstacks.openstack.resources.instances.name', value: 'name' },
        { name: 'status', labelKey: 'clusterstacks.openstack.resources.instances.status', value: 'status' },
        { name: 'created', labelKey: 'clusterstacks.openstack.resources.instances.created', value: 'created' },
      ];
    },

    networkHeaders() {
      return [
        { name: 'name',     labelKey: 'clusterstacks.openstack.resources.networks.name',     value: 'name' },
        { name: 'status',   labelKey: 'clusterstacks.openstack.resources.networks.status',   value: 'status' },
        { name: 'external', labelKey: 'clusterstacks.openstack.resources.networks.external', value: 'router:external' },
        { name: 'shared',   labelKey: 'clusterstacks.openstack.resources.networks.shared',   value: 'shared' },
      ];
    },

    sgHeaders() {
      return [
        { name: 'name',        labelKey: 'clusterstacks.openstack.resources.securityGroups.name',        value: 'name' },
        { name: 'description', labelKey: 'clusterstacks.openstack.resources.securityGroups.description', value: 'description' },
      ];
    },

    fipHeaders() {
      return [
        { name: 'address', labelKey: 'clusterstacks.openstack.resources.floatingIPs.address', value: 'floating_ip_address' },
        { name: 'fixed',   labelKey: 'clusterstacks.openstack.resources.floatingIPs.fixed',   value: 'fixed_ip_address' },
        { name: 'status',  labelKey: 'clusterstacks.openstack.resources.floatingIPs.status',  value: 'status' },
      ];
    },

    volumeHeaders() {
      return [
        { name: 'name',   labelKey: 'clusterstacks.openstack.resources.volumes.name',   value: 'name' },
        { name: 'status', labelKey: 'clusterstacks.openstack.resources.volumes.status', value: 'status' },
        { name: 'size',   labelKey: 'clusterstacks.openstack.resources.volumes.size',   value: 'size' },
        { name: 'type',   labelKey: 'clusterstacks.openstack.resources.volumes.type',   value: 'volume_type' },
      ];
    },

    flavorHeaders() {
      return [
        { name: 'name',  labelKey: 'clusterstacks.openstack.resources.flavors.name',  value: 'name' },
        { name: 'vcpus', labelKey: 'clusterstacks.openstack.resources.flavors.vcpus', value: 'vcpus' },
        { name: 'ram',   labelKey: 'clusterstacks.openstack.resources.flavors.ram',   value: 'ram' },
        { name: 'disk',  labelKey: 'clusterstacks.openstack.resources.flavors.disk',  value: 'disk' },
      ];
    },

    imageHeaders() {
      return [
        { name: 'name',       labelKey: 'clusterstacks.openstack.resources.images.name',       value: 'name' },
        { name: 'status',     labelKey: 'clusterstacks.openstack.resources.images.status',     value: 'status' },
        { name: 'visibility', labelKey: 'clusterstacks.openstack.resources.images.visibility', value: 'visibility' },
        { name: 'format',     labelKey: 'clusterstacks.openstack.resources.images.diskFormat', value: 'disk_format' },
      ];
    },
  },

  watch: {
    credential: {
      immediate: true,
      handler() {
        this.initApi();
      },
    },
  },

  methods: {
    initApi() {
      if (!this.credential) {
        return;
      }
      this.api = new OpenStackApiService(this.credential.cloudsYaml, this.$store);

      this.load();
    },

    async load() {
      if (!this.api) {
        return;
      }

      this.loading = true;
      this.error   = null;

      try {
        const [servers, networks, securityGroups, floatingIPs, volumes, flavors, images] = await Promise.allSettled([
          this.api.getServers(),
          this.api.getNetworks(),
          this.api.getSecurityGroups(),
          this.api.getFloatingIPs(),
          this.api.getVolumes(),
          this.api.getFlavors(),
          this.api.getGlanceImages(),
        ]);

        this.resources.servers        = servers.status        === 'fulfilled' ? servers.value        : [];
        this.resources.networks       = networks.status       === 'fulfilled' ? networks.value       : [];
        this.resources.securityGroups = securityGroups.status === 'fulfilled' ? securityGroups.value : [];
        this.resources.floatingIPs    = floatingIPs.status    === 'fulfilled' ? floatingIPs.value    : [];
        this.resources.volumes        = volumes.status        === 'fulfilled' ? volumes.value        : [];
        this.resources.flavors        = flavors.status        === 'fulfilled' ? flavors.value        : [];
        this.resources.images         = images.status         === 'fulfilled' ? images.value         : [];
      } catch (e) {
        this.error = e?.message || String(e);
      } finally {
        this.loading = false;
      }
    },

    getCount(tabId) {
      const map = {
        instances:      this.resources.servers.length,
        networks:       this.resources.networks.length,
        securityGroups: this.resources.securityGroups.length,
        floatingIPs:    this.resources.floatingIPs.length,
        volumes:        this.resources.volumes.length,
        flavors:        this.resources.flavors.length,
        images:         this.resources.images.length,
      };
      return map[tabId] ?? null;
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.openstack-resource-list {
  margin-top: 20px;
}

.loading,
.no-data {
  padding: 30px;
  text-align: center;
  color: var(--muted);
}

.resource-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 16px;

  .tab-btn {
    padding: 8px 16px;
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--body-text);
    display: flex;
    align-items: center;
    gap: 6px;

    &.active {
      border-bottom-color: var(--primary);
      color: var(--primary);
      font-weight: 600;
    }

    &:hover:not(.active) {
      background: var(--hover);
    }

    .count {
      background: var(--accent-btn);
      color: var(--primary);
      border-radius: 10px;
      padding: 1px 6px;
      font-size: 0.8em;
    }
  }
}
</style>
