<template>
  <div class="openstack-page">
    <header class="with-subheader">
      <div class="title">
        <h1 class="m-0">{{ t('clusterstacks.openstack.title') }}</h1>
      </div>
      <div class="sub-header">
        <!-- Slot content -->
      </div>
      <div class="actions-container">
        <div class="actions">
          <button
            v-if="canCreateProjects"
            class="btn role-primary"
            @click="showCreateProject = true"
          >
            <i class="icon icon-plus" />
            {{ t('clusterstacks.openstack.createProjectBtn') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Create Project inline form -->
    <div v-if="showCreateProject" class="create-project-card">
      <h3>{{ t('clusterstacks.openstack.createProjectTitle') }}</h3>
      <div class="create-project-form">
        <div class="create-project-inputs">
          <div class="form-group">
            <LabeledInput
              v-model:value="newProjectName"
              :label="t('clusterstacks.openstack.projectNameLabel')"
              :placeholder="t('clusterstacks.openstack.projectNamePlaceholder')"
            />
            <div class="form-hint">cso-{{ newProjectName || '...' }}</div>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('clusterstacks.openstack.projectMembersLabel') }}</label>
            <div class="member-rows">
              <div v-for="(member, idx) in newProjectMembers" :key="idx" class="member-row-input">
                <UserSearchInput
                  :value="member.displayName"
                  :placeholder="t('clusterstacks.openstack.projectOwnerPlaceholder')"
                  @input="member.displayName = $event"
                  @select="onNewMemberSelected(idx, $event)"
                />
                <span class="member-role-fixed">{{ t('clusterstacks.projectMembers.roleOwner') }}</span>
                <button class="btn btn-sm role-link" @click="removeNewMember(idx)">
                  <i class="icon icon-trash" />
                </button>
              </div>
              <button class="btn btn-sm role-secondary" @click="addNewMember">
                <i class="icon icon-plus" />
                {{ t('clusterstacks.projectMembers.addMember') }}
              </button>
            </div>
          </div>
        </div>
        <div class="create-project-actions">
          <button class="btn btn-sm role-secondary" @click="cancelCreateProject">
            {{ t('clusterstacks.common.cancel') }}
          </button>
          <button
            class="btn btn-sm role-primary"
            :disabled="!newProjectName.trim() || creatingProject"
            @click="createProject"
          >
            <i v-if="creatingProject" class="icon icon-spinner icon-spin" />
            {{ t('clusterstacks.common.create') }}
          </button>
        </div>
        <div v-if="createProjectError" class="banner banner-error mt-10">{{ createProjectError }}</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-indicator">
      <i class="icon icon-spinner icon-spin" />
      {{ t('clusterstacks.common.loading') }}
    </div>

    <!-- Project list -->
    <div v-if="!loading && projectGroups.length" class="project-list">
      <div
        v-for="group in projectGroups"
        :key="group.projectId"
        class="project-card"
      >
        <!-- Project header -->
        <div class="project-card-header">
          <div class="project-card-title">
            <h2>{{ group.projectDisplayName }}</h2>
            <span v-if="group.projectShortName" class="project-id-badge">{{ group.projectShortName }}</span>
            <span class="credential-count">
              {{ group.credentials.length }} {{ t('clusterstacks.openstack.credentialCount') }}
            </span>
          </div>
          <div class="project-card-actions">
            <button
              v-if="group.projectId !== '__no_project__' && !String(group.projectId || '').startsWith('__ns_project__')"
              class="btn btn-sm role-secondary"
              :disabled="!group.canManageMembers"
              @click="openMembersDialog(group)"
            >
              <i class="icon icon-user" />
              {{ t('clusterstacks.openstack.manageOwners') }}
            </button>
            <button
              v-if="group.projectId !== '__no_project__' && !String(group.projectId || '').startsWith('__ns_project__')"
              class="btn btn-sm role-primary"
              :disabled="!group.canCreateCredential"
              @click="createCredentialInProject(group)"
            >
              <i class="icon icon-plus" />
              {{ t('clusterstacks.openstack.addCredential') }}
            </button>
          </div>
        </div>

        <!-- Members preview -->
        <div v-if="group.members.length" class="project-members-preview">
          <i class="icon icon-user" />
          <span
            v-for="(member, idx) in group.members.slice(0, 5)"
            :key="member.id"
            class="member-chip"
          >
            {{ member.displayName }}{{ idx < Math.min(group.members.length, 5) - 1 ? ',' : '' }}
          </span>
          <span v-if="group.members.length > 5" class="member-more">
            +{{ group.members.length - 5 }}
          </span>
        </div>

        <!-- Credentials table -->
        <div v-if="group.credentials.length" class="credential-table">
          <SortableTable
            :rows="credentialRows(group)"
            :headers="credentialHeaders"
            key-field="namespace"
            default-sort-by="name"
            :search="false"
            :paging="false"
            :table-actions="false"
            :row-actions="true"
            class="credential-sortable-table"
          >
            <template #cell:name="{ row }">
              <div class="col-name">
                <router-link
                  :to="resourceLinkForCredential(row)"
                  class="cred-name-link"
                >
                  {{ row.name }}
                </router-link>
                <span v-if="row.hasClusterResources" class="cred-in-use-badge">
                  {{ t('clusterstacks.openstack.inUse') }}
                </span>
                <span v-if="row.fleetManaged" class="cred-fleet-managed-badge" :title="FLEET_MANAGED_TOOLTIP">
                  {{ FLEET_MANAGED_TOOLTIP }}
                </span>
              </div>
            </template>

            <template #cell:auth="{ row }">
              <div class="col-auth mono">{{ row.authUrl || '—' }}</div>
            </template>

            <template #cell:quota="{ row }">
              <div v-if="isQuotaSummaryLoading(row.namespace)" class="quota-mini-loading">
                <i class="icon icon-spinner icon-spin" />
              </div>
              <div v-else-if="quotaSummaryFor(row.namespace)" class="quota-mini-list">
                <div
                  v-for="metric in quotaSummaryFor(row.namespace).metrics"
                  :key="metric.key"
                  class="quota-mini-item"
                  :title="metric.title"
                >
                  <div class="quota-mini-bar-wrap">
                    <div class="quota-mini-bar-fill" :style="quotaBarStyle(metric)" />
                  </div>
                  <span class="quota-mini-value">{{ metric.unit ? `${ metric.value } ${ metric.unit }` : metric.value }}</span>
                  <span class="quota-mini-label">{{ metric.label }}</span>
                </div>
              </div>
              <span v-else class="text-muted">—</span>
            </template>
          </SortableTable>
        </div>

        <!-- Empty project -->
        <div v-else class="project-empty">
          <span>{{ t('clusterstacks.openstack.noCredentials') }}</span>
          <button
            v-if="group.projectId !== '__no_project__' && !String(group.projectId || '').startsWith('__ns_project__') && group.canDeleteProject"
            class="btn btn-sm btn-delete ml-10"
            @click="requestDeleteProject(group)"
          >
            <i class="icon icon-trash" />
            {{ t('clusterstacks.openstack.deleteProject') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="no-data">
      {{ t('clusterstacks.openstack.noProjects') }}
    </div>

    <!-- Move credential dialog -->
    <div v-if="moveDialog.show" class="modal-overlay" @click.self="moveDialog.show = false">
      <div class="modal-container modal-sm">
        <div class="modal-header">
          <h3>{{ t('clusterstacks.openstack.moveCred.title') }}</h3>
          <button class="btn btn-sm role-link modal-close-btn" @click="moveDialog.show = false">
            <i class="icon icon-close" />
          </button>
        </div>
        <div class="modal-body">
          <p>{{ t('clusterstacks.openstack.moveCred.message', { name: moveDialog.credName }) }}</p>
          <LabeledSelect
            :value="moveDialog.targetProjectId"
            :label="t('clusterstacks.openstack.moveCred.targetProject')"
            :placeholder="t('clusterstacks.openstack.moveCred.selectProject')"
            :options="moveTargetProjectOptions"
            @update:value="moveDialog.targetProjectId = selectValue($event)"
          />
          <div v-if="moveDialog.error" class="banner banner-error mt-10">{{ moveDialog.error }}</div>
          <div class="modal-actions">
            <button class="btn btn-sm role-secondary" @click="moveDialog.show = false">
              {{ t('clusterstacks.common.cancel') }}
            </button>
            <button
              class="btn btn-sm role-primary"
              :disabled="!moveDialog.targetProjectId || moveDialog.moving"
              @click="executeMove"
            >
              <i v-if="moveDialog.moving" class="icon icon-spinner icon-spin" />
              {{ t('clusterstacks.openstack.moveCred.moveBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete credential confirmation dialog -->
    <ConfirmDeleteDialog
      :is-open="showDeleteDialog"
      :confirmation-value="pendingDelete ? pendingDelete.name : ''"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Delete project confirmation dialog -->
    <ConfirmDeleteDialog
      :is-open="showDeleteProjectDialog"
      :confirmation-value="pendingDeleteProject ? pendingDeleteProject.projectDisplayName : ''"
      @confirm="confirmDeleteProject"
      @cancel="showDeleteProjectDialog = false; pendingDeleteProject = null"
    />

    <!-- Project members dialog -->
    <ProjectMembersDialog
      :is-open="showMembersDialog"
      :project-id="membersProjectId"
      :project-name="membersProjectName"
      @close="closeMembersDialog"
      @update="onMembersUpdated"
    />
  </div>
</template>

<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import SortableTable from '@shell/components/SortableTable';
import { ROUTES } from '../../config/clusterstacks';
import { OpenStackApiService, parseCloudsYaml } from '../../services/openstack-api';
import { hostnameFromAuthUrl, deleteProxyEndpoint } from '../../services/proxy-endpoint';
import { FLEET_MANAGED_TOOLTIP, isFleetManagedResource } from '../../utils/fleet-management';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog.vue';
import ProjectMembersDialog from '../../components/ProjectMembersDialog.vue';
import UserSearchInput from '../../components/UserSearchInput.vue';

export default {
  name: 'OpenstackProjectsOverview',

  components: {
    ConfirmDeleteDialog,
    LabeledInput,
    LabeledSelect,
    ProjectMembersDialog,
    SortableTable,
    UserSearchInput,
  },

  data() {
    return {
      loading:            true,
      refreshInFlight:    false,
      postSaveRefreshTimer: null,
      credentials:        [],
      projects:           [],
      userMap:            {},
      _bindings:          [],
      currentUser:        {
        id:           '',
        displayName:  '',
        username:     '',
        principalIds: [],
        groupNames:   [],
        isAdmin:      false,
      },

      // Create project
      showCreateProject:  false,
      newProjectName:     '',
      newProjectMembers:  [],
      creatingProject:    false,
      createProjectError: '',

      // Delete credential
      showDeleteDialog:   false,
      pendingDelete:      null,

      // Delete project
      showDeleteProjectDialog: false,
      pendingDeleteProject:    null,

      // Members
      showMembersDialog:  false,
      membersProjectId:   '',
      membersProjectName: '',

      // Move credential
      moveDialog: {
        show:            false,
        cred:            null,
        credName:        '',
        sourceProjectId: '',
        targetProjectId: '',
        moving:          false,
        error:           '',
      },

      quotaSummaries:       {},
      quotaSummaryLoading:  {},
    };
  },

  computed: {
    FLEET_MANAGED_TOOLTIP() {
      return FLEET_MANAGED_TOOLTIP;
    },

    clusterId() {
      const raw = this.$route.params.cluster;

      return raw === '_' ? 'local' : raw;
    },

    canCreateProjects() {
      return !!this.currentUser.isAdmin;
    },

    visibleProjects() {
      return (this.projects || []).filter((proj) => {
        const displayName = String(proj.spec?.displayName || '').trim();
        const name = String(proj.metadata?.name || '').trim();

        return (displayName.startsWith('cso-') && displayName !== 'cso-system')
          || (name.startsWith('cso-') && name !== 'cso-system');
      });
    },

    projectGroups() {
      const groups = [];
      const assignedNamespaces = new Set();

      for (const proj of this.visibleProjects) {
        // Steve API returns IDs as "local/p-xxxxx" but annotations use "local:p-xxxxx"
        const fullId = (proj.id || '').replace('/', ':');
        const shortId = fullId.includes(':') ? fullId.split(':').slice(1).join(':') : fullId;
        const displayName = proj.spec?.displayName || proj.metadata?.name || shortId;
        const normalizedDisplayName = String(displayName || '').replace(/^cso-/, '');

        const projectCreds = this.credentials.filter((c) => {
          if (c.projectId) {
            const credShort = c.projectId.includes(':') ? c.projectId.split(':').slice(1).join(':') : c.projectId;

            return c.projectId === fullId || credShort === shortId;
          }

          // Fallback for users where namespace annotations are not returned with projectId.
          const nsName = String(c.namespace || '');
          const normalizedNamespace = nsName.replace(/^cso-/, '');
          const normalizedOsProjectName = String(c.osProjectName || '').replace(/^cso-/, '');

          return normalizedNamespace === normalizedDisplayName
            || normalizedOsProjectName === normalizedDisplayName;
        });

        const members = this.getProjectMembers(fullId, shortId);
        const userRole = this.getCurrentUserRoleForProject(fullId, shortId);
        const hasProjectUpdateAccess = this.hasProjectUpdateAccess(proj);
        const canManageMembers = this.currentUser.isAdmin || userRole === 'project-owner' || hasProjectUpdateAccess;
        const canMutateCredentials = this.currentUser.isAdmin || userRole === 'project-owner' || userRole === 'project-member' || hasProjectUpdateAccess;
        const canDeleteProject = this.currentUser.isAdmin || userRole === 'project-owner' || hasProjectUpdateAccess;

        const enrichedCreds = projectCreds.map((cred) => {
          const canMutate = canMutateCredentials && !cred.fleetManaged;
          const effectiveRole = this.roleFromRank(this.roleRank(userRole));

          return {
            ...cred,
            effectiveRole,
            canEditCredential: canMutate,
            canMoveCredential: canMutate,
            canDeleteCredential: canMutate,
          };
        });

        enrichedCreds.forEach((c) => assignedNamespaces.add(c.namespace));

        groups.push({
          projectId:          fullId,
          projectShortName:   shortId,
          projectDisplayName: displayName,
          credentials:        enrichedCreds,
          members,
          userRole,
          canManageMembers,
          canCreateCredential: canMutateCredentials,
          canEditCredential:   canMutateCredentials,
          canMoveCredential:   canMutateCredentials,
          canDeleteCredential: canMutateCredentials,
          canDeleteProject,
        });
      }

      // Build groups for credentials that are still not associated to a visible project group.
      const unassigned = this.credentials.filter((c) => !assignedNamespaces.has(c.namespace));

      // Non-admin users may only have namespace-level extra access and no project visibility.
      // In this case, build synthetic project groups so the namespace is still visible.
      const namespaceProjectGroups = {};

      for (const cred of unassigned) {
        if (this.currentUser.isAdmin) {
          continue;
        }

        const ns = String(cred.namespace || '');
        const rawProjectId = String(cred.projectId || '').replace('/', ':').trim();
        const projectShortId = rawProjectId.includes(':') ? rawProjectId.split(':').slice(1).join(':') : rawProjectId;
        const derivedProject = ns.startsWith('cso-') ? ns : `cso-${ ns }`;
        const displayProjectName = String(cred.osProjectName || '').trim() || derivedProject;
        const key = rawProjectId ? `__ns_project__:${ rawProjectId }` : `__ns_project__:${ displayProjectName }`;

        if (!namespaceProjectGroups[key]) {
          namespaceProjectGroups[key] = {
            projectId:          key,
            projectShortName:   projectShortId,
            projectDisplayName: displayProjectName,
            credentials:        [],
            members:            [],
            userRole:           'read-only',
            canManageMembers:   false,
            canCreateCredential: false,
            canEditCredential:   false,
            canMoveCredential:   false,
            canDeleteCredential: false,
            canDeleteProject:    false,
          };
        }

        namespaceProjectGroups[key].credentials.push({
          ...cred,
          // Hidden projects should only expose namespace presence, not credential internals.
          authUrl: '',
          osProjectName: '',
          effectiveRole: 'read-only',
          canEditCredential: false,
          canMoveCredential: false,
          canDeleteCredential: false,
        });
      }

      groups.push(...Object.values(namespaceProjectGroups));

      if (unassigned.length && this.currentUser.isAdmin) {
        groups.push({
          projectId:          '__no_project__',
          projectShortName:   '',
          projectDisplayName: this.t('clusterstacks.openstack.credentials.noProject'),
          credentials:        unassigned.map((cred) => ({
            ...cred,
            effectiveRole: 'project-owner',
            canEditCredential: true,
            canMoveCredential: true,
            canDeleteCredential: true,
          })),
          members:            [],
          userRole:           'project-owner',
          canManageMembers:   true,
          canCreateCredential: true,
          canEditCredential:   true,
          canMoveCredential:   true,
          canDeleteCredential: true,
          canDeleteProject:    false,
        });
      }

      return groups;
    },

    moveTargetProjects() {
      return this.visibleProjects
        .filter((p) => (p.id || '').replace('/', ':') !== this.moveDialog.sourceProjectId)
        .map((p) => ({
          id:          (p.id || '').replace('/', ':'),
          displayName: p.spec?.displayName || p.metadata?.name || p.id,
        }));
    },

    moveTargetProjectOptions() {
      return this.moveTargetProjects.map((project) => ({
        label: project.displayName,
        value: project.id,
      }));
    },

    credentialHeaders() {
      return [
        {
          name:      'name',
          labelKey:  'clusterstacks.openstack.credential.name',
          value:     'name',
          sort:      ['name'],
          width:     280,
        },
        {
          name:      'auth',
          labelKey:  'clusterstacks.openstack.credential.authUrl',
          value:     'authUrl',
          sort:      ['authUrl'],
        },
        {
          name:      'quota',
          label:     'Quota',
          value:     'namespace',
          sort:      false,
          search:    false,
        },
      ];
    },

  },

  async mounted() {
    await this.loadAll();
    this.schedulePostSaveRefreshIfRequested();
  },

  beforeUnmount() {
    if (this.postSaveRefreshTimer) {
      clearTimeout(this.postSaveRefreshTimer);
      this.postSaveRefreshTimer = null;
    }
  },

  methods: {
    schedulePostSaveRefreshIfRequested() {
      const shouldRefresh = String(this.$route.query?.refreshAfterCredentialSave || '') === '1';

      if (!shouldRefresh) {
        return;
      }

      if (this.postSaveRefreshTimer) {
        clearTimeout(this.postSaveRefreshTimer);
      }

      this.postSaveRefreshTimer = setTimeout(async() => {
        this.postSaveRefreshTimer = null;
        await this.refreshInBackground();
        await this.$router.replace({
          query: {
            ...this.$route.query,
            refreshAfterCredentialSave: undefined,
            refreshToken: undefined,
          },
        }).catch(() => {});
      }, 3000);
    },

    async refreshInBackground() {
      if (this.loading || this.refreshInFlight) {
        return;
      }

      this.refreshInFlight = true;
      try {
        await this.loadAll({ background: true });
      } finally {
        this.refreshInFlight = false;
      }
    },

    selectValue(input) {
      if (input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'value')) {
        return input.value;
      }

      return input;
    },

    async loadAll({ background = false } = {}) {
      if (!background) {
        this.loading = true;
      }

      try {
        await Promise.all([
          this.loadProjects(),
          this.loadUsers(),
          this.loadBindings(),
          this.loadCurrentUser(),
        ]);
        await this.loadCredentials();
        await this.resolvePrincipals();
        this.loadQuotaSummaries();
      } finally {
        if (!background) {
          this.loading = false;
        }
      }
    },

    credentialRows(group) {
      return (group?.credentials || []).map((cred) => {
        const actions = [];

        if (cred.canEditCredential) {
          actions.push({
            label:  this.t('clusterstacks.common.edit'),
            icon:   'icon-edit',
            action: 'editCredentialRow',
          });
        }

        if (cred.canMoveCredential) {
          actions.push({
            label:  this.t('clusterstacks.openstack.moveCred.title'),
            icon:   'icon-fork',
            action: 'moveCredentialRow',
          });
        }

        if (!cred.hasClusterResources && cred.canDeleteCredential) {
          actions.push({ divider: true });
          actions.push({
            label:    this.t('clusterstacks.common.delete'),
            icon:     'icon-trash',
            action:   'deleteCredentialRow',
            bulkable: false,
          });
        }

        const row = {
          ...cred,
          availableActions: actions,
        };

        row.editCredentialRow = () => this.editCredential(cred, group);
        row.moveCredentialRow = () => this.startMoveCredential(cred, group);
        row.deleteCredentialRow = () => this.requestDelete(cred, group);

        return row;
      });
    },

    resourceLinkForCredential(cred) {
      return {
        name:   ROUTES.OPENSTACK_DETAIL,
        params: { cluster: this.$route.params.cluster || '_' },
        query:  {
          tab:        'resources',
          credential: cred.name,
          namespace:  cred.namespace,
        },
      };
    },

    quotaSummaryFor(namespace) {
      return this.quotaSummaries[namespace] || null;
    },

    isQuotaSummaryLoading(namespace) {
      return !!this.quotaSummaryLoading[namespace];
    },

    quotaBarStyle(metric) {
      const pct = Math.max(0, Math.min(100, metric.pct || 0));

      return {
        width: `${ pct }%`,
        background: metric.color,
      };
    },

    formatMetricValue(value, type) {
      const number = Number(value || 0);

      if (type === 'ram') {
        const gib = number / 1024;

        return this.formatCompactNumber(gib);
      }

      if (type === 'disk') {
        return this.formatCompactNumber(number);
      }

      return this.formatCompactNumber(number);
    },

    formatCompactNumber(number) {
      const abs = Math.abs(number);

      if (abs >= 1000000) {
        return `${ (number / 1000000).toFixed(1).replace(/\.0$/, '') }m`;
      }

      if (abs >= 1000) {
        return `${ (number / 1000).toFixed(1).replace(/\.0$/, '') }k`;
      }

      if (Number.isInteger(number)) {
        return String(number);
      }

      return number.toFixed(1).replace(/\.0$/, '');
    },

    buildQuotaMetric(key, label, type, item) {
      if (!item) {
        return {
          key,
          label,
          used:  '—',
          title: `${ label }: n/a`,
          pct:   0,
          color: 'var(--muted)',
        };
      }

      const used = Number(item.in_use || 0);
      const limit = Number(item.limit ?? -1);
      const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      const color = pct >= 90 ? 'var(--error)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
      const unit = type === 'ram' || type === 'disk' ? 'GiB' : '';
      const valueLabel = this.formatMetricValue(used, type);
      const limitLabelRaw = limit === -1 ? '∞' : this.formatMetricValue(limit, type);
      const limitLabel = unit && limitLabelRaw !== '∞' ? `${ limitLabelRaw } ${ unit }` : limitLabelRaw;
      const usedTitle = unit ? `${ valueLabel } ${ unit }` : valueLabel;

      return {
        key,
        label,
        value: valueLabel,
        unit,
        title: `${ label }: ${ usedTitle } / ${ limitLabel }`,
        pct,
        color,
      };
    },

    async loadQuotaSummaries() {
      const loadingMap = {};

      for (const cred of this.credentials) {
        loadingMap[cred.namespace] = true;
      }
      this.quotaSummaryLoading = loadingMap;

      const summaries = { ...this.quotaSummaries };

      await Promise.allSettled(
        this.credentials.map(async(cred) => {
          const namespace = cred.namespace;

          try {
            const api = new OpenStackApiService(cred.cloudsYaml, this.$store);
            const [computeRes, volumeRes] = await Promise.allSettled([
              api.getComputeQuota(),
              api.getVolumeQuota(),
            ]);

            const compute = computeRes.status === 'fulfilled' ? computeRes.value : null;
            const volume = volumeRes.status === 'fulfilled' ? volumeRes.value : null;

            summaries[namespace] = {
              metrics: [
                this.buildQuotaMetric('vcpu', 'VCPU', 'count', compute?.cores),
                this.buildQuotaMetric('ram', 'RAM', 'ram', compute?.ram),
                this.buildQuotaMetric('disk', 'DISK', 'disk', volume?.gigabytes),
                this.buildQuotaMetric('instances', 'INST', 'count', compute?.instances),
              ],
            };
          } catch {
            summaries[namespace] = null;
          } finally {
            this.quotaSummaryLoading = {
              ...this.quotaSummaryLoading,
              [namespace]: false,
            };
          }
        }),
      );

      this.quotaSummaries = summaries;
    },

    async loadCurrentUser() {
      const assignCurrentUser = (user, selfUser = null) => {
        const authPrincipalId = String(this.$store.getters['auth/principalId'] || '').trim();
        const userPrincipalIds = Array.isArray(user?.principalIds) ? user.principalIds : [];
        const userPrincipalIdsUpper = Array.isArray(user?.principalIDs) ? user.principalIDs : [];
        const userGroupPrincipalIds = Array.isArray(user?.groupPrincipalIds) ? user.groupPrincipalIds : [];
        const userGroupPrincipals = Array.isArray(user?.groupPrincipals)
          ? user.groupPrincipals.map((g) => g?.principalId || g?.id || g).filter(Boolean)
          : [];
        const selfPrincipalId = String(selfUser?.status?.principalID || selfUser?.principalId || '').trim();
        const selfPrincipalIds = Array.isArray(selfUser?.status?.principalIDs) ? selfUser.status.principalIDs : [];
        const userGroups = [
          ...(Array.isArray(user?.groupNames) ? user.groupNames : []),
          ...(Array.isArray(user?.groups) ? user.groups : []),
          ...(Array.isArray(selfUser?.status?.groupNames) ? selfUser.status.groupNames : []),
        ].map((g) => String(g || '').trim()).filter(Boolean);
        const principalIds = Array.from(new Set([
          ...userPrincipalIds,
          ...userPrincipalIdsUpper,
          ...userGroupPrincipalIds,
          ...userGroupPrincipals,
          ...selfPrincipalIds,
          authPrincipalId,
          selfPrincipalId,
        ].map((p) => String(p || '').trim()).filter(Boolean)));
        const fallbackPrincipalName = this.extractPrincipalDisplayName(authPrincipalId || selfPrincipalId);
        const displayName = user?.displayName
          || user?.nameDisplay
          || user?.name
          || user?.username
          || fallbackPrincipalName;
        const username = user?.username
          || user?.loginName
          || fallbackPrincipalName
          || user?.id
          || selfUser?.status?.userID
          || '';

        this.currentUser = {
          id:           user?.id || user?.metadata?.name || selfUser?.status?.userID || '',
          displayName,
          username,
          principalIds,
          groupNames:   Array.from(new Set(userGroups)),
          isAdmin:      this.isAdminUser(user || selfUser || {}),
        };
      };

      const authUser = this.$store.getters['auth/user'];
      const selfUser = this.$store.getters['auth/selfUser'];

      if (authUser || selfUser) {
        assignCurrentUser(authUser, selfUser);

        if (this.currentUser.id || this.currentUser.username || this.currentUser.principalIds.length) {
          return;
        }
      }

      try {
        await Promise.allSettled([
          this.$store.dispatch('auth/getUser'),
          this.$store.dispatch('management/request', {
            method: 'POST',
            url:    '/v1/ext.cattle.io.selfuser',
            data:   {},
          }),
        ]);

        const refreshedAuthUser = this.$store.getters['auth/user'];
        const refreshedSelfUser = this.$store.getters['auth/selfUser'];

        if (refreshedAuthUser || refreshedSelfUser) {
          assignCurrentUser(refreshedAuthUser, refreshedSelfUser);

          if (this.currentUser.id || this.currentUser.username || this.currentUser.principalIds.length) {
            return;
          }
        }
      } catch {
        // fall through to direct Norman request
      }

      try {
        const meResp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/v3/users?action=me',
        });
        const meCandidates = Array.isArray(meResp?.data)
          ? meResp.data
          : (Array.isArray(meResp) ? meResp : [meResp?.data || meResp]);
        const me = meCandidates.find((entry) => entry?.me) || meCandidates.find((entry) => entry?.id) || null;

        assignCurrentUser(me, this.$store.getters['auth/selfUser']);
      } catch {
        this.currentUser = {
          id:           '',
          displayName:  '',
          username:     '',
          principalIds: [],
          groupNames:   [],
          isAdmin:      false,
        };
      }
    },

    isAdminUser(user) {
      if (typeof user?.isAdmin === 'boolean') {
        return user.isAdmin;
      }

      const roleNames = Array.isArray(user?.globalRoleNames) ? user.globalRoleNames : [];

      if (roleNames.includes('admin')) {
        return true;
      }

      const globalRoles = Array.isArray(user?.globalRoles) ? user.globalRoles : [];

      if (globalRoles.includes('admin')) {
        return true;
      }

      const schema = this.$store.getters['management/schemaFor']('management.cattle.io.setting');

      return !!(schema?.resourceMethods || []).includes('PUT');
    },

    isBlockedLink(link) {
      return /(^\/|\/)blocked(?:\/|$|\?)/.test(String(link || '').trim().toLowerCase());
    },

    hasProjectUpdateAccess(project) {
      const updateLink = String(project?.links?.update || project?.links?.self || '');

      return !!(updateLink && !this.isBlockedLink(updateLink));
    },

    async loadCredentials() {
      try {
        let visibleNamespaces = [];
        const prefetchedSecretsByNamespace = {};

        try {
          const nsResponse = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/api/v1/namespaces',
          });
          visibleNamespaces = (nsResponse?.items || [])
            .map((ns) => this.normalizeNamespaceRecord(ns))
            .filter((ns) => ns.name.startsWith('cso-') && ns.name !== 'cso-system');
        } catch {
          const nsList = await this.$store.dispatch('management/findAll', {
            type: 'namespace',
          });

          visibleNamespaces = (nsList || [])
            .map((ns) => this.normalizeNamespaceRecord(ns))
            .filter((ns) => ns.name.startsWith('cso-') && ns.name !== 'cso-system');
        }


        // Additional fallback: Steve namespaces collection may be readable
        // even when Kubernetes namespace listing is blocked.
        if (!visibleNamespaces.length) {
          try {
            const steveNamespaces = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    '/v1/namespaces',
            });
            const items = Array.isArray(steveNamespaces?.data)
              ? steveNamespaces.data
              : (Array.isArray(steveNamespaces?.items) ? steveNamespaces.items : []);

            visibleNamespaces = items
              .map((ns) => this.normalizeNamespaceRecord(ns))
              .filter((ns) => ns.name.startsWith('cso-') && ns.name !== 'cso-system');

            if (visibleNamespaces.length) {
            }
          } catch (e) {
          }
        }

        // Fallback for restricted users: discover credentials from directly visible secrets
        // even if listing namespaces is not allowed.
        if (!visibleNamespaces.length) {
          try {
            const secretScan = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    '/api/v1/secrets?fieldSelector=metadata.name=openstack',
            });
            const items = Array.isArray(secretScan?.items) ? secretScan.items : [];

            if (items.length) {
              const discoveredNs = Array.from(new Set(
                items
                  .map((s) => String(s?.metadata?.namespace || '').trim())
                  .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
              ));

              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));

            }
          } catch {
            // keep empty; regular flow below will result in no credentials
          }
        }

        // Fallback for restricted users via Steve API: list secrets visible to the user.
        if (!visibleNamespaces.length) {
          try {
            const allSecrets = await this.$store.dispatch('management/findAll', {
              type: 'secret',
              opt:  { force: true },
            });

            const openstackSecrets = (allSecrets || []).filter((s) => {
              const name = String(s?.metadata?.name || '').trim();
              const ns = String(s?.metadata?.namespace || '').trim();

              return name === 'openstack' && ns.startsWith('cso-') && ns !== 'cso-system';
            });


            if (openstackSecrets.length) {
              const discoveredNs = Array.from(new Set(openstackSecrets.map((s) => String(s.metadata?.namespace || '').trim())));

              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));

              for (const secret of openstackSecrets) {
                const ns = String(secret?.metadata?.namespace || '').trim();

                if (ns) {
                  prefetchedSecretsByNamespace[ns] = secret;
                }
              }

            }
          } catch {
            // keep empty; next fallback may still discover namespaces
          }
        }

        // Additional fallback: Steve secrets collection
        if (!visibleNamespaces.length) {
          try {
            const steveSecrets = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    '/v1/secrets',
            });
            const items = Array.isArray(steveSecrets?.data)
              ? steveSecrets.data
              : (Array.isArray(steveSecrets?.items) ? steveSecrets.items : []);
            const openstackSecrets = items.filter((s) => {
              const name = String(s?.metadata?.name || '').trim();
              const ns = String(s?.metadata?.namespace || '').trim();

              return name === 'openstack' && ns.startsWith('cso-') && ns !== 'cso-system';
            });


            if (openstackSecrets.length) {
              const discoveredNs = Array.from(new Set(openstackSecrets.map((s) => String(s?.metadata?.namespace || '').trim())));

              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));

              for (const secret of openstackSecrets) {
                const ns = String(secret?.metadata?.namespace || '').trim();

                if (ns) {
                  prefetchedSecretsByNamespace[ns] = secret;
                }
              }

            }
          } catch (e) {
          }
        }

        // Last fallback: derive namespaces from visible CAPI clusters.
        if (!visibleNamespaces.length) {
          try {
            const clusters = await this.$store.dispatch('management/findAll', {
              type: 'cluster.x-k8s.io.cluster',
              opt:  { force: true },
            });
            const discoveredNs = Array.from(new Set(
              (clusters || [])
                .map((c) => String(c?.metadata?.namespace || '').trim())
                .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
            ));

            if (discoveredNs.length) {
              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));
            }
          } catch (e) {
            // keep empty; regular flow below will result in no credentials
          }
        }

        // Rancher namespace assignments may be visible even when namespace and secret
        // collections themselves are not. Use namespace role template bindings as a source.
        if (!visibleNamespaces.length) {
          const discoveredNs = Array.from(new Set(
            (this._bindings || [])
              .filter((binding) => this.isBindingForCurrentUser(binding))
              .map((binding) => this.namespaceNameFromBinding(binding))
              .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
          ));

          if (discoveredNs.length) {
            visibleNamespaces = discoveredNs.map((ns) => ({
              name: ns,
              annotations: {},
              labels: {},
            }));
          }
        }

        if (!visibleNamespaces.length) {
          try {
            const roleBindingResp = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    '/v1/rbac.authorization.k8s.io.rolebindings',
            });
            const items = Array.isArray(roleBindingResp?.data)
              ? roleBindingResp.data
              : (Array.isArray(roleBindingResp?.items) ? roleBindingResp.items : []);
            const discoveredNs = Array.from(new Set(
              items
                .filter((binding) => this.isRoleBindingForCurrentUser(binding))
                .map((binding) => String(binding?.metadata?.namespace || '').trim())
                .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
            ));

            if (discoveredNs.length) {
              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));
            }
          } catch (e) {
          }
        }

        if (!visibleNamespaces.length) {
          try {
            const bindings = await this.$store.dispatch('management/findAll', {
              type: 'management.cattle.io.namespaceroletemplatebinding',
              opt:  { force: true },
            });
            const discoveredNs = Array.from(new Set(
              (bindings || [])
                .map((binding) => this.namespaceNameFromBinding(binding))
                .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
            ));

            if (discoveredNs.length) {
              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));
            }
          } catch (e) {
          }
        }

        if (!visibleNamespaces.length) {
          try {
            const bindingResp = await this.$store.dispatch('management/request', {
              method: 'GET',
              url:    '/v3/namespaceroletemplatebindings',
            });
            const items = Array.isArray(bindingResp?.data) ? bindingResp.data : (Array.isArray(bindingResp) ? bindingResp : []);
            const discoveredNs = Array.from(new Set(
              items
                .map((binding) => this.namespaceNameFromBinding(binding))
                .filter((ns) => ns.startsWith('cso-') && ns !== 'cso-system'),
            ));

            if (discoveredNs.length) {
              visibleNamespaces = discoveredNs.map((ns) => ({
                name: ns,
                annotations: {},
                labels: {},
              }));
            }
          } catch (e) {
          }
        }


        const results = await Promise.allSettled(
          visibleNamespaces.map(async(ns) => {
            let namespaceMeta = ns;

            if ((!namespaceMeta.annotations || !Object.keys(namespaceMeta.annotations).length)
              && (!namespaceMeta.labels || !Object.keys(namespaceMeta.labels).length)) {
              try {
                const fullNs = await this.$store.dispatch('management/request', {
                  method: 'GET',
                  url:    `/api/v1/namespaces/${ ns.name }`,
                });

                namespaceMeta = this.normalizeNamespaceRecord(fullNs);
              } catch {
                // keep minimal namespace meta
              }
            }

            const prefetchedSecret = prefetchedSecretsByNamespace[ns.name] || null;

            const [secretResult, clusterResult] = await Promise.allSettled([
              prefetchedSecret
                ? Promise.resolve(prefetchedSecret)
                : this.$store.dispatch('management/request', {
                  method: 'GET',
                  url:    `/api/v1/namespaces/${ ns.name }/secrets/openstack`,
                }),
              this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ ns.name }/clusters`,
              }),
            ]);

            if (secretResult.status === 'rejected') {
              return null;
            }

            return {
              secret:              secretResult.value,
              namespace:           namespaceMeta,
              hasClusterResources: clusterResult.status === 'fulfilled'
                && (clusterResult.value?.items?.length || 0) > 0,
            };
          }),
        );

        this.credentials = results
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r) => {
            const { secret: s, namespace: nsObj, hasClusterResources } = r.value;
            const ns = s.metadata.namespace;
            const projectId = nsObj?.annotations?.['field.cattle.io/projectId']
              || nsObj?.labels?.['field.cattle.io/projectId']
              || s?.metadata?.annotations?.['field.cattle.io/projectId']
              || '';
            const cloudsYaml = atob(s.data?.['clouds.yaml'] || '');
            let authUrl = '';
            let osProjectName = '';

            try {
              const parsed = parseCloudsYaml(cloudsYaml);

              authUrl       = parsed.authUrl || '';
              osProjectName = parsed.projectName || '';
            } catch {}

            return {
              name:      ns.startsWith('cso-') ? ns.slice(4) : ns,
              namespace: ns,
              authUrl,
              osProjectName,
              cloudsYaml,
              projectId,
              raw: s,
              fleetManaged: isFleetManagedResource(s),
              hasClusterResources,
            };
          });

      } catch {
        this.credentials = [];
      }
    },

    normalizeNamespaceRecord(ns) {
      const metadataName = String(ns?.metadata?.name || '').trim();
      const directName = String(ns?.name || '').trim();
      const idName = String(ns?.id || '').includes('/')
        ? String(ns.id).split('/').pop().trim()
        : '';
      const name = metadataName || directName || idName;

      return {
        name,
        annotations: ns?.metadata?.annotations || ns?.annotations || {},
        labels: ns?.metadata?.labels || ns?.labels || {},
      };
    },

    namespaceNameFromBinding(binding) {
      const candidates = [
        binding?.namespaceName,
        binding?.namespaceId,
        binding?.namespace,
        binding?.metadata?.namespace,
        binding?.id,
      ].filter(Boolean).map((value) => String(value).trim());

      for (const candidate of candidates) {
        const colonTail = candidate.includes(':') ? candidate.split(':').pop().trim() : '';
        const slashTail = candidate.includes('/') ? candidate.split('/').pop().trim() : '';
        const namespace = colonTail || slashTail || candidate;

        if (namespace.startsWith('cso-')) {
          return namespace;
        }
      }

      return '';
    },

    async loadProjects() {
      try {
        // Use raw API to bypass Steve store cache entirely
        const resp = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    `/v1/management.cattle.io.projects/${ this.clusterId }`,
        });

        this.projects = (resp?.data || []).filter(
          (p) => (p.metadata?.namespace || p.spec?.clusterName) === this.clusterId,
        );
      } catch {
        // Fallback to Steve findAll
        try {
          const all = await this.$store.dispatch('management/findAll', {
            type: 'management.cattle.io.project',
            opt:  { force: true },
          });

          this.projects = (all || []).filter(
            (p) => (p.metadata?.namespace || p.spec?.clusterName) === this.clusterId,
          );
        } catch {
          this.projects = [];
        }
      }
    },

    async loadUsers() {
      try {
        const users = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.user',
          opt:  { force: true },
        });

        const map = {};
        const GENERIC_NAMES = ['default admin', 'admin'];

        for (const u of (users || [])) {
          const id = u.id || u.metadata?.name || '';
          const username = u.username || u.metadata?.name || '';
          const displayName = u.displayName || u.name || username;

          // Skip generic names like "Default Admin" — prefer principal-based resolution
          if (GENERIC_NAMES.includes((displayName || '').toLowerCase())) {
            map[id] = username;
            map[username] = username;
          } else {
            map[id] = displayName;
            map[username] = displayName;
          }
          for (const pid of (u.principalIds || [])) {
            // For external principals, try to extract the friendly name from the principal ID
            const isExternal = pid && !pid.startsWith('local://');

            if (isExternal) {
              const friendlyName = this.extractPrincipalDisplayName(pid);
              // For user principals, show "Full Name (loginName)" like Rancher does
              const isUserPrincipal = /_user:\/\//.test(pid);

              if (isUserPrincipal && friendlyName && displayName
                  && friendlyName !== displayName
                  && !GENERIC_NAMES.includes((displayName || '').toLowerCase())) {
                map[pid] = `${ displayName } (${ friendlyName })`;
              } else {
                map[pid] = friendlyName || displayName;
              }
            } else {
              map[pid] = GENERIC_NAMES.includes((displayName || '').toLowerCase()) ? username : displayName;
            }
          }
        }

        this.userMap = map;
      } catch {
        this.userMap = {};
      }
    },

    async loadBindings() {
      try {
        this._bindings = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.projectroletemplatebinding',
          opt:  { force: true },
        });
      } catch {
        this._bindings = [];
      }
    },

    async resolvePrincipals() {
      // Resolve display names for user principals via Rancher principals API
      // Needed because management.cattle.io.user objects often lack the full LDAP display name
      const bindings = this._bindings || [];
      const toResolve = new Map(); // pid → loginName

      for (const b of bindings) {
        
        const pid = b.userPrincipalName || '';

        if (!pid || pid.startsWith('local://') || !/_user:\/\//.test(pid)) {
          continue;
        }

        const friendly = this.extractPrincipalDisplayName(pid);
        const current = this.userMap[pid];
        const GENERIC_NAMES = ['default admin', 'admin'];

        // Needs resolution if: not in map, value is just the login name, or value is a generic name like "Default Admin"
        const needsResolve = !current
          || current === friendly
          || current === pid
          || GENERIC_NAMES.includes((current || '').toLowerCase());

        if (needsResolve) {
          toResolve.set(pid, friendly);
        }
      }

      if (!toResolve.size) {
        return;
      }

      const updatedMap = { ...this.userMap };
      let changed = false;

      // Deduplicate by login name to avoid redundant API calls
      const byLoginName = new Map();

      for (const [pid, loginName] of toResolve) {
        const existing = byLoginName.get(loginName) || [];

        existing.push(pid);
        byLoginName.set(loginName, existing);
      }

      const results = await Promise.allSettled(
        [...byLoginName.entries()].map(async([loginName, pids]) => {
          let items = null;

          // Use the rancher (Norman v3) store for principal search
          try {
            const res = await this.$store.dispatch('rancher/collectionAction', {
              type:       'principal',
              actionName: 'search',
              opt:        { url: '/v3/principals?action=search' },
              body:       { name: loginName },
            });

            items = Array.isArray(res) ? res : (res?.data || []);
          } catch {
            // silent
          }

          return { loginName, pids, items: items || [] };
        }),
      );

      for (const r of results) {
        if (r.status !== 'fulfilled') {
          continue;
        }

        const { loginName, pids, items } = r.value;

        if (!Array.isArray(items) || !items.length) {
          continue;
        }

        for (const pid of pids) {
          // Try exact ID match first
          let match = items.find((p) => p.id === pid);

          // Try case-insensitive ID match
          if (!match) {
            const pidLower = pid.toLowerCase();

            match = items.find((p) => (p.id || '').toLowerCase() === pidLower);
          }

          // Fallback: match by loginName + principal type
          if (!match) {
            const isGroupPid = /_group:///.test(pid);

            match = items.find(
              (p) => (p.loginName || p.name || '').toLowerCase() === loginName.toLowerCase()
                  && (isGroupPid
                    ? (p.principalType === 'group' || /_group/.test(p.id || ''))
                    : (p.principalType === 'user' || /_user/.test(p.id || ''))),
            );
          }

          if (match) {
            const isGroup = /_group:///.test(pid);
            const resolvedLogin = match.loginName || match.name || loginName;
            const fullName = match.displayName || match.name || '';

            if (isGroup) {
              // For groups, show group name directly (no login suffix)
              updatedMap[pid] = fullName || resolvedLogin;
              changed = true;
            } else if (fullName && fullName !== resolvedLogin) {
              updatedMap[pid] = `${ fullName } (${ resolvedLogin })`;
              changed = true;
            }
          }
        }
      }

      if (changed) {
        this.userMap = updatedMap;
      }
    },

    extractPrincipalDisplayName(principalId) {
      // Extract friendly name from LDAP principal IDs like:
      // "openldap_group://cn=MyGroup,ou=Groups,dc=example,dc=com" → "MyGroup"
      // "openldap_user://uid=jdoe,ou=People,dc=example,dc=com" → "jdoe"
      // "shibboleth_user://user@example.com" → "user@example.com"
      if (!principalId) {
        return '';
      }

      const afterScheme = principalId.replace(/^[^/]*:\/\//, '');

      // Try to extract first RDN value from LDAP DN (cn=, uid=, sAMAccountName=, etc.)
      const rdnMatch = afterScheme.match(/^(?:cn|uid|sAMAccountName|mail)=([^,]+)/i);

      if (rdnMatch) {
        return rdnMatch[1];
      }

      // If it looks like a DN (contains commas and =), extract the first value anyway
      const genericRdn = afterScheme.match(/^([^=]+)=([^,]+)/);

      if (genericRdn) {
        return genericRdn[2];
      }

      return afterScheme;
    },

    getProjectMembers(fullId, shortId) {
      const bindings = this._bindings || [];

      const mapped = bindings.filter((b) => {
        return this.bindingMatchesProject(b, fullId, shortId);
      }).map((b) => {
        const userName = b.userName || '';
        const principalId = b.userPrincipalName || '';
        const groupPrincipalId = b.groupPrincipalName || '';
        const groupName = groupPrincipalId
          ? (this.userMap[groupPrincipalId] || this.extractPrincipalDisplayName(groupPrincipalId))
          : '';
        // Resolve: prefer principal-based friendly name, then userMap, then raw userName
        const principalFriendly = principalId ? this.extractPrincipalDisplayName(principalId) : '';
        const displayName = this.userMap[principalId]
          || this.userMap[userName]
          || principalFriendly
          || userName
          || groupName
          || '—';

        return {
          id:          b.id || b.metadata?.name,
          userName,
          principalId,
          displayName,
          role:        b.roleTemplateName || '',
          roleRank:    this.roleRank(b.roleTemplateName),
        };
      });

      // Deduplicate: one entry per user, keeping the binding with the highest role rank.
      const seen = new Map();

      for (const entry of mapped) {
        const key = entry.principalId || entry.userName || entry.displayName;

        if (!key) {
          continue;
        }
        const existing = seen.get(key);

        if (!existing || entry.roleRank > existing.roleRank) {
          seen.set(key, entry);
        }
      }

      return Array.from(seen.values());
    },

    roleRank(roleName) {
      const role = String(roleName || '').toLowerCase();

      if (role.includes('owner')) {
        return 3;
      }

      if (role.includes('member')) {
        return 2;
      }

      if (role.includes('read')) {
        return 1;
      }

      return 0;
    },

    roleFromRank(rank) {
      if (rank >= 3) {
        return 'project-owner';
      }

      if (rank >= 2) {
        return 'project-member';
      }

      return 'read-only';
    },

    normalizeProjectId(projectId) {
      return String(projectId || '').trim().replace('/', ':');
    },

    projectIdShort(projectId) {
      const normalized = this.normalizeProjectId(projectId);

      return normalized.includes(':') ? normalized.split(':').slice(1).join(':') : normalized;
    },

    bindingMatchesProject(binding, fullId, shortId) {
      const bindingProject = this.normalizeProjectId(binding?.projectName);
      const bindingShort = this.projectIdShort(bindingProject);
      const bindingNamespace = String(binding?.metadata?.namespace || '').trim();

      return bindingProject === fullId
        || bindingShort === shortId
        || bindingNamespace === shortId;
    },

    principalVariants(principalId) {
      const base = String(principalId || '').trim();

      if (!base) {
        return [];
      }

      const variants = new Set([base, base.toLowerCase()]);

      try {
        const decoded = decodeURIComponent(base);

        variants.add(decoded);
        variants.add(decoded.toLowerCase());
      } catch {
        // keep raw variants only
      }

      const friendly = this.extractPrincipalDisplayName(base);

      if (friendly) {
        variants.add(friendly);
        variants.add(friendly.toLowerCase());
      }

      return [...variants];
    },

    isBindingForCurrentUser(binding) {
      const userName = String(binding?.userName || '').toLowerCase();
      const principal = String(binding?.userPrincipalName || '').trim();
      const groupPrincipal = String(binding?.groupPrincipalName || '').trim();
      const groupName = String(binding?.groupName || '').trim().toLowerCase();
      const meUser = String(this.currentUser.username || '').toLowerCase();
      const meId = String(this.currentUser.id || '').toLowerCase();
      const principalSet = new Set();
      const groupNameSet = new Set((this.currentUser.groupNames || []).map((g) => String(g || '').trim().toLowerCase()).filter(Boolean));

      for (const pid of (this.currentUser.principalIds || [])) {
        for (const variant of this.principalVariants(pid)) {
          principalSet.add(variant);
        }
      }

      const bindingPrincipals = [principal, groupPrincipal].filter(Boolean);

      for (const bindingPrincipal of bindingPrincipals) {
        for (const variant of this.principalVariants(bindingPrincipal)) {
          if (principalSet.has(variant)) {
            return true;
          }
        }
      }

      if (userName && (userName === meUser || userName === meId)) {
        return true;
      }

      if (groupName && groupNameSet.has(groupName)) {
        return true;
      }

      return false;
    },

    isRoleBindingForCurrentUser(binding) {
      const subjects = Array.isArray(binding?.subjects) ? binding.subjects : [];

      return subjects.some((subject) => {
        const kind = String(subject?.kind || '').toLowerCase();
        const name = String(subject?.name || '').trim();

        if (!name) {
          return false;
        }

        if (kind === 'user' || kind === 'group') {
          const lowerName = name.toLowerCase();
          const principalSet = new Set((this.currentUser.principalIds || []).map((p) => String(p || '').toLowerCase()));
          const friendlyPrincipalSet = new Set((this.currentUser.principalIds || [])
            .map((p) => this.extractPrincipalDisplayName(p).toLowerCase())
            .filter(Boolean));
          const meUser = String(this.currentUser.username || '').toLowerCase();
          const meId = String(this.currentUser.id || '').toLowerCase();

          return principalSet.has(lowerName)
            || friendlyPrincipalSet.has(lowerName)
            || lowerName === meUser
            || lowerName === meId;
        }

        return false;
      });
    },

    getCurrentUserRoleForProject(fullId, shortId) {
      if (this.currentUser.isAdmin) {
        return 'project-owner';
      }

      const bindings = (this._bindings || []).filter((b) => {
        return this.bindingMatchesProject(b, fullId, shortId);
      });

      let maxRank = 0;

      for (const binding of bindings) {
        if (!this.isBindingForCurrentUser(binding)) {
          continue;
        }

        const rank = this.roleRank(binding.roleTemplateName);

        if (rank > maxRank) {
          maxRank = rank;
        }
      }

      return this.roleFromRank(maxRank);
    },

    deleteCredentialTitle(cred, group) {
      if (cred?.hasClusterResources) {
        return this.t('clusterstacks.openstack.credentials.deleteBlocked');
      }

      if (!group?.canDeleteCredential) {
        return 'Not allowed for your project role';
      }

      return this.t('clusterstacks.common.delete');
    },

    // --- Create Project ---
    cancelCreateProject() {
      this.showCreateProject  = false;
      this.newProjectName     = '';
      this.newProjectMembers  = [];
      this.createProjectError = '';
    },

    addNewMember() {
      this.newProjectMembers.push({ principalId: '', displayName: '' });
    },

    removeNewMember(idx) {
      this.newProjectMembers.splice(idx, 1);
    },

    onNewMemberSelected(idx, principal) {
      this.newProjectMembers.splice(idx, 1, {
        principalId:   principal.id || '',
        principalType: principal.principalType || '',
        displayName:   principal.displayName || principal.loginName || '',
      });
    },

    async createProject() {
      if (!this.newProjectName.trim()) {
        return;
      }

      this.creatingProject    = true;
      this.createProjectError = '';

      try {
        const projectName = `cso-${this.newProjectName.trim()}`;
        const resp = await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/v3/projects',
          data:   {
            type:        'project',
            name:        projectName,
            clusterId:   this.clusterId,
            description: 'Created by ClusterStacks UI',
          },
        });

        const newId = resp?.id || '';

        // Create role bindings for all members
        const validMembers = this.newProjectMembers.filter((m) => m.principalId);

        if (validMembers.length && newId) {
          await Promise.allSettled(
            validMembers.map((m) => {
              const isGroup = m.principalType === 'group'
                || /_group:\/\//.test(m.principalId);

              const binding = {
                type:           'projectRoleTemplateBinding',
                projectId:      newId,
                roleTemplateId: 'project-owner',
              };

              if (isGroup) {
                binding.groupPrincipalId = m.principalId;
              } else {
                binding.userPrincipalId = m.principalId;
              }

              return this.$store.dispatch('management/request', {
                method: 'POST',
                url:    '/v3/projectroletemplatebindings',
                data:   binding,
              });
            }),
          );
        }

        this.cancelCreateProject();
        await this.loadAll();
      } catch (e) {
        this.createProjectError = e?.message || e?.data?.message || String(e);
      } finally {
        this.creatingProject = false;
      }
    },

    // --- Credential CRUD ---
    createCredentialInProject(group) {
      if (!group?.canCreateCredential) {
        return;
      }

      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { projectId: group.projectId },
      });
    },

    editCredential(cred, group) {
      if (!cred?.canEditCredential) {
        return;
      }

      if (cred?.fleetManaged) {
        return;
      }

      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { namespace: cred.namespace },
      });
    },

    requestDelete(cred, group) {
      if (!cred?.canDeleteCredential) {
        return;
      }

      if (cred?.fleetManaged) {
        return;
      }

      this.pendingDelete    = cred;
      this.showDeleteDialog = true;
    },

    cancelDelete() {
      this.showDeleteDialog = false;
      this.pendingDelete    = null;
    },

    async confirmDelete() {
      const cred = this.pendingDelete;

      this.showDeleteDialog = false;
      this.pendingDelete    = null;

      if (!cred) {
        return;
      }

      try {
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/api/v1/namespaces/${cred.namespace}/secrets/openstack`,
        });
        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/api/v1/namespaces/${cred.namespace}`,
        });

        const hostname  = hostnameFromAuthUrl(cred.authUrl);
        const stillUsed = hostname && this.credentials.some(
          (c) => c.namespace !== cred.namespace && hostnameFromAuthUrl(c.authUrl) === hostname,
        );

        if (hostname && !stillUsed) {
          await deleteProxyEndpoint(hostname, this.$store);
        }

        await this.loadAll();
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }
    },

    // --- Delete project ---
    requestDeleteProject(group) {
      if (!group?.canDeleteProject) {
        return;
      }

      this.pendingDeleteProject    = group;
      this.showDeleteProjectDialog = true;
    },

    async confirmDeleteProject() {
      const group = this.pendingDeleteProject;

      this.showDeleteProjectDialog = false;
      this.pendingDeleteProject    = null;

      if (!group) {
        return;
      }

      // Show loading state while deleting
      this.loading = true;

      try {
        // Try Steve API first (management.cattle.io.project uses /-separated ID internally)
        const steveId = group.projectId.replace(':', '/');

        await this.$store.dispatch('management/request', {
          method: 'DELETE',
          url:    `/v1/management.cattle.io.projects/${ steveId }`,
        });
      } catch {
        // Fallback: try the K8s API directly
        try {
          const parts = group.projectId.split(':');
          const ns = parts[0] || 'local';
          const name = parts.slice(1).join(':') || group.projectShortName;

          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/apis/management.cattle.io/v3/namespaces/${ ns }/projects/${ name }`,
          });
        } catch (e) {
          console.error('Failed to delete project:', e); // eslint-disable-line no-console
        }
      }

      // Poll until the project is actually gone (max ~10 seconds)
      const steveId = group.projectId.replace(':', '/');

      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));

        try {
          await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/v1/management.cattle.io.projects/${ steveId }`,
          });
          // Still exists, keep waiting
        } catch {
          // 404 = gone, break
          break;
        }
      }

      await this.loadAll();
    },

    // --- Move credential ---
    startMoveCredential(cred, group) {
      if (!cred?.canMoveCredential) {
        return;
      }

      if (cred?.fleetManaged) {
        return;
      }

      this.moveDialog = {
        show:            true,
        cred,
        credName:        cred.name,
        sourceProjectId: group.projectId,
        targetProjectId: '',
        moving:          false,
        error:           '',
      };
    },

    async executeMove() {
      const { cred, targetProjectId } = this.moveDialog;

      if (!cred || !targetProjectId) {
        return;
      }

      this.moveDialog.moving = true;
      this.moveDialog.error  = '';

      try {
        await this.$store.dispatch('management/request', {
          method:  'PATCH',
          url:     `/api/v1/namespaces/${cred.namespace}`,
          headers: { 'Content-Type': 'application/merge-patch+json' },
          data:    JSON.stringify({
            metadata: {
              annotations: { 'field.cattle.io/projectId': targetProjectId },
            },
          }),
        });

        this.moveDialog.show = false;
        await this.loadAll();
      } catch (e) {
        this.moveDialog.error = e?.message || e?.data?.message || String(e);
      } finally {
        this.moveDialog.moving = false;
      }
    },

    // --- Members ---
    openMembersDialog(group) {
      if (!group?.canManageMembers) {
        return;
      }

      this.membersProjectId   = group.projectId;
      this.membersProjectName = group.projectDisplayName;
      this.showMembersDialog  = true;
    },

    async closeMembersDialog() {
      this.showMembersDialog = false;
      await Promise.all([this.loadBindings(), this.loadUsers()]);
      await this.resolvePrincipals();
    },

    async onMembersUpdated() {
      // Live-update parent bindings and user map while dialog is still open
      await Promise.all([this.loadBindings(), this.loadUsers()]);
      await this.resolvePrincipals();
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.openstack-page {
  padding: 20px;
}

header {
  margin-bottom: 20px;
}

.title {
  align-items: center;
  display: flex;
}

header.with-subheader {
  grid-template-areas:
    'type-banner type-banner'
    'title actions'
    'sub-header sub-header'
    'state-banner state-banner';
}

 .sub-header {
  grid-area: sub-header;

  h1 {
    margin: 0;
  }
}

.project-context {
  font-size: 0.9em;
  color: var(--muted);
}

.create-project-card {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--box-bg);

  h3 {
    margin: 0 0 14px;
  }
}

.create-project-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  min-width: 0;
}

.form-hint {
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.85em;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 0.9em;
}

.form-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 0 4px 4px 0;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
}

.create-project-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}

// --- Member rows in create project ---
.member-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row-input {
  display: flex;
  gap: 8px;
  align-items: center;

  .member-role-fixed {
    flex-shrink: 0;
    min-width: 88px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--accent-btn, rgba(0, 0, 0, 0.05));
    color: var(--body-text);
    font-size: 0.9em;
    text-align: center;
  }
}

// --- Project card ---
.project-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.project-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--body-bg);
  overflow: hidden;
}

.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: var(--box-bg);
  border-bottom: 1px solid var(--border);
}

.project-card-title {
  display: flex;
  align-items: center;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 1.05em;
    font-weight: 700;
  }
}

.project-id-badge {
  font-size: 0.75em;
  color: var(--muted);
  background: var(--accent-btn, rgba(0, 0, 0, 0.06));
  padding: 2px 8px;
  border-radius: 3px;
  font-family: monospace;
}

.credential-count {
  font-size: 0.8em;
  color: var(--muted);
}

.project-card-actions {
  display: flex;
  gap: 8px;
}

// --- Members preview ---
.project-members-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  font-size: 0.85em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  background: var(--box-bg);
  opacity: 0.85;

  .icon {
    font-size: 14px;
  }
}

.member-chip {
  color: var(--body-text);
  font-weight: 500;
}

.member-more {
  font-style: italic;
}

// --- Credential table ---
.credential-table {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.credential-table :deep(.sortable-table) {
  min-width: 820px;
}

.credential-sortable-table {
  padding: 6px 14px 12px;
}

.credential-table-header {
  display: flex;
  padding: 10px 20px;
  font-size: 0.78em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  background: var(--box-bg);
}

.credential-table-row {
  display: flex;
  padding: 12px 20px;
  align-items: center;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--accent-btn, rgba(0, 0, 0, 0.02));
  }
}

.col-name {
  flex: 0 0 220px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cred-name-text {
  font-weight: 600;
  color: var(--body-text);
}

.cred-name-link {
  font-weight: 600;
  color: var(--link);

  &:hover {
    text-decoration: underline;
  }
}

.cred-in-use-badge {
  font-size: 0.7em;
  background: var(--warning-banner-bg, #fff3cd);
  color: var(--warning, #856404);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.cred-fleet-managed-badge {
  font-size: 0.7em;
  background: #f59e0b;
  color: #1c1100;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  font-weight: 700;
}

.ns-extra-badge {
  font-size: 0.7em;
  background: var(--info-banner-bg, rgba(0, 120, 212, 0.12));
  color: var(--info, #0078d4);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.col-auth {
  display: block;
  color: var(--body-text);
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quota-mini-loading {
  color: var(--muted);
}

.quota-mini-list {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quota-mini-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.quota-mini-bar-wrap {
  width: 44px;
  height: 8px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}

.quota-mini-bar-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 120ms ease;
}

.quota-mini-value {
  min-height: 12px;
  font-size: 0.62em;
  color: var(--body-text);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.quota-mini-label {
  font-size: 0.62em;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.03em;
}

.mono {
  font-family: monospace;
}

.project-empty {
  padding: 24px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 0.9em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.ml-10 {
  margin-left: 10px;
}

// --- Move dialog ---
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-container {
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-sm {
  width: 480px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.1em;
  }
}

.modal-close-btn {
  padding: 4px;
  min-height: unset;

  .icon {
    font-size: 18px;
  }
}

.modal-body {
  padding: 20px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}

.form-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
}

.full-width {
  width: 100%;
}

// --- Shared ---
.btn-delete {
  background-color: var(--error, #b91c1c);
  border-color: var(--error, #b91c1c);
  color: #fff;

  &:not(:disabled):hover {
    background-color: var(--error-hover, #991b1b);
    border-color: var(--error-hover, #991b1b);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.banner {
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 0.9em;
  word-break: break-word;

  &.banner-error {
    background: var(--error-banner-bg, #fde8e8);
    border: 1px solid var(--error, #c9302c);
    color: var(--error, #7f1d1d);
  }
}

.mt-10 {
  margin-top: 10px;
}

@media (max-width: 1024px) {
  .create-project-inputs {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .openstack-page {
    padding: 16px;
  }

  header.with-subheader {
    align-items: flex-start;
    gap: 10px;
  }

  .member-row-input {
    flex-wrap: wrap;
  }

  .create-project-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .project-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .project-card-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .credential-sortable-table {
    padding: 6px 8px 10px;
  }

  .credential-table :deep(.sortable-table) {
    min-width: 740px;
  }

  .credential-table :deep(.sortable-table .row-actions),
  .credential-table :deep(.sortable-table .actions),
  .credential-table :deep(.sortable-table .col-actions) {
    width: 42px;
    min-width: 42px;
    padding-left: 4px;
    padding-right: 4px;
  }

  .credential-table :deep(.sortable-table td),
  .credential-table :deep(.sortable-table th) {
    padding-left: 8px;
    padding-right: 8px;
  }
}
</style>
