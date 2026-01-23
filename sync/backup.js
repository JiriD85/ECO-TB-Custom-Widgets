const fs = require('fs').promises;
const path = require('path');

const BACKUP_ROOT = path.join(process.cwd(), 'backups');
const STATUS_FILE = path.join(BACKUP_ROOT, '.sync-status.json');
const ALL_SOURCE_DIRS = ['widgets/bundles', 'widgets/types'];

function getTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyDir(source, target) {
  await ensureDir(target);
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await ensureDir(path.dirname(destPath));
      await fs.copyFile(srcPath, destPath);
    }
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

async function createBackup(logger = console, selectedDirs = null) {
  const dirsToBackup = selectedDirs || ALL_SOURCE_DIRS;

  if (dirsToBackup.length === 0) {
    logger.log('No directories selected for backup');
    return { backupDir: null, timestamp: null };
  }

  await ensureDir(BACKUP_ROOT);
  const timestamp = getTimestamp();
  const backupDir = path.join(BACKUP_ROOT, timestamp);
  await ensureDir(backupDir);

  for (const dirName of dirsToBackup) {
    const src = path.join(process.cwd(), dirName);
    if (await pathExists(src)) {
      await copyDir(src, path.join(backupDir, dirName));
      logger.log(`Backed up ${dirName}`);
    } else {
      logger.warn(`Skipped missing directory: ${dirName}`);
    }
  }

  await updateStatus({ lastBackup: timestamp });
  logger.log(`Backup created at ${backupDir}`);
  return { backupDir, timestamp };
}

async function getAllBackupDirs() {
  const backups = await listBackups();
  if (!backups.length) return [];
  return backups.reverse().map(name => path.join(BACKUP_ROOT, name));
}

async function fileChanged(filePath, backupDirs) {
  if (!backupDirs || backupDirs.length === 0) return true;

  const relativePath = path.relative(process.cwd(), filePath);

  for (const backupDir of backupDirs) {
    const backupFilePath = path.join(backupDir, relativePath);

    if (await pathExists(backupFilePath)) {
      try {
        const [currentContent, backupContent] = await Promise.all([
          fs.readFile(filePath, 'utf8'),
          fs.readFile(backupFilePath, 'utf8')
        ]);
        return currentContent !== backupContent;
      } catch (err) {
        return true;
      }
    }
  }

  return true;
}

async function backupFiles(logger = console, filePaths = []) {
  if (!filePaths || filePaths.length === 0) {
    return { backupDir: null, timestamp: null };
  }

  const backupDirs = await getAllBackupDirs();

  const changedFiles = [];
  for (const filePath of filePaths) {
    if (await pathExists(filePath)) {
      if (await fileChanged(filePath, backupDirs)) {
        changedFiles.push(filePath);
      }
    }
  }

  if (changedFiles.length === 0) {
    return { backupDir: null, timestamp: null, count: 0 };
  }

  await ensureDir(BACKUP_ROOT);
  const timestamp = getTimestamp();
  const backupDir = path.join(BACKUP_ROOT, timestamp);
  await ensureDir(backupDir);

  const backedUpRelativePaths = [];
  for (const filePath of changedFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const destPath = path.join(backupDir, relativePath);
    await ensureDir(path.dirname(destPath));
    await fs.copyFile(filePath, destPath);
    logger.log(`Backed up: ${relativePath}`);
    backedUpRelativePaths.push(relativePath);
  }

  const changelogPath = path.join(backupDir, 'CHANGELOG.md');
  const changelogContent = generateChangelog(timestamp, backedUpRelativePaths);
  await fs.writeFile(changelogPath, changelogContent);

  await updateStatus({ lastBackup: timestamp });
  logger.log(`Backed up ${changedFiles.length} changed file(s) to ${backupDir}`);

  return { backupDir, timestamp, count: changedFiles.length };
}

function generateChangelog(timestamp, files) {
  const dateStr = timestamp.replace('_', ' ').replace(/-(\d{2})-(\d{2})$/, ':$1:$2');
  const lines = [
    `# Backup ${timestamp}`,
    '',
    `**Date:** ${dateStr}`,
    '',
    '## Changed Files',
    '',
  ];

  const byDir = {};
  for (const file of files) {
    const dir = path.dirname(file);
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(path.basename(file));
  }

  for (const [dir, fileNames] of Object.entries(byDir)) {
    lines.push(`### ${dir}/`);
    for (const name of fileNames) {
      lines.push(`- ${name}`);
    }
    lines.push('');
  }

  lines.push('## Description');
  lines.push('');
  lines.push('_Add description of changes here_');
  lines.push('');

  return lines.join('\n');
}

async function listBackups() {
  if (!(await pathExists(BACKUP_ROOT))) return [];
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function restoreLatestBackup(logger = console, selectedDirs = null) {
  const backups = await listBackups();
  if (!backups.length) {
    throw new Error('No backups available to restore');
  }

  const latest = backups[backups.length - 1];
  const backupDir = path.join(BACKUP_ROOT, latest);

  const dirsToRestore = selectedDirs || ALL_SOURCE_DIRS;

  for (const dirName of dirsToRestore) {
    const src = path.join(backupDir, dirName);
    const dest = path.join(process.cwd(), dirName);
    if (await pathExists(src)) {
      if (await pathExists(dest)) {
        await fs.rm(dest, { recursive: true, force: true });
      }
      await copyDir(src, dest);
      logger.log(`Restored ${dirName}`);
    } else {
      logger.warn(`Backup missing directory: ${dirName}`);
    }
  }

  await updateStatus({ lastRollback: getTimestamp() });
  logger.log(`Rollback completed from ${latest}`);
  return latest;
}

async function readStatus() {
  if (!(await pathExists(STATUS_FILE))) return {};
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

async function updateStatus(update) {
  await ensureDir(BACKUP_ROOT);
  const current = await readStatus();
  const next = { ...current, ...update };
  await fs.writeFile(STATUS_FILE, JSON.stringify(next, null, 2));
  return next;
}

async function recordSync() {
  return updateStatus({ lastSync: getTimestamp() });
}

module.exports = {
  createBackup,
  backupFiles,
  listBackups,
  restoreLatestBackup,
  readStatus,
  updateStatus,
  recordSync,
};
