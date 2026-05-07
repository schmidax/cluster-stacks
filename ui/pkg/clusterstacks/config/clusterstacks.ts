export const PRODUCT_NAME = 'clusterstacks';
export const BLANK_CLUSTER = '_';

// Route name constants
export const ROUTES = {
  DASHBOARD:              'clusterstacks-dashboard',
  CLUSTERS:               'clusterstacks-clusters',
  CLUSTERS_CREATE:        'clusterstacks-clusters-create',
  CLUSTERS_STATUS:        'clusterstacks-clusters-status',
  CLUSTERS_DETAIL:        'clusterstacks-clusters-detail',
  STACKS:                 'clusterstacks-stacks',
  STACKS_CREATE:          'clusterstacks-stacks-create',
  CSO_MANAGEMENT:         'clusterstacks-cso-management',
  OPENSTACK:              'clusterstacks-openstack', // route name stays, path changes
  OPENSTACK_DETAIL:       'clusterstacks-openstack-detail',
  OPENSTACK_CREATE:       'clusterstacks-openstack-create',
  OPENSTACK_RESOURCES:      'clusterstacks-openstack-resources',
  OPENSTACK_OBJECTSTORAGE:  'clusterstacks-openstack-objectstorage',
  CAPI_PROVIDERS:           'clusterstacks-capi-providers',
  CAPI_PROVIDERS_CREATE:  'clusterstacks-capi-providers-create',
};

// Navigation type IDs
export const NAV = {
  DASHBOARD:            'clusterstacks-dashboard',
  CLUSTERS:             'clusterstacks-clusters',
  STACKS:               'clusterstacks-stacks',
  CSO_MANAGEMENT:       'clusterstacks-cso-management',
  OPENSTACK:            'clusterstacks-openstack',
  CAPI_PROVIDERS:           'clusterstacks-capi-providers',
};

// Set to false to remove the "Clusters" menu entry from the ClusterStacks sidebar.
export const SHOW_CLUSTERS_NAV = true;

// Admin nav items are always registered; page guards protect the actual pages.
// (The v3User object from the store does not carry role information at plugin init time.)

export function init($plugin: any, store: any) {
  const {
    product,
    basicType,
    virtualType,
    configureType,
    weightType,
  } = $plugin.DSL(store, PRODUCT_NAME);
  const showAdminNav = true; // Page guards handle actual access control

  // Register the product
  product({
    inStore:             'management',
    icon:                'scs-logo',
    label:               'ClusterStacks',
    to:                  { name: ROUTES.DASHBOARD, params: { cluster: BLANK_CLUSTER } },
    removable:           false,
    showClusterSwitcher: true,
    category:            'global',
  });

  // Dashboard (landing page)
  virtualType({
    name:       NAV.DASHBOARD,
    labelKey:   'clusterstacks.nav.dashboard',
    route:      { name: ROUTES.DASHBOARD, params: { cluster: BLANK_CLUSTER } },
    icon:       'gear',
    weight:     100,
  });

  // Clusters menu item (optional)
  if (SHOW_CLUSTERS_NAV) {
    virtualType({
      name:       NAV.CLUSTERS,
      labelKey:   'clusterstacks.nav.clusters',
      route:      { name: ROUTES.CLUSTERS, params: { cluster: BLANK_CLUSTER } },
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
  }

  // ClusterStacks menu item – Stacks sub-item
  virtualType({
    name:       NAV.STACKS,
    labelKey:   'clusterstacks.nav.stacks',
    route:      { name: ROUTES.STACKS, params: { cluster: BLANK_CLUSTER } },
    icon:       'copy',
    weight:     81,
  });

  // ClusterStacks menu item – Management sub-item (admin only)
  if (showAdminNav) {
    virtualType({
      name:       NAV.CSO_MANAGEMENT,
      labelKey:   'clusterstacks.nav.csoManagement',
      route:      { name: ROUTES.CSO_MANAGEMENT, params: { cluster: BLANK_CLUSTER } },
      icon:       'gear',
      weight:     80,
    });
  }

  // OpenStack Projects menu item (credentials list)
  virtualType({
    name:       NAV.OPENSTACK,
    labelKey:   'clusterstacks.nav.openstack',
    route:      { name: ROUTES.OPENSTACK, params: { cluster: BLANK_CLUSTER } },
    icon:       'key',
    weight:     71,
  });

  configureType(NAV.OPENSTACK, {
    isCreatable: true,
    isEditable:  true,
    isRemovable: true,
  });

  // CAPI Providers menu item (admin only)
  if (showAdminNav) {
    virtualType({
      name:       NAV.CAPI_PROVIDERS,
      labelKey:   'clusterstacks.nav.capiProviders',
      route:      { name: ROUTES.CAPI_PROVIDERS, params: { cluster: BLANK_CLUSTER } },
      icon:       'cluster-management',
      weight:     60,
    });

    configureType(NAV.CAPI_PROVIDERS, {
      isCreatable: true,
      isEditable:  true,
      isRemovable: true,
    });
  }

  // Add all nav items to the sidebar
  const topLevelNav = [NAV.DASHBOARD, NAV.OPENSTACK];

  if (SHOW_CLUSTERS_NAV) {
    topLevelNav.push(NAV.CLUSTERS);
  }

  basicType(topLevelNav);
  // ClusterStacks group: Stacks + optional admin entries
  const clusterStacksNav = [NAV.STACKS];

  if (showAdminNav) {
    clusterStacksNav.push(NAV.CSO_MANAGEMENT, NAV.CAPI_PROVIDERS);
  }

  basicType(clusterStacksNav, 'ClusterStacks');
  // Weight the nav types so they appear in the right order
  weightType(NAV.DASHBOARD,           100, true);
  if (SHOW_CLUSTERS_NAV) {
    weightType(NAV.CLUSTERS,           90, true);
  }
  weightType(NAV.STACKS,               81, true);
  if (showAdminNav) {
    weightType(NAV.CSO_MANAGEMENT,     80, true);
    weightType(NAV.CAPI_PROVIDERS,     60, true);
  }
  weightType(NAV.OPENSTACK,            71, true);
}
