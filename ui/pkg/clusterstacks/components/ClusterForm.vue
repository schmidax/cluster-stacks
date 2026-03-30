<template>
  <div class="cluster-form">
    <!-- ═══ TABS ═══ -->
    <div class="form-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ t(tab.labelKey) }}
        <span v-if="tabErrors[tab.id]" class="tab-error-dot" />
      </button>
    </div>

    <!-- ═══ GENERAL TAB ═══ -->
    <div v-show="activeTab === 'general'" class="tab-panel">
      <div class="form-section">
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.name"
            :label="t('clusterstacks.clusterCreate.name')"
            :required="true"
            :disabled="isEdit"
          />
          <LabeledInput
            v-model="form.namespace"
            :label="t('clusterstacks.clusterCreate.namespace')"
            :required="true"
          />
        </div>
        <div class="form-row two-col">
          <LabeledSelect
            v-model="form.k8sVersion"
            :label="t('clusterstacks.clusterCreate.k8sVersion')"
            :placeholder="t('clusterstacks.clusterCreate.k8sVersionPlaceholder')"
            :options="k8sVersionOptions"
            :required="true"
            @input="onVersionChange"
          />
          <LabeledInput
            v-model="form.clusterClass"
            :label="t('clusterstacks.clusterCreate.clusterClass')"
            :disabled="true"
          />
        </div>
      </div>

      <!-- Identity Ref -->
      <h3>{{ t('clusterstacks.clusterCreate.identity.title') }}</h3>
      <div class="form-section">
        <div class="form-row two-col">
          <LabeledSelect
            v-model="form.identityRefName"
            :label="t('clusterstacks.clusterCreate.identity.secretName')"
            :placeholder="'openstack'"
            :options="secretOptions"
            :loading="loadingSecrets"
            :taggable="true"
            :required="true"
          />
          <LabeledInput
            v-model="form.identityRefCloudName"
            :label="t('clusterstacks.clusterCreate.identity.cloudName')"
            :placeholder="'openstack'"
          />
        </div>
      </div>

      <!-- Control Plane Replicas -->
      <h3>{{ t('clusterstacks.clusterCreate.controlPlane.title') }}</h3>
      <div class="form-section">
        <div class="form-row" style="max-width: 240px;">
          <LabeledInput
            v-model.number="form.controlPlaneReplicas"
            :label="t('clusterstacks.clusterCreate.controlPlane.replicas')"
            type="number"
            :min="1"
            :required="true"
          />
        </div>
      </div>
    </div>

    <!-- ═══ IMAGE TAB ═══ -->
    <div v-show="activeTab === 'image'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.image.title') }}</h3>
      <div class="form-section">
        <div class="form-row">
          <LabeledSelect
            v-model="form.imageName"
            :label="t('clusterstacks.clusterCreate.image.imageName')"
            :placeholder="t('clusterstacks.clusterCreate.image.imageNamePlaceholder')"
            :options="imageOptions"
            :loading="loadingImages"
            :taggable="true"
            :required="true"
          />
        </div>
        <div class="form-row two-col">
          <div class="checkbox-row">
            <Checkbox
              v-model="form.imageIsOrc"
              :label="t('clusterstacks.clusterCreate.image.isOrc')"
            />
            <p class="field-hint">{{ t('clusterstacks.clusterCreate.image.isOrcHint') }}</p>
          </div>
          <div class="checkbox-row">
            <Checkbox
              v-model="form.imageAddVersion"
              :label="t('clusterstacks.clusterCreate.image.addVersion')"
            />
            <p class="field-hint">{{ t('clusterstacks.clusterCreate.image.addVersionHint') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ NETWORKING TAB ═══ -->
    <div v-show="activeTab === 'networking'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.network.title') }}</h3>
      <div class="form-section">
        <div class="form-row">
          <LabeledSelect
            v-model="form.networkExternalID"
            :label="t('clusterstacks.clusterCreate.network.externalNetwork')"
            :placeholder="t('clusterstacks.clusterCreate.network.externalNetworkPlaceholder')"
            :options="externalNetworkOptions"
            :loading="loadingNetworks"
            :required="true"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model.number="form.networkMTU"
            :label="t('clusterstacks.clusterCreate.network.mtu')"
            type="number"
            :placeholder="'1500'"
          />
          <LabeledInput
            v-model="form.nodeCIDR"
            :label="t('clusterstacks.clusterCreate.network.nodeCIDR')"
            :placeholder="'10.8.0.0/20'"
          />
        </div>
        <div class="form-row">
          <LabeledInput
            v-model="form.dnsNameservers"
            :label="t('clusterstacks.clusterCreate.network.dnsNameservers')"
            :placeholder="'9.9.9.9, 149.112.112.112'"
          />
          <p class="field-hint">{{ t('clusterstacks.clusterCreate.network.dnsHint') }}</p>
        </div>
        <div class="form-row">
          <Checkbox
            v-model="form.disableAPIServerFloatingIP"
            :label="t('clusterstacks.clusterCreate.network.disableFloatingIP')"
          />
        </div>

        <h3>{{ t('clusterstacks.clusterCreate.network.cni') }}</h3>
        <div class="form-row" style="max-width: 300px;">
          <LabeledSelect
            v-model="form.clusterCNI"
            :label="t('clusterstacks.clusterCreate.network.cniLabel')"
            :options="cniOptions"
          />
        </div>
      </div>

      <h3>{{ t('clusterstacks.clusterCreate.apiServer.title') }}</h3>
      <div class="form-section">
        <div class="form-row two-col">
          <LabeledSelect
            v-model="form.apiServerLoadBalancer"
            :label="t('clusterstacks.clusterCreate.apiServer.loadBalancer')"
            :options="lbOptions"
          />
          <LabeledInput
            v-model="form.certSANs"
            :label="t('clusterstacks.clusterCreate.apiServer.certSANs')"
            :placeholder="'mydomain.example'"
          />
        </div>
        <div v-if="form.apiServerLoadBalancer === 'octavia-amphora'" class="form-row">
          <LabeledInput
            v-model="form.apiServerLBAllowedCIDRs"
            :label="t('clusterstacks.clusterCreate.apiServer.allowedCIDRs')"
            :placeholder="'192.168.10.0/24'"
          />
          <p class="field-hint">{{ t('clusterstacks.clusterCreate.apiServer.allowedCIDRsHint') }}</p>
        </div>
      </div>
    </div>

    <!-- ═══ CONTROL PLANE TAB ═══ -->
    <div v-show="activeTab === 'controlPlane'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.controlPlane.compute') }}</h3>
      <div class="form-section">
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
            v-model.number="form.controlPlaneRootDisk"
            :label="t('clusterstacks.clusterCreate.controlPlane.rootDisk')"
            type="number"
            :min="0"
            :placeholder="'50'"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.controlPlaneServerGroupID"
            :label="t('clusterstacks.clusterCreate.controlPlane.serverGroupID')"
            :placeholder="t('clusterstacks.clusterCreate.controlPlane.serverGroupIDPlaceholder')"
          />
          <LabeledInput
            v-model="form.controlPlaneAvailabilityZones"
            :label="t('clusterstacks.clusterCreate.controlPlane.availabilityZones')"
            :placeholder="'nova'"
          />
        </div>
        <div class="form-row">
          <Checkbox
            v-model="form.controlPlaneOmitAvailabilityZone"
            :label="t('clusterstacks.clusterCreate.controlPlane.omitAZ')"
          />
          <p class="field-hint">{{ t('clusterstacks.clusterCreate.controlPlane.omitAZHint') }}</p>
        </div>
      </div>
    </div>

    <!-- ═══ WORKER POOLS TAB ═══ -->
    <div v-show="activeTab === 'workers'" class="tab-panel">
      <div class="pool-header">
        <h3>{{ t('clusterstacks.clusterCreate.workerPools.title') }}</h3>
        <button class="btn btn-sm role-primary" @click="addWorkerPool">
          <i class="icon icon-plus" /> {{ t('clusterstacks.clusterCreate.workerPools.addPool') }}
        </button>
      </div>

      <div v-if="!form.workerPools.length" class="no-data-inline">
        {{ t('clusterstacks.clusterCreate.workerPools.noPoolsHint') }}
      </div>

      <div v-for="(pool, idx) in form.workerPools" :key="idx" class="pool-card">
        <div class="pool-card-header">
          <h4>{{ pool.name || ('md-' + idx) }}</h4>
          <button class="btn btn-sm role-link" @click="removeWorkerPool(idx)">
            <i class="icon icon-trash" />
          </button>
        </div>

        <div class="form-row two-col">
          <LabeledInput
            v-model="pool.name"
            :label="t('clusterstacks.clusterCreate.workerPools.poolName')"
            :placeholder="'md-' + idx"
          />
          <LabeledInput
            v-model.number="pool.replicas"
            :label="t('clusterstacks.clusterCreate.workerPools.replicas')"
            type="number"
            :min="0"
            :required="true"
          />
        </div>

        <h5>{{ t('clusterstacks.clusterCreate.workerPools.overrides') }}</h5>
        <div class="form-row two-col">
          <LabeledSelect
            v-model="pool.workerFlavor"
            :label="t('clusterstacks.clusterCreate.worker.flavor')"
            :placeholder="t('clusterstacks.clusterCreate.worker.flavorPlaceholder')"
            :options="flavorOptions"
            :loading="loadingFlavors"
          />
          <LabeledInput
            v-model.number="pool.workerRootDisk"
            :label="t('clusterstacks.clusterCreate.worker.rootDisk')"
            type="number"
            :min="0"
            :placeholder="'50'"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model="pool.workerServerGroupID"
            :label="t('clusterstacks.clusterCreate.worker.serverGroupID')"
            :placeholder="t('clusterstacks.clusterCreate.worker.serverGroupIDPlaceholder')"
          />
          <LabeledInput
            v-model="pool.workerSecurityGroups"
            :label="t('clusterstacks.clusterCreate.worker.securityGroups')"
            :placeholder="'sg-name-1, sg-name-2'"
          />
        </div>

        <!-- Additional Block Devices -->
        <div class="block-device-section">
          <div class="block-device-header">
            <h5>{{ t('clusterstacks.clusterCreate.workerPools.blockDevices') }}</h5>
            <button class="btn btn-sm role-secondary" @click="addBlockDevice(idx)">
              <i class="icon icon-plus" />
            </button>
          </div>
          <div v-for="(bd, bdIdx) in pool.additionalBlockDevices" :key="bdIdx" class="block-device-row">
            <LabeledInput
              v-model="bd.name"
              :label="t('clusterstacks.clusterCreate.workerPools.bdName')"
              :placeholder="'data-disk'"
              class="bd-field"
            />
            <LabeledInput
              v-model.number="bd.sizeGiB"
              :label="t('clusterstacks.clusterCreate.workerPools.bdSize')"
              type="number"
              :min="1"
              :placeholder="'20'"
              class="bd-field"
            />
            <button class="btn btn-sm role-link bd-remove" @click="removeBlockDevice(idx, bdIdx)">
              <i class="icon icon-trash" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ BASTION TAB ═══ -->
    <div v-show="activeTab === 'bastion'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.bastion.title') }}</h3>
      <div class="form-section">
        <div class="form-row">
          <Checkbox
            v-model="form.bastionEnabled"
            :label="t('clusterstacks.clusterCreate.bastion.enabled')"
          />
        </div>
        <template v-if="form.bastionEnabled">
          <div class="form-row two-col">
            <LabeledSelect
              v-model="form.bastionFlavor"
              :label="t('clusterstacks.clusterCreate.bastion.flavor')"
              :placeholder="t('clusterstacks.clusterCreate.bastion.flavorPlaceholder')"
              :options="flavorOptions"
              :loading="loadingFlavors"
            />
            <LabeledInput
              v-model.number="form.bastionRootDisk"
              :label="t('clusterstacks.clusterCreate.bastion.rootDisk')"
              type="number"
              :min="0"
              :placeholder="'25'"
            />
          </div>
          <div class="form-row">
            <LabeledInput
              v-model="form.bastionServerGroupID"
              :label="t('clusterstacks.clusterCreate.bastion.serverGroupID')"
              :placeholder="t('clusterstacks.clusterCreate.bastion.serverGroupIDPlaceholder')"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ SECURITY TAB ═══ -->
    <div v-show="activeTab === 'security'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.security.sshTitle') }}</h3>
      <div class="form-section">
        <div class="form-row" style="max-width: 400px;">
          <LabeledInput
            v-model="form.sshKeyName"
            :label="t('clusterstacks.clusterCreate.security.sshKeyName')"
            :placeholder="'capi-keypair'"
          />
        </div>
      </div>

      <h3>{{ t('clusterstacks.clusterCreate.security.sgTitle') }}</h3>
      <div class="form-section">
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.securityGroups"
            :label="t('clusterstacks.clusterCreate.security.securityGroups')"
            :placeholder="'sg-name-1, sg-name-2'"
          />
          <LabeledInput
            v-model="form.securityGroupIDs"
            :label="t('clusterstacks.clusterCreate.security.securityGroupIDs')"
            :placeholder="'uuid1, uuid2'"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.workerSecurityGroups"
            :label="t('clusterstacks.clusterCreate.security.workerSGs')"
            :placeholder="'sg-name-1'"
          />
          <LabeledInput
            v-model="form.workerSecurityGroupIDs"
            :label="t('clusterstacks.clusterCreate.security.workerSGIDs')"
            :placeholder="'uuid1'"
          />
        </div>
        <p class="field-hint">{{ t('clusterstacks.clusterCreate.security.sgHint') }}</p>
      </div>
    </div>

    <!-- ═══ OIDC TAB ═══ -->
    <div v-show="activeTab === 'oidc'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.oidc.title') }}</h3>
      <p class="field-hint mb-10">{{ t('clusterstacks.clusterCreate.oidc.description') }}</p>
      <div class="form-section">
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.oidcClientID"
            :label="t('clusterstacks.clusterCreate.oidc.clientID')"
            :placeholder="'kubectl'"
          />
          <LabeledInput
            v-model="form.oidcIssuerURL"
            :label="t('clusterstacks.clusterCreate.oidc.issuerURL')"
            :placeholder="'https://dex.k8s.example.com'"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.oidcUsernameClaim"
            :label="t('clusterstacks.clusterCreate.oidc.usernameClaim')"
            :placeholder="'preferred_username'"
          />
          <LabeledInput
            v-model="form.oidcGroupsClaim"
            :label="t('clusterstacks.clusterCreate.oidc.groupsClaim')"
            :placeholder="'groups'"
          />
        </div>
        <div class="form-row two-col">
          <LabeledInput
            v-model="form.oidcUsernamePrefix"
            :label="t('clusterstacks.clusterCreate.oidc.usernamePrefix')"
            :placeholder="'oidc:'"
          />
          <LabeledInput
            v-model="form.oidcGroupsPrefix"
            :label="t('clusterstacks.clusterCreate.oidc.groupsPrefix')"
            :placeholder="'oidc:'"
          />
        </div>
      </div>
    </div>

    <!-- ═══ ETCD BACKUP TAB ═══ -->
    <div v-show="activeTab === 'etcd'" class="tab-panel">
      <h3>{{ t('clusterstacks.clusterCreate.etcdBackup.title') }}</h3>
      <p class="field-hint mb-10">{{ t('clusterstacks.clusterCreate.etcdBackup.description') }}</p>
      <div class="form-section">
        <div class="form-row">
          <Checkbox
            v-model="form.etcdBackupEnabled"
            :label="t('clusterstacks.clusterCreate.etcdBackup.enabled')"
          />
        </div>
        <template v-if="form.etcdBackupEnabled">
          <div class="form-row two-col">
            <LabeledInput
              v-model="form.etcdS3Endpoint"
              :label="t('clusterstacks.clusterCreate.etcdBackup.endpoint')"
              :placeholder="'rgw.example.com:6780'"
              :disabled="!!autoSwiftEndpoint"
            />
            <LabeledInput
              v-model="form.etcdS3Region"
              :label="t('clusterstacks.clusterCreate.etcdBackup.region')"
              :placeholder="'us-west'"
            />
          </div>

          <!-- Container Selection -->
          <h4>{{ t('clusterstacks.clusterCreate.etcdBackup.containerTitle') }}</h4>
          <div class="form-row">
            <div class="container-selector">
              <LabeledSelect
                v-if="swiftContainers.length"
                v-model="form.etcdS3Bucket"
                :label="t('clusterstacks.clusterCreate.etcdBackup.bucket')"
                :placeholder="t('clusterstacks.clusterCreate.etcdBackup.bucketPlaceholder')"
                :options="containerOptions"
                :loading="loadingContainers"
                :taggable="true"
              />
              <LabeledInput
                v-else
                v-model="form.etcdS3Bucket"
                :label="t('clusterstacks.clusterCreate.etcdBackup.bucket')"
                :placeholder="t('clusterstacks.clusterCreate.etcdBackup.bucketPlaceholder')"
              />
              <button
                v-if="form.etcdS3Bucket && !containerExists(form.etcdS3Bucket)"
                class="btn btn-sm role-primary mt-5"
                @click="createSwiftContainer"
              >
                <i class="icon icon-plus" />
                {{ t('clusterstacks.clusterCreate.etcdBackup.createContainer') }}
              </button>
            </div>
          </div>
          <p v-if="containerCreated" class="text-success mt-5">
            <i class="icon icon-checkmark" /> {{ t('clusterstacks.clusterCreate.etcdBackup.containerCreated') }}
          </p>
        </template>
      </div>
    </div>

    <!-- ═══ QUOTA WARNING ═══ -->
    <QuotaWarning
      v-if="quotaResult"
      :result="quotaResult"
      :checking="checkingQuota"
    />

    <!-- ═══ SAVE / CANCEL ═══ -->
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
        {{ isEdit ? t('clusterstacks.clusterCreate.update') : t('clusterstacks.clusterCreate.save') }}
      </BusyButton>
    </div>
  </div>
</template>

<script>
import LabeledInput  from './LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import Checkbox      from './Checkbox.vue';
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
    selectedStack: {
      type:    Object,
      default: null,
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      activeTab: 'general',

      form: {
        // General
        name:                 '',
        namespace:            'default',
        k8sVersion:           '',
        clusterClass:         '',
        controlPlaneReplicas: 3,

        // Identity
        identityRefName:      'openstack',
        identityRefCloudName: 'openstack',

        // Image
        imageName:        'ubuntu-capi-image',
        imageIsOrc:       false,
        imageAddVersion:  true,

        // Network
        networkExternalID:          '',
        networkMTU:                 null,
        nodeCIDR:                   '10.8.0.0/20',
        dnsNameservers:             '9.9.9.9, 149.112.112.112',
        disableAPIServerFloatingIP: false,
        clusterCNI:                 'cilium',

        // API Server
        apiServerLoadBalancer:    'octavia-ovn',
        certSANs:                 '',
        apiServerLBAllowedCIDRs:  '',

        // Control Plane Compute
        controlPlaneFlavor:              'SCS-2V-4',
        controlPlaneRootDisk:            50,
        controlPlaneServerGroupID:       '',
        controlPlaneAvailabilityZones:   '',
        controlPlaneOmitAvailabilityZone: false,

        // Worker Pools
        workerPools: [
          {
            name:                    'md-0',
            replicas:                3,
            class:                   'default-worker',
            workerFlavor:            'SCS-4V-8',
            workerRootDisk:          50,
            workerServerGroupID:     '',
            workerSecurityGroups:    '',
            additionalBlockDevices:  [],
          },
        ],

        // Bastion
        bastionEnabled:       false,
        bastionFlavor:        'SCS-2V-4',
        bastionRootDisk:      25,
        bastionServerGroupID: '',

        // Security
        sshKeyName:              '',
        securityGroups:          '',
        securityGroupIDs:        '',
        workerSecurityGroups:    '',
        workerSecurityGroupIDs:  '',

        // OIDC
        oidcClientID:       '',
        oidcIssuerURL:      '',
        oidcUsernameClaim:  'preferred_username',
        oidcGroupsClaim:    'groups',
        oidcUsernamePrefix: 'oidc:',
        oidcGroupsPrefix:   'oidc:',

        // ETCD Backup
        etcdBackupEnabled: false,
        etcdS3Endpoint:    '',
        etcdS3Region:      '',
        etcdS3Bucket:      '',
      },

      // OpenStack data
      flavors:          [],
      images:           [],
      externalNetworks: [],
      swiftContainers:  [],
      availableSecrets: [],

      loadingFlavors:    false,
      loadingImages:     false,
      loadingNetworks:   false,
      loadingContainers: false,
      loadingSecrets:    false,

      // Auto-detected Swift endpoint
      autoSwiftEndpoint: '',
      containerCreated:  false,

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
        { id: 'general',      labelKey: 'clusterstacks.clusterCreate.tabs.general' },
        { id: 'image',        labelKey: 'clusterstacks.clusterCreate.tabs.image' },
        { id: 'networking',   labelKey: 'clusterstacks.clusterCreate.tabs.networking' },
        { id: 'controlPlane', labelKey: 'clusterstacks.clusterCreate.tabs.controlPlane' },
        { id: 'workers',      labelKey: 'clusterstacks.clusterCreate.tabs.workers' },
        { id: 'bastion',      labelKey: 'clusterstacks.clusterCreate.tabs.bastion' },
        { id: 'security',     labelKey: 'clusterstacks.clusterCreate.tabs.security' },
        { id: 'oidc',         labelKey: 'clusterstacks.clusterCreate.tabs.oidc' },
        { id: 'etcd',         labelKey: 'clusterstacks.clusterCreate.tabs.etcd' },
      ];
    },

    tabErrors() {
      const errs = {};

      if (!this.form.name || !this.form.namespace || !this.form.k8sVersion) {
        errs.general = true;
      }
      if (!this.form.networkExternalID) {
        errs.networking = true;
      }
      if (!this.form.controlPlaneFlavor) {
        errs.controlPlane = true;
      }

      return errs;
    },

    k8sVersionOptions() {
      // The k8s version comes from spec.kubernetesVersion on the ClusterStack,
      // NOT from usableVersions (which are ClusterStack release versions like v1, v2, v3).
      if (this.selectedStack) {
        const k8sVer = this.selectedStack.kubernetesVersion || this.selectedStack.raw?.spec?.kubernetesVersion || '';

        if (k8sVer) {
          // Collect all k8s versions from stacks with same provider+name
          const provider = this.selectedStack.provider;
          const stackName = this.selectedStack.name;
          const versions = new Set();

          versions.add(k8sVer);
          for (const s of this.clusterStacks) {
            if (s.spec?.provider === provider && s.spec?.name === stackName && s.spec?.kubernetesVersion) {
              versions.add(s.spec.kubernetesVersion);
            }
          }

          return [...versions].sort().reverse().map((v) => ({ label: `K8s ${ v }`, value: v }));
        }
      }

      // Fallback: collect all unique k8s versions from all stacks
      const versions = new Set();

      for (const stack of this.clusterStacks) {
        if (stack.spec?.kubernetesVersion) {
          versions.add(stack.spec.kubernetesVersion);
        }
      }

      return [...versions].sort().reverse().map((v) => ({ label: `K8s ${ v }`, value: v }));
    },

    flavorOptions() {
      return this.flavors.map((f) => ({
        label: `${ f.name } (${ f.vcpus } vCPU, ${ f.ram } MiB RAM, ${ f.disk } GiB Disk)`,
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
        label: `${ n.name } (${ n.id.substring(0, 8) }...)`,
        value: n.id,
      }));
    },

    cniOptions() {
      return [
        { label: 'Cilium', value: 'cilium' },
        { label: 'Canal',  value: 'canal' },
        { label: 'Calico', value: 'calico' },
      ];
    },

    lbOptions() {
      return [
        { label: 'Octavia OVN (default)',  value: 'octavia-ovn' },
        { label: 'Octavia Amphora',        value: 'octavia-amphora' },
        { label: 'None',                   value: 'none' },
      ];
    },

    containerOptions() {
      return this.swiftContainers.map((c) => ({
        label: c.name,
        value: c.name,
      }));
    },

    secretOptions() {
      return this.availableSecrets.map((s) => ({
        label: s.metadata?.name || s,
        value: s.metadata?.name || s,
      }));
    },

    canSave() {
      const { name, namespace, k8sVersion, networkExternalID, controlPlaneFlavor } = this.form;

      return !!(name && namespace && k8sVersion && networkExternalID && controlPlaneFlavor);
    },
  },

  watch: {
    existingCluster: {
      handler(val) {
        if (val) {
          this.populateFromExisting();
          this.initOpenStackApi();
        }
      },
      immediate: false,
    },
    selectedStack: {
      handler(val) {
        if (val && !this.isEdit) {
          this.form.clusterClass = val.clusterClassName || '';
          this.form.namespace = val.raw?.metadata?.namespace || 'default';
        }
      },
      immediate: false,
    },
    'form.controlPlaneFlavor': 'debounceQuotaCheck',
    'form.controlPlaneReplicas': 'debounceQuotaCheck',
    'form.bastionEnabled': 'debounceQuotaCheck',
    'form.etcdBackupEnabled'(val) {
      if (val && !this.swiftContainers.length) {
        this.loadSwiftContainers();
      }
    },
  },

  async mounted() {
    if (this.existingCluster) {
      this.populateFromExisting();
    } else if (this.selectedStack) {
      this.form.clusterClass = this.selectedStack.clusterClassName || '';
      this.form.namespace = this.selectedStack.raw?.metadata?.namespace || 'default';

      // Auto-select k8s version from the selected stack
      const k8sVer = this.selectedStack.kubernetesVersion || this.selectedStack.raw?.spec?.kubernetesVersion || '';

      if (k8sVer && !this.form.k8sVersion) {
        this.form.k8sVersion = k8sVer;
      }
    }
    await this.initOpenStackApi();
  },

  methods: {
    // ── Populate from existing cluster ────────────────
    populateFromExisting() {
      const c = this.existingCluster;

      this.form.name      = c.metadata.name;
      this.form.namespace = c.metadata.namespace;

      const topo = c.spec?.topology;

      if (!topo) {
        return;
      }

      this.form.k8sVersion    = topo.version || '';
      this.form.clusterClass  = topo.class || '';
      this.form.controlPlaneReplicas = topo.controlPlane?.replicas || 3;

      // Parse variables
      const vars = {};

      for (const v of (topo.variables || [])) {
        vars[v.name] = v.value;
      }

      // Image
      this.form.imageName       = vars.imageName || 'ubuntu-capi-image';
      this.form.imageIsOrc      = vars.imageIsOrc ?? false;
      this.form.imageAddVersion = vars.imageAddVersion ?? true;

      // Network
      this.form.networkExternalID          = vars.networkExternalID || '';
      this.form.networkMTU                 = vars.networkMTU || null;
      this.form.nodeCIDR                   = vars.nodeCIDR || '10.8.0.0/20';
      this.form.dnsNameservers             = Array.isArray(vars.dnsNameservers) ? vars.dnsNameservers.join(', ') : '';
      this.form.disableAPIServerFloatingIP = vars.disableAPIServerFloatingIP || false;
      this.form.clusterCNI                 = vars.clusterCNI || 'cilium';

      // API Server
      this.form.apiServerLoadBalancer   = vars.apiServerLoadBalancer || 'octavia-ovn';
      this.form.certSANs               = Array.isArray(vars.certSANs) ? vars.certSANs.join(', ') : '';
      this.form.apiServerLBAllowedCIDRs = Array.isArray(vars.apiServerLoadBalancerOctaviaAmphoraAllowedCIDRs)
        ? vars.apiServerLoadBalancerOctaviaAmphoraAllowedCIDRs.join(', ')
        : '';

      // Control Plane
      this.form.controlPlaneFlavor              = vars.controlPlaneFlavor || 'SCS-2V-4';
      this.form.controlPlaneRootDisk            = vars.controlPlaneRootDisk ?? 50;
      this.form.controlPlaneServerGroupID       = vars.controlPlaneServerGroupID || '';
      this.form.controlPlaneAvailabilityZones   = Array.isArray(vars.controlPlaneAvailabilityZones) ? vars.controlPlaneAvailabilityZones.join(', ') : '';
      this.form.controlPlaneOmitAvailabilityZone = vars.controlPlaneOmitAvailabilityZone || false;

      // Bastion
      this.form.bastionEnabled       = vars.bastionEnabled || false;
      this.form.bastionFlavor        = vars.bastionFlavor || 'SCS-2V-4';
      this.form.bastionRootDisk      = vars.bastionRootDisk ?? 25;
      this.form.bastionServerGroupID = vars.bastionServerGroupID || '';

      // Identity
      if (vars.identityRef) {
        this.form.identityRefName      = vars.identityRef.name || 'openstack';
        this.form.identityRefCloudName = vars.identityRef.cloudName || 'openstack';
      }

      // Security
      this.form.sshKeyName             = vars.sshKeyName || '';
      this.form.securityGroups         = Array.isArray(vars.securityGroups) ? vars.securityGroups.join(', ') : '';
      this.form.securityGroupIDs       = Array.isArray(vars.securityGroupIDs) ? vars.securityGroupIDs.join(', ') : '';
      this.form.workerSecurityGroups   = Array.isArray(vars.workerSecurityGroups) ? vars.workerSecurityGroups.join(', ') : '';
      this.form.workerSecurityGroupIDs = Array.isArray(vars.workerSecurityGroupIDs) ? vars.workerSecurityGroupIDs.join(', ') : '';

      // OIDC
      if (vars.oidcConfig) {
        this.form.oidcClientID       = vars.oidcConfig.clientID || '';
        this.form.oidcIssuerURL      = vars.oidcConfig.issuerURL || '';
        this.form.oidcUsernameClaim  = vars.oidcConfig.usernameClaim || 'preferred_username';
        this.form.oidcGroupsClaim    = vars.oidcConfig.groupsClaim || 'groups';
        this.form.oidcUsernamePrefix = vars.oidcConfig.usernamePrefix || 'oidc:';
        this.form.oidcGroupsPrefix   = vars.oidcConfig.groupsPrefix || 'oidc:';
      }

      // ETCD Backup
      if (vars.controlPlaneETCDBackupS3) {
        const etcd = vars.controlPlaneETCDBackupS3;

        this.form.etcdBackupEnabled = etcd.enabled || false;
        this.form.etcdS3Endpoint    = etcd.endpoint || '';
        this.form.etcdS3Region      = etcd.region || '';
        this.form.etcdS3Bucket      = etcd.bucket || '';
      }

      // Worker Pools
      const mds = topo.workers?.machineDeployments || [];

      if (mds.length) {
        this.form.workerPools = mds.map((md) => {
          const overrides = {};

          for (const ov of (md.variables?.overrides || [])) {
            overrides[ov.name] = ov.value;
          }

          return {
            name:                   md.name || 'md-0',
            replicas:               md.replicas || 3,
            class:                  md.class || 'default-worker',
            workerFlavor:           overrides.workerFlavor || vars.workerFlavor || 'SCS-4V-8',
            workerRootDisk:         overrides.workerRootDisk ?? vars.workerRootDisk ?? 50,
            workerServerGroupID:    overrides.workerServerGroupID || '',
            workerSecurityGroups:   Array.isArray(overrides.workerSecurityGroups) ? overrides.workerSecurityGroups.join(', ') : '',
            additionalBlockDevices: overrides.workerAdditionalBlockDevices || [],
          };
        });
      }
    },

    // ── OpenStack API init ────────────────────────────
    async initOpenStackApi() {
      try {
        // Load available secrets for credential dropdown
        await this.loadSecrets();

        let secret = null;

        if (this.form.namespace) {
          try {
            secret = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ this.form.namespace }/secrets/openstack`,
            });
          } catch {
            // not found
          }
        }

        if (!secret) {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });
          const csoNamespaces = (nsResponse?.items || [])
            .map((ns) => ns.metadata.name)
            .filter((n) => n.startsWith('cso-'));

          for (const ns of csoNamespaces) {
            try {
              secret = await this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/api/v1/namespaces/${ ns }/secrets/openstack`,
              });
              break;
            } catch {
              // not found
            }
          }
        }

        if (secret) {
          const decode = (k) => (secret.data?.[k] ? atob(secret.data[k]) : '');

          this.openstackApi = new OpenStackApiService(decode('clouds.yaml'), this.$store);

          await Promise.all([
            this.loadFlavors(),
            this.loadImages(),
            this.loadNetworks(),
          ]);

          // Auto-detect Swift endpoint
          try {
            this.autoSwiftEndpoint = await this.openstackApi.getSwiftEndpoint();

            if (this.autoSwiftEndpoint && !this.form.etcdS3Endpoint) {
              this.form.etcdS3Endpoint = this.autoSwiftEndpoint;
            }
          } catch {
            // Swift not available
          }
        }
      } catch {
        // No credentials
      }
    },

    async loadSecrets() {
      this.loadingSecrets = true;
      try {
        // Load secrets from the cluster namespace and cso-* namespaces
        const namespacesToSearch = [this.form.namespace];

        // Also look in cso-* namespaces
        try {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });
          const csoNamespaces = (nsResponse?.items || [])
            .map((ns) => ns.metadata.name)
            .filter((n) => n.startsWith('cso-'));

          namespacesToSearch.push(...csoNamespaces);
        } catch {
          // ignore
        }

        const secrets = [];

        for (const ns of [...new Set(namespacesToSearch)]) {
          try {
            const result = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ ns }/secrets`,
            });
            const items = result?.items || [];

            // Filter to Opaque and cloud-config type secrets that likely contain clouds.yaml
            for (const s of items) {
              if (s.data?.['clouds.yaml'] || s.data?.['cloud.conf'] || s.metadata?.name === 'openstack') {
                secrets.push(s);
              }
            }
          } catch {
            // namespace not accessible
          }
        }

        this.availableSecrets = secrets;
      } catch {
        this.availableSecrets = [];
      } finally {
        this.loadingSecrets = false;
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

    async loadSwiftContainers() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingContainers = true;
      try {
        this.swiftContainers = await this.openstackApi.listContainers();
      } catch {
        this.swiftContainers = [];
      } finally {
        this.loadingContainers = false;
      }
    },

    containerExists(name) {
      return this.swiftContainers.some((c) => c.name === name);
    },

    async createSwiftContainer() {
      if (!this.openstackApi || !this.form.etcdS3Bucket) {
        return;
      }
      try {
        await this.openstackApi.createContainer(this.form.etcdS3Bucket);
        this.containerCreated = true;
        await this.loadSwiftContainers();
      } catch (e) {
        console.error('Failed to create container:', e); // eslint-disable-line no-console
      }
    },

    onVersionChange(version) {
      if (this.selectedStack) {
        // ClusterClass is already set => no need to change
        return;
      }
      const matching = this.clusterStacks.find(
        (s) => s.spec?.kubernetesVersion === version || (s.status?.usableVersions || []).includes(version),
      );

      if (matching) {
        this.form.clusterClass = matching.metadata.name;
      }
    },

    // ── Worker Pools ──────────────────────────────────
    addWorkerPool() {
      this.form.workerPools.push({
        name:                   `md-${ this.form.workerPools.length }`,
        replicas:               3,
        class:                  'default-worker',
        workerFlavor:           'SCS-4V-8',
        workerRootDisk:         50,
        workerServerGroupID:    '',
        workerSecurityGroups:   '',
        additionalBlockDevices: [],
      });
    },

    removeWorkerPool(idx) {
      this.form.workerPools.splice(idx, 1);
    },

    addBlockDevice(poolIdx) {
      this.form.workerPools[poolIdx].additionalBlockDevices.push({
        name:    '',
        sizeGiB: 20,
        type:    '__DEFAULT__',
      });
    },

    removeBlockDevice(poolIdx, bdIdx) {
      this.form.workerPools[poolIdx].additionalBlockDevices.splice(bdIdx, 1);
    },

    // ── Quota ─────────────────────────────────────────
    _quotaTimer: null,

    debounceQuotaCheck() {
      clearTimeout(this._quotaTimer);
      this._quotaTimer = setTimeout(() => this.checkQuota(), 800);
    },

    async checkQuota() {
      if (!this.openstackApi || !this.form.controlPlaneFlavor) {
        return;
      }

      // Sum up all worker pools
      const totalWorkerReplicas = this.form.workerPools.reduce((s, p) => s + (p.replicas || 0), 0);
      const primaryPoolFlavor = this.form.workerPools[0]?.workerFlavor || '';

      if (!primaryPoolFlavor) {
        return;
      }

      this.checkingQuota = true;
      this.quotaResult = null;

      try {
        const cpFlavor = this.flavors.find((f) => f.name === this.form.controlPlaneFlavor);
        const wFlavor  = this.flavors.find((f) => f.name === primaryPoolFlavor);
        const bFlavor  = this.flavors.find((f) => f.name === this.form.bastionFlavor);

        if (!cpFlavor || !wFlavor) {
          return;
        }

        this.quotaResult = await validateQuota(this.openstackApi, {
          controlPlaneReplicas: this.form.controlPlaneReplicas,
          workerReplicas:       totalWorkerReplicas,
          bastionEnabled:       this.form.bastionEnabled,
          controlPlaneFlavor:   this.form.controlPlaneFlavor,
          workerFlavor:         primaryPoolFlavor,
          bastionFlavor:        this.form.bastionFlavor,
          controlPlaneCpus:     cpFlavor.vcpus,
          controlPlaneRamMb:    cpFlavor.ram,
          workerCpus:           wFlavor.vcpus,
          workerRamMb:          wFlavor.ram,
          bastionCpus:          bFlavor?.vcpus,
          bastionRamMb:         bFlavor?.ram,
        });
      } catch {
        // silent
      } finally {
        this.checkingQuota = false;
      }
    },

    // ── Save ──────────────────────────────────────────
    async save() {
      if (!this.canSave) {
        return;
      }

      this.saving = true;

      try {
        // Create ETCD Swift container if needed
        if (this.form.etcdBackupEnabled && this.openstackApi && this.form.etcdS3Bucket) {
          if (!this.containerExists(this.form.etcdS3Bucket)) {
            await this.openstackApi.createContainer(this.form.etcdS3Bucket);
          }
        }

        const clusterObj = this.buildClusterObject();
        const method = this.isEdit ? 'PUT' : 'POST';
        const url = this.isEdit
          ? `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ this.form.namespace }/clusters/${ this.form.name }`
          : `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ this.form.namespace }/clusters`;

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

    // ── Build CAPI Cluster object ─────────────────────
    buildClusterObject() {
      const f = this.form;
      const variables = [];

      // Helper: only add if non-empty / non-default
      const addVar = (name, value) => {
        if (value !== '' && value !== null && value !== undefined) {
          variables.push({ name, value });
        }
      };

      const addArrayVar = (name, csv) => {
        const arr = csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : [];

        if (arr.length) {
          variables.push({ name, value: arr });
        }
      };

      // Image
      addVar('imageName', f.imageName);
      addVar('imageIsOrc', f.imageIsOrc);
      addVar('imageAddVersion', f.imageAddVersion);

      // Network
      addVar('networkExternalID', f.networkExternalID);
      if (f.networkMTU) {
        addVar('networkMTU', f.networkMTU);
      }
      addVar('nodeCIDR', f.nodeCIDR);
      addArrayVar('dnsNameservers', f.dnsNameservers);
      addVar('disableAPIServerFloatingIP', f.disableAPIServerFloatingIP);
      addVar('clusterCNI', f.clusterCNI);

      // API Server
      addVar('apiServerLoadBalancer', f.apiServerLoadBalancer);
      addArrayVar('certSANs', f.certSANs);
      if (f.apiServerLoadBalancer === 'octavia-amphora') {
        addArrayVar('apiServerLoadBalancerOctaviaAmphoraAllowedCIDRs', f.apiServerLBAllowedCIDRs);
      }

      // Control Plane
      addVar('controlPlaneFlavor', f.controlPlaneFlavor);
      addVar('controlPlaneRootDisk', f.controlPlaneRootDisk);
      if (f.controlPlaneServerGroupID) {
        addVar('controlPlaneServerGroupID', f.controlPlaneServerGroupID);
      }
      addArrayVar('controlPlaneAvailabilityZones', f.controlPlaneAvailabilityZones);
      if (f.controlPlaneOmitAvailabilityZone) {
        addVar('controlPlaneOmitAvailabilityZone', true);
      }

      // Use the first pool's flavor as the global workerFlavor
      if (f.workerPools.length) {
        addVar('workerFlavor', f.workerPools[0].workerFlavor);
        addVar('workerRootDisk', f.workerPools[0].workerRootDisk);
      }

      // Bastion
      addVar('bastionEnabled', f.bastionEnabled);
      if (f.bastionEnabled) {
        addVar('bastionFlavor', f.bastionFlavor);
        addVar('bastionRootDisk', f.bastionRootDisk);
        if (f.bastionServerGroupID) {
          addVar('bastionServerGroupID', f.bastionServerGroupID);
        }
      }

      // Identity
      if (f.identityRefName || f.identityRefCloudName) {
        variables.push({
          name:  'identityRef',
          value: {
            name:      f.identityRefName || 'openstack',
            cloudName: f.identityRefCloudName || 'openstack',
          },
        });
      }

      // Security
      if (f.sshKeyName) {
        addVar('sshKeyName', f.sshKeyName);
      }
      addArrayVar('securityGroups', f.securityGroups);
      addArrayVar('securityGroupIDs', f.securityGroupIDs);
      addArrayVar('workerSecurityGroups', f.workerSecurityGroups);
      addArrayVar('workerSecurityGroupIDs', f.workerSecurityGroupIDs);

      // OIDC
      if (f.oidcClientID && f.oidcIssuerURL) {
        variables.push({
          name:  'oidcConfig',
          value: {
            clientID:       f.oidcClientID,
            issuerURL:      f.oidcIssuerURL,
            usernameClaim:  f.oidcUsernameClaim || 'preferred_username',
            groupsClaim:    f.oidcGroupsClaim || 'groups',
            usernamePrefix: f.oidcUsernamePrefix || 'oidc:',
            groupsPrefix:   f.oidcGroupsPrefix || 'oidc:',
          },
        });
      }

      // ETCD Backup
      if (f.etcdBackupEnabled) {
        variables.push({
          name:  'controlPlaneETCDBackupS3',
          value: {
            enabled:  true,
            endpoint: f.etcdS3Endpoint,
            region:   f.etcdS3Region,
            bucket:   f.etcdS3Bucket,
          },
        });
      }

      // Build worker machineDeployments with variable overrides
      const machineDeployments = f.workerPools.map((pool) => {
        const md = {
          class:    pool.class || 'default-worker',
          name:     pool.name,
          replicas: pool.replicas,
        };

        // Variable overrides per pool
        const overrides = [];

        if (pool.workerFlavor && pool.workerFlavor !== f.workerPools[0]?.workerFlavor) {
          overrides.push({ name: 'workerFlavor', value: pool.workerFlavor });
        }
        if (pool.workerRootDisk !== undefined && pool.workerRootDisk !== f.workerPools[0]?.workerRootDisk) {
          overrides.push({ name: 'workerRootDisk', value: pool.workerRootDisk });
        }
        if (pool.workerServerGroupID) {
          overrides.push({ name: 'workerServerGroupID', value: pool.workerServerGroupID });
        }
        if (pool.workerSecurityGroups) {
          const arr = pool.workerSecurityGroups.split(',').map((s) => s.trim()).filter(Boolean);

          if (arr.length) {
            overrides.push({ name: 'workerSecurityGroups', value: arr });
          }
        }
        if (pool.additionalBlockDevices?.length) {
          overrides.push({ name: 'workerAdditionalBlockDevices', value: pool.additionalBlockDevices });
        }

        if (overrides.length) {
          md.variables = { overrides };
        }

        return md;
      });

      const cluster = {
        apiVersion: 'cluster.x-k8s.io/v1beta1',
        kind:       'Cluster',
        metadata:   {
          name:      f.name,
          namespace: f.namespace,
        },
        spec: {
          topology: {
            class:        f.clusterClass,
            version:      f.k8sVersion,
            controlPlane: { replicas: f.controlPlaneReplicas },
            workers:      { machineDeployments },
            variables,
          },
        },
      };

      // Preserve metadata for edit
      if (this.isEdit && this.existingCluster?.metadata) {
        cluster.metadata.resourceVersion = this.existingCluster.metadata.resourceVersion;
      }

      return cluster;
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-form {
  max-width: 960px;
}

// ── Tabs ──────────────────────────────────────────────
.form-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 24px;
  overflow-x: auto;

  .tab-btn {
    position: relative;
    padding: 10px 18px;
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    color: var(--body-text);
    white-space: nowrap;
    font-size: 13px;

    &.active {
      border-bottom-color: var(--primary);
      color: var(--primary);
      font-weight: 600;
    }

    &:hover:not(.active) {
      background: var(--hover);
    }
  }

  .tab-error-dot {
    position: absolute;
    top: 6px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--error);
  }
}

.tab-panel {
  padding: 0 0 16px 0;
}

// ── Form layout ───────────────────────────────────────
.form-section {
  margin-bottom: 16px;
}

.form-row {
  margin-bottom: 16px;

  &.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
}

h3 {
  margin: 20px 0 12px;
  font-size: 0.85em;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.05em;
}

h4 {
  margin: 16px 0 8px;
  font-size: 0.95em;
}

h5 {
  margin: 12px 0 8px;
  font-size: 0.85em;
  color: var(--muted);
}

.field-hint {
  font-size: 12px;
  color: var(--muted);
  margin: 2px 0 0;
}

.checkbox-row {
  padding-top: 8px;
}

// ── Worker Pools ──────────────────────────────────────
.pool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h3 { margin: 0; }
}

.pool-card {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 16px;
  margin-bottom: 16px;
  background: var(--body-bg);
}

.pool-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h4 {
    margin: 0;
    font-weight: 600;
  }
}

.no-data-inline {
  padding: 20px;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: var(--border-radius);
}

// ── Block Devices ─────────────────────────────────────
.block-device-section {
  margin-top: 12px;
}

.block-device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h5 { margin: 0; }
}

.block-device-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 8px;

  .bd-field { flex: 1; }
  .bd-remove { flex-shrink: 0; }
}

// ── Container selector ────────────────────────────────
.container-selector {
  max-width: 500px;
}

// ── Actions ───────────────────────────────────────────
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.mt-5  { margin-top: 5px; }
.mb-10 { margin-bottom: 10px; }

.text-success {
  color: var(--success);
}
</style>
