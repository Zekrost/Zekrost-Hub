# Copyright (C) 2026 Zekrost <tech@zekrost.com>
# SPDX-License-Identifier: AGPL-3.0-only
# Zekrost Hub — Makefile
# Pipeline local: frontend -> embed -> binario único (P3).

SHELL := /bin/bash
GO      := go
GOFLAGS ?=
VERSION ?= dev
BIN     := bin/hub
LDFLAGS := -s -w -X github.com/zekrost/hub/internal/server.Version=$(VERSION)

.PHONY: all dev build frontend generate db test vet lint run docker clean

all: build

## frontend: instala deps y compila el frontend Nix.js
frontend:
	cd web && npm install
	cd web && npm run build
	rm -rf internal/web/dist && cp -r web/dist internal/web/dist

## generate: regenera el código sqlc
generate:
	sqlc generate

## build: binario único con frontend embebido
build: frontend
	mkdir -p bin
	CGO_ENABLED=0 $(GO) build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(BIN) ./cmd/hub

## dev: backend en modo desarrollo (frontend servido por Vite en :5173)
dev:
	HUB_JWT_SECRET=dev-secret HUB_DB_PATH=data/hub.db $(GO) run ./cmd/hub

## test: tests unitarios e integración
test:
	$(GO) test ./...

## vet: análisis estático
vet:
	$(GO) vet ./...
	cd web && npx tsc --noEmit

## docker: imagen multi-stage con binario final
docker:
	docker build -t zekrost/hub:$(VERSION) .

## run: ejecuta el binario local
run: build
	HUB_JWT_SECRET=dev-secret HUB_DB_PATH=data/hub.db ./$(BIN)

clean:
	rm -rf bin dist web/dist internal/web/dist data
