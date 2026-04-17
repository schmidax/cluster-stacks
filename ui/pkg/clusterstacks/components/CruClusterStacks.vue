<script>
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource';
import Loading from '@shell/components/Loading';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import Tab from '@shell/components/Tabbed/Tab';
import Tabbed from '@shell/components/Tabbed';
import { Checkbox } from '@components/Form/Checkbox';
import QuotaWarning from './QuotaWarning.vue';
import { OpenStackApiService } from '../services/openstack-api';
import { FLEET_MANAGED_TOOLTIP, isFleetManagedResource } from '../utils/fleet-management';
import { validateQuota, getDefaultQuotaResult } from '../services/quota-validator';
import { ROUTES } from '../config/clusterstacks';
import jsyaml from 'js-yaml';

const CREATE_NEW_BUCKET_OPTION = '__create_new_bucket__';
const CREATE_NEW_FOLDER_OPTION = '__create_new_folder__';

export default {
  name: 'CruClusterStacks',

  components: {
    CruResource,
    Loading,
    LabeledInput,
    LabeledSelect,
    Tab,
    Tabbed,
    Checkbox,
    QuotaWarning,
  },

  mixins: [CreateEditView],

  props: {
    mode: {
      type:    String,
      default: _CREATE,
    },

    value: {
      type:    Object,
      default: () => ({}),
    },
  },

  async fetch() {
    await this.loadCurrentUser();

    // Load ClusterStacks and ClusterStackReleases in parallel
    await Promise.all([
      (async () => {
        try {
          this.clusterStacks = await this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstack',
          }) || [];
        } catch {
          // Non-admin: fall back to namespace-scoped queries
          this.clusterStacks = await this.loadClusterStacksNamespaceScoped();
        }
      })(),
      (async () => {
        try {
          this.releases = await this.$store.dispatch('management/findAll', {
            type: 'clusterstack.x-k8s.io.clusterstackrelease',
          }) || [];
        } catch {
          // Non-admin: fall back to namespace-scoped queries
          this.releases = await this.loadReleasesNamespaceScoped();
        }
      })(),
    ]);

    // Load available OpenStack secrets from namespaces visible to the user
    await this.loadSecrets();

    // If editing, load existing CAPI Cluster and pre-populate
    if (this.isEdit) {
      await this.loadExistingCAPICluster();
    }

    // Auto-preselect single credential option
    if (!this.selectedCredentialKey && this.availableCredentialOptions.length === 1) {
      this.selectedCredentialKey = this.availableCredentialOptions[0].value;
    }

    // Auto-connect if credential is already determined
    if (this.selectedCredentialKey) {
      await this.onProjectChange(this.selectedCredentialKey);
    }

    if (!this.isEdit) {
      this.applyDefaultK8sVersion();
      this.applyDefaultImageForSelectedStack();
    }
  },

  data() {
    return {
      clusterStacks: [],
      releases:      [],

      // Form state
      form: {
        // General
        name:                 '',
        namespace:            'default',
        k8sVersion:           '',
        clusterClass:         '',
        clusterClassNamespace: '',
        controlPlaneReplicas: 1,

        // Identity
        identityRefName:      'openstack',
        identityRefCloudName: 'openstack',

        // Image
        imageName:        'ubuntu-capi-image',
        imageIsOrc:       false,
        imageAddVersion:  false,

        // Network
        networkExternalID:          '',
        networkMTU:                 null,
        nodeCIDR:                   '10.8.0.0/20',
        clusterPodsCIDR:            '172.16.0.0/16',
        clusterServiceDomain:       'cluster.local',
        clusterServicesCIDR:        '10.96.0.0/12',
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
            name:                   'md-0',
            replicas:               3,
            class:                  'default-worker',
            workerFlavor:           'SCS-4V-8',
            workerRootDisk:         50,
            workerServerGroupID:    '',
            workerAvailabilityZones: '',
            workerSecurityGroups:   '',
            additionalBlockDevices: [],
          },
        ],

        // Bastion
        bastionEnabled:       true,
        bastionFlavor:        'SCS-2V-4',
        bastionRootDisk:      25,
        bastionServerGroupID: '',

        // Security
        sshKeyName:              '',
        securityGroups:          '',
        securityGroupIDs:        '',

        // OIDC
        oidcClientID:       '',
        oidcIssuerURL:      '',
        oidcUsernameClaim:  'preferred_username',
        oidcGroupsClaim:    'groups',
        oidcUsernamePrefix: 'oidc:',
        oidcGroupsPrefix:   'oidc:',

        // ETCD Backup
        etcdBackupEnabled:   false,
        etcdS3Endpoint:      '',
        etcdS3Region:        '',
        etcdS3Bucket:        '',
        etcdS3Folder:        '',
        etcdEC2CredentialId: '',
      },

      // OpenStack data
      flavors:            [],
      images:             [],
      externalNetworks:   [],
      swiftContainers:    [],
      swiftFolders:       [],
      swiftFolderCounts:  {},
      availableSecrets:   [],
      keyPairs:           [],
      securityGroupsData: [],
      ec2Credentials:     [],
      availabilityZones:  [],

      // Loading states
      loadingFlavors:         false,
      loadingImages:          false,
      loadingNetworks:        false,
      loadingContainers:      false,
      loadingFolders:         false,
      loadingSecrets:         false,
      loadingKeyPairs:        false,
      loadingSecurityGroups:  false,
      loadingEC2Credentials:  false,
      loadingAvailabilityZones: false,

      // UI
      autoSwiftEndpoint:      '',
      containerCreated:       false,
      createDialogOpen:       false,
      createDialogType:       'bucket',
      createDialogValue:      '',
      createDialogError:      '',
      createDialogParentPath: '',
      confirmDeleteFolderPath: '',
      deletingFolderPath:    '',
      keyPairDialogOpen:     false,
      keyPairDialogName:     '',
      keyPairDialogPublicKeyUrl: '',
      keyPairDialogPublicKey: '',
      keyPairDialogError:    '',
      keyPairDialogLoadingFromUrl: false,
      selectedCredentialKey:  '',
      credentialChangePending: false,
      credentialChangeTo:     '',
      quotaResult:            getDefaultQuotaResult(),
      checkingQuota:          false,
      quotaTimer:             null,
      lastSuggestedClusterName: '',
      existingCAPICluster:    null,
      openstackApi:           null,
      flavorDefaultsApplied:  false,
      savedCluster:          false,
      currentUserIsAdmin:    false,
    };
  },

  computed: {
    isCreate() {
      return this.mode === _CREATE;
    },

    isEdit() {
      return this.mode === _EDIT;
    },

    isView() {
      return this.mode === _VIEW;
    },

    doneRoute() {
      return ROUTES.CLUSTERS;
    },

    CREATE() {
      return _CREATE;
    },

    VIEW() {
      return _VIEW;
    },

    // ── Dropdown options ────────────────────────────
    k8sVersionOptions() {
      const prefixToGroupName = {};

      for (const stack of this.clusterStacks) {
        const provider = stack.spec?.provider || '';
        const stackName = stack.spec?.name || stack.metadata?.name || '';
        const shortVersion = (stack.spec?.kubernetesVersion || '').replace(/\./g, '-');

        if (!provider || !stackName || !shortVersion) {
          continue;
        }

        const prefix = `${ provider }-${ stackName }-${ shortVersion }`;

        prefixToGroupName[prefix] = stackName;
      }

      const grouped = {};
      const addVersion = (groupName, fullVersion) => {
        if (!groupName || !fullVersion) {
          return;
        }

        if (!grouped[groupName]) {
          grouped[groupName] = [];
        }

        if (!grouped[groupName].some((v) => v.value === fullVersion)) {
          const clean = String(fullVersion).replace(/^v/, '').split('+')[0];
          const [maj = '0', min = '0', pat = '0'] = clean.split('.');

          grouped[groupName].push({
            value: fullVersion,
            major: parseInt(maj, 10) || 0,
            minor: parseInt(min, 10) || 0,
            patch: parseInt(pat, 10) || 0,
          });
        }
      };

      for (const release of this.releases) {
        const releaseName = release.metadata?.name || '';
        const releasePrefix = releaseName.replace(/-v\d+(?:[-.][a-z0-9]+(?:[.-][a-z0-9]+)*)?$/i, '');
        const groupName = prefixToGroupName[releasePrefix] || 'other';
        const fullVersion = release.status?.kubernetesVersion || release.spec?.kubernetesVersion || '';

        addVersion(groupName, fullVersion);
      }

      // Fallback if no releases are available
      if (!Object.keys(grouped).length) {
        for (const stack of this.clusterStacks) {
          const groupName = stack.spec?.name || stack.metadata?.name || 'other';
          const ver = stack.spec?.kubernetesVersion || stack.metadata?.labels?.['kubernetes-version'];

          addVersion(groupName, ver);
        }
      }

      const output = [];

      Object.keys(grouped).sort((a, b) => a.localeCompare(b)).forEach((groupName) => {
        const versions = grouped[groupName].sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch);
        const latestPatchByMinor = {};

        for (const v of versions) {
          const key = `${ v.major }.${ v.minor }`;

          if (latestPatchByMinor[key] === undefined || v.patch > latestPatchByMinor[key]) {
            latestPatchByMinor[key] = v.patch;
          }
        }

        output.push({
          kind:     'group',
          label:    groupName,
          disabled: true,
        });

        versions.forEach((v) => {
          const key = `${ v.major }.${ v.minor }`;
          const deprecated = v.patch < latestPatchByMinor[key];

          output.push({
            label: deprecated ? `${ v.value } (deprecated)` : v.value,
            value: v.value,
          });
        });
      });

      return output;
    },

    availableCredentialOptions() {
      const projects = this.availableSecrets
        .filter((s) => s.metadata?.name === 'openstack')
        .filter((s) => {
          const ns = s.metadata?.namespace || '';

          return ns.startsWith('cso-') && ns !== 'cso-system';
        })
        .map((s) => ({
          namespace: s.metadata?.namespace || '',
          label:     (s.metadata?.namespace || '').replace(/^cso-/, ''),
        }))
        .filter((item) => item.namespace)
        .filter((item, idx, arr) => arr.findIndex((x) => x.namespace === item.namespace) === idx)
        .sort((a, b) => a.label.localeCompare(b.label));

      return projects.map((item) => ({ label: item.label, value: item.namespace }));
    },

    keyPairOptions() {
      return this.keyPairs.map((k) => ({ label: k.name, value: k.name }));
    },

    flavorOptions() {
      return this.flavors.map((f) => ({
        label: `${ f.name } (${ f.vcpus } vCPU, ${ this.formatRamSize(f.ram) } RAM, ${ f.disk } GiB Disk)`,
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
        { label: 'Cilium (recommended)', value: 'cilium' },
        { label: 'Canal',                value: 'canal' },
        { label: 'Calico',               value: 'calico' },
      ];
    },

    lbOptions() {
      return [
        { label: 'Octavia OVN (default)', value: 'octavia-ovn' },
        { label: 'Octavia Amphora',       value: 'octavia-amphora' },
        { label: 'None',                  value: 'none' },
      ];
    },

    containerOptions() {
      const options = this.swiftContainers.map((c) => ({ label: c.name, value: c.name }));

      if (this.mode !== _VIEW) {
        options.unshift({ label: 'Create new bucket...', value: CREATE_NEW_BUCKET_OPTION });
      }

      return options;
    },

    folderOptions() {
      const options = this.swiftFolders.map((f) => ({
        label: `${ f } (${ this.swiftFolderCounts[f] || 0 })`,
        value: f,
      }));

      if (this.mode !== _VIEW && this.form.etcdS3Bucket) {
        options.unshift({ label: 'Edit folder...', value: CREATE_NEW_FOLDER_OPTION });
      }

      return options;
    },

    dialogFolderChildren() {
      const current = (this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');
      const prefix = current ? `${ current }/` : '';
      const children = new Set();

      for (const full of this.swiftFolders) {
        const normalized = String(full || '').replace(/^\/+|\/+$/g, '');

        if (!normalized || !normalized.startsWith(prefix)) {
          continue;
        }

        const rest = normalized.slice(prefix.length);

        if (!rest) {
          continue;
        }

        const next = rest.split('/')[0];

        if (next) {
          children.add(current ? `${ current }/${ next }` : next);
        }
      }

      return Array.from(children).sort();
    },

    canGoDialogFolderUp() {
      return !!(this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');
    },

    dialogCurrentFolderCount() {
      const path = (this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');

      if (!path) {
        return 0;
      }

      return this.swiftFolderCounts[path] || 0;
    },

    ec2CredentialOptions() {
      return this.ec2Credentials.map((c) => ({
        label: c.id || c.credential_id || 'ec2-credential',
        value: c.id || c.credential_id,
      }));
    },

    securityGroupOptions() {
      return this.filteredSecurityGroups.map((sg) => ({
        label: sg.name,
        value: sg.name,
      }));
    },

    availabilityZoneOptions() {
      return this.availabilityZones.map((az) => ({
        label: az,
        value: az,
      }));
    },

    filteredSecurityGroups() {
      return this.securityGroupsData.filter((sg) => {
        const name = (sg.name || '').toLowerCase();

        return !(name.startsWith('k8s-') || name.startsWith('capi-') || name.includes('cluster-api'));
      });
    },

    selectedSecurityGroupsData() {
      const selected = new Set(
        (this.form.securityGroups || '').split(',').map((v) => v.trim()).filter(Boolean),
      );

      return this.filteredSecurityGroups.filter((sg) => selected.has(sg.name));
    },

    resolvedClassNamespace() {
      const explicit = (this.form.clusterClassNamespace || '').trim();

      if (explicit) {
        return explicit;
      }

      const className = (this.form.clusterClass || '').trim();

      if (className) {
        const releaseByClass = this.releases.find((r) => r.metadata?.name === className);

        if (releaseByClass?.metadata?.namespace) {
          return releaseByClass.metadata.namespace;
        }

        const stackByClass = this.clusterStacks.find((s) => s.metadata?.name === className);

        if (stackByClass?.metadata?.namespace) {
          return stackByClass.metadata.namespace;
        }
      }

      const releaseByVersion = this.releases.find(
        (r) => (r.status?.kubernetesVersion || r.spec?.kubernetesVersion) === this.form.k8sVersion,
      );

      if (releaseByVersion?.metadata?.namespace) {
        return releaseByVersion.metadata.namespace;
      }

      const stackByVersion = this.clusterStacks.find(
        (s) => s.spec?.kubernetesVersion === this.form.k8sVersion,
      );

      if (stackByVersion?.metadata?.namespace) {
        return stackByVersion.metadata.namespace;
      }

      return 'clusterstacks';
    },

    basicTabNeedsAttention() {
      return !(this.form.k8sVersion && this.form.clusterClass && this.form.imageName && this.form.sshKeyName);
    },

    networkTabNeedsAttention() {
      return !(this.form.networkExternalID && this.form.clusterPodsCIDR && this.form.clusterServiceDomain && this.form.clusterServicesCIDR);
    },

    etcdTabNeedsAttention() {
      if (!this.form.etcdBackupEnabled) {
        return false;
      }

      return !(this.form.etcdS3Endpoint && this.form.etcdS3Region && this.form.etcdS3Bucket && this.form.etcdEC2CredentialId);
    },

    oidcTabNeedsAttention() {
      const hasClientOrIssuer = !!(this.form.oidcClientID || this.form.oidcIssuerURL);

      if (!hasClientOrIssuer) {
        return false;
      }

      return !(this.form.oidcClientID && this.form.oidcIssuerURL);
    },

    basicTabLabel() {
      return this.basicTabNeedsAttention ? 'Basic *' : 'Basic';
    },

    networkTabLabel() {
      const label = this.t('clusterstacks.clusterCreate.network.title');

      return this.networkTabNeedsAttention ? `${ label } *` : label;
    },

    securityTabLabel() {
      return 'Security-Groups';
    },

    etcdTabLabel() {
      const label = this.t('clusterstacks.clusterCreate.etcdBackup.title');

      return this.etcdTabNeedsAttention ? `${ label } *` : label;
    },

    oidcTabLabel() {
      const label = this.t('clusterstacks.clusterCreate.oidc.title');

      return this.oidcTabNeedsAttention ? `${ label } *` : label;
    },

    controlPlaneReplicaOptions() {
      const defaults = [1, 3, 5, 7, 9];
      const current = this.normalizeControlPlaneReplicas(this.form.controlPlaneReplicas);
      const values = current > defaults[defaults.length - 1] ? [...defaults, current] : defaults;

      return [...new Set(values)]
        .sort((a, b) => a - b)
        .map((v) => ({ label: `${ v }`, value: v }));
    },

    isProjectSelectionRequired() {
      return !this.selectedCredentialKey;
    },

    canSave() {
      const {
        name,
        namespace,
        k8sVersion,
        networkExternalID,
        clusterPodsCIDR,
        clusterServiceDomain,
        clusterServicesCIDR,
        controlPlaneFlavor,
        sshKeyName,
      } = this.form;

      return !!(
        name
        && namespace
        && k8sVersion
        && networkExternalID
        && clusterPodsCIDR
        && clusterServiceDomain
        && clusterServicesCIDR
        && controlPlaneFlavor
        && sshKeyName
        && this.selectedCredentialKey
        && !this.isFleetManagedExisting
        && this.quotaResult.valid
      );
    },
    
    isFleetManagedExisting() {
      return isFleetManagedResource(this.existingCAPICluster);
    },

    fleetManagedTooltip() {
      return FLEET_MANAGED_TOOLTIP;
    },
  },

  watch: {
    'form.controlPlaneFlavor':   'debounceQuotaCheck',
    'form.controlPlaneReplicas'(val) {
      const normalized = this.normalizeControlPlaneReplicas(val);

      if (normalized !== val) {
        this.form.controlPlaneReplicas = normalized;

        return;
      }

      this.debounceQuotaCheck();
    },
    'form.bastionEnabled':       'debounceQuotaCheck',
    'form.controlPlaneRootDisk': 'debounceQuotaCheck',
    'form.bastionRootDisk':      'debounceQuotaCheck',
    'form.workerPools': {
      handler: 'debounceQuotaCheck',
      deep:    true,
    },
    'form.etcdBackupEnabled'(val) {
      if (val && !this.swiftContainers.length) {
        this.loadSwiftContainers();
      }
    },
    'form.etcdS3Bucket'(val) {
      if (val) {
        this.loadSwiftFolders();
      } else {
        this.swiftFolders = [];
      }
    },
  },

  methods: {
    normalizeControlPlaneReplicas(value) {
      const parsed = Number.parseInt(value, 10);

      if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
      }

      return parsed % 2 === 0 ? parsed + 1 : parsed;
    },

    async loadCurrentUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');
      this.currentUserIsAdmin = !!(schema?.resourceMethods || []).includes('PUT');
    },

    // ══════════════════════════════════════════════════
    //  SAVE – override CreateEditView.actuallySave()
    // ══════════════════════════════════════════════════
    async actuallySave() {
      if (this.isFleetManagedExisting) {
        throw new Error(FLEET_MANAGED_TOOLTIP);
      }

      if (!this.canSave) {
        throw new Error('Required fields are missing');
      }

      this.form.controlPlaneReplicas = this.normalizeControlPlaneReplicas(this.form.controlPlaneReplicas);

      // Ensure a FleetWorkspace exists for the target namespace so that
      // Rancher imports the provisioning.cattle.io Cluster (kubeconfig etc.)
      // into the same namespace as the CAPI Cluster, not "default".
      // See: https://github.com/rancher/rancher/issues/50962
      await this.ensureFleetWorkspace(this.form.namespace);

      // Create ETCD Swift container if needed
      if (this.form.etcdBackupEnabled && this.openstackApi && this.form.etcdS3Bucket) {
        if (!this.containerExists(this.form.etcdS3Bucket)) {
          await this.openstackApi.createContainer(this.form.etcdS3Bucket);
        }

        if (this.form.etcdEC2CredentialId) {
          await this.ensureEtcdBackupSecret();
        }
      }

      const clusterObj = this.buildClusterObject();
      const isUpdate = !!this.existingCAPICluster;
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate
        ? `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ this.form.namespace }/clusters/${ this.form.name }`
        : `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ this.form.namespace }/clusters`;

      await this.$store.dispatch('management/request', {
        method,
        url,
        headers: { 'Content-Type': 'application/json' },
        data:    JSON.stringify(clusterObj),
      });

      this.savedCluster = true;
    },

    done() {
      if (this.savedCluster && this.isCreate) {
        this.$router.replace({
          name:  ROUTES.CLUSTERS_STATUS,
          query: {
            namespace: this.form.namespace,
            name:      this.form.name,
          },
        });

        return;
      }

      this.$router.replace({
        name:   ROUTES.CLUSTERS,
        params: { cluster: this.$route.params.cluster },
      });
    },

    // ══════════════════════════════════════════════════
    //  NAMESPACE-SCOPED FALLBACKS (non-admin users)
    // ══════════════════════════════════════════════════
    async discoverAccessibleNamespaces() {
      try {
        const nsResp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });

        return (nsResp?.items || [])
          .map((ns) => ns.metadata?.name)
          .filter(Boolean);
      } catch {
        try {
          const nsResult = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
            opt:  { force: true },
          });

          return (nsResult || [])
            .map((ns) => ns.metadata?.name || ns.id)
            .filter(Boolean);
        } catch {
          return [];
        }
      }
    },

    async loadClusterStacksNamespaceScoped() {
      const allNamespaces = await this.discoverAccessibleNamespaces();
      // ClusterStacks can live in cso-* namespaces or dedicated namespaces like 'clusterstacks'
      const candidates = allNamespaces.filter(
        (ns) => ns.startsWith('cso-') || ns === 'clusterstacks' || ns.startsWith('clusterstacks'),
      );

      const stacks = [];
      const results = await Promise.allSettled(
        candidates.map(async(ns) => {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstacks`,
          });

          return resp?.items || [];
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          stacks.push(...r.value);
        }
      }

      return stacks;
    },

    async loadReleasesNamespaceScoped() {
      const allNamespaces = await this.discoverAccessibleNamespaces();
      const candidates = allNamespaces.filter(
        (ns) => ns.startsWith('cso-') || ns === 'clusterstacks' || ns.startsWith('clusterstacks'),
      );

      const releases = [];
      const results = await Promise.allSettled(
        candidates.map(async(ns) => {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstackreleases`,
          });

          return resp?.items || [];
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          releases.push(...r.value);
        }
      }

      return releases;
    },

    // ══════════════════════════════════════════════════
    //  CREDENTIAL LOADING
    // ══════════════════════════════════════════════════
    async loadSecrets() {
      this.loadingSecrets = true;
      try {
        let namespaces = [];

        try {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });

          namespaces = (nsResponse?.items || [])
            .map((ns) => ns.metadata.name)
            .filter(Boolean);
        } catch {
          // Fallback 1: use Rancher Steve API (respects RBAC, shows project namespaces)
          try {
            const nsResult = await this.$store.dispatch('management/findAll', {
              type: 'namespace',
              opt:  { force: true },
            });

            namespaces = (nsResult || [])
              .map((ns) => ns.metadata?.name || ns.id)
              .filter(Boolean);
          } catch {
            // Fallback 2: namespaces inferred from already visible resources.
            namespaces = [
              ...this.clusterStacks.map((s) => s.metadata?.namespace),
              ...this.releases.map((r) => r.metadata?.namespace),
              this.form.namespace,
            ].filter(Boolean);
          }
        }

        namespaces = Array.from(new Set(namespaces)).filter(
          (ns) => ns && ns.startsWith('cso-') && ns !== 'cso-system',
        );

        const secrets = [];

        for (const ns of namespaces) {
          try {
            const secret = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ ns }/secrets/openstack`,
            });

            if (secret?.data?.['clouds.yaml']) {
              secrets.push(secret);
            }
          } catch {
            // missing openstack secret in this project namespace
          }
        }

        this.availableSecrets = secrets;
      } catch {
        this.availableSecrets = [];
      } finally {
        this.loadingSecrets = false;
      }
    },

    async connectCredential() {
      if (!this.selectedCredentialKey) {
        return;
      }

      const selectedNamespace = this.selectedCredentialKey;
      const selectedSecret = this.availableSecrets.find(
        (s) => s.metadata?.namespace === selectedNamespace && s.metadata?.name === 'openstack',
      );

      if (!selectedSecret) {
        return;
      }

      this.form.identityRefName = 'openstack';
      this.form.identityRefCloudName = 'openstack';

      await this.initOpenStackApi(selectedSecret);
    },

    disconnectCredential() {
      this.openstackApi = null;
      this.autoSwiftEndpoint = '';
      this.flavors = [];
      this.images = [];
      this.externalNetworks = [];
      this.keyPairs = [];
      this.securityGroupsData = [];
      this.ec2Credentials = [];
      this.swiftContainers = [];
      this.swiftFolders = [];
      this.availabilityZones = [];
      this.form.etcdS3Endpoint = '';
    },

    async initOpenStackApi(secret) {
      try {
        const decode = (k) => (secret.data?.[k] ? atob(secret.data[k]) : '');

        this.openstackApi = new OpenStackApiService(decode('clouds.yaml'), this.$store);

        await Promise.all([
          this.loadFlavors(),
          this.loadImages(),
          this.loadNetworks(),
          this.loadKeyPairs(),
          this.loadSecurityGroups(),
          this.loadEC2Credentials(),
          this.loadAvailabilityZones(),
        ]);

        try {
          const endpoint = await this.openstackApi.getSwiftEndpoint();

          this.autoSwiftEndpoint = this.normalizeEtcdEndpoint(endpoint);

          if (this.autoSwiftEndpoint && !this.form.etcdS3Endpoint) {
            this.form.etcdS3Endpoint = this.autoSwiftEndpoint;
          }
        } catch {
          // Swift not available
        }
      } catch {
        this.openstackApi = null;
      }
    },

    // ══════════════════════════════════════════════════
    //  OPENSTACK RESOURCE LOADERS
    // ══════════════════════════════════════════════════
    async loadFlavors() {
      this.loadingFlavors = true;
      try {
        this.flavors = await this.openstackApi.getFlavors();
      } catch { this.flavors = []; } finally { this.loadingFlavors = false; }

      this.applyPreferredFlavorDefaults();
    },

    async loadImages() {
      this.loadingImages = true;
      try {
        this.images = await this.openstackApi.getGlanceImages();
      } catch { this.images = []; } finally { this.loadingImages = false; }

      if (!this.isEdit) {
        this.applyDefaultImageForSelectedStack();
      }
    },

    async loadNetworks() {
      this.loadingNetworks = true;
      try {
        this.externalNetworks = await this.openstackApi.getExternalNetworks();
      } catch { this.externalNetworks = []; } finally { this.loadingNetworks = false; }
    },

    async loadKeyPairs() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingKeyPairs = true;
      try {
        this.keyPairs = await this.openstackApi.getKeyPairs();
      } catch { this.keyPairs = []; } finally { this.loadingKeyPairs = false; }
    },

    async loadSecurityGroups() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingSecurityGroups = true;
      try {
        this.securityGroupsData = await this.openstackApi.getSecurityGroups();
      } catch { this.securityGroupsData = []; } finally { this.loadingSecurityGroups = false; }
    },

    async loadEC2Credentials() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingEC2Credentials = true;
      try {
        this.ec2Credentials = await this.openstackApi.listEC2Credentials();
      } catch { this.ec2Credentials = []; } finally { this.loadingEC2Credentials = false; }
    },

    async loadAvailabilityZones() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingAvailabilityZones = true;
      try {
        this.availabilityZones = await this.openstackApi.getAvailabilityZones();
      } catch { this.availabilityZones = []; } finally { this.loadingAvailabilityZones = false; }
    },

    async loadSwiftContainers() {
      if (!this.openstackApi) {
        return;
      }
      this.loadingContainers = true;
      try {
        this.swiftContainers = await this.openstackApi.listContainers();
      } catch { this.swiftContainers = []; } finally { this.loadingContainers = false; }
    },

    async loadSwiftFolders() {
      if (!this.openstackApi || !this.form.etcdS3Bucket || this.form.etcdS3Bucket === CREATE_NEW_BUCKET_OPTION) {
        this.swiftFolders = [];
        this.swiftFolderCounts = {};
        return;
      }

      this.loadingFolders = true;
      try {
        const stats = await this.openstackApi.listContainerFolderStats(this.form.etcdS3Bucket);

        this.swiftFolders = stats.map((entry) => entry.path);
        this.swiftFolderCounts = stats.reduce((acc, entry) => {
          acc[entry.path] = entry.fileCount;
          return acc;
        }, {});
      } catch {
        this.swiftFolders = [];
        this.swiftFolderCounts = {};
      } finally {
        this.loadingFolders = false;
      }
    },

    normalizeEtcdEndpoint(endpoint) {
      const raw = (endpoint || '').trim();

      if (!raw) {
        return '';
      }

      if (/^https?:\/\//i.test(raw)) {
        try {
          return new URL(raw).host;
        } catch {
          // fallthrough
        }
      }

      return raw.replace(/^https?:\/\//i, '').split('/')[0] || raw;
    },

    async onEtcdBucketSelect(value) {
      const selected = this.selectValue(value);

      if (selected === CREATE_NEW_BUCKET_OPTION) {
        this.openCreateDialog('bucket');
        return;
      }

      this.form.etcdS3Bucket = selected;
      this.form.etcdS3Folder = '';
      await this.loadSwiftFolders();
    },

    async onEtcdFolderSelect(value) {
      const selected = this.selectValue(value);

      if (selected === CREATE_NEW_FOLDER_OPTION) {
        this.openCreateDialog('folder');
        return;
      }

      this.form.etcdS3Folder = selected;
    },

    openCreateDialog(type) {
      this.createDialogType = type;
      this.createDialogValue = '';
      this.createDialogError = '';
      this.createDialogParentPath = type === 'folder'
        ? (this.form.etcdS3Folder || '').replace(/^\/+|\/+$/g, '')
        : '';
      this.createDialogOpen = true;
    },

    closeCreateDialog() {
      this.createDialogOpen = false;
      this.createDialogValue = '';
      this.createDialogError = '';
      this.createDialogParentPath = '';
      this.confirmDeleteFolderPath = '';
    },

    requestDeleteDialogFolder(path) {
      this.confirmDeleteFolderPath = (path || '').replace(/^\/+|\/+$/g, '');
      this.createDialogError = '';
    },

    cancelDeleteDialogFolder() {
      this.confirmDeleteFolderPath = '';
    },

    async confirmDeleteDialogFolder() {
      if (!this.confirmDeleteFolderPath) {
        return;
      }

      await this.deleteDialogFolder(this.confirmDeleteFolderPath);
      this.confirmDeleteFolderPath = '';
    },

    enterDialogFolder(path) {
      this.createDialogParentPath = (path || '').replace(/^\/+|\/+$/g, '');
    },

    goDialogFolderUp() {
      const current = (this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');

      if (!current) {
        return;
      }

      const parts = current.split('/').filter(Boolean);

      parts.pop();
      this.createDialogParentPath = parts.join('/');
    },

    async deleteDialogFolder(path) {
      const cleanPath = (path || '').replace(/^\/+|\/+$/g, '');

      if (!cleanPath || !this.openstackApi || !this.form.etcdS3Bucket) {
        return;
      }

      this.deletingFolderPath = cleanPath;

      try {
        await this.openstackApi.deleteFolder(this.form.etcdS3Bucket, cleanPath);
        await this.loadSwiftFolders();

        if ((this.form.etcdS3Folder || '').startsWith(`${ cleanPath }/`) || this.form.etcdS3Folder === cleanPath) {
          this.form.etcdS3Folder = '';
        }

        const current = (this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');

        if (current && (current === cleanPath || current.startsWith(`${ cleanPath }/`))) {
          this.goDialogFolderUp();
        }
      } catch (e) {
        this.createDialogError = `Failed to delete folder: ${ e?.message || e }`;
      } finally {
        this.deletingFolderPath = '';
      }
    },

    async submitCreateDialog() {
      const value = (this.createDialogValue || '').trim();

      if (!value) {
        this.createDialogError = this.createDialogType === 'bucket' ? this.t('clusterstacks.dialogs.bucketRequired') : this.t('clusterstacks.dialogs.folderRequired');

        return;
      }

      if (!this.openstackApi) {
        this.createDialogError = this.t('clusterstacks.dialogs.connectionNotReady');

        return;
      }

      try {
        if (this.createDialogType === 'bucket') {
          await this.openstackApi.createContainer(value);
          await this.loadSwiftContainers();
          this.form.etcdS3Bucket = value;
          this.form.etcdS3Folder = '';
          this.containerCreated = true;
          await this.loadSwiftFolders();
        } else {
          if (!this.form.etcdS3Bucket) {
            this.createDialogError = this.t('clusterstacks.dialogs.selectBucketFirst');

            return;
          }
          const parent = (this.createDialogParentPath || '').replace(/^\/+|\/+$/g, '');
          const folderName = value.replace(/^\/+|\/+$/g, '');
          const fullPath = parent ? `${ parent }/${ folderName }` : folderName;

          await this.openstackApi.createFolder(this.form.etcdS3Bucket, fullPath);
          await this.loadSwiftFolders();
          this.form.etcdS3Folder = fullPath;
        }

        this.closeCreateDialog();
      } catch (e) {
        this.createDialogError = this.t('clusterstacks.dialogs.failedCreate', { type: this.createDialogType, error: e?.message || e });
      }
    },

    openManifestPreview() {
      try {
        const manifests = this.buildDebugManifests();
        const docs = manifests
          .map((manifest) => jsyaml.dump(manifest, { indent: 2, lineWidth: -1, noRefs: true }).trimEnd())
          .filter(Boolean);
        const yaml = docs.join('\n---\n\n');

        if (!yaml) {
          return;
        }

        const blob = new Blob([yaml], { type: 'text/plain;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');

        if (!win) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      } catch (e) {
        console.error('Failed to render debug manifest preview:', e); // eslint-disable-line no-console
      }
    },

    buildDebugManifests() {
      const manifests = [];
      const cluster = this.buildClusterObject();

      if (cluster) {
        manifests.push(cluster);
      }

      if (this.form.etcdBackupEnabled && this.form.etcdEC2CredentialId) {
        const etcdSecret = this.buildEtcdBackupSecretObject();

        if (etcdSecret) {
          manifests.push(etcdSecret);
        }
      }

      return manifests;
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

    // ══════════════════════════════════════════════════
    //  LOAD EXISTING CAPI CLUSTER (edit mode)
    // ══════════════════════════════════════════════════
    async loadExistingCAPICluster() {
      const { name, namespace } = this.$route?.query || {};

      if (!name || !namespace) {
        return;
      }

      try {
        this.existingCAPICluster = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ namespace }/clusters/${ name }`,
        });

        this.populateFromExisting(this.existingCAPICluster);
      } catch (e) {
        console.error('Failed to load CAPI cluster:', e); // eslint-disable-line no-console
      }
    },

    populateFromExisting(c) {
      this.form.name = c.metadata.name;
      this.form.namespace = c.metadata.namespace;

      const topo = c.spec?.topology;

      if (!topo) {
        return;
      }

      this.form.k8sVersion = topo.version || '';
      this.form.clusterClass = topo.classRef?.name || topo.class || '';
      this.form.clusterClassNamespace = topo.classRef?.namespace || topo.classNamespace || '';
      this.form.controlPlaneReplicas = this.normalizeControlPlaneReplicas(topo.controlPlane?.replicas || 3);

      const vars = {};

      for (const v of (topo.variables || [])) {
        vars[v.name] = v.value;
      }

      // Image
      this.form.imageName = vars.imageName || 'ubuntu-capi-image';
      this.form.imageIsOrc = vars.imageIsOrc ?? false;
      this.form.imageAddVersion = vars.imageAddVersion ?? true;

      // Network
      this.form.networkExternalID = vars.networkExternalID || '';
      this.form.networkMTU = vars.networkMTU || null;
      this.form.nodeCIDR = vars.nodeCIDR || '10.8.0.0/20';
      this.form.clusterPodsCIDR = c.spec?.clusterNetwork?.pods?.cidrBlocks?.[0] || '172.16.0.0/16';
      this.form.clusterServiceDomain = c.spec?.clusterNetwork?.serviceDomain || 'cluster.local';
      this.form.clusterServicesCIDR = c.spec?.clusterNetwork?.services?.cidrBlocks?.[0] || '10.96.0.0/12';
      this.form.dnsNameservers = Array.isArray(vars.dnsNameservers) ? vars.dnsNameservers.join(', ') : '';
      this.form.disableAPIServerFloatingIP = vars.disableAPIServerFloatingIP || false;
      this.form.clusterCNI = vars.clusterCNI || 'cilium';

      // API Server
      this.form.apiServerLoadBalancer = vars.apiServerLoadBalancer || 'octavia-ovn';
      this.form.certSANs = Array.isArray(vars.certSANs) ? vars.certSANs.join(', ') : '';
      this.form.apiServerLBAllowedCIDRs = Array.isArray(vars.apiServerLoadBalancerOctaviaAmphoraAllowedCIDRs)
        ? vars.apiServerLoadBalancerOctaviaAmphoraAllowedCIDRs.join(', ')
        : '';

      // Control Plane
      this.form.controlPlaneFlavor = vars.controlPlaneFlavor || 'SCS-2V-4';
      this.form.controlPlaneRootDisk = vars.controlPlaneRootDisk ?? 50;
      this.form.controlPlaneServerGroupID = vars.controlPlaneServerGroupID || '';
      this.form.controlPlaneAvailabilityZones = Array.isArray(vars.controlPlaneAvailabilityZones)
        ? vars.controlPlaneAvailabilityZones.join(', ')
        : '';
      this.form.controlPlaneOmitAvailabilityZone = vars.controlPlaneOmitAvailabilityZone || false;

      // Bastion
      this.form.bastionEnabled = vars.bastionEnabled || false;
      this.form.bastionFlavor = vars.bastionFlavor || 'SCS-2V-4';
      this.form.bastionRootDisk = vars.bastionRootDisk ?? 25;
      this.form.bastionServerGroupID = vars.bastionServerGroupID || '';

      // Identity
      if (vars.identityRef) {
        this.form.identityRefName = vars.identityRef.name || 'openstack';
        this.form.identityRefCloudName = vars.identityRef.cloudName || 'openstack';
      }

      // Security
      this.form.sshKeyName = vars.sshKeyName || '';
      this.form.securityGroups = Array.isArray(vars.securityGroups) ? vars.securityGroups.join(', ') : '';
      this.form.securityGroupIDs = Array.isArray(vars.securityGroupIDs) ? vars.securityGroupIDs.join(', ') : '';

      // OIDC
      if (vars.oidcConfig) {
        this.form.oidcClientID = vars.oidcConfig.clientID || '';
        this.form.oidcIssuerURL = vars.oidcConfig.issuerURL || '';
        this.form.oidcUsernameClaim = vars.oidcConfig.usernameClaim || 'preferred_username';
        this.form.oidcGroupsClaim = vars.oidcConfig.groupsClaim || 'groups';
        this.form.oidcUsernamePrefix = vars.oidcConfig.usernamePrefix || 'oidc:';
        this.form.oidcGroupsPrefix = vars.oidcConfig.groupsPrefix || 'oidc:';
      }

      // ETCD Backup
      if (vars.controlPlaneETCDBackupS3) {
        const etcd = vars.controlPlaneETCDBackupS3;

        this.form.etcdBackupEnabled = etcd.enabled || false;
        this.form.etcdS3Endpoint = etcd.endpoint || '';
        this.form.etcdS3Region = etcd.region || '';
        this.form.etcdS3Bucket = etcd.bucket || '';
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

      // Pre-select credential from namespace. Existing clusters can live in
      // namespace "foo" while OpenStack secrets are stored in "cso-foo".
      const namespace = this.form.namespace || '';
      const fallbackNamespace = namespace ? `cso-${ String(namespace).replace(/^cso-/, '') }` : '';
      const availableNamespaces = this.availableCredentialOptions.map((opt) => opt.value);

      if (availableNamespaces.includes(namespace)) {
        this.selectedCredentialKey = namespace;
      } else if (availableNamespaces.includes(fallbackNamespace)) {
        this.selectedCredentialKey = fallbackNamespace;
      } else {
        this.selectedCredentialKey = namespace;
      }
    },

    // ══════════════════════════════════════════════════
    //  VERSION CHANGE
    // ══════════════════════════════════════════════════
    onVersionChange(version) {
      // Auto-select cluster-class: find the ClusterStackRelease matching this version
      const matchingRelease = this.releases.find(
        (r) => (r.status?.kubernetesVersion || r.spec?.kubernetesVersion) === version,
      );

      if (matchingRelease) {
        this.form.clusterClass = matchingRelease.metadata.name;
        this.form.clusterClassNamespace = matchingRelease.metadata?.namespace || '';

        return;
      }

      // Fallback: match from ClusterStacks
      const matchingStack = this.clusterStacks.find(
        (s) => s.spec?.kubernetesVersion === version,
      );

      if (matchingStack) {
        this.form.clusterClass = matchingStack.metadata.name;
        this.form.clusterClassNamespace = matchingStack.metadata?.namespace || '';
      }
    },

    onK8sVersionInput(value) {
      const normalized = this.selectValue(value);

      this.form.k8sVersion = normalized;
      this.onVersionChange(normalized);

      if (!this.isEdit) {
        this.applyDefaultImageForSelectedStack();
      }
    },

    applyDefaultK8sVersion() {
      if (this.form.k8sVersion) {
        return;
      }

      const versions = this.k8sVersionOptions
        .filter((opt) => opt && opt.value)
        .map((opt) => opt.value);

      if (!versions.length) {
        return;
      }

      const highest = versions.sort((a, b) => this.compareVersionsDesc(a, b))[0];

      if (highest) {
        this.onK8sVersionInput(highest);
      }
    },

    compareVersionsDesc(a, b) {
      const pa = this.versionParts(a);
      const pb = this.versionParts(b);

      if (pa.major !== pb.major) {
        return pb.major - pa.major;
      }

      if (pa.minor !== pb.minor) {
        return pb.minor - pa.minor;
      }

      return pb.patch - pa.patch;
    },

    versionParts(v) {
      const clean = String(v || '').replace(/^v/, '').split('+')[0];
      const [maj = '0', min = '0', pat = '0'] = clean.split('.');

      return {
        major: parseInt(maj, 10) || 0,
        minor: parseInt(min, 10) || 0,
        patch: parseInt(pat, 10) || 0,
      };
    },

    isRke2ClusterStackSelected() {
      const className = (this.form.clusterClass || '').toLowerCase();

      if (className.includes('rke2')) {
        return true;
      }

      const matchingRelease = this.releases.find(
        (r) => (r.status?.kubernetesVersion || r.spec?.kubernetesVersion) === this.form.k8sVersion,
      );

      const releaseName = (matchingRelease?.metadata?.name || '').toLowerCase();

      if (releaseName.includes('rke2')) {
        return true;
      }

      const matchingStack = this.clusterStacks.find(
        (s) => s.spec?.kubernetesVersion === this.form.k8sVersion,
      );

      return (matchingStack?.spec?.name || '').toLowerCase() === 'rke2';
    },

    pickPreferredUbuntuImage() {
      const active = this.images.filter((i) => i.status === 'active');
      const exactUbuntu = active
        .filter((i) => {
          const name = String(i.name || '').trim();

          // Only accept exact names like "Ubuntu 22.04" / "Ubuntu 24.04".
          return /^ubuntu\s+\d{2}\.\d{2}$/i.test(name);
        })
        .map((i) => {
          const name = String(i.name || '').trim();
          const match = name.match(/(\d{2})\.(\d{2})$/);
          const major = parseInt(match?.[1] || '0', 10);
          const minor = parseInt(match?.[2] || '0', 10);

          return {
            image: i,
            major,
            minor,
          };
        });

      if (!exactUbuntu.length) {
        return null;
      }

      return exactUbuntu
        .sort((a, b) => b.major - a.major || b.minor - a.minor || String(b.image.name || '').localeCompare(String(a.image.name || '')))[0]
        ?.image || null;
    },

    applyDefaultImageForSelectedStack() {
      if (!this.isRke2ClusterStackSelected()) {
        return;
      }

      // rke2 images should not append k8s version suffix in this UI flow.
      this.form.imageAddVersion = false;

      const current = String(this.form.imageName || '').trim();
      const isExactUbuntuVersion = /^ubuntu\s+\d{2}\.\d{2}$/i.test(current);
      const isUbuntuMinimal = /ubuntu/i.test(current) && /minimal/i.test(current);
      const isUbuntuWithSuffix = /ubuntu/i.test(current) && !isExactUbuntuVersion;
      const shouldApply = !current || current === 'ubuntu-capi-image' || isUbuntuMinimal || isUbuntuWithSuffix;

      if (!shouldApply) {
        return;
      }

      const preferred = this.pickPreferredUbuntuImage();

      if (preferred?.name) {
        this.form.imageName = preferred.name;
      } else if (isUbuntuMinimal || isUbuntuWithSuffix) {
        // Avoid persisting invalid auto-selected Ubuntu variants for rke2.
        this.form.imageName = '';
      }
    },

    // ══════════════════════════════════════════════════
    //  POOL MANAGEMENT
    // ══════════════════════════════════════════════════
    addWorkerPool() {
      this.form.workerPools.push({
        name:                   `md-${ this.form.workerPools.length }`,
        replicas:               3,
        class:                  'default-worker',
        workerFlavor:           this.defaultWorkerFlavorName(),
        workerRootDisk:         50,
        workerServerGroupID:    '',
        workerAvailabilityZones: '',
        workerSecurityGroups:   '',
        additionalBlockDevices: [],
      });
    },

    defaultWorkerFlavorName() {
      const preferred = 'SCS-8V-16';

      if (this.flavors.some((f) => f.name === preferred)) {
        return preferred;
      }

      return 'SCS-4V-8';
    },

    applyPreferredFlavorDefaults() {
      if (this.isEdit || this.flavorDefaultsApplied) {
        return;
      }

      const names = new Set(this.flavors.map((f) => f.name));

      if (names.has('SCS-1V-2')) {
        this.form.bastionFlavor = 'SCS-1V-2';
      }

      if (names.has('SCS-2V-4')) {
        this.form.controlPlaneFlavor = 'SCS-2V-4';
      }

      if (names.has('SCS-8V-16')) {
        this.form.workerPools = this.form.workerPools.map((pool) => ({
          ...pool,
          workerFlavor: 'SCS-8V-16',
        }));
      }

      this.flavorDefaultsApplied = true;
    },

    csvToArray(csv) {
      return String(csv || '').split(',').map((s) => s.trim()).filter(Boolean);
    },

    toMultiValues(value) {
      if (!Array.isArray(value)) {
        return [];
      }

      const out = value
        .map((item) => {
          if (item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'value')) {
            return item.value;
          }

          return item;
        })
        .map((v) => String(v || '').trim())
        .filter(Boolean);

      return [...new Set(out)];
    },

    setGlobalSecurityGroups(value) {
      this.form.securityGroups = this.toMultiValues(value).join(', ');
    },

    setWorkerPoolSecurityGroups(pool, value) {
      pool.workerSecurityGroups = this.toMultiValues(value).join(', ');
    },

    removeWorkerPool(idx) {
      // Index 0 in the Tabbed = "control-plane" tab which is not removable.
      // Worker pools start at index 1 in the Tabbed, so the real pool
      // index is (tabbedIndex - 1). The Tab @removeTab emits the Tab index.
      const poolIdx = idx - 1;

      if (poolIdx >= 0 && poolIdx < this.form.workerPools.length) {
        this.form.workerPools.splice(poolIdx, 1);
      }
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

    async onProjectChange(value) {
      const normalized = this.selectValue(value);
      const currentProject = this.selectedCredentialKey;

      // No change
      if (currentProject === normalized) {
        // In edit mode this path is hit on initial load. Ensure we still
        // connect the credential so quota validation can run.
        if (normalized && !this.openstackApi) {
          await this.connectCredential();
          this.debounceQuotaCheck();
        }

        return;
      }

      // Check if form has unsaved changes (simple check)
      const hasChanges = this.form.name || this.form.k8sVersion || this.form.controlPlaneFlavor;

      // If changing project with unsaved changes, show confirmation dialog
      if (hasChanges && currentProject) {
        this.credentialChangeTo = normalized;
        this.credentialChangePending = true;
        return;
      }

      // No pending changes, proceed directly
      this.completeProjectChange(normalized);
    },

    confirmCredentialChange() {
      const newProject = this.credentialChangeTo;
      this.credentialChangePending = false;
      this.credentialChangeTo = '';
      this.completeProjectChange(newProject);
    },

    cancelCredentialChange() {
      // Reset the dropdown to current selection
      this.credentialChangePending = false;
      this.credentialChangeTo = '';
    },

    completeProjectChange(normalized) {
      // Reset form to pristine state
      this.resetForm();

      // Update credential
      this.selectedCredentialKey = normalized;

      if (normalized && !this.isEdit) {
        this.form.namespace = normalized;
        const suggestedName = String(normalized || '').replace(/^cso-/, '');

        if (!this.form.name || this.form.name === this.lastSuggestedClusterName) {
          this.form.name = suggestedName;
          this.lastSuggestedClusterName = suggestedName;
        }
      }

      if (normalized) {
        this.connectCredential().then(() => {
          this.debounceQuotaCheck();
        });
      } else {
        this.disconnectCredential();
      }
    },

    resetForm() {
      // Reset all form fields to defaults
      this.form.name = '';
      this.form.namespace = 'default';
      this.form.k8sVersion = '';
      this.form.clusterClass = '';
      this.form.clusterClassNamespace = '';
      this.form.controlPlaneReplicas = 1;
      this.form.imageName = 'ubuntu-capi-image';
      this.form.imageIsOrc = false;
      this.form.imageAddVersion = false;
      this.form.networkExternalID = '';
      this.form.networkMTU = null;
      this.form.nodeCIDR = '10.8.0.0/20';
      this.form.clusterPodsCIDR = '172.16.0.0/16';
      this.form.clusterServiceDomain = 'cluster.local';
      this.form.clusterServicesCIDR = '10.96.0.0/12';
      this.form.dnsNameservers = '9.9.9.9, 149.112.112.112';
      this.form.disableAPIServerFloatingIP = false;
      this.form.clusterCNI = 'cilium';
      this.form.apiServerLoadBalancer = 'octavia-ovn';
      this.form.certSANs = '';
      this.form.apiServerLBAllowedCIDRs = '';
      this.form.controlPlaneFlavor = 'SCS-2V-4';
      this.form.controlPlaneRootDisk = 50;
      this.form.controlPlaneServerGroupID = '';
      this.form.controlPlaneAvailabilityZones = '';
      this.form.controlPlaneOmitAvailabilityZone = false;
      this.form.workerPools = [
        {
          name: 'md-0',
          replicas: 3,
          class: 'default-worker',
          workerFlavor: 'SCS-4V-8',
          workerRootDisk: 50,
          workerServerGroupID: '',
          workerAvailabilityZones: '',
          workerSecurityGroups: '',
          additionalBlockDevices: [],
        },
      ];
      this.form.bastionEnabled = true;
      this.form.bastionFlavor = 'SCS-2V-4';
      this.form.bastionRootDisk = 25;
      this.form.bastionServerGroupID = '';
      this.form.sshKeyName = '';
      this.form.securityGroups = '';
      this.form.securityGroupIDs = '';
      this.form.oidcClientID = '';
      this.form.oidcIssuerURL = '';
      this.form.oidcUsernameClaim = 'preferred_username';
      this.form.oidcGroupsClaim = 'groups';
      this.form.oidcUsernamePrefix = 'oidc:';
      this.form.oidcGroupsPrefix = 'oidc:';
      this.form.etcdBackupEnabled = false;
      this.form.etcdS3Endpoint = '';
      this.form.etcdS3Region = '';
      this.form.etcdS3Bucket = '';
      this.form.etcdS3Folder = '';
      this.form.etcdEC2CredentialId = '';

      // Reset UI state
      this.quotaResult = getDefaultQuotaResult();
      this.lastSuggestedClusterName = '';
      this.errors = [];
    },

    selectValue(input) {
      if (input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'value')) {
        return input.value;
      }

      return input;
    },

    formatRamSize(mb) {
      if (mb >= 1048576) {
        return `${ (mb / 1048576).toFixed(1) } TiB`;
      }

      if (mb >= 1024) {
        return `${ (mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1) } GiB`;
      }

      return `${ mb } MiB`;
    },

    // ══════════════════════════════════════════════════
    //  SSH KEY PAIR
    // ══════════════════════════════════════════════════
    openCreateOpenStackKeyPairDialog() {
      this.keyPairDialogOpen = true;
      this.keyPairDialogName = '';
      this.keyPairDialogPublicKeyUrl = '';
      this.keyPairDialogPublicKey = '';
      this.keyPairDialogError = '';
      this.keyPairDialogLoadingFromUrl = false;
    },

    closeCreateOpenStackKeyPairDialog() {
      this.keyPairDialogOpen = false;
      this.keyPairDialogName = '';
      this.keyPairDialogPublicKeyUrl = '';
      this.keyPairDialogPublicKey = '';
      this.keyPairDialogError = '';
      this.keyPairDialogLoadingFromUrl = false;
    },

    isValidPublicKeyLine(line) {
      return /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\s+\S+/.test(line);
    },

    extractPublicKeyFromText(text) {
      const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      return lines.find((line) => this.isValidPublicKeyLine(line)) || '';
    },

    async loadPublicKeyFromUrl() {
      const rawUrl = (this.keyPairDialogPublicKeyUrl || '').trim();

      if (!rawUrl) {
        this.keyPairDialogError = 'A public key URL is required.';
        return;
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        this.keyPairDialogError = 'The public key URL is invalid.';
        return;
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        this.keyPairDialogError = 'Only http and https URLs are supported.';
        return;
      }

      this.keyPairDialogLoadingFromUrl = true;
      this.keyPairDialogError = '';

      try {
        let text = '';

        try {
          const directResponse = await fetch(parsedUrl.href, {
            mode:        'cors',
            credentials: 'omit',
            headers:     { Accept: 'text/plain, */*' },
          });

          if (!directResponse.ok) {
            throw new Error(`HTTP ${ directResponse.status } ${ directResponse.statusText }`);
          }

          text = await directResponse.text();
        } catch (directError) {
          const proxyResponse = await fetch(`/meta/proxy/${ parsedUrl.href }`, {
            credentials: 'same-origin',
            headers:     { Accept: 'text/plain, */*' },
          });

          if (!proxyResponse.ok) {
            throw new Error(`Direct fetch failed (${ directError?.message || directError }); proxy fetch failed: HTTP ${ proxyResponse.status } ${ proxyResponse.statusText }`);
          }

          text = await proxyResponse.text();
        }
        const publicKey = this.extractPublicKeyFromText(text);

        if (!publicKey) {
          throw new Error('No valid SSH public key was found at that URL.');
        }

        this.keyPairDialogPublicKey = publicKey;
      } catch (e) {
        this.keyPairDialogError = `Failed to load public key: ${ e?.message || e }`;
      } finally {
        this.keyPairDialogLoadingFromUrl = false;
      }
    },

    async createOpenStackKeyPair() {
      if (!this.openstackApi) {
        return;
      }

      const name = (this.keyPairDialogName || '').trim();
      const publicKey = (this.keyPairDialogPublicKey || '').trim();

      if (!name || !publicKey) {
        this.keyPairDialogError = 'Keypair name and public key are required.';
        return;
      }

      try {
        await this.openstackApi.createKeyPair(name, publicKey);
        await this.loadKeyPairs();
        this.form.sshKeyName = name;
        this.closeCreateOpenStackKeyPairDialog();
      } catch (e) {
        this.keyPairDialogError = `Failed to create keypair: ${ e?.message || e }`;
      }
    },

    // ══════════════════════════════════════════════════
    //  QUOTA
    // ══════════════════════════════════════════════════
    debounceQuotaCheck() {
      clearTimeout(this.quotaTimer);
      this.quotaTimer = setTimeout(() => this.checkQuota(), 800);
    },

    async checkQuota() {
      if (!this.openstackApi || !this.form.controlPlaneFlavor) {
        return;
      }

      const workerPools = this.form.workerPools.filter((p) => p.workerFlavor);

      if (!workerPools.length) {
        return;
      }

      this.checkingQuota = true;

      try {
        const cpFlavor = this.flavors.find((f) => f.name === this.form.controlPlaneFlavor);
        const bFlavor  = this.flavors.find((f) => f.name === this.form.bastionFlavor);

        if (!cpFlavor) {
          return;
        }

        // Calculate actual resources per pool and find largest VM for update buffer
        let totalWorkerReplicas = 0;
        let totalWorkerCpus = 0;
        let totalWorkerRamMb = 0;
        let totalWorkerDiskGb = 0;
        let largestWorkerCpus = 0;
        let largestWorkerRamMb = 0;
        let largestWorkerDiskGb = 0;

        for (const pool of workerPools) {
          const flavor = this.flavors.find((f) => f.name === pool.workerFlavor);

          if (!flavor) {
            continue;
          }

          totalWorkerReplicas += pool.replicas || 0;
          totalWorkerCpus += (pool.replicas || 0) * flavor.vcpus;
          totalWorkerRamMb += (pool.replicas || 0) * flavor.ram;
          totalWorkerDiskGb += (pool.replicas || 0) * (pool.workerRootDisk || 0);

          if (flavor.vcpus > largestWorkerCpus) {
            largestWorkerCpus = flavor.vcpus;
          }

          if (flavor.ram > largestWorkerRamMb) {
            largestWorkerRamMb = flavor.ram;
          }

          if ((pool.workerRootDisk || 0) > largestWorkerDiskGb) {
            largestWorkerDiskGb = pool.workerRootDisk || 0;
          }
        }

        // Calculate effective per-node values so the validator's +1 buffer
        // uses the largest VM flavor across all pools
        const effectiveCpus = totalWorkerReplicas > 0
          ? (totalWorkerCpus + largestWorkerCpus) / (totalWorkerReplicas + 1)
          : largestWorkerCpus;
        const effectiveRam = totalWorkerReplicas > 0
          ? (totalWorkerRamMb + largestWorkerRamMb) / (totalWorkerReplicas + 1)
          : largestWorkerRamMb;
        const effectiveDisk = totalWorkerReplicas > 0
          ? (totalWorkerDiskGb + largestWorkerDiskGb) / (totalWorkerReplicas + 1)
          : largestWorkerDiskGb;

        // In edit mode, compute what the existing cluster already uses
        // so the validator can show the net delta instead of the full cluster.
        const existingResources = this.isEdit
          ? this.computeExistingClusterResources()
          : undefined;

        this.quotaResult = await validateQuota(this.openstackApi, {
          controlPlaneReplicas: this.normalizeControlPlaneReplicas(this.form.controlPlaneReplicas),
          workerReplicas:       totalWorkerReplicas,
          bastionEnabled:       this.form.bastionEnabled,
          controlPlaneFlavor:   this.form.controlPlaneFlavor,
          workerFlavor:         workerPools[0].workerFlavor,
          bastionFlavor:        this.form.bastionFlavor,
          controlPlaneCpus:     cpFlavor.vcpus,
          controlPlaneRamMb:    cpFlavor.ram,
          workerCpus:           effectiveCpus,
          workerRamMb:          effectiveRam,
          bastionCpus:          bFlavor?.vcpus,
          bastionRamMb:         bFlavor?.ram,
          controlPlaneRootDiskGb: this.form.controlPlaneRootDisk,
          workerRootDiskGb:       effectiveDisk,
          bastionRootDiskGb:      this.form.bastionEnabled ? this.form.bastionRootDisk : 0,
        }, undefined, existingResources);
      } catch {
        // silent
      } finally {
        this.checkingQuota = false;
      }
    },

    // ══════════════════════════════════════════════════
    //  ETCD BACKUP SECRET
    // ══════════════════════════════════════════════════
    //  EXISTING CLUSTER RESOURCE CALCULATION (edit mode)
    // ══════════════════════════════════════════════════
    computeExistingClusterResources() {
      if (!this.existingCAPICluster) {
        return undefined;
      }

      const topo = this.existingCAPICluster.spec?.topology;

      if (!topo) {
        return undefined;
      }

      const vars = {};

      for (const v of (topo.variables || [])) {
        vars[v.name] = v.value;
      }

      // Control plane
      const cpReplicas = topo.controlPlane?.replicas || 0;
      const cpFlavorName = vars.controlPlaneFlavor || '';
      const cpFlavor = this.flavors.find((f) => f.name === cpFlavorName);
      const cpRootDisk = vars.controlPlaneRootDisk ?? 0;

      // Bastion
      const bastionEnabled = vars.bastionEnabled || false;
      const bastionFlavorName = vars.bastionFlavor || '';
      const bastionFlavor = bastionEnabled ? this.flavors.find((f) => f.name === bastionFlavorName) : null;
      const bastionRootDisk = bastionEnabled ? (vars.bastionRootDisk ?? 0) : 0;
      const bastionCount = bastionEnabled ? 1 : 0;

      // Workers – iterate over machine deployments from the original topology
      let workerInstances = 0;
      let workerCpus = 0;
      let workerRamMb = 0;
      let workerDiskGb = 0;

      const defaultWorkerFlavorName = vars.workerFlavor || '';
      const defaultWorkerRootDisk = vars.workerRootDisk ?? 0;

      const mds = topo.workers?.machineDeployments || [];

      for (const md of mds) {
        const replicas = md.replicas || 0;
        const overrides = {};

        for (const ov of (md.variables?.overrides || [])) {
          overrides[ov.name] = ov.value;
        }

        const flavorName = overrides.workerFlavor || defaultWorkerFlavorName;
        const rootDisk = overrides.workerRootDisk ?? defaultWorkerRootDisk;
        const flavor = this.flavors.find((f) => f.name === flavorName);

        workerInstances += replicas;
        workerCpus += replicas * (flavor?.vcpus || 0);
        workerRamMb += replicas * (flavor?.ram || 0);
        workerDiskGb += replicas * (rootDisk || 0);
      }

      return {
        instances: cpReplicas + workerInstances + bastionCount,
        cpus:      cpReplicas * (cpFlavor?.vcpus || 0) + workerCpus + bastionCount * (bastionFlavor?.vcpus || 0),
        ramMb:     cpReplicas * (cpFlavor?.ram || 0) + workerRamMb + bastionCount * (bastionFlavor?.ram || 0),
        diskGb:    cpReplicas * cpRootDisk + workerDiskGb + bastionCount * bastionRootDisk,
      };
    },

    // ══════════════════════════════════════════════════
    //  ETCD BACKUP SECRET
    // ══════════════════════════════════════════════════
    async ensureEtcdBackupSecret() {
      const payload = this.buildEtcdBackupSecretObject();

      if (!payload) {
        return;
      }

      const secretName = payload?.metadata?.name;

      if (!secretName) {
        return;
      }

      try {
        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     `/api/v1/namespaces/${ this.form.namespace }/secrets`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(payload),
        });
      } catch {
        await this.$store.dispatch('management/request', {
          method:  'PUT',
          url:     `/api/v1/namespaces/${ this.form.namespace }/secrets/${ secretName }`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(payload),
        });
      }
    },

    buildEtcdBackupSecretObject() {
      const cred = this.ec2Credentials.find(
        (c) => (c.id || c.credential_id) === this.form.etcdEC2CredentialId,
      );

      if (!cred) {
        return null;
      }

      const access = cred.parsedBlob?.access || cred.parsedBlob?.access_key || '';
      const secret = cred.parsedBlob?.secret || cred.parsedBlob?.secret_key || '';

      if (!access || !secret) {
        return null;
      }

      const secretName = `etcd-backup-${ this.form.name }-secret`;

      return {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata:   { name: secretName, namespace: this.form.namespace },
        type:       'Opaque',
        data:       {
          aws_access_key_id:     btoa(access),
          aws_secret_access_key: btoa(secret),
        },
      };
    },

    // ══════════════════════════════════════════════════
    //  BUILD CAPI CLUSTER OBJECT
    // ══════════════════════════════════════════════════
    buildClusterObject() {
      const f = this.form;
      const variables = [];
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

      // Global worker flavor from first pool
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
            enabled:    true,
            endpoint:   f.etcdS3Endpoint,
            region:     f.etcdS3Region,
            bucket:     f.etcdS3Bucket,
            folder:     f.etcdS3Folder,
          },
        });
      }

      // Machine deployments
      const machineDeployments = f.workerPools.map((pool) => {
        const md = {
          class:    pool.class || 'default-worker',
          name:     pool.name,
          replicas: pool.replicas,
        };

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
        apiVersion: 'cluster.x-k8s.io/v1beta2',
        kind:       'Cluster',
        metadata:   {
          name:      f.name,
          namespace: f.namespace,
          labels: {
            'managed-secret': 'clouds-yaml',
          },
        },
        spec: {
          clusterNetwork: {
            pods: {
              cidrBlocks: [f.clusterPodsCIDR],
            },
            serviceDomain: f.clusterServiceDomain,
            services: {
              cidrBlocks: [f.clusterServicesCIDR],
            },
          },
          topology: {
            classRef: {
              name:      f.clusterClass,
              namespace: this.resolvedClassNamespace,
            },
            version: f.k8sVersion,
            controlPlane: { replicas: this.normalizeControlPlaneReplicas(f.controlPlaneReplicas) },
            workers: { machineDeployments },
            variables,
          },
        },
      };

      if (this.existingCAPICluster?.metadata?.resourceVersion) {
        cluster.metadata.resourceVersion = this.existingCAPICluster.metadata.resourceVersion;
      }

      return cluster;
    },

    async ensureFleetWorkspace(name) {
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/v1/management.cattle.io.fleetworkspaces/${ name }`,
        });

        return;
      } catch {
        // Does not exist – try to create it
      }

      try {
        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     '/v1/management.cattle.io.fleetworkspaces',
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify({
            type:     'management.cattle.io.fleetworkspace',
            metadata: { name },
          }),
        });
      } catch (e) {
        // Non-admin users may not have permission. Not fatal – cluster still
        // works but its provisioning resources may land in 'default'.
        console.warn(`[ensureFleetWorkspace] Could not create FleetWorkspace "${ name }":`, e?.message || e); // eslint-disable-line no-console
      }
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />

  <CruResource
    v-else
    ref="cruresource"
    :resource="value"
    :mode="mode"
    :can-yaml="false"
    :done-route="doneRoute"
    :errors="errors"
    :validation-passed="canSave"
    @error="e => errors = e"
    @finish="save"
    @cancel="done"
  >
    <div v-if="isFleetManagedExisting" class="fleet-managed-notice mb-10">
      <i class="icon icon-warning" /> {{ fleetManagedTooltip }}
    </div>

    <!-- ═══════════════════════════════════════════════
         OPENSTACK PROJECT + CLUSTER NAME (top row)
         ═══════════════════════════════════════════════ -->
    <div class="row mb-10">
      <div class="col span-4">
        <LabeledSelect
          :value="selectedCredentialKey"
          :label="t('clusterstacks.provisioner.openstackProject')"
          :options="availableCredentialOptions"
          :loading="loadingSecrets"
          :required="true"
          :mode="mode"
          :disabled="isEdit"
          @update:value="onProjectChange"
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value="form.name"
          :required="true"
          :label="t('clusterstacks.clusterCreate.name')"
          :mode="mode"
          :disabled="isEdit"
          data-testid="cru-clusterstacks-name"
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value="form.namespace"
          :label="t('clusterstacks.clusterCreate.namespace')"
          :mode="mode"
          :disabled="!!selectedCredentialKey"
        />
      </div>
    </div>

    <div class="project-gated-section" :class="{ 'is-locked': isProjectSelectionRequired }">
      <div
        v-if="mode !== VIEW"
        class="row mb-10"
      >
        <div class="col span-12">
          <button
            class="btn role-secondary"
            @click="openManifestPreview"
          >
            Debug: Open Raw YAML Manifests
          </button>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════
           MAIN FORM
           ═══════════════════════════════════════════════ -->
      <div
        data-testid="cru-clusterstacks-form"
      >
      <!-- ── NODE POOLS (side tabs, like EKS Node Groups) ── -->
      <div>
        <h3>{{ t('clusterstacks.provisioner.nodePools') }}</h3>
      </div>

      <!-- ── QUOTA WARNING ── -->
      <QuotaWarning
        :result="quotaResult"
        :checking="checkingQuota"
      />

      <Tabbed
        class="mb-20"
        :side-tabs="true"
        :show-tabs-add-remove="mode !== VIEW"
        @addTab="addWorkerPool"
        @removeTab="removeWorkerPool($event)"
      >
        <!-- Control Plane Pool (not removable) -->
        <Tab
          name="control-plane"
          :label="t('clusterstacks.provisioner.controlPlaneTab')"
          :can-remove="false"
        >
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="form.controlPlaneReplicas"
                :label="t('clusterstacks.clusterCreate.controlPlane.replicas')"
                :options="controlPlaneReplicaOptions"
                :required="true"
                :mode="mode"
                @update:value="form.controlPlaneReplicas = normalizeControlPlaneReplicas(selectValue($event))"
              />
              <p class="text-muted text-small mt-5">
                {{ t('clusterstacks.clusterCreate.controlPlane.replicasHaHint') }}
              </p>
            </div>
            <div class="col span-6">
              <LabeledSelect
                :value="form.controlPlaneFlavor"
                :label="t('clusterstacks.clusterCreate.controlPlane.flavor')"
                :placeholder="t('clusterstacks.clusterCreate.controlPlane.flavorPlaceholder')"
                :options="flavorOptions"
                :loading="loadingFlavors"
                :required="true"
                :mode="mode"
                @update:value="form.controlPlaneFlavor = selectValue($event)"
              />
            </div>
          </div>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledInput
                v-model:value.number="form.controlPlaneRootDisk"
                :label="t('clusterstacks.clusterCreate.controlPlane.rootDisk')"
                type="number"
                :min="0"
                :mode="mode"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="form.controlPlaneServerGroupID"
                :label="t('clusterstacks.clusterCreate.controlPlane.serverGroupID')"
                :placeholder="t('clusterstacks.clusterCreate.controlPlane.serverGroupIDPlaceholder')"
                :mode="mode"
              />
            </div>
          </div>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="csvToArray(form.controlPlaneAvailabilityZones)"
                label="Availability Zones"
                :options="availabilityZoneOptions"
                :multiple="true"
                :taggable="true"
                :mode="mode"
                @update:value="form.controlPlaneAvailabilityZones = toMultiValues($event).join(', ')"
              />
            </div>
            <div class="col span-6 mt-20">
              <Checkbox
                v-model:value="form.controlPlaneOmitAvailabilityZone"
                :label="t('clusterstacks.clusterCreate.controlPlane.omitAZ')"
              />
              <p class="text-muted text-small mt-5">
                {{ t('clusterstacks.clusterCreate.controlPlane.omitAZHint') }}
              </p>
            </div>
          </div>
        </Tab>

        <!-- Worker Pool Tabs -->
        <Tab
          v-for="(pool, idx) in form.workerPools"
          :key="pool.name"
          :name="pool.name || `md-${idx}`"
          :label="pool.name || `md-${idx}`"
        >
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledInput
                v-model:value="pool.name"
                :label="t('clusterstacks.clusterCreate.workerPools.poolName')"
                :placeholder="`md-${idx}`"
                :mode="mode"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value.number="pool.replicas"
                :label="t('clusterstacks.clusterCreate.workerPools.replicas')"
                type="number"
                :min="0"
                :required="true"
                :mode="mode"
              />
            </div>
          </div>
          <h4>{{ t('clusterstacks.clusterCreate.workerPools.overrides') }}</h4>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="pool.workerFlavor"
                :label="t('clusterstacks.clusterCreate.worker.flavor')"
                :placeholder="t('clusterstacks.clusterCreate.worker.flavorPlaceholder')"
                :options="flavorOptions"
                :loading="loadingFlavors"
                :mode="mode"
                @update:value="pool.workerFlavor = selectValue($event)"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value.number="pool.workerRootDisk"
                :label="t('clusterstacks.clusterCreate.worker.rootDisk')"
                type="number"
                :min="0"
                :mode="mode"
              />
            </div>
          </div>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledInput
                v-model:value="pool.workerServerGroupID"
                :label="t('clusterstacks.clusterCreate.worker.serverGroupID')"
                :placeholder="t('clusterstacks.clusterCreate.worker.serverGroupIDPlaceholder')"
                :mode="mode"
              />
            </div>
            <div class="col span-6">
              <LabeledSelect
                :value="csvToArray(pool.workerAvailabilityZones || '')"
                label="Availability Zones"
                :options="availabilityZoneOptions"
                :multiple="true"
                :taggable="true"
                :mode="mode"
                @update:value="pool.workerAvailabilityZones = toMultiValues($event).join(', ')"
              />
            </div>
          </div>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="csvToArray(pool.workerSecurityGroups)"
                :label="t('clusterstacks.clusterCreate.worker.securityGroups')"
                :options="securityGroupOptions"
                :multiple="true"
                :taggable="true"
                :mode="mode"
                @update:value="setWorkerPoolSecurityGroups(pool, $event)"
              />
            </div>
          </div>

          <!-- Block Devices -->
          <div class="block-devices mt-10">
            <div class="block-devices-header">
              <h4>{{ t('clusterstacks.clusterCreate.workerPools.blockDevices') }}</h4>
              <button
                v-if="mode !== VIEW"
                class="btn btn-sm role-secondary"
                @click="addBlockDevice(idx)"
              >
                <i class="icon icon-plus" />
              </button>
            </div>
            <div
              v-for="(bd, bdIdx) in pool.additionalBlockDevices"
              :key="bdIdx"
              class="row mb-5"
            >
              <div class="col span-5">
                <LabeledInput
                  v-model:value="bd.name"
                  :label="t('clusterstacks.clusterCreate.workerPools.bdName')"
                  :placeholder="'data-disk'"
                  :mode="mode"
                />
              </div>
              <div class="col span-5">
                <LabeledInput
                  v-model:value.number="bd.sizeGiB"
                  :label="t('clusterstacks.clusterCreate.workerPools.bdSize')"
                  type="number"
                  :min="1"
                  :mode="mode"
                />
              </div>
              <div class="col span-2 mt-20">
                <button
                  v-if="mode !== VIEW"
                  class="btn btn-sm role-link"
                  @click="removeBlockDevice(idx, bdIdx)"
                >
                  <i class="icon icon-trash" />
                </button>
              </div>
            </div>
          </div>
        </Tab>
      </Tabbed>

      <Tabbed class="mb-20" :side-tabs="true">
      <!-- ── BASIC ── -->
        <Tab name="basic" :label="basicTabLabel">
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledSelect
              :value="form.k8sVersion"
              :label="t('clusterstacks.clusterCreate.k8sVersion')"
              :placeholder="t('clusterstacks.clusterCreate.k8sVersionPlaceholder')"
              :options="k8sVersionOptions"
              :required="true"
              :mode="mode"
              @update:value="onK8sVersionInput"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.clusterClass"
              :label="t('clusterstacks.clusterCreate.clusterClass')"
              :mode="mode"
              :disabled="true"
            />
          </div>
        </div>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              :value="resolvedClassNamespace"
              label="ClusterClass Namespace"
              :mode="mode"
              :disabled="true"
            />
          </div>
        </div>

        <h4 class="mt-10">{{ t('clusterstacks.clusterCreate.image.title') }}</h4>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledSelect
              :value="form.imageName"
              :label="t('clusterstacks.clusterCreate.image.imageName')"
              :placeholder="t('clusterstacks.clusterCreate.image.imageNamePlaceholder')"
              :options="imageOptions"
              :loading="loadingImages"
              :taggable="true"
              :required="true"
              :mode="mode"
              @update:value="form.imageName = selectValue($event)"
            />
          </div>
        </div>
        <div class="row mb-10">
          <div class="col span-6">
            <Checkbox
              v-model:value="form.imageIsOrc"
              :label="t('clusterstacks.clusterCreate.image.isOrc')"
            />
            <p class="text-muted text-small mt-5">
              {{ t('clusterstacks.clusterCreate.image.isOrcHint') }}
            </p>
          </div>
          <div
            v-if="!isRke2ClusterStackSelected()"
            class="col span-6"
          >
            <Checkbox
              v-model:value="form.imageAddVersion"
              :label="t('clusterstacks.clusterCreate.image.addVersion')"
            />
            <p class="text-muted text-small mt-5">
              {{ t('clusterstacks.clusterCreate.image.addVersionHint') }}
            </p>
          </div>
        </div>

        <div class="row mb-10">
          <div class="col span-6">
            <LabeledSelect
              :value="form.sshKeyName"
              :label="t('clusterstacks.clusterCreate.security.sshKeyName')"
              :options="keyPairOptions"
              :loading="loadingKeyPairs"
              :taggable="true"
              :required="true"
              :mode="mode"
              @update:value="form.sshKeyName = selectValue($event)"
            />
          </div>
          <div class="col span-3 mt-20">
            <button
              v-if="mode !== VIEW"
              class="btn role-secondary"
              @click="openCreateOpenStackKeyPairDialog"
            >
              <i class="icon icon-plus" /> {{ t('clusterstacks.provisioner.createKeyPair') }}
            </button>
          </div>
        </div>

        <h4 class="mt-10">{{ t('clusterstacks.clusterCreate.bastion.title') }}</h4>
        <div class="row mb-10">
          <div class="col span-12">
            <Checkbox
              v-model:value="form.bastionEnabled"
              :label="t('clusterstacks.clusterCreate.bastion.enabled')"
            />
          </div>
        </div>
        <template v-if="form.bastionEnabled">
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="form.bastionFlavor"
                :label="t('clusterstacks.clusterCreate.bastion.flavor')"
                :placeholder="t('clusterstacks.clusterCreate.bastion.flavorPlaceholder')"
                :options="flavorOptions"
                :loading="loadingFlavors"
                :mode="mode"
                @update:value="form.bastionFlavor = selectValue($event)"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value.number="form.bastionRootDisk"
                :label="t('clusterstacks.clusterCreate.bastion.rootDisk')"
                type="number"
                :min="0"
                :mode="mode"
              />
            </div>
          </div>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledInput
                v-model:value="form.bastionServerGroupID"
                :label="t('clusterstacks.clusterCreate.bastion.serverGroupID')"
                :placeholder="t('clusterstacks.clusterCreate.bastion.serverGroupIDPlaceholder')"
                :mode="mode"
              />
            </div>
          </div>
        </template>
        </Tab>

        <Tab name="network" :label="networkTabLabel">
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledSelect
              :value="form.networkExternalID"
              :label="t('clusterstacks.clusterCreate.network.externalNetwork')"
              :placeholder="t('clusterstacks.clusterCreate.network.externalNetworkPlaceholder')"
              :options="externalNetworkOptions"
              :loading="loadingNetworks"
              :required="true"
              :mode="mode"
              @update:value="form.networkExternalID = selectValue($event)"
            />
          </div>
          <div class="col span-3">
            <LabeledInput
              v-model:value.number="form.networkMTU"
              :label="t('clusterstacks.clusterCreate.network.mtu')"
              type="number"
              :placeholder="'1500'"
              :mode="mode"
            />
          </div>
          <div class="col span-3">
            <LabeledInput
              v-model:value="form.nodeCIDR"
              :label="t('clusterstacks.clusterCreate.network.nodeCIDR')"
              :placeholder="'10.8.0.0/20'"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.dnsNameservers"
              :label="t('clusterstacks.clusterCreate.network.dnsNameservers')"
              :placeholder="'9.9.9.9, 149.112.112.112'"
              :mode="mode"
            />
            <p class="text-muted text-small mt-5">
              {{ t('clusterstacks.clusterCreate.network.dnsHint') }}
            </p>
          </div>
          <div class="col span-3">
            <LabeledSelect
              :value="form.clusterCNI"
              :label="t('clusterstacks.clusterCreate.network.cniLabel')"
              :options="cniOptions"
              :mode="mode"
              @update:value="form.clusterCNI = selectValue($event)"
            />
          </div>
          <div class="col span-3 mt-20">
            <Checkbox
              v-model:value="form.disableAPIServerFloatingIP"
              :label="t('clusterstacks.clusterCreate.network.disableFloatingIP')"
            />
          </div>
        </div>

        <h4 class="mt-10">Cluster Network</h4>
        <div class="row mb-10">
          <div class="col span-4">
            <LabeledInput
              v-model:value="form.clusterPodsCIDR"
              label="Pods CIDR"
              :placeholder="'172.16.0.0/16'"
              :mode="mode"
            />
          </div>
          <div class="col span-4">
            <LabeledInput
              v-model:value="form.clusterServiceDomain"
              label="Service Domain"
              :placeholder="'cluster.local'"
              :mode="mode"
            />
          </div>
          <div class="col span-4">
            <LabeledInput
              v-model:value="form.clusterServicesCIDR"
              label="Services CIDR"
              :placeholder="'10.96.0.0/12'"
              :mode="mode"
            />
          </div>
        </div>

        <h4 class="mt-10">{{ t('clusterstacks.clusterCreate.apiServer.title') }}</h4>
        <div class="row mb-10">
          <div class="col span-4">
            <LabeledSelect
              :value="form.apiServerLoadBalancer"
              :label="t('clusterstacks.clusterCreate.apiServer.loadBalancer')"
              :options="lbOptions"
              :mode="mode"
              @update:value="form.apiServerLoadBalancer = selectValue($event)"
            />
          </div>
          <div class="col span-4">
            <LabeledInput
              v-model:value="form.certSANs"
              :label="t('clusterstacks.clusterCreate.apiServer.certSANs')"
              :placeholder="'mydomain.example'"
              :mode="mode"
            />
          </div>
          <div
            v-if="form.apiServerLoadBalancer === 'octavia-amphora'"
            class="col span-4"
          >
            <LabeledInput
              v-model:value="form.apiServerLBAllowedCIDRs"
              :label="t('clusterstacks.clusterCreate.apiServer.allowedCIDRs')"
              :placeholder="'192.168.10.0/24'"
              :mode="mode"
            />
          </div>
        </div>
        <p class="text-muted text-small">
          {{ t('clusterstacks.provisioner.certSANsHint') }}
        </p>
        </Tab>

      <!-- ── SECURITY ── -->
        <Tab name="security" :label="securityTabLabel">
        <h4>{{ t('clusterstacks.clusterCreate.security.sgTitle') }}</h4>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledSelect
              :value="csvToArray(form.securityGroups)"
              :label="t('clusterstacks.clusterCreate.security.securityGroups')"
              :options="securityGroupOptions"
              :multiple="true"
              :taggable="true"
              :mode="mode"
              @update:value="setGlobalSecurityGroups($event)"
            />
          </div>
        </div>

        <!-- Rule preview for selected groups -->
        <div
          v-if="selectedSecurityGroupsData.length"
          class="sg-rules-preview mb-10"
        >
          <h5>{{ t('clusterstacks.provisioner.selectedRules') }}</h5>
          <div
            v-for="sg in selectedSecurityGroupsData"
            :key="sg.id"
            class="sg-rule-block"
          >
            <strong>{{ sg.name }}</strong>
            <div
              v-for="(rule, ridx) in (sg.security_group_rules || [])"
              :key="ridx"
              class="sg-rule-line"
            >
              {{ rule.direction || 'ingress' }} | {{ rule.protocol || 'any' }} | {{ rule.port_range_min || '*' }}-{{ rule.port_range_max || '*' }} | {{ rule.remote_ip_prefix || rule.remote_group_id || 'any' }}
            </div>
          </div>
        </div>

        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.securityGroupIDs"
              :label="t('clusterstacks.clusterCreate.security.securityGroupIDs')"
              :placeholder="'uuid1, uuid2'"
              :mode="mode"
            />
          </div>
        </div>
        <p class="text-muted text-small">
          {{ t('clusterstacks.clusterCreate.security.sgHint') }}
        </p>
        </Tab>

      <!-- ── ETCD BACKUP ── -->
        <Tab name="etcd-backup" :label="etcdTabLabel">
        <p class="text-muted text-small mb-10">
          {{ t('clusterstacks.clusterCreate.etcdBackup.description') }}
        </p>
        <div class="row mb-10">
          <div class="col span-12">
            <Checkbox
              v-model:value="form.etcdBackupEnabled"
              :label="t('clusterstacks.clusterCreate.etcdBackup.enabled')"
            />
          </div>
        </div>

        <template v-if="form.etcdBackupEnabled">
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="form.etcdEC2CredentialId"
                :label="'EC2 Credential'"
                :options="ec2CredentialOptions"
                :loading="loadingEC2Credentials"
                :mode="mode"
                @update:value="form.etcdEC2CredentialId = selectValue($event)"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="form.etcdS3Endpoint"
                :label="t('clusterstacks.clusterCreate.etcdBackup.endpoint')"
                :placeholder="'rgw.example.com:6780'"
                :disabled="!selectedCredentialKey || !!autoSwiftEndpoint"
                :mode="mode"
              />
            </div>
          </div>

          <div class="row mb-10">
            <div class="col span-6">
              <LabeledInput
                v-model:value="form.etcdS3Region"
                :label="t('clusterstacks.clusterCreate.etcdBackup.region')"
                :placeholder="'us-west'"
                :mode="mode"
              />
            </div>
          </div>

          <h4>{{ t('clusterstacks.clusterCreate.etcdBackup.containerTitle') }}</h4>
          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="form.etcdS3Bucket"
                :label="t('clusterstacks.clusterCreate.etcdBackup.bucket')"
                :placeholder="t('clusterstacks.clusterCreate.etcdBackup.bucketPlaceholder')"
                :options="containerOptions"
                :loading="loadingContainers"
                :taggable="true"
                :mode="mode"
                @update:value="onEtcdBucketSelect"
              />
            </div>
            <div class="col span-3 mt-20">
              <button
                v-if="form.etcdS3Bucket && !containerExists(form.etcdS3Bucket) && mode !== VIEW"
                class="btn btn-sm role-primary"
                @click="createSwiftContainer"
              >
                <i class="icon icon-plus" />
                {{ t('clusterstacks.clusterCreate.etcdBackup.createContainer') }}
              </button>
              <div
                v-if="containerCreated"
                class="banner banner-success mt-5"
              >
                <i class="icon icon-checkmark" />
                {{ t('clusterstacks.clusterCreate.etcdBackup.containerCreated') }}
              </div>
            </div>
          </div>

          <div class="row mb-10">
            <div class="col span-6">
              <LabeledSelect
                :value="form.etcdS3Folder"
                :label="'Folder/Prefix'"
                :placeholder="'etcd-backups'"
                :options="folderOptions"
                :loading="loadingFolders"
                :taggable="true"
                :disabled="!form.etcdS3Bucket"
                :mode="mode"
                @update:value="onEtcdFolderSelect"
              />
            </div>
          </div>
        </template>
        </Tab>

      <!-- ── OIDC ── -->
        <Tab name="oidc" :label="oidcTabLabel">
        <p class="text-muted text-small mb-10">
          {{ t('clusterstacks.clusterCreate.oidc.description') }}
        </p>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcClientID"
              :label="t('clusterstacks.clusterCreate.oidc.clientID')"
              :placeholder="'kubectl'"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcIssuerURL"
              :label="t('clusterstacks.clusterCreate.oidc.issuerURL')"
              :placeholder="'https://dex.k8s.example.com'"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcUsernameClaim"
              :label="t('clusterstacks.clusterCreate.oidc.usernameClaim')"
              :placeholder="'preferred_username'"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcGroupsClaim"
              :label="t('clusterstacks.clusterCreate.oidc.groupsClaim')"
              :placeholder="'groups'"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mb-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcUsernamePrefix"
              :label="t('clusterstacks.clusterCreate.oidc.usernamePrefix')"
              :placeholder="'oidc:'"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="form.oidcGroupsPrefix"
              :label="t('clusterstacks.clusterCreate.oidc.groupsPrefix')"
              :placeholder="'oidc:'"
              :mode="mode"
            />
          </div>
        </div>
        </Tab>
      </Tabbed>
      </div>

      <div v-if="isProjectSelectionRequired" class="project-gated-overlay">
        <div class="banner banner-warning">
          Select an OpenStack Project first.
        </div>
      </div>
    </div>

    <div
      v-if="createDialogOpen"
      class="modal-overlay"
      @click.self="closeCreateDialog"
    >
      <div class="modal-container">
        <div class="modal-header">
          <h3>
            {{ createDialogType === 'bucket' ? t('clusterstacks.dialogs.createBucket') : t('clusterstacks.dialogs.editFolder') }}
          </h3>
          <button class="btn btn-sm role-link modal-close-btn" @click="closeCreateDialog">
            <i class="icon icon-close" />
          </button>
        </div>
        <div class="modal-body">
          <div v-if="createDialogType === 'folder'" class="folder-browser mb-10">
            <div class="folder-browser-toolbar">
              <button
                class="btn btn-sm role-secondary"
                :disabled="!canGoDialogFolderUp"
                @click="goDialogFolderUp"
              >
                {{ t('clusterstacks.dialogs.up') }}
              </button>
              <span class="folder-browser-path">
                {{ createDialogParentPath ? `/${ createDialogParentPath }` : '/' }}
              </span>
              <span class="folder-browser-count">
                {{ t('clusterstacks.dialogs.files') }}: {{ dialogCurrentFolderCount }}
              </span>
            </div>

            <div class="folder-browser-list">
              <div
                v-for="child in dialogFolderChildren"
                :key="child"
                class="folder-browser-row"
              >
                <button
                  class="btn btn-sm role-link folder-browser-item"
                  @click="enterDialogFolder(child)"
                >
                  <i class="icon icon-folder" />
                  {{ child.split('/').pop() }}
                  <span class="text-muted text-small ml-5">({{ swiftFolderCounts[child] || 0 }})</span>
                </button>
                <button
                  class="btn btn-sm role-link folder-delete-btn"
                  :disabled="deletingFolderPath === child"
                  @click="requestDeleteDialogFolder(child)"
                >
                  <i class="icon icon-trash" />
                </button>
              </div>
              <div v-if="!dialogFolderChildren.length" class="text-muted text-small">
                {{ t('clusterstacks.dialogs.noSubfolders') }}
              </div>
            </div>
          </div>

          <LabeledInput
            v-model:value="createDialogValue"
            :label="createDialogType === 'bucket' ? t('clusterstacks.dialogs.bucketName') : t('clusterstacks.dialogs.subfolderName')"
            :placeholder="createDialogType === 'bucket' ? t('clusterstacks.dialogs.bucketNamePlaceholder') : t('clusterstacks.dialogs.subfolderPlaceholder')"
            :mode="mode"
          />
          <div v-if="createDialogError" class="banner banner-error mt-10">
            {{ createDialogError }}
          </div>
          <div
            v-if="confirmDeleteFolderPath"
            class="banner banner-warning mt-10"
          >
            <div class="mb-5">
              {{ t('clusterstacks.dialogs.confirmDeleteFolder', { name: confirmDeleteFolderPath }) }}
            </div>
            <div class="modal-actions modal-actions-inline">
              <button class="btn role-secondary" @click="cancelDeleteDialogFolder">
                {{ t('clusterstacks.common.cancel') }}
              </button>
              <button class="btn role-primary" @click="confirmDeleteDialogFolder">
                {{ t('clusterstacks.dialogs.confirmDelete') }}
              </button>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn role-secondary" @click="closeCreateDialog">
              {{ t('clusterstacks.common.cancel') }}
            </button>
            <button class="btn role-primary" @click="submitCreateDialog">
              {{ createDialogType === 'bucket' ? t('clusterstacks.common.create') : t('clusterstacks.dialogs.createSubfolder') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="keyPairDialogOpen"
      class="modal-overlay"
      @click.self="closeCreateOpenStackKeyPairDialog"
    >
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ t('clusterstacks.keypairDialog.title') }}</h3>
          <button class="btn btn-sm role-link modal-close-btn" @click="closeCreateOpenStackKeyPairDialog">
            <i class="icon icon-close" />
          </button>
        </div>
        <div class="modal-body">
          <LabeledInput
            v-model:value="keyPairDialogName"
            :label="t('clusterstacks.keypairDialog.name')"
            :mode="mode"
          />
          <div class="keypair-source-row">
            <div class="keypair-source-input">
              <LabeledInput
                v-model:value="keyPairDialogPublicKeyUrl"
                :label="t('clusterstacks.keypairDialog.publicKeyUrl')"
                :placeholder="t('clusterstacks.keypairDialog.publicKeyUrlPlaceholder')"
                :mode="mode"
              />
            </div>
            <div class="keypair-source-action">
              <button
                class="btn role-secondary"
                :disabled="keyPairDialogLoadingFromUrl"
                @click="loadPublicKeyFromUrl"
              >
                {{ keyPairDialogLoadingFromUrl ? t('clusterstacks.keypairDialog.loadingFromUrl') : t('clusterstacks.keypairDialog.loadFromUrl') }}
              </button>
            </div>
          </div>
          <p class="text-muted text-small mt-5 mb-10">
            {{ t('clusterstacks.keypairDialog.publicKeyUrlHint') }}
          </p>
          <LabeledInput
            v-model:value="keyPairDialogPublicKey"
            :label="t('clusterstacks.keypairDialog.publicKey')"
            :placeholder="t('clusterstacks.keypairDialog.publicKeyPlaceholder')"
            :mode="mode"
          />
          <div v-if="keyPairDialogError" class="banner banner-error mt-10">
            {{ keyPairDialogError }}
          </div>
          <div class="modal-actions">
            <button class="btn role-secondary" @click="closeCreateOpenStackKeyPairDialog">
              {{ t('clusterstacks.common.cancel') }}
            </button>
            <button class="btn role-primary" @click="createOpenStackKeyPair">
              {{ t('clusterstacks.keypairDialog.createBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Credential Change Confirmation Dialog (Rancher-native style) -->
    <div
      v-if="credentialChangePending"
      class="modal-overlay"
      @click.self="cancelCredentialChange"
    >
      <div class="modal-container credential-change-dialog">
        <div class="modal-header">
          <h3>
            <i class="icon icon-info mr-10" />
            {{ t('clusterstacks.credentialChange.title') }}
          </h3>
          <button class="btn btn-sm role-link modal-close-btn" @click="cancelCredentialChange">
            <i class="icon icon-close" />
          </button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info mb-20">
            <p class="mb-0">{{ t('clusterstacks.credentialChange.message') }}</p>
          </div>

          <div class="credential-change-details mb-20">
            <div class="detail-row">
              <span class="detail-label">{{ t('clusterstacks.credentialChange.from') }}:</span>
              <span class="detail-value">{{ selectedCredentialKey }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">{{ t('clusterstacks.credentialChange.to') }}:</span>
              <span class="detail-value">{{ credentialChangeTo }}</span>
            </div>
          </div>

          <div class="alert alert-warning">
            <i class="icon icon-warning mr-10" />
            {{ t('clusterstacks.credentialChange.warning') }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn role-secondary" @click="cancelCredentialChange">
            {{ t('generic.cancel') }}
          </button>
          <button class="btn role-primary" @click="confirmCredentialChange">
            {{ t('clusterstacks.credentialChange.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </CruResource>
</template>

<style lang="scss" scoped>
.sg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 10px;
}

.sg-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.sg-rules-preview {
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 10px;
}

.sg-rule-block {
  margin-bottom: 8px;
}

.sg-rule-line {
  font-family: monospace;
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.block-devices-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;

  h4 {
    margin: 0;
  }
}

.banner {
  padding: 10px 15px;
  border-radius: var(--border-radius);
  margin-bottom: 10px;
}

.banner-info {
  background: var(--info-banner-bg, rgba(0, 120, 212, 0.1));
  border: 1px solid var(--info, #0078d4);
  color: var(--info-text, inherit);
}

.banner-success {
  background: var(--success-banner-bg, rgba(0, 128, 0, 0.1));
  border: 1px solid var(--success, #28a745);
  color: var(--success-text, inherit);
}

.banner-warning {
  background: var(--warning-banner-bg, rgba(244, 175, 61, 0.14));
  border: 1px solid var(--warning, #f4af3d);
  color: var(--text, inherit);
}

.project-gated-section {
  position: relative;
}

.project-gated-section.is-locked {
  opacity: 0.5;
}

.project-gated-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.25);
  pointer-events: all;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-container {
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 560px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.1em;
  }
}

.modal-close-btn {
  padding: 4px;
  min-height: unset;
}

.modal-body {
  padding: 20px;
}

.keypair-source-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.keypair-source-input {
  flex: 1;
}

.keypair-source-action {
  flex: 0 0 auto;
  padding-bottom: 1px;
}

@media (max-width: 700px) {
  .keypair-source-row {
    flex-direction: column;
    align-items: stretch;
  }

  .keypair-source-action {
    width: 100%;
    padding-bottom: 0;

    .btn {
      width: 100%;
    }
  }
}

.folder-browser {
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--box-bg);
  padding: 8px;
}

.folder-browser-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 2px 8px 2px;
  border-bottom: 1px solid var(--border);
}

.folder-browser-path {
  font-family: monospace;
  font-size: 12px;
  color: var(--muted);
}

.folder-browser-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.folder-browser-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  overflow: auto;
  padding-top: 6px;
}

.folder-browser-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.folder-browser-item {
  justify-content: flex-start;
  text-align: left;
  padding-left: 4px;
  flex: 1;
}

.folder-delete-btn {
  color: var(--error, #d4333f);
}

.modal-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-actions-inline {
  margin-top: 8px;
}

.text-small {
  font-size: 12px;
}

.fleet-managed-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 10px;
  background: #f59e0b;
  color: #1c1100;
  font-size: 12px;
  font-weight: 700;
}

// Credential Change Dialog
.credential-change-dialog {
  max-width: 500px;
}

.credential-change-details {
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  padding: 12px 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;

  &:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .detail-label {
    font-weight: 700;
    color: var(--text);
  }

  .detail-value {
    color: var(--muted);
    font-family: monospace;
  }
}

.alert {
  border-radius: var(--border-radius);
  padding: 12px 15px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;

  &.alert-info {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #0c4a6e;

    p {
      margin: 0;
      line-height: 1.5;
    }
  }

  &.alert-warning {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #92400e;
  }

  i {
    flex-shrink: 0;
    margin-top: 2px;
  }
}
</style>
