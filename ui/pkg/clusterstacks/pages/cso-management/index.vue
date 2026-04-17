<template>
  <div class="cso-management-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.cso.title') }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <button class="btn role-secondary" @click="load">
            <i class="icon icon-refresh" /> {{ t('clusterstacks.common.refresh') }}
          </button>
        </div>
      </div>
    </header>

    <Banner v-if="hasAdminAccess === false" color="warning" icon="icon-warning" class="mb-20">
      {{ t('clusterstacks.common.permissionDenied') }}
    </Banner>

    <!-- Loading -->
    <div v-else-if="loading" class="loading-placeholder">
      <i class="icon icon-spinner icon-spin" /> {{ t('clusterstacks.common.loading') }}
    </div>

    <template v-else-if="hasAdminAccess">
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
              <LabeledInput
                v-model:value="form.ociRegistry"
                :label="t('clusterstacks.cso.form.ociRegistry')"
                placeholder="registry.scs.community"
              />
            </div>
            <div class="form-row">
              <LabeledInput
                v-model:value="form.ociRepository"
                :label="t('clusterstacks.cso.form.ociRepository')"
                placeholder="SovereignCloudStack/cluster-stacks"
              />
            </div>
            <div class="form-row">
              <LabeledInput
                v-model:value="form.ociUsername"
                :label="t('clusterstacks.cso.form.ociUsername')"
              />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociPassword') }}</label>
              <div class="password-wrapper">
                <input v-model="form.ociPassword" :type="showPasswords.ociPassword ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('ociPassword')">
                  <i :class="showPasswords.ociPassword ? 'icon icon-hide' : 'icon icon-show'" />
                </button>
              </div>
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.ociAccessToken') }}</label>
              <div class="password-wrapper">
                <input v-model="form.ociAccessToken" :type="showPasswords.ociAccessToken ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('ociAccessToken')">
                  <i :class="showPasswords.ociAccessToken ? 'icon icon-hide' : 'icon icon-show'" />
                </button>
              </div>
            </div>
          </div>

          <!-- Git fields -->
          <div v-if="provider === 'git'" class="form-grid">
            <div class="form-row">
              <LabeledInput
                v-model:value="form.gitOrgName"
                :label="t('clusterstacks.cso.form.gitOrgName')"
                placeholder="SovereignCloudStack"
              />
            </div>
            <div class="form-row">
              <LabeledInput
                v-model:value="form.gitRepoName"
                :label="t('clusterstacks.cso.form.gitRepoName')"
                placeholder="cluster-stacks"
              />
            </div>
            <div class="form-row">
              <label>{{ t('clusterstacks.cso.form.gitAccessToken') }}</label>
              <div class="password-wrapper">
                <input v-model="form.gitAccessToken" :type="showPasswords.gitAccessToken ? 'text' : 'password'" class="form-input" />
                <button type="button" class="password-toggle" @click="toggleShowPassword('gitAccessToken')">
                  <i :class="showPasswords.gitAccessToken ? 'icon icon-hide' : 'icon icon-show'" />
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
                    {{ pod.status.phase || t('clusterstacks.cso.unknown') }}
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

        <!-- ─── RBAC / Permissions ──────────────────────────────────── -->
        <div class="section">
          <h2 class="section-title">{{ t('clusterstacks.cso.rbacTitle') }}</h2>

          <!-- CAPI Access RoleTemplate -->
          <div class="rbac-row">
            <div class="rbac-info">
              <span class="rbac-name">{{ t('clusterstacks.cso.capiRbacName') }}</span>
              <span class="rbac-desc">
                {{ t('clusterstacks.cso.capiRbacDesc') }}
              </span>
            </div>
            <div class="rbac-actions">
              <span
                class="phase-badge"
                :class="rbac.capiInstalled ? 'phase-running' : 'phase-unknown'"
              >
                {{ rbac.capiInstalled ? t('clusterstacks.cso.badgeInstalled') : t('clusterstacks.cso.badgeNotInstalled') }}
              </span>
              <button
                v-if="!rbac.capiInstalled"
                class="btn btn-sm role-primary"
                :disabled="rbac.saving"
                @click="installCapiRbac"
              >
                <i v-if="rbac.saving === 'capi-install'" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.cso.installBtn') }}
              </button>
              <button
                v-else
                class="btn btn-sm role-secondary"
                :disabled="rbac.saving"
                @click="uninstallCapiRbac"
              >
                <i v-if="rbac.saving === 'capi-uninstall'" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.cso.removeBtn') }}
              </button>
            </div>
          </div>

          <div class="rbac-row">
            <div class="rbac-info">
              <span class="rbac-name">{{ t('clusterstacks.cso.reconcilerName') }}</span>
              <span class="rbac-desc">
                {{ t('clusterstacks.cso.reconcilerDesc') }}
              </span>
            </div>
            <div class="rbac-actions">
              <span
                class="phase-badge"
                :class="rbac.autoReconcilerInstalled ? 'phase-running' : 'phase-unknown'"
              >
                {{ rbac.autoReconcilerInstalled ? t('clusterstacks.cso.badgeInstalled') : t('clusterstacks.cso.badgeNotInstalled') }}
              </span>
              <button
                v-if="!rbac.autoReconcilerInstalled"
                class="btn btn-sm role-primary"
                :disabled="rbac.saving"
                @click="installAutoReconciler"
              >
                <i v-if="rbac.saving === 'reconciler-install'" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.cso.installBtn') }}
              </button>
              <button
                v-else
                class="btn btn-sm role-secondary"
                :disabled="rbac.saving"
                @click="uninstallAutoReconciler"
              >
                <i v-if="rbac.saving === 'reconciler-uninstall'" class="icon icon-spinner icon-spin" />
                {{ t('clusterstacks.cso.removeBtn') }}
              </button>
            </div>
          </div>

          <div v-if="rbac.error" class="banner banner-error mt-10">
            {{ rbac.error }}
          </div>
          <div v-if="rbac.success" class="banner banner-info mt-10">
            {{ rbac.success }}
          </div>
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
                <LabeledInput
                  v-model:value="helmRepo"
                  :label="t('clusterstacks.cso.install.helmRepo')"
                  placeholder="oci://registry.scs.community/cluster-stacks/cso"
                />
                <span class="form-hint">{{ t('clusterstacks.cso.install.helmRepoHint') }}</span>
              </div>
            </div>

            <!-- cert-manager repo -->
            <div class="form-grid">
              <div class="form-row">
                <LabeledInput
                  v-model:value="certManagerRepo"
                  :label="t('clusterstacks.cso.install.certManagerRepo')"
                  placeholder="https://charts.jetstack.io"
                />
                <span class="form-hint">{{ t('clusterstacks.cso.install.certManagerHint') }}</span>
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
                <LabeledInput
                  v-model:value="form.ociRegistry"
                  :label="t('clusterstacks.cso.form.ociRegistry')"
                  placeholder="registry.scs.community"
                />
              </div>
              <div class="form-row">
                <LabeledInput
                  v-model:value="form.ociRepository"
                  :label="t('clusterstacks.cso.form.ociRepository')"
                  placeholder="SovereignCloudStack/cluster-stacks"
                />
              </div>
              <div class="form-row">
                <LabeledInput
                  v-model:value="form.ociUsername"
                  :label="t('clusterstacks.cso.form.ociUsername')"
                />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociPassword') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.ociPassword" :type="showPasswords.ociPassword ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('ociPassword')">
                    <i :class="showPasswords.ociPassword ? 'icon icon-hide' : 'icon icon-show'" />
                  </button>
                </div>
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.ociAccessToken') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.ociAccessToken" :type="showPasswords.ociAccessToken ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('ociAccessToken')">
                    <i :class="showPasswords.ociAccessToken ? 'icon icon-hide' : 'icon icon-show'" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Git fields -->
            <div v-if="provider === 'git'" class="form-grid">
              <div class="form-row">
                <LabeledInput
                  v-model:value="form.gitOrgName"
                  :label="t('clusterstacks.cso.form.gitOrgName')"
                  placeholder="SovereignCloudStack"
                />
              </div>
              <div class="form-row">
                <LabeledInput
                  v-model:value="form.gitRepoName"
                  :label="t('clusterstacks.cso.form.gitRepoName')"
                  placeholder="cluster-stacks"
                />
              </div>
              <div class="form-row">
                <label>{{ t('clusterstacks.cso.form.gitAccessToken') }}</label>
                <div class="password-wrapper">
                  <input v-model="form.gitAccessToken" :type="showPasswords.gitAccessToken ? 'text' : 'password'" class="form-input" />
                  <button type="button" class="password-toggle" @click="toggleShowPassword('gitAccessToken')">
                    <i :class="showPasswords.gitAccessToken ? 'icon icon-hide' : 'icon icon-show'" />
                  </button>
                </div>
              </div>
            </div>

            <!-- RuntimeSDK warning -->
            <div v-if="runtimeSDKEnabled === false" class="banner banner-error mt-10">
              <i class="icon icon-warning" />
              {{ t('clusterstacks.cso.install.runtimeSDKMissing') }}
            </div>

            <!-- Install progress -->
            <div v-if="installProgress" class="banner banner-info mt-10">
              <i class="icon icon-spinner icon-spin" /> {{ installProgress }}
            </div>

            <div class="form-actions">
              <button class="btn role-primary" :disabled="saving || runtimeSDKEnabled === false" @click="install">
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
import Banner from '@components/Banner/Banner.vue';
import { LabeledInput } from '@components/Form/LabeledInput';

const CSO_NAMESPACE = 'cso-system';
const DEFAULT_HELM_REPO = 'oci://registry.scs.community/cluster-stacks/cso';
const DEFAULT_REPO_NAME = 'cso-charts';
const CERT_MANAGER_NAMESPACE = 'cert-manager';
const CERT_MANAGER_REPO_NAME = 'jetstack';
const DEFAULT_CERT_MANAGER_REPO = 'https://charts.jetstack.io';
const CLUSTERSTACKS_NAMESPACE = 'clusterstacks';

const CAPI_ROLE_TEMPLATE      = 'clusterstacks-capi-access';
const DASHBOARD_ROLE_TEMPLATE = 'clusterstacks-dashboard-view';
const AUTO_RECONCILER_NAME    = 'cso-cluster-owner-reconciler';
const AUTO_RECONCILER_ROLE_TEMPLATE = 'cluster-owner';
const AUTO_RECONCILER_MANAGED_LABEL = 'project-cluster-owner';

export default {
  name: 'CsoManagement',

  components: { Banner, LabeledInput },

  data() {
    return {
      loading: true,
      hasAdminAccess: null,

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
      certManagerRepo:  DEFAULT_CERT_MANAGER_REPO,
      certManagerInstalled: null,
      runtimeSDKEnabled: null,

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

      // Install progress message
      installProgress: '',

      // Snapshot of form at load time (for dirty tracking)
      originalForm: null,

      // RBAC management
      rbac: {
        capiInstalled:        false,
        autoReconcilerInstalled: false,
        saving:               false,
        error:                null,
        success:              null,
      },

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
    const isAdmin = this.isAdminUser();

    this.hasAdminAccess = isAdmin;

    if (!isAdmin) {
      this.loading = false;
      return;
    }

    await this.load();
  },

  methods: {
    isAdminUser() {
      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');
      return !!(schema?.resourceMethods || []).includes('PUT');
    },

    // ─── Data loading ─────────────────────────────────────────────────

    async load() {
      this.loading = true;
      this.saveError = null;
      this.saveSuccess = null;

      try {
        await Promise.all([
          this.detectCso(),
          this.loadPods(),
          this.checkRuntimeSDK(),
          this.detectRbac(),
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

    async checkRuntimeSDK() {
      // Look for the Core provider (cluster-api) and check if RuntimeSDK is set in spec.variables
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/apis/turtles-capi.cattle.io/v1alpha1/capiproviders',
        });
        const items = resp?.items || [];
        const coreProvider = items.find(
          (p) => (p.spec?.type || '').toLowerCase() === 'core'
        );

        if (!coreProvider) {
          // No core provider installed at all – can't verify
          this.runtimeSDKEnabled = null;

          return;
        }

        const vars = coreProvider.spec?.variables || {};

        // variables may be a map { RuntimeSDK: "true" } or array [{ name, value }]
        if (Array.isArray(vars)) {
          const found = vars.find((v) => v.name === 'RuntimeSDK');

          this.runtimeSDKEnabled = found && (found.value === 'true' || found.value === true);
        } else {
          this.runtimeSDKEnabled = vars.RuntimeSDK === 'true' || vars.RuntimeSDK === true;
        }
      } catch {
        // API not available – skip the check
        this.runtimeSDKEnabled = null;
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
      this.installProgress = '';

      try {
        // 0. Check and install cert-manager if missing
        this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerCheck');
        const hasCertManager = await this.isCertManagerInstalled();

        if (!hasCertManager) {
          await this.installCertManager();
        }

        // 1. Ensure cso-system namespace exists
        this.installProgress = this.t('clusterstacks.cso.install.progress.namespace');
        await this.ensureNamespace();

        // 2. Ensure ClusterRepo exists
        this.installProgress = this.t('clusterstacks.cso.install.progress.repo');
        await this.ensureClusterRepo();

        // 3. Wait for Rancher to sync the repo index (poll until ready)
        this.installProgress = this.t('clusterstacks.cso.install.progress.sync');
        await this.waitForRepoSync();

        // 4. Install via Rancher catalog action
        this.installProgress = this.t('clusterstacks.cso.install.progress.chart');
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
            wait:                     true,
          },
        });

        // 5. Wait for the catalog App to appear
        this.installProgress = this.t('clusterstacks.cso.install.progress.wait');
        await this.waitForApp();

        await this.load();
      } catch (e) {
        this.saveError = this.extractError(e);
      } finally {
        this.saving = false;
        this.installProgress = '';
      }
    },

    // ─── cert-manager ─────────────────────────────────────────────────

    async isCertManagerInstalled() {
      // Check for cert-manager deployment in cert-manager namespace
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/apps/v1/namespaces/${ CERT_MANAGER_NAMESPACE }/deployments`,
        });
        const items = resp?.items || [];
        const found = items.some((d) => (d.metadata?.name || '').includes('cert-manager'));

        if (found) {
          this.certManagerInstalled = true;

          return true;
        }
      } catch {}

      // Also check via Rancher catalog apps
      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/catalog.cattle.io/v1/namespaces/${ CERT_MANAGER_NAMESPACE }/apps`,
        });
        const found = (resp?.items || []).some((a) => (a.metadata?.name || '').includes('cert-manager'));

        if (found) {
          this.certManagerInstalled = true;

          return true;
        }
      } catch {}

      this.certManagerInstalled = false;

      return false;
    },

    async installCertManager() {
      // 1. Ensure cert-manager namespace
      this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerNs');
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/api/v1/namespaces/${ CERT_MANAGER_NAMESPACE }`,
        });
      } catch {
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/api/v1/namespaces',
          data:   {
            apiVersion: 'v1',
            kind:       'Namespace',
            metadata:   { name: CERT_MANAGER_NAMESPACE },
          },
        });
      }

      // 2. Ensure jetstack ClusterRepo
      this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerRepo');
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/catalog.cattle.io/v1/clusterrepos/${ CERT_MANAGER_REPO_NAME }`,
        });
      } catch {
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/apis/catalog.cattle.io/v1/clusterrepos',
          data:   {
            apiVersion: 'catalog.cattle.io/v1',
            kind:       'ClusterRepo',
            metadata:   { name: CERT_MANAGER_REPO_NAME },
            spec:       { url: this.certManagerRepo },
          },
        });
      }

      // 3. Wait for repo sync
      this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerSync');
      await this.waitForRepoSync(90000, CERT_MANAGER_REPO_NAME);

      // 4. Install cert-manager chart
      this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerInstall');
      await this.$store.dispatch('management/request', {
        method: 'POST',
        url:    `/v1/catalog.cattle.io.clusterrepos/${ CERT_MANAGER_REPO_NAME }?action=install`,
        data:   {
          charts: [
            {
              chartName:   'cert-manager',
              version:     '',
              releaseName: 'cert-manager',
              values:      { crds: { enabled: true } },
              annotations: {},
            },
          ],
          namespace:                CERT_MANAGER_NAMESPACE,
          disableOpenAPIValidation: false,
          noHooks:                  false,
          timeout:                  '600s',
          wait:                     true,
        },
      });

      // 5. Wait for cert-manager deployment to be ready
      this.installProgress = this.t('clusterstacks.cso.install.progress.certManagerWait');
      await this.waitForCertManager();
    },

    async waitForCertManager(maxWaitMs = 120000) {
      const start = Date.now();

      while (Date.now() - start < maxWaitMs) {
        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/apps/v1/namespaces/${ CERT_MANAGER_NAMESPACE }/deployments`,
          });
          const deploys = resp?.items || [];
          const webhook = deploys.find((d) => (d.metadata?.name || '').includes('cert-manager-webhook'));

          if (webhook) {
            const ready = (webhook.status?.readyReplicas || 0) >= 1;

            if (ready) {
              this.certManagerInstalled = true;

              return;
            }
          }
        } catch {}

        await new Promise((r) => setTimeout(r, 5000));
      }

      // Don't throw – cert-manager may still be rolling out; CSO install will fail if it's truly not ready
    },

    async waitForRepoSync(maxWaitMs = 90000, repoName = DEFAULT_REPO_NAME) {
      const start = Date.now();

      while (Date.now() - start < maxWaitMs) {
        try {
          const repo = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/catalog.cattle.io/v1/clusterrepos/${ repoName }`,
          });

          const conditions = repo?.status?.conditions || [];

          // Check multiple readiness indicators:
          // - 'Ready' or 'FollowerReady' (OCI / follower repos)
          // - 'Downloaded' (standard HTTP Helm repos like jetstack)
          const ready = conditions.find(
            (c) => (c.type === 'Ready' || c.type === 'FollowerReady' || c.type === 'Downloaded')
              && c.status === 'True'
          );

          if (ready) {
            return;
          }

          // Fallback: if downloadTime is set, the index was fetched successfully
          if (repo?.status?.downloadTime) {
            return;
          }

          // Only treat conditions as errors when the reason explicitly signals a failure
          const errCond = conditions.find(
            (c) => c.status === 'False' && c.message
              && /error|fail|invalid/i.test(c.reason || '')
          );

          if (errCond) {
            throw new Error(errCond.message);
          }
        } catch (e) {
          // Re-throw user-facing errors (from errCond above)
          if (e instanceof Error) {
            throw e;
          }
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      throw new Error(this.t('clusterstacks.cso.install.repoSyncTimeout'));
    },

    async waitForApp(maxWaitMs = 30000) {
      const start = Date.now();

      while (Date.now() - start < maxWaitMs) {
        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/catalog.cattle.io/v1/namespaces/${ CSO_NAMESPACE }/apps`,
          });
          const app = (resp?.items || []).find((a) => {
            const name = a.metadata?.name || '';

            return name === 'cso' || name.includes('cluster-stack-operator');
          });

          if (app) {
            return;
          }
        } catch {}

        await new Promise((r) => setTimeout(r, 3000));
      }

      // Don't throw – the install may still be rolling out
    },

    extractError(e) {
      if (typeof e === 'string') {
        return e;
      }
      if (e?.data?.message) {
        return e.data.message;
      }
      if (e?.body?.message) {
        return e.body.message;
      }
      if (e?.message) {
        return e.message;
      }
      if (e?.statusText) {
        return `${ e.status }: ${ e.statusText }`;
      }

      return this.t('clusterstacks.cso.install.error');
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
      const ns = pod.metadata.namespace || CSO_NAMESPACE;
      const name = pod.metadata.name;
      const containerName = pod.spec?.containers?.[0]?.name;

      // Build a minimal pod proxy that ContainerLogs expects.
      // links.view is the Kubernetes API URL proxied through Rancher's management cluster.
      const podProxy = {
        ...pod,
        id:                   `${ ns }/${ name }`,
        nameDisplay:          name,
        defaultContainerName: containerName,
        links:                { view: `/k8s/clusters/local/api/v1/namespaces/${ ns }/pods/${ name }` },
      };

      // Open the Rancher window-manager log panel instead of navigating away.
      // This mirrors the approach in shell/models/pod.js from rancher/dashboard.
      this.$store.dispatch('wm/open', {
        id:        `${ ns }/${ name }-logs`,
        label:     name,
        icon:      'file',
        component: 'ContainerLogs',
        attrs:     {
          pod:              podProxy,
          initialContainer: containerName,
        },
      });
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

    // ─── RBAC management ─────────────────────────────────────────────

    async detectRbac() {
      // CAPI access is considered complete only when the shared ClusterStacks
      // namespace viewer grant is present as well.
      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/management.cattle.io/v3/roletemplates/${ CAPI_ROLE_TEMPLATE }`,
        });

        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/rbac.authorization.k8s.io/v1/clusterroles/${ DASHBOARD_ROLE_TEMPLATE }`,
        });

        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/rbac.authorization.k8s.io/v1/namespaces/${ CLUSTERSTACKS_NAMESPACE }/rolebindings/${ DASHBOARD_ROLE_TEMPLATE }`,
        });

        this.rbac.capiInstalled = true;
      } catch {
        this.rbac.capiInstalled = false;
      }

      try {
        await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/apis/apps/v1/namespaces/${ CSO_NAMESPACE }/deployments/${ AUTO_RECONCILER_NAME }`,
        });
        this.rbac.autoReconcilerInstalled = true;
      } catch {
        try {
          // Backward compatibility: consider legacy CronJob installs as present.
          await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/batch/v1/namespaces/${ CSO_NAMESPACE }/cronjobs/${ AUTO_RECONCILER_NAME }`,
          });
          this.rbac.autoReconcilerInstalled = true;
        } catch {
          this.rbac.autoReconcilerInstalled = false;
        }
      }
    },

    async createOrUpdate(url, data) {
      try {
        await this.$store.dispatch('management/request', {
          method: 'POST',
          url,
          data,
        });
      } catch (e) {
        const status = e?.status || e?.code || e?._status;
        const msg = (e?.message || e?.data?.message || '').toLowerCase();

        if (status === 409 || msg.includes('already exists')) {
          const name = data.metadata?.name;
          const itemUrl = url.endsWith('/') ? `${ url }${ name }` : `${ url }/${ name }`;

          // Fetch existing resource to get resourceVersion for the update
          const existing = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    itemUrl,
          });

          const resourceVersion = existing?.metadata?.resourceVersion;
          const mergedData = {
            ...data,
            metadata: {
              ...data.metadata,
              resourceVersion,
            },
          };

          await this.$store.dispatch('management/request', {
            method: 'PUT',
            url:    itemUrl,
            data:   mergedData,
          });
        } else {
          throw e;
        }
      }
    },

    buildAutoReconcilerScript() {
      return `#!/bin/sh
set -eu

log() {
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date)"
  printf '%s [cso-reconciler] %s\\n' "$ts" "$*" >&2
}

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
log "start run"

mgmt_map="\${tmpdir}/mgmt-clusters.tsv"
kubectl get clusters.management.cattle.io -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.metadata.labels.cluster\\.x-k8s\\.io/cluster-name}{"\\t"}{.metadata.annotations.cluster\\.x-k8s\\.io/cluster-name}{"\\t"}{.spec.displayName}{"\\n"}{end}' > "\$mgmt_map"
mgmt_count="$(wc -l < "\$mgmt_map" | tr -d ' ')"
log "loaded management clusters: \$mgmt_count"

ns_seen=0
ns_processed=0
apply_count=0
apply_fail_count=0
delete_count=0

# Reconcile all cso-* namespaces (except cso-system) that contain CAPI clusters.
kubectl get namespaces -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.metadata.annotations.field\\.cattle\\.io/projectId}{"\\n"}{end}' \\
  | while IFS="$(printf '\\t')" read -r ns project_id; do
      ns_seen=$((ns_seen + 1))
      case "\$ns" in
        cso-*) ;;
        *) continue ;;
      esac

      if [ "\$ns" = "cso-system" ]; then
        log "skip namespace=\$ns: system namespace"
        continue
      fi

      if [ -z "\$project_id" ]; then
        log "skip namespace=\$ns: missing projectId annotation"
        continue
      fi

      ns_processed=$((ns_processed + 1))
      log "processing namespace=\$ns projectId=\$project_id"

      capi_names="$(kubectl get clusters.cluster.x-k8s.io -n "\$ns" -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}' 2>/dev/null || true)"
      if [ -z "\$capi_names" ]; then
        log "namespace=\$ns: no CAPI clusters found"
        continue
      fi
      capi_count="$(printf '%s\\n' "\$capi_names" | grep -c . || true)"
      log "namespace=\$ns: capiClusters=\$capi_count"

      desired_file="\${tmpdir}/\${ns}.desired"
      : > "\$desired_file"

      # Desired principals: project-owner + project-member for this cso project.
      kubectl get projectroletemplatebindings.management.cattle.io -A -o jsonpath='{range .items[*]}{.projectName}{"\\t"}{.roleTemplateName}{"\\t"}{.userPrincipalName}{"\\t"}{.groupPrincipalName}{"\\t"}{.userName}{"\\n"}{end}' \\
        | while IFS="$(printf '\\t')" read -r prj role upn gpn uname; do
            [ "\$prj" = "\$project_id" ] || continue
            case "\$role" in
              project-owner|project-member) ;;
              *) continue ;;
            esac

            if [ -n "\$upn" ]; then
              # Reclassify group principals that Rancher may store in userPrincipalName by mistake.
              case "\$upn" in
                *_group://*)
                  printf 'gpn:%s\\n' "\$upn" >> "\$desired_file"
                  ;;
                *)
                  printf 'upn:%s\\n' "\$upn" >> "\$desired_file"
                  ;;
              esac
            elif [ -n "\$gpn" ]; then
              printf 'gpn:%s\\n' "\$gpn" >> "\$desired_file"
            fi
          done

      sort -u "\$desired_file" -o "\$desired_file"
      desired_count="$(wc -l < "\$desired_file" | tr -d ' ')"
      log "namespace=\$ns: desired principals=\$desired_count"

      printf '%s\\n' "\$capi_names" | while IFS= read -r capi_name; do
        [ -n "\$capi_name" ] || continue
        log "namespace=\$ns: reconcile capi=\$capi_name"

        cluster_id="$(awk -F'\\t' -v n="\$capi_name" '$2==n || $3==n || $4==n {print $1; exit}' "\$mgmt_map")"
        if [ -z "\$cluster_id" ]; then
          log "namespace=\$ns capi=\$capi_name: no matching management cluster"
          continue
        fi
        log "namespace=\$ns capi=\$capi_name: mapped managementCluster=\$cluster_id"

        # Keep fleetWorkspaceName in sync with the cso namespace.
        current_fleet="$(kubectl get clusters.management.cattle.io "\$cluster_id" -o jsonpath='{.spec.fleetWorkspaceName}' 2>/dev/null || true)"
        if [ "\$current_fleet" = "\$ns" ]; then
          log "cluster=\$cluster_id: fleetWorkspaceName already \$ns"
        else
          if patch_out="$(kubectl patch clusters.management.cattle.io "\$cluster_id" --type=merge -p "{\\"spec\\":{\\"fleetWorkspaceName\\":\\"\$ns\\"}}" 2>&1)"; then
            log "cluster=\$cluster_id: fleetWorkspaceName \${current_fleet:-<empty>} -> \$ns (\$patch_out)"
          else
            log "cluster=\$cluster_id: WARN patch fleetWorkspaceName failed current=\${current_fleet:-<empty>} target=\$ns error=\$patch_out"
          fi
        fi

        while IFS= read -r key; do
          [ -n "\$key" ] || continue

          field=""
          value=""
          case "\$key" in
            upn:*)
              field="userPrincipalName"
              value="\${key#upn:}"
              ;;
            gpn:*)
              field="groupPrincipalName"
              value="\${key#gpn:}"
              ;;
            *)
              continue
              ;;
          esac

          hash="$(printf '%s' "\$cluster_id:\$key" | sha1sum | awk '{print $1}' | cut -c1-10)"
          name="cso-auto-\$hash"

          duplicate_name="$(
            kubectl get clusterroletemplatebindings.management.cattle.io -n "\$cluster_id" -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.roleTemplateName}{"\\t"}{.clusterName}{"\\t"}{.userPrincipalName}{"\\t"}{.groupPrincipalName}{"\\t"}{.userName}{"\\t"}{.metadata.deletionTimestamp}{"\\n"}{end}' \
              | awk -F'\\t' -v role='${AUTO_RECONCILER_ROLE_TEMPLATE}' -v cluster="\$cluster_id" -v wantedKey="\$key" '
                  $2 != role { next }
                  $3 != cluster { next }
                  $7 != "" { next }
                  {
                    subjectKey = ""
                    if ($4 != "") {
                      if ($4 ~ /_group:\/\//) {
                        subjectKey = "gpn:" $4
                      } else {
                        subjectKey = "upn:" $4
                      }
                    } else if ($5 != "") {
                      subjectKey = "gpn:" $5
                    } else if ($6 != "") {
                      subjectKey = "uname:" $6
                    }
                  }
                  subjectKey == wantedKey {
                    print $1
                    exit
                  }
                '
          )"

          if [ -n "\$duplicate_name" ] && [ "\$duplicate_name" != "\$name" ]; then
            log "cluster=\$cluster_id: skip duplicate existingCRTB=\$duplicate_name subject=\$key"
            continue
          fi

          if apply_out="$(cat <<EOF | kubectl apply -f - 2>&1
apiVersion: management.cattle.io/v3
kind: ClusterRoleTemplateBinding
metadata:
  name: \$name
  namespace: \$cluster_id
  labels:
    clusterstacks.cso.io/managed: ${AUTO_RECONCILER_MANAGED_LABEL}
  annotations:
    clusterstacks.cso.io/project-id: \$project_id
    clusterstacks.cso.io/capi-namespace: \$ns
clusterName: \$cluster_id
roleTemplateName: ${AUTO_RECONCILER_ROLE_TEMPLATE}
\$field: \$value
EOF
)"; then
            apply_count=$((apply_count + 1))
            log "cluster=\$cluster_id: ensured cluster-owner for \$key (\$apply_out)"
          else
            apply_fail_count=$((apply_fail_count + 1))
            log "cluster=\$cluster_id: WARN ensure cluster-owner failed subject=\$key error=\$apply_out"
          fi
        done < "\$desired_file"

        # Remove stale managed CRTBs for this cluster.
        kubectl get clusterroletemplatebindings.management.cattle.io -n "\$cluster_id" -l clusterstacks.cso.io/managed=${AUTO_RECONCILER_MANAGED_LABEL} -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.userPrincipalName}{"\\t"}{.groupPrincipalName}{"\\t"}{.userName}{"\\n"}{end}' \\
          | while IFS="$(printf '\\t')" read -r crtb_name upn gpn uname; do
              key=""
              if [ -n "\$upn" ]; then
                case "\$upn" in
                  *_group://*)
                    key="gpn:\$upn"
                    ;;
                  *)
                    key="upn:\$upn"
                    ;;
                esac
              elif [ -n "\$gpn" ]; then
                key="gpn:\$gpn"
              elif [ -n "\$uname" ]; then
                # Legacy invalid userName-only external identities cause principal lookup 404 spam.
                if printf '%s' "\$uname" | grep -Eq '(://|,|=)'; then
                  kubectl delete clusterroletemplatebindings.management.cattle.io "\$crtb_name" -n "\$cluster_id" --ignore-not-found >/dev/null 2>&1 || true
                  delete_count=$((delete_count + 1))
                  log "cluster=\$cluster_id: removed invalid userName-only managed CRTB=\$crtb_name (\$uname)"
                  continue
                fi
                key="uname:\$uname"
              else
                kubectl delete clusterroletemplatebindings.management.cattle.io "\$crtb_name" -n "\$cluster_id" --ignore-not-found >/dev/null 2>&1 || true
                continue
              fi

              if ! grep -qx "\$key" "\$desired_file"; then
                kubectl delete clusterroletemplatebindings.management.cattle.io "\$crtb_name" -n "\$cluster_id" --ignore-not-found >/dev/null 2>&1 || true
                delete_count=$((delete_count + 1))
                log "cluster=\$cluster_id: removed stale managed CRTB=\$crtb_name (\$key)"
              fi
            done

        # Remove legacy managed CRTBs from older reconciler versions.
        kubectl get clusterroletemplatebindings.management.cattle.io -n "\$cluster_id" -l clusterstacks.cso.io/managed=project-cluster-member -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}' \\
          | while IFS= read -r legacy_name; do
              [ -n "\$legacy_name" ] || continue
              kubectl delete clusterroletemplatebindings.management.cattle.io "\$legacy_name" -n "\$cluster_id" --ignore-not-found >/dev/null 2>&1 || true
              delete_count=$((delete_count + 1))
              log "cluster=\$cluster_id: removed legacy cluster-member CRTB=\$legacy_name"
            done
        kubectl get clusterroletemplatebindings.management.cattle.io -n "\$cluster_id" -l clusterstacks.cso.io/managed=project-cluster-access -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}' \\
          | while IFS= read -r legacy_name; do
              [ -n "\$legacy_name" ] || continue
              kubectl delete clusterroletemplatebindings.management.cattle.io "\$legacy_name" -n "\$cluster_id" --ignore-not-found >/dev/null 2>&1 || true
              delete_count=$((delete_count + 1))
              log "cluster=\$cluster_id: removed legacy cluster-access CRTB=\$legacy_name"
            done
      done
    done

log "finished run namespacesSeen=\$ns_seen namespacesProcessed=\$ns_processed ensuredBindings=\$apply_count ensureFailures=\$apply_fail_count removedBindings=\$delete_count"
`;
    },

    async installAutoReconciler() {
      this.rbac.saving = 'reconciler-install';
      this.rbac.error = null;
      this.rbac.success = null;

      try {
        await this.createOrUpdate('/api/v1/namespaces', {
          apiVersion: 'v1',
          kind:       'Namespace',
          metadata:   { name: CSO_NAMESPACE },
        });

        await this.createOrUpdate(`/api/v1/namespaces/${ CSO_NAMESPACE }/serviceaccounts`, {
          apiVersion: 'v1',
          kind:       'ServiceAccount',
          metadata:   {
            name:      AUTO_RECONCILER_NAME,
            namespace: CSO_NAMESPACE,
          },
        });

        await this.createOrUpdate('/apis/rbac.authorization.k8s.io/v1/clusterroles', {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind:       'ClusterRole',
          metadata:   { name: AUTO_RECONCILER_NAME },
          rules: [
            // cluster-owner parity: SA must hold all permissions it grants via cluster-owner CRTBs.
            // cluster-owner includes apiGroups["*"]/resources["*"]/verbs["*"], so the SA needs the same.
            {
              apiGroups: ['*'],
              resources: ['*'],
              verbs: ['*'],
            },
            {
              nonResourceURLs: ['*'],
              verbs: ['*'],
            },
          ],
        });

        await this.createOrUpdate('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings', {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind:       'ClusterRoleBinding',
          metadata:   { name: AUTO_RECONCILER_NAME },
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind:     'ClusterRole',
            name:     AUTO_RECONCILER_NAME,
          },
          subjects: [
            {
              kind:      'ServiceAccount',
              name:      AUTO_RECONCILER_NAME,
              namespace: CSO_NAMESPACE,
            },
          ],
        });

        await this.createOrUpdate(`/api/v1/namespaces/${ CSO_NAMESPACE }/configmaps`, {
          apiVersion: 'v1',
          kind:       'ConfigMap',
          metadata:   {
            name:      AUTO_RECONCILER_NAME,
            namespace: CSO_NAMESPACE,
          },
          data: {
            'reconcile.sh': this.buildAutoReconcilerScript(),
          },
        });

        // Migrate old installs from CronJob to Deployment.
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/apis/batch/v1/namespaces/${ CSO_NAMESPACE }/cronjobs/${ AUTO_RECONCILER_NAME }`,
        }).catch(() => {});

        await this.createOrUpdate(`/apis/apps/v1/namespaces/${ CSO_NAMESPACE }/deployments`, {
          apiVersion: 'apps/v1',
          kind:       'Deployment',
          metadata:   {
            name:      AUTO_RECONCILER_NAME,
            namespace: CSO_NAMESPACE,
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: AUTO_RECONCILER_NAME,
              },
            },
            template: {
              metadata: {
                labels: {
                  app: AUTO_RECONCILER_NAME,
                },
              },
              spec: {
                serviceAccountName: AUTO_RECONCILER_NAME,
                restartPolicy: 'Always',
                containers: [
                  {
                    name: 'reconcile',
                    image: 'bitnami/kubectl:latest',
                    imagePullPolicy: 'IfNotPresent',
                    command: ['/bin/sh', '-c', 'while true; do /bin/sh /scripts/reconcile.sh || true; kubectl get projectroletemplatebindings.management.cattle.io -A --watch-only --request-timeout=120s >/dev/null 2>&1 || sleep 15; done'],
                    volumeMounts: [
                      {
                        name: 'scripts',
                        mountPath: '/scripts',
                        readOnly: true,
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: 'scripts',
                    configMap: {
                      name: AUTO_RECONCILER_NAME,
                      defaultMode: 493,
                    },
                  },
                ],
              },
            },
          },
        });

        this.rbac.autoReconcilerInstalled = true;
        this.rbac.success = 'Auto Cluster Access Reconciler installed successfully.';
      } catch (e) {
        this.rbac.error = this.extractError(e);
      } finally {
        this.rbac.saving = false;
      }
    },

    async uninstallAutoReconciler() {
      this.rbac.saving = 'reconciler-uninstall';
      this.rbac.error = null;
      this.rbac.success = null;

      try {
        await Promise.allSettled([
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/apps/v1/namespaces/${ CSO_NAMESPACE }/deployments/${ AUTO_RECONCILER_NAME }`,
          }),
          // Cleanup old installations still using a CronJob.
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/batch/v1/namespaces/${ CSO_NAMESPACE }/cronjobs/${ AUTO_RECONCILER_NAME }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/api/v1/namespaces/${ CSO_NAMESPACE }/configmaps/${ AUTO_RECONCILER_NAME }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/${ AUTO_RECONCILER_NAME }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/rbac.authorization.k8s.io/v1/clusterroles/${ AUTO_RECONCILER_NAME }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/api/v1/namespaces/${ CSO_NAMESPACE }/serviceaccounts/${ AUTO_RECONCILER_NAME }`,
          }),
        ]);

        this.rbac.autoReconcilerInstalled = false;
        this.rbac.success = 'Auto Cluster Access Reconciler removed.';
      } catch (e) {
        this.rbac.error = this.extractError(e);
      } finally {
        this.rbac.saving = false;
      }
    },

    async installCapiRbac() {
      this.rbac.saving = 'capi-install';
      this.rbac.error = null;
      this.rbac.success = null;

      try {
        // 1. Create or update ClusterRole
        await this.createOrUpdate(
          '/apis/rbac.authorization.k8s.io/v1/clusterroles',
          {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind:       'ClusterRole',
            metadata:   {
              name:   CAPI_ROLE_TEMPLATE,
              labels: { 'cattle.io/creator': 'clusterstacks-extension' },
            },
            rules: [
              {
                apiGroups: ['cluster.x-k8s.io'],
                resources: ['clusters', 'clusters/status', 'clusters/kubeconfig',
                  'machinedeployments', 'machinedeployments/status',
                  'machines', 'machines/status', 'machinesets', 'machinesets/status'],
                verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
              },
              {
                apiGroups: ['addons.cluster.x-k8s.io'],
                resources: ['clusterresourcesets', 'clusterresourcesets/status'],
                verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
              },
              {
                apiGroups: ['clusterstack.x-k8s.io'],
                resources: ['clusterstacks', 'clusterstacks/status',
                  'clusterstackreleases', 'clusterstackreleases/status'],
                verbs: ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['cluster.x-k8s.io'],
                resources: ['clusterclasses', 'clusterclasses/status'],
                verbs:     ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['infrastructure.cluster.x-k8s.io'],
                resources: ['openstackclusters', 'openstackclusters/status',
                  'openstackmachinetemplates', 'openstackmachinetemplates/status'],
                verbs: ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['bootstrap.cluster.x-k8s.io'],
                resources: ['*'],
                verbs:     ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['controlplane.cluster.x-k8s.io'],
                resources: ['*'],
                verbs:     ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['management.cattle.io'],
                resources: ['clusters'],
                 verbs:     ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['management.cattle.io'],
                resources: ['clusterroletemplatebindings'],
                 verbs:     ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['management.cattle.io'],
                resources: ['fleetworkspaces'],
                 verbs:     ['get', 'list', 'watch'],
              },
              ],
            },
          );

          // 2. Create or update project-scoped RoleTemplate
          await this.createOrUpdate(
            '/apis/management.cattle.io/v3/roletemplates',
            {
              apiVersion:  'management.cattle.io/v3',
              kind:        'RoleTemplate',
              metadata:    {
                name:   CAPI_ROLE_TEMPLATE,
                labels: { 'cattle.io/creator': 'clusterstacks-extension' },
              },
              displayName: 'ClusterStacks CAPI Access',
              description: 'Grants access to Cluster API and ClusterStack resources within project namespaces.',
              context:     'project',
              builtin:     false,
              external:    true,
              hidden:      false,
              locked:      false,
            },
          );

          // 3. Grant all authenticated users read-only access to shared
          // ClusterStacks definitions in the dedicated clusterstacks namespace.
          await this.createOrUpdate('/apis/rbac.authorization.k8s.io/v1/clusterroles', {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind:       'ClusterRole',
            metadata:   {
              name:   DASHBOARD_ROLE_TEMPLATE,
              labels: { 'cattle.io/creator': 'clusterstacks-extension' },
            },
            rules: [
              {
                apiGroups: ['clusterstack.x-k8s.io'],
                resources: ['clusterstacks', 'clusterstacks/status', 'clusterstackreleases', 'clusterstackreleases/status'],
                verbs: ['get', 'list', 'watch'],
              },
              {
                apiGroups: ['cluster.x-k8s.io'],
                resources: ['clusterclasses', 'clusterclasses/status'],
                verbs: ['get', 'list', 'watch'],
              },
            ],
          });

          await this.createOrUpdate(`/apis/rbac.authorization.k8s.io/v1/namespaces/${ CLUSTERSTACKS_NAMESPACE }/rolebindings`, {
            apiVersion: 'rbac.authorization.k8s.io/v1',
            kind:       'RoleBinding',
            metadata:   {
              name:      DASHBOARD_ROLE_TEMPLATE,
              namespace: CLUSTERSTACKS_NAMESPACE,
              labels:    { 'cattle.io/creator': 'clusterstacks-extension' },
            },
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind:     'ClusterRole',
              name:     DASHBOARD_ROLE_TEMPLATE,
            },
            subjects: [
              {
                apiGroup: 'rbac.authorization.k8s.io',
                kind:     'Group',
                name:     'system:authenticated',
              },
            ],
          });

          // 4. Remove legacy global readonly grants that leak namespace visibility.
        await Promise.allSettled([
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/clusterstacks-readonly',
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    '/apis/rbac.authorization.k8s.io/v1/clusterroles/clusterstacks-readonly',
          }),
        ]);

        this.rbac.capiInstalled = true;
        this.rbac.success = 'CAPI Access RoleTemplate installed successfully.';
      } catch (e) {
        this.rbac.error = this.extractError(e);
      } finally {
        this.rbac.saving = false;
      }
    },

    async uninstallCapiRbac() {
      this.rbac.saving = 'capi-uninstall';
      this.rbac.error = null;
      this.rbac.success = null;

      try {
        await Promise.allSettled([
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/management.cattle.io/v3/roletemplates/${ CAPI_ROLE_TEMPLATE }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/rbac.authorization.k8s.io/v1/clusterroles/${ CAPI_ROLE_TEMPLATE }`,
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    '/apis/rbac.authorization.k8s.io/v1/clusterroles/clusterstacks-readonly',
          }),
          this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/clusterstacks-readonly',
          }),
            // Clean up legacy dashboard-view resources from older installations
            this.$store.dispatch('management/request', {
              method: 'DELETE',
              url:    `/apis/management.cattle.io/v3/roletemplates/${ DASHBOARD_ROLE_TEMPLATE }`,
            }),
            this.$store.dispatch('management/request', {
              method: 'DELETE',
              url:    `/apis/rbac.authorization.k8s.io/v1/clusterroles/${ DASHBOARD_ROLE_TEMPLATE }`,
            }),
            this.$store.dispatch('management/request', {
              method: 'DELETE',
              url:    `/apis/rbac.authorization.k8s.io/v1/namespaces/${ CLUSTERSTACKS_NAMESPACE }/rolebindings/${ DASHBOARD_ROLE_TEMPLATE }`,
            }),
            this.$store.dispatch('management/request', {
              method: 'DELETE',
              url:    `/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/${ CAPI_ROLE_TEMPLATE }`,
            }),
        ]);

        this.rbac.capiInstalled = false;
        this.rbac.success = 'CAPI Access RoleTemplate removed.';
      } catch (e) {
        this.rbac.error = this.extractError(e);
      } finally {
        this.rbac.saving = false;
      }
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

header {
  margin-bottom: 20px;
}

header.with-subheader {
  grid-template-areas:
    'type-banner type-banner'
    'title actions'
    'sub-header sub-header'
    'state-banner state-banner';
}

.title {
  align-items: center;
  display: flex;
}

.sub-header {
  grid-area: sub-header;
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
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--warning-banner-bg, rgba(244, 175, 61, 0.14));
  border: 1px solid var(--warning, #f4af3d);
  color: var(--text, inherit);
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

/* ─── RBAC section ───────────────────────────────────────────────── */
.rbac-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);

  &:last-of-type {
    border-bottom: none;
  }
}

.rbac-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.rbac-name {
  font-weight: 600;
  font-size: 0.95em;
  color: var(--body-text);
}

.rbac-desc {
  font-size: 0.82em;
  color: var(--muted);
  line-height: 1.4;

  code {
    background: var(--input-bg, rgba(255, 255, 255, 0.06));
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }
}

.rbac-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.rbac-sync-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.rbac-sync-title {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--body-text);
  margin: 0 0 4px;
}

.rbac-sync-desc {
  font-size: 0.82em;
  color: var(--muted);
  margin: 0 0 10px;
}

.rbac-sync-actions {
  display: flex;
  gap: 8px;
}

.rbac-sync-results {
  .rbac-sync-list {
    font-size: 0.88em;
    color: var(--body-text);

    strong {
      display: block;
      margin-bottom: 4px;
    }

    ul {
      margin: 0;
      padding-left: 20px;
    }

    li {
      line-height: 1.6;
    }
  }
}
</style>
