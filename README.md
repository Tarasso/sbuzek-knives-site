# S. Buzek Knives

Astro static site for Stanley Buzek Knives. Public pages are static; the gallery reads one catalog JSON document at runtime so catalog changes will not require rebuilding the site.

## Current state

- Home, Gallery, Available, Contact, 404, and client-rendered knife detail routes are in place.
- `shared/types.ts` defines the catalog contract. `public/catalog.json` is the local fallback; production reads the seeded catalog from Blob Storage.
- `infra/main.bicep` provisions the Free Static Web App, public-read `media` container, versioning, soft delete, CORS, and a $5 monthly resource-group budget alert.
- The Azure resources are deployed, the public catalog blob is seeded, and the site is published at its `azurestaticapps.net` hostname.
- `/admin` is a role-protected, add-only photo/catalog editor. It resizes photos in the browser and saves through admin-checked Functions. Editing existing knives, reorder/hide/delete, Wix migration, source photos, and approved bio/policies remain to be done.
- Custom-domain DNS/email cutover is intentionally out of scope until the Azure hostname has been accepted.

## Local development

Requirements: Node.js 22.12 or newer and npm.

```powershell
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. To build and preview:

```powershell
npm run build
npm run preview
```

Optional `.env` values:

```dotenv
PUBLIC_MEDIA_BASE_URL=https://<storage-account>.blob.core.windows.net/media/
PUBLIC_CATALOG_URL=https://<storage-account>.blob.core.windows.net/media/catalog.json
PUBLIC_GOOGLE_SITE_VERIFICATION=
```

Without those settings, the site reads the empty `public/catalog.json` placeholder. Local admin auth/API requires SWA CLI and Azurite; that local stack is not configured yet.

## Azure setup

The current deployment is in the personal Azure subscription's `rg-sbuzek-site` resource group in `eastus2`. The Static Web App is `swa-sbuzek-knives-km-20261004`; media is stored in `stsbuzekknives2026`.

The published preview is [thankful-island-060006d0f.2.azurestaticapps.net](https://thankful-island-060006d0f.2.azurestaticapps.net). To redeploy the infrastructure from this checkout:

```powershell
az login
az account set --subscription <subscription-id>
az group create --name rg-sbuzek-site --location eastus2
az deployment group create --resource-group rg-sbuzek-site --template-file infra/main.bicep --parameters storageAccountName=stsbuzekknives2026 staticWebAppName=swa-sbuzek-knives-km-20261004 budgetAlertEmail=<your-alert-email>
```

The SWA deploy token is stored as the GitHub Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Repository variables `PUBLIC_MEDIA_BASE_URL` and `PUBLIC_CATALOG_URL` point to the public Blob container. The deployment gate is controlled by `AZURE_STATIC_WEB_APPS_DEPLOY_ENABLED`; keep it `false` until the resources and variables are ready, then set it to `true`.

The media SAS is backed by the `media-admin` stored access policy and is stored only in the SWA setting `MEDIA_CONTAINER_SAS_URL_B64`; it expires after one year and can be revoked by removing the policy. The Function decodes it server-side. Custom hostnames still need to be added to storage CORS after DNS is configured.

Never put storage keys or SAS values in the repo. The admin invitation link is sent separately and expires after seven days.

## GitHub repository

The public repository is [Tarasso/sbuzek-knives-site](https://github.com/Tarasso/sbuzek-knives-site). The local `main` branch tracks `origin/main`.

The workflow builds both the Astro site and Functions API on pushes and pull requests. Azure deployment is enabled only when the repository variable `AZURE_STATIC_WEB_APPS_DEPLOY_ENABLED` is `true`. Never put deployment tokens or storage credentials in the repo.

## Next implementation steps

1. Extend admin editing with reorder, hide, restore, and delete-forever; test the upload flow on iPhone and Android.
2. Build the Wix migration/review tooling and get Stan's approval of imported text, status, and featured knives.
3. Migrate the bio, contact details, policies, banner, and gallery photos. Do not cut over DNS before Wix email records are inventoried.
