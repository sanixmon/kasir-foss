package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"kasir-backend/internal/model"
	"kasir-backend/internal/realtime"
)

func (h *Handler) GetOutlets(w http.ResponseWriter, r *http.Request) {
	outlets, err := h.OutletRepo.GetOutlets(r.Context())
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.writeJSON(w, http.StatusOK, outlets)
}

func (h *Handler) GetOutletByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "Outlet ID is required")
		return
	}

	outlet, err := h.OutletRepo.GetOutletByID(r.Context(), id)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if outlet == nil {
		h.writeError(w, http.StatusNotFound, "Outlet not found")
		return
	}

	h.writeJSON(w, http.StatusOK, outlet)
}

func (h *Handler) CreateOutlet(w http.ResponseWriter, r *http.Request) {
	var req model.Outlet
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ID == "" || req.Nama == "" {
		h.writeError(w, http.StatusBadRequest, "ID and nama are required")
		return
	}

	if err := h.OutletRepo.CreateOutlet(r.Context(), req); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "OUTLET_UPDATED",
		OutletID: "all",
		Payload:  req,
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"outlet":  req,
	})
}

func (h *Handler) DeleteOutlet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "Outlet ID is required")
		return
	}

	if err := h.OutletRepo.DeleteOutlet(r.Context(), id); err != nil {
		h.writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.Hub.Broadcast(realtime.Event{
		Type:     "OUTLET_DELETED",
		OutletID: "all",
		Payload:  map[string]string{"id": id},
	})

	h.writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
	})
}
