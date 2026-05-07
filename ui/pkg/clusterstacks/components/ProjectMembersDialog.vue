<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ t('clusterstacks.projectMembers.title') }}: {{ projectName }}</h3>
        <button class="btn btn-sm role-link modal-close-btn" @click="$emit('close')">
          <i class="icon icon-close" />
        </button>
      </div>

      <div v-if="loading" class="modal-loading">
        <i class="icon icon-spinner icon-spin" />
        {{ t('clusterstacks.common.loading') }}
      </div>

      <div v-else class="modal-body">
        <!-- Existing members -->
        <div v-if="members.length" class="members-list">
          <SortableTable
            :rows="members"
            :headers="memberHeaders"
            :search="false"
            :paging="false"
            :table-actions="false"
            :row-actions="false"
            key-field="id"
            default-sort-by="displayName"
          >
            <template #cell:principal="{row}">
              <div class="member-principal-cell">
                <Principal
                  v-if="row.principalId || row.groupPrincipalId"
                  :value="row.principalId || row.groupPrincipalId"
                  :use-muted="false"
                />
                <span v-else class="member-name">{{ row.displayName }}</span>
                <i v-if="row._saving" class="icon icon-spinner icon-spin member-spinner" />
              </div>
            </template>
            <template #cell:role="{row}">
              <span class="member-role">{{ row.roleLabel }}</span>
            </template>
            <template #cell:actions="{row}">
              <button
                class="btn btn-sm role-link member-remove-btn"
                :disabled="saving"
                :title="t('clusterstacks.projectMembers.removeMember')"
                @click="removeMember(row)"
              >
                <i class="icon icon-trash" />
              </button>
            </template>
          </SortableTable>
        </div>
        <div v-else class="no-members">
          {{ t('clusterstacks.projectMembers.noMembers') }}
        </div>

        <!-- Add member form -->
        <div class="add-member-section">
          <h4>{{ t('clusterstacks.projectMembers.addMember') }}</h4>
          <div class="add-member-form">
            <UserSearchInput
              :value="newMemberName"
              :placeholder="t('clusterstacks.projectMembers.usernamePlaceholder')"
              :disabled="saving"
              @input="newMemberName = $event"
              @select="onUserSelected"
            />
            <span class="member-role add-member-role-fixed">{{ t('clusterstacks.projectMembers.roleOwner') }}</span>
            <button
              class="btn btn-sm role-primary"
              :disabled="!newMemberPrincipalId || saving"
              @click="addMember"
            >
              {{ t('clusterstacks.projectMembers.add') }}
            </button>
          </div>
        </div>

        <div v-if="error" class="banner banner-error mt-10">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import UserSearchInput from './UserSearchInput.vue';
import SortableTable from '@shell/components/SortableTable';
import Principal from '@shell/components/auth/Principal';

const CAPI_ROLE_TEMPLATE = 'clusterstacks-capi-access';

export default {
  name: 'ProjectMembersDialog',

  components: {
    Principal,
    SortableTable,
    UserSearchInput,
  },

  props: {
    isOpen: {
      type:    Boolean,
      default: false,
    },
    projectId: {
      type:    String,
      default: '',
    },
    projectName: {
      type:    String,
      default: '',
    },
  },

  emits: ['close', 'update'],

  data() {
    return {
      members:              [],
      capiBindings:         [],
      userMap:              {},
      loading:              false,
      saving:               false,
      error:                '',
      newMemberName:        '',
      newMemberPrincipalId: '',
      newMemberPrincipalType: '',
    };
  },

  computed: {
    memberHeaders() {
      return [
        {
          name:  'principal',
          label: 'User',
          value: 'displayName',
          width: '50%',
        },
        {
          name:  'role',
          label: 'Role',
          value: 'roleLabel',
          width: '35%',
        },
        {
          name:     'actions',
          label:    '',
          value:    'id',
          width:    '15%',
          sort:     false,
        },
      ];
    },

    shortProjectId() {
      if (!this.projectId) {
        return '';
      }

      return this.projectId.includes(':')
        ? this.projectId.split(':').slice(1).join(':')
        : this.projectId;
    },
  },

  watch: {
    isOpen(val) {
      if (val && this.projectId) {
        this.loadMembers();
      }
    },
  },

  methods: {
    isClusterManagementRole(roleTemplateName) {
      const role = String(roleTemplateName || '').toLowerCase();

      return role === 'project-owner' || role === 'project-member';
    },

    roleLabel(roleTemplateName) {
      const role = String(roleTemplateName || '').toLowerCase();

      if (role === 'project-owner') {
        return this.t('clusterstacks.projectMembers.roleOwner');
      }

      if (role === 'project-member') {
        return this.t('clusterstacks.projectMembers.roleMember');
      }

      if (role === 'read-only') {
        return this.t('clusterstacks.projectMembers.roleReadOnly');
      }

      return roleTemplateName || this.t('clusterstacks.projectMembers.roleOwner');
    },

    async loadMembers() {
      this.loading = true;
      this.error   = '';
      this.members = [];

      try {
        // Load users first for display name resolution
        await this.loadUsers();

        const all = await this.$store.dispatch('management/findAll', {
          type: 'management.cattle.io.projectroletemplatebinding',
          opt:  { force: true },
        });

        const allProjectBindings = (all || []).filter(
          (b) => b.projectName === this.projectId
              || b.metadata?.namespace === this.shortProjectId
              || (b.projectName || '').endsWith(`:${this.shortProjectId}`)
        );

        // Separate auto-managed CAPI role bindings from user-visible bindings
        this.capiBindings = allProjectBindings.filter((b) => b.roleTemplateName === CAPI_ROLE_TEMPLATE);
        const filtered = allProjectBindings.filter((b) => b.roleTemplateName !== CAPI_ROLE_TEMPLATE);

        // Resolve principal display names via Rancher principals API
        await this.resolvePrincipals(filtered);

        this.members = filtered.map((b) => {
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
            id:               b.id || b.metadata?.name,
            namespace:        b.metadata?.namespace,
            name:             b.metadata?.name,
            userName,
            principalId,
            groupPrincipalId,
            displayName,
            roleTemplateName: b.roleTemplateName || '',
            roleLabel:        this.roleLabel(b.roleTemplateName || ''),
            raw:              b,
          };
        });
      } catch (e) {
        this.error = e?.message || String(e);
      } finally {
        this.loading = false;
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

          if (GENERIC_NAMES.includes((displayName || '').toLowerCase())) {
            map[id] = username;
            map[username] = username;
          } else {
            map[id] = displayName;
            map[username] = displayName;
          }
          for (const pid of (u.principalIds || [])) {
            const isExternal = pid && !pid.startsWith('local://');

            if (isExternal) {
              const friendlyName = this.extractPrincipalDisplayName(pid);
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

    onUserSelected(user) {
      this.newMemberName         = user.displayName || user.loginName || '';
      this.newMemberPrincipalId   = user.id || '';
      this.newMemberPrincipalType = user.principalType || '';
    },

    extractPrincipalDisplayName(principalId) {
      if (!principalId) {
        return '';
      }

      const afterScheme = principalId.replace(/^[^/]*:\/\//, '');
      const rdnMatch = afterScheme.match(/^(?:cn|uid|sAMAccountName|mail)=([^,]+)/i);

      if (rdnMatch) {
        return rdnMatch[1];
      }

      const genericRdn = afterScheme.match(/^([^=]+)=([^,]+)/);

      if (genericRdn) {
        return genericRdn[2];
      }

      return afterScheme;
    },

    async resolvePrincipals(bindings) {
      // Resolve display names for ALL external principals (users AND groups)
      const toResolve = new Map();

      for (const b of (bindings || [])) {
        const pids = [
          b.userPrincipalName || '',
          b.groupPrincipalName || '',
        ].filter((pid) => pid && !pid.startsWith('local://'));

        for (const pid of pids) {
          const friendly = this.extractPrincipalDisplayName(pid);
          const current = this.userMap[pid];
          const GENERIC_NAMES = ['default admin', 'admin'];

          const needsResolve = !current
            || current === friendly
            || current === pid
            || GENERIC_NAMES.includes((current || '').toLowerCase());

          if (needsResolve) {
            toResolve.set(pid, friendly);
          }
        }
      }

      if (!toResolve.size) {
        return;
      }

      const updatedMap = { ...this.userMap };
      let changed = false;

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
          let match = items.find((p) => p.id === pid);

          if (!match) {
            const pidLower = pid.toLowerCase();

            match = items.find((p) => (p.id || '').toLowerCase() === pidLower);
          }

          if (!match) {
            const isGroupPid = /_group:\/\//.test(pid);

            match = items.find(
              (p) => (p.loginName || p.name || '').toLowerCase() === loginName.toLowerCase()
                  && (isGroupPid
                    ? (p.principalType === 'group' || /_group/.test(p.id || ''))
                    : (p.principalType === 'user' || /_user/.test(p.id || ''))),
            );
          }

          if (match) {
            const isGroup = /_group:\/\//.test(pid);
            const resolvedLogin = match.loginName || match.name || loginName;
            const fullName = match.displayName || match.name || '';

            if (isGroup) {
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

    async addMember() {
      if (!this.newMemberPrincipalId) {
        return;
      }

      this.saving = true;
      this.error  = '';

      // Add optimistic placeholder member immediately
      const optimisticId = `_pending_${ Date.now() }`;
      const optimisticMember = {
        id:               optimisticId,
        displayName:      this.newMemberName || this.newMemberPrincipalId,
        principalId:      this.newMemberPrincipalType === 'group' ? '' : this.newMemberPrincipalId,
        groupPrincipalId: this.newMemberPrincipalType === 'group' ? this.newMemberPrincipalId : '',
        roleTemplateName: 'project-owner',
        roleLabel:        this.roleLabel('project-owner'),
        userName:         '',
        _saving:          true,
      };

      this.members.push(optimisticMember);

      try {
        // Rancher v3 expects projectId in colon format (e.g. "local:p-xxxxx")
        const isGroup = this.newMemberPrincipalType === 'group'
          || /_group:\/\//.test(this.newMemberPrincipalId);

        const body = {
          type:           'projectRoleTemplateBinding',
          projectId:      this.projectId,
          roleTemplateId: 'project-owner',
        };

        if (isGroup) {
          body.groupPrincipalId = this.newMemberPrincipalId;
        } else {
          body.userPrincipalId = this.newMemberPrincipalId;
        }

        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/v3/projectroletemplatebindings',
          data:   body,
        });

        if (this.isClusterManagementRole('project-owner')) {
          // Auto-assign CAPI access role for editable project members only.
          await this.ensureCapiBinding(body);
        }

        this.newMemberName         = '';
        this.newMemberPrincipalId  = '';
        this.newMemberPrincipalType = '';
        // Reload to get proper binding metadata for the newly added member
        await this.loadMembers();
        this.$emit('update');
      } catch (e) {
        // Remove the optimistic placeholder on failure
        const idx = this.members.findIndex((m) => m.id === optimisticId);

        if (idx !== -1) {
          this.members.splice(idx, 1);
        }
        this.error = e?.message || e?.data?.message || String(e);
      } finally {
        this.saving = false;
      }
    },

    async removeMember(member) {
      this.saving = true;
      this.error  = '';

      // Remove from local array immediately for instant feedback
      const idx = this.members.findIndex((m) => m.id === member.id);
      const removed = idx !== -1 ? this.members.splice(idx, 1)[0] : null;

      try {
        const ns   = member.namespace || member.raw?.metadata?.namespace;
        const name = member.name || member.raw?.metadata?.name;

        if (member.raw?.links?.remove) {
          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    member.raw.links.remove,
          });
        } else {
          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/v3/projectRoleTemplateBindings/${ns}:${name}`,
          });
        }

        // Also remove auto-managed CAPI binding for this member
        await this.removeCapiBindingFor(
          member.raw?.userPrincipalName || '',
          member.raw?.groupPrincipalName || '',
        );

        this.$emit('update');
      } catch (e) {
        // Re-insert the member on failure so the UI stays consistent
        if (removed && idx !== -1) {
          this.members.splice(idx, 0, removed);
        }
        this.error = e?.message || e?.data?.message || String(e);
      } finally {
        this.saving = false;
      }
    },

    async ensureCapiBinding({ userPrincipalId, groupPrincipalId }) {
      try {
        const exists = this.capiBindings.some((b) =>
          (userPrincipalId && b.userPrincipalName === userPrincipalId)
          || (groupPrincipalId && b.groupPrincipalName === groupPrincipalId)
        );

        if (exists) {
          return;
        }

        const data = {
          type:           'projectRoleTemplateBinding',
          projectId:      this.projectId,
          roleTemplateId: CAPI_ROLE_TEMPLATE,
        };

        if (userPrincipalId) {
          data.userPrincipalId = userPrincipalId;
        }
        if (groupPrincipalId) {
          data.groupPrincipalId = groupPrincipalId;
        }

        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/v3/projectroletemplatebindings',
          data,
        });
      } catch {
        // RoleTemplate may not be installed — silent
      }
    },

    async removeCapiBindingFor(principalId, groupPrincipalId) {
      const capiBinding = this.capiBindings.find((b) =>
        (principalId && b.userPrincipalName === principalId)
        || (groupPrincipalId && b.groupPrincipalName === groupPrincipalId)
      );

      if (!capiBinding) {
        return;
      }

      try {
        if (capiBinding.links?.remove) {
          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    capiBinding.links.remove,
          });
        } else {
          const ns   = capiBinding.metadata?.namespace;
          const name = capiBinding.metadata?.name;

          await this.$store.dispatch('management/request', {
            method: 'DELETE',
            url:    `/v3/projectRoleTemplateBindings/${ ns }:${ name }`,
          });
        }
      } catch {
        // silent
      }
    },

    /**
     * Find management clusters imported from CAPI clusters in the project's
     * namespaces and create/remove ClusterRoleTemplateBindings so that
     * project members can access these clusters from the Rancher dashboard.
     */
    async syncClusterAccessBindings({ userPrincipalId, groupPrincipalId, userName }, action) {
      try {
        // Resolve the project's namespaces
        const shortId = this.shortProjectId;

        if (!shortId) {
          return;
        }

        // Find CAPI clusters in the project's namespace(s)
        let mgmtClusters;

        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    '/apis/management.cattle.io/v3/clusters',
          });

          mgmtClusters = resp?.items || [];
        } catch {
          mgmtClusters = await this.$store.dispatch('management/findAll', {
            type: 'management.cattle.io.cluster',
            opt:  { force: true },
          }) || [];
        }

        // Find management clusters whose CAPI source is in this project's namespace
        // The namespace = shortProjectId pattern matches project namespaces created
        // by the extension (e.g., "proj-abc" namespace for project "local:proj-abc")
        const projectNamespaces = await this.getProjectNamespaces(shortId);
        const matchingClusters = mgmtClusters.filter((mc) => {
          const labels = mc.metadata?.labels || {};
          const annotations = mc.metadata?.annotations || {};
          const displayName = mc.spec?.displayName || '';

          // Check if any project namespace has a CAPI cluster matching this mgmt cluster
          return projectNamespaces.some((ns) => {
            return labels['cluster.x-k8s.io/cluster-name']
              || annotations['cluster.x-k8s.io/cluster-name']
              || displayName;
          });
        });

        // For matching CAPI clusters, find the ones whose displayName or labels
        // reference a cluster in one of our project namespaces
        const relevantClusters = [];

        for (const mc of matchingClusters) {
          const capiName = mc.metadata?.labels?.['cluster.x-k8s.io/cluster-name']
            || mc.metadata?.annotations?.['cluster.x-k8s.io/cluster-name']
            || mc.spec?.displayName
            || '';

          if (!capiName) {
            continue;
          }

          // Verify the CAPI cluster exists in one of our project namespaces
          for (const ns of projectNamespaces) {
            try {
              await this.$store.dispatch('management/request', {
                method: 'GET',
                url:    `/apis/cluster.x-k8s.io/v1beta2/namespaces/${ ns }/clusters/${ capiName }`,
              });
              relevantClusters.push(mc);
              break;
            } catch {
              // not in this namespace
            }
          }
        }

        for (const mc of relevantClusters) {
          const clusterId = mc.metadata?.name;

          if (!clusterId) {
            continue;
          }

          if (action === 'add') {
            await this.ensureCrtb(clusterId, { userPrincipalId, groupPrincipalId, userName });
          } else if (action === 'remove') {
            await this.removeCrtb(clusterId, { userPrincipalId, groupPrincipalId, userName });
          }
        }
      } catch {
        // Cluster access binding sync is best-effort
      }
    },

    async getProjectNamespaces(shortProjectId) {
      try {
        const allNs = await this.$store.dispatch('management/request', {
          method: 'GET',
          url:    '/api/v1/namespaces',
        });

        return (allNs?.items || [])
          .filter((ns) => {
            const projectAnno = ns.metadata?.annotations?.['field.cattle.io/projectId'] || '';

            return projectAnno.endsWith(`:${ shortProjectId }`)
              || projectAnno === shortProjectId;
          })
          .map((ns) => ns.metadata?.name);
      } catch {
        return [shortProjectId];
      }
    },

    async ensureCrtb(clusterId, { userPrincipalId, groupPrincipalId, userName }) {
      try {
        // Check existing CRTBs
        let existing = [];

        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/management.cattle.io/v3/namespaces/${ clusterId }/clusterroletemplatebindings`,
          });

          existing = resp?.items || [];
        } catch {
          return;
        }

        const alreadyExists = existing.some((crtb) => {
          if (crtb.roleTemplateName !== 'cluster-owner') {
            return false;
          }
          if (userPrincipalId && crtb.userPrincipalName === userPrincipalId) {
            return true;
          }
          if (groupPrincipalId && crtb.groupPrincipalName === groupPrincipalId) {
            return true;
          }
          if (userName && crtb.userName === userName) {
            return true;
          }

          return false;
        });

        if (alreadyExists) {
          return;
        }

        const crtbData = {
          apiVersion:       'management.cattle.io/v3',
          kind:             'ClusterRoleTemplateBinding',
          metadata:         {
            generateName: 'crtb-cso-',
            namespace:    clusterId,
          },
          clusterName:      clusterId,
          roleTemplateName: 'cluster-owner',
        };

        if (userPrincipalId) {
          crtbData.userPrincipalName = userPrincipalId;
        } else if (groupPrincipalId) {
          crtbData.groupPrincipalName = groupPrincipalId;
        } else if (userName) {
          crtbData.userName = userName;
        }

        await this.$store.dispatch('management/request', {
          method:  'POST',
          url:     `/apis/management.cattle.io/v3/namespaces/${ clusterId }/clusterroletemplatebindings`,
          headers: { 'Content-Type': 'application/json' },
          data:    JSON.stringify(crtbData),
        });
      } catch {
        // silent
      }
    },

    async removeCrtb(clusterId, { userPrincipalId, groupPrincipalId, userName }) {
      try {
        let existing = [];

        try {
          const resp = await this.$store.dispatch('management/request', {
            method: 'GET',
            url:    `/apis/management.cattle.io/v3/namespaces/${ clusterId }/clusterroletemplatebindings`,
          });

          existing = resp?.items || [];
        } catch {
          return;
        }

        // Find cluster-owner CRTBs for this member
        const toRemove = existing.filter((crtb) => {
          if (crtb.roleTemplateName !== 'cluster-owner') {
            return false;
          }
          if (userPrincipalId && crtb.userPrincipalName === userPrincipalId) {
            return true;
          }
          if (groupPrincipalId && crtb.groupPrincipalName === groupPrincipalId) {
            return true;
          }
          if (userName && crtb.userName === userName) {
            return true;
          }

          return false;
        });

        for (const crtb of toRemove) {
          try {
            await this.$store.dispatch('management/request', {
              method: 'DELETE',
              url:    `/apis/management.cattle.io/v3/namespaces/${ clusterId }/clusterroletemplatebindings/${ crtb.metadata?.name }`,
            });
          } catch {
            // silent
          }
        }
      } catch {
        // silent
      }
    },

    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
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
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: visible;
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

.modal-loading {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  overflow-x: visible;
}

.add-member-section {
  position: relative;
  overflow: visible;
}

.members-list {
  margin-bottom: 20px;
}

.member-principal-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  font-weight: 600;
  color: var(--body-text);
}

.member-username {
  font-size: 0.85em;
  color: var(--muted);
}

.member-role {
  font-size: 0.85em;
  color: var(--muted);
  padding: 2px 8px;
  background: var(--accent-btn);
  border-radius: 3px;
}

.add-member-role-fixed {
  white-space: nowrap;
}

.member-spinner {
  font-size: 14px;
  color: var(--muted);
}

.member-remove-btn {
  color: var(--error);
  padding: 4px 8px;
  min-height: unset;

  &:hover {
    color: var(--error-hover, #991b1b);
  }
}

.no-members {
  padding: 20px;
  text-align: center;
  color: var(--muted);
  margin-bottom: 20px;
}

.add-member-section {
  border-top: 1px solid var(--border);
  padding-top: 16px;

  h4 {
    margin: 0 0 10px;
    font-size: 0.95em;
  }
}

.add-member-form {
  display: flex;
  gap: 8px;
  align-items: center;

  .role-select {
    width: 160px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--input-bg, var(--box-bg));
    color: var(--body-text);
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

:deep(.sortable-table-header .actions),
:deep(td.col-actions) {
  text-align: right;
}

:deep(.v-select.vs--open) {
  z-index: 20000;
}

:deep(.vs__dropdown-menu) {
  z-index: 20001 !important;
}
</style>
