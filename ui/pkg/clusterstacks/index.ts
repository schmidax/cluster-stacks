import { importTypes } from '@rancher/auto-import';
import { ClusterStacksProvisioner } from './provisioner';
import routes from './routes/clusterstacks-routing';
import { ClusterStacksProvisioningExtension } from './models/provisioning-model-extension';

// Global styles – registers the SCS logo icon for the sidebar
import './assets/global.scss';

// Init the package
export default function(plugin: any) {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Register the product (menu item, routes etc.)
  plugin.addProduct(require('./config/clusterstacks'));

  // Add routes
  plugin.addRoutes(routes);

  // Add l10n translations
  plugin.addL10n('en-us', require('./l10n/en-us.yaml'));
  plugin.addL10n('de-de', require('./l10n/de-de.yaml'));

  // Register as a cluster provisioner in Rancher's native Create Cluster wizard
  plugin.register('provisioner', ClusterStacksProvisioner.ID, ClusterStacksProvisioner);

  // Override Edit/Config/YAML actions on provisioning clusters that are backed
  // by a CAPI ClusterStacks cluster.  addModelExtension is cache-immune – the
  // provisioning.cattle.io.cluster base model calls this extension at runtime
  // via its customProvisionerHelper hook, so it always takes effect.
  plugin.addModelExtension('provisioning.cattle.io.cluster', ClusterStacksProvisioningExtension);
}
