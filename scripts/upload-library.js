/**
 * Upload ECO Widget Utils library to ThingsBoard
 *
 * Usage: node scripts/upload-library.js
 */

const fs = require('fs');
const path = require('path');
const { ThingsBoardApi } = require('../sync/api');
const { loadConfig } = require('../sync/config');

async function main() {
    const libraryPath = path.join(__dirname, '..', 'widgets', 'resources', 'eco-widget-utils.js');

    if (!fs.existsSync(libraryPath)) {
        console.error('Library file not found:', libraryPath);
        process.exit(1);
    }

    const content = fs.readFileSync(libraryPath, 'utf8');
    console.log(`Library loaded: ${(content.length / 1024).toFixed(1)} KB`);

    const config = loadConfig();
    const api = new ThingsBoardApi({
        baseUrl: config.baseUrl,
        username: config.username,
        password: config.password
    });

    try {
        await api.login();

        // Check if resource already exists
        console.log('Checking for existing resource...');
        const existing = await api.getResourceByKey('eco-widget-utils.js');

        if (existing) {
            console.log('Resource already exists, deleting...');
            await api.deleteResource(existing.id.id);
            console.log('Deleted existing resource');
        }

        // Upload new version
        console.log('Uploading library...');
        const result = await api.uploadResource(
            'eco-widget-utils.js',
            'ECO Widget Utils',
            content
        );

        console.log('Upload successful!');
        console.log('Resource ID:', result.id?.id || result.id);
        console.log('Resource Key:', result.resourceKey);

        // Get the URL for use in widgets
        const resourceUrl = `/api/resource/js/${result.resourceKey}`;
        console.log('\nUse this URL in widget resources:');
        console.log(`  { "url": "${resourceUrl}" }`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
