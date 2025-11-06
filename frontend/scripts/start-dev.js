#!/usr/bin/env node

/**
 * Development startup script
 * Starts backend server first, then frontend after backend is ready
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
const backendDir = join(projectRoot, 'backend');
const frontendDir = join(__dirname, '..');

const BACKEND_URL = 'http://localhost:8000';
const BACKEND_HEALTH_ENDPOINT = `${BACKEND_URL}/health`;
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000; // 1 second

/**
 * Check if backend is ready by hitting the health endpoint
 */
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_ENDPOINT, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for backend to be ready
 */
async function waitForBackend() {
  console.log('⏳ Waiting for backend to be ready...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await checkBackendHealth();
    if (isReady) {
      console.log('\n✅ Backend is ready!');
      return true;
    }
    
    if (i < MAX_RETRIES - 1) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  console.log('\n❌ Backend failed to start within timeout');
  console.log('💡 Make sure:');
  console.log('   - Python is installed and accessible');
  console.log('   - Backend dependencies are installed (pip install -r requirements.txt)');
  console.log('   - Required environment variables are set');
  return false;
}

/**
 * Start backend server
 */
function startBackend() {
  console.log('🚀 Starting backend server...');
  
  // Determine if we're on Windows or Unix-like
  const isWindows = process.platform === 'win32';
  const pythonCmd = isWindows ? 'python' : 'python3';
  
  // Check if virtual environment exists
  const venvPython = isWindows 
    ? join(backendDir, 'venv', 'Scripts', 'python.exe')
    : join(backendDir, 'venv', 'bin', 'python');
  
  const pythonPath = existsSync(venvPython) ? venvPython : pythonCmd;
  
  console.log(`Using Python: ${pythonPath}`);
  
  // Set PYTHONPATH to parent directory so 'backend' package can be imported
  const parentDir = join(backendDir, '..');
  const pythonPathEnv = process.env.PYTHONPATH 
    ? `${parentDir}:${process.env.PYTHONPATH}` 
    : parentDir;
  
  const backendProcess = spawn(pythonPath, [
    '-m', 'uvicorn',
    'backend.app.api.main:app',
    '--reload',
    '--port', '8000'
  ], {
    cwd: parentDir, // Run from parent directory so 'backend' package is discoverable
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      PYTHONPATH: pythonPathEnv,
    }
  });
  
  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend:', error.message);
    console.error('💡 Troubleshooting:');
    console.error('   1. Make sure Python is installed');
    console.error('   2. Install backend dependencies: cd backend && pip install -r requirements.txt');
    console.error('   3. Or activate virtual environment: source backend/venv/bin/activate');
    process.exit(1);
  });
  
  // Log when backend process exits
  backendProcess.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`\n❌ Backend process exited with code ${code}`);
      if (signal) {
        console.error(`   Signal: ${signal}`);
      }
    }
  });
  
  return backendProcess;
}

/**
 * Start frontend server
 */
function startFrontend() {
  console.log('🚀 Starting frontend server...');
  
  const isWindows = process.platform === 'win32';
  const frontendProcess = spawn('npm', ['run', 'dev:frontend'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: isWindows
  });
  
  frontendProcess.on('error', (error) => {
    console.error('❌ Failed to start frontend:', error.message);
    process.exit(1);
  });
  
  return frontendProcess;
}

/**
 * Main function
 */
async function main() {
  console.log('🎯 Starting development environment...\n');
  
  // Start backend
  const backendProcess = startBackend();
  
  // Wait for backend to be ready
  const backendReady = await waitForBackend();
  
  if (!backendReady) {
    console.error('❌ Backend failed to start. Exiting...');
    backendProcess.kill();
    process.exit(1);
  }
  
  // Start frontend
  const frontendProcess = startFrontend();
  
  // Handle cleanup on exit
  const cleanup = () => {
    console.log('\n\n🛑 Shutting down servers...');
    backendProcess.kill();
    frontendProcess.kill();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Handle process errors
  backendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('❌ Backend process exited with error');
      frontendProcess.kill();
      process.exit(1);
    }
  });
  
  frontendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('❌ Frontend process exited with error');
      backendProcess.kill();
      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

