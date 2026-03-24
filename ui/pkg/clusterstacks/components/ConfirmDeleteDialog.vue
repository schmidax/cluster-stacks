<template>
  <transition name="dialog-fade">
    <div v-if="isOpen" class="dialog-overlay" @mousedown.self="cancel">
      <div class="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <div class="dialog-header">
          <h2 :id="titleId">{{ t('clusterstacks.dialog.delete.title') }}</h2>
        </div>

        <div class="dialog-body">
          <p class="dialog-message">
            {{ t('clusterstacks.dialog.delete.message', { name: confirmationValue }) }}
          </p>
          <p class="dialog-hint">
            {{ t('clusterstacks.dialog.delete.typeHint', { name: confirmationValue }) }}
          </p>
          <input
            ref="input"
            v-model="typed"
            type="text"
            class="dialog-input"
            :placeholder="confirmationValue"
            @keydown.enter="submit"
            @keydown.esc="cancel"
          />
        </div>

        <div class="dialog-footer">
          <button class="btn role-secondary" @click="cancel">
            {{ t('clusterstacks.common.cancel') }}
          </button>
          <button
            class="btn btn-delete"
            :disabled="typed !== confirmationValue"
            @click="submit"
          >
            {{ t('clusterstacks.common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
let _uid = 0;

export default {
  name: 'ConfirmDeleteDialog',

  props: {
    isOpen: {
      type:    Boolean,
      default: false,
    },
    confirmationValue: {
      type:     String,
      required: true,
    },
  },

  emits: ['confirm', 'cancel'],

  data() {
    _uid += 1;

    return {
      typed:   '',
      titleId: `confirm-delete-title-${ _uid }`,
    };
  },

  watch: {
    isOpen(val) {
      if (val) {
        this.typed = '';
        this.$nextTick(() => {
          this.$refs.input?.focus();
        });
      }
    },
  },

  methods: {
    submit() {
      if (this.typed !== this.confirmationValue) {
        return;
      }
      this.typed = '';
      this.$emit('confirm');
    },

    cancel() {
      this.typed = '';
      this.$emit('cancel');
    },

    t(key, args) {
      return this.$store.getters['i18n/t'](key, args);
    },
  },
};
</script>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: var(--box-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  width: 480px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  padding: 20px 24px 0;

  h2 {
    margin: 0;
    font-size: 1.15em;
    font-weight: 700;
    color: var(--body-text);
  }
}

.dialog-body {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-message {
  margin: 0;
  color: var(--body-text);
}

.dialog-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.9em;
}

.dialog-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-bg, var(--box-bg));
  color: var(--body-text);
  font-family: monospace;
  font-size: 0.95em;
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.dialog-footer {
  padding: 12px 24px 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}

.btn-delete {
  background-color: var(--error, #b91c1c);
  border-color: var(--error, #b91c1c);
  color: #fff;

  &:not(:disabled):hover {
    background-color: var(--error-hover, #991b1b);
    border-color: var(--error-hover, #991b1b);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

/* Fade transition */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.15s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
