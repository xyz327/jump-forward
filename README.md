# Jump Forward

A cross-platform SSH port forwarding manager built with Go and Wails v3.

## Features

- Manage multiple SSH port forwarding rules.
- Support for Jump Hosts (Bastion hosts).
- Real-time connection logs.
- Clean and modern UI.

## Prerequisites

- Go 1.21+
- Node.js 18+
- Wails v3 CLI

## Installation

1. Install Wails v3 CLI:
   ```bash
   go install github.com/wailsapp/wails/v3/cmd/wails3@latest
   ```

2. Clone the repository and navigate to the project directory.

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

## Development

1. Generate bindings:
   ```bash
   wails3 generate bindings
   ```

2. Run in development mode:
   ```bash
   wails3 dev
   ```

## Build

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Build the backend:
   ```bash
   go build
   ```

   Or use Wails to package:
   ```bash
   wails3 package
   ```

2. Package as DMG (macOS only):
   ```bash
   wails3 task package:dmg
   ```
