<template>
  <div class="openstack-resources-page">
    <!-- Top area: credential selector + quota overview -->
    <div class="top-area">
      <div class="credential-selector">
        <label class="credential-label">{{ t('clusterstacks.openstack.resources.credential') }}</label>
        <select v-model="selectedCredentialName" class="credential-select" @change="onCredentialChange">
          <option value="" disabled>
            {{ t('clusterstacks.openstack.resources.selectCredential') }}
          </option>
          <option v-for="cred in credentials" :key="cred.name" :value="cred.name">
            {{ cred.name }} — {{ cred.authUrl }}
          </option>
        </select>
      </div>

      <!-- Quota overview -->
      <div v-if="loadingQuotas" class="loading quota-loading">
        <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
      </div>
      <div v-else-if="quotaError" class="banner banner-error">
        {{ quotaError }}
      </div>
      <div v-else-if="activeCredential && quotaSections.length" class="quota-overview">
        <h2 class="quota-overview-title">{{ t('clusterstacks.openstack.resources.quotas.title') }}</h2>
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
                {{ item.used }} / {{ item.limit }}
                <span v-if="item.rawLimit !== -1" class="quota-available">
                  ({{ item.available }} {{ t('clusterstacks.openstack.resources.quotas.available') }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom area: resource type tabs -->
    <div v-if="activeCredential" class="bottom-area">
      <OpenstackResourceList :credential="activeCredential" />
    </div>
    <div v-else-if="credentials.length" class="no-data">
      {{ t('clusterstacks.openstack.resources.selectCredential') }}
    </div>
    <div v-else class="no-data">
      {{ t('clusterstacks.openstack.noData') }}
    </div>
  </div>
</template>

<script>
import OpenstackResourceList from '../../components/OpenstackResourceList.vue';
import { OpenStackApiService, parseCloudsYaml } from '../../services/openstack-api';

export default {
  name: 'OpenstackResourcesPage',

  components: { OpenstackResourceList },

  data() {
    return {
      credentials:           [],
      selectedCredentialName: '',
      activeCredential:      null,

      loadingQuotas: false,
      quotaError:    null,

      quotas: {
        computeQuota: null,
        networkQuota: null,
        volumeQuota:  null,
      },
    };
  },

  computed: {
    quotaSections() {
      const sections = [];
      const { computeQuota, networkQuota, volumeQuota } = this.quotas;

      const makeItem = (label, q, formatFn) => {
        if (!q) {
          return null;
        }
        const rawUsed  = q.in_use ?? 0;
        const rawLimit = q.limit  ?? -1;
        const pct      = rawLimit === -1 ? 0 : Math.min(100, Math.round((rawUsed / rawLimit) * 100));
        const color    = pct >= 90 ? '#c0392b' : pct >= 70 ? '#e67e22' : '#27ae60';
        const used     = formatFn ? formatFn(rawUsed) : String(rawUsed);
        const limit    = rawLimit === -1 ? '∞' : (formatFn ? formatFn(rawLimit) : String(rawLimit));
        const available = rawLimit === -1 ? '' : (formatFn ? formatFn(rawLimit - rawUsed) : String(rawLimit - rawUsed));

        return {
          label, used, limit, available, rawUsed, rawLimit, pct, color,
        };
      };

      if (computeQuota) {
        const items = [
          makeItem(this.t('clusterstacks.openstack.resources.quotas.instances'), computeQuota.instances),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.cores'),     computeQuota.cores),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.ram'),       computeQuota.ram, this.formatMiB),
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
          makeItem(this.t('clusterstacks.openstack.resources.quotas.gigabytes'), volumeQuota.gigabytes, this.formatGiB),
          makeItem(this.t('clusterstacks.openstack.resources.quotas.snapshots'), volumeQuota.snapshots),
        ].filter(Boolean);

        if (items.length) {
          sections.push({ title: this.t('clusterstacks.openstack.resources.quotas.storage'), items });
        }
      }

      return sections;
    },
  },

  async mounted() {
    await this.loadCredentials();
  },

  methods: {
    async loadCredentials() {
      try {
        const nsResponse = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });
        const csoNamespaces = (nsResponse?.items || []).filter(
          (ns) => ns.metadata.name.startsWith('cso-') && ns.metadata.name !== 'cso-system',
        );

        const results = await Promise.allSettled(
          csoNamespaces.map((ns) => this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/api/v1/namespaces/${ns.metadata.name}/secrets/openstack`,
          })),
        );

        this.credentials = results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => {
            const s = r.value;
            const ns = s.metadata.namespace;
            const cloudsYaml = atob(s.data?.['clouds.yaml'] || '');
            let authUrl = '';

            try {
              authUrl = parseCloudsYaml(cloudsYaml).authUrl;
            } catch {}

            return {
              name: ns.startsWith('cso-') ? ns.slice(4) : ns,
              namespace: ns,
              authUrl,
              cloudsYaml,
              raw: s,
            };
          });

        // Auto-select the first credential if available
        if (this.credentials.length && !this.selectedCredentialName) {
          this.selectedCredentialName = this.credentials[0].name;
          this.activeCredential = this.credentials[0];
          this.loadQuotas();
        }
      } catch {
        this.credentials = [];
      }
    },

    onCredentialChange() {
      const cred = this.credentials.find((c) => c.name === this.selectedCredentialName);

      this.activeCredential = cred || null;
      this.quotas = {
        computeQuota: null,
        networkQuota: null,
        volumeQuota:  null,
      };
      if (cred) {
        this.loadQuotas();
      }
    },

    async loadQuotas() {
      if (!this.activeCredential) {
        return;
      }

      this.loadingQuotas = true;
      this.quotaError    = null;

      try {
        const api = new OpenStackApiService(this.activeCredential.cloudsYaml, this.$store);
        const [compute, network, volume] = await Promise.allSettled([
          api.getComputeQuota(),
          api.getNetworkQuota(),
          api.getVolumeQuota(),
        ]);

        this.quotas.computeQuota = compute.status === 'fulfilled' ? compute.value : null;
        this.quotas.networkQuota = network.status === 'fulfilled' ? network.value : null;
        this.quotas.volumeQuota  = volume.status  === 'fulfilled' ? volume.value  : null;

        if (compute.status === 'rejected' && network.status === 'rejected' && volume.status === 'rejected') {
          this.quotaError = this.t('clusterstacks.errors.loadQuota');
        }
      } catch (e) {
        this.quotaError = e?.message || String(e);
      } finally {
        this.loadingQuotas = false;
      }
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },

    formatMiB(mib) {
      if (mib < 0) {
        return String(mib);
      }
      if (mib >= 1024 * 1024) {
        return `${(mib / (1024 * 1024)).toFixed(2)} TiB`;
      }
      if (mib >= 1024) {
        return `${(mib / 1024).toFixed(2)} GiB`;
      }

      return `${mib} MiB`;
    },

    formatGiB(gib) {
      if (gib < 0) {
        return String(gib);
      }
      if (gib >= 1024) {
        return `${(gib / 1024).toFixed(2)} TiB`;
      }

      return `${gib} GiB`;
    },
  },
};
</script>

<style lang="scss" scoped>
.openstack-resources-page {
  padding: 20px;
}

.top-area {
  margin-bottom: 24px;
}

.credential-selector {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;

  .credential-label {
    font-weight: 600;
    white-space: nowrap;
  }

  .credential-select {
    min-width: 320px;
  }
}

.quota-loading {
  padding: 20px;
  text-align: center;
  color: var(--muted);
}

.quota-overview-title {
  margin-bottom: 12px;
}

.quota-section {
  margin-bottom: 20px;
}

.quota-section-title {
  font-size: 0.95em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 10px;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.quota-card {
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
}

.quota-label {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 0.9em;
}

.quota-bar-wrap {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.quota-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.quota-values {
  font-size: 0.85em;
  color: var(--body-text);
}

.quota-available {
  color: var(--muted);
}

.bottom-area {
  border-top: 1px solid var(--border);
  padding-top: 20px;
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}
</style>
