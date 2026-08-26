package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"kasir-backend/internal/model"
	"kasir-backend/internal/repository"
)

type userContextKey string

const AuthUserKey userContextKey = "authUser"

type LoginCashierRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	OutletID string `json:"outletId,omitempty"`
}

type LoginAdminRequest struct {
	Password string `json:"password"`
}

type VerifyAdminRequest struct {
	Password string `json:"password"`
}

type ChangeAdminPassRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

func (h *Handler) LoginCashier(w http.ResponseWriter, r *http.Request) {
	var req LoginCashierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Username dan password harus diisi",
		})
		return
	}

	user, err := h.AuthRepo.AuthenticateUser(r.Context(), req.Username, req.Password)
	if err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	role := user.Role
	if role == "" {
		role = "cashier"
	}

	outletID := user.OutletID
	if outletID == "" && req.OutletID != "" {
		outletID = req.OutletID
	}
	if outletID == "" {
		outletID = "outlet-1"
	}

	tok, err := h.AuthRepo.IssueToken(r.Context(), user.Username, role, outletID, repository.DefaultLoginTokenTTLMs)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Failed to issue auth token: "+err.Error())
		return
	}

	h.setAuthCookie(w, tok.Token, repository.DefaultLoginTokenTTLMs)

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"user": map[string]any{
			"username": user.Username,
			"role":     role,
			"outletId": outletID,
		},
		"token": tok.Token,
	})
}

func (h *Handler) LoginAdmin(w http.ResponseWriter, r *http.Request) {
	var req LoginAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Password) == "" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Password admin harus diisi",
		})
		return
	}

	valid, err := h.AuthRepo.VerifyAdminPassword(r.Context(), req.Password)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !valid {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Password admin tidak sesuai!",
		})
		return
	}

	tok, err := h.AuthRepo.IssueToken(r.Context(), "admin", "admin", "global", repository.DefaultLoginTokenTTLMs)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Failed to issue auth token: "+err.Error())
		return
	}

	h.setAuthCookie(w, tok.Token, repository.DefaultLoginTokenTTLMs)

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"user": map[string]any{
			"username": "admin",
			"role":     "admin",
		},
		"token": tok.Token,
	})
}

func (h *Handler) setAuthCookie(w http.ResponseWriter, token string, ttlMs int64) {
	if ttlMs <= 0 {
		ttlMs = repository.DefaultLoginTokenTTLMs
	}
	cookieSecure := false
	if h.Config != nil {
		cookieSecure = h.Config.CookieSecure
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   cookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttlMs / 1000),
	})
}

func (h *Handler) VerifyAdmin(w http.ResponseWriter, r *http.Request) {
	var req VerifyAdminRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	valid, err := h.AuthRepo.VerifyAdminPassword(r.Context(), req.Password)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !valid {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"valid": false,
		})
		return
	}

	tok, err := h.AuthRepo.IssueToken(r.Context(), "admin", "admin", "global", repository.DefaultEscalationTokenTTLMs)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Failed to issue escalation token: "+err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"valid": true,
		"token": tok.Token,
	})
}

func (h *Handler) ChangeAdminPassword(w http.ResponseWriter, r *http.Request) {
	var req ChangeAdminPassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.AuthRepo.ChangeAdminPassword(r.Context(), req.OldPassword, req.NewPassword); err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	users, err := h.AuthRepo.GetUsers(r.Context(), outletID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, users)
}

func (h *Handler) SaveUser(w http.ResponseWriter, r *http.Request) {
	var req model.User
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Username) == "" {
		h.writeError(w, http.StatusBadRequest, "Username is required")
		return
	}
	if req.Role == "" {
		req.Role = "cashier"
	}

	if err := h.AuthRepo.SaveUser(r.Context(), req); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if username == "" {
		h.writeError(w, http.StatusBadRequest, "Username is required")
		return
	}

	if err := h.AuthRepo.DeleteUser(r.Context(), username); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

// Middleware
func (h *Handler) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := h.resolveAuth(r)
		if tok == nil {
			h.writeError(w, http.StatusUnauthorized, "Unauthorized: login required", "UNAUTHORIZED")
			return
		}
		ctx := context.WithValue(r.Context(), AuthUserKey, tok)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *Handler) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := h.resolveAuth(r)
		if tok == nil {
			h.writeError(w, http.StatusUnauthorized, "Unauthorized: login required", "UNAUTHORIZED")
			return
		}
		if tok.Role != "admin" {
			h.writeError(w, http.StatusForbidden, "Forbidden: admin role required", "FORBIDDEN")
			return
		}
		ctx := context.WithValue(r.Context(), AuthUserKey, tok)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
