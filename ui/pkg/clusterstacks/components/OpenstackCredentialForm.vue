<template>
  <div class="credential-form">
    <!-- Manual form -->
    <div v-if="!showYaml" class="manual-form">
      <div class="form-row">
        <LabeledInput
          v-model="form.authUrl"
          :label="t('clusterstacks.credentialCreate.authUrl')"
          :placeholder="t('clusterstacks.credentialCreate.authUrlPlaceholder')"
          :required="true"
        />
      </div>
      <div class="form-row two-col">
        <LabeledInput
          v-model="form.domainName"
          :label="t('clusterstacks.credentialCreate.domainName')"
          :placeholder="t('clusterstacks.credentialCreate.domainNamePlaceholder')"
        />
        <LabeledInput
          v-model="form.regionName"
          :label="t('clusterstacks.credentialCreate.region')"
          :placeholder="t('clusterstacks.credentialCreate.regionPlaceholder')"
        />
      </div>
      <div class="form-row two-col">
        <LabeledInput
          v-model="form.username"
          :label="t('clusterstacks.credentialCreate.username')"
          :placeholder="t('clusterstacks.credentialCreate.usernamePlaceholder')"
        />
        <LabeledInput
          v-model="form.password"
          :label="t('clusterstacks.credentialCreate.password')"
          :placeholder="t('clusterstacks.credentialCreate.passwordPlaceholder')"
          type="password"
        />
      </div>
    </div>

    <!-- YAML paste alternative (toggle hidden when editing) -->
    <div v-if="!isEdit" class="yaml-toggle">
      <button class="btn btn-sm role-link" @click="showYaml = !showYaml">
        {{ showYaml ? t('clusterstacks.credentialCreate.useFormInstead') : t('clusterstacks.credentialCreate.cloudYaml') }}
      </button>
    </div>

    <div v-if="showYaml" class="form-row">
      <label class="form-label">{{ t('clusterstacks.credentialCreate.cloudYaml') }}</label>
      <div class="yaml-upload-row">
        <label class="btn btn-sm role-secondary yaml-upload-btn">
          {{ t('clusterstacks.credentialCreate.uploadFile') }}
          <input
            ref="fileInput"
            type="file"
            accept=".yaml,.yml"
            class="file-input-hidden"
            @change="handleFileUpload"
          />
        </label>
        <span v-if="uploadedFileName" class="uploaded-file-name">{{ uploadedFileName }}</span>
      </div>
      <textarea
        v-model="yamlContent"
        class="yaml-textarea"
        :placeholder="t('clusterstacks.credentialCreate.cloudYamlPlaceholder')"
        rows="15"
      />
      <div v-if="yamlError" class="banner banner-error">{{ yamlError }}</div>
    </div>

    <!-- Connection test result -->
    <div v-if="testResult" class="banner" :class="testResult.success ? 'banner-success' : 'banner-error'">
      {{ testResult.success
        ? t('clusterstacks.credentialCreate.testSuccess')
        : `${t('clusterstacks.credentialCreate.testError')}: ${testResult.error}` }}
    </div>

    <!-- Project name (shown in both modes, appears after successful connection test or when editing) -->
    <div v-if="connectionVerified" class="form-row project-name-section">
      <LabeledInput
        v-model="form.projectName"
        :label="t('clusterstacks.credentialCreate.projectName')"
        :placeholder="t('clusterstacks.credentialCreate.projectNamePlaceholder')"
        :required="true"
        :disabled="isEdit"
      />
      <div class="namespace-hint">
        {{ t('clusterstacks.credentialCreate.namespaceHint') }}: <code>cso-{{ form.projectName || '…' }}</code>
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn role-secondary" @click="$emit('cancel')">
        {{ t('clusterstacks.credentialCreate.cancel') }}
      </button>
      <BusyButton :busy="testing" class="btn role-secondary" @click="testConnection">
        {{ t('clusterstacks.credentialCreate.testConnection') }}
      </BusyButton>
      <BusyButton v-if="connectionVerified" :busy="saving" :disabled="!canSave" class="btn role-primary" @click="save">
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
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      showYaml:         false,
      yamlContent:      '',
      yamlError:        null,
      uploadedFileName: '',

      form: {
        projectName: '',
        authUrl:     '',
        domainName:  'Default',
        username:    '',
        password:    '',
        regionName:  '',
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

    // Connection is verified when test succeeded or when editing existing credentials
    connectionVerified() {
      return this.isEdit || (this.testResult && this.testResult.success);
    },

    canSave() {
      if (!this.connectionVerified) {
        return false;
      }
      if (this.showYaml) {
        return !!(this.yamlContent && this.form.projectName);
      }
      return !!(this.form.projectName && this.form.authUrl);
    },
  },

  watch: {
    existing(newVal) {
      if (newVal) {
        this.populateFromExisting();
      }
    },
  },

  mounted() {
    if (this.existing) {
      this.populateFromExisting();
    }
  },

  methods: {
    populateFromExisting() {
      const data = this.existing.data || {};
      const decode = (k) => data[k] ? atob(data[k]) : '';
      // Derive projectName from namespace by stripping the "cso-" prefix
      const ns = this.existing.metadata.namespace || '';
      this.form.projectName = ns.startsWith('cso-') ? ns.slice(4) : decode('projectName');
      this.form.authUrl     = decode('authUrl');
      this.form.domainName  = decode('domainName');
      this.form.username    = decode('username');
      this.form.regionName  = decode('regionName');
      // Don't pre-fill password for security

      // If the secret contains a cloudYaml entry, switch to YAML mode
      const cloudYaml = decode('cloudYaml');
      if (cloudYaml) {
        this.showYaml    = true;
        this.yamlContent = cloudYaml;
      }
    },

    async testConnection() {
      this.testing    = true;
      this.testResult = null;

      try {
        const api = this.buildApiService();
        await api.getToken();
        this.testResult = { success: true };

        // Auto-fill project name from API response or parsed YAML
        const apiProjectName = api.getCurrentProjectName();
        if (apiProjectName && !this.form.projectName) {
          this.form.projectName = apiProjectName;
        } else if (this.showYaml && !this.form.projectName) {
          const cfg = this.parseCloudYaml();
          if (cfg.projectName) {
            this.form.projectName = cfg.projectName;
          }
        }
      } catch (e) {
        this.testResult = { success: false, error: e?.message || String(e) };
      } finally {
        this.testing = false;
      }
    },

    buildApiService() {
      if (this.showYaml) {
        // Parse cloud.yaml
        const config = this.parseCloudYaml();
        return new OpenStackApiService(config, this.$store);
      }
      return new OpenStackApiService({
        authUrl:     this.form.authUrl,
        username:    this.form.username,
        password:    this.form.password,
        projectName: this.form.projectName,
        domainName:  this.form.domainName,
        regionName:  this.form.regionName,
      }, this.$store);
    },

    parseCloudYaml() {
      // Basic clouds.yaml extraction (first cloud entry)
      try {
        // Dynamic import of js-yaml would normally be used here
        // For a draft we do a minimal extraction
        const lines = this.yamlContent.split('\n');
        const cfg = {
          authUrl:     '',
          username:    '',
          password:    '',
          projectName: '',
          domainName:  'Default',
          regionName:  '',
        };

        for (const line of lines) {
          const [k, ...rest] = line.trim().split(':');
          const v = rest.join(':').trim();
          if (k === 'auth_url')          { cfg.authUrl     = v; }
          if (k === 'username')          { cfg.username    = v; }
          if (k === 'password')          { cfg.password    = v; }
          if (k === 'project_name')      { cfg.projectName = v; }
          if (k === 'user_domain_name')  { cfg.domainName  = v; }
          if (k === 'region_name')       { cfg.regionName  = v; }
        }

        return cfg;
      } catch {
        this.yamlError = this.t('clusterstacks.errors.invalidYaml');
        throw new Error('Invalid YAML');
      }
    },

    handleFileUpload(event) {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      this.uploadedFileName = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        this.yamlContent = typeof result === 'string' ? result : '';
      };
      reader.onerror = () => {
        this.yamlError = this.t('clusterstacks.errors.invalidYaml');
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
        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     '/api/v1/namespaces',
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify({
            apiVersion: 'v1',
            kind:       'Namespace',
            metadata:   { name },
          }),
        });
      }
    },

    buildSecretData() {
      const encode = (v) => btoa(v || '');

      return {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata:   {
          name:      'openstack',
          namespace: this.isEdit ? this.existing.metadata.namespace : this.targetNamespace,
        },
        type: 'Opaque',
        data: {
          authUrl:     encode(this.form.authUrl),
          username:    encode(this.form.username),
          password:    encode(this.form.password),
          projectName: encode(this.form.projectName),
          domainName:  encode(this.form.domainName),
          regionName:  encode(this.form.regionName),
          ...(this.showYaml ? { cloudYaml: encode(this.yamlContent) } : {}),
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

  &.two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
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

.yaml-toggle {
  margin-bottom: 12px;
}

.yaml-upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.yaml-upload-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.file-input-hidden {
  display: none;
}

.uploaded-file-name {
  font-size: 0.85em;
  color: var(--muted);
  font-style: italic;
}

.project-name-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
