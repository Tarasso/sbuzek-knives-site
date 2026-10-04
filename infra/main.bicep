@description('Globally unique lowercase name for the storage account.')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Static Web App name. This resource is created without linking a repository.')
param staticWebAppName string = 'swa-sbuzek-site'

@description('Additional origins allowed to fetch the public catalog.')
param additionalCorsOrigins array = []

@description('Email address for the monthly resource group budget alerts.')
param budgetAlertEmail string

param location string = resourceGroup().location

var corsOrigins = concat([
  'http://localhost:4280'
  'http://localhost:4321'
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

resource monthlyBudget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: '${resourceGroup().name}-monthly-budget'
  scope: resourceGroup()
  properties: {
    category: 'Cost'
    amount: 5
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2026-10-01T00:00:00Z'
      endDate: '2027-10-01T00:00:00Z'
    }
    notifications: {
      Actual_80_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [budgetAlertEmail]
      }
      Forecasted_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [budgetAlertEmail]
      }
    }
  }
}

output mediaContainerUrl string = 'https://${storage.name}.blob.core.windows.net/media/'
output staticWebAppHostname string = staticWebApp.properties.defaultHostname