import SteveModel from '@shell/plugins/steve/steve-class';
import { maybeRedirectClusterStacksConfig, maybeRedirectClusterStacksYaml } from './clusterstacks-redirect';

export default class ClusterStacksCapiCluster extends SteveModel {
  async goToEdit(query = {}) {
    if (await maybeRedirectClusterStacksConfig(this)) {
      return;
    }

    return super.goToEdit(query);
  }

  async goToViewConfig(query = {}) {
    if (await maybeRedirectClusterStacksConfig(this)) {
      return;
    }

    return super.goToViewConfig(query);
  }

  async goToEditYaml() {
    if (await maybeRedirectClusterStacksYaml(this)) {
      return;
    }

    return super.goToEditYaml();
  }

  async goToViewYaml() {
    if (await maybeRedirectClusterStacksYaml(this)) {
      return;
    }

    return super.goToViewYaml();
  }
}
