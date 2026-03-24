<template>
  <div class="credential-form">
    <!-- Rancher project selector (shown for both new and existing credentials) -->
    <div v-if="projects.length" class="form-row">
      <label class="form-label">{{ t('clusterstacks.credentialCreate.rancherProject') }}</label>
      <select v-model="selectedProjectId" class="project-select">
        <option value="">{{ t('clusterstacks.credentialCreate.rancherProjectPlaceholder') }}</option>
        <option v-for="p in projects" :key="p.id" :value="(p.id || '').replace('/', ':')">
          {{ p.spec && p.spec.displayName ? p.spec.displayName : (p.name || p.id) }}
        </option>
      </select>
    </div>

    <!-- clouds.yaml paste / upload -->
    <div class="form-row">
      <div class="yaml-header">
        <label class="form-label">{{ t('clusterstacks.credentialCreate.cloudYaml') }}</label>
        <button class="btn btn-sm role-secondary" @click="$refs.yamlFileInput.click()">
          {{ t('clusterstacks.credentialCreate.uploadYaml') }}
        </button>
        <input
          ref="yamlFileInput"
          type="file"
          accept=".yaml,.yml,.txt"
          style="display:none"
          @change="onFileUpload"
        />
      </div>
      <textarea
        v-model="yamlContent"
        class="yaml-textarea"
        :placeholder="t('clusterstacks.credentialCreate.cloudYamlPlaceholder')"
        rows="15"
      />
      <div v-if="yamlError" class="banner banner-error">{{ yamlError }}</div>

      <!-- Project name (read-only) shown after a successful connection test -->
      <div v-if="form.projectName" class="form-row project-name-detected">
        <LabeledInput
          v-model="form.projectName"
          :label="t('clusterstacks.credentialCreate.projectName')"
          :disabled="true"
        />
        <div class="namespace-hint">
          {{ t('clusterstacks.credentialCreate.namespaceHint') }}: <code>cso-{{ form.projectName }}</code>
        </div>
      </div>
    </div>

    <!-- Connection test result -->
    <div v-if="testResult" class="banner" :class="testResult.success ? 'banner-success' : 'banner-error'">
      {{ testResult.success
        ? t('clusterstacks.credentialCreate.testSuccess')
        : `${t('clusterstacks.credentialCreate.testError')}: ${testResult.error}` }}
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn role-secondary" @click="$emit('cancel')">
        {{ t('clusterstacks.credentialCreate.cancel') }}
      </button>
      <BusyButton :busy="testing" class="btn role-secondary" @click="testConnection">
        {{ t('clusterstacks.credentialCreate.testConnection') }}
      </BusyButton>
      <BusyButton
        v-if="connectionTested || isEdit"
        :busy="saving"
        :disabled="!canSave"
        class="btn role-primary"
        @click="save"
      >
        {{ t('clusterstacks.credentialCreate.save') }}
      </BusyButton>
    </div>
  </div>
</template>

<script>
import LabeledInput from './LabeledInput.vue';
import BusyButton   from './BusyButton.vue';
import { OpenStackApiService } from '../services/openstack-api';

export default {
  name: 'OpenstackCredentialForm',

  components: { LabeledInput, BusyButton },

  props: {
    existing: {
      type:    Object,
      default: null,
    },

    existingProjectId: {
      type:    String,
      default: '',
    },

    projects: {
      type:    Array,
      default: () => [],
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      yamlContent:       '',
      yamlError:         null,
      connectionTested:  false,
      selectedProjectId: '',

      form: {
        projectName: '',
      },

      saving:     false,
      testing:    false,
      testResult: null,
    };
  },

  computed: {
    isEdit() {
      return !!this.existing;
    },

    // The Kubernetes namespace where the secret is stored: cso-{projectName}
    targetNamespace() {
      return `cso-${this.form.projectName}`;
    },

    canSave() {
      return !!(this.yamlContent && this.form.projectName);
    },
  },

  watch: {
    // Re-populate form whenever the parent asynchronously resolves the existing secret
    existing: {
      immediate: true,
      handler(val) {
        if (val) {
          this.populateFromExisting();
        }
      },
    },

    // Sync selected project when the parent resolves the existing namespace's project
    existingProjectId(val) {
      if (val && !this.selectedProjectId) {
        this.selectedProjectId = val;
      }
    },

    // Require re-test when YAML content changes (only relevant for new credentials)
    yamlContent() {
      if (!this.isEdit) {
        this.connectionTested = false;
        this.form.projectName = '';
        this.testResult       = null;
      }
    },
  },

  methods: {
    populateFromExisting() {
      const data = this.existing.data || {};
      const decode = (k) => (data[k] ? atob(data[k]) : '');
      // Derive projectName from namespace by stripping the "cso-" prefix
      const ns = this.existing.metadata.namespace || '';
      this.form.projectName = ns.startsWith('cso-') ? ns.slice(4) : decode('projectName');

      if (data['clouds.yaml']) {
        this.yamlContent = decode('clouds.yaml');
      }

      // Pre-select the current Rancher project
      this.selectedProjectId = this.existingProjectId;

      // Treat a previously saved credential as already verified
      this.connectionTested = true;
    },

    async testConnection() {
      this.testing          = true;
      this.testResult       = null;
      this.connectionTested = false;

      try {
        const api = this.buildApiService();
        await api.getToken();
        this.testResult       = { success: true };
        this.connectionTested = true;
        // Project name is populated by the service after a successful token request
        const projectName = api.getProjectName();
        if (projectName) {
          this.form.projectName = projectName;
        }
      } catch (e) {
        // Rancher's store throws an HTTP response object, not a plain Error.
        // Try common paths before falling back to String(e).
        const errMsg = e?.data?.message
          || e?.data?.error_description
          || e?.data?.error
          || e?.message
          || (e?.status ? `HTTP ${e.status} ${e.statusText || ''}`.trim() : null)
          || String(e);
        this.testResult = { success: false, error: errMsg };
      } finally {
        this.testing = false;
      }
    },

    buildApiService() {
      return new OpenStackApiService(this.yamlContent, this.$store);
    },

    onFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.yamlContent = e.target.result;
        // Reset input so the same file can be re-selected
        this.$refs.yamlFileInput.value = '';
      };
      reader.readAsText(file);
    },

    async save() {
      this.saving = true;

      try {
        const secretData = this.buildSecretData();

        if (this.isEdit) {
          // Update existing secret in the existing namespace
          await this.$store.dispatch('management/request', {
            method:  'PUT',
            url:     `/api/v1/namespaces/${this.existing.metadata.namespace}/secrets/openstack`,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(secretData),
          });

          // Move namespace to a different Rancher project if the selection changed
          if (this.selectedProjectId && this.selectedProjectId !== this.existingProjectId) {
            await this.$store.dispatch('management/request', {
              method:  'PATCH',
              url:     `/api/v1/namespaces/${this.existing.metadata.namespace}`,
              headers: { 'Content-Type': 'application/merge-patch+json' },
              data:    JSON.stringify({
                metadata: {
                  annotations: { 'field.cattle.io/projectId': this.selectedProjectId },
                },
              }),
            });
          }
        } else {
          // Ensure the cso-{projectName} namespace exists, create it if not
          await this.ensureNamespace(this.targetNamespace);

          // Create the secret named "openstack" in the new namespace
          await this.$store.dispatch('management/request', {
            method:  'POST',
            url:     `/api/v1/namespaces/${this.targetNamespace}/secrets`,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(secretData),
          });
        }

        this.$emit('save');
      } catch (e) {
        console.error('Failed to save credentials:', e); // eslint-disable-line no-console
      } finally {
        this.saving = false;
      }
    },

    async ensureNamespace(name) {
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${name}`,
        });
      } catch {
        // Namespace does not exist – create it
        const metadata = { name };
        if (this.selectedProjectId) {
          metadata.annotations = { 'field.cattle.io/projectId': this.selectedProjectId };
        }
        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     '/api/v1/namespaces',
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify({
            apiVersion: 'v1',
            kind:       'Namespace',
            metadata,
          }),
        });
      }
    },

    buildSecretData() {
      const encode = (v) => btoa(v || '');
      const metadata = {
        name:      'openstack',
        namespace: this.isEdit ? this.existing.metadata.namespace : this.targetNamespace,
      };

      // resourceVersion is required by the Kubernetes API for PUT requests (optimistic concurrency).
      if (this.isEdit && this.existing.metadata?.resourceVersion) {
        metadata.resourceVersion = this.existing.metadata.resourceVersion;
      }

      return {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata,
        type: 'Opaque',
        data: {
          projectName:   encode(this.form.projectName),
          'clouds.yaml': encode(this.yamlContent),
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
.project-select {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--body-text);
}

.credential-form {
  max-width: 700px;
}

.namespace-hint {
  margin-top: 4px;
  font-size: 0.85em;
  color: var(--muted);

  code {
    font-family: monospace;
    background: var(--accent-btn);
    padding: 1px 4px;
    border-radius: 3px;
  }
}

.form-row {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.yaml-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.9em;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  background: var(--input-bg);
  color: var(--body-text);
  resize: vertical;
}

.yaml-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;

  .form-label {
    margin-bottom: 0;
    flex: 1;
  }
}

.project-name-detected {
  margin-top: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.banner {
  padding: 10px 14px;
  border-radius: 4px;
  margin-top: 12px;
  margin-bottom: 4px;
  font-size: 0.9em;
  word-break: break-word;

  &.banner-success {
    background: var(--success-banner-bg, #dff6dd);
    border: 1px solid var(--success, #3d8a3f);
    color: var(--success, #1e4620);
  }

  &.banner-error {
    background: var(--error-banner-bg, #fde8e8);
    border: 1px solid var(--error, #c9302c);
    color: var(--error, #7f1d1d);
  }
}
</style>
