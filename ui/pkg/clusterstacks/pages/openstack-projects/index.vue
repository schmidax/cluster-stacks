<template>
  <div class="openstack-page">
    <div class="page-header">
      <h1>{{ t('clusterstacks.openstack.title') }}</h1>
      <button class="btn role-primary" @click="showCreateProject = true">
        <i class="icon icon-plus" />
        {{ t('clusterstacks.openstack.createProjectBtn') }}
      </button>
    </div>

    <!-- Create Project inline form -->
    <div v-if="showCreateProject" class="create-project-card">
      <h3>{{ t('clusterstacks.openstack.createProjectTitle') }}</h3>
      <div class="create-project-form">
        <div class="create-project-inputs">
          <div class="form-group">
            <label class="form-label">{{ t('clusterstacks.openstack.projectNameLabel') }}</label>
            <div class="input-with-prefix">
              <span class="input-prefix">cso-</span>
              <input
                v-model="newProjectName"
                type="text"
                class="form-input"
                :placeholder="t('clusterstacks.openstack.projectNamePlaceholder')"
              />
            </div>
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
                <select v-model="member.role" class="form-select role-select">
                  <option value="project-owner">{{ t('clusterstacks.projectMembers.roleOwner') }}</option>
                  <option value="project-member">{{ t('clusterstacks.projectMembers.roleMember') }}</option>
                  <option value="read-only">{{ t('clusterstacks.projectMembers.roleReadOnly') }}</option>
                </select>
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
    <div v-else-if="projectGroups.length" class="project-list">
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
              v-if="group.projectId !== '__no_project__'"
              class="btn btn-sm role-secondary"
              @click="openMembersDialog(group)"
            >
              <i class="icon icon-user" />
              {{ t('clusterstacks.openstack.manageOwners') }}
            </button>
            <button
              v-if="group.projectId !== '__no_project__'"
              class="btn btn-sm role-primary"
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
          <div class="credential-table-header">
            <div class="col-name">{{ t('clusterstacks.openstack.credential.name') }}</div>
            <div class="col-auth">{{ t('clusterstacks.openstack.credential.authUrl') }}</div>
            <div class="col-project">{{ t('clusterstacks.openstack.credential.osProject') }}</div>
            <div class="col-actions" />
          </div>
          <div
            v-for="cred in group.credentials"
            :key="cred.namespace"
            class="credential-table-row"
          >
            <div class="col-name">
              <span class="cred-name-text">{{ cred.name }}</span>
              <span v-if="cred.hasClusterResources" class="cred-in-use-badge">
                {{ t('clusterstacks.openstack.inUse') }}
              </span>
            </div>
            <div class="col-auth mono">{{ cred.authUrl }}</div>
            <div class="col-project">{{ cred.osProjectName || '—' }}</div>
            <div class="col-actions">
              <button class="btn btn-sm role-secondary" :title="t('clusterstacks.common.edit')" @click="editCredential(cred)">
                <i class="icon icon-edit" />
              </button>
              <button
                class="btn btn-sm role-secondary"
                :title="t('clusterstacks.openstack.moveCred.title')"
                @click="startMoveCredential(cred, group)"
              >
                <i class="icon icon-fork" />
              </button>
              <button
                class="btn btn-sm btn-delete"
                :disabled="cred.hasClusterResources"
                :title="cred.hasClusterResources ? t('clusterstacks.openstack.credentials.deleteBlocked') : t('clusterstacks.common.delete')"
                @click="requestDelete(cred)"
              >
                <i class="icon icon-trash" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty project -->
        <div v-else class="project-empty">
          <span>{{ t('clusterstacks.openstack.noCredentials') }}</span>
          <button
            v-if="group.projectId !== '__no_project__'"
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
          <label class="form-label">{{ t('clusterstacks.openstack.moveCred.targetProject') }}</label>
          <select v-model="moveDialog.targetProjectId" class="form-select full-width">
            <option value="">{{ t('clusterstacks.openstack.moveCred.selectProject') }}</option>
            <option
              v-for="p in moveTargetProjects"
              :key="p.id"
              :value="p.id"
            >
              {{ p.displayName }}
            </option>
          </select>
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
import { ROUTES } from '../../config/clusterstacks';
import { parseCloudsYaml } from '../../services/openstack-api';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog.vue';
import ProjectMembersDialog from '../../components/ProjectMembersDialog.vue';
import UserSearchInput from '../../components/UserSearchInput.vue';

export default {
  name: 'OpenstackProjectsOverview',

  components: { ConfirmDeleteDialog, ProjectMembersDialog, UserSearchInput },

  data() {
    return {
      loading:            true,
      credentials:        [],
      projects:           [],
      userMap:            {},
      _bindings:          [],

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
    };
  },

  computed: {
    clusterId() {
      const raw = this.$route.params.cluster;

      return raw === '_' ? 'local' : raw;
    },

    csoProjects() {
      return this.projects.filter(
        (p) => (p.spec?.displayName || p.metadata?.name || '').startsWith('cso-'),
      );
    },

    projectGroups() {
      const groups = [];
      const assignedNamespaces = new Set();

      for (const proj of this.csoProjects) {
        // Steve API returns IDs as "local/p-xxxxx" but annotations use "local:p-xxxxx"
        const fullId = (proj.id || '').replace('/', ':');
        const shortId = fullId.includes(':') ? fullId.split(':').slice(1).join(':') : fullId;
        const displayName = proj.spec?.displayName || proj.metadata?.name || shortId;

        const projectCreds = this.credentials.filter((c) => {
          if (!c.projectId) {
            return false;
          }
          const credShort = c.projectId.includes(':') ? c.projectId.split(':').slice(1).join(':') : c.projectId;

          return c.projectId === fullId || credShort === shortId;
        });

        projectCreds.forEach((c) => assignedNamespaces.add(c.namespace));

        const members = this.getProjectMembers(fullId, shortId);

        groups.push({
          projectId:          fullId,
          projectShortName:   shortId,
          projectDisplayName: displayName,
          credentials:        projectCreds,
          members,
        });
      }

      // Add unassigned credentials under "No Project" group
      const unassigned = this.credentials.filter((c) => !assignedNamespaces.has(c.namespace));

      if (unassigned.length) {
        groups.push({
          projectId:          '__no_project__',
          projectShortName:   '',
          projectDisplayName: this.t('clusterstacks.openstack.credentials.noProject'),
          credentials:        unassigned,
          members:            [],
        });
      }

      return groups;
    },

    moveTargetProjects() {
      return this.csoProjects
        .filter((p) => (p.id || '').replace('/', ':') !== this.moveDialog.sourceProjectId)
        .map((p) => ({
          id:          (p.id || '').replace('/', ':'),
          displayName: p.spec?.displayName || p.metadata?.name || p.id,
        }));
    },
  },

  async mounted() {
    await this.loadAll();
  },

  methods: {
    async loadAll() {
      this.loading = true;

      try {
        await Promise.all([
          this.loadCredentials(),
          this.loadProjects(),
          this.loadUsers(),
          this.loadBindings(),
        ]);
        await this.resolvePrincipals();
      } finally {
        this.loading = false;
      }
    },

    async loadCredentials() {
      try {
        const nsResponse = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });
        const csoNamespaces = (nsResponse?.items || []).filter(
          (ns) => ns.metadata.name.startsWith('cso-') && ns.metadata.name !== 'cso-system',
        );

        const results = await Promise.allSettled(
          csoNamespaces.map(async(ns) => {
            const [secretResult, clusterResult] = await Promise.allSettled([
              this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/api/v1/namespaces/${ns.metadata.name}/secrets/openstack`,
              }),
              this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/apis/cluster.x-k8s.io/v1beta1/namespaces/${ns.metadata.name}/clusters`,
              }),
            ]);

            if (secretResult.status === 'rejected') {
              return null;
            }

            return {
              secret:              secretResult.value,
              namespace:           ns,
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
            const projectId = nsObj?.metadata?.annotations?.['field.cattle.io/projectId'] || '';
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
              hasClusterResources,
            };
          });
      } catch {
        this.credentials = [];
      }
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
          const resp = await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    '/v3/principals?action=search',
            data:   { name: loginName },
          });

          // Handle both { data: [...] } and direct array responses
          const items = Array.isArray(resp) ? resp : (resp?.data || []);

          return { loginName, pids, items };
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

          // Fallback: match by loginName + user type
          if (!match) {
            match = items.find(
              (p) => (p.loginName || '').toLowerCase() === loginName.toLowerCase()
                  && (p.principalType === 'user' || /_user/.test(p.id || '')),
            );
          }

          if (match) {
            const resolvedLogin = match.loginName || loginName;
            const fullName = match.displayName || match.name || '';

            if (fullName && fullName !== resolvedLogin) {
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

      return bindings.filter((b) => {
        return b.projectName === fullId
          || b.metadata?.namespace === shortId
          || (b.projectName || '').endsWith(`:${shortId}`);
      }).map((b) => {
        const userName = b.userName || '';
        const principalId = b.userPrincipalName || '';
        const groupName = b.groupPrincipalName
          ? this.extractPrincipalDisplayName(b.groupPrincipalName)
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
          displayName,
          role:        b.roleTemplateName || '',
        };
      });
    },

    // --- Create Project ---
    cancelCreateProject() {
      this.showCreateProject  = false;
      this.newProjectName     = '';
      this.newProjectMembers  = [];
      this.createProjectError = '';
    },

    addNewMember() {
      this.newProjectMembers.push({ principalId: '', displayName: '', role: 'project-owner' });
    },

    removeNewMember(idx) {
      this.newProjectMembers.splice(idx, 1);
    },

    onNewMemberSelected(idx, principal) {
      this.newProjectMembers.splice(idx, 1, {
        principalId: principal.id || '',
        displayName: principal.displayName || principal.loginName || '',
        role:        this.newProjectMembers[idx]?.role || 'project-owner',
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
            validMembers.map((m) => this.$store.dispatch('management/request', {
              method: 'POST',
              url:    '/v3/projectroletemplatebindings',
              data:   {
                type:            'projectRoleTemplateBinding',
                projectId:       newId,
                roleTemplateId:  m.role || 'project-owner',
                userPrincipalId: m.principalId,
              },
            })),
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
      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { projectId: group.projectId },
      });
    },

    editCredential(cred) {
      this.$router.push({
        name:  ROUTES.OPENSTACK_CREATE,
        query: { namespace: cred.namespace },
      });
    },

    requestDelete(cred) {
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
        await this.loadAll();
      } catch (e) {
        console.error(e); // eslint-disable-line no-console
      }
    },

    // --- Delete project ---
    requestDeleteProject(group) {
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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.loading-indicator {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.no-data {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

// --- Create project card ---
.create-project-card {
  margin-bottom: 24px;
  padding: 16px 20px;
  border: 1px dashed var(--link);
  border-radius: 6px;
  background: var(--box-bg);

  h3 {
    margin: 0 0 14px;
    font-size: 1em;
  }
}

.create-project-inputs {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;

  .form-group {
    flex: 1;
  }
}

.form-label {
  display: block;
  font-size: 0.85em;
  font-weight: 500;
  margin-bottom: 4px;
}

.input-with-prefix {
  display: flex;
  align-items: stretch;

  .input-prefix {
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--accent-btn, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--border);
    border-right: none;
    border-radius: 4px 0 0 4px;
    font-family: monospace;
    font-size: 0.9em;
    color: var(--muted);
  }

  .form-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 0 4px 4px 0;
    background: var(--input-bg, var(--box-bg));
    color: var(--body-text);
  }
}

.create-project-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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

  .role-select {
    width: 140px;
    flex-shrink: 0;
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

.cred-in-use-badge {
  font-size: 0.7em;
  background: var(--warning-banner-bg, #fff3cd);
  color: var(--warning, #856404);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.col-auth {
  flex: 1;
  color: var(--body-text);
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-project {
  flex: 0 0 180px;
  color: var(--body-text);
  font-size: 0.9em;
}

.col-actions {
  flex: 0 0 130px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
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
</style>
