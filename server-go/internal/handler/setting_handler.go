package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
)

type SaveSettingRequest struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	OutletID string `json:"outletId"`
}

type LegacyActionRequest struct {
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
	Token   string          `json:"token,omitempty"`
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	settings, err := h.SettingRepo.GetSettings(r.Context(), outletID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) SaveSetting(w http.ResponseWriter, r *http.Request) {
	var req SaveSettingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Key = strings.TrimSpace(req.Key)
	if req.Key == "" {
		h.writeError(w, http.StatusBadRequest, "Key is required")
		return
	}

	outletID := req.OutletID
	if outletID == "" {
		outletID = "global"
	}

	if err := h.SettingRepo.SaveSetting(r.Context(), req.Key, outletID, req.Value); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "SETTING_UPDATED",
		OutletID: outletID,
		Payload: map[string]string{
			"key":      req.Key,
			"value":    req.Value,
			"outletId": outletID,
		},
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) FetchAllData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	outletID := r.URL.Query().Get("outlet_id")

	sessions, err := h.SessionRepo.GetSessionsByOutlet(ctx, outletID)
	if err != nil {
		sessions = []model.ActiveSession{}
	}

	txns, err := h.TxnRepo.GetTransactions(ctx, outletID, "")
	if err != nil {
		txns = []model.Transaction{}
	}

	users, err := h.AuthRepo.GetUsers(ctx, outletID)
	if err != nil {
		users = []model.User{}
	}

	settings, err := h.SettingRepo.GetSettings(ctx, outletID)
	if err != nil {
		settings = make(map[string]string)
	}

	outlets, err := h.OutletRepo.GetOutlets(ctx)
	if err != nil {
		outlets = []model.Outlet{}
	}

	resp := map[string]any{
		"sessions":     sessions,
		"transactions": txns,
		"users":        users,
		"settings":     settings,
		"outlets":      outlets,
	}

	h.writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) HandleLegacyAction(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 2*1024*1024))
	if err != nil {
		h.writeError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}

	var req LegacyActionRequest
	if len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, &req); err != nil {
			h.writeError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
	}

	action := req.Action
	if action == "" {
		action = "fetch_data"
	}

	token := h.extractBearerToken(r)
	if token == "" && req.Token != "" {
		token = req.Token
	}

	var auth *model.AuthToken
	if token != "" {
		auth, _ = h.AuthRepo.ResolveToken(r.Context(), token)
	}

	// Auth gate
	isPublic := action == "login_cashier" || action == "login_admin" || action == "track_session"
	isAdminOnly := action == "save_setting" || action == "save_user" || action == "delete_user" ||
		action == "delete_txn" || action == "clear_all_txns" || action == "change_admin_pass" ||
		action == "get_deletion_logs" || action == "add_deletion_log" || action == "backup_db"

	if !isPublic {
		if auth == nil {
			h.writeError(w, http.StatusUnauthorized, "Unauthorized: login required", "UNAUTHORIZED")
			return
		}
		if isAdminOnly && auth.Role != "admin" {
			h.writeError(w, http.StatusForbidden, "Forbidden: admin role required", "FORBIDDEN")
			return
		}
	}

	payloadBytes := req.Payload
	if len(payloadBytes) == 0 || string(payloadBytes) == "null" {
		payloadBytes = []byte("{}")
	}

	// Recreate request with the payload as body
	payloadReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, r.URL.String(), bytes.NewReader(payloadBytes))
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	payloadReq.Header.Set("Content-Type", "application/json")

	switch action {
	case "fetch_data":
		h.FetchAllData(w, r)
	case "add_session":
		h.AddSession(w, payloadReq)
	case "edit_session":
		h.EditSession(w, payloadReq)
	case "delete_session":
		var p struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal(payloadBytes, &p)
		deleteReq, _ := http.NewRequestWithContext(r.Context(), http.MethodDelete, fmt.Sprintf("/api/sessions/%s", p.ID), bytes.NewReader(payloadBytes))
		h.DeleteSession(w, deleteReq)
	case "claim_session":
		h.ClaimSession(w, payloadReq)
	case "save_setting":
		h.SaveSetting(w, payloadReq)
	case "save_user":
		h.SaveUser(w, payloadReq)
	case "delete_user":
		var p struct {
			Username string `json:"username"`
		}
		_ = json.Unmarshal(payloadBytes, &p)
		delReq, _ := http.NewRequestWithContext(r.Context(), http.MethodDelete, fmt.Sprintf("/api/users/%s", p.Username), nil)
		h.DeleteUser(w, delReq)
	case "delete_txn":
		h.DeleteTxn(w, payloadReq)
	case "clear_all_txns":
		h.ClearAllTxns(w, payloadReq)
	case "verify_admin":
		h.VerifyAdmin(w, payloadReq)
	case "change_admin_pass":
		h.ChangeAdminPassword(w, payloadReq)
	case "login_cashier":
		h.LoginCashier(w, payloadReq)
	case "login_admin":
		h.LoginAdmin(w, payloadReq)
	case "track_session":
		var p struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal(payloadBytes, &p)
		trackReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, fmt.Sprintf("/api/track/%s", p.ID), nil)
		h.TrackSession(w, trackReq)
	case "get_deletion_logs":
		h.GetDeletionLogs(w, payloadReq)
	case "add_deletion_log":
		h.AddDeletionLog(w, payloadReq)
	case "backup_db":
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"path":    "postgresql_continuous_replication",
		})
	default:
		h.writeError(w, http.StatusBadRequest, fmt.Sprintf("Unknown action: %s", action))
	}
}
