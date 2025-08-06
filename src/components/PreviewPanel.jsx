import React, { useState, useEffect } from 'react';
import { Monitor, ExternalLink, RefreshCw, X, Play, Square, AlertCircle, Globe } from 'lucide-react';

const PreviewPanel = ({ selectedProject, onClose }) => {
  const [previewApps, setPreviewApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState(null);

  // Fetch all preview apps
  const fetchPreviewApps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth-token');
      console.log('Preview API request - Token:', token ? 'present' : 'missing');
      
      const response = await fetch('/api/preview/apps', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Preview API response status:', response.status);
      console.log('Preview API response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const apps = await response.json();
        setPreviewApps(apps);
      } else {
        const errorText = await response.text();
        console.log('Preview API error response:', errorText.slice(0, 200));
        
        let errorMessage = `Failed to fetch preview apps (${response.status})`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // If not JSON, use the text as error
          if (errorText.includes('<!DOCTYPE')) {
            errorMessage = `Authentication failed - received HTML instead of JSON (status: ${response.status})`;
          } else {
            errorMessage = errorText.slice(0, 100) || errorMessage;
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error fetching preview apps:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Scan for running apps in the current project
  const scanForApps = async () => {
    if (!selectedProject) return;
    
    try {
      setScanning(true);
      setError(null);
      const response = await fetch(`/api/preview/scan/${selectedProject}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Scan result:', result);
        
        // Auto-register detected apps
        for (const app of result.detectedApps) {
          await registerApp(selectedProject, app.port, app.framework);
        }
        
        // Refresh the apps list
        await fetchPreviewApps();
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to scan for apps';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText.includes('<!DOCTYPE') 
            ? 'Authentication error during scan'
            : errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error scanning for apps:', err);
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  // Register a new preview app
  const registerApp = async (projectName, port, framework) => {
    try {
      const response = await fetch('/api/preview/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({
          projectName,
          port: parseInt(port),
          framework
        })
      });

      if (response.ok) {
        await fetchPreviewApps();
        return true;
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to register app';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText.includes('<!DOCTYPE') 
            ? 'Authentication error during registration'
            : errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error registering app:', err);
      setError(err.message);
      return false;
    }
  };

  // Unregister a preview app
  const unregisterApp = async (projectName) => {
    try {
      const response = await fetch(`/api/preview/apps/${projectName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });

      if (response.ok) {
        await fetchPreviewApps();
        if (activePreview?.projectName === projectName) {
          setActivePreview(null);
          setPreviewUrl('');
        }
      } else {
        const errorText = await response.text();
        let errorMessage = 'Failed to unregister app';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText.includes('<!DOCTYPE') 
            ? 'Authentication error during unregistration'
            : errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error unregistering app:', err);
      setError(err.message);
    }
  };

  // Open preview for an app
  const openPreview = (app) => {
    setActivePreview(app);
    setPreviewUrl(`/preview/${app.projectName}/`);
    setError(null);
  };

  // Get status color for app
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'stopped': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  // Get status icon for app
  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4" />;
      case 'stopped': return <Square className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    fetchPreviewApps();
    
    // Refresh apps every 10 seconds
    const interval = setInterval(fetchPreviewApps, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Monitor className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preview
          </h2>
          {selectedProject && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              • {selectedProject}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={scanForApps}
            disabled={scanning || !selectedProject}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
            title="Scan for running apps"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            title="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Apps List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Running Apps
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {previewApps.length} apps
              </span>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Dismiss
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : previewApps.length === 0 ? (
              <div className="text-center py-8">
                <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  No preview apps running
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                  Start a development server in your project to see it here
                </p>
                {selectedProject && (
                  <button
                    onClick={scanForApps}
                    disabled={scanning}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {scanning ? 'Scanning...' : 'Scan for Apps'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {previewApps.map((app) => (
                  <div
                    key={app.projectName}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      activePreview?.projectName === app.projectName
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => openPreview(app)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {app.projectName}
                      </h4>
                      <div className={`flex items-center space-x-1 ${getStatusColor(app.status)}`}>
                        {getStatusIcon(app.status)}
                        <span className="text-xs capitalize">{app.status}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{app.framework}</span>
                      <span>:{app.port}</span>
                    </div>
                    
                    {app.detected && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Auto-detected
                      </div>
                    )}
                    
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(app.url, '_blank');
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center space-x-1"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open</span>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unregisterApp(app.projectName);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove app"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col">
          {activePreview && previewUrl ? (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {activePreview.projectName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    localhost:{activePreview.port}
                  </span>
                  <div className={`flex items-center space-x-1 text-xs ${getStatusColor(activePreview.status)}`}>
                    {getStatusIcon(activePreview.status)}
                    <span className="capitalize">{activePreview.status}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      // Refresh iframe
                      const iframe = document.getElementById('preview-iframe');
                      if (iframe) {
                        iframe.src = iframe.src;
                      }
                    }}
                    className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => window.open(activePreview.url, '_blank')}
                    className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1">
                {activePreview.status === 'running' ? (
                  <iframe
                    id="preview-iframe"
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={`Preview of ${activePreview.projectName}`}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                    onError={(e) => {
                      console.error('Iframe loading error:', e);
                      setError(`Failed to load preview: ${e.message || 'Unknown error'}`);
                    }}
                    onLoad={(e) => {
                      // Clear any previous iframe errors when successfully loaded
                      if (error && error.includes('Failed to load preview')) {
                        setError(null);
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                        App Not Running
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        The application on port {activePreview.port} is not responding.
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        Start your development server to view the preview.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <Monitor className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                  No Preview Selected
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Select an app from the list to view its preview
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;