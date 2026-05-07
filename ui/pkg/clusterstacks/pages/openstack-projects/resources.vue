<template>
  <div class="openstack-resources-page">
    <!-- Top area: credential selector + quota overview -->
    <div class="top-area">
      <div v-if="!embedded" class="credential-selector">
        <LabeledSelect
          :value="selectedCredentialName"
          :label="t('clusterstacks.openstack.resources.credential')"
          :placeholder="t('clusterstacks.openstack.resources.selectCredential')"
          :options="credentialOptions"
          @update:value="onCredentialChange"
        />
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
        <div class="quota-sections">
          <SimpleBox v-for="section in quotaSections" :key="section.title" class="quota-section-gauge">
            <h3 class="quota-section-title">{{ section.title }}</h3>
            <div class="quota-section-items">
              <ConsumptionGauge
                v-for="item in section.items"
                :key="item.id"
                class="quota-item-gauge"
                :resource-name="item.label"
                :capacity="item.gauge.total"
                :used="item.gauge.useful"
                :used-as-resource-name="true"
                :color-stops="quotaColorStops"
              >
                <template #title="{ formattedPercentage }">
                  <span class="quota-item-title">{{ item.label }}</span>
                  <span class="quota-item-values">
                    {{ item.gauge.formattedUseful }} / {{ item.gauge.formattedTotal }}
                    <span class="quota-item-percent"><i>/&nbsp;</i>{{ item.rawLimit === -1 ? '∞' : formattedPercentage }}</span>
                  </span>
                </template>
              </ConsumptionGauge>
            </div>
          </SimpleBox>
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
import ConsumptionGauge from '@shell/components/ConsumptionGauge';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import SimpleBox from '@shell/components/SimpleBox';
import OpenstackResourceList from '../../components/OpenstackResourceList.vue';
import { OpenStackApiService, parseCloudsYaml } from '../../services/openstack-api';

export default {
  name: 'OpenstackResourcesPage',

  props: {
    forcedCredentialNamespace: {
      type:    String,
      default: '',
    },
    embedded: {
      type:    Boolean,
      default: false,
    },
  },

  components: {
    ConsumptionGauge,
    LabeledSelect,
    OpenstackResourceList,
    SimpleBox,
  },

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
    quotaColorStops() {
      return {
        0:  '--os-gauge-green',
        70: '--os-gauge-orange',
        90: '--os-gauge-red',
      };
    },

    credentialOptions() {
      return this.credentials.map((credential) => ({
        label: `${ credential.name }${ credential.authUrl ? ` — ${ credential.authUrl }` : '' }`,
        value: credential.name,
      }));
    },

    quotaSections() {
      const sections = [];
      const { computeQuota, networkQuota, volumeQuota } = this.quotas;

      const makeItem = (label, q, formatFn) => {
        if (!q) {
          return null;
        }
        const rawUsed  = q.in_use ?? 0;
        const rawLimit = q.limit  ?? -1;
        const used     = formatFn ? formatFn(rawUsed) : String(rawUsed);
        const limit    = rawLimit === -1 ? '∞' : (formatFn ? formatFn(rawLimit) : String(rawLimit));
        const available = rawLimit === -1 ? '' : (formatFn ? formatFn(rawLimit - rawUsed) : String(rawLimit - rawUsed));
        const gaugeTotal = rawLimit === -1 ? Math.max(rawUsed, 1) : rawLimit;
        const gaugeUseful = rawLimit === -1 ? 0 : rawUsed;
        const id = `${ label }-${ rawUsed }-${ rawLimit }`;

        return {
          id,
          label,
          used,
          limit,
          available,
          rawUsed,
          rawLimit,
          gauge: {
            total:           gaugeTotal,
            useful:          gaugeUseful,
            formattedUseful: used,
            formattedTotal:  limit,
            units:           '',
          },
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

  watch: {
    '$route.query': {
      deep: true,
      handler() {
        if (!this.embedded) {
          this.applyCredentialSelectionFromState();
        }
      },
    },
    forcedCredentialNamespace() {
      this.applyCredentialSelectionFromState();
    },
  },

  async mounted() {
    await this.loadCredentials();
  },

  methods: {
    async loadCredentials() {
      try {
        let visibleNamespaces = [];

        try {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });
          visibleNamespaces = (nsResponse?.items || []).filter(
            (ns) => {
              const nsName = ns.metadata?.name || '';

              return nsName.startsWith('cso-') && nsName !== 'cso-system';
            },
          );
        } catch {
          const nsList = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
          });

          visibleNamespaces = (nsList || [])
            .filter((ns) => {
              const nsName = ns.metadata?.name || '';

              return nsName.startsWith('cso-') && nsName !== 'cso-system';
            })
            .map((ns) => ({ metadata: { name: ns.metadata?.name || '' } }))
            .filter((ns) => ns.metadata.name);
        }

        const results = await Promise.allSettled(
          visibleNamespaces.map((ns) => this.$store.dispatch('management/request', {
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

        this.applyCredentialSelectionFromState();
      } catch {
        this.credentials = [];
      }
    },

    requestedCredential() {
      const requestedNamespace = String(this.$route.query?.namespace || '').trim();
      const requestedName = String(this.$route.query?.credential || '').trim();

      if (!requestedNamespace && !requestedName) {
        return null;
      }

      return this.credentials.find((credential) => {
        if (requestedNamespace && credential.namespace === requestedNamespace) {
          return true;
        }

        if (requestedName && credential.name === requestedName) {
          return true;
        }

        return false;
      }) || null;
    },

    applyCredentialSelectionFromState() {
      if (!this.credentials.length) {
        this.selectedCredentialName = '';
        this.activeCredential = null;

        return;
      }

      const forcedNamespace = String(this.forcedCredentialNamespace || '').trim();
      const forced = forcedNamespace
        ? this.credentials.find((credential) => credential.namespace === forcedNamespace) || null
        : null;

      if (this.embedded && forcedNamespace && !forced) {
        this.selectedCredentialName = '';
        this.activeCredential = null;

        return;
      }

      const requested = this.requestedCredential();
      const current = this.credentials.find((credential) => credential.name === this.selectedCredentialName) || null;
      const next = forced || requested || current || this.credentials[0];

      if (!next) {
        return;
      }

      const hasChanged = this.activeCredential?.namespace !== next.namespace;

      this.selectedCredentialName = next.name;
      this.activeCredential = next;

      if (hasChanged) {
        this.quotas = {
          computeQuota: null,
          networkQuota: null,
          volumeQuota:  null,
        };
        this.loadQuotas();
      }
    },

    onCredentialChange(value) {
      this.selectedCredentialName = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value;
      const cred = this.credentials.find((c) => c.name === this.selectedCredentialName);

      this.activeCredential = cred || null;
      this.quotas = {
        computeQuota: null,
        networkQuota: null,
        volumeQuota:  null,
      };
      if (cred) {
        if (!this.embedded) {
          const nextQuery = {
            ...this.$route.query,
            credential: cred.name,
            namespace:  cred.namespace,
          };

          this.$router.replace({ query: nextQuery }).catch(() => {});
        }
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
  --os-gauge-green: #2e7d32;
  --os-gauge-orange: #ef6c00;
  --os-gauge-red: #c62828;

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

.quota-section-title {
  font-size: 0.9em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 8px;
}

.quota-sections {
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: 12px;
  grid-row-gap: 12px;
}

.quota-section-gauge {
  padding: 12px;
}

.quota-section-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quota-item-title {
  font-size: 12px;
  font-weight: 600;
}

.quota-item-values {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.quota-item-percent {
  font-weight: 600;
}

.quota-item-gauge {
  :deep(.numbers) {
    font-size: 12px;
    align-items: center;
  }

  :deep(.numbers h4) {
    margin: 0;
    font-size: 12px;
  }

  :deep(.numbers .percentage i) {
    margin-right: 4px;
  }

  :deep(.mt-10) {
    margin-top: 6px;
  }
}

@media only screen and (min-width: 992px) {
  .quota-sections {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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
