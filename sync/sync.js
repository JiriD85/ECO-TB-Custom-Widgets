#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const { loadConfig } = require('./config');
const { ThingsBoardApi } = require('./api');
const {
  backupFiles,
  createBackup,
  listBackups,
  restoreLatestBackup,
  readStatus,
  recordSync,
} = require('./backup');

const SOURCE_DIRS = {
  bundles: 'widgets/bundles',
  types: 'widgets/types',
};

const logger = console;

async function readJsonFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dirPath, entry.name));
}

async function getJsonFiles(dirName) {
  const dirPath = path.join(process.cwd(), dirName);
  try {
    return await readJsonFiles(dirPath);
  } catch (err) {
    return [];
  }
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

async function pathExists(testPath) {
  try {
    await fs.access(testPath);
    return true;
  } catch (err) {
    return false;
  }
}

// ==================== Sync Command ====================

async function syncCommand(args) {
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));

  // Collect files to sync and backup
  const filesToSync = [];

  const bundleFiles = await getJsonFiles(SOURCE_DIRS.bundles);
  const typeFiles = await getJsonFiles(SOURCE_DIRS.types);
  filesToSync.push(...bundleFiles, ...typeFiles);

  if (filesToSync.length === 0) {
    logger.warn('No widget files found to sync');
    return;
  }

  // Backup changed files before sync
  await backupFiles(logger, filesToSync);

  const config = loadConfig();
  const api = new ThingsBoardApi({ ...config, logger });
  await api.login();

  // Sync bundles first
  await syncBundles(api);

  // Then sync widget types
  await syncWidgetTypes(api);

  await recordSync();
  logger.log('Sync completed');
}

async function syncBundles(api) {
  const dirPath = path.join(process.cwd(), SOURCE_DIRS.bundles);
  let files;
  try {
    files = await readJsonFiles(dirPath);
  } catch (err) {
    logger.warn(`Skipping bundles: ${err.message}`);
    return;
  }

  if (!files.length) {
    logger.warn('No widget bundles found');
    return;
  }

  logger.log('Fetching existing widget bundles from server...');
  const existingBundles = await api.getWidgetsBundles();

  const bundlesByAlias = new Map();
  for (const b of existingBundles) {
    if (b.alias) {
      bundlesByAlias.set(b.alias, b);
    }
  }
  logger.log(`Found ${existingBundles.length} existing bundles`);

  for (const file of files) {
    const payload = await loadJson(file);
    const alias = payload.alias;

    if (!alias) {
      logger.error(`Bundle ${path.basename(file)} missing 'alias' field`);
      continue;
    }

    const existing = bundlesByAlias.get(alias);

    if (existing) {
      // Update existing bundle
      payload.id = existing.id;
      payload.version = existing.version;
      logger.log(`Updating bundle: ${alias} (ID: ${existing.id.id})`);
    } else {
      // Create new bundle
      delete payload.id;
      delete payload.version;
      logger.log(`Creating new bundle: ${alias}`);
    }

    try {
      await api.saveWidgetsBundle(payload);
      logger.log(`Synced bundle: ${alias}`);
    } catch (err) {
      logger.error(`Failed bundle sync (${alias}): ${err.message}`);
    }
  }
}

async function syncWidgetTypes(api) {
  const dirPath = path.join(process.cwd(), SOURCE_DIRS.types);
  let files;
  try {
    files = await readJsonFiles(dirPath);
  } catch (err) {
    logger.warn(`Skipping widget types: ${err.message}`);
    return;
  }

  if (!files.length) {
    logger.warn('No widget types found');
    return;
  }

  logger.log('Fetching existing widget types from server...');
  const existingTypes = await api.getAllWidgetTypes();

  const typesByFqn = new Map();
  for (const wt of existingTypes) {
    if (wt.fqn) {
      typesByFqn.set(wt.fqn, wt);
    }
  }
  logger.log(`Found ${existingTypes.length} existing widget types`);

  for (const file of files) {
    const payload = await loadJson(file);
    const fqn = payload.fqn;

    if (!fqn) {
      logger.error(`Widget type ${path.basename(file)} missing 'fqn' field`);
      continue;
    }

    const existing = typesByFqn.get(fqn);

    if (existing) {
      // Fetch current version to avoid optimistic locking conflicts
      try {
        const current = await api.getWidgetTypeById(existing.id.id);
        payload.id = current.id;
        payload.version = current.version;
        payload.tenantId = current.tenantId;
        payload.createdTime = current.createdTime;
        logger.log(`Updating widget type: ${fqn} (version: ${current.version})`);
      } catch (err) {
        logger.error(`Failed to fetch current version for ${fqn}: ${err.message}`);
        continue;
      }
    } else {
      // Create new widget type
      delete payload.id;
      delete payload.version;
      delete payload.tenantId;
      delete payload.createdTime;
      logger.log(`Creating new widget type: ${fqn}`);
    }

    try {
      await api.saveWidgetType(payload);
      logger.log(`Synced widget type: ${fqn}`);
    } catch (err) {
      logger.error(`Failed widget type sync (${fqn}): ${err.message}`);
    }
  }
}

// ==================== List Commands ====================

async function listBundlesCommand() {
  const config = loadConfig();
  const api = new ThingsBoardApi({ ...config, logger });
  await api.login();

  logger.log('Fetching widget bundles from server...');
  const bundles = await api.getWidgetsBundles();

  logger.log(`\nFound ${bundles.length} widget bundles:\n`);
  for (const b of bundles) {
    const title = b.title || b.alias;
    const alias = b.alias || '';
    const id = b.id.id;
    logger.log(`  ${title}`);
    logger.log(`    Alias: ${alias}`);
    logger.log(`    ID: ${id}`);
  }
}

async function listWidgetTypesCommand(args) {
  const config = loadConfig();
  const api = new ThingsBoardApi({ ...config, logger });
  await api.login();

  const bundleAlias = args[0];

  if (bundleAlias) {
    logger.log(`Fetching widget types for bundle: ${bundleAlias}...`);
    const types = await api.getBundleWidgetTypes(bundleAlias);

    logger.log(`\nFound ${types.length} widget types in '${bundleAlias}':\n`);
    for (const wt of types) {
      logger.log(`  ${wt.name || wt.fqn}`);
      logger.log(`    FQN: ${wt.fqn}`);
      logger.log(`    ID: ${wt.id.id}`);
    }
  } else {
    logger.log('Fetching all widget types from server...');
    const types = await api.getAllWidgetTypes();

    logger.log(`\nFound ${types.length} widget types:\n`);
    for (const wt of types) {
      logger.log(`  ${wt.name || wt.fqn}`);
      logger.log(`    FQN: ${wt.fqn}`);
      logger.log(`    ID: ${wt.id.id}`);
    }
  }
}

// ==================== Pull Commands ====================

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

async function pullBundleCommand(args) {
  const config = loadConfig();
  const api = new ThingsBoardApi({ ...config, logger });
  await api.login();

  const bundleAlias = args[0];

  if (!bundleAlias) {
    logger.error('Usage: pull-bundle <bundle-alias>');
    logger.log('\nUse "list-bundles" to see available bundles');
    return;
  }

  logger.log(`Fetching bundle: ${bundleAlias}...`);
  const bundle = await api.getWidgetsBundleByAlias(bundleAlias);

  if (!bundle) {
    logger.error(`Bundle not found: ${bundleAlias}`);
    return;
  }

  // Ensure directories exist
  const bundleDir = path.join(process.cwd(), SOURCE_DIRS.bundles);
  const typesDir = path.join(process.cwd(), SOURCE_DIRS.types);
  await fs.mkdir(bundleDir, { recursive: true });
  await fs.mkdir(typesDir, { recursive: true });

  // Save bundle
  const bundleFilename = `${sanitizeFilename(bundleAlias)}.json`;
  const bundleFilePath = path.join(bundleDir, bundleFilename);
  await fs.writeFile(bundleFilePath, JSON.stringify(bundle, null, 2));
  logger.log(`Saved bundle: ${bundleFilename}`);

  // Fetch and save widget types
  logger.log('Fetching widget types...');
  const widgetTypes = await api.getBundleWidgetTypesDetails(bundleAlias);

  logger.log(`Found ${widgetTypes.length} widget types`);

  for (const wt of widgetTypes) {
    const typeFilename = `${sanitizeFilename(wt.fqn)}.json`;
    const typeFilePath = path.join(typesDir, typeFilename);
    await fs.writeFile(typeFilePath, JSON.stringify(wt, null, 2));
    logger.log(`Saved widget type: ${typeFilename}`);
  }

  // Update status
  const { updateStatus } = require('./backup');
  await updateStatus({ lastPull: new Date().toISOString().replace('T', '_').substring(0, 19) });

  logger.log(`\nPull completed: 1 bundle, ${widgetTypes.length} widget types`);
}

// ==================== Backup Commands ====================

async function backupCommand() {
  await createBackup(logger);
}

async function rollbackCommand() {
  await restoreLatestBackup(logger);
}

async function statusCommand() {
  const status = await readStatus();
  const backups = await listBackups();
  logger.log('Status:');
  logger.log(`Last backup: ${status.lastBackup || 'n/a'}`);
  logger.log(`Last sync: ${status.lastSync || 'n/a'}`);
  logger.log(`Last pull: ${status.lastPull || 'n/a'}`);
  logger.log(`Last rollback: ${status.lastRollback || 'n/a'}`);
  logger.log(`Backups: ${backups.length}`);
  if (backups.length) {
    logger.log(`Latest backup: ${backups[backups.length - 1]}`);
  }
}

// ==================== Help ====================

function printUsage() {
  logger.log('ECO-TB Custom Widgets Sync Tool');
  logger.log('');
  logger.log('Usage: node sync/sync.js <command> [options]');
  logger.log('');
  logger.log('Commands:');
  logger.log('  sync                        Push local widgets to ThingsBoard');
  logger.log('  list-bundles                List all widget bundles on server');
  logger.log('  list-widget-types [alias]   List widget types (optionally filter by bundle)');
  logger.log('  pull-bundle <alias>         Download bundle + widget types from ThingsBoard');
  logger.log('  backup                      Create a backup of local files');
  logger.log('  rollback                    Restore from latest backup');
  logger.log('  status                      Show sync status');
  logger.log('');
  logger.log('Examples:');
  logger.log('  node sync/sync.js list-bundles');
  logger.log('  node sync/sync.js list-widget-types eco_custom_widgets');
  logger.log('  node sync/sync.js pull-bundle eco_custom_widgets');
  logger.log('  node sync/sync.js sync');
}

// ==================== Main ====================

async function main() {
  const [, , command, ...args] = process.argv;
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  try {
    switch (command) {
      case 'sync':
        await syncCommand(args);
        break;
      case 'list-bundles':
        await listBundlesCommand();
        break;
      case 'list-widget-types':
        await listWidgetTypesCommand(args);
        break;
      case 'pull-bundle':
        await pullBundleCommand(args);
        break;
      case 'backup':
        await backupCommand();
        break;
      case 'rollback':
        await rollbackCommand();
        break;
      case 'status':
        await statusCommand();
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
