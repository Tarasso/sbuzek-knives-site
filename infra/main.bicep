@description('Globally unique lowercase name for the storage account.')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Static Web App name. This resource is created without linking a repository.')
param staticWebAppName string = 'swa-sbuzek-site'

@description('Additional origins allowed to fetch the public catalog.')
param additionalCorsOrigins array = []

param location string = resourceGroup().location

var corsOrigins = concat([
  'http://localhost:4280'
  'https://${staticWebApp.properties.defaultHostname}'
], additionalCorsOrigins)

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: corsOrigins
          allowedMethods: [
            'GET'
            'HEAD'
          ]
          allowedHeaders: [ '*' ]
          exposedHeaders: [ '*' ]
          maxAgeInSeconds: 3600
        }
      ]
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    isVersioningEnabled: true
  }
}

resource mediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'media'
  properties: {
    publicAccess: 'Blob'
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: 'eastus2'
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output mediaContainerUrl string = 'https://${storage.name}.blob.core.windows.net/media/'
output staticWebAppHostname string = staticWebApp.properties.defaultHostname