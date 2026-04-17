<template>
  <div class="cluster-create-page">
    <CruClusterStacks
      :mode="mode"
      :value="resource"
    />
  </div>
</template>

<script>
import { _CREATE, _EDIT } from '@shell/config/query-params';
import CruClusterStacks from '../../components/CruClusterStacks.vue';

export default {
  name: 'ClusterCreate',

  components: { CruClusterStacks },

  data() {
    return {
      resource: {},
    };
  },

  computed: {
    mode() {
      return (this.$route.query.name && this.$route.query.namespace) ? _EDIT : _CREATE;
    },
  },
};
</script>

<style lang="scss" scoped>
.cluster-create-page {
  padding: 20px;
}
</style>
