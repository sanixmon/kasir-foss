# Stage 1: Build binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git and certificates if needed
RUN apk --no-cache add ca-certificates git

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary with stripped symbols
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/server ./cmd/api

# Stage 2: Production runner
FROM alpine:3.20

WORKDIR /app

# Add ca-certificates and tzdata
RUN apk --no-cache add ca-certificates tzdata

# Copy binary from builder stage
COPY --from=builder /app/bin/server /app/server

# Expose port
EXPOSE 8080

# Run server
ENTRYPOINT ["/app/server"]
