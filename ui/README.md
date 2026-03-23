# ClusterStacks Rancher Dashboard UI Extension

A Rancher Dashboard UI Extension for managing ClusterStacks with OpenStack integration.

## Features

### Three Menu Items

#### 1. Clusters
- Lists all CAPI-managed Kubernetes clusters (`cluster.x-k8s.io/v1beta1 Cluster`)
- Create / Edit clusters with:
  - Kubernetes version selection (from installed ClusterStacks)
  - Interactive OpenStack resource selection:
    - External Network (via Neutron API)
    - VM Image (via Glance API)
    - VM Flavors for Worker, Control Plane, and Bastion nodes
    - Number of worker / control plane replicas
    - Bastion host enable/disable toggle
  - ETCD Backup to S3/Swift (automatically creates a Swift container)
  - **Quota Validation**: checks OpenStack compute & network quotas, warns or blocks if insufficient

#### 2. ClusterStacks
- Graphical overview of all ClusterStack CRDs in the `clusterstacks` namespace
- Each ClusterStack shown as a card with:
  - Available versions (ClusterStackReleases)
  - Kubernetes versions
  - Release health status
  - Associated ClusterClasses

#### 3. OpenStack Projects
- Store and manage OpenStack credentials (form or `clouds.yaml` paste)
- View all CAPI-relevant OpenStack resources (similar to OpenStack Horizon Dashboard):
  - Instances, Networks, Security Groups, Floating IPs, Volumes, Flavors, Images

## Architecture

```
ui/
├── package.json                          # Root package.json
├── tsconfig.json
├── babel.config.js
├── vue.config.js
├── .eslintrc.js
└── pkg/
    └── clusterstacks/
        ├── package.json                  # Plugin package with Rancher catalog annotations
        ├── index.ts                      # Plugin entry point
        ├── types/
        │   ├── clusterstacks.ts          # CAPI/ClusterStack CRD TypeScript interfaces
        │   └── openstack.ts              # OpenStack resource types
        ├── config/
        │   └── clusterstacks.ts          # Product registration (3 menu items)
        ├── routes/
        │   └── clusterstacks-routing.ts  # Vue Router definitions
        ├── services/
        │   ├── openstack-api.ts          # OpenStack API service (Keystone, Nova, Neutron, Cinder, Glance, Swift)
        │   └── quota-validator.ts        # OpenStack quota validation with rolling-update buffer
        ├── l10n/
        │   ├── en-us.yaml               # English translations
        │   └── de-de.yaml               # German translations
        ├── pages/
        │   ├── index.vue                 # Dashboard landing page
        │   ├── clusters/
        │   │   ├── index.vue             # Cluster list
        │   │   └── create.vue            # Cluster create/edit
        │   ├── clusterstacks/
        │   │   └── index.vue             # ClusterStacks overview
        │   └── openstack-projects/
        │       ├── index.vue             # OpenStack projects & resources
        │       └── create.vue            # OpenStack credential form
        └── components/
            ├── ClusterForm.vue           # Cluster create/edit form
            ├── ClusterStackCard.vue      # ClusterStack card
            ├── OpenstackCredentialForm.vue  # cloud.yaml / form credential entry
            ├── OpenstackResourceList.vue    # Tabbed OpenStack resource viewer
            ├── QuotaWarning.vue          # Quota warning/error banner
            └── BusyButton.vue            # Loading state button
```

## Development

### Prerequisites
- Node.js >= 16
- Yarn

### Setup

```bash
cd ui
yarn install
```

### Development server

```bash
yarn dev
```

### Build

```bash
yarn build
```

## Technical Details

### OpenStack API
All OpenStack API calls are proxied through the Rancher backend at `/meta/proxy/` to avoid CORS issues.
The `OpenStackApiService` covers:
- **Keystone**: Authentication, token management, project/region listing
- **Nova**: Flavors, servers, keypairs, availability zones, compute quota
- **Neutron**: Networks, subnets, security groups, floating IPs, routers, network quota
- **Cinder**: Volumes
- **Glance**: Images
- **Swift**: Container management for etcd backup

### Quota Validation
The `validateQuota()` function in `services/quota-validator.ts`:
1. Fetches current compute and network quota usage
2. Calculates resources needed for the requested cluster + rolling-update buffer (+1 CP, +1 Worker)
3. Returns `{ valid: boolean, warnings: string[], errors: string[] }`
4. Shows warnings when < 15% of quota remains; errors when quota would be exceeded

### CRD Types
TypeScript interfaces for:
- `ClusterStack` / `ClusterStackRelease` (`clusterstack.x-k8s.io/v1alpha1`)
- `ClusterClass` / `Cluster` (`cluster.x-k8s.io/v1beta1`)

### Localization
Full translations in English (`en-us.yaml`) and German (`de-de.yaml`).
