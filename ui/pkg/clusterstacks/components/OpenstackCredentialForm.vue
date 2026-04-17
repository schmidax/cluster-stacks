<template>
  <div class="credential-form">
    <!-- clouds.yaml paste / upload -->
    <div class="form-row">
      <div class="yaml-header">
        <label class="form-label">{{ t('clusterstacks.credentialCreate.cloudYaml') }}</label>
        <button class="btn btn-sm role-secondary" type="button" @click="$refs.yamlFileInput.click()">
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
          v-model:value="form.projectName"
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

    <!-- Save error -->
    <div v-if="saveError" class="banner banner-error">
      <strong>Save failed:</strong> {{ saveError }}
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button class="btn role-secondary" @click="$emit('cancel')">
        {{ t('clusterstacks.credentialCreate.cancel') }}
      </button>
      <button
        class="btn role-secondary"
        :disabled="testingConnection || !yamlContent"
        @click="testConnectionAction"
      >
        <i v-if="testingConnection" class="icon icon-spinner icon-spin" />
        {{ t('clusterstacks.credentialCreate.testConnection') }}
      </button>
      <AsyncButton
        v-if="connectionTested || isEdit"
        :disabled="!canSave"
        :action-label="t('clusterstacks.credentialCreate.save')"
        @click="saveAction"
      />
    </div>
  </div>
</template>

<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton';
import { OpenStackApiService, parseCloudsYaml } from '../services/openstack-api';
import { hostnameFromAuthUrl, ensureProxyEndpoint } from '../services/proxy-endpoint';
import jsyaml from 'js-yaml';

export default {
  name: 'OpenstackCredentialForm',

  components: { LabeledInput, AsyncButton },

  props: {
    existing: {
      type:    Object,
      default: null,
    },

    // The Rancher project ID (e.g. "local:p-xxxxx") to assign the credential namespace to.
    // Passed from the overview page or from the route query on create.
    projectId: {
      type:    String,
      default: '',
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      yamlContent:      '',
      yamlError:        null,
      connectionTested: false,
      testingConnection: false,
      saveError:        null,

      form: {
        projectName: '',
      },

      testResult: null,
    };
  },

  computed: {
    isEdit() {
      return !!this.existing;
    },

    targetNamespace() {
      return `cso-${this.form.projectName}`;
    },

    canSave() {
      return !!(this.yamlContent && this.form.projectName);
    },
  },

  watch: {
    existing: {
      immediate: true,
      handler(val) {
        if (val) {
          this.populateFromExisting();
        }
      },
    },

    yamlContent() {
      if (!this.isEdit) {
        this.connectionTested = false;
        this.form.projectName = '';
        this.testResult       = null;
      }
    },
  },

  methods: {
    async testConnectionAction() {
      this.testingConnection = true;

      try {
        await this.testConnection();
      } catch {
        // error is shown via testResult
      } finally {
        this.testingConnection = false;
      }
    },

    async saveAction(buttonDone) {
      this.saveError = null;

      try {
        await this.save();
        buttonDone?.(true);
      } catch (e) {
        const msg = e?.data?.message || e?.message || String(e);
        const status = e?.status || e?.data?.code || '';

        this.saveError = status ? `HTTP ${ status }: ${ msg }` : msg;
        buttonDone?.(false);
      }
    },

    populateFromExisting() {
      const data = this.existing.data || {};
      const decode = (k) => (data[k] ? atob(data[k]) : '');
      const ns = this.existing.metadata.namespace || '';

      this.form.projectName = ns.startsWith('cso-') ? ns.slice(4) : decode('projectName');

      if (data['clouds.yaml']) {
        this.yamlContent = decode('clouds.yaml');
      }

      this.connectionTested = true;
    },

    async testConnection() {
      this.testResult       = null;
      this.connectionTested = false;

      try {
        // Ensure the OpenStack hostname is in Rancher's /meta/proxy allowlist
        try {
          const parsed   = parseCloudsYaml(this.yamlContent);
          const hostname = hostnameFromAuthUrl(parsed.authUrl);

          if (hostname) {
            await ensureProxyEndpoint(hostname, this.$store);
          }
        } catch {
          // YAML parse errors will surface again in api.getToken() below
        }

        const api = this.buildApiService();

        await api.getToken();
        this.testResult       = { success: true };
        this.connectionTested = true;

        const projectName = api.getProjectName();

        if (projectName) {
          this.form.projectName = projectName;
        }
      } catch (e) {
        const errMsg = e?.data?.message
          || e?.data?.error_description
          || e?.data?.error
          || e?.message
          || (e?.status ? `HTTP ${e.status} ${e.statusText || ''}`.trim() : null)
          || String(e);

        this.testResult = { success: false, error: errMsg };
      }
    },

    buildApiService() {
      return new OpenStackApiService(this.yamlContent, this.$store);
    },

    onFileUpload(event) {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        this.yamlContent = String(e?.target?.result || '');

        if (this.$refs.yamlFileInput) {
          this.$refs.yamlFileInput.value = '';
        }
      };
      reader.readAsText(file);
    },

    async save() {
      const log = (step, detail) => console.info(`[credential-save] ${ step }`, detail || ''); // eslint-disable-line no-console

      try {
        const secretData = this.buildSecretData();

        log('resolveEffectiveProjectId', `projectId prop = "${ this.projectId }"`);
        const effectiveProjectId = await this.resolveEffectiveProjectId();
        log('resolveEffectiveProjectId → result', effectiveProjectId || '(empty)');

        if (this.isEdit) {
          const namespace = this.existing.metadata.namespace;

          log('edit: assertNamespaceProjectConsistency', namespace);
          await this.assertNamespaceProjectConsistency(namespace, effectiveProjectId);

          log('edit: PUT openstack secret', namespace);
          await this.$store.dispatch('management/request', {
            method:  'PUT',
            url:     `/api/v1/namespaces/${namespace}/secrets/openstack`,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(secretData),
          });

          log('edit: upsertCloudsYamlResourceSetSecret', namespace);
          await this.upsertCloudsYamlResourceSetSecret(namespace);
          log('edit: upsertCloudsYamlClusterResourceSet', namespace);
          await this.upsertCloudsYamlClusterResourceSet(namespace);
        } else {
          const namespace = this.targetNamespace;
          log('create: targetNamespace', namespace);

          if (!effectiveProjectId) {
            throw new Error(`No target Rancher project assigned for this credential. projectId prop = "${ this.projectId }", namespace = "${ namespace }"`);
          }

          log('create: ensureNamespace', `${ namespace } → project ${ effectiveProjectId }`);
          await this.ensureNamespace(namespace, effectiveProjectId);
          log('create: ensureNamespace OK');

          log('create: POST openstack secret', namespace);
          await this.$store.dispatch('management/request', {
            method:  'POST',
            url:     `/api/v1/namespaces/${namespace}/secrets`,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(secretData),
          });
          log('create: POST openstack secret OK');

          log('create: upsertCloudsYamlResourceSetSecret', namespace);
          await this.upsertCloudsYamlResourceSetSecret(namespace);
          log('create: upsertCloudsYamlResourceSetSecret OK');

          log('create: upsertCloudsYamlClusterResourceSet', namespace);
          await this.upsertCloudsYamlClusterResourceSet(namespace);
          log('create: upsertCloudsYamlClusterResourceSet OK');
        }

        log('save complete ✓');
        this.$emit('save');
      } catch (e) {
        console.error('[credential-save] FAILED:', e?.status || '', e?.data?.message || e?.message || e); // eslint-disable-line no-console
        throw e;
      }
    },

    async resolveEffectiveProjectId() {
      if (this.projectId) {
        return this.projectId;
      }

      const namespace = this.targetNamespace;

      try {
        const existingNamespace = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${ namespace }`,
        });
        const namespaceProjectId = existingNamespace?.metadata?.annotations?.['field.cattle.io/projectId'] || '';

        if (namespaceProjectId) {
          return namespaceProjectId;
        }
      } catch {
        // Namespace may not exist yet.
      }

      return '';
    },

    async ensureNamespace(name, projectId = this.projectId) {
      try {
        const existingNamespace = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${name}`,
        });

        if (projectId) {
          const existingProjectId = existingNamespace?.metadata?.annotations?.['field.cattle.io/projectId'] || '';

          if (existingProjectId && existingProjectId !== projectId) {
            throw new Error('Namespace is already bound to another Rancher project.');
          }
        }

        return;
      } catch (err) {
        // Rancher's management/request may return the Kubernetes Status object
        // with err.status = "Failure" (string) instead of the HTTP status code.
        // Check multiple fields to reliably detect a 404.
        const httpCode = Number(err?.status) || Number(err?.data?.code) || 0;
        const reason = String(err?.data?.reason || '').toLowerCase();
        const message = String(err?.data?.message || err?.message || '').toLowerCase();
        const is404 = httpCode === 404
          || reason === 'notfound'
          || message.includes('not found');

        if (!is404) {
          throw err;
        }
      }

      if (!projectId) {
        throw new Error('Cannot create namespace without a Rancher project assignment.');
      }

      const metadata = {
        name,
        labels: {
          'cluster-api.cattle.io/rancher-auto-import': 'true',
        },
      };

      if (projectId) {
        metadata.annotations = { 'field.cattle.io/projectId': projectId };
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

      // Create a FleetWorkspace matching this namespace so that Rancher
      // places the provisioning.cattle.io Cluster (and its resources like
      // kubeconfig) in this namespace rather than in "default".
      // See: https://github.com/rancher/rancher/issues/50962
      await this.ensureFleetWorkspace(name);
    },

    async ensureFleetWorkspace(name) {
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/v1/management.cattle.io.fleetworkspaces/${ name }`,
        });

        // Already exists
        return;
      } catch {
        // Does not exist – create it
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
        // Non-admin users may not have permission to create FleetWorkspaces.
        // This is not fatal – the cluster will still work, just land in 'default'.
        console.warn(`[ensureFleetWorkspace] Could not create FleetWorkspace "${ name }":`, e?.message || e); // eslint-disable-line no-console
      }
    },

    async assertNamespaceProjectConsistency(namespace, projectId = this.projectId) {
      if (!namespace) {
        throw new Error('Missing namespace for credential update.');
      }

      if (!projectId) {
        return;
      }

      const ns = await this.$store.dispatch('management/request', {
        method: 'GET',
        url:    `/api/v1/namespaces/${ namespace }`,
      });
      const existingProjectId = ns?.metadata?.annotations?.['field.cattle.io/projectId'] || '';

      if (existingProjectId && existingProjectId !== projectId) {
        throw new Error('Credential namespace belongs to a different Rancher project.');
      }
    },

    buildSecretData() {
      const encode = (v) => btoa(v || '');
      const metadata = {
        name:      'openstack',
        namespace: this.isEdit ? this.existing.metadata.namespace : this.targetNamespace,
      };

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

    buildCloudsYamlBootstrapSecretYaml() {
      const secretObj = {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata:   {
          name:      'clouds-yaml',
          namespace: 'kube-system',
        },
        type: 'Opaque',
        data: {
          'clouds.yaml': btoa(this.yamlContent || ''),
        },
      };

      return jsyaml.dump(secretObj, { indent: 2, lineWidth: -1, noRefs: true }).trimEnd();
    },

    buildCloudsYamlResourceSetSecret(namespace, resourceVersion) {
      const manifestYaml = this.buildCloudsYamlBootstrapSecretYaml();
      const metadata = {
        name: 'clouds-yaml',
        namespace,
      };

      if (resourceVersion) {
        metadata.resourceVersion = resourceVersion;
      }

      return {
        apiVersion: 'v1',
        kind:       'Secret',
        metadata,
        type: 'addons.cluster.x-k8s.io/resource-set',
        data: {
          'clouds-yaml-secret': btoa(manifestYaml),
        },
      };
    },

    async upsertCloudsYamlResourceSetSecret(namespace) {
      const createPayload = this.buildCloudsYamlResourceSetSecret(namespace);

      try {
        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     `/api/v1/namespaces/${ namespace }/secrets`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(createPayload),
        });
      } catch {
        let rv = '';

        try {
          const existing = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/api/v1/namespaces/${ namespace }/secrets/clouds-yaml`,
          });

          rv = existing?.metadata?.resourceVersion || '';
        } catch {
          rv = '';
        }

        const updatePayload = this.buildCloudsYamlResourceSetSecret(namespace, rv);

        await this.$store.dispatch('management/request', {
          method:  'PUT',
          url:     `/api/v1/namespaces/${ namespace }/secrets/clouds-yaml`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(updatePayload),
        });
      }
    },

    buildCloudsYamlClusterResourceSet(namespace, apiVersion, resourceVersion) {
      const metadata = {
        name: 'clouds-yaml',
        namespace,
      };

      if (resourceVersion) {
        metadata.resourceVersion = resourceVersion;
      }

      return {
        apiVersion,
        kind:       'ClusterResourceSet',
        metadata,
        spec: {
          strategy: 'Reconcile',
          clusterSelector: {
            matchLabels: {
              'managed-secret': 'clouds-yaml',
            },
          },
          resources: [
            {
              name: 'clouds-yaml',
              kind: 'Secret',
            },
          ],
        },
      };
    },

    isAlreadyExistsError(err) {
      const httpCode = Number(err?.status) || Number(err?.data?.code) || 0;
      const reason = err?.data?.reason || '';
      const message = err?.data?.message || err?.message || '';

      return httpCode === 409 || /alreadyexists/i.test(reason) || /already exists/i.test(message);
    },

    isApiVersionNotServedError(err) {
      const httpCode = Number(err?.status) || Number(err?.data?.code) || 0;
      const message = err?.data?.message || err?.message || '';
      const reason = err?.data?.reason || '';

      // Rancher's Steve proxy may return err.status = "Failure" (string) instead
      // of the numeric HTTP code. Also check reason and message for "not found".
      const is404 = httpCode === 404
        || /notfound/i.test(reason)
        || (/not found/i.test(message) && httpCode === 0);

      if (!is404) {
        return false;
      }

      // Kubernetes returns "the server could not find the requested resource"
      // but Rancher's Steve proxy may return different wording.
      return /not found|could not find|no matches/i.test(message)
        || /notfound/i.test(reason)
        || !message; // bare 404 without message body — treat as "not served"
    },

    async upsertCloudsYamlClusterResourceSet(namespace) {
      const candidateVersions = ['v1beta2', 'v1beta1', 'v1alpha4'];
      let lastErr;

      for (const version of candidateVersions) {
        const apiVersion = `addons.cluster.x-k8s.io/${ version }`;
        const baseUrl = `/apis/${ apiVersion }/namespaces/${ namespace }/clusterresourcesets`;
        const createPayload = this.buildCloudsYamlClusterResourceSet(namespace, apiVersion);

        try {
          await this.$store.dispatch('management/request', {
            method:  'POST',
            url:     baseUrl,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(createPayload),
          });

          console.info(`[credential-save] ClusterResourceSet created (${ version })`); // eslint-disable-line no-console

          return;
        } catch (err) {
          lastErr = err;
          const errStatus = err?.status || err?.data?.code || '';
          const errMsg = err?.data?.message || err?.message || '';

          console.info(`[credential-save] ClusterResourceSet ${ version } POST failed: ${ errStatus } ${ errMsg }`); // eslint-disable-line no-console

          if (this.isApiVersionNotServedError(err)) {
            console.info(`[credential-save] API version ${ version } not served, trying next`); // eslint-disable-line no-console
            continue;
          }

          if (!this.isAlreadyExistsError(err)) {
            throw err;
          }

          const existing = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `${ baseUrl }/clouds-yaml`,
          });
          const rv = existing?.metadata?.resourceVersion || '';
          const updatePayload = this.buildCloudsYamlClusterResourceSet(namespace, apiVersion, rv);

          await this.$store.dispatch('management/request', {
            method:  'PUT',
            url:     `${ baseUrl }/clouds-yaml`,
            headers: { 'Content-Type': 'application/json' },
            data:    JSON.stringify(updatePayload),
          });

          return;
        }
      }

      throw lastErr || new Error('No supported ClusterResourceSet API version found');
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
