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

      <!-- Quotas -->
      <div v-show="activeTab === 'quotas'">
        <div v-if="loadingQuotas" class="loading">
          <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
        </div>
        <div v-else-if="quotaError" class="banner banner-error">
          {{ quotaError }}
        </div>
        <div v-else class="quota-sections">
          <div v-for="section in quotaSections" :key="section.title" class="quota-section">
            <h3 class="quota-section-title">{{ section.title }}</h3>
            <div class="quota-grid">
              <div v-for="item in section.items" :key="item.label" class="quota-card">
                <div class="quota-label">{{ item.label }}</div>
                <div class="quota-bar-wrap">
                  <div
                    class="quota-bar-fill"
                    :style="{ width: item.pct + '%', background: item.color }"
                  />
                </div>
                <div class="quota-values">
                  {{ item.used }} / {{ item.limit === -1 ? '∞' : item.limit }}
                  <span v-if="item.limit !== -1" class="quota-available">
                    ({{ item.limit - item.used }} {{ t('clusterstacks.openstack.resources.quotas.available') }})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
      activeTab:     'instances',
      loading:       false,
      loadingQuotas: false,
      error:         null,
      quotaError:    null,
      api:           null,

      resources: {
        servers:        [],
        networks:       [],
        securityGroups: [],
        floatingIPs:    [],
        volumes:        [],
        computeQuota:   null,
        networkQuota:   null,
        volumeQuota:    null,
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
        { id: 'quotas',         labelKey: 'clusterstacks.openstack.resources.tabs.quotas' },
      ];
    },

    instanceHeaders() {
      return [
        { name: 'name',          labelKey: 'clusterstacks.openstack.resources.instances.name',    value: 'name' },
        { name: 'status',        labelKey: 'clusterstacks.openstack.resources.instances.status',  value: 'status' },
        { name: 'flavorDisplay', labelKey: 'clusterstacks.openstack.resources.instances.flavor',  value: '_flavorDisplay' },
        { name: 'ips',           labelKey: 'clusterstacks.openstack.resources.instances.ips',     value: '_ips' },
        { name: 'keyName',       labelKey: 'clusterstacks.openstack.resources.instances.keyName', value: 'key_name' },
        { name: 'created',       labelKey: 'clusterstacks.openstack.resources.instances.created', value: 'created' },
      ];
    },

    networkHeaders() {
      return [
        { name: 'name',        labelKey: 'clusterstacks.openstack.resources.networks.name',        value: 'name' },
        { name: 'status',      labelKey: 'clusterstacks.openstack.resources.networks.status',      value: 'status' },
        { name: 'external',    labelKey: 'clusterstacks.openstack.resources.networks.external',    value: '_external' },
        { name: 'adminState',  labelKey: 'clusterstacks.openstack.resources.networks.adminState',  value: '_adminState' },
        { name: 'shared',      labelKey: 'clusterstacks.openstack.resources.networks.shared',      value: '_shared' },
        { name: 'subnets',     labelKey: 'clusterstacks.openstack.resources.networks.subnets',     value: '_subnetsCount' },
      ];
    },

    sgHeaders() {
      return [
        { name: 'name',       labelKey: 'clusterstacks.openstack.resources.securityGroups.name',       value: 'name' },
        { name: 'description', labelKey: 'clusterstacks.openstack.resources.securityGroups.description', value: 'description' },
        { name: 'rulesCount', labelKey: 'clusterstacks.openstack.resources.securityGroups.rulesCount', value: '_rulesCount' },
      ];
    },

    fipHeaders() {
      return [
        { name: 'address',  labelKey: 'clusterstacks.openstack.resources.floatingIPs.address',  value: 'floating_ip_address' },
        { name: 'fixed',    labelKey: 'clusterstacks.openstack.resources.floatingIPs.fixed',    value: 'fixed_ip_address' },
        { name: 'status',   labelKey: 'clusterstacks.openstack.resources.floatingIPs.status',   value: 'status' },
        { name: 'router',   labelKey: 'clusterstacks.openstack.resources.floatingIPs.router',   value: 'router_id' },
      ];
    },

    volumeHeaders() {
      return [
        { name: 'name',       labelKey: 'clusterstacks.openstack.resources.volumes.name',       value: 'name' },
        { name: 'status',     labelKey: 'clusterstacks.openstack.resources.volumes.status',     value: 'status' },
        { name: 'size',       labelKey: 'clusterstacks.openstack.resources.volumes.size',       value: 'size' },
        { name: 'type',       labelKey: 'clusterstacks.openstack.resources.volumes.type',       value: 'volume_type' },
        { name: 'az',         labelKey: 'clusterstacks.openstack.resources.volumes.az',         value: 'availability_zone' },
        { name: 'attachedTo', labelKey: 'clusterstacks.openstack.resources.volumes.attachedTo', value: '_attachedTo' },
      ];
    },

    quotaSections() {
      const sections = [];
      const { computeQuota, networkQuota, volumeQuota } = this.resources;

      const makeItem = (label, q) => {
        if (!q) {
          return null;
        }
        const used = q.in_use ?? 0;
        const limit = q.limit ?? -1;
        const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
        const color = pct >= 90 ? '#c0392b' : pct >= 70 ? '#e67e22' : '#27ae60';

        return {
          label, used, limit, pct, color,
        };
      };

      if (computeQuota) {
        const items = [
          makeItem(this.t('clusterstacks.openstack.resources.quotas.instances'), computeQuota.instances),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.cores'),     computeQuota.cores),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.ram'),       computeQuota.ram),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.keyPairs'),  computeQuota.key_pairs),
        ].filter(Boolean);
        if (items.length) {
          sections.push({ title: this.t('clusterstacks.openstack.resources.quotas.compute'), items });
        }
      }

      if (networkQuota) {
        const items = [
          makeItem(this.t('clusterstacks.openstack.resources.quotas.networks'),       networkQuota.network),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.subnets'),        networkQuota.subnet),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.floatingIPs'),    networkQuota.floatingip),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.securityGroups'), networkQuota.security_group),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.routers'),        networkQuota.router),
        ].filter(Boolean);
        if (items.length) {
          sections.push({ title: this.t('clusterstacks.openstack.resources.quotas.network'), items });
        }
      }

      if (volumeQuota) {
        const items = [
          makeItem(this.t('clusterstacks.openstack.resources.quotas.volumes'),   volumeQuota.volumes),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.gigabytes'), volumeQuota.gigabytes),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.snapshots'), volumeQuota.snapshots),
        ].filter(Boolean);
        if (items.length) {
          sections.push({ title: this.t('clusterstacks.openstack.resources.quotas.storage'), items });
        }
      }

      return sections;
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
        const yesNo = (v) => v ? this.t('clusterstacks.common.yes') : this.t('clusterstacks.common.no');

        const [servers, networks, securityGroups, floatingIPs, volumes] = await Promise.allSettled([
          this.api.getServers(),
          this.api.getNetworks(),
          this.api.getSecurityGroups(),
          this.api.getFloatingIPs(),
          this.api.getVolumes(),
        ]);

        const serverData = servers.status === 'fulfilled' ? servers.value : [];
        this.resources.servers = serverData.map((s) => ({
          ...s,
          _ips:           Object.values(s.addresses || {}).flat().map((a) => a.addr).join(', ') || '—',
          _flavorDisplay: s.flavor?.original_name || s.flavor?.id || '—',
        }));

        const networkData = networks.status === 'fulfilled' ? networks.value : [];
        this.resources.networks = networkData.map((n) => ({
          ...n,
          _external:     yesNo(n['router:external']),
          _adminState:   yesNo(n.admin_state_up),
          _shared:       yesNo(n.shared),
          _subnetsCount: (n.subnets || []).length,
        }));

        const sgData = securityGroups.status === 'fulfilled' ? securityGroups.value : [];
        this.resources.securityGroups = sgData.map((sg) => ({
          ...sg,
          _rulesCount: (sg.security_group_rules || []).length,
        }));

        this.resources.floatingIPs = floatingIPs.status === 'fulfilled' ? floatingIPs.value : [];

        const volumeData = volumes.status === 'fulfilled' ? volumes.value : [];
        this.resources.volumes = volumeData.map((v) => ({
          ...v,
          _attachedTo: (v.attachments || []).map((a) => a.server_id).join(', ') || '—',
        }));
      } catch (e) {
        this.error = e?.message || String(e);
      } finally {
        this.loading = false;
      }

      this.loadQuotas();
    },

    async loadQuotas() {
      this.loadingQuotas = true;
      this.quotaError    = null;

      try {
        const [compute, network, volume] = await Promise.allSettled([
          this.api.getComputeQuota(),
          this.api.getNetworkQuota(),
          this.api.getVolumeQuota(),
        ]);

        this.resources.computeQuota = compute.status === 'fulfilled' ? compute.value : null;
        this.resources.networkQuota = network.status === 'fulfilled' ? network.value : null;
        this.resources.volumeQuota  = volume.status  === 'fulfilled' ? volume.value  : null;

        if (compute.status === 'rejected' && network.status === 'rejected') {
          this.quotaError = this.t('clusterstacks.errors.loadQuota');
        }
      } catch (e) {
        this.quotaError = e?.message || String(e);
      } finally {
        this.loadingQuotas = false;
      }
    },

    getCount(tabId) {
      const map = {
        instances:      this.resources.servers.length,
        networks:       this.resources.networks.length,
        securityGroups: this.resources.securityGroups.length,
        floatingIPs:    this.resources.floatingIPs.length,
        volumes:        this.resources.volumes.length,
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

// ── Quota ─────────────────────────────────────────────────────────────────────

.quota-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.quota-section-title {
  font-size: 1em;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--body-text);
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.quota-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--box-bg);
}

.quota-label {
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.quota-bar-wrap {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.quota-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.quota-values {
  font-size: 0.85em;
  color: var(--muted);
}

.quota-available {
  margin-left: 4px;
  opacity: 0.8;
}

.banner {
  padding: 10px 14px;
  border-radius: 4px;
  margin-top: 12px;

  &.banner-error {
    background: var(--error-banner-bg, #fde8e8);
    border: 1px solid var(--error, #c9302c);
    color: var(--error, #7f1d1d);
  }
}
</style>
