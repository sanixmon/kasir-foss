package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"kasir-backend/internal/config"
	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
	"kasir-backend/internal/repository"
)

type Handler struct {
	OutletRepo  *repository.OutletRepository
	SessionRepo *repository.SessionRepository
	TxnRepo     *repository.TxnRepository
	AuthRepo    *repository.AuthRepository
	SettingRepo *repository.SettingRepository
	DB          repository.DBPool
	Hub         *realtime.Hub
	Config      *config.Config
	StartTime   time.Time
}

func NewHandler(
	outletRepo *repository.OutletRepository,
	sessionRepo *repository.SessionRepository,
	txnRepo *repository.TxnRepository,
	authRepo *repository.AuthRepository,
	settingRepo *repository.SettingRepository,
	db repository.DBPool,
	hub *realtime.Hub,
	cfg *config.Config,
) *Handler {
	return &Handler{
		OutletRepo:  outletRepo,
		SessionRepo: sessionRepo,
		TxnRepo:     txnRepo,
		AuthRepo:    authRepo,
		SettingRepo: settingRepo,
		DB:          db,
		Hub:         hub,
		Config:      cfg,
		StartTime:   time.Now(),
	}
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *Handler) writeError(w http.ResponseWriter, status int, message string, code ...string) {
	resp := map[string]any{
		"error": message,
	}
	if len(code) > 0 && code[0] != "" {
		resp["code"] = code[0]
	}
	h.writeJSON(w, status, resp)
}

func (h *Handler) extractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}
	if tokenQuery := r.URL.Query().Get("token"); tokenQuery != "" {
		return strings.TrimSpace(tokenQuery)
	}
	return ""
}

func (h *Handler) resolveAuth(r *http.Request) *model.AuthToken {
	token := h.extractBearerToken(r)
	if token == "" {
		return nil
	}
	tok, err := h.AuthRepo.ResolveToken(r.Context(), token)
	if err != nil {
		return nil
	}
	return tok
}
