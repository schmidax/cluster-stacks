<template>
  <div class="capi-provider-form">
    <div class="form-section">
      <!-- Provider Type first -->
      <div class="form-row">
        <label class="form-label" for="capi-type">
          {{ t('clusterstacks.capiProviders.form.type') }}
          <span class="required">*</span>
        </label>
        <div v-if="isEdit" class="form-input form-input-disabled">
          {{ form.type }}
        </div>
        <select
          v-else
          id="capi-type"
          v-model="form.type"
          class="form-select"
          @change="onTypeChange"
        >
          <option value="" disabled>
            {{ t('clusterstacks.capiProviders.form.typePlaceholder') }}
          </option>
          <option
            v-for="opt in providerTypes"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Provider Name (searchable dropdown based on type) -->
      <div class="form-row">
        <label class="form-label" for="capi-name">
          {{ t('clusterstacks.capiProviders.form.name') }}
          <span class="required">*</span>
        </label>
        <div v-if="isEdit" class="form-input form-input-disabled">
          {{ form.name }}
          <p class="form-hint">{{ t('clusterstacks.capiProviders.form.nameEditHint') }}</p>
        </div>
        <div v-else class="searchable-select-wrapper">
          <input
            id="capi-name"
            v-model="nameSearch"
            type="text"
            class="form-input"
            :disabled="!form.type"
            :placeholder="form.type ? t('clusterstacks.capiProviders.form.namePlaceholder') : t('clusterstacks.capiProviders.form.nameSelectTypFirst')"
            autocomplete="off"
            @focus="showNameDropdown = true"
            @blur="onNameBlur"
            @input="onNameInput"
          />
          <div v-if="showNameDropdown && filteredProviderNames.length" class="dropdown-list">
            <div
              v-for="pname in filteredProviderNames"
              :key="pname"
              class="dropdown-item"
              @mousedown.prevent="selectName(pname)"
            >
              {{ pname }}
            </div>
          </div>
          <!-- Duplicate warning -->
          <p v-if="nameExists" class="form-error-inline">
            {{ t('clusterstacks.capiProviders.form.nameAlreadyExists') }}
          </p>
          <!-- Providers loading state -->
          <p v-if="loadingProviders" class="form-hint">
            {{ t('clusterstacks.capiProviders.form.loadingProviders') }}
          </p>
        </div>
      </div>

      <!-- Resource Name (auto-computed, shown when creating) -->
      <div v-if="!isEdit && resourceName" class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.capiProviders.form.resourceName') }}
        </label>
        <div class="form-input form-input-disabled">
          {{ resourceName }}
          <p class="form-hint">{{ t('clusterstacks.capiProviders.form.resourceNameHint') }}</p>
        </div>
      </div>

      <!-- Version -->
      <div class="form-row">
        <label class="form-label" for="capi-version">
          {{ t('clusterstacks.capiProviders.form.version') }}
        </label>
        <div v-if="providerVersions.length || providerVersionsLoading" class="version-select-row">
          <select
            id="capi-version"
            v-model="form.version"
            class="form-select"
            :disabled="providerVersionsLoading"
            @change="onProviderVersionChange"
          >
            <option value="">
              {{ t('clusterstacks.capiProviders.form.versionLatest') }}
            </option>
            <option
              v-for="ver in providerVersions"
              :key="ver"
              :value="ver"
            >
              {{ ver }}
            </option>
          </select>
          <button
            class="btn btn-sm role-secondary ml-5"
            :disabled="providerVersionsLoading"
            type="button"
            @click="fetchProviderVersions"
          >
            <i :class="providerVersionsLoading ? 'icon icon-spinner icon-spin' : 'icon icon-refresh'" />
          </button>
        </div>
        <input
          v-else
          id="capi-version"
          v-model="form.version"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.capiProviders.form.versionPlaceholder')"
        />
        <p v-if="providerVersionsError" class="text-error mt-5">
          {{ providerVersionsError }}
        </p>
      </div>

      <!-- Fetch Config URL (auto-populated from upstream provider list) -->
      <div class="form-row">
        <label class="form-label" for="capi-fetch-url">
          {{ t('clusterstacks.capiProviders.form.fetchConfigUrl') }}
          <span class="form-optional">{{ t('clusterstacks.capiProviders.form.optional') }}</span>
        </label>
        <input
          id="capi-fetch-url"
          v-model="form.fetchConfigUrl"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.capiProviders.form.fetchConfigUrlPlaceholder')"
        />
        <p class="form-hint">
          {{ t('clusterstacks.capiProviders.form.fetchConfigUrlHint') }}
        </p>
      </div>

      <!-- Features -->
      <div class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.capiProviders.form.features') }}
        </label>
        <div class="features-group">
          <label class="checkbox-label">
            <input v-model="form.features.clusterResourceSet" type="checkbox" />
            clusterResourceSet
          </label>
          <label class="checkbox-label">
            <input v-model="form.features.clusterTopology" type="checkbox" />
            clusterTopology
          </label>
          <label class="checkbox-label">
            <input v-model="form.features.machinePool" type="checkbox" />
            machinePool
          </label>
        </div>
      </div>

      <!-- Variables -->
      <div class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.capiProviders.form.variables') }}
          <span class="form-optional">{{ t('clusterstacks.capiProviders.form.optional') }}</span>
        </label>
        <div class="features-group">
          <label class="checkbox-label">
            <input v-model="form.runtimeSDK" type="checkbox" />
            RuntimeSDK
          </label>
          <span class="form-hint">{{ t('clusterstacks.capiProviders.form.runtimeSDKHint') }}</span>
        </div>
        <div v-if="!form.runtimeSDK" class="banner banner-warning mt-5">
          <i class="icon icon-warning" />
          {{ t('clusterstacks.capiProviders.form.runtimeSDKWarning') }}
        </div>
        <div class="variables-list">
          <div
            v-for="(variable, idx) in form.variables"
            :key="idx"
            class="variable-row"
          >
            <input
              v-model="variable.name"
              type="text"
              class="form-input variable-input"
              :placeholder="t('clusterstacks.capiProviders.form.variableNamePlaceholder')"
            />
            <span class="variable-sep">=</span>
            <input
              v-model="variable.value"
              type="text"
              class="form-input variable-input"
              :placeholder="t('clusterstacks.capiProviders.form.variableValuePlaceholder')"
            />
            <button class="btn btn-sm role-secondary btn-remove-var" @click="removeVariable(idx)">
              &times;
            </button>
          </div>
        </div>
        <button class="btn role-secondary btn-add-var" @click="addVariable">
          + {{ t('clusterstacks.capiProviders.form.addVariable') }}
        </button>
      </div>

      <!-- OpenStack Resource Controller (only for Infrastructure + openstack) -->
      <div v-if="showOrcSection" class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.capiProviders.form.orcTitle') }}
        </label>
        <p class="form-hint">{{ t('clusterstacks.capiProviders.form.orcHint') }}</p>

        <!-- Install method toggle -->
        <div class="provider-toggle mt-5">
          <button
            class="btn btn-sm"
            :class="orcMethod === 'manifest' ? 'role-primary' : 'role-secondary'"
            @click="orcMethod = 'manifest'"
          >
            Manifest
          </button>
          <button
            class="btn btn-sm"
            :class="orcMethod === 'helm' ? 'role-primary' : 'role-secondary'"
            disabled
            :title="t('clusterstacks.capiProviders.form.orcHelmNotAvailable')"
          >
            Helm
            <span class="form-optional">({{ t('clusterstacks.capiProviders.form.orcHelmFuture') }})</span>
          </button>
        </div>

          <!-- Manifest URL -->
        <div v-if="orcMethod === 'manifest'" class="mt-5">
          <input
            v-model="orcManifestUrl"
            type="text"
            class="form-input"
            placeholder="https://github.com/k-orc/openstack-resource-controller/releases/latest/download/install.yaml"
          />
        </div>

        <!-- Helm (future) -->
        <div v-if="orcMethod === 'helm'" class="mt-5">
          <input
            v-model="orcHelmRepo"
            type="text"
            class="form-input"
            disabled
            :placeholder="t('clusterstacks.capiProviders.form.orcHelmPlaceholder')"
          />
        </div>
      </div>

      <!-- ORC install progress -->
      <div v-if="orcProgress" class="banner banner-info mt-5">
        <i class="icon icon-spinner icon-spin" /> {{ orcProgress }}
      </div>
      <div v-if="orcError" class="banner banner-error mt-5">
        {{ orcError }}
      </div>
    </div>

    <div v-if="error" class="form-error">
      {{ error }}
    </div>

    <div class="form-actions">
      <button class="btn role-secondary" :disabled="saving" @click="$emit('cancel')">
        {{ t('clusterstacks.common.cancel') }}
      </button>
      <button class="btn role-primary" :disabled="!isValid || saving || nameExists" @click="save">
        <span v-if="saving">{{ t('clusterstacks.common.loading') }}</span>
        <span v-else>{{ isEdit ? t('clusterstacks.capiProviders.form.saveEdit') : t('clusterstacks.capiProviders.form.save') }}</span>
      </button>
    </div>
  </div>
</template>

<script>
const PROVIDERS_GO_URL = 'https://raw.githubusercontent.com/kubernetes-sigs/cluster-api/refs/heads/main/cmd/clusterctl/client/config/providers_client.go';

// Fallback static list in case the URL is unreachable
const FALLBACK_PROVIDERS = {
  core:           ['cluster-api'],
  infrastructure: ['aws', 'azure', 'byoh', 'cloudstack', 'digitalocean', 'docker', 'gcp', 'harvester-harvester', 'hetzner', 'hivelocity-hivelocity', 'huawei', 'ibmcloud', 'ionoscloud-ionoscloud', 'k0sproject-k0smotron', 'kubevirt', 'kubekey', 'linode-linode', 'maas', 'metal-stack', 'metal3', 'nested', 'nutanix', 'oci', 'opennebula', 'openstack', 'outscale', 'proxmox', 'scaleway', 'sidero', 'tinkerbell-tinkerbell', 'vcd', 'vcluster', 'virtink', 'vsphere', 'vultr-vultr'],
  bootstrap:      ['canonical-kubernetes', 'k0sproject-k0smotron', 'kubeadm', 'kubekey-k3s', 'microk8s', 'rke2', 'talos'],
  controlPlane:   ['canonical-kubernetes', 'hosted-control-plane', 'k0sproject-k0smotron', 'kamaji', 'kubeadm', 'kubekey-k3s', 'microk8s', 'nested', 'rke2', 'talos'],
  addon:          ['eitco-cdk8s', 'helm', 'rancher-fleet'],
};

function parseProvidersFromGo(content) {
  // Use \n) as the block terminator because Go const block closing parens
  // are always on their own line at column 0. Using just \) would stop
  // prematurely at any ) inside inline comments (e.g. "(also owned by Rancher)").
  const sectionMap = {
    core:           /\/\/ core providers\.[\s\S]*?const \(([\s\S]*?\n)\)/i,
    infrastructure: /\/\/ Infra providers\.[\s\S]*?const \(([\s\S]*?\n)\)/i,
    bootstrap:      /\/\/ Bootstrap providers\.[\s\S]*?const \(([\s\S]*?\n)\)/i,
    controlPlane:   /\/\/ ControlPlane providers\.[\s\S]*?const \(([\s\S]*?\n)\)/i,
    addon:          /\/\/ Add-on providers\.[\s\S]*?const \(([\s\S]*?\n)\)/i,
  };

  const result = {};

  for (const [type, regex] of Object.entries(sectionMap)) {
    const match = content.match(regex);

    if (match) {
      const names = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

      result[type] = [...new Set(names)].sort();
    } else {
      result[type] = [];
    }
  }

  // Build a map of Go const-name → string-value so we can resolve the `name:`
  // field in provider struct literals (e.g. AWSProviderName → "aws").
  const constMap = {};
  const constRegex = /(\w+)\s*=\s*"([^"]+)"/g;
  let cm;

  while ((cm = constRegex.exec(content)) !== null) {
    constMap[cm[1]] = cm[2];
  }

  // Parse &provider{name: ..., url: "...", providerType: ...} struct literals
  // to build a map keyed by "Type/name" → fetchConfig URL.
  // This avoids collisions when the same provider name appears in multiple types
  // (e.g. "rke2" in both Bootstrap and ControlPlane with different URLs).
  const urlMap = {};

  // Map Go providerType constants to our type labels
  const typeConstMap = {
    CoreProviderType:                'core',
    InfrastructureProviderType:      'infrastructure',
    BootstrapProviderType:           'bootstrap',
    ControlPlaneProviderType:        'controlPlane',
    AddonProviderType:               'addon',
    IPAMProviderType:                'ipam',
    RuntimeExtensionProviderType:    'runtimeExtension',
  };

  const blockRegex = /&provider\{([\s\S]*?)\}/g;
  let bm;

  while ((bm = blockRegex.exec(content)) !== null) {
    const inner       = bm[1];
    const nameMatch   = inner.match(/\bname:\s*(\w+)/);
    const urlMatch    = inner.match(/\burl:\s*"([^"]+)"/);
    const ptMatch     = inner.match(/\bproviderType:\s*\w+\.(\w+)/);

    if (nameMatch && urlMatch) {
      const providerName = constMap[nameMatch[1]] || nameMatch[1];
      const providerType = ptMatch ? (typeConstMap[ptMatch[1]] || '') : '';

      if (providerType) {
        // Type-qualified key: "Bootstrap/rke2"
        urlMap[`${ providerType }/${ providerName }`] = urlMatch[1];
      }

      // Always store under plain name as fallback (last writer wins)
      if (!urlMap[providerName]) {
        urlMap[providerName] = urlMatch[1];
      }
    }
  }

  result.urlMap = urlMap;

  return result;
}

export default {
  name: 'CapiProviderForm',

  props: {
    existing: {
      type:    Object,
      default: null,
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      saving:           false,
      error:            '',
      nameSearch:       '',
      showNameDropdown: false,
      nameExists:       false,
      loadingProviders: false,
      allProvidersByType: { ...FALLBACK_PROVIDERS },
      providerUrlMap:   {},
      orcMethod:          'manifest',
      orcManifestUrl:            'https://github.com/k-orc/openstack-resource-controller/releases/latest/download/install.yaml',
      orcHelmRepo:               '',
      orcProgress:               '',
      orcError:                  '',
      providerVersions:          [],
      providerVersionsLoading:   false,
      providerVersionsError:     '',
      versionChangeInternal:     false,
      lastFetchedRepo:           '',
      form:             {
        name:           '',
        type:           '',
        version:        '',
        fetchConfigUrl: '',
        runtimeSDK:     true,
        features:       {
          clusterResourceSet: true,
          clusterTopology:    true,
          machinePool:        true,
        },
        variables: [],
      },
      providerTypes: [
        { value: 'infrastructure', label: 'infrastructure' },
        { value: 'controlPlane',   label: 'controlPlane' },
        { value: 'bootstrap',      label: 'bootstrap' },
        { value: 'core',           label: 'core' },
        { value: 'addon',          label: 'addon' },
      ],
    };
  },

  watch: {
    existing: {
      immediate: true,
      handler(val) {
        this.applyExisting(val);
      },
    },

    'form.fetchConfigUrl': {
      handler(url) {
        // Skip re-fetch when the URL was changed by our own version selector
        if (this.versionChangeInternal) {
          this.versionChangeInternal = false;

          return;
        }

        if (url && url.includes('github.com')) {
          // Only re-fetch if it's a different repo
          const m = url.match(/github\.com\/([^/]+)\/([^/]+)/);
          const repoKey = m ? `${ m[1] }/${ m[2] }` : '';

          if (repoKey && repoKey !== this.lastFetchedRepo) {
            this.fetchProviderVersions();
          }
        } else {
          this.providerVersions      = [];
          this.providerVersionsError  = '';
          this.lastFetchedRepo        = '';
        }
      },
    },
  },

  computed: {
    isEdit() {
      return !!this.existing;
    },

    isValid() {
      return !!this.form.name.trim() && !!this.form.type;
    },

    showOrcSection() {
      return this.form.type === 'infrastructure'
        && this.form.name.toLowerCase() === 'openstack';
    },

    /**
     * Extract GitHub owner/repo from the fetchConfigUrl.
     * Expects: https://github.com/{owner}/{repo}/releases/...
     */
    fetchConfigGitHub() {
      const m = this.form.fetchConfigUrl.match(/github\.com\/([^/]+)\/([^/]+)/);

      return m ? { owner: m[1], repo: m[2] } : null;
    },

    // Auto-generated metadata.name used when creating a new CAPIProvider.
    // Combines the lowercased type with the provider name, e.g. "infrastructure-aws".
    resourceName() {
      if (!this.form.type || !this.form.name.trim()) {
        return '';
      }

      return `${ this.form.type.toLowerCase() }-${ this.form.name.trim() }`;
    },

    validVariables() {
      return this.form.variables.filter((v) => v.name.trim());
    },

    // Convert the [{name, value}] array to the map format expected by the API.
    // Merges the RuntimeSDK toggle into the map.
    variablesMap() {
      const map = Object.fromEntries(this.validVariables.map((v) => [v.name.trim(), v.value]));

      map.RuntimeSDK = String(this.form.runtimeSDK);

      return map;
    },

    filteredProviderNames() {
      const names = this.allProvidersByType[this.form.type] || [];
      const q     = this.nameSearch;

      if (!q) {
        return names;
      }

      return names.filter((n) => n.toLowerCase().includes(q));
    },
  },

  async created() {
    await this.fetchProviders();
  },

  methods: {
    applyExisting(ex) {
      if (!ex) {
        return;
      }
      const exFeatures = ex?.spec?.features || {};

      // variables may be returned as an array [{name, value}] or as a plain
      // object/map {"KEY": "value"} depending on the API version – handle both.
      const rawVars = ex?.spec?.variables;
      let exVars    = [];
      let runtimeSDK = false;

      if (Array.isArray(rawVars)) {
        exVars = rawVars;
      } else if (rawVars && typeof rawVars === 'object') {
        exVars = Object.entries(rawVars).map(([k, v]) => ({ name: k, value: String(v) }));
      }

      // Extract RuntimeSDK from variables into its own toggle
      const runtimeVar = exVars.find((v) => v.name === 'RuntimeSDK');

      if (runtimeVar) {
        runtimeSDK = runtimeVar.value === 'true' || runtimeVar.value === true;
        exVars = exVars.filter((v) => v.name !== 'RuntimeSDK');
      }

      this.form = {
        name:           ex?.metadata?.name || ex?.spec?.name || '',
        type:           ex?.spec?.type || '',
        version:        ex?.spec?.version || '',
        fetchConfigUrl: ex?.spec?.fetchConfig?.url || '',
        runtimeSDK,
        features: {
          clusterResourceSet: exFeatures.clusterResourceSet !== undefined ? exFeatures.clusterResourceSet : true,
          clusterTopology:    exFeatures.clusterTopology !== undefined ? exFeatures.clusterTopology : true,
          machinePool:        exFeatures.machinePool !== undefined ? exFeatures.machinePool : true,
        },
        variables: exVars.map((v) => ({ name: v.name || '', value: v.value || '' })),
      };
      this.nameSearch = this.form.name;
    },

    async fetchProviders() {
      this.loadingProviders = true;
      try {
        const resp    = await fetch(PROVIDERS_GO_URL);
        const content = await resp.text();
        const parsed  = parseProvidersFromGo(content);
        const valid   = Object.entries(parsed)
          .filter(([k]) => k !== 'urlMap')
          .some(([, arr]) => arr.length > 0);

        if (valid) {
          const { urlMap, ...typeMap } = parsed;

          this.allProvidersByType = typeMap;
          this.providerUrlMap     = urlMap || {};
        }
      } catch (e) {
        // Network error or CORS – keep the built-in fallback list
        console.warn('Could not fetch CAPI provider list from GitHub:', e); // eslint-disable-line no-console
      } finally {
        this.loadingProviders = false;
      }
    },

    /**
     * Look up the fetchConfig URL for a provider, preferring the type-qualified
     * key (e.g. "Bootstrap/rke2") over the plain-name fallback.
     */
    lookupProviderUrl(type, name) {
      if (!type || !name) {
        return '';
      }

      return this.providerUrlMap[`${ type }/${ name }`]
        || this.providerUrlMap[name]
        || '';
    },

    onTypeChange() {
      if (!this.isEdit) {
        this.form.name           = '';
        this.nameSearch          = '';
        this.nameExists          = false;
        this.form.fetchConfigUrl = '';
      }
    },

    onNameInput() {
      // nameSearch drives filtering; sync form.name only if it exactly matches a known provider
      const match = (this.allProvidersByType[this.form.type] || []).find(
        (n) => n === this.nameSearch.trim()
      );

      this.form.name           = match || this.nameSearch.trim();
      this.form.fetchConfigUrl = this.lookupProviderUrl(this.form.type, this.form.name);
      this.nameExists          = false;
    },

    selectName(name) {
      this.form.name           = name;
      this.nameSearch          = name;
      this.form.fetchConfigUrl = this.lookupProviderUrl(this.form.type, name);
      this.showNameDropdown    = false;
      this.checkNameExists();
    },

    onNameBlur() {
      // Short delay so mousedown.prevent on dropdown items fires first
      setTimeout(() => {
        this.showNameDropdown    = false;
        this.form.name           = this.nameSearch.trim();
        this.form.fetchConfigUrl = this.lookupProviderUrl(this.form.type, this.form.name);
        if (this.form.name) {
          this.checkNameExists();
        }
      }, 150);
    },

    async checkNameExists() {
      if (!this.form.name || !this.form.type || this.isEdit) {
        this.nameExists = false;

        return;
      }
      try {
        const providerName = this.form.name;
        const providerType = this.form.type;
        const response     = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/apis/turtles-capi.cattle.io/v1alpha1/capiproviders',
        });

        this.nameExists = (response?.items || []).some(
          (item) => item.spec?.type === providerType &&
            item.spec?.name === providerName
        );
      } catch {
        this.nameExists = false;
      }
    },

    addVariable() {
      this.form.variables.push({ name: '', value: '' });
    },

    removeVariable(idx) {
      this.form.variables.splice(idx, 1);
    },

    async save() {
      if (!this.isValid || this.nameExists) {
        return;
      }

      this.saving = true;
      this.error  = '';

      try {
        const name      = this.form.name.trim();
        const resName   = this.isEdit
          ? (this.existing?.metadata?.name || this.resourceName)
          : this.resourceName;
        const namespace = this.isEdit
          ? (this.existing?.metadata?.namespace || resName + '-system')
          : resName + '-system';

        const body = {
          apiVersion: 'turtles-capi.cattle.io/v1alpha1',
          kind:       'CAPIProvider',
          metadata:   {
            name:      resName,
            namespace,
          },
          spec: {
            name:     name,
            type:     this.form.type,
            ...(this.form.version.trim() ? { version: this.form.version.trim() } : {}),
            ...(this.form.fetchConfigUrl.trim() ? { fetchConfig: { url: this.form.fetchConfigUrl.trim() } } : {}),
            features: { ...this.form.features },
            variables: this.variablesMap,
          },
        };

        if (this.isEdit) {
          await this.$store.dispatch('management/request', {
            method: 'PUT',
            url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ namespace }/capiproviders/${ resName }`,
            data:   {
              ...this.existing,
              spec: body.spec,
            },
          });
        } else {
          // Ensure the target namespace exists before creating the resource.
          try {
            await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ namespace }`,
            });
          } catch {
            // Namespace does not exist – create it.
            await this.$store.dispatch('management/request', {
              method: 'POST',
              url:    '/api/v1/namespaces',
              data:   {
                apiVersion: 'v1',
                kind:       'Namespace',
                metadata:   { name: namespace },
              },
            });
          }

          await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ namespace }/capiproviders`,
            data:   body,
          });
        }

        this.$emit('save');

        // After provider is created/updated, install ORC if applicable
        if (this.showOrcSection && this.orcMethod === 'manifest' && this.orcManifestUrl.trim() && !this.isEdit) {
          await this.installOrc();
        }
      } catch (e) {
        this.error = e?.message || this.t('clusterstacks.capiProviders.errors.save');
      } finally {
        this.saving = false;
      }
    },

    /**
     * Apply the ORC manifest – works like "kubectl apply -f <url>".
     *
     * 1. Download the manifest via Rancher's /meta/proxy/ (avoids CORS).
     * 2. Split the multi-document YAML on "---".
     * 3. For each document use Kubernetes **Server-Side Apply** (SSA):
     *    PATCH with Content-Type: application/apply-patch+yaml
     *    The K8s API parses the raw YAML server-side – no browser-side
     *    YAML→JSON conversion needed.
     */
    async installOrc() {
      this.orcProgress = this.t('clusterstacks.capiProviders.form.orcInstalling');
      this.orcError    = '';

      try {
        // --- 1. Download manifest via Rancher proxy (same-origin → no CORS) ---
        const manifestUrl = this.orcManifestUrl.trim();
        const dlResp      = await fetch(`/meta/proxy/${ manifestUrl }`, {
          credentials: 'same-origin',
          headers:     { Accept: 'text/plain, application/x-yaml, */*' },
        });

        if (!dlResp.ok) {
          throw new Error(`Download failed: HTTP ${ dlResp.status } ${ dlResp.statusText }`);
        }

        const yamlText = await dlResp.text();

        // --- 2. Split multi-document YAML ---
        const docs = yamlText.split(/^---$/m)
          .map((d) => d.trim())
          .filter((d) => d && !d.startsWith('#'));

        let applied = 0;
        const errors = [];

        for (const doc of docs) {
          // Extract only the fields needed to construct the API URL
          const av = doc.match(/^apiVersion:\s*(.+)$/m);
          const ki = doc.match(/^kind:\s*(.+)$/m);
          const nm = doc.match(/^\s+name:\s*(.+)$/m);
          const ns = doc.match(/^\s+namespace:\s*(.+)$/m);

          if (!av || !ki || !nm) {
            continue;
          }

          const apiVersion = av[1].trim();
          const kind       = ki[1].trim();
          const resName    = nm[1].trim();
          const namespace  = ns ? ns[1].trim() : '';

          // Build K8s API path – SSA targets the named resource directly
          const apiBase = apiVersion.includes('/') ? `/apis/${ apiVersion }` : `/api/${ apiVersion }`;
          const nsPath  = namespace ? `${ apiBase }/namespaces/${ namespace }` : apiBase;
          const plural  = this.pluralize(kind);
          const ssaUrl  = `${ nsPath }/${ plural }/${ resName }?fieldManager=clusterstacks-ui&force=true`;

          // --- 3. Server-Side Apply (raw YAML, no parsing) ---
          try {
            await this.$store.dispatch('management/request', {
              method:  'PATCH',
              url:     ssaUrl,
              data:    doc,
              headers: { 'Content-Type': 'application/apply-patch+yaml' },
            });
            applied++;
          } catch (e) {
            const msg = `${ kind }/${ resName }: ${ e.message || e.statusText || e }`;

            console.warn(`ORC: ${ msg }`, e); // eslint-disable-line no-console
            errors.push(msg);
          }
        }

        this.orcProgress = '';

        if (errors.length) {
          this.orcError = `ORC: ${ applied } applied, ${ errors.length } failed – ${ errors.slice(0, 3).join('; ') }`;
        }
      } catch (e) {
        this.orcProgress = '';
        this.orcError    = `${ this.t('clusterstacks.capiProviders.form.orcInstallError') }: ${ e.message || e }`;
      }
    },

    /**
     * Fetch available releases from the GitHub repo derived from fetchConfigUrl.
     * Filters out pre-releases, drafts, and RC/alpha/beta tags.
     */
    async fetchProviderVersions() {
      const gh = this.fetchConfigGitHub;

      if (!gh) {
        return;
      }

      this.providerVersionsLoading = true;
      this.providerVersionsError   = '';
      this.lastFetchedRepo         = `${ gh.owner }/${ gh.repo }`;

      try {
        const apiUrl = `https://api.github.com/repos/${ gh.owner }/${ gh.repo }/releases?per_page=100`;
        const resp   = await fetch(apiUrl, {
          headers: { Accept: 'application/vnd.github+json' },
        });

        if (!resp.ok) {
          throw new Error(`GitHub API: HTTP ${ resp.status }`);
        }

        const releases = await resp.json();

        // Filter: no drafts, no pre-releases, no RC/alpha/beta tags
        this.providerVersions = releases
          .filter((r) => !r.draft && !r.prerelease)
          .map((r) => r.tag_name)
          .filter((tag) => !/-(rc|alpha|beta|dev)/i.test(tag));
      } catch (e) {
        console.warn('Provider versions: failed to fetch:', e); // eslint-disable-line no-console
        this.providerVersionsError = `${ this.t('clusterstacks.capiProviders.form.versionsError') }: ${ e.message || e }`;
      } finally {
        this.providerVersionsLoading = false;
      }
    },

    /**
     * When the user picks a version from the dropdown, update the fetchConfigUrl
     * to point to that specific release instead of "latest".
     */
    onProviderVersionChange() {
      const gh = this.fetchConfigGitHub;

      if (!gh) {
        return;
      }

      const url = this.form.fetchConfigUrl;
      // Extract the asset filename from the current URL (e.g. "infrastructure-components.yaml")
      const assetMatch = url.match(/\/download\/[^/]+\/(.+)$/) || url.match(/\/latest\/(.+)$/);
      const asset      = assetMatch ? assetMatch[1] : '';

      if (!asset) {
        return;
      }

      if (!this.form.version) {
        // Empty = latest
        this.versionChangeInternal = true;
        this.form.fetchConfigUrl = `https://github.com/${ gh.owner }/${ gh.repo }/releases/latest/${ asset }`;
      } else {
        this.versionChangeInternal = true;
        this.form.fetchConfigUrl = `https://github.com/${ gh.owner }/${ gh.repo }/releases/download/${ this.form.version }/${ asset }`;
      }
    },

    pluralize(kind) {
      const k = kind.toLowerCase();

      if (k.endsWith('s')) {
        return k + 'es';
      }
      if (k.endsWith('y') && !k.endsWith('ey')) {
        return k.slice(0, -1) + 'ies';
      }

      return k + 's';
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.capi-provider-form {
  max-width: 600px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-weight: 600;
  font-size: 0.9em;
  color: var(--body-text);

  .required {
    color: var(--error);
    margin-left: 2px;
  }
}

.form-input,
.form-select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
  font-size: 0.95em;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.form-input-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  display: block;
}

.form-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.85em;
}

.form-error {
  padding: 10px 14px;
  border: 1px solid var(--error);
  border-radius: 4px;
  background: var(--error-banner-bg, rgba(185, 28, 28, 0.1));
  color: var(--error);
  font-size: 0.9em;
  margin-bottom: 16px;
}

.form-error-inline {
  margin: 0;
  color: var(--error);
  font-size: 0.85em;
}

.form-optional {
  font-weight: 400;
  color: var(--muted);
  margin-left: 6px;
  font-size: 0.85em;
}

/* ─── Searchable select ─────────────────────────────────────────── */
.searchable-select-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 220px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.9em;
  color: var(--body-text);

  &:hover {
    background: var(--hover-bg, rgba(0, 0, 0, 0.06));
  }
}

/* ─── Features ─────────────────────────────────────────────────── */
.features-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 400;
  font-size: 0.9em;
  cursor: pointer;

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
}

/* ─── Variables ─────────────────────────────────────────────────── */
.variables-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.variable-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.variable-input {
  flex: 1;
}

.variable-sep {
  color: var(--muted);
  font-weight: 600;
}

.btn-remove-var {
  padding: 4px 10px;
  font-size: 1.1em;
  line-height: 1;
  flex-shrink: 0;
}

.btn-add-var {
  align-self: flex-start;
  font-size: 0.85em;
}

/* ─── Actions ───────────────────────────────────────────────────── */
.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
