<template>
  <div class="labeled-input" :class="{ disabled }">
    <label>
      {{ label }}<span v-if="required" class="required">*</span>
    </label>
    <input
      :value="modelValue"
      :type="type || 'text'"
      :disabled="disabled"
      :required="required"
      :placeholder="placeholder"
      :min="min"
      v-bind="$attrs"
      @input="onInput"
    />
  </div>
</template>

<script>
export default {
  name: 'LabeledInput',

  inheritAttrs: false,

  props: {
    modelModifiers: {
      type:    Object,
      default: () => ({}),
    },
    modelValue: {
      type:    [String, Number],
      default: '',
    },
    label: {
      type:    String,
      default: '',
    },
    placeholder: {
      type:    String,
      default: '',
    },
    required: {
      type:    Boolean,
      default: false,
    },
    disabled: {
      type:    Boolean,
      default: false,
    },
    type: {
      type:    String,
      default: 'text',
    },
    min: {
      type:    [String, Number],
      default: undefined,
    },
  },

  emits: ['update:modelValue'],

  methods: {
    onInput(event) {
      let value = event.target.value;
      if (this.modelModifiers?.number) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          value = num;
        }
      }
      this.$emit('update:modelValue', value);
    },
  },
</script>

<style lang="scss" scoped>
.labeled-input {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.disabled {
    opacity: 0.6;
  }

  label {
    font-size: 0.875em;
    font-weight: 500;
    color: var(--input-label);
  }

  .required {
    color: var(--error);
    margin-left: 2px;
  }

  input {
    padding: 8px 10px;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--body-text);
    font-size: 1em;
    width: 100%;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }

    &:disabled {
      background: var(--disabled-bg);
      cursor: not-allowed;
    }
  }
}
</style>
