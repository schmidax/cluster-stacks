<template>
  <div class="quota-warning">
    <!-- Checking state -->
    <div v-if="checking" class="banner banner-info">
      <i class="icon icon-spinner icon-spin" />
      {{ t('clusterstacks.quota.checking') }}
    </div>

    <!-- Valid -->
    <div v-else-if="result && result.valid && !result.warnings.length" class="banner banner-success">
      <i class="icon icon-checkmark" />
      {{ t('clusterstacks.quota.valid') }}
    </div>

    <!-- Warnings -->
    <div v-if="result && result.warnings.length" class="banner banner-warning">
      <div class="banner-title">
        <i class="icon icon-warning" />
        {{ t('clusterstacks.quota.warning') }}
      </div>
      <ul class="banner-list">
        <li v-for="(warn, i) in result.warnings" :key="i">{{ warn }}</li>
      </ul>
    </div>

    <!-- Errors -->
    <div v-if="result && result.errors.length" class="banner banner-error">
      <div class="banner-title">
        <i class="icon icon-error" />
        {{ t('clusterstacks.quota.error') }}
      </div>
      <ul class="banner-list">
        <li v-for="(err, i) in result.errors" :key="i">{{ err }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuotaWarning',

  props: {
    result: {
      type:    Object,
      default: null,
    },
    checking: {
      type:    Boolean,
      default: false,
    },
  },

  methods: {
    t(key) {
      return this.$store.getters['i18n/t'](key);
    },
  },
};
</script>

<style lang="scss" scoped>
.quota-warning {
  margin: 16px 0;
}

.banner {
  margin-bottom: 8px;
}

.banner-title {
  font-weight: 600;
  margin-bottom: 6px;

  i { margin-right: 6px; }
}

.banner-list {
  margin: 0;
  padding-left: 20px;

  li { margin-bottom: 2px; }
}
</style>
