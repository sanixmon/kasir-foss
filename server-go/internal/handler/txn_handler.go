package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
)

type DeleteTxnRequest struct {
	ID       string `json:"id"`
	No       int    `json:"no"`
	OutletID string `json:"outletId"`
	ClearAll bool   `json:"clearAll"`
}

func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	tanggal := r.URL.Query().Get("tanggal")
	txns, err := h.TxnRepo.GetTransactions(r.Context(), outletID, tanggal)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, txns)
}

func (h *Handler) GetTransactionByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "Transaction ID is required")
		return
	}

	txn, err := h.TxnRepo.GetTransactionByID(r.Context(), id)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if txn == nil {
		h.writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	h.writeJSON(w, http.StatusOK, txn)
}

func (h *Handler) DeleteTxn(w http.ResponseWriter, r *http.Request) {
	var req DeleteTxnRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	urlID := chi.URLParam(r, "id")
	if urlID != "" {
		req.ID = urlID
	}
	if req.OutletID == "" {
		req.OutletID = r.URL.Query().Get("outlet_id")
	}
	if req.ID == "" {
		req.ID = r.URL.Query().Get("id")
	}
	if req.No == 0 {
		if noStr := r.URL.Query().Get("no"); noStr != "" {
			req.No, _ = strconv.Atoi(noStr)
		}
	}
	if !req.ClearAll {
		if clearStr := r.URL.Query().Get("clearAll"); clearStr == "true" {
			req.ClearAll = true
		}
	}

	if req.ClearAll {
		if err := h.TxnRepo.ClearAllTxns(r.Context(), req.OutletID); err != nil {
			h.writeJSON(w, http.StatusOK, map[string]any{
				"success": false,
				"error":   err.Error(),
			})
			return
		}

		targetOutlet := req.OutletID
		if targetOutlet == "" {
			targetOutlet = "all"
		}
		h.Hub.Broadcast(realtime.Event{
			Type:     "TXNS_CLEARED",
			OutletID: targetOutlet,
			Payload:  map[string]string{"outletId": targetOutlet},
		})

		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
		})
		return
	}

	req.ID = strings.TrimSpace(req.ID)
	if req.ID == "" && req.No <= 0 {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   "Transaction ID or No is required",
		})
		return
	}

	outletID := req.OutletID
	if outletID == "" {
		if req.ID != "" {
			if existing, err := h.TxnRepo.GetTransactionByID(r.Context(), req.ID); err == nil && existing != nil {
				outletID = existing.OutletID
			}
		}
	}
	if outletID == "" {
		outletID = "all"
	}

	if err := h.TxnRepo.DeleteTxn(r.Context(), req.ID, req.No, req.OutletID); err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "TXN_DELETED",
		OutletID: outletID,
		Payload: map[string]any{
			"id":       req.ID,
			"no":       req.No,
			"outletId": outletID,
		},
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) ClearAllTxns(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	if r.Body != nil {
		var body struct {
			OutletID string `json:"outletId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.OutletID != "" {
			outletID = body.OutletID
		}
	}

	if err := h.TxnRepo.ClearAllTxns(r.Context(), outletID); err != nil {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	targetOutlet := outletID
	if targetOutlet == "" {
		targetOutlet = "all"
	}
	h.Hub.Broadcast(realtime.Event{
		Type:     "TXNS_CLEARED",
		OutletID: targetOutlet,
		Payload:  map[string]string{"outletId": targetOutlet},
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}

func (h *Handler) GetDeletionLogs(w http.ResponseWriter, r *http.Request) {
	outletID := r.URL.Query().Get("outlet_id")
	limitStr := r.URL.Query().Get("limit")
	limit := 200
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	logs, err := h.TxnRepo.GetDeletionLogs(r.Context(), outletID, limit)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]any{
		"logs": logs,
	})
}

func (h *Handler) AddDeletionLog(w http.ResponseWriter, r *http.Request) {
	var req model.DeletionLog
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.TxnRepo.AddDeletionLog(r.Context(), req); err != nil {
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
