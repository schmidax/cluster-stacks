<template>
  <div class="clusterstack-form">
    <div class="form-section">
      <!-- Provider -->
      <div class="form-row">
        <label class="form-label" for="cs-provider">
          {{ t('clusterstacks.stackForm.provider') }}
          <span class="required">*</span>
        </label>
        <input
          id="cs-provider"
          v-model="form.provider"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.stackForm.providerPlaceholder')"
        />
      </div>

      <!-- Name -->
      <div class="form-row">
        <label class="form-label" for="cs-name">
          {{ t('clusterstacks.stackForm.name') }}
          <span class="required">*</span>
        </label>
        <input
          id="cs-name"
          v-model="form.name"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.stackForm.namePlaceholder')"
        />
      </div>

      <!-- kubernetesVersion -->
      <div class="form-row">
        <label class="form-label" for="cs-k8s-version">
          {{ t('clusterstacks.stackForm.kubernetesVersion') }}
          <span class="required">*</span>
        </label>
        <input
          id="cs-k8s-version"
          v-model="form.kubernetesVersion"
          type="text"
          class="form-input"
          :placeholder="t('clusterstacks.stackForm.kubernetesVersionPlaceholder')"
        />
      </div>

      <!-- channel -->
      <div class="form-row">
        <label class="form-label" for="cs-channel">
          {{ t('clusterstacks.stackForm.channel') }}
        </label>
        <select id="cs-channel" v-model="form.channel" class="form-select">
          <option value="stable">stable</option>
          <option value="custom">custom</option>
        </select>
      </div>

      <!-- autoSubscribe -->
      <div class="form-row form-row-checkbox">
        <label class="form-label checkbox-label">
          <input v-model="form.autoSubscribe" type="checkbox" />
          {{ t('clusterstacks.stackForm.autoSubscribe') }}
        </label>
        <span class="form-hint-text">{{ t('clusterstacks.stackForm.autoSubscribeHint') }}</span>
      </div>

      <!-- noProvider -->
      <div class="form-row form-row-checkbox">
        <label class="form-label checkbox-label">
          <input v-model="form.noProvider" type="checkbox" />
          {{ t('clusterstacks.stackForm.noProvider') }}
        </label>
        <span class="form-hint-text">{{ t('clusterstacks.stackForm.noProviderHint') }}</span>
      </div>

      <!-- Versions (only when autoSubscribe == false) -->
      <div v-if="!form.autoSubscribe" class="form-row">
        <label class="form-label">
          {{ t('clusterstacks.stackForm.versions') }}
          <span class="required">*</span>
        </label>
        <div class="versions-list">
          <div
            v-for="(ver, idx) in form.versions"
            :key="idx"
            class="version-row"
          >
            <input
              v-model="form.versions[idx]"
              type="text"
              class="form-input version-input"
              :class="{ 'is-invalid': ver && !isValidVersion(ver) }"
              :placeholder="t('clusterstacks.stackForm.versionPlaceholder')"
            />
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

    <div class="form-actions">
      <button class="btn role-secondary" :disabled="saving" @click="$emit('cancel')">
        {{ t('clusterstacks.common.cancel') }}
      </button>
      <button class="btn role-primary" :disabled="!isValid || saving" @click="save">
        <span v-if="saving"><i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.saving') }}</span>
        <span v-else>{{ t('clusterstacks.stackForm.save') }}</span>
      </button>
    </div>
  </div>
</template>

<script>
const VERSION_RE       = /^v\d+$/;
const DEFAULT_NAMESPACE = 'clusterstacks';

export default {
  name: 'ClusterStackForm',

  emits: ['save', 'cancel'],

  data() {
    return {
      saving: false,
      error:  null,
      form:   {
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

  computed: {
    resourceName() {
      if (!this.form.provider.trim() || !this.form.kubernetesVersion.trim()) {
        return '';
      }

      return `${ this.form.provider.trim() }-${ this.form.kubernetesVersion.trim().replace(/\./g, '-') }`;
    },

    validVersions() {
      return this.form.versions.filter((v) => v.trim() && VERSION_RE.test(v.trim()));
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

  methods: {
    isValidVersion(v) {
      return VERSION_RE.test(v.trim());
    },

    addVersion() {
      this.form.versions.push('');
    },

    removeVersion(idx) {
      this.form.versions.splice(idx, 1);
    },

    async save() {
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
        this.$emit('save');
      } catch (e) {
        this.error = e?.message || this.t('clusterstacks.stackForm.errors.save');
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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.form-hint-text {
  font-size: 0.8em;
  color: var(--muted);
  padding-left: 22px;
}

.form-input,
.form-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--body-text);
  font-size: 0.9em;
  width: 100%;

  &.is-invalid {
    border-color: var(--error);
  }

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
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

.version-input {
  width: auto;
  flex: 0 0 140px;
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
</style>
