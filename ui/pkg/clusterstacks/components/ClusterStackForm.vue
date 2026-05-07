<template>
  <div class="clusterstack-form">
    <div class="form-section">
      <!-- Provider -->
      <div class="form-row">
        <LabeledInput
          v-if="isEdit"
          :value="form.provider"
          :label="t('clusterstacks.stackForm.provider')"
          :disabled="true"
        />
        <div v-else>
          <LabeledSelect
            :value="form.provider"
            :label="t('clusterstacks.stackForm.provider')"
            :placeholder="t('clusterstacks.stackForm.providerSelect')"
            :options="infraProviderOptions"
            :loading="loadingProviders"
            :taggable="true"
            @update:value="form.provider = selectValue($event)"
          />
          <span v-if="!loadingProviders && !infraProviders.length" class="form-hint-text">
            {{ t('clusterstacks.stackForm.noInfraProviders') }}
          </span>
        </div>
      </div>

      <!-- Name -->
      <div class="form-row">
        <LabeledInput
          v-if="isEdit"
          :value="form.name"
          :label="t('clusterstacks.stackForm.name')"
          :disabled="true"
        />
        <LabeledSelect
          v-else
          :value="form.name"
          :label="t('clusterstacks.stackForm.name')"
          :placeholder="t('clusterstacks.stackForm.namePlaceholder')"
          :options="stackNameOptions"
          :taggable="true"
          @update:value="onNameSelectionChange"
        />
      </div>

      <!-- kubernetesVersion -->
      <div class="form-row">
        <LabeledInput
          v-model:value="form.kubernetesVersion"
          :label="t('clusterstacks.stackForm.kubernetesVersion')"
          :placeholder="t('clusterstacks.stackForm.kubernetesVersionPlaceholder')"
          :disabled="isEdit"
        />
      </div>

      <!-- channel -->
      <div class="form-row">
        <LabeledSelect
          :value="form.channel"
          :label="t('clusterstacks.stackForm.channel')"
          :options="channelOptions"
          @update:value="form.channel = selectValue($event)"
        />
      </div>

      <!-- autoSubscribe -->
      <div class="form-row form-row-checkbox">
        <Checkbox v-model:value="form.autoSubscribe" :label="t('clusterstacks.stackForm.autoSubscribe')" />
        <span class="form-hint-text">{{ t('clusterstacks.stackForm.autoSubscribeHint') }}</span>
      </div>

      <!-- noProvider -->
      <div class="form-row form-row-checkbox">
        <Checkbox v-model:value="form.noProvider" :label="t('clusterstacks.stackForm.noProvider')" />
        <span class="form-hint-text">{{ t('clusterstacks.stackForm.noProviderHint') }}</span>
      </div>

      <!-- Versions (only when autoSubscribe == false) -->
      <div v-if="!form.autoSubscribe" class="form-row">
        <div class="versions-list">
          <div
            v-for="(ver, idx) in form.versions"
            :key="idx"
            class="version-row"
          >
            <div class="version-input-wrap">
              <input
                v-model.trim="form.versions[idx]"
                type="text"
                class="version-input"
                :placeholder="t('clusterstacks.stackForm.versionPlaceholder')"
              >
            </div>
            <button class="btn btn-sm role-secondary btn-remove-var" @click="removeVersion(idx)">
              &times;
            </button>
            <span v-if="ver && !isValidVersion(ver)" class="validation-error">
              {{ t('clusterstacks.stackForm.versionInvalid') }}
            </span>
          </div>
        </div>
        <button class="btn role-secondary btn-add-var" @click="addVersion">
          + {{ t('clusterstacks.stackForm.addVersion') }}
        </button>
      </div>

      <!-- auto-generated resource name hint -->
      <div v-if="resourceName" class="form-row form-info">
        {{ t('clusterstacks.stackForm.resourceNameHint') }}: <code>{{ resourceName }}</code>
      </div>
    </div>

    <div v-if="error" class="form-error">
      {{ error }}
    </div>

    <div v-if="isFleetManagedExisting" class="fleet-managed-notice">
      <i class="icon icon-warning" /> {{ fleetManagedTooltip }}
    </div>

    <div class="form-actions">
      <button class="btn role-secondary" :disabled="saving" @click="$emit('cancel')">
        {{ t('clusterstacks.common.cancel') }}
      </button>
      <AsyncButton
        :disabled="!isValid || saving || isFleetManagedExisting"
        :action-label="isEdit ? t('clusterstacks.stackForm.update') : t('clusterstacks.stackForm.save')"
        :title="isFleetManagedExisting ? fleetManagedTooltip : ''"
        @click="saveAction"
      />
    </div>
  </div>
</template>

<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import AsyncButton from '@shell/components/AsyncButton';
import { FLEET_MANAGED_TOOLTIP, isFleetManagedResource } from '../utils/fleet-management';

const VERSION_RE       = /^v\d+(?:[-.][a-z0-9]+(?:[.-][a-z0-9]+)*)?$/i;
const DEFAULT_NAMESPACE = 'clusterstacks';

export default {
  name: 'ClusterStackForm',

  components: {
    AsyncButton,
    Checkbox,
    LabeledInput,
    LabeledSelect,
  },

  emits: ['save', 'cancel'],

  props: {
    existingStack: {
      type:    Object,
      default: null,
    },
  },

  data() {
    return {
      saving:           false,
      error:            null,
      infraProviders:   [],
      loadingProviders: false,
      form:             {
        provider:          '',
        name:              '',
        kubernetesVersion: '',
        channel:           'stable',
        autoSubscribe:     false,
        noProvider:        false,
        versions:          [''],
      },
    };
  },

  async mounted() {
    await this.loadInfraProviders();
  },

  computed: {
    fleetManagedTooltip() {
      return FLEET_MANAGED_TOOLTIP;
    },

    isEdit() {
      return !!this.existingStack;
    },

    isFleetManagedExisting() {
      return this.isEdit && isFleetManagedResource(this.existingStack);
    },

    resourceName() {
      const provider = this.form.provider.trim();
      const name     = this.form.name.trim();
      const k8s      = this.form.kubernetesVersion.trim().replace(/\./g, '-');

      if (!provider || !name || !k8s) {
        return '';
      }

      return `${ provider }-${ name }-${ k8s }`;
    },

    validVersions() {
      return this.form.versions.filter((v) => v.trim() && VERSION_RE.test(v.trim()));
    },

    infraProviderOptions() {
      return this.infraProviders.map((provider) => ({
        label: `${ provider.name }${ provider.namespace ? ` (${ provider.namespace })` : '' }`,
        value: provider.name,
      }));
    },

    stackNameOptions() {
      return ['rke2', 'scs2'].map((name) => ({ label: name, value: name }));
    },

    channelOptions() {
      return [
        { label: 'stable', value: 'stable' },
        { label: 'custom', value: 'custom' },
      ];
    },

    isValid() {
      if (!this.form.provider.trim() || !this.form.name.trim() || !this.form.kubernetesVersion.trim()) {
        return false;
      }
      if (!this.form.autoSubscribe) {
        if (this.validVersions.length === 0) {
          return false;
        }
        const hasInvalid = this.form.versions.some((v) => v.trim() && !VERSION_RE.test(v.trim()));

        if (hasInvalid) {
          return false;
        }
      }

      return true;
    },
  },

  watch: {
    existingStack: {
      immediate: true,
      handler(stack) {
        if (stack) {
          const spec = stack.spec || {};

          this.form.provider          = spec.provider || '';
          this.form.name              = spec.name || '';
          this.form.kubernetesVersion = spec.kubernetesVersion || '';
          this.form.channel           = spec.channel || 'stable';
          this.form.autoSubscribe     = !!spec.autoSubscribe;
          this.form.noProvider        = !!spec.noProvider;
          // K8s CRD may store versions as 'version' or 'versions'
          const versionList = Array.isArray(spec.versions) ? spec.versions
            : Array.isArray(spec.version) ? spec.version
              : [];

          this.form.versions = versionList.length ? [...versionList] : [''];
        }
      },
    },
  },

  methods: {
    selectValue(input) {
      if (input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'value')) {
        return input.value;
      }

      return input;
    },

    onNameSelectionChange(value) {
      this.form.name = String(this.selectValue(value) || '').trim();
    },

    async loadInfraProviders() {
      this.loadingProviders = true;
      try {
        const response = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/apis/turtles-capi.cattle.io/v1alpha1/capiproviders',
        });

        this.infraProviders = (response?.items || []).filter(
          (item) => (item.spec?.type || '').toLowerCase() === 'infrastructure'
        ).map((item) => ({
          name:      item.spec?.name || item.metadata?.name || '',
          namespace: item.metadata?.namespace || '',
        }));
      } catch {
        this.infraProviders = [];
      } finally {
        this.loadingProviders = false;
      }
    },

    isValidVersion(v) {
      return VERSION_RE.test(v.trim());
    },

    addVersion() {
      this.form.versions.push('');
    },

    updateVersion(idx, value) {
      this.form.versions.splice(idx, 1, String(this.selectValue(value) || '').trim());
    },

    removeVersion(idx) {
      this.form.versions.splice(idx, 1);
    },

    async save() {
      if (this.isFleetManagedExisting) {
        this.error = FLEET_MANAGED_TOOLTIP;
        return;
      }

      this.saving = true;
      this.error  = null;

      try {
        const spec = {
          provider:          this.form.provider.trim(),
          name:              this.form.name.trim(),
          kubernetesVersion: this.form.kubernetesVersion.trim(),
          channel:           this.form.channel,
          autoSubscribe:     this.form.autoSubscribe,
          noProvider:        this.form.noProvider,
        };

        if (!this.form.autoSubscribe) {
          spec.version = this.validVersions.map((v) => v.trim());
        }

        if (this.isEdit) {
          // Update existing ClusterStack via PUT
          const ns   = this.existingStack.metadata?.namespace || DEFAULT_NAMESPACE;
          const name = this.existingStack.metadata?.name;

          await this.$store.dispatch('management/request', {
            method: 'PUT',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ ns }/clusterstacks/${ name }`,
            data:   {
              apiVersion:      'clusterstack.x-k8s.io/v1alpha1',
              kind:            'ClusterStack',
              metadata:        {
                name,
                namespace:       ns,
                resourceVersion: this.existingStack.metadata?.resourceVersion,
              },
              spec,
            },
          });
        } else {
          // Ensure the target namespace exists before creating the resource.
          try {
            await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    `/api/v1/namespaces/${ DEFAULT_NAMESPACE }`,
            });
          } catch {
            // Namespace does not exist – create it.
            await this.$store.dispatch('management/request', {
              method: 'POST',
              url:    '/api/v1/namespaces',
              data:   {
                apiVersion: 'v1',
                kind:       'Namespace',
                metadata:   { name: DEFAULT_NAMESPACE },
              },
            });
          }

          // Create new ClusterStack via POST
          await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    `/apis/clusterstack.x-k8s.io/v1alpha1/namespaces/${ DEFAULT_NAMESPACE }/clusterstacks`,
            data:   {
              apiVersion: 'clusterstack.x-k8s.io/v1alpha1',
              kind:       'ClusterStack',
              metadata:   {
                name:      this.resourceName,
                namespace: DEFAULT_NAMESPACE,
              },
              spec,
            },
          });
        }

        this.$emit('save');
      } catch (e) {
        this.error = e?.message || this.t(
          this.isEdit ? 'clusterstacks.stackForm.errors.update' : 'clusterstacks.stackForm.errors.save'
        );
      } finally {
        this.saving = false;
      }
    },

    async saveAction(buttonDone) {
      try {
        await this.save();
        buttonDone?.(true);
      } catch (e) {
        buttonDone?.(false);
        throw e;
      }
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.clusterstack-form {
  max-width: 600px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row-checkbox {
  gap: 2px;
}

.form-label {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--body-text);

  .required {
    color: var(--error);
    margin-left: 2px;
  }
}

.form-hint-text {
  font-size: 0.8em;
  color: var(--muted);
  padding-left: 22px;
}

.form-info {
  font-size: 0.85em;
  color: var(--muted);

  code {
    background: var(--code-bg, var(--nav-bg));
    padding: 1px 5px;
    border-radius: 3px;
    font-family: monospace;
  }
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.version-input-wrap {
  min-width: 200px;
  flex: 1 1 240px;
}

.version-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--body-bg));
  color: var(--body-text);
  font-size: 14px;
}

.btn-remove-var {
  padding: 4px 10px;
  line-height: 1;
}

.btn-add-var {
  margin-top: 4px;
  align-self: flex-start;
}

.validation-error {
  font-size: 0.8em;
  color: var(--error);
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
  margin-bottom: 12px;
}

.form-error {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--error-banner-bg);
  color: var(--error);
  border-radius: 4px;
  font-size: 0.9em;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.form-input-disabled {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--disabled-bg, #f5f5f5);
  color: var(--muted);
  font-size: 0.9em;
  cursor: not-allowed;
}
</style>
