// One self-hosted copy on Azure Container Apps, deployed into a resource group by scripts/deploy-azure.mjs.
// It runs twice: first with an empty image (no container app yet), then with the built image. Every value is a parameter.

@description('Lowercase name prefix for every resource.')
@minLength(3)
@maxLength(20)
param prefix string

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Public host name without scheme or path, such as exact-mcp.example.com.')
param hostname string

@description('Exact app ID; must match the private configuration.')
param exactAppId string

@description('Shared app calls per minute; keep below your Exact allowance.')
@minValue(8)
param appCallsPerMinute int

@description('Calls per minute for one Exact company (division).')
@minValue(1)
param divisionCallsPerMinute int

@description('Shared app calls per day.')
@minValue(8)
param appCallsPerDay int

@description('Calls per day for one Exact company (division).')
@minValue(1)
param divisionCallsPerDay int

@description('Tags for every resource.')
param tags object

@description('Object ID of the person running the deploy. They may store the configuration secret.')
param operatorObjectId string

@description('Container image by digest. Empty skips the container app, for the first pass before an image exists.')
param image string

@description('Managed certificate ID once the custom domain is bound; empty before that.')
param certificateId string

@description('Number of replicas. At least two.')
@minValue(2)
param replicas int = 2

var compact = take(replace(prefix, '-', ''), 11)
// The full prefix is part of the seed, so two copies in one resource group never share resources.
var unique = uniqueString(resourceGroup().id, prefix)
// Azure built-in role definition IDs. These are the same in every tenant.
var roles = {
  tableData: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Storage Table Data Contributor
  cryptoUser: '12338af0-0e69-4776-bea7-57ae8d297424' // Key Vault Crypto User
  configReader: '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
  configWriter: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7' // Key Vault Secrets Officer
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-identity'
  location: location
  tags: tags
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${compact}${unique}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = { parent: storage, name: 'default' }

resource table 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = { parent: tableService, name: 'state' }

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${compact}${unique}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
  }
}

// Wraps each credential data key. Redeploying returns the existing key; it does not add a version.
resource key 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: vault
  name: 'credentials'
  properties: { kty: 'RSA', keySize: 3072, keyOps: ['wrapKey', 'unwrapKey'] }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${compact}${unique}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource tableAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(table.id, identity.id, roles.tableData)
  scope: table
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.tableData)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource keyAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(key.id, identity.id, roles.cryptoUser)
  scope: key
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cryptoUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource secretAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, identity.id, roles.configReader)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.configReader)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource operatorSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, operatorObjectId, roles.configWriter)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.configWriter)
    principalId: operatorObjectId
    principalType: 'User'
  }
}

resource imagePull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, roles.acrPull)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: logs.properties.customerId, sharedKey: logs.listKeys().primarySharedKey }
    }
  }
}

// Ingress terminates HTTPS and forwards the original Host header with X-Forwarded-Proto: https,
// which the service requires. Plain HTTP is redirected to HTTPS.
resource app 'Microsoft.App/containerApps@2024-03-01' = if (!empty(image)) {
  name: prefix
  location: location
  tags: tags
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  dependsOn: [tableAccess, keyAccess, secretAccess, imagePull]
  properties: {
    managedEnvironmentId: appEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
        traffic: [{ latestRevision: true, weight: 100 }]
        customDomains: empty(certificateId) ? [] : [{ name: hostname, bindingType: 'SniEnabled', certificateId: certificateId }]
      }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      terminationGracePeriodSeconds: 60
      containers: [
        {
          name: 'exact-mcp'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '8080' }
            { name: 'SCG_ENVIRONMENT', value: 'production' }
            { name: 'SCG_CLOUD', value: 'azure' }
            { name: 'SCG_ORIGIN', value: 'https://${hostname}' }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            { name: 'SCG_TABLE_ENDPOINT', value: 'https://${storage.name}.table.${environment().suffixes.storage}' }
            { name: 'SCG_TABLE_NAME', value: table.name }
            { name: 'SCG_KEY_ID', value: key.properties.keyUriWithVersion }
            { name: 'SCG_CONFIG_SECRET_URL', value: '${vault.properties.vaultUri}secrets/runtime-config' }
            { name: 'SCG_EXACT_APP_ID', value: exactAppId }
            { name: 'SCG_APP_CALLS_PER_MINUTE', value: string(appCallsPerMinute) }
            { name: 'SCG_DIVISION_CALLS_PER_MINUTE', value: string(divisionCallsPerMinute) }
            { name: 'SCG_APP_CALLS_PER_DAY', value: string(appCallsPerDay) }
            { name: 'SCG_DIVISION_CALLS_PER_DAY', value: string(divisionCallsPerDay) }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/health', port: 8080 }, periodSeconds: 10 }
          ]
        }
      ]
      scale: { minReplicas: replicas, maxReplicas: replicas }
    }
  }
}

output registryName string = registry.name
output registryServer string = registry.properties.loginServer
output vaultName string = vault.name
output environmentName string = appEnvironment.name
output appName string = prefix
