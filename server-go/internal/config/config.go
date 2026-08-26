package config

import "os"

type Config struct {
	Port           string
	DatabaseURL    string
	AdminPass      string
	CorsOrigin     string
	TLSCertFile    string
	TLSKeyFile     string
	CookieSecure   bool
	CookieSameSite string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://kasir:kasir_password@localhost:5432/kasir_db?sslmode=disable"
	}
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "admin123"
	}
	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}
	tlsCert := os.Getenv("TLS_CERT_FILE")
	tlsKey := os.Getenv("TLS_KEY_FILE")

	cookieSecure := os.Getenv("COOKIE_SECURE") == "true" || tlsCert != ""

	return &Config{
		Port:           port,
		DatabaseURL:    dbURL,
		AdminPass:      adminPass,
		CorsOrigin:     corsOrigin,
		TLSCertFile:    tlsCert,
		TLSKeyFile:     tlsKey,
		CookieSecure:   cookieSecure,
		CookieSameSite: "Lax",
	}
}
