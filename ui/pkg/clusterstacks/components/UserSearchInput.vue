<template>
  <div class="user-search">
    <SelectPrincipal
      class="user-search-native"
      :mode="disabled ? 'view' : 'edit'"
      :project="project"
      :search-group-types="searchGroupTypes"
      @add="onPrincipalAdd"
    />

    <div v-if="selectedDisplayName" class="selected-principal-hint">
      {{ selectedDisplayName }}
    </div>
  </div>
</template>

<script>
import SelectPrincipal from '@shell/components/auth/SelectPrincipal';

export default {
  name: 'UserSearchInput',

  components: { SelectPrincipal },

  props: {
    value: {
      type:    String,
      default: '',
    },
    placeholder: {
      type:    String,
      default: 'Search users...',
    },
    disabled: {
      type:    Boolean,
      default: false,
    },
    project: {
      type:    Boolean,
      default: false,
    },
    searchGroupTypes: {
      type:    String,
      default: null,
    },
  },

  emits: ['input', 'select'],

  data() {
    return {
      selectedDisplayName: this.value || '',
    };
  },

  watch: {
    value(val) {
      if (val !== this.selectedDisplayName) {
        this.selectedDisplayName = val;
      }
    },
  },

  methods: {
    extractPrincipalDisplayName(principalId) {
      const afterScheme = String(principalId || '').replace(/^[^/]*:\/\//, '');
      const parts = afterScheme.split('/').filter(Boolean);

      return decodeURIComponent(parts.at(-1) || String(principalId || ''));
    },

    async onPrincipalAdd(principalId) {
      if (!principalId) {
        return;
      }

      let principal = null;

      try {
        principal = this.$store.getters['rancher/byId']('principal', principalId);

        if (!principal) {
          const escapedId = encodeURIComponent(String(principalId || '')).replace(/%2F/g, '%2F');

          principal = await this.$store.dispatch('rancher/find', {
            type: 'principal',
            id:   principalId,
            opt:  { url: `/v3/principals/${ escapedId }` },
          });
        }
      } catch {
        principal = null;
      }

      const user = {
        id:            principal?.id || principalId,
        displayName:   principal?.displayName || principal?.name || principal?.loginName || this.extractPrincipalDisplayName(principalId),
        loginName:     principal?.loginName || '',
        principalType: principal?.principalType || '',
        provider:      principal?.provider || '',
      };

      this.selectedDisplayName = user.displayName;
      this.$emit('input', user.displayName);
      this.$emit('select', user);
    },
  },
};
</script>

<style lang="scss" scoped>
.user-search {
  flex: 1;
}

.selected-principal-hint {
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.85em;
}

:deep(.user-search-native .labeled-select) {
  margin: 0;
}
</style>

<style lang="scss">
/*
 * SelectPrincipal may render dropdown menus in a context outside scoped styles.
 * Keep the menu above modal overlays used by member dialogs.
 */
.v-select.vs--open {
  z-index: 21000;
}

.vs__dropdown-menu {
  z-index: 21001 !important;
}
</style>
