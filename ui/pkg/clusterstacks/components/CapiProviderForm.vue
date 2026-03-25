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
    const ex = this.existing;

    return {
      saving: false,
      error:  '',
      form:   {
        name:      ex?.metadata?.name || ex?.spec?.name || '',
        type:      ex?.spec?.type || '',
        version:   ex?.spec?.version || '',
        namespace: ex?.metadata?.namespace || DEFAULT_NAMESPACE,
      },
      providerTypes: [
        { value: 'Infrastructure',  label: 'Infrastructure' },
        { value: 'ControlPlane',    label: 'ControlPlane' },
        { value: 'Bootstrap',       label: 'Bootstrap' },
        { value: 'Core',            label: 'Core' },
        { value: 'Addon',           label: 'Addon' },
      ],
    };
  },

  computed: {
    isEdit() {
      return !!this.existing;
    },

    isValid() {
      return !!this.form.name.trim() && !!this.form.type;
    },
  },

  methods: {
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
            name:    name,
            type:    this.form.type,
            ...(this.form.version.trim() ? { version: this.form.version.trim() } : {}),
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

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
