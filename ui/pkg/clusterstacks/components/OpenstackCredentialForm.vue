<template>
  <div class="credential-form">
    <!-- Manual form -->
    <div v-if="!showYaml" class="manual-form">
      <div class="form-row">
        <LabeledInput
          v-model="form.name"
          :label="t('clusterstacks.credentialCreate.name')"
          :placeholder="t('clusterstacks.credentialCreate.namePlaceholder')"
          :required="true"
          :disabled="isEdit"
        />
      </div>
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
      <div class="form-row">
        <LabeledInput
          v-model="form.projectName"
          :label="t('clusterstacks.credentialCreate.projectName')"
          :placeholder="t('clusterstacks.credentialCreate.projectNamePlaceholder')"
        />
      </div>
    </div>

    <!-- YAML paste alternative -->
    <div class="yaml-toggle">
      <button class="btn btn-sm role-link" @click="showYaml = !showYaml">
        {{ showYaml ? 'Use form instead' : t('clusterstacks.credentialCreate.cloudYaml') }}
      </button>
    </div>

    <div v-if="showYaml" class="form-row">
      <label class="form-label">{{ t('clusterstacks.credentialCreate.cloudYaml') }}</label>
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

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn role-secondary" @click="$emit('cancel')">
        {{ t('clusterstacks.credentialCreate.cancel') }}
      </button>
      <BusyButton :busy="testing" class="btn role-secondary" @click="testConnection">
        {{ t('clusterstacks.credentialCreate.testConnection') }}
      </BusyButton>
      <BusyButton :busy="saving" :disabled="!canSave" class="btn role-primary" @click="save">
        {{ t('clusterstacks.credentialCreate.save') }}
      </BusyButton>
    </div>
  </div>
</template>

<script>
import LabeledInput from '@shell/components/form/LabeledInput';
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
      showYaml:    false,
      yamlContent: '',
      yamlError:   null,

      form: {
        name:        '',
        authUrl:     '',
        domainName:  'Default',
        username:    '',
        password:    '',
        projectName: '',
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

    canSave() {
      if (this.showYaml) {
        return !!this.yamlContent;
      }
      return !!(this.form.name && this.form.authUrl);
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
      this.form.name        = this.existing.metadata.name;
      this.form.authUrl     = decode('authUrl');
      this.form.domainName  = decode('domainName');
      this.form.username    = decode('username');
      this.form.projectName = decode('projectName');
      this.form.regionName  = decode('regionName');
      // Don't pre-fill password for security
    },

    async testConnection() {
      this.testing    = true;
      this.testResult = null;

      try {
        const api = this.buildApiService();
        await api.getToken();
        this.testResult = { success: true };
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

    async save() {
      this.saving = true;

      try {
        const secretData = this.buildSecretData();
        const method  = this.isEdit ? 'PUT' : 'POST';
        const url     = this.isEdit
          ? `/api/v1/namespaces/${this.existing.metadata.namespace}/secrets/${this.form.name}`
          : `/api/v1/namespaces/default/secrets`;

        await this.$store.dispatch('management/request', {
          method,
          url,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(secretData),
        });

        this.$emit('save');
      } catch (e) {
        console.error('Failed to save credentials:', e); // eslint-disable-line no-console
      } finally {
        this.saving = false;
      }
    },

    buildSecretData() {
      const encode = (v) => btoa(v || '');

      return {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata:   {
          name: this.form.name,
          labels: {
            'clusterstack.x-k8s.io/credential': 'openstack',
          },
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

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
