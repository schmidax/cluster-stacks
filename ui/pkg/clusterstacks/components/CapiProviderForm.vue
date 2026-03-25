<template>
  <div class="capi-provider-form">
    <div class="form-section">
      <div class="form-row">
        <label class="form-label" for="capi-name">
          {{ t('clusterstacks.capiProviders.form.name') }}
          <span class="required">*</span>
        </label>
        <input
          id="capi-name"
          v-model="form.name"
          type="text"
          class="form-input"
          :disabled="isEdit"
          :placeholder="t('clusterstacks.capiProviders.form.namePlaceholder')"
        />
        <p v-if="isEdit" class="form-hint">
          {{ t('clusterstacks.capiProviders.form.nameEditHint') }}
        </p>
      </div>

      <div class="form-row">
        <label class="form-label" for="capi-type">
          {{ t('clusterstacks.capiProviders.form.type') }}
          <span class="required">*</span>
        </label>
        <select
          id="capi-type"
          v-model="form.type"
          class="form-select"
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

      <div class="form-row">
        <label class="form-label" for="capi-version">
          {{ t('clusterstacks.capiProviders.form.version') }}
        </label>
        <input
          id="capi-version"
          v-model="form.version"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.capiProviders.form.versionPlaceholder')"
        />
      </div>

      <div class="form-row">
        <label class="form-label" for="capi-namespace">
          {{ t('clusterstacks.capiProviders.form.namespace') }}
        </label>
        <input
          id="capi-namespace"
          v-model="form.namespace"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.capiProviders.form.namespacePlaceholder')"
        />
        <p class="form-hint">
          {{ t('clusterstacks.capiProviders.form.namespaceHint') }}
        </p>
      </div>

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

      <div class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.capiProviders.form.variables') }}
          <span class="form-optional">{{ t('clusterstacks.capiProviders.form.optional') }}</span>
        </label>
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
    </div>

    <div v-if="error" class="form-error">
      {{ error }}
    </div>

    <div class="form-actions">
      <button class="btn role-secondary" :disabled="saving" @click="$emit('cancel')">
        {{ t('clusterstacks.common.cancel') }}
      </button>
      <button class="btn role-primary" :disabled="!isValid || saving" @click="save">
        <span v-if="saving">{{ t('clusterstacks.common.loading') }}</span>
        <span v-else>{{ t('clusterstacks.capiProviders.form.save') }}</span>
      </button>
    </div>
  </div>
</template>

<script>
const DEFAULT_NAMESPACE = 'rancher-turtles-system';

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
      saving: false,
      error:  '',
      form:   this.buildForm(this.existing),
      providerTypes: [
        { value: 'Infrastructure',  label: 'Infrastructure' },
        { value: 'ControlPlane',    label: 'ControlPlane' },
        { value: 'Bootstrap',       label: 'Bootstrap' },
        { value: 'Core',            label: 'Core' },
        { value: 'Addon',           label: 'Addon' },
      ],
    };
  },

  watch: {
    existing(val) {
      this.form = this.buildForm(val);
    },
  },

  computed: {
    isEdit() {
      return !!this.existing;
    },

    isValid() {
      return !!this.form.name.trim() && !!this.form.type;
    },

    validVariables() {
      return this.form.variables.filter((v) => v.name.trim());
    },
  },

  methods: {
    buildForm(ex) {
      const exFeatures = ex?.spec?.features || {};
      const exVars     = ex?.spec?.variables || [];

      return {
        name:      ex?.metadata?.name || ex?.spec?.name || '',
        type:      ex?.spec?.type || '',
        version:   ex?.spec?.version || '',
        namespace: ex?.metadata?.namespace || DEFAULT_NAMESPACE,
        features:  {
          clusterResourceSet: exFeatures.clusterResourceSet !== undefined ? exFeatures.clusterResourceSet : true,
          clusterTopology:    exFeatures.clusterTopology !== undefined ? exFeatures.clusterTopology : true,
          machinePool:        exFeatures.machinePool !== undefined ? exFeatures.machinePool : true,
        },
        variables: exVars.map((v) => ({ name: v.name || '', value: v.value || '' })),
      };
    },

    addVariable() {
      this.form.variables.push({ name: '', value: '' });
    },

    removeVariable(idx) {
      this.form.variables.splice(idx, 1);
    },

    async save() {
      if (!this.isValid) {
        return;
      }

      this.saving = true;
      this.error  = '';

      try {
        const namespace = this.form.namespace.trim() || DEFAULT_NAMESPACE;
        const name      = this.form.name.trim();

        const body = {
          apiVersion: 'turtles-capi.cattle.io/v1alpha1',
          kind:       'CAPIProvider',
          metadata:   {
            name,
            namespace,
          },
          spec: {
            name:     name,
            type:     this.form.type,
            ...(this.form.version.trim() ? { version: this.form.version.trim() } : {}),
            features: { ...this.form.features },
            ...(this.validVariables.length ? { variables: this.validVariables } : {}),
          },
        };

        if (this.isEdit) {
          // Apply patch via PUT
          await this.$store.dispatch('management/request', {
            method: 'PUT',
            url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ namespace }/capiproviders/${ name }`,
            data:   {
              ...this.existing,
              spec: body.spec,
            },
          });
        } else {
          await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    `/apis/turtles-capi.cattle.io/v1alpha1/namespaces/${ namespace }/capiproviders`,
            data:   body,
          });
        }

        this.$emit('save');
      } catch (e) {
        this.error = e?.message || this.t('clusterstacks.capiProviders.errors.save');
      } finally {
        this.saving = false;
      }
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

.form-optional {
  font-weight: 400;
  color: var(--muted);
  margin-left: 6px;
  font-size: 0.85em;
}

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

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
