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
          <div v-for="member in members" :key="member.id" class="member-row">
            <div class="member-info">
              <span class="member-name">{{ member.displayName }}</span>
              <span class="member-role">{{ member.roleTemplateName }}</span>
            </div>
            <button
              class="btn btn-sm role-link member-remove-btn"
              :disabled="saving"
              :title="t('clusterstacks.projectMembers.removeMember')"
              @click="removeMember(member)"
            >
              <i class="icon icon-trash" />
            </button>
          </div>
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
            <select v-model="newMemberRole" class="form-select role-select" :disabled="saving">
              <option value="project-owner">
                {{ t('clusterstacks.projectMembers.roleOwner') }}
              </option>
              <option value="project-member">
                {{ t('clusterstacks.projectMembers.roleMember') }}
              </option>
              <option value="read-only">
                {{ t('clusterstacks.projectMembers.roleReadOnly') }}
              </option>
            </select>
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

export default {
  name: 'ProjectMembersDialog',

  components: { UserSearchInput },

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
      userMap:              {},
      loading:              false,
      saving:               false,
      error:                '',
      newMemberName:        '',
      newMemberPrincipalId: '',
      newMemberRole:        'project-owner',
    };
  },

  computed: {
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

        const filtered = (all || []).filter(
          (b) => b.projectName === this.projectId
              || b.metadata?.namespace === this.shortProjectId
              || (b.projectName || '').endsWith(`:${this.shortProjectId}`)
        );

        // Resolve principal display names via Rancher principals API
        await this.resolvePrincipals(filtered);

        this.members = filtered.map((b) => {
          const userName = b.userName || '';
          console.error(b.userPrincipalName);
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
            id:               b.id || b.metadata?.name,
            namespace:        b.metadata?.namespace,
            name:             b.metadata?.name,
            userName,
            displayName,
            roleTemplateName: b.roleTemplateName || '',
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
      this.newMemberName        = user.displayName || user.loginName || '';
      this.newMemberPrincipalId = user.id || '';
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
      // Resolve display names for user principals via Rancher principals API
      const toResolve = new Map();

      for (const b of (bindings || [])) {
        const pid = b.userPrincipalName || '';

        if (!pid || pid.startsWith('local://') || !/_user:\/\//.test(pid)) {
          continue;
        }

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
          const resp = await this.$store.dispatch('management/request', {
            method: 'POST',
            url:    '/v3/principals?action=search',
            data:   { name: loginName },
          });

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
          let match = items.find((p) => p.id === pid);

          if (!match) {
            const pidLower = pid.toLowerCase();

            match = items.find((p) => (p.id || '').toLowerCase() === pidLower);
          }

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

    async addMember() {
      if (!this.newMemberPrincipalId) {
        return;
      }

      this.saving = true;
      this.error  = '';

      try {
        // Rancher v3 expects projectId in colon format (e.g. "local:p-xxxxx")
        const body = {
          type:             'projectRoleTemplateBinding',
          projectId:        this.projectId,
          roleTemplateId:   this.newMemberRole,
          userPrincipalId:  this.newMemberPrincipalId,
        };

        await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/v3/projectroletemplatebindings',
          data:   body,
        });

        this.newMemberName        = '';
        this.newMemberPrincipalId = '';
        await this.loadMembers();
        this.$emit('update');
      } catch (e) {
        this.error = e?.message || e?.data?.message || String(e);
      } finally {
        this.saving = false;
      }
    },

    async removeMember(member) {
      this.saving = true;
      this.error  = '';

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

        await this.loadMembers();
        this.$emit('update');
      } catch (e) {
        this.error = e?.message || e?.data?.message || String(e);
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--box-bg);
}

.member-info {
  display: flex;
  gap: 8px;
  align-items: center;
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
</style>
