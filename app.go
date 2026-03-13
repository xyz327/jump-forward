package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.org/x/crypto/ssh"
)

type UpdateInfo struct {
	LatestVersion  string `json:"latestVersion"`
	CurrentVersion string `json:"currentVersion"`
	HasUpdate      bool   `json:"hasUpdate"`
	ReleaseURL     string `json:"releaseUrl"`
	ReleaseNotes   string `json:"releaseNotes"`
}

type ForwardConfig struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	GroupID     string           `json:"groupId"` // ID of the group it belongs to
	LocalPort   int              `json:"localPort"`
	RemoteHost  string           `json:"remoteHost"`
	RemotePort  int              `json:"remotePort"`
	JumpHostID  string           `json:"jumpHostId"`
	Status      string           `json:"status"`      // "running", "stopped", "error"
	Connections []ConnectionInfo `json:"connections"` // Current active connections
}

type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ConnectionInfo struct {
	ID        string `json:"id"`
	SrcAddr   string `json:"srcAddr"`
	StartTime int64  `json:"startTime"`
}

type JumpHostConfig struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	AuthType string `json:"authType"` // "password", "key"
	Password string `json:"password"`
	KeyPath  string `json:"keyPath"`
}

type LogEntry struct {
	Timestamp int64  `json:"timestamp"`
	Message   string `json:"message"`
	Level     string `json:"level"` // "info", "error"
}

type Notification struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Type      string `json:"type"` // "info", "error", "success", "warning"
	Timestamp int64  `json:"timestamp"`
}

type App struct {
	ctx         context.Context
	forwards    map[string]*ForwardConfig
	jumpHosts   map[string]*JumpHostConfig
	groups      map[string]*Group
	listeners   map[string]net.Listener
	logs        map[string][]LogEntry
	activeConns map[string]map[string]*ConnectionInfo
	mu          sync.RWMutex
	sshClients  map[string]*ssh.Client
	storage     *JSONStorage
}

func NewApp() *App {
	storage, _ := NewJSONStorage("data.json")
	data, _ := storage.Load()

	return &App{
		forwards:    data.Forwards,
		jumpHosts:   data.JumpHosts,
		groups:      data.Groups,
		listeners:   make(map[string]net.Listener),
		logs:        make(map[string][]LogEntry),
		activeConns: make(map[string]map[string]*ConnectionInfo),
		sshClients:  make(map[string]*ssh.Client),
		storage:     storage,
	}
}

func (a *App) save() {
	a.mu.RLock()
	data := &PersistedData{
		Forwards:  a.forwards,
		JumpHosts: a.jumpHosts,
		Groups:    a.groups,
	}
	a.mu.RUnlock()
	a.storage.Save(data)
}

// Start is called when the application starts
func (a *App) Start(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetAppVersion() string {
	return AppVersion
}

func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/xyz327/jump-forward/releases/latest")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to check for updates: %s", resp.Status)
	}

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	hasUpdate := release.TagName != AppVersion

	return &UpdateInfo{
		LatestVersion:  release.TagName,
		CurrentVersion: AppVersion,
		HasUpdate:      hasUpdate,
		ReleaseURL:     release.HTMLURL,
		ReleaseNotes:   release.Body,
	}, nil
}

func (a *App) GetForwards() []ForwardConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	var list []ForwardConfig
	for _, f := range a.forwards {
		cf := *f
		// Add active connections
		if conns, ok := a.activeConns[f.ID]; ok {
			for _, c := range conns {
				cf.Connections = append(cf.Connections, *c)
			}
			// Sort connections by start time
			sort.Slice(cf.Connections, func(i, j int) bool {
				return cf.Connections[i].StartTime < cf.Connections[j].StartTime
			})
		}
		list = append(list, cf)
	}

	// Stable sort by Name, then ID
	sort.Slice(list, func(i, j int) bool {
		if list[i].Name == list[j].Name {
			return list[i].ID < list[j].ID
		}
		return list[i].Name < list[j].Name
	})

	return list
}

func (a *App) AddForward(config ForwardConfig) string {
	a.mu.Lock()
	config.ID = fmt.Sprintf("fwd-%d", time.Now().UnixNano())
	config.Status = "stopped"
	// Copy to store
	c := config
	a.forwards[config.ID] = &c
	a.mu.Unlock()
	a.save()
	return config.ID
}

func (a *App) StartForward(id string) error {
	a.mu.Lock()
	config, ok := a.forwards[id]
	if !ok {
		a.mu.Unlock()
		return fmt.Errorf("forward not found")
	}
	if config.Status == "running" {
		a.mu.Unlock()
		return nil
	}

	jumpHost, ok := a.jumpHosts[config.JumpHostID]
	if !ok {
		a.mu.Unlock()
		return fmt.Errorf("jump host not found")
	}
	// Make copies to use outside lock
	jh := *jumpHost
	fwd := *config
	a.mu.Unlock()

	// Connect to Jump Host
	client, err := a.getSSHClient(&jh)
	if err != nil {
		a.log(id, "error", fmt.Sprintf("Failed to connect to jump host: %v", err))
		a.notify("Connection Error", fmt.Sprintf("Failed to connect to jump host %s for %s: %v", jh.Name, fwd.Name, err), "error")
		a.mu.Lock()
		a.forwards[id].Status = "error"
		a.mu.Unlock()
		a.save()
		return fmt.Errorf("failed to connect to jump host: %w", err)
	}

	// Start local listener
	localAddr := fmt.Sprintf("127.0.0.1:%d", fwd.LocalPort)
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		a.log(id, "error", fmt.Sprintf("Failed to listen on %s: %v", localAddr, err))
		a.notify("Port Error", fmt.Sprintf("Failed to listen on port %d for %s: %v", fwd.LocalPort, fwd.Name, err), "error")
		a.mu.Lock()
		a.forwards[id].Status = "error"
		a.mu.Unlock()
		a.save()
		return fmt.Errorf("failed to listen on %s: %w", localAddr, err)
	}

	a.mu.Lock()
	a.listeners[id] = listener
	a.forwards[id].Status = "running"
	a.mu.Unlock()
	a.save()

	a.log(id, "info", fmt.Sprintf("Started forwarding %s -> %s via %s", localAddr, fmt.Sprintf("%s:%d", fwd.RemoteHost, fwd.RemotePort), jh.Host))
	a.notify("Forward Started", fmt.Sprintf("Forwarding %s -> %s started", fwd.Name, localAddr), "success")

	go a.handleForward(id, listener, client, fwd.RemoteHost, fwd.RemotePort)

	return nil
}

func (a *App) StopForward(id string) error {
	a.mu.Lock()
	if listener, ok := a.listeners[id]; ok {
		listener.Close()
		delete(a.listeners, id)
	}

	config, ok := a.forwards[id]
	if ok {
		config.Status = "stopped"
	}
	a.mu.Unlock()

	a.log(id, "info", "Stopped forwarding")
	if ok {
		a.notify("Forward Stopped", fmt.Sprintf("Port forward %s has been stopped", config.Name), "info")
	}
	a.save()
	return nil
}

func (a *App) UpdateForward(config ForwardConfig) error {
	a.mu.Lock()
	if _, ok := a.forwards[config.ID]; !ok {
		a.mu.Unlock()
		return fmt.Errorf("forward not found")
	}
	// Preserve status if not running
	if a.forwards[config.ID].Status == "running" {
		a.mu.Unlock()
		return fmt.Errorf("cannot update a running forward")
	}
	c := config
	a.forwards[config.ID] = &c
	a.mu.Unlock()
	a.save()
	a.notify("Forward Updated", fmt.Sprintf("Forwarding rule %s has been updated", config.Name), "success")
	return nil
}

func (a *App) DeleteForward(id string) error {
	a.StopForward(id)
	a.mu.Lock()
	if _, ok := a.forwards[id]; !ok {
		a.mu.Unlock()
		return fmt.Errorf("forward not found")
	}
	delete(a.forwards, id)
	a.mu.Unlock()
	a.save()
	a.log(id, "info", "Forward deleted")
	return nil
}

func (a *App) GetJumpHosts() []JumpHostConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	var list []JumpHostConfig
	for _, h := range a.jumpHosts {
		list = append(list, *h)
	}

	// Stable sort by Name, then ID
	sort.Slice(list, func(i, j int) bool {
		if list[i].Name == list[j].Name {
			return list[i].ID < list[j].ID
		}
		return list[i].Name < list[j].Name
	})

	return list
}

func (a *App) AddJumpHost(config JumpHostConfig) string {
	a.mu.Lock()
	config.ID = fmt.Sprintf("jh-%d", time.Now().UnixNano())
	c := config
	a.jumpHosts[config.ID] = &c
	a.mu.Unlock()
	a.save()
	a.notify("Jump Host Added", fmt.Sprintf("Server %s (%s) has been added", config.Name, config.Host), "success")
	return config.ID
}

func (a *App) UpdateJumpHost(config JumpHostConfig) error {
	a.mu.Lock()
	if _, ok := a.jumpHosts[config.ID]; !ok {
		a.mu.Unlock()
		return fmt.Errorf("jump host not found")
	}
	c := config
	a.jumpHosts[config.ID] = &c
	// Clear cached SSH client if config changed
	client, ok := a.sshClients[config.ID]
	if ok {
		delete(a.sshClients, config.ID)
	}
	a.mu.Unlock()

	if ok && client != nil {
		client.Close()
	}
	a.save()
	a.notify("Jump Host Deleted", "Jump host has been removed", "info")
	return nil
}

func (a *App) DeleteJumpHost(id string) error {
	a.mu.Lock()
	// Check if being used by any forwards
	for _, fwd := range a.forwards {
		if fwd.JumpHostID == id {
			a.mu.Unlock()
			err := fmt.Errorf("jump host is in use by forward: %s", fwd.Name)
			a.notify("Deletion Failed", err.Error(), "error")
			return err
		}
	}

	delete(a.jumpHosts, id)
	client, ok := a.sshClients[id]
	if ok {
		delete(a.sshClients, id)
	}
	a.mu.Unlock()

	if ok && client != nil {
		client.Close()
	}
	a.save()
	return nil
}

func (a *App) GetGroups() []Group {
	a.mu.RLock()
	defer a.mu.RUnlock()
	var list []Group
	for _, g := range a.groups {
		list = append(list, *g)
	}

	// Stable sort by Name
	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})

	return list
}

func (a *App) AddGroup(name string) string {
	a.mu.Lock()
	id := fmt.Sprintf("grp-%d", time.Now().UnixNano())
	a.groups[id] = &Group{
		ID:   id,
		Name: name,
	}
	a.mu.Unlock()
	a.save()
	return id
}

func (a *App) UpdateGroup(id, name string) error {
	a.mu.Lock()
	if _, ok := a.groups[id]; !ok {
		a.mu.Unlock()
		return fmt.Errorf("group not found")
	}
	a.groups[id].Name = name
	a.mu.Unlock()
	a.save()
	return nil
}

func (a *App) DeleteGroup(id string) error {
	a.mu.Lock()
	// Move all forwards in this group to ungrouped (empty GroupID)
	for _, fwd := range a.forwards {
		if fwd.GroupID == id {
			fwd.GroupID = ""
		}
	}

	delete(a.groups, id)
	a.mu.Unlock()
	a.save()
	a.notify("Group Deleted", "Group deleted, forwards moved to Ungrouped", "info")
	return nil
}

func (a *App) BatchUpdateGroup(forwardIDs []string, groupID string) error {
	a.mu.Lock()
	count := 0
	for _, id := range forwardIDs {
		if fwd, ok := a.forwards[id]; ok {
			fwd.GroupID = groupID
			count++
		}
	}
	a.mu.Unlock()
	a.save()
	a.notify("Batch Update", fmt.Sprintf("Moved %d forwards to group", count), "success")
	return nil
}

func (a *App) ExportConfig(password string) error {
	a.mu.RLock()
	data := &PersistedData{
		Forwards:  a.forwards,
		JumpHosts: a.jumpHosts,
		Groups:    a.groups,
	}
	a.mu.RUnlock()

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	encrypted, err := encrypt(jsonData, password)
	if err != nil {
		return err
	}

	app := application.Get()
	dialog := app.Dialog.SaveFile()
	dialog.SetOptions(&application.SaveFileDialogOptions{
		Title:    "Export Configuration",
		Filename: "backup.jfc",
		Filters: []application.FileFilter{
			{DisplayName: "Jump Forward Config (*.jfc)", Pattern: "*.jfc"},
		},
	})

	filePath, err := dialog.PromptForSingleSelection()
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil // User cancelled
	}

	return os.WriteFile(filePath, encrypted, 0600)
}

func (a *App) ImportConfig(password string) error {
	app := application.Get()
	dialog := app.Dialog.OpenFile()
	dialog.SetTitle("Import Configuration")
	dialog.AddFilter("Jump Forward Config (*.jfc)", "*.jfc")

	filePath, err := dialog.PromptForSingleSelection()
	if err != nil {
		return err
	}
	if filePath == "" {
		return nil // User cancelled
	}

	encrypted, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	decrypted, err := decrypt(encrypted, password)
	if err != nil {
		return err
	}

	var data PersistedData
	if err := json.Unmarshal(decrypted, &data); err != nil {
		return err
	}

	a.mu.Lock()
	// Merge logic: update or add
	for id, g := range data.Groups {
		a.groups[id] = g
	}
	for id, jh := range data.JumpHosts {
		a.jumpHosts[id] = jh
	}
	for id, fwd := range data.Forwards {
		a.forwards[id] = fwd
	}
	a.mu.Unlock()
	a.save()
	a.notify("Config Imported", fmt.Sprintf("Imported %d forwards, %d jump hosts and %d groups", len(data.Forwards), len(data.JumpHosts), len(data.Groups)), "success")
	return nil
}

func (a *App) GetLogs(forwardID string) []LogEntry {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.logs[forwardID]
}

// Internal helpers

func (a *App) getSSHClient(config *JumpHostConfig) (*ssh.Client, error) {
	// Simple caching logic: check if client exists and is usable
	a.mu.Lock()
	if client, ok := a.sshClients[config.ID]; ok {
		// Verify if connection is alive
		_, _, err := client.SendRequest("keepalive@golang.org", true, nil)
		if err == nil {
			a.mu.Unlock()
			return client, nil
		}
		// If failed, close and remove
		client.Close()
		delete(a.sshClients, config.ID)
	}
	a.mu.Unlock()

	authMethods := []ssh.AuthMethod{}
	if config.AuthType == "password" {
		authMethods = append(authMethods, ssh.Password(config.Password))
	} else if config.AuthType == "key" {
		key, err := os.ReadFile(config.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read key file: %w", err)
		}
		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	sshConfig := &ssh.ClientConfig{
		User:            config.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Warn: Insecure
		Timeout:         5 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, err
	}

	a.mu.Lock()
	a.sshClients[config.ID] = client
	a.mu.Unlock()

	return client, nil
}

func (a *App) handleForward(id string, listener net.Listener, client *ssh.Client, remoteHost string, remotePort int) {
	for {
		localConn, err := listener.Accept()
		if err != nil {
			// Listener closed
			a.mu.Lock()
			delete(a.activeConns, id)
			a.mu.Unlock()
			return
		}

		connID := fmt.Sprintf("conn-%d", time.Now().UnixNano())
		a.mu.Lock()
		if a.activeConns[id] == nil {
			a.activeConns[id] = make(map[string]*ConnectionInfo)
		}
		a.activeConns[id][connID] = &ConnectionInfo{
			ID:        connID,
			SrcAddr:   localConn.RemoteAddr().String(),
			StartTime: time.Now().Unix(),
		}
		a.mu.Unlock()

		go func(conn net.Conn, cID string) {
			defer func() {
				conn.Close()
				a.mu.Lock()
				if conns, ok := a.activeConns[id]; ok {
					delete(conns, cID)
				}
				a.mu.Unlock()
			}()

			remoteAddr := fmt.Sprintf("%s:%d", remoteHost, remotePort)
			remoteConn, err := client.Dial("tcp", remoteAddr)
			if err != nil {
				a.log(id, "error", fmt.Sprintf("Failed to dial remote %s: %v", remoteAddr, err))
				return
			}
			defer remoteConn.Close()

			a.log(id, "info", fmt.Sprintf("New connection: %s -> %s", conn.RemoteAddr(), remoteAddr))

			// Bidirectional copy
			done := make(chan struct{}, 2)
			go func() {
				io.Copy(conn, remoteConn)
				done <- struct{}{}
			}()
			go func() {
				io.Copy(remoteConn, conn)
				done <- struct{}{}
			}()
			<-done
		}(localConn, connID)
	}
}

func (a *App) notify(title, message, nType string) {
	entry := Notification{
		ID:        fmt.Sprintf("notif-%d", time.Now().UnixNano()),
		Title:     title,
		Message:   message,
		Type:      nType,
		Timestamp: time.Now().Unix(),
	}

	// Emit event to frontend
	app := application.Get()
	app.Event.Emit("notification", entry)
}

func (a *App) log(id, level, message string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	entry := LogEntry{
		Timestamp: time.Now().Unix(),
		Message:   message,
		Level:     level,
	}
	a.logs[id] = append(a.logs[id], entry)

	// Emit event to frontend
	app := application.Get()
	app.Event.Emit("log:"+id, entry)
}
