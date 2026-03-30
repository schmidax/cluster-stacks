import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import { PRODUCT_NAME } from './config/clusterstacks';
import routes from './routes/clusterstacks-routing';

// Global styles – registers the SCS logo icon for the sidebar
import './assets/global.scss';

// Init the package
export default function(plugin: IPlugin) {
  // Auto-import model, detail, edit from the folders
  importTypes(plugin);

  // Register the product (menu item, routes etc.)
  plugin.addProduct(require('./config/clusterstacks'));

  // Add routes
  plugin.addRoutes(routes);

  // Add l10n translations
  plugin.addL10n('en-us', require('./l10n/en-us.yaml'));
  plugin.addL10n('de-de', require('./l10n/de-de.yaml'));
}
