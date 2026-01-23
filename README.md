# ECO-TB Custom Widgets

Custom ThingsBoard Widget Library for ECO Smart Diagnostics.

## Widgets

### Load Duration Curve (Dauerkennlinie)

Displays time series data as a duration curve showing how often values exceed certain thresholds.

**Features:**
- Duration curve (sorted descending) visualization
- Split view mode: Time series above, duration curve below
- Automatic threshold detection (base load, peak load)
- Manual threshold override
- Colored threshold areas and markers
- Export to PNG and data view

### Synced Zoom Time Series

Standard time series chart with zoom synchronization across dashboard widgets.

**Features:**
- When you zoom on this chart, all widgets using dashboard timewindow zoom together
- Line, bar, or area chart types
- Configurable debounce for smooth sync
- Optional stacking for multiple series

## Installation

1. Clone this repository
2. Copy `.env.example` to `.env` and configure ThingsBoard credentials
3. Install dependencies: `npm install`
4. Sync widgets to ThingsBoard: `node sync/sync.js sync`

## Usage

```bash
# List bundles on server
node sync/sync.js list-bundles

# List widget types
node sync/sync.js list-widget-types eco_custom_widgets

# Pull from server (before editing)
node sync/sync.js pull-bundle eco_custom_widgets

# Push to server
node sync/sync.js sync

# Backup/Rollback
node sync/sync.js backup
node sync/sync.js rollback
node sync/sync.js status
```

## Adding Widgets to Dashboard

1. Open a dashboard in ThingsBoard
2. Click "Add widget"
3. Search for "ECO Custom Widgets" bundle
4. Select the desired widget
5. Configure datasource and settings

## License

UNLICENSED - Internal use only.
