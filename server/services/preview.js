import { createProxyMiddleware } from 'http-proxy-middleware';
import net from 'net';
import { EventEmitter } from 'events';

// Preview service to manage running applications and their ports
class PreviewService extends EventEmitter {
  constructor() {
    super();
    this.runningApps = new Map(); // projectName -> { port, proxy, status, url, startTime }
    this.portRange = { min: 3100, max: 3200 }; // Port range for preview apps
    this.usedPorts = new Set();
  }

  // Check if a port is available
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  // Find an available port in our range
  async findAvailablePort() {
    for (let port = this.portRange.min; port <= this.portRange.max; port++) {
      if (!this.usedPorts.has(port) && await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error('No available ports in range');
  }

  // Detect if an application is running on a port
  async detectRunningApp(port) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        timeout: 1000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Scan for running applications in the project directory
  async scanForRunningApps(projectPath) {
    const detectedApps = [];
    
    // Common development server ports to check
    const commonPorts = [3000, 3001, 4000, 4200, 5000, 5173, 8000, 8080, 8888, 9000];
    
    for (const port of commonPorts) {
      if (await this.detectRunningApp(port)) {
        detectedApps.push({
          port,
          url: `http://localhost:${port}`,
          detected: true,
          framework: this.guessFramework(port)
        });
      }
    }
    
    return detectedApps;
  }

  // Guess framework based on port (heuristic)
  guessFramework(port) {
    const frameworks = {
      3000: 'React/Next.js',
      4200: 'Angular',
      5173: 'Vite',
      8080: 'Webpack Dev Server',
      8000: 'Django/Python',
      4000: 'Express/Node.js',
      5000: 'Flask/React',
      9000: 'Gatsby'
    };
    
    return frameworks[port] || 'Unknown';
  }

  // Register a running application
  async registerApp(projectName, port, options = {}) {
    const appInfo = {
      port,
      url: `http://localhost:${port}`,
      status: 'running',
      startTime: new Date(),
      framework: options.framework || this.guessFramework(port),
      projectPath: options.projectPath,
      detected: options.detected || false
    };

    this.runningApps.set(projectName, appInfo);
    this.usedPorts.add(port);
    
    console.log(`📱 Registered preview app for ${projectName} on port ${port}`);
    
    // Emit event for UI updates
    this.emit('app-registered', { projectName, ...appInfo });
    
    return appInfo;
  }

  // Unregister an application
  unregisterApp(projectName) {
    const appInfo = this.runningApps.get(projectName);
    if (appInfo) {
      this.usedPorts.delete(appInfo.port);
      this.runningApps.delete(projectName);
      
      console.log(`📱 Unregistered preview app for ${projectName}`);
      
      // Emit event for UI updates
      this.emit('app-unregistered', { projectName, ...appInfo });
    }
  }

  // Get app info for a project
  getApp(projectName) {
    return this.runningApps.get(projectName);
  }

  // Get all running apps
  getAllApps() {
    return Array.from(this.runningApps.entries()).map(([projectName, appInfo]) => ({
      projectName,
      ...appInfo
    }));
  }

  // Create a proxy middleware for an app
  createProxy(targetPort, options = {}) {
    return createProxyMiddleware({
      target: `http://localhost:${targetPort}`,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      pathRewrite: {
        [`^/preview/${options.projectName}`]: '', // Remove preview prefix
      },
      onError: (err, req, res) => {
        console.error(`Preview proxy error for port ${targetPort}:`, err.message);
        
        // Return HTML error page instead of JSON for iframe compatibility
        res.status(502).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview Service Unavailable</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f3f4f6; 
                color: #374151; 
                margin: 0; 
                padding: 40px 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .container { 
                text-align: center; 
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                max-width: 500px;
              }
              .icon { font-size: 48px; margin-bottom: 20px; }
              h1 { color: #dc2626; margin-bottom: 16px; }
              p { margin-bottom: 12px; line-height: 1.5; }
              .error-details { 
                background: #fef2f2; 
                color: #dc2626;
                padding: 12px; 
                border-radius: 6px; 
                margin-top: 20px;
                font-size: 14px;
                word-break: break-word;
              }
              .retry-btn {
                margin-top: 20px;
                padding: 10px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              }
              .retry-btn:hover {
                background: #2563eb;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">🔌</div>
              <h1>Preview Service Unavailable</h1>
              <p>Unable to connect to the development server on port <strong>${targetPort}</strong>.</p>
              <p>The development server might not be running or may have crashed.</p>
              <div class="error-details">
                Error: ${err.message}
              </div>
              <button class="retry-btn" onclick="window.location.reload()">
                Retry Connection
              </button>
            </div>
          </body>
          </html>
        `);
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add headers to identify preview requests
        proxyReq.setHeader('X-Preview-Mode', 'true');
        proxyReq.setHeader('X-Project-Name', options.projectName || 'unknown');
      },
      ...options.proxyOptions
    });
  }

  // Monitor application health
  async monitorApps() {
    for (const [projectName, appInfo] of this.runningApps.entries()) {
      const isRunning = await this.detectRunningApp(appInfo.port);
      
      if (!isRunning && appInfo.status === 'running') {
        // App went down
        appInfo.status = 'stopped';
        console.log(`📱 App ${projectName} on port ${appInfo.port} went down`);
        this.emit('app-status-changed', { projectName, status: 'stopped', ...appInfo });
        
      } else if (isRunning && appInfo.status === 'stopped') {
        // App came back up
        appInfo.status = 'running';
        console.log(`📱 App ${projectName} on port ${appInfo.port} came back up`);
        this.emit('app-status-changed', { projectName, status: 'running', ...appInfo });
      }
    }
  }

  // Start monitoring (call this periodically)
  startMonitoring(interval = 5000) {
    this.monitorInterval = setInterval(() => {
      this.monitorApps();
    }, interval);
    
    console.log('📱 Started preview service monitoring');
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log('📱 Stopped preview service monitoring');
    }
  }
}

// Create and export singleton instance
export const previewService = new PreviewService();
export default previewService;