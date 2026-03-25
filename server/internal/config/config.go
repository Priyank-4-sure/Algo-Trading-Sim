package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// AppConfig represents the root of your configuration setup
type AppConfig struct {
	Server        ServerConfig   `mapstructure:"server"`
	PrimaryDB     DatabaseConfig `mapstructure:"primary_db"`
	CandlestickDB DatabaseConfig `mapstructure:"candlestick_db"`
	Redis         RedisConfig    `mapstructure:"redis"`
}

// ServerConfig holds the HTTP server settings
type ServerConfig struct {
	Port                    int           `mapstructure:"port"`
	Environment             string        `mapstructure:"environment"`
	LogLevel                string        `mapstructure:"log_level"`
	GracefulShutdownTimeout time.Duration `mapstructure:"graceful_shutdown_timeout"`
}

// DatabaseConfig is reused for both Postgres (Primary) and TimescaleDB (Candlesticks)
// because they share the same underlying connection parameters.
type DatabaseConfig struct {
	Driver   string `mapstructure:"driver"`
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Name     string `mapstructure:"name"`
	SSLMode  string `mapstructure:"ssl_mode"`
	Password string `mapstructure:"password"`
}

// RedisConfig holds the caching/pub-sub settings
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
}

// LoadConfig reads the YAML and merges it with the .env overrides
func LoadConfig() (*AppConfig, error) {
	// 1. Load the local .env file (if it exists)
	_ = godotenv.Load()

	// 2. Point Viper to the YAML file
	viper.AddConfigPath("./config")
	viper.SetConfigName("development") // In production, you'd make this dynamic based on an env var like APP_ENV
	viper.SetConfigType("yaml")

	// 3. Read the YAML blueprint
	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read configuration file: %w", err)
	}

	// 4. Map Environment Variables (e.g., PRIMARY_DB_PASSWORD maps to primary_db.password)
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// 5. Decode everything into our Go structs
	var cfg AppConfig
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal configuration: %w", err)
	}

	return &cfg, nil
}