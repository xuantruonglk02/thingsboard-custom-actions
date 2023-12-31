const $injector = widgetContext.$scope.$injector;

// get list of data keys and devices
const devices = {};
widgetContext.data.forEach((key) => {
    if (key.datasource.type === 'entity') {
        const deviceId = key.datasource.entityId;
        if (!devices[deviceId]) {
            devices[deviceId] = {
                name: key.datasource.entityName,
                keys: [key.dataKey.name],
            };
        } else {
            devices[deviceId].keys.push(key.dataKey.name);
        }
    }
});

const attributeService = $injector.get(
    widgetContext.servicesMap.get('attributeService')
);
const importExportService = $injector.get(
    widgetContext.servicesMap.get('importExport')
);
// get current time window of the chart
const minTimeMs = widgetContext.timeWindow.minTime;
const maxTimeMs = widgetContext.timeWindow.maxTime;
const minTime = moment(minTimeMs).format('YYYYMMDDTHHmmss');
const maxTime = moment(maxTimeMs).format('YYYYMMDDTHHmmss');
const limit = 1000000000;
// download telemetry data of above devices
Promise.all(
    Object.entries(devices).map(([key, value]) =>
        attributeService
            .getEntityTimeseries(
                { entityType: 'DEVICE', id: key },
                value.keys,
                minTimeMs,
                maxTimeMs,
                limit,
                null,
                null,
                'ASC'
            )
            .toPromise()
    )
).then((data) => {
    const fileName = `${widgetContext.widget.config.title}_from_${minTime}_to_${maxTime}`;
    const csvData = makeCsvData(devices, data);
    importExportService.exportCsv(csvData, fileName);
});

// function used to convert downloaded data into standard format
// map data keys and its value to timeseries, then convert these timeseries objects to rows
function makeCsvData(devices, data) {
    const mapTsToData = new Map();
    Object.entries(devices).forEach(([key, device], index) => {
        device.keys.forEach((key) => {
            if (data[index][key])
                data[index][key].forEach((timeNode) => {
                    const ts = timeNode.ts;
                    if (mapTsToData.has(ts)) {
                        const data = mapTsToData.get(ts);
                        data[`${device.name}-${key}`] = timeNode.value || '';
                        mapTsToData.set(ts, data);
                    } else {
                        mapTsToData.set(ts, {
                            [`${device.name}-${key}`]: timeNode.value || '',
                        });
                    }
                });
        });
    });

    const csvData = [];
    const tsKeys = Array.from(mapTsToData.keys()).sort();
    tsKeys.forEach((ts) => {
        const tsData = mapTsToData.get(ts);
        const rowData = {
            Timestamp: ts,
            'Date time': moment(ts).format('YYYY/MM/DD HH:mm:ss'),
        };
        Object.entries(devices).forEach(([key, device]) => {
            device.keys.forEach((key) => {
                rowData[`${device.name}-${key}`] =
                    tsData[`${device.name}-${key}`] || '';
            });
        });
        csvData.push(rowData);
    });
    return csvData;
}
