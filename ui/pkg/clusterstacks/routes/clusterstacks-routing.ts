import { RouteConfig } from 'vue-router';
import { PRODUCT_NAME, ROUTES } from '../config/clusterstacks';

const CLUSTER_PREFIX = `/c/:cluster/${PRODUCT_NAME}`;

const routes: RouteConfig[] = [
  // Dashboard / Landing page
  {
    name:      ROUTES.DASHBOARD,
    path:      `${CLUSTER_PREFIX}`,
    component: () => import(/* webpackChunkName: "clusterstacks-dashboard" */ '../pages/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // Clusters list
  {
    name:      ROUTES.CLUSTERS,
    path:      `${CLUSTER_PREFIX}/clusters`,
    component: () => import(/* webpackChunkName: "clusterstacks-clusters" */ '../pages/clusters/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // Cluster create / edit
  {
    name:      ROUTES.CLUSTERS_CREATE,
    path:      `${CLUSTER_PREFIX}/clusters/create`,
    component: () => import(/* webpackChunkName: "clusterstacks-clusters-create" */ '../pages/clusters/create.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // ClusterStacks overview
  {
    name:      ROUTES.STACKS,
    path:      `${CLUSTER_PREFIX}/stacks`,
    component: () => import(/* webpackChunkName: "clusterstacks-stacks" */ '../pages/clusterstacks/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // ClusterStack create
  {
    name:      ROUTES.STACKS_CREATE,
    path:      `${CLUSTER_PREFIX}/stacks/create`,
    component: () => import(/* webpackChunkName: "clusterstacks-stacks-create" */ '../pages/clusterstacks/create.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // CSO Management
  {
    name:      ROUTES.CSO_MANAGEMENT,
    path:      `${CLUSTER_PREFIX}/cso`,
    component: () => import(/* webpackChunkName: "clusterstacks-cso-management" */ '../pages/cso-management/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // OpenStack projects list
  {
    name:      ROUTES.OPENSTACK,
    path:      `${CLUSTER_PREFIX}/openstack`,
    component: () => import(/* webpackChunkName: "clusterstacks-openstack" */ '../pages/openstack-projects/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // OpenStack credential create
  {
    name:      ROUTES.OPENSTACK_CREATE,
    path:      `${CLUSTER_PREFIX}/openstack/create`,
    component: () => import(/* webpackChunkName: "clusterstacks-openstack-create" */ '../pages/openstack-projects/create.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // OpenStack resources overview
  {
    name:      ROUTES.OPENSTACK_RESOURCES,
    path:      `${CLUSTER_PREFIX}/openstack/resources`,
    component: () => import(/* webpackChunkName: "clusterstacks-openstack-resources" */ '../pages/openstack-projects/resources.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // CAPI Providers list
  {
    name:      ROUTES.CAPI_PROVIDERS,
    path:      `${CLUSTER_PREFIX}/capi-providers`,
    component: () => import(/* webpackChunkName: "clusterstacks-capi-providers" */ '../pages/capi-providers/index.vue'),
    meta:      { product: PRODUCT_NAME },
  },

  // CAPI Provider create / edit
  {
    name:      ROUTES.CAPI_PROVIDERS_CREATE,
    path:      `${CLUSTER_PREFIX}/capi-providers/create`,
    component: () => import(/* webpackChunkName: "clusterstacks-capi-providers-create" */ '../pages/capi-providers/create.vue'),
    meta:      { product: PRODUCT_NAME },
  },
];

export default routes;
