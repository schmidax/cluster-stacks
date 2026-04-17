<template>
  <div class="quota-warning">
    <div v-if="!result?.hasCredentials" class="quota-placeholder">
      <div class="placeholder-text">
        Please select OpenStack project to load quota.
      </div>
    </div>

    <div v-else class="quota-metrics">
      <div
        v-for="metric in metrics"
        :key="metric.key"
        class="quota-gauge-item"
      >
        <div class="quota-gauge-header">
          <span class="quota-gauge-label">{{ metric.label }}</span>
          <span class="quota-gauge-formula">
            <template v-if="metric.hasFreed">
              <span class="formula-part formula-current" :title="`Currently used: ${ metric.currentText }`">{{ metric.currentText }}</span>
              <span class="formula-op">-</span>
              <span class="formula-part formula-freed" :title="`Freed by this edit`">{{ metric.freedText }}</span>
              <template v-if="metric.requested > 0">
                <span class="formula-op">+</span>
                <span class="formula-part formula-requested" :title="`New resources for this cluster`">{{ metric.requestedText }}</span>
              </template>
              <template v-if="metric.buffer > 0">
                <span class="formula-op">+</span>
                <span class="formula-part formula-buffer" :title="`Rolling-update buffer (one extra node during upgrades)`">{{ metric.bufferText }}</span>
              </template>
            </template>
            <template v-else>
              <span class="formula-part formula-current" :title="`Currently used in this project`">{{ metric.currentText }}</span>
              <template v-if="metric.requested > 0">
                <span class="formula-op">+</span>
                <span class="formula-part formula-requested" :title="`Resources requested by this cluster`">{{ metric.requestedText }}</span>
              </template>
              <template v-if="metric.buffer > 0">
                <span class="formula-op">+</span>
                <span class="formula-part formula-buffer" :title="`Rolling-update buffer (one extra node during upgrades)`">{{ metric.bufferText }}</span>
              </template>
            </template>
            <span class="formula-op formula-arrow">=&gt;</span>
            <span class="formula-part formula-projected" :title="`Projected total after operation`">{{ metric.projectedText }}</span>
            <span class="formula-sep">/</span>
            <span class="formula-part formula-limit" :title="`OpenStack quota limit`">{{ metric.limitText }}</span>
          </span>
        </div>

        <div class="metric-bar" :title="metric.barTooltip">
          <div
            class="metric-segment metric-current"
            :style="{ width: `${ metric.currentWidth }%` }"
          />
          <div
            v-if="metric.requestedWidth > 0"
            class="metric-segment metric-requested"
            :style="{ width: `${ metric.requestedWidth }%` }"
          />
          <div
            v-if="metric.bufferWidth > 0"
            class="metric-segment metric-buffer"
            :style="{ width: `${ metric.bufferWidth }%` }"
          />
          <div
            v-if="metric.availableWidth > 0"
            class="metric-segment metric-available"
            :style="{ width: `${ metric.availableWidth }%` }"
          />
          <div
            v-if="metric.exceededWidth > 0"
            class="metric-segment metric-exceeded"
            :style="{ width: `${ metric.exceededWidth }%` }"
          />
        </div>
      </div>
    </div>

    <div v-if="result?.hasCredentials !== false" class="quota-legend">
      <div class="legend-item">
        <span class="legend-color metric-current" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.currentUsed') }}</span>
      </div>
      <div v-if="hasAnyFreed" class="legend-item">
        <span class="legend-color metric-freed" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.freedByEdit') }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color metric-requested" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.requested') }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color metric-buffer" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.buffer') }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color metric-available" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.remaining') }}</span>
      </div>
      <div class="legend-item">
        <span class="legend-color metric-exceeded" />
        <span class="legend-label">{{ t('clusterstacks.quota.legend.overLimit') }}</span>
      </div>
    </div>

    <Banner v-if="checking" color="info" icon="icon-spinner icon-spin">
      {{ t('clusterstacks.quota.checking') }}
    </Banner>

    <Banner v-else-if="result && result.valid && !result.warnings.length" color="success" icon="icon-checkmark">
      {{ t('clusterstacks.quota.valid') }}
    </Banner>

    <Banner v-if="result && result.warnings.length" color="warning" icon="icon-warning">
      <span class="banner-block-title">{{ t('clusterstacks.quota.warning') }}</span>
      <ul class="banner-list">
        <li v-for="(warn, i) in result.warnings" :key="`warn-${ i }`">{{ warn }}</li>
      </ul>
    </Banner>

    <Banner v-if="result && result.errors.length" color="error" icon="icon-error">
      <span class="banner-block-title">{{ t('clusterstacks.quota.error') }}</span>
      <ul class="banner-list">
        <li v-for="(err, i) in result.errors" :key="`err-${ i }`">{{ err }}</li>
      </ul>
    </Banner>
  </div>
</template>

<script>
import Banner from '@components/Banner/Banner.vue';

export default {
  name: 'QuotaWarning',

  components: {
    Banner,
  },

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

  computed: {
    metrics() {
      if (!this.result) {
        return [];
      }

      const metricList = [
        { key: 'instances', value: this.result.instances },
        { key: 'cpu', value: this.result.cpu },
        { key: 'ram', value: this.result.ram },
        { key: 'disk', value: this.result.disk },
      ];

      return metricList
        .filter((m) => m.value && m.value.limit > 0)
        .map((m) => this.normalizeMetric(m.key, m.value));
    },

    hasAnyFreed() {
      return this.metrics.some((m) => m.hasFreed);
    },
  },

  methods: {
    t(key) {
      return this.$store.getters['i18n/t'](key);
    },

    normalizeMetric(key, metric) {
      const limit     = Math.max(0, Number(metric.limit) || 0);
      const current   = Math.max(0, Number(metric.used) || 0);
      const requested = Math.max(0, Number(metric.requested) || 0);
      const buffer    = Math.max(0, Number(metric.buffer) || 0);
      const freed     = Math.max(0, Number(metric.freed) || 0);

      const effectiveUsed = Math.max(0, current - freed);
      const projected     = Math.max(0, Number(metric.projected) || (effectiveUsed + requested + buffer));

      const exceeded = Math.max(0, projected - limit);
      const scale = Math.max(limit, projected, 1);

      const currentCapped   = exceeded > 0 ? Math.min(effectiveUsed, limit) : effectiveUsed;
      const remainCurrent   = Math.max(0, limit - currentCapped);
      const requestedCapped = exceeded > 0 ? Math.min(requested, remainCurrent) : requested;
      const remainRequested = Math.max(0, remainCurrent - requestedCapped);
      const bufferCapped    = exceeded > 0 ? Math.min(buffer, remainRequested) : buffer;

      const currentWidth   = (currentCapped / scale) * 100;
      const requestedWidth = (requestedCapped / scale) * 100;
      const bufferWidth    = (bufferCapped / scale) * 100;
      const usedWidth      = currentWidth + requestedWidth + bufferWidth;
      const availableWidth = exceeded > 0 ? 0 : Math.max(0, 100 - usedWidth);
      const exceededWidth  = exceeded > 0 ? (exceeded / scale) * 100 : 0;

      return {
        key,
        label:         metric.label,
        unit:          metric.unit,
        hasFreed:      freed > 0,
        limit,
        projected,
        currentWidth,
        requestedWidth,
        bufferWidth,
        availableWidth,
        exceededWidth,
        // raw numbers for formula conditionals
        requested,
        buffer,
        barTooltip: `${ this.formatValue(projected, metric.unit) } / ${ this.formatValue(limit, metric.unit) }`,
        // formatted text for formula display
        currentText:   this.formatValue(current, metric.unit),
        freedText:     this.formatValue(freed, metric.unit),
        requestedText: this.formatValue(requested, metric.unit),
        bufferText:    this.formatValue(buffer, metric.unit),
        projectedText: this.formatValue(projected, metric.unit),
        limitText:     this.formatValue(limit, metric.unit),
      };
    },

    formatValue(value, unit) {
      if (unit === 'MiB' && value >= 1024) {
        return `${ (value / 1024).toFixed(1) } GiB`;
      }

      return unit ? `${ Math.round(value) } ${ unit }` : `${ Math.round(value) }`;
    },
  },
};
</script>

<style lang="scss" scoped>
.quota-warning {
  margin: 16px 0;
}

.quota-placeholder {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background-color: var(--box-bg);
  text-align: center;
  color: var(--input-placeholder-text);
  font-size: 12px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.quota-metrics {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background-color: var(--box-bg);
}

.quota-gauge-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quota-gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.quota-gauge-label {
  font-weight: 600;
  font-size: 12px;
}

// Formula: "current + requested + buffer → projected / limit"
.quota-gauge-formula {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--input-placeholder-text);
}

.formula-part {
  font-weight: 500;
  cursor: default;
}

.formula-current  { color: var(--success); }
.formula-freed    { color: var(--warning); }
.formula-requested { color: var(--info); }
.formula-buffer   { color: var(--warning); }
.formula-projected { font-weight: 700; color: var(--body-text); }
.formula-limit    { color: var(--input-placeholder-text); }

.formula-op {
  color: var(--input-placeholder-text);
  font-size: 11px;
}

.formula-sep {
  color: var(--input-placeholder-text);
}

.metric-bar {
  display: flex;
  width: 100%;
  height: 15px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--border);
  border: 1px solid var(--border);
}

.metric-segment {
  height: 100%;
}

.metric-current {
  background: var(--success);
}

.metric-requested {
  background: var(--info);
}

.metric-buffer {
  background: var(--warning);
}

.metric-available {
  background: var(--border);
}

.metric-exceeded {
  background: var(--error);
}

.quota-legend {
  display: flex;
  gap: 16px;
  font-size: 11px;
  flex-wrap: wrap;
  padding: 8px 12px 10px 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--input-placeholder-text);
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}

.legend-color.metric-current {
  background: var(--success);
}

.legend-color.metric-freed {
  background: var(--warning);
}

.legend-color.metric-requested {
  background: var(--info);
}

.legend-color.metric-buffer {
  background: var(--warning);
}

.legend-color.metric-available {
  background: var(--border);
  border: 1px solid var(--muted);
}

.legend-color.metric-exceeded {
  background: var(--error);
}

.legend-label {
  white-space: nowrap;
}

.banner-block-title {
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.banner-list {
  margin: 0;
  padding-left: 18px;

  li { margin-bottom: 2px; }
}
</style>
