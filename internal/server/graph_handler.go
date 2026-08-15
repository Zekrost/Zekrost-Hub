package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// GraphNode y GraphEdge alimentan la vista de grafo: los backlinks
// [[titulo]] se resuelven a docs del mismo workspace.
type GraphNode struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type GraphEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// handleGraph devuelve nodos (documentos) y aristas (backlinks
// resueltos por título) del workspace activo.
func (s *Server) handleGraph(c *gin.Context) {
	userID := c.GetString("user_id")
	ws, ok := s.workspaceOf(c, userID)
	if !ok {
		return
	}

	docs, err := s.queries.ListDocsForGraph(c, ws.id)
	if err != nil {
		s.fail(c, http.StatusInternalServerError, "internal", "error de base de datos")
		return
	}
	nodes := make([]GraphNode, 0, len(docs))
	byTitle := make(map[string]string, len(docs))
	for _, d := range docs {
		nodes = append(nodes, GraphNode{ID: d.ID, Title: d.Title})
		byTitle[strings.ToLower(d.Title)] = d.ID
	}

	links, err := s.queries.ListBacklinksForGraph(c, ws.id)
	if err != nil {
		s.fail(c, http.StatusInternalServerError, "internal", "error de base de datos")
		return
	}
	seen := map[[2]string]bool{}
	edges := make([]GraphEdge, 0, len(links))
	for _, l := range links {
		target, ok := byTitle[strings.ToLower(l.DstDocID)]
		if !ok || target == l.SrcDocID {
			continue // backlink a doc inexistente o a sí mismo
		}
		key := [2]string{l.SrcDocID, target}
		if seen[key] {
			continue
		}
		seen[key] = true
		edges = append(edges, GraphEdge{From: l.SrcDocID, To: target})
	}

	if nodes == nil {
		nodes = []GraphNode{}
	}
	if edges == nil {
		edges = []GraphEdge{}
	}
	c.JSON(http.StatusOK, gin.H{"nodes": nodes, "edges": edges})
}
