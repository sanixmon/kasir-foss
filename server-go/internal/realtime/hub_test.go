package realtime

import (
	"testing"
	"time"
)

func TestHubMultiOutletBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	c1 := hub.Register("outlet-1")
	c2 := hub.Register("outlet-2")
	cAll := hub.Register("all")

	// Allow registration channels to process
	time.Sleep(10 * time.Millisecond)

	event := Event{
		Type:     "SESSION_ADDED",
		OutletID: "outlet-1",
		Payload:  map[string]string{"id": "s-123"},
	}

	hub.Broadcast(event)

	select {
	case msg := <-c1.Send:
		if msg.Type != "SESSION_ADDED" || msg.OutletID != "outlet-1" {
			t.Errorf("c1 received unexpected event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("c1 timeout waiting for event")
	}

	select {
	case msg := <-cAll.Send:
		if msg.Type != "SESSION_ADDED" || msg.OutletID != "outlet-1" {
			t.Errorf("cAll received unexpected event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("cAll timeout waiting for event")
	}

	select {
	case msg := <-c2.Send:
		t.Fatalf("c2 should NOT receive outlet-1 event, got: %+v", msg)
	case <-time.After(50 * time.Millisecond):
		// success: c2 received nothing
	}
}

func TestHubBroadcastAllOutlet(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	c1 := hub.Register("outlet-1")
	c2 := hub.Register("outlet-2")

	time.Sleep(10 * time.Millisecond)

	event := Event{
		Type:     "GLOBAL_ANNOUNCEMENT",
		OutletID: "all",
		Payload:  "maintenance in 5 mins",
	}

	hub.Broadcast(event)

	select {
	case msg := <-c1.Send:
		if msg.Type != "GLOBAL_ANNOUNCEMENT" {
			t.Errorf("c1 received wrong event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("c1 timeout waiting for global event")
	}

	select {
	case msg := <-c2.Send:
		if msg.Type != "GLOBAL_ANNOUNCEMENT" {
			t.Errorf("c2 received wrong event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("c2 timeout waiting for global event")
	}
}

func TestHubUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	c1 := hub.Register("outlet-1")
	time.Sleep(10 * time.Millisecond)

	hub.Unregister(c1)
	time.Sleep(10 * time.Millisecond)

	// Channel should be closed upon unregister
	select {
	case _, ok := <-c1.Send:
		if ok {
			t.Errorf("expected channel to be closed, but received value")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timeout waiting for closed channel")
	}
}

func TestHubSlowClientDropped(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Register client with full buffer capacity simulation
	cFast := hub.Register("outlet-1")
	cSlow := hub.Register("outlet-1")
	time.Sleep(10 * time.Millisecond)

	// Fill cSlow buffer (capacity 64)
	for i := 0; i < 64; i++ {
		cSlow.Send <- Event{Type: "DUMMY", OutletID: "outlet-1"}
	}

	// Broadcast an event - cSlow should be dropped/closed because buffer is full, cFast should receive it
	hub.Broadcast(Event{Type: "TEST_EVENT", OutletID: "outlet-1"})

	select {
	case msg := <-cFast.Send:
		if msg.Type != "TEST_EVENT" {
			t.Errorf("cFast received unexpected event: %+v", msg)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("cFast timeout waiting for event")
	}
}
