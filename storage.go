package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Storage interface to allow switching implementations later (e.g. SQLite)
type Storage interface {
	Load() (*PersistedData, error)
	Save(data *PersistedData) error
}

type PersistedData struct {
	Forwards  map[string]*ForwardConfig  `json:"forwards"`
	JumpHosts map[string]*JumpHostConfig `json:"jump_hosts"`
}

// JSONStorage implements the Storage interface using a simple JSON file
type JSONStorage struct {
	filePath string
	mu       sync.Mutex
}

func NewJSONStorage(filename string) (*JSONStorage, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	appDir := filepath.Join(configDir, "jump-forward")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	return &JSONStorage{
		filePath: filepath.Join(appDir, filename),
	}, nil
}

func (s *JSONStorage) Load() (*PersistedData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data := &PersistedData{
		Forwards:  make(map[string]*ForwardConfig),
		JumpHosts: make(map[string]*JumpHostConfig),
	}

	file, err := os.Open(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return data, nil // Return empty data if file doesn't exist
		}
		return nil, fmt.Errorf("failed to open storage file: %w", err)
	}
	defer file.Close()

	if err := json.NewDecoder(file).Decode(data); err != nil {
		return nil, fmt.Errorf("failed to decode storage file: %w", err)
	}

	// Ensure maps are initialized even if they were missing in JSON
	if data.Forwards == nil {
		data.Forwards = make(map[string]*ForwardConfig)
	}
	if data.JumpHosts == nil {
		data.JumpHosts = make(map[string]*JumpHostConfig)
	}

	// Reset status to stopped on load
	for _, f := range data.Forwards {
		f.Status = "stopped"
	}

	return data, nil
}

func (s *JSONStorage) Save(data *PersistedData) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := os.Create(s.filePath)
	if err != nil {
		return fmt.Errorf("failed to create storage file: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("failed to encode storage data: %w", err)
	}

	return nil
}
