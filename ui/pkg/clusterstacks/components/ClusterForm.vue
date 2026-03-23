<template>
  <div class="cluster-form">
    <!-- Tabs -->
    <div class="form-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
      </button>
    </div>

    <!-- General Tab -->
    <div v-show="activeTab === 'general'" class="tab-panel">
      <div class="form-row">
        <LabeledInput
          v-model="form.name"
          :label="t('clusterstacks.clusterCreate.name')"
          :required="true"
          :disabled="isEdit"
        />
      </div>
      <div class="form-row">
        <LabeledInput
          v-model="form.namespace"
          :label="t('clusterstacks.clusterCreate.namespace')"
          :required="true"
        />
      </div>
      <div class="form-row">
        <LabeledSelect
          v-model="form.k8sVersion"
          :label="t('clusterstacks.clusterCreate.k8sVersion')"
          :placeholder="t('clusterstacks.clusterCreate.k8sVersionPlaceholder')"
          :options="k8sVersionOptions"
          :required="true"
          @input="onVersionChange"
        />
      </div>
    </div>

    <!-- OpenStack Tab -->
    <div v-show="activeTab === 'openstack'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.network.title') }}</h3>
      <div class="form-row">
        <LabeledSelect
          v-model="form.externalNetworkId"
          :label="t('clusterstacks.clusterCreate.network.externalNetwork')"
          :placeholder="t('clusterstacks.clusterCreate.network.externalNetworkPlaceholder')"
          :options="externalNetworkOptions"
          :loading="loadingNetworks"
          :required="true"
        />
      </div>
      <div class="form-row">
        <LabeledSelect
          v-model="form.imageName"
          :label="t('clusterstacks.clusterCreate.network.imageName')"
          :placeholder="t('clusterstacks.clusterCreate.network.imageNamePlaceholder')"
          :options="imageOptions"
          :loading="loadingImages"
          :required="true"
        />
      </div>

      <h3>{{ t('clusterstacks.clusterCreate.controlPlane.title') }}</h3>
      <div class="form-row two-col">
        <LabeledSelect
          v-model="form.controlPlaneFlavor"
          :label="t('clusterstacks.clusterCreate.controlPlane.flavor')"
          :placeholder="t('clusterstacks.clusterCreate.controlPlane.flavorPlaceholder')"
          :options="flavorOptions"
          :loading="loadingFlavors"
          :required="true"
        />
        <LabeledInput
          v-model.number="form.controlPlaneReplicas"
          :label="t('clusterstacks.clusterCreate.controlPlane.replicas')"
          type="number"
          :min="1"
          :required="true"
        />
      </div>

      <h3>{{ t('clusterstacks.clusterCreate.worker.title') }}</h3>
      <div class="form-row two-col">
        <LabeledSelect
          v-model="form.workerFlavor"
          :label="t('clusterstacks.clusterCreate.worker.flavor')"
          :placeholder="t('clusterstacks.clusterCreate.worker.flavorPlaceholder')"
          :options="flavorOptions"
          :loading="loadingFlavors"
          :required="true"
        />
        <LabeledInput
          v-model.number="form.workerReplicas"
          :label="t('clusterstacks.clusterCreate.worker.replicas')"
          type="number"
          :min="1"
          :required="true"
        />
      </div>

      <h3>{{ t('clusterstacks.clusterCreate.bastion.title') }}</h3>
      <div class="form-row">
        <Checkbox
          v-model="form.bastionEnabled"
          :label="t('clusterstacks.clusterCreate.bastion.enabled')"
        />
      </div>
      <div v-if="form.bastionEnabled" class="form-row">
        <LabeledSelect
          v-model="form.bastionFlavor"
          :label="t('clusterstacks.clusterCreate.bastion.flavor')"
          :placeholder="t('clusterstacks.clusterCreate.bastion.flavorPlaceholder')"
          :options="flavorOptions"
          :loading="loadingFlavors"
        />
      </div>
    </div>

    <!-- ETCD Backup Tab -->
    <div v-show="activeTab === 'etcd'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.etcdBackup.title') }}</h3>
      <p class="description">{{ t('clusterstacks.clusterCreate.etcdBackup.description') }}</p>
      <div class="form-row">
        <Checkbox
          v-model="form.etcdBackupEnabled"
          :label="t('clusterstacks.clusterCreate.etcdBackup.enabled')"
        />
      </div>
      <div v-if="form.etcdBackupEnabled">
        <div class="form-row">
          <LabeledInput
            v-model="form.etcdContainerName"
            :label="t('clusterstacks.clusterCreate.etcdBackup.containerName')"
            :required="true"
          />
        </div>
      </div>
    </div>

    <!-- Quota Validation -->
    <QuotaWarning
      v-if="activeTab === 'openstack' && quotaResult"
      :result="quotaResult"
      :checking="checkingQuota"
    />

    <!-- Action buttons -->
    <div class="form-actions">
      <button class="btn role-secondary" @click="$emit('cancel')">
        {{ t('clusterstacks.clusterCreate.cancel') }}
      </button>
      <BusyButton
        :busy="saving"
        :disabled="!canSave"
        class="btn role-primary"
        @click="save"
      >
        {{ t('clusterstacks.clusterCreate.save') }}
      </BusyButton>
    </div>
  </div>
</template>

<script>
import LabeledInput  from '@shell/components/form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import Checkbox      from '@shell/components/form/Checkbox';
import QuotaWarning  from './QuotaWarning.vue';
import BusyButton    from './BusyButton.vue';
import { OpenStackApiService } from '../services/openstack-api';
import { validateQuota }       from '../services/quota-validator';

export default {
  name: 'ClusterForm',

  components: {
    LabeledInput,
    LabeledSelect,
    Checkbox,
    QuotaWarning,
    BusyButton,
  },

  props: {
    existingCluster: {
      type:    Object,
      default: null,
    },
    clusterStacks: {
      type:    Array,
      default: () => [],
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      activeTab: 'general',

      form: {
        name:                 '',
        namespace:            'default',
        k8sVersion:           '',
        clusterClass:         '',
        externalNetworkId:    '',
        imageName:            '',
        controlPlaneFlavor:   '',
        controlPlaneReplicas: 3,
        workerFlavor:         '',
        workerReplicas:       3,
        bastionEnabled:       false,
        bastionFlavor:        '',
        etcdBackupEnabled:    false,
        etcdContainerName:    '',
      },

      flavors:              [],
      images:               [],
      externalNetworks:     [],

      loadingFlavors:   false,
      loadingImages:    false,
      loadingNetworks:  false,

      quotaResult:   null,
      checkingQuota: false,
      saving:        false,

      openstackApi: null,
    };
  },

  computed: {
    isEdit() {
      return !!this.existingCluster;
    },

    tabs() {
      return [
        { id: 'general',  labelKey: 'clusterstacks.clusterCreate.tabs.general' },
        { id: 'openstack', labelKey: 'clusterstacks.clusterCreate.tabs.openstack' },
        { id: 'etcd',     labelKey: 'clusterstacks.clusterCreate.tabs.etcd' },
      ];
    },

    k8sVersionOptions() {
      const versions = new Set();
      for (const stack of this.clusterStacks) {
        if (stack.spec?.kubernetesVersion) {
          versions.add(stack.spec.kubernetesVersion);
        }
        for (const v of (stack.status?.usableVersions || [])) {
          versions.add(v);
        }
      }
      return [...versions].sort().map((v) => ({ label: v, value: v }));
    },

    flavorOptions() {
      return this.flavors.map((f) => ({
        label: `${f.name} (${f.vcpus} vCPU, ${f.ram} MiB RAM, ${f.disk} GiB Disk)`,
        value: f.name,
      }));
    },

    imageOptions() {
      return this.images
        .filter((i) => i.status === 'active')
        .map((i) => ({ label: i.name, value: i.name }));
    },

    externalNetworkOptions() {
      return this.externalNetworks.map((n) => ({
        label: n.name,
        value: n.id,
      }));
    },

    canSave() {
      const { name, namespace, k8sVersion, externalNetworkId, imageName, controlPlaneFlavor, workerFlavor } = this.form;
      return !!(name && namespace && k8sVersion && externalNetworkId && imageName && controlPlaneFlavor && workerFlavor);
    },
  },

  async mounted() {
    if (this.existingCluster) {
      this.populateFromExisting();
    }
    await this.initOpenStackApi();
  },

  watch: {
    'form.controlPlaneFlavor': 'debounceQuotaCheck',
    'form.workerFlavor':       'debounceQuotaCheck',
    'form.controlPlaneReplicas': 'debounceQuotaCheck',
    'form.workerReplicas':       'debounceQuotaCheck',
    'form.bastionEnabled':       'debounceQuotaCheck',
  },

  methods: {
    populateFromExisting() {
      const c = this.existingCluster;
      this.form.name      = c.metadata.name;
      this.form.namespace = c.metadata.namespace;
      const topo = c.spec?.topology;
      if (topo) {
        this.form.k8sVersion    = topo.version || '';
        this.form.clusterClass  = topo.class || '';
        this.form.controlPlaneReplicas = topo.controlPlane?.replicas || 3;
        this.form.workerReplicas = topo.workers?.machineDeployments?.[0]?.replicas || 3;

        const vars = {};
        for (const v of (topo.variables || [])) {
          vars[v.name] = v.value;
        }
        this.form.externalNetworkId  = vars.externalNetworkId || '';
        this.form.imageName          = vars.imageName || '';
        this.form.controlPlaneFlavor = vars.controlPlaneFlavor || '';
        this.form.workerFlavor       = vars.workerFlavor || '';
        this.form.bastionEnabled     = vars.bastionEnabled || false;
        this.form.bastionFlavor      = vars.bastionFlavor || '';
      }
    },

    async initOpenStackApi() {
      // Try to load credential from store
      try {
        const secrets = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/secrets?labelSelector=clusterstack.x-k8s.io%2Fcredential%3Dopenstack',
        });
        const secret = secrets?.items?.[0];
        if (secret) {
          const decode = (k) => secret.data?.[k] ? atob(secret.data[k]) : '';
          this.openstackApi = new OpenStackApiService({
            authUrl:     decode('authUrl'),
            username:    decode('username'),
            password:    decode('password'),
            projectName: decode('projectName'),
            domainName:  decode('domainName'),
            regionName:  decode('regionName'),
          }, this.$store);

          await Promise.all([
            this.loadFlavors(),
            this.loadImages(),
            this.loadNetworks(),
          ]);
        }
      } catch {
        // No credentials configured
      }
    },

    async loadFlavors() {
      this.loadingFlavors = true;
      try {
        this.flavors = await this.openstackApi.getFlavors();
      } catch {
        this.flavors = [];
      } finally {
        this.loadingFlavors = false;
      }
    },

    async loadImages() {
      this.loadingImages = true;
      try {
        this.images = await this.openstackApi.getGlanceImages();
      } catch {
        this.images = [];
      } finally {
        this.loadingImages = false;
      }
    },

    async loadNetworks() {
      this.loadingNetworks = true;
      try {
        this.externalNetworks = await this.openstackApi.getExternalNetworks();
      } catch {
        this.externalNetworks = [];
      } finally {
        this.loadingNetworks = false;
      }
    },

    onVersionChange(version) {
      // Find matching ClusterStack and set ClusterClass
      const matching = this.clusterStacks.find(
        (s) => s.spec?.kubernetesVersion === version || (s.status?.usableVersions || []).includes(version),
      );
      if (matching) {
        this.form.clusterClass = matching.metadata.name;
      }
    },

    _quotaTimer: null,
    debounceQuotaCheck() {
      clearTimeout(this._quotaTimer);
      this._quotaTimer = setTimeout(() => this.checkQuota(), 800);
    },

    async checkQuota() {
      if (!this.openstackApi || !this.form.controlPlaneFlavor || !this.form.workerFlavor) {
        return;
      }

      this.checkingQuota = true;
      this.quotaResult = null;

      try {
        // Resolve flavor details
        const cpFlavor = this.flavors.find((f) => f.name === this.form.controlPlaneFlavor);
        const wFlavor  = this.flavors.find((f) => f.name === this.form.workerFlavor);
        const bFlavor  = this.flavors.find((f) => f.name === this.form.bastionFlavor);

        if (!cpFlavor || !wFlavor) {
          return;
        }

        this.quotaResult = await validateQuota(this.openstackApi, {
          controlPlaneReplicas: this.form.controlPlaneReplicas,
          workerReplicas:       this.form.workerReplicas,
          bastionEnabled:       this.form.bastionEnabled,
          controlPlaneFlavor:   this.form.controlPlaneFlavor,
          workerFlavor:         this.form.workerFlavor,
          bastionFlavor:        this.form.bastionFlavor,
          controlPlaneCpus:     cpFlavor.vcpus,
          controlPlaneRamMb:    cpFlavor.ram,
          workerCpus:           wFlavor.vcpus,
          workerRamMb:          wFlavor.ram,
          bastionCpus:          bFlavor?.vcpus,
          bastionRamMb:         bFlavor?.ram,
        });
      } catch {
        // Quota check failed silently
      } finally {
        this.checkingQuota = false;
      }
    },

    async save() {
      if (!this.canSave) {
        return;
      }

      this.saving = true;

      try {
        // If etcd backup is enabled, create Swift container first
        if (this.form.etcdBackupEnabled && this.openstackApi && this.form.etcdContainerName) {
          await this.openstackApi.createContainer(this.form.etcdContainerName);
        }

        const clusterObj = this.buildClusterObject();
        const method = this.isEdit ? 'PUT' : 'POST';
        const url = this.isEdit
          ? `/apis/cluster.x-k8s.io/v1beta1/namespaces/${this.form.namespace}/clusters/${this.form.name}`
          : `/apis/cluster.x-k8s.io/v1beta1/namespaces/${this.form.namespace}/clusters`;

        await this.$store.dispatch('management/request', {
          method,
          url,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(clusterObj),
        });

        this.$emit('save');
      } catch (e) {
        console.error('Failed to save cluster:', e); // eslint-disable-line no-console
      } finally {
        this.saving = false;
      }
    },

    buildClusterObject() {
      const variables = [
        { name: 'externalNetworkId',  value: this.form.externalNetworkId },
        { name: 'imageName',          value: this.form.imageName },
        { name: 'controlPlaneFlavor', value: this.form.controlPlaneFlavor },
        { name: 'workerFlavor',       value: this.form.workerFlavor },
        { name: 'bastionEnabled',     value: this.form.bastionEnabled },
      ];

      if (this.form.bastionEnabled && this.form.bastionFlavor) {
        variables.push({ name: 'bastionFlavor', value: this.form.bastionFlavor });
      }

      if (this.form.etcdBackupEnabled && this.form.etcdContainerName) {
        variables.push({ name: 'etcdBackupEnabled',    value: true });
        variables.push({ name: 'etcdBackupContainer',  value: this.form.etcdContainerName });
      }

      return {
        apiVersion: 'cluster.x-k8s.io/v1beta1',
        kind:       'Cluster',
        metadata: {
          name:      this.form.name,
          namespace: this.form.namespace,
        },
        spec: {
          topology: {
            class:   this.form.clusterClass,
            version: this.form.k8sVersion,
            controlPlane: { replicas: this.form.controlPlaneReplicas },
            workers: {
              machineDeployments: [
                {
                  class:    'worker',
                  name:     'md-0',
                  replicas: this.form.workerReplicas,
                },
              ],
            },
            variables,
          },
        },
      };
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-form {
  max-width: 900px;
}

.form-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 24px;

  .tab-btn {
    padding: 10px 20px;
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--body-text);

    &.active {
      border-bottom-color: var(--primary);
      color: var(--primary);
      font-weight: 600;
    }

    &:hover:not(.active) {
      background: var(--hover);
    }
  }
}

.tab-panel {
  padding: 0 0 16px 0;
}

.form-row {
  margin-bottom: 16px;

  &.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

.description {
  color: var(--muted);
  margin-bottom: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

h3 {
  margin: 16px 0 12px 0;
  font-size: 1em;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}
</style>
