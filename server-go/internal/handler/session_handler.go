package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
)

func (h *Handler) GetSessions(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	if outletID == "" {
		outletID = r.Header.Get("X-Outlet-ID")
	}
	sessions, err := h.SessionRepo.GetSessionsByOutlet(r.Context(), outletID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, sessions)
}

func (h *Handler) GetSessionByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "Session ID is required")
		return
	}

	session, err := h.SessionRepo.GetSessionByID(r.Context(), id)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if session == nil {
		h.writeError(w, http.StatusNotFound, "Session not found")
		return
	}

	h.writeJSON(w, http.StatusOK, session)
}

func (h *Handler) AddSession(w http.ResponseWriter, r *http.Request) {
	var req model.ActiveSession
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	session, err := h.SessionRepo.AddSession(r.Context(), req)
	if err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "SESSION_ADDED",
		OutletID: session.OutletID,
		Payload:  session,
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"session": session,
	})
}

func (h *Handler) EditSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.ActiveSession
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if id != "" && req.ID == "" {
		req.ID = id
	}
	if req.ID == "" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Session ID required",
		})
		return
	}

	session, err := h.SessionRepo.EditSession(r.Context(), req)
	if err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "SESSION_UPDATED",
		OutletID: session.OutletID,
		Payload:  session,
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"session": session,
	})
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		var body struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		id = body.ID
	}
	id = strings.TrimSpace(id)
	if id == "" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Session ID is required",
		})
		return
	}

	outletID := "all"
	existing, err := h.SessionRepo.GetSessionByID(r.Context(), id)
	if err == nil && existing != nil && existing.OutletID != "" {
		outletID = existing.OutletID
	}

	if err := h.SessionRepo.DeleteSession(r.Context(), id); err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "SESSION_DELETED",
		OutletID: outletID,
		Payload:  map[string]string{"id": id},
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) ClaimSession(w http.ResponseWriter, r *http.Request) {
	var req model.ClaimSessionPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	txn, err := h.TxnRepo.ClaimSession(r.Context(), req)
	if err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// Broadcast transaction created
	h.Hub.Broadcast(realtime.Event{
		Type:     "SESSION_CLAIMED",
		OutletID: txn.OutletID,
		Payload:  txn,
	})

	// Also broadcast session update or removal if sessionId was provided
	if req.SessionID != "" {
		hasRemaining := len(req.RemainingItems) > 0 && string(req.RemainingItems) != "null" && string(req.RemainingItems) != "[]"
		if hasRemaining {
			h.Hub.Broadcast(realtime.Event{
				Type:     "SESSION_UPDATED",
				OutletID: txn.OutletID,
				Payload: map[string]any{
					"id":    req.SessionID,
					"items": req.RemainingItems,
				},
			})
		} else {
			h.Hub.Broadcast(realtime.Event{
				Type:     "SESSION_DELETED",
				OutletID: txn.OutletID,
				Payload:  map[string]string{"id": req.SessionID},
			})
		}
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success":     true,
		"transaction": txn,
	})
}

func (h *Handler) TrackSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		id = r.URL.Query().Get("id")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"error": "ID sesi diperlukan",
		})
		return
	}

	sess, err := h.SessionRepo.GetSessionByID(r.Context(), id)
	if err == nil && sess != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"session": sess,
		})
		return
	}

	txn, err := h.TxnRepo.GetTransactionByID(r.Context(), id)
	if err == nil && txn != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"transaction": txn,
		})
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"error": "Sesi tidak ditemukan atau sudah dihapus.",
	})
}
