// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
// Package auth implementa autenticación JWT stateless con refresh
// rotativo (ADR-07) y contraseñas bcrypt. Access token de 15 minutos;
// refresh token de 30 días, rotativo y almacenado hasheado para
// permitir revocación (sección 4.3).
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// BcryptCost es el costo de hashing de contraseñas (sección 11).
const BcryptCost = 12

var (
	ErrInvalidToken = errors.New("token inválido")
	ErrExpiredToken = errors.New("token expirado")
)

// Claims son los claims del access token: sub + roles por workspace.
type Claims struct {
	RolesByWorkspace map[string]string `json:"rbw,omitempty"` // workspaceID -> rol
	jwt.RegisteredClaims
}

// Service emite y valida tokens.
type Service struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewService(secret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{secret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL}
}

// HashPassword hashea con bcrypt costo 12.
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), BcryptCost)
	return string(b), err
}

// CheckPassword valida una contraseña contra su hash.
func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// AccessToken emite un access token con TTL de 15 minutos.
func (s *Service) AccessToken(userID string, roles map[string]string) (string, error) {
	return s.sign(Claims{
		RolesByWorkspace: roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTTL)),
		},
	})
}

// RefreshToken emite el claim de rotación (token sin expirar en el JWT:
// la expiración se gestiona en BD para permitir revocación).
func (s *Service) RefreshToken(userID string) (string, error) {
	return s.sign(jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshTTL)),
	})
}

// ParseAccess valida un access token y devuelve los claims.
func (s *Service) ParseAccess(raw string) (*Claims, error) {
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.secret, nil
	})
	if err != nil || !tok.Valid {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	return claims, nil
}

// HashToken hashea un refresh token antes de almacenarlo (revocación sin
// almacenar el token en claro).
func HashToken(raw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(raw), BcryptCost)
	return string(b), err
}

func (s *Service) sign(c jwt.Claims) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}
