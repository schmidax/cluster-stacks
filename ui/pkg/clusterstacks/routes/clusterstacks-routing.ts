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
];

export default routes;
