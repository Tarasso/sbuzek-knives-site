# S. Buzek Knives

Astro static site for Stanley Buzek Knives. Public pages are static; the gallery reads one catalog JSON document at runtime so catalog changes will not require rebuilding the site.

## Current state

- Home, Gallery, Available, Contact, 404, and client-rendered knife detail routes are in place.
- `shared/types.ts` defines the catalog contract. The empty `public/catalog.json` is only a local placeholder; production should use the Blob URL set through `PUBLIC_CATALOG_URL`.
- `infra/main.bicep` provisions the Free Static Web App and the public-read `media` Blob container with versioning, soft delete, and CORS.
- The GitHub Actions workflow deploys the Astro build to an existing Static Web App.
- Admin UI/API, Wix migration, source photos, approved bio/policies, and production catalog seeding are not implemented yet. The original Wix copy and images must be migrated and reviewed before launch.
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

Without those settings, the site reads the empty `public/catalog.json` placeholder. Set up Azurite and a local SWA CLI workflow when the write API is added.

## Azure setup

Use a personal Azure subscription and the resource group `rg-sbuzek-site`. Sign in with Azure CLI and select that subscription before provisioning:

```powershell
az login
az account set --subscription <subscription-id>
az group create --name rg-sbuzek-site --location eastus2
az deployment group create --resource-group rg-sbuzek-site --template-file infra/main.bicep --parameters storageAccountName=<globally-unique-name>
```

The template creates the Static Web App and storage, but does not link GitHub or configure production custom-domain CORS. After deployment:

1. Add approved custom hostnames as CORS origins after the domain is configured.
2. Create the GitHub repository, connect it to the Static Web App, and set the app's build preset to Custom if prompted.
3. Add the SWA deployment token as the repository Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. Set `PUBLIC_MEDIA_BASE_URL` and `PUBLIC_CATALOG_URL` as GitHub Actions build environment values, or commit a non-secret `.env.production` with those public URLs.
5. Keep the storage SAS private. It belongs only in the Static Web App application setting `MEDIA_CONTAINER_SAS_URL` when the managed Functions API is implemented.

The Bicep deployment does not create a SAS policy or budget alert yet. Add those before putting the admin API into service. Never put storage keys or SAS values in the repo.

## GitHub repository

This folder is initialized as a local Git repository on branch `main`. To connect it after creating an empty repository under the intended personal GitHub account or organization:

```powershell
git remote add origin https://github.com/<owner>/<repository>.git
git push -u origin main
```

GitHub CLI is not installed in the current environment, so remote creation and authentication have not been attempted. Do not put a GitHub token in this repo or in chat.

## Next implementation steps

1. Confirm the GitHub owner and personal Azure subscription; provision the Static Web App and storage.
2. Build the Wix migration/review tooling and get Stan's approval of imported text, status, and featured knives.
3. Implement the protected Functions API, client-side image pipeline, and phone-first admin screens; then test auth, ETag retries, uploads, and deletion.
4. Migrate the bio, contact details, policies, banner, and gallery photos. Do not cut over DNS before Wix email records are inventoried.
