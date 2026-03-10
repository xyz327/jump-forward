package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	saltSize   = 32
	keySize    = 32
	iterations = 100000
)

type EncryptedConfig struct {
	Version int    `json:"version"`
	Salt    []byte `json:"salt"`
	Nonce   []byte `json:"nonce"`
	Payload []byte `json:"payload"`
}

func encrypt(data []byte, password string) ([]byte, error) {
	salt := make([]byte, saltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	key := pbkdf2.Key([]byte(password), salt, iterations, keySize, sha256.New)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	payload := gcm.Seal(nil, nonce, data, nil)

	config := EncryptedConfig{
		Version: 1,
		Salt:    salt,
		Nonce:   nonce,
		Payload: payload,
	}

	return json.Marshal(config)
}

func decrypt(data []byte, password string) ([]byte, error) {
	var config EncryptedConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("invalid config file format: %w", err)
	}

	if config.Version != 1 {
		return nil, fmt.Errorf("unsupported config version: %d", config.Version)
	}

	key := pbkdf2.Key([]byte(password), config.Salt, iterations, keySize, sha256.New)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	decrypted, err := gcm.Open(nil, config.Nonce, config.Payload, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt (check your password): %w", err)
	}

	return decrypted, nil
}
