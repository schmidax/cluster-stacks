<template>
  <div class="cso-management-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.cso.title') }}</h1>
      <button class="btn role-secondary" @click="load">
        <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <template v-else>
      <!-- ─── INSTALLED VIEW ─────────────────────────────────────────── -->
      <template v-if="isInstalled">
        <!-- Status banner -->
        <div class="status-banner">
          <i class="icon icon-checkmark" />
          {{ t('clusterstacks.cso.installed') }}
          <span v-if="appVersion" class="version-tag">{{ appVersion }}</span>
        </div>

        <!-- Global error -->
        <div v-if="saveError" class="banner banner-error mt-10">
          {{ saveError }}
        </div>
        <div v-if="saveSuccess" class="banner banner-info mt-10">
          {{ saveSuccess }}
        </div>

        <!-- ─── Configuration ──────────────────────────────────────────── -->
        <div class="section">
          <h2 class="section-title">{{ t('clusterstacks.cso.configuration') }}</h2>

          <!-- Provider toggle -->
          <div class="provider-toggle">
            <span class="toggle-label">{{ t('clusterstacks.cso.providerLabel') }}</span>
            <button
              class="btn btn-sm"
              :class="provider === 'oci' ? 'role-primary' : 'role-secondary'"
              @click="switchProvider('oci')"
            >
              OCI
            </button>
            <button
              class="btn btn-sm"
              :class="provider === 'git' ? 'role-primary' : 'role-secondary'"
              @click="switchProvider('git')"
            >
              Git
            </button>
          </div>

          <!-- Switch warning -->
          <div v-if="providerSwitched" class="banner banner-warning mt-10">
            <i class="icon icon-warning" />
            {{ t('clusterstacks.cso.switchWarning') }}
          </div>

          <!-- OCI fields -->
          <div v-if="provider === 'oci'" class="form-grid">
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociRegistry') }}</label>
              <input v-model="form.ociRegistry" type="text" class="form-input" placeholder="registry.scs.community" />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociRepository') }}</label>
              <input v-model="form.ociRepository" type="text" class="form-input" placeholder="SovereignCloudStack/cluster-stacks" />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociUsername') }}</label>
              <input v-model="form.ociUsername" type="text" class="form-input" />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociPassword') }}</label>
              <div class="password-wrapper">
                <input v-model="form.ociPassword" :type="showPasswords.ociPassword ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('ociPassword')">
                  <i :class="showPasswords.ociPassword ? 'icon icon-view' : 'icon icon-hide'" />
                </button>
              </div>
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociAccessToken') }}</label>
              <div class="password-wrapper">
                <input v-model="form.ociAccessToken" :type="showPasswords.ociAccessToken ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('ociAccessToken')">
                  <i :class="showPasswords.ociAccessToken ? 'icon icon-view' : 'icon icon-hide'" />
                </button>
              </div>
            </div>
          </div>

          <!-- Git fields -->
          <div v-if="provider === 'git'" class="form-grid">
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.gitOrgName') }}</label>
              <input v-model="form.gitOrgName" type="text" class="form-input" placeholder="SovereignCloudStack" />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.gitRepoName') }}</label>
              <input v-model="form.gitRepoName" type="text" class="form-input" placeholder="cluster-stacks" />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.gitAccessToken') }}</label>
              <div class="password-wrapper">
                <input v-model="form.gitAccessToken" :type="showPasswords.gitAccessToken ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('gitAccessToken')">
                  <i :class="showPasswords.gitAccessToken ? 'icon icon-view' : 'icon icon-hide'" />
                </button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button
              class="btn role-primary"
              :disabled="saving || !isDirty"
              @click="requestSave"
            >
              <i v-if="saving" class="icon icon-spinner icon-spin" />
              {{ t('clusterstacks.common.save') }}
            </button>
          </div>
        </div>

        <!-- ─── Pods ──────────────────────────────────────────────────── -->
        <div class="section">
          <h2 class="section-title">{{ t('clusterstacks.cso.pods.title') }}</h2>

          <div v-if="pods.length === 0" class="no-data">
            {{ t('clusterstacks.cso.pods.noData') }}
          </div>

          <table v-else class="pods-table">
            <thead>
              <tr>
                <th>{{ t('clusterstacks.cso.pods.name') }}</th>
                <th>{{ t('clusterstacks.cso.pods.status') }}</th>
                <th>{{ t('clusterstacks.cso.pods.ready') }}</th>
                <th>{{ t('clusterstacks.cso.pods.restarts') }}</th>
                <th>{{ t('clusterstacks.cso.pods.age') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pod in pods" :key="pod.metadata.uid">
                <td class="pod-name">{{ pod.metadata.name }}</td>
                <td>
                  <span class="phase-badge" :class="phaseClass(pod)">
                    {{ pod.status.phase || 'Unknown' }}
                  </span>
                </td>
                <td>{{ podReady(pod) }}</td>
                <td>{{ podRestarts(pod) }}</td>
                <td>{{ podAge(pod) }}</td>
                <td>
                  <button class="btn btn-sm role-secondary" @click="openLogs(pod)">
                    {{ t('clusterstacks.cso.pods.viewLogs') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ─── INSTALL VIEW ──────────────────────────────────────────── -->
      <template v-else>
        <div class="install-section">
          <div class="install-header">
            <i class="icon icon-info" />
            <p>{{ t('clusterstacks.cso.notInstalled') }}</p>
          </div>

          <!-- Global error -->
          <div v-if="saveError" class="banner banner-error mt-10">
            {{ saveError }}
          </div>

          <div class="section">
            <h2 class="section-title">{{ t('clusterstacks.cso.install.title') }}</h2>

            <!-- Helm repo -->
            <div class="form-grid">
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.install.helmRepo') }}</label>
                <input
                  v-model="helmRepo"
                  type="text"
                  class="form-input"
                  placeholder="oci://registry.scs.community/cluster-stacks/cso"
                />
                <span class="form-hint">{{ t('clusterstacks.cso.install.helmRepoHint') }}</span>
              </div>
            </div>

            <!-- Provider toggle -->
            <div class="provider-toggle">
              <button
                class="btn btn-sm"
                :class="provider === 'oci' ? 'role-primary' : 'role-secondary'"
                @click="provider = 'oci'"
              >
                OCI
              </button>
              <button
                class="btn btn-sm"
                :class="provider === 'git' ? 'role-primary' : 'role-secondary'"
                @click="provider = 'git'"
              >
                Git
              </button>
            </div>

            <!-- OCI fields -->
            <div v-if="provider === 'oci'" class="form-grid">
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociRegistry') }}</label>
                <input v-model="form.ociRegistry" type="text" class="form-input" placeholder="registry.scs.community" />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociRepository') }}</label>
                <input v-model="form.ociRepository" type="text" class="form-input" placeholder="SovereignCloudStack/cluster-stacks" />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociUsername') }}</label>
                <input v-model="form.ociUsername" type="text" class="form-input" />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociPassword') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.ociPassword" :type="showPasswords.ociPassword ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('ociPassword')">
                    <i :class="showPasswords.ociPassword ? 'icon icon-view' : 'icon icon-hide'" />
                  </button>
                </div>
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociAccessToken') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.ociAccessToken" :type="showPasswords.ociAccessToken ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('ociAccessToken')">
                    <i :class="showPasswords.ociAccessToken ? 'icon icon-view' : 'icon icon-hide'" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Git fields -->
            <div v-if="provider === 'git'" class="form-grid">
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.gitOrgName') }}</label>
                <input v-model="form.gitOrgName" type="text" class="form-input" placeholder="SovereignCloudStack" />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.gitRepoName') }}</label>
                <input v-model="form.gitRepoName" type="text" class="form-input" placeholder="cluster-stacks" />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.gitAccessToken') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.gitAccessToken" :type="showPasswords.gitAccessToken ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('gitAccessToken')">
                    <i :class="showPasswords.gitAccessToken ? 'icon icon-view' : 'icon icon-hide'" />
                  </button>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button class="btn role-primary" :disabled="saving" @click="install">
                <i v-if="saving" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.cso.install.btn') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ─── Save confirmation dialog ─────────────────────────────── -->
    <transition name="dialog-fade">
      <div v-if="showConfirmSave" class="logs-overlay" @mousedown.self="showConfirmSave = false">
        <div class="confirm-dialog">
          <div class="logs-header">
            <span class="logs-title">{{ t('clusterstacks.cso.confirmSave.title') }}</span>
          </div>
          <div class="confirm-body">
            <p>{{ t('clusterstacks.cso.confirmSave.message') }}</p>
            <div v-if="providerSwitched" class="banner banner-warning">
              <i class="icon icon-warning" />
              {{ t('clusterstacks.cso.switchWarning') }}
            </div>
          </div>
          <div class="confirm-actions">
            <button class="btn role-secondary" @click="showConfirmSave = false">
              {{ t('clusterstacks.common.cancel') }}
            </button>
            <button class="btn role-primary" :disabled="saving" @click="saveValues">
              <i v-if="saving" class="icon icon-spinner icon-spin" />
              {{ t('clusterstacks.cso.confirmSave.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
const CSO_NAMESPACE = 'cso-system';
const DEFAULT_HELM_REPO = 'oci://registry.scs.community/cluster-stacks/cso';
const DEFAULT_REPO_NAME = 'cso-charts';

export default {
  name: 'CsoManagement',

  data() {
    return {
      loading: true,

      // Detected resources
      csoApp:     null,
      deployment: null,
      pods:       [],

      // UI state
      provider:         'oci',
      originalProvider: 'oci',
      providerSwitched: false,
      saving:           false,
      saveError:        null,
      saveSuccess:      null,
      showConfirmSave:  false,
      helmRepo:         DEFAULT_HELM_REPO,

      // Form values (OCI + Git fields combined)
      form: {
        // OCI
        ociRegistry:    '',
        ociRepository:  '',
        ociUsername:    '',
        ociPassword:    '',
        ociAccessToken: '',
        // Git
        gitOrgName:     '',
        gitRepoName:    '',
        gitAccessToken: '',
      },

      // Snapshot of form at load time (for dirty tracking)
      originalForm: null,

      // Show/hide state for password fields
      showPasswords: {
        ociPassword:    false,
        ociAccessToken: false,
        gitAccessToken: false,
      },
    };
  },

  computed: {
    isInstalled() {
      return !!this.csoApp || !!this.deployment;
    },

    appVersion() {
      return this.csoApp?.spec?.chart?.metadata?.version
        || this.csoApp?.spec?.info?.chart?.metadata?.version
        || '';
    },

    isDirty() {
      if (!this.originalForm) {
        return true;
      }
      if (this.provider !== this.originalProvider) {
        return true;
      }
      const fields = ['ociRegistry', 'ociRepository', 'ociUsername', 'ociPassword', 'ociAccessToken',
        'gitOrgName', 'gitRepoName', 'gitAccessToken'];

      return fields.some((f) => this.form[f] !== this.originalForm[f]);
    },
  },

  async mounted() {
    await this.load();
  },

  methods: {
    // ─── Data loading ─────────────────────────────────────────────────

    async load() {
      this.loading = true;
      this.saveError = null;
      this.saveSuccess = null;

      try {
        await Promise.all([
          this.detectCso(),
          this.loadPods(),
        ]);
      } finally {
        this.loading = false;
      }
    },

    async detectCso() {
      // 1. Check Rancher catalog apps in cso-system
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/catalog.cattle.io/v1/namespaces/${ CSO_NAMESPACE }/apps`,
        });
        const items = resp?.items || [];
        const app = items.find((a) => {
          const name = a.metadata?.name || '';

          return name === 'cso' || name.includes('cluster-stack-operator');
        });

        if (app) {
          this.csoApp = app;
          // Load user-supplied values from the Helm release secret, which stores
          // the full release object as: base64(base64(gzip(json)))
          const helmValues = await this.loadHelmReleaseValues(app.metadata?.annotations['objectset.rio.cattle.io/owner-name'] || 'cso');

          this.extractValues(helmValues);

          return;
        }
      } catch {}

      // 2. Fallback: check for a deployment in cso-system
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/apps/v1/namespaces/${ CSO_NAMESPACE }/deployments`,
        });

        this.deployment = (resp?.items || [])[0] || null;
      } catch {
        this.deployment = null;
      }
    },

    async loadHelmReleaseValues(releaseName) {
      // Helm 3 stores release history in secrets named sh.helm.release.v1.<name>.v<N>
      // The secret's data.release field is: base64(base64(gzip(releaseJSON)))
      // The releaseJSON.config contains the user-supplied values.
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
		url:    `/api/v1/namespaces/${ CSO_NAMESPACE }/secrets/${releaseName}`,
        });

        const encoded = resp?.data?.release;

        if (!encoded) {
          return {};
        }

        // Step 1: decode k8s-level base64 → Helm-level base64 string
        const helmBase64 = atob(atob(encoded));

        // Step 2: decode Helm-level base64 → gzip bytes
        const gzipBytes = Uint8Array.from(helmBase64, (c) => c.charCodeAt(0));

        // Step 3: decompress gzip → JSON string
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();

        writer.write(gzipBytes);
        writer.close();

        const chunks = [];
        const reader = ds.readable.getReader();

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            break;
          }
          chunks.push(value);
        }

        let totalLen = 0;

        for (const c of chunks) {
          totalLen += c.length;
        }
        const merged = new Uint8Array(totalLen);
        let offset = 0;

        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        const json = new TextDecoder().decode(merged);
        const release = JSON.parse(json);

        // release.config = user-supplied values; release.chart.values = chart defaults
        return release?.config || {};
      } catch {
        return {};
      }
    },

    async loadPods() {
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${ CSO_NAMESPACE }/pods`,
        });

        this.pods = resp?.items || [];
      } catch {
        this.pods = [];
      }
    },

    // ─── Values extraction ────────────────────────────────────────────

    extractValues(values) {
      // values is the Helm values object, e.g. { clusterStackVariables: { gitProvider: 'oci', ... } }
      const cv = values?.clusterStackVariables || {};

      // gitProvider === 'oci' → OCI mode; anything else (github/gitea/gitlab) → Git mode
      const storedGitProvider = cv.gitProvider || 'oci';
      const uiProvider = storedGitProvider === 'oci' ? 'oci' : 'git';

      this.provider = uiProvider;
      this.originalProvider = uiProvider;
      this.providerSwitched = false;

      const newForm = {
        ociRegistry:    cv.ociRegistry    || '',
        ociRepository:  cv.ociRepository  || '',
        ociUsername:    cv.ociUsername     || '',
        ociPassword:    cv.ociPassword     || '',
        ociAccessToken: cv.ociAccessToken  || '',
        gitOrgName:     cv.gitOrgName      || '',
        gitRepoName:    cv.gitRepoName     || '',
        gitAccessToken: cv.gitAccessToken  || '',
      };

      this.form = newForm;
      // Deep copy for dirty tracking
      this.originalForm = { ...newForm };
    },

    // ─── Provider toggle ──────────────────────────────────────────────

    switchProvider(newProvider) {
      if (newProvider === this.provider) {
        return;
      }
      this.provider = newProvider;
      this.providerSwitched = newProvider !== this.originalProvider;
    },

    toggleShowPassword(field) {
      this.showPasswords[field] = !this.showPasswords[field];
    },

    // ─── Save flow ────────────────────────────────────────────────────

    requestSave() {
      this.saveError = null;
      this.saveSuccess = null;
      this.showConfirmSave = true;
    },

    buildValues() {
      const isOci = this.provider === 'oci';

      return {
        clusterStackVariables: {
          gitProvider:    isOci ? 'oci' : 'github',
          gitOrgName:     isOci ? '' : this.form.gitOrgName,
          gitRepoName:    isOci ? '' : this.form.gitRepoName,
          gitAccessToken: isOci ? '' : this.form.gitAccessToken,
          ociRegistry:    isOci ? this.form.ociRegistry : '',
          ociRepository:  isOci ? this.form.ociRepository : '',
          ociUsername:    isOci ? this.form.ociUsername : '',
          ociPassword:    isOci ? this.form.ociPassword : '',
          ociAccessToken: isOci ? this.form.ociAccessToken : '',
        },
      };
    },

    // ─── Install ──────────────────────────────────────────────────────

    async install() {
      this.saving = true;
      this.saveError = null;

      try {
        // 1. Ensure cso-system namespace exists
        await this.ensureNamespace();

        // 2. Ensure ClusterRepo exists
        await this.ensureClusterRepo();

        // 3. Give Rancher a moment to sync the repo index
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 4. Install via Rancher catalog action
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    `/v1/catalog.cattle.io.clusterrepos/${ DEFAULT_REPO_NAME }?action=install`,
          data:   {
            charts: [
              {
                chartName:   'cso',
                version:     '',
                releaseName: 'cso',
                values:      this.buildValues(),
                annotations: {},
              },
            ],
            namespace:                CSO_NAMESPACE,
            disableOpenAPIValidation: false,
            noHooks:                  false,
            timeout:                  '600s',
            wait:                     false,
          },
        });

        await this.load();
      } catch (e) {
        this.saveError = e?.message || this.t('clusterstacks.cso.install.error');
      } finally {
        this.saving = false;
      }
    },

    async ensureNamespace() {
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${ CSO_NAMESPACE }`,
        });
      } catch {
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/api/v1/namespaces',
          data:   {
            apiVersion: 'v1',
            kind:       'Namespace',
            metadata:   { name: CSO_NAMESPACE },
          },
        });
      }
    },

    async ensureClusterRepo() {
      try {
        // Check if repo already exists
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/catalog.cattle.io/v1/clusterrepos/${ DEFAULT_REPO_NAME }`,
        });
      } catch {
        // Create the repo
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/apis/catalog.cattle.io/v1/clusterrepos',
          data:   {
            apiVersion: 'catalog.cattle.io/v1',
            kind:       'ClusterRepo',
            metadata:   { name: DEFAULT_REPO_NAME },
            spec:       { url: this.helmRepo },
          },
        });
      }
    },

    // ─── Save values (update) ─────────────────────────────────────────

    async saveValues() {
      this.showConfirmSave = false;
      this.saving = true;
      this.saveError = null;
      this.saveSuccess = null;

      try {
        if (this.csoApp) {
          // Update via catalog App upgrade action
          const appName = this.csoApp.metadata.name;

          await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    `/v1/catalog.cattle.io.apps/${ CSO_NAMESPACE }/${ appName }?action=upgrade`,
            data:   {
              charts: [
                {
                  chartName:   this.csoApp.spec?.chart?.metadata?.name || 'cso',
                  version:     this.csoApp.spec?.chart?.metadata?.version || '',
                  releaseName: appName,
                  values:      this.buildValues(),
                  annotations: {},
                },
              ],
              namespace: CSO_NAMESPACE,
              timeout:   '600s',
              wait:      false,
            },
          });
        }

        this.saveSuccess = this.t('clusterstacks.cso.saveSuccess');
        await this.load();
      } catch (e) {
        this.saveError = e?.message || this.t('clusterstacks.cso.saveError');
      } finally {
        this.saving = false;
      }
    },

    // ─── Logs ─────────────────────────────────────────────────────────

    openLogs(pod) {
      // Navigate to Rancher's built-in pod log viewer
      const cluster = this.$route.params.cluster || 'local';
      const ns = pod.metadata.namespace || CSO_NAMESPACE;
      const name = pod.metadata.name;

      this.$router.push(`/c/${ cluster }/explorer/pod/${ ns }/${ name }/logs`);
    },

    // ─── Pod helpers ──────────────────────────────────────────────────

    phaseClass(pod) {
      const phase = pod.status?.phase || '';

      return {
        'phase-running':   phase === 'Running',
        'phase-pending':   phase === 'Pending',
        'phase-succeeded': phase === 'Succeeded',
        'phase-failed':    phase === 'Failed',
        'phase-unknown':   !phase || phase === 'Unknown',
      };
    },

    podReady(pod) {
      const containers = pod.status?.containerStatuses || [];

      if (!containers.length) {
        return this.t('clusterstacks.common.na');
      }
      const ready = containers.filter((c) => c.ready).length;

      return `${ ready }/${ containers.length }`;
    },

    podRestarts(pod) {
      const containers = pod.status?.containerStatuses || [];

      return containers.reduce((sum, c) => sum + (c.restartCount || 0), 0);
    },

    podAge(pod) {
      const ts = pod.metadata?.creationTimestamp;

      if (!ts) {
        return this.t('clusterstacks.common.na');
      }
      const ms = Date.now() - new Date(ts).getTime();
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${ days }d`;
      }
      if (hours > 0) {
        return `${ hours }h`;
      }

      return `${ minutes }m`;
    },

    // ─── i18n ─────────────────────────────────────────────────────────

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.cso-management-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.loading-placeholder {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

/* ─── Status banner ───────────────────────────────────────────────── */
.status-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
  background: var(--success-banner-bg, rgba(63, 185, 80, 0.12));
  border: 1px solid var(--success, #3fb950);
  color: var(--success, #3fb950);
  font-weight: 500;
}

.banner-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--error-banner-bg, rgba(185, 28, 28, 0.1));
  border: 1px solid var(--error, #b91c1c);
  color: var(--error, #b91c1c);
}

.banner-info {
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--info-banner-bg, rgba(56, 139, 253, 0.1));
  border: 1px solid var(--info, #388bfd);
  color: var(--info, #388bfd);
}

.banner-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  background: rgba(255, 193, 7, 0.12);
  border: 1px solid var(--warning, #e3b341);
  color: var(--warning, #e3b341);
}

.mt-10 { margin-top: 10px; }

.version-tag {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--success, #3fb950);
  color: #fff;
  font-size: 0.8em;
  font-weight: 600;
}

/* ─── Section layout ──────────────────────────────────────────────── */
.section {
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 20px 24px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 1em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

/* ─── Provider toggle ─────────────────────────────────────────────── */
.provider-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.toggle-label {
  font-size: 0.9em;
  font-weight: 500;
  color: var(--body-text);
  margin-right: 4px;
}

/* ─── Form ────────────────────────────────────────────────────────── */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 520px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-weight: 500;
    font-size: 0.9em;
    color: var(--body-text);
  }
}

.form-input {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
  font-size: 0.95em;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &[type="password"] {
    font-family: monospace;
  }
}

.password-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;

  .form-input {
    flex: 1;
  }

  .password-toggle {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    color: var(--muted);
    line-height: 1;

    &:hover {
      color: var(--body-text);
    }

    .icon {
      font-size: 1.1em;
    }
  }
}

.form-hint {
  font-size: 0.82em;
  color: var(--muted);
}

.form-actions {
  margin-top: 16px;
}

/* ─── Not-installed section ───────────────────────────────────────── */
.install-section {
  .install-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 16px;
    background: var(--info-banner-bg, rgba(56, 139, 253, 0.1));
    border: 1px solid var(--info, #388bfd);
    border-radius: 4px;
    margin-bottom: 20px;
    color: var(--info, #388bfd);

    p {
      margin: 0;
    }
  }
}

/* ─── Pods table ─────────────────────────────────────────────────── */
.no-data {
  padding: 20px;
  text-align: center;
  color: var(--muted);
}

.pods-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    font-size: 0.9em;
    color: var(--body-text);
  }

  th {
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    font-size: 0.8em;
    letter-spacing: 0.04em;
  }

  tbody tr:hover {
    background: var(--input-bg, rgba(255, 255, 255, 0.03));
  }
}

.pod-name {
  font-family: monospace;
  font-size: 0.85em !important;
}

/* ─── Phase badges ───────────────────────────────────────────────── */
.phase-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.82em;
  font-weight: 600;

  &.phase-running   { background: rgba(63, 185, 80, 0.15);  color: var(--success, #3fb950); }
  &.phase-pending   { background: rgba(255, 193, 7, 0.15);  color: var(--warning, #e3b341); }
  &.phase-succeeded { background: rgba(56, 139, 253, 0.15); color: var(--info, #388bfd); }
  &.phase-failed    { background: rgba(185, 28, 28, 0.15);  color: var(--error, #b91c1c); }
  &.phase-unknown   { background: rgba(128, 128, 128, 0.15); color: var(--muted); }
}

/* ─── Modal overlay (used by confirm dialog) ─────────────────────── */
.logs-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.logs-title {
  font-size: 0.9em;
  color: var(--body-text);
  font-weight: 600;
}

/* ─── Confirm dialog ─────────────────────────────────────────────── */
.confirm-dialog {
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 480px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
}

.confirm-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  p {
    margin: 0;
    color: var(--body-text);
    line-height: 1.5;
  }
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

/* ─── Transition ─────────────────────────────────────────────────── */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
