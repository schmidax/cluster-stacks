<template>
  <label class="labeled-checkbox">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="checkbox-label">{{ label }}</span>
  </label>
</template>

<script>
export default {
  name: 'Checkbox',

  props: {
    modelValue: {
      type:    Boolean,
      default: false,
    },
    label: {
      type:    String,
      default: '',
    },
    disabled: {
      type:    Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue'],
};
</script>

<style lang="scss" scoped>
.labeled-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary);
  }

  .checkbox-label {
    font-size: 0.9em;
    color: var(--body-text);
  }
}
</style>
