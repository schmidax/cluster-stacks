<template>
  <div class="user-search" :class="{ 'is-open': showDropdown && results.length }">
    <input
      ref="input"
      v-model="query"
      type="text"
      class="user-search-input"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.down.prevent="highlightNext"
      @keydown.up.prevent="highlightPrev"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="closeDropdown"
    />
    <i v-if="searching" class="icon icon-spinner icon-spin search-indicator" />

    <div
      v-if="showDropdown && results.length"
      class="user-dropdown"
      :style="dropdownStyle"
      @mousedown.prevent
    >
      <div
        v-for="(user, idx) in results"
        :key="user.id"
        class="user-option"
        :class="{ highlighted: idx === highlightIndex }"
        @mousedown.prevent="selectUser(user)"
      >
        <span class="user-display-name">{{ user.displayName || user.loginName }}</span>
        <span
          v-if="user.loginName && user.loginName !== (user.displayName || '')"
          class="user-login-name"
        >
          ({{ user.loginName }})
        </span>
        <span v-if="user.provider" class="user-provider">
          {{ user.provider }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UserSearchInput',

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
  },

  emits: ['input', 'select'],

  data() {
    return {
      query:          this.value || '',
      results:        [],
      searching:      false,
      showDropdown:   false,
      highlightIndex: -1,
      debounceTimer:  null,
      dropdownStyle:  {},
    };
  },

  watch: {
    value(val) {
      if (val !== this.query) {
        this.query = val;
      }
    },
  },

  methods: {
    async searchPrincipals(term) {
      if (!term || term.length < 2) {
        this.results = [];

        return;
      }

      this.searching = true;

      try {
        const resp = await this.$store.dispatch('management/request', {
          method: 'POST',
          url:    '/v3/principals?action=search',
          data:   { name: term },
        });

        // Handle both { data: [...] } and direct array responses
        const items = Array.isArray(resp) ? resp : (resp?.data || []);

        this.results = items.map((p) => ({
          id:            p.id || '',
          displayName:   p.displayName || p.name || p.id || '',
          loginName:     p.loginName || '',
          principalType: p.principalType || '',
          provider:      p.provider || '',
        }));
      } catch {
        // Fallback: try Steve API for local users
        try {
          const users = await this.$store.dispatch('management/findAll', {
            type: 'management.cattle.io.user',
          });

          const q = term.toLowerCase();

          this.results = (users || [])
            .filter((u) => {
              return (u.username || '').toLowerCase().includes(q)
                  || (u.displayName || '').toLowerCase().includes(q);
            })
            .slice(0, 20)
            .map((u) => ({
              id:            u.principalIds?.[0] || `local://${ u.metadata?.name || '' }`,
              displayName:   u.displayName || u.name || u.username || '',
              loginName:     u.username || u.metadata?.name || '',
              principalType: 'user',
              provider:      'local',
            }));
        } catch {
          this.results = [];
        }
      } finally {
        this.searching = false;
      }
    },

    onInput() {
      this.$emit('input', this.query);
      this.highlightIndex = -1;

      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        this.searchPrincipals(this.query);
        this.showDropdown = true;
        this.$nextTick(() => this.updateDropdownPosition());
      }, 300);
    },

    onFocus() {
      this.updateDropdownPosition();

      if (this.query && this.query.length >= 2) {
        this.searchPrincipals(this.query);
      }
      this.showDropdown = true;
    },

    updateDropdownPosition() {
      const el = this.$refs.input;

      if (!el) {
        return;
      }

      const rect = el.getBoundingClientRect();

      this.dropdownStyle = {
        position: 'fixed',
        top:      `${ rect.bottom }px`,
        left:     `${ rect.left }px`,
        width:    `${ rect.width }px`,
        zIndex:   99999,
      };
    },

    onBlur() {
      // Delay to allow mousedown on dropdown items
      setTimeout(() => {
        this.showDropdown = false;
      }, 200);
    },

    closeDropdown() {
      this.showDropdown = false;
    },

    highlightNext() {
      if (this.highlightIndex < this.results.length - 1) {
        this.highlightIndex++;
      }
    },

    highlightPrev() {
      if (this.highlightIndex > 0) {
        this.highlightIndex--;
      }
    },

    selectHighlighted() {
      if (this.highlightIndex >= 0 && this.highlightIndex < this.results.length) {
        this.selectUser(this.results[this.highlightIndex]);
      }
    },

    selectUser(user) {
      this.query = user.displayName || user.loginName;
      this.showDropdown = false;
      this.$emit('input', user.displayName || user.loginName);
      this.$emit('select', user);
    },
  },
};
</script>

<style lang="scss" scoped>
.user-search {
  position: relative;
  flex: 1;
}

.user-search-input {
  width: 100%;
  padding: 6px 10px;
  padding-right: 30px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
  font-size: 0.9em;

  &:focus {
    outline: none;
    border-color: var(--link);
  }
}

.search-indicator {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--muted);
}

.user-dropdown {
  position: fixed;
  max-height: 240px;
  overflow-y: auto;
  background: var(--body-bg);
  border: 1px solid var(--border);
  border-radius: 0 0 4px 4px;
  z-index: 99999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.user-option {
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  gap: 6px;
  align-items: baseline;

  &:hover,
  &.highlighted {
    background: var(--accent-btn, rgba(0, 0, 0, 0.05));
  }
}

.user-display-name {
  font-weight: 600;
  color: var(--body-text);
  font-size: 0.9em;
}

.user-login-name {
  font-size: 0.85em;
  color: var(--muted);
  font-weight: 400;
}

.user-provider {
  font-size: 0.75em;
  color: var(--muted);
  margin-left: auto;
  opacity: 0.7;
}
</style>
