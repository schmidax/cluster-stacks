import { IPlugin } from '@shell/core/types';

export const PRODUCT_NAME = 'clusterstacks';
export const BLANK_CLUSTER = '_';

// Route name constants
export const ROUTES = {
  DASHBOARD:            'clusterstacks-dashboard',
  CLUSTERS:             'clusterstacks-clusters',
  CLUSTERS_CREATE:      'clusterstacks-clusters-create',
  STACKS:               'clusterstacks-stacks',
  OPENSTACK:            'clusterstacks-openstack',
  OPENSTACK_CREATE:     'clusterstacks-openstack-create',
  OPENSTACK_RESOURCES:  'clusterstacks-openstack-resources',
};

// Navigation type IDs
export const NAV = {
  DASHBOARD:            'clusterstacks-dashboard',
  CLUSTERS:             'clusterstacks-clusters',
  STACKS:               'clusterstacks-stacks',
  OPENSTACK:            'clusterstacks-openstack',
  OPENSTACK_RESOURCES:  'clusterstacks-openstack-resources',
};

export function init($plugin: IPlugin, store: any) {
  const {
    product,
    basicType,
    virtualType,
    configureType,
    weightType,
  } = $plugin.DSL(store, PRODUCT_NAME);

  // Register the product
  product({
    inStore:             'management',
    icon:                'cluster-management',
    label:               'ClusterStacks',
    to:                  { name: ROUTES.DASHBOARD },
    removable:           false,
    showClusterSwitcher: true,
    category:            'global',
  });

  // Dashboard (landing page)
  virtualType({
    name:       NAV.DASHBOARD,
    labelKey:   'clusterstacks.nav.dashboard',
    route:      { name: ROUTES.DASHBOARD },
    icon:       'gear',
    weight:     100,
  });

  // Clusters menu item
  virtualType({
    name:       NAV.CLUSTERS,
    labelKey:   'clusterstacks.nav.clusters',
    route:      { name: ROUTES.CLUSTERS },
    icon:       'cluster',
    weight:     90,
  });

  configureType(NAV.CLUSTERS, {
    isCreatable:  true,
    isEditable:   true,
    isRemovable:  true,
    showAge:      true,
    showState:    true,
  });

  // ClusterStacks menu item
  virtualType({
    name:       NAV.STACKS,
    labelKey:   'clusterstacks.nav.stacks',
    route:      { name: ROUTES.STACKS },
    icon:       'copy',
    weight:     80,
  });

  // OpenStack Projects menu item (credentials list)
  virtualType({
    name:       NAV.OPENSTACK,
    labelKey:   'clusterstacks.nav.openstackCredentials',
    route:      { name: ROUTES.OPENSTACK },
    icon:       'key',
    weight:     71,
  });

  configureType(NAV.OPENSTACK, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
  });

  // OpenStack Resources menu item
  virtualType({
    name:       NAV.OPENSTACK_RESOURCES,
    labelKey:   'clusterstacks.nav.openstackResources',
    route:      { name: ROUTES.OPENSTACK_RESOURCES },
    icon:       'globe',
    weight:     70,
  });

  // Add all nav items to the sidebar, OpenStack items in their own group
  basicType([
    NAV.DASHBOARD,
    NAV.CLUSTERS,
    NAV.STACKS,
  ]);
  basicType([
    NAV.OPENSTACK,
    NAV.OPENSTACK_RESOURCES,
  ], 'OpenStack');

  // Weight the nav types so they appear in the right order
  weightType(NAV.DASHBOARD,           100, true);
  weightType(NAV.CLUSTERS,             90, true);
  weightType(NAV.STACKS,               80, true);
  weightType(NAV.OPENSTACK,            71, true);
  weightType(NAV.OPENSTACK_RESOURCES,  70, true);
}
