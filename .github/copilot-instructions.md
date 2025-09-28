# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Solarlog Adapter Specific Context

This adapter connects to Solarlog devices to monitor solar photovoltaic installations. Key characteristics:

- **Purpose**: Monitor Solarlog solar energy monitoring devices (models 200PM+, 300PM+, 500, 1200Meter, 50)
- **Connection**: HTTP/JSON interface to local Solarlog devices on the network
- **Data Types**: 
  - Real-time power generation (AC/DC)
  - Voltage measurements (AC/DC)
  - Energy consumption and feed-in data
  - Historical yield data (daily, monthly, yearly)
  - Device status and error reporting
  - Self-consumption ratios and forecasting
- **Configuration**: IP address, port, polling intervals, optional inverter/meter import
- **Special Features**: 
  - Solar forecast integration (requires latitude/longitude/inclination/azimuth)
  - Historical data collection at configurable times
  - Battery data monitoring (where supported)
  - Smart energy switch group data

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();

                        // Wait for adapter to be ready  
                        await harness.startAdapterAndWait();
                        await wait(5000);

                        // Verify initial states
                        const state = await harness.states.getStateAsync('test.0.info.connection');
                        expect(state).to.be.ok;

                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Test File Structure
- `test/integration.js` - Main integration test runner  
- `test/package.js` - Package validation tests
- Additional test files for specific functionality

#### Test Configuration
When configuring harness for testing:

```javascript
// Configure adapter for testing
await harness.changeAdapterConfig('test', {
    native: {
        host: 'test.example.com',
        port: 80,
        pollIntervalcurrent: 30,
        // ... other config
    }
});
```

#### Common Issues and Solutions

**Missing Package Files Test**: Always include package files validation:
```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Validate the package files
tests.packageFiles(path.join(__dirname, '..'));
```

**Test Timeouts**: Integration tests need adequate time for adapter startup:
```javascript
it('should start adapter', function () {
    this.timeout(60000); // Increase timeout for slow startup
    // Test code
});
```

### Solarlog Testing Specifics

When testing this solar monitoring adapter:

```javascript
// Mock Solarlog device responses
const mockSolarlogData = {
    "801": {
        "170": 1234,  // PAC (AC Power)
        "171": 5678,  // PDC (DC Power)
        "172": 230    // UAC (AC Voltage)
    }
};

// Test configuration for solar forecast
const testConfig = {
    host: 'test-solarlog',
    port: 80,
    forecast: true,
    latitude: '52.52',
    longitude: '13.40',
    inclination: '30',
    azimuth: '0'
};
```

## Architecture

### Adapter Structure
- **main.js** - Primary adapter logic and state management  
- **io-package.json** - Adapter metadata and configuration schema
- **admin/** - Configuration UI files
- **docs/** - Documentation and data object reference

### State Management Pattern

Use proper ioBroker state patterns:

```javascript
// Create states
await this.setObjectNotExistsAsync('status.pac', {
    type: 'state',
    common: {
        name: 'PowerAC',
        type: 'number',
        role: 'value.power',
        read: true,
        write: false,
        unit: 'W'
    },
    native: {}
});

// Set state values with acknowledgment
await this.setStateAsync('status.pac', value, true);
```

### Configuration Management

Handle configuration in the `native` section of io-package.json:

```javascript
// Access configuration
const host = this.config.host;
const port = this.config.port || 80;
```

## Development Patterns

### Adapter Lifecycle
```javascript
class SolarlogAdapter extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'solarlog',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    
    async onReady() {
        // Initialize adapter
    }
    
    onUnload(callback) {
        // Cleanup resources
        callback();
    }
}
```

### Data Polling Pattern

For devices like Solarlog that require regular polling:

```javascript
class SolarlogAdapter extends utils.Adapter {
    constructor(options = {}) {
        super(options);
        this.pollTimer = null;
    }
    
    async onReady() {
        await this.startPolling();
    }
    
    async startPolling() {
        // Initial data fetch
        await this.fetchData();
        
        // Set up recurring polling
        this.pollTimer = setTimeout(async () => {
            await this.fetchData();
            await this.startPolling(); // Recursive polling
        }, this.config.pollIntervalcurrent * 1000);
    }
    
    onUnload(callback) {
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        callback();
    }
}
```

### HTTP Request Pattern

For API communication with devices:

```javascript
const axios = require('axios');

async function fetchDeviceData() {
    try {
        const response = await axios.get(`http://${host}:${port}/getjp`, {
            timeout: 5000
        });
        
        if (response.status === 200) {
            return response.data;
        }
        throw new Error(`HTTP ${response.status}`);
        
    } catch (error) {
        this.log.error(`Failed to fetch data: ${error.message}`);
        throw error;
    }
}
```

### Error Handling

Implement comprehensive error handling:

```javascript
async function processData() {
    try {
        const data = await this.fetchData();
        await this.updateStates(data);
        
        // Update connection state
        await this.setStateAsync('info.connection', true, true);
        
    } catch (error) {
        this.log.error(`Data processing failed: ${error.message}`);
        await this.setStateAsync('info.connection', false, true);
        
        // Don't throw - keep adapter running
    }
}
```

## Code Quality

### ESLint Configuration
Follow the project's ESLint rules. Common patterns:

```javascript
// Use proper indentation (4 spaces)
if (condition) {
    doSomething();
}

// Always use semicolons
const variable = getValue();

// Use async/await consistently
async function processData() {
    const result = await fetchData();
    return result;
}
```

### Logging Best Practices

```javascript
// Use appropriate log levels
this.log.error('Critical error occurred');
this.log.warn('Potential issue detected');  
this.log.info('Normal operation info');
this.log.debug('Detailed debugging info');

// Include context in log messages
this.log.error(`Failed to connect to ${host}:${port} - ${error.message}`);
```

### Memory Management

```javascript
// Clean up timers and intervals
onUnload(callback) {
    if (this.pollTimer) {
        clearTimeout(this.pollTimer);
        this.pollTimer = null;
    }
    
    if (this.scheduleJob) {
        this.scheduleJob.cancel();
        this.scheduleJob = null;
    }
    
    callback();
}
```

## Dependencies

### Core Dependencies
- `@iobroker/adapter-core` - Base adapter functionality
- `axios` - HTTP requests (preferred over deprecated libraries)
- `node-schedule` - Scheduled tasks for historical data collection

### Development Dependencies  
- `@iobroker/testing` - Official testing framework
- `eslint` - Code linting
- `mocha` - Test runner
- `chai` - Assertions

### Avoid Deprecated Packages
- Don't use `request` (deprecated) - use `axios` instead
- Don't use `got` if `axios` is already in use for consistency

## Git and Release Management

### Commit Guidelines
- Use conventional commit format: `feat:`, `fix:`, `docs:`, etc.
- Include scope when relevant: `fix(polling):`, `feat(forecast):`
- Reference issues: `fixes #123`

### Branching Strategy
- `master` - stable releases
- `dev` - development branch  
- Feature branches: `feature/description`
- Bug fixes: `fix/issue-description`

### Release Process
- Use `@alcalzone/release-script` for automated releases
- Update `CHANGELOG_OLD.md` for older versions
- Maintain `README.md` changelog section for recent versions

## Documentation

### README Structure
Maintain these sections:
- Installation instructions
- Configuration options 
- Hardware compatibility
- Changelog
- License

### Inline Comments
Add comments for:
- Complex logic
- API response parsing
- Configuration validation
- Error handling strategies

## Security

### Configuration Validation
```javascript
// Validate user inputs
const port = parseInt(this.config.port) || 80;
if (port < 1 || port > 65535) {
    throw new Error('Invalid port number');
}

const host = this.config.host?.trim();
if (!host) {
    throw new Error('Host is required');
}
```

### API Security  
```javascript
// Handle authentication if required
const authConfig = this.config.userpass ? {
    auth: {
        username: this.config.username,
        password: this.config.userpw
    }
} : {};

const response = await axios.get(url, {
    ...authConfig,
    timeout: 5000
});
```

## Performance

### State Updates
```javascript
// Batch state updates when possible
const updates = [
    ['status.pac', powerData.pac],
    ['status.pdc', powerData.pdc],
    ['status.uac', powerData.uac]
];

for (const [id, value] of updates) {
    await this.setStateAsync(id, value, true);
}
```

### Resource Usage
- Use appropriate polling intervals (not too frequent)
- Implement exponential backoff for failures
- Clean up resources properly in unload

## Troubleshooting

### Common Issues

1. **Connection Problems**: Check host/port configuration and network accessibility
2. **Polling Too Frequent**: Increase intervals to reduce device load
3. **Memory Leaks**: Ensure all timers and schedules are cleared in unload
4. **State Creation**: Use `setObjectNotExistsAsync` to avoid overwriting existing states

### Debug Strategies
```javascript
// Add debug logging for data flow
this.log.debug(`Received data: ${JSON.stringify(data, null, 2)}`);

// Log configuration on startup  
this.log.info(`Connecting to ${this.config.host}:${this.config.port}`);

// Track polling performance
const startTime = Date.now();
// ... do work ...
this.log.debug(`Polling completed in ${Date.now() - startTime}ms`);
```

This comprehensive guide should help GitHub Copilot understand the ioBroker adapter development patterns and provide more relevant suggestions for this solar monitoring adapter.