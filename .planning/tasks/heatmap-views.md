# Task: Heatmap Cartesian Widget - Erweiterte Zeitansichten

**Widget:** `widgets/types/eco_heatmap_cartesian.json`
**Ziel:** Flexible Zeitansichten für Energie-Monitoring mit Vergleichsmodus

---

## Anforderungen

### 1. Ansichts-Presets (X-Achse)
Neues Setting `viewMode`:
- **day**: X = einzelne Tage im Timewindow (z.B. "Mo 1.1", "Di 2.1", ...)
- **week**: X = Wochentage (Mo-So), aggregiert über alle Wochen im Timewindow
- **month**: X = Monatstage (1-31)

### 2. Y-Achse: Stunden mit konfigurierbarer Auflösung
Neues Setting `timeResolution`:
- 15min (96 Slots)
- 30min (48 Slots)
- 1h (24 Slots) - Default
- 3h (8 Slots)
- 6h (4 Slots)
- 12h (2 Slots)
- 24h (1 Slot)

### 3. Zählerstand → Verbrauch Berechnung
Neues Setting `calculateConsumption` (Toggle):
- Berechnet Delta zwischen aufeinanderfolgenden Datenpunkten
- Input: Kumulierter Zählerstand (kWh, m³)
- Output: Verbrauch pro Zeitslot
- Negative Deltas ignorieren (Zähler-Reset)

### 4. Intelligente Aggregation
Neues Setting `aggregationMode`:
- **avg**: Durchschnitt (Leistung kW, Temperatur)
- **sum**: Summe (Verbrauch kWh, m³)
- **max**: Maximum
- **min**: Minimum

### 5. Erweiterte Farbskala-Presets
Bestehende behalten (blue, green, red, temperature, custom) + neue:
- **energy**: Grün → Gelb → Rot (Verbrauch)
- **efficiency**: Rot → Gelb → Grün (invertiert)
- **cool**: Hellblau → Dunkelblau (Kühlung)
- **heat**: Gelb → Orange → Dunkelrot (Heizung)
- **water**: Weiß → Hellblau → Dunkelblau
- **gas**: Weiß → Gelb → Orange

### 6. Vergleichsmodus
Neues Setting `compareMode` (Toggle):
- Zwei Heatmaps untereinander im selben Widget
- Obere: Aktueller Zeitraum
- Untere: Vergleichszeitraum
- Synchronisierter Tooltip über beide Charts bei Hover

Neues Setting `comparePeriod`:
- **previousDay**: Tag vs. Vortag
- **dayLastWeek**: Tag vs. gleicher Tag vor einer Woche
- **previousWeek**: Woche vs. Vorwoche
- **previousMonth**: Monat vs. Vormonat

### 7. Label-Format
Neues Setting `labelFormat`:
- **date**: Datum (z.B. "1.1.2024", "Mo 1.1.")
- **calendarWeek**: Kalenderwoche (z.B. "KW 5", "KW 4")
- **auto**: Automatisch basierend auf viewMode

Labels werden über jeder Heatmap angezeigt:
```
┌─────────────────────────────┐
│  KW 5 (27.1. - 2.2.2024)    │
│  [Heatmap 1]                │
├─────────────────────────────┤
│  KW 4 (20.1. - 26.1.2024)   │
│  [Heatmap 2]                │
└─────────────────────────────┘
```

---

## Settings Schema Struktur

**Gruppe "View Configuration":**
- viewMode (rc-select)
- timeResolution (rc-select)
- labelFormat (rc-select)

**Gruppe "Data Processing":**
- calculateConsumption (toggle)
- aggregationMode (rc-select)

**Gruppe "Compare Mode":**
- compareMode (toggle)
- comparePeriod (rc-select, condition: compareMode === true)

**Gruppe "Chart Settings":**
- colorScheme mit allen Presets

---

## Technische Details

### ThingsBoard API für Vergleichsdaten

**Endpoint:**
```
GET /api/plugins/telemetry/{entityType}/{entityId}/values/timeseries
```

**Parameter:**
| Parameter | Beschreibung |
|-----------|-------------|
| `keys` | Komma-getrennte Telemetrie-Keys |
| `startTs` | Start in Millisekunden (Unix-Epoch) |
| `endTs` | Ende in Millisekunden |
| `interval` | Aggregationsintervall in ms |
| `agg` | `AVG`, `SUM`, `MIN`, `MAX`, `COUNT`, `NONE` |

**Kein nativer Offset** - Zeitbereiche manuell berechnen.

### Widget-Implementierung für Vergleichsdaten

```javascript
function loadComparisonData() {
    var timeWindow = self.ctx.timeWindow;
    var currentStart = timeWindow.minTime;
    var currentEnd = timeWindow.maxTime;
    var duration = currentEnd - currentStart;

    // Offset basierend auf comparePeriod berechnen
    var settings = self.ctx.settings;
    var offset;
    switch (settings.comparePeriod) {
        case 'previousDay':
            offset = 24 * 60 * 60 * 1000; // 1 Tag
            break;
        case 'dayLastWeek':
            offset = 7 * 24 * 60 * 60 * 1000; // 1 Woche
            break;
        case 'previousWeek':
            offset = 7 * 24 * 60 * 60 * 1000; // 1 Woche
            break;
        case 'previousMonth':
            offset = 30 * 24 * 60 * 60 * 1000; // ~1 Monat
            break;
        default:
            offset = 7 * 24 * 60 * 60 * 1000;
    }

    var comparisonStart = currentStart - offset;
    var comparisonEnd = currentEnd - offset;

    // Entity-Info aus Datasource
    var ds = self.ctx.datasources[0];
    var keys = ds.dataKeys.map(function(k) { return k.name; }).join(',');
    var interval = timeWindow.aggregation ? timeWindow.aggregation.interval : 3600000;
    var agg = timeWindow.aggregation ? timeWindow.aggregation.type : 'AVG';

    var url = '/api/plugins/telemetry/' + ds.entityType + '/' + ds.entityId +
        '/values/timeseries?keys=' + keys +
        '&startTs=' + comparisonStart +
        '&endTs=' + comparisonEnd +
        '&interval=' + interval +
        '&agg=' + agg;

    self.ctx.http.get(url).subscribe(
        function(response) {
            // response: { "key1": [{ts: 123, value: "42"}, ...], ... }
            processComparisonData(response);
        },
        function(error) {
            console.error('Failed to fetch comparison data:', error);
        }
    );
}
```

### ECharts Multi-Grid Heatmap - Vollständige Referenz

#### Key-Konzepte

| Konzept | Konfiguration |
|---------|---------------|
| **Mehrere Grids** | `grid: [{...}, {...}]` mit IDs oder Indices |
| **Achsen-Zuordnung** | `gridIndex` in xAxis/yAxis |
| **Serien-Zuordnung** | `xAxisIndex`, `yAxisIndex` in series |
| **Tooltip-Sync** | `axisPointer.link: [{ xAxisIndex: [0, 1] }]` |
| **Gemeinsame Farben** | `visualMap.seriesIndex: [0, 1]` |
| **Mehrere Titel** | `title: [{...}, {...}]` als Array |
| **Responsive** | Prozentuale Werte für `top`, `height`, `left`, `right` |

#### Vollständiges Code-Beispiel

```javascript
// Y-Achsen Labels (Stunden basierend auf timeResolution)
function generateTimeLabels(resolution) {
    var labels = [];
    var minutesPerSlot = {
        '15min': 15, '30min': 30, '1h': 60,
        '3h': 180, '6h': 360, '12h': 720, '24h': 1440
    }[resolution] || 60;

    for (var m = 0; m < 1440; m += minutesPerSlot) {
        var h = Math.floor(m / 60);
        var min = m % 60;
        labels.push(h.toString().padStart(2, '0') + ':' + min.toString().padStart(2, '0'));
    }
    return labels;
}

// X-Achsen Labels (Wochentage)
var weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
var timeLabels = generateTimeLabels(settings.timeResolution || '1h');

// ECharts Option für Vergleichsmodus
var option = {
    // Mehrere Titel über den Heatmaps
    title: [
        {
            text: 'KW 5 (27.1. - 2.2.2024)',
            left: '10%',
            top: 5,
            textStyle: { fontSize: 13, fontWeight: 'bold', color: '#333' }
        },
        {
            text: 'KW 4 (20.1. - 26.1.2024)',
            left: '10%',
            top: '50%',
            textStyle: { fontSize: 13, fontWeight: 'bold', color: '#666' }
        }
    ],

    // Tooltip Konfiguration
    tooltip: {
        trigger: 'item',
        formatter: function(params) {
            var period = params.seriesIndex === 0 ? 'Aktuell' : 'Vergleich';
            var day = weekDays[params.data[0]];
            var time = timeLabels[params.data[1]];
            var value = params.data[2];
            var unit = settings.unit || 'kWh';
            return period + '<br/>' +
                   day + ', ' + time + '<br/>' +
                   '<b>' + value.toFixed(2) + ' ' + unit + '</b>';
        }
    },

    // Synchronisierter Crosshair über beide Grids
    axisPointer: {
        show: true,
        snap: true,
        link: [
            { xAxisIndex: [0, 1] },  // X-Achsen synchronisieren
            { yAxisIndex: [0, 1] }   // Y-Achsen synchronisieren
        ],
        lineStyle: { color: '#999', type: 'dashed', width: 1 },
        label: { show: true, backgroundColor: '#6a7985' }
    },

    // Zwei Grids - responsive mit Prozentangaben
    grid: [
        {
            id: 'grid-current',
            left: '10%',
            right: '15%',
            top: '8%',
            height: '38%'
        },
        {
            id: 'grid-comparison',
            left: '10%',
            right: '15%',
            top: '56%',
            height: '38%'
        }
    ],

    // X-Achsen für beide Grids (Wochentage)
    xAxis: [
        {
            type: 'category',
            gridIndex: 0,
            data: weekDays,
            splitArea: { show: true },
            axisLabel: { fontSize: 11 },
            axisTick: { show: false }
        },
        {
            type: 'category',
            gridIndex: 1,
            data: weekDays,
            splitArea: { show: true },
            axisLabel: { fontSize: 11 },
            axisTick: { show: false }
        }
    ],

    // Y-Achsen für beide Grids (Stunden)
    yAxis: [
        {
            type: 'category',
            gridIndex: 0,
            data: timeLabels,
            splitArea: { show: true },
            axisLabel: { fontSize: 10 },
            axisTick: { show: false },
            inverse: true  // 00:00 oben, 23:00 unten
        },
        {
            type: 'category',
            gridIndex: 1,
            data: timeLabels,
            splitArea: { show: true },
            axisLabel: { fontSize: 10 },
            axisTick: { show: false },
            inverse: true
        }
    ],

    // Gemeinsame VisualMap für beide Heatmaps
    visualMap: {
        type: 'continuous',
        min: 0,
        max: dataMax,  // Berechnet aus beiden Datensätzen
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        seriesIndex: [0, 1],  // Gilt für beide Serien
        inRange: {
            color: getColorScheme(settings.colorScheme)
        },
        text: ['Hoch', 'Niedrig'],
        textStyle: { fontSize: 11 }
    },

    // Zwei Heatmap Serien
    series: [
        {
            name: 'Aktueller Zeitraum',
            type: 'heatmap',
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: currentData,  // Format: [[x, y, value], ...]
            label: { show: false },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        },
        {
            name: 'Vergleichszeitraum',
            type: 'heatmap',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: comparisonData,
            label: { show: false },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }
    ]
};
```

#### Farbskala-Presets Implementation

```javascript
function getColorScheme(scheme) {
    var schemes = {
        // Bestehende
        blue: ['#E3F2FD', '#2196F3', '#0D47A1'],
        green: ['#E8F5E9', '#4CAF50', '#1B5E20'],
        red: ['#FFEBEE', '#F44336', '#B71C1C'],
        temperature: ['#2196F3', '#FFEB3B', '#F44336'],

        // Neue für Energie-Monitoring
        energy: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336'],
        efficiency: ['#F44336', '#FF9800', '#FFEB3B', '#8BC34A', '#4CAF50'],
        cool: ['#E1F5FE', '#81D4FA', '#29B6F6', '#0288D1', '#01579B'],
        heat: ['#FFF8E1', '#FFECB3', '#FFD54F', '#FFB300', '#FF8F00', '#E65100', '#BF360C'],
        water: ['#FFFFFF', '#E3F2FD', '#90CAF9', '#42A5F5', '#1976D2', '#0D47A1'],
        gas: ['#FFFFFF', '#FFF8E1', '#FFECB3', '#FFD54F', '#FFB300', '#FF8F00']
    };
    return schemes[scheme] || schemes.energy;
}
```

#### Separate VisualMaps (falls unterschiedliche Skalen nötig)

```javascript
visualMap: [
    {
        type: 'continuous',
        min: 0,
        max: currentMax,
        seriesIndex: 0,
        orient: 'vertical',
        right: 60,
        top: '15%',
        itemHeight: 100,
        inRange: { color: getColorScheme(settings.colorScheme) },
        text: ['Aktuell', '']
    },
    {
        type: 'continuous',
        min: 0,
        max: comparisonMax,
        seriesIndex: 1,
        orient: 'vertical',
        right: 10,
        top: '60%',
        itemHeight: 100,
        inRange: { color: getColorScheme(settings.colorScheme) },
        text: ['Vergleich', '']
    }
]
```

### Wichtige Hinweise

1. **Intervall-Limit:** ThingsBoard max 700 Intervalle pro Abfrage
2. **Auth:** `self.ctx.http` nutzt automatisch User-Session
3. **Zwei Abfragen:** Aktueller + Vergleichszeitraum separat laden
4. **Performance:** Bei großen Datenmengen Aggregation nutzen
5. **Heatmap Datenformat:** `[[xIndex, yIndex, value], ...]` - Indices, nicht Labels
6. **Tooltip trigger:** Bei Heatmaps `trigger: 'item'` verwenden, nicht `'axis'`
7. **Y-Achse inverse:** `inverse: true` für intuitive Darstellung (00:00 oben)

---

## Beispiel Use Cases

1. **Stromverbrauch Wochenübersicht:**
   - viewMode: week, timeResolution: 1h, colorScheme: energy

2. **Wochenvergleich Heizung:**
   - viewMode: week, compareMode: true, comparePeriod: previousWeek, colorScheme: heat

3. **Täglicher Wasserverbrauch aus Zählerstand:**
   - viewMode: day, calculateConsumption: true, colorScheme: water

4. **Monatsvergleich Gasverbrauch:**
   - viewMode: month, compareMode: true, comparePeriod: previousMonth, colorScheme: gas

---

## Vor der Implementierung

1. `node sync/sync.js pull-bundle eco_custom_widgets`
2. Bestehendes Widget analysieren: `widgets/types/eco_heatmap_cartesian.json`
3. Referenz-Widget: `eco_timeseries_zoom_sync` für ECO-Patterns
4. Nutze `ECOWidgetUtils` Library wo möglich
5. Behalte alle bestehenden Features (Zoom Sync, Stats Card, Toolbox)
