<template>
  <button
    class="busy-button"
    :disabled="disabled || busy"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <span v-if="busy" class="spinner">
      <i class="icon icon-spinner icon-spin" />
    </span>
    <slot />
  </button>
</template>

<script>
export default {
  name: 'BusyButton',

  inheritAttrs: false,

  props: {
    busy: {
      type:    Boolean,
      default: false,
    },
    disabled: {
      type:    Boolean,
      default: false,
    },
  },

  emits: ['click'],
};
</script>

<style lang="scss" scoped>
.busy-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-flex;
    align-items: center;
  }
}
</style>
