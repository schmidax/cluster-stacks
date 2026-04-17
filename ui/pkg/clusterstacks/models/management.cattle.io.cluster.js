import MgmtCluster from '@shell/models/management.cattle.io.cluster';
import { maybeRedirectClusterStacksConfig, maybeRedirectClusterStacksYaml } from './clusterstacks-redirect';

export default class ClusterStacksMgmtCluster extends MgmtCluster {
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
