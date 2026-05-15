package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
)

// NewServiceProxy creates a reverse proxy for regular JSON/REST requests.
func NewServiceProxy(targetURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		target, err := url.Parse(targetURL)
		if err != nil {
			c.JSON(500, gin.H{"error": "Invalid target URL"})
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
		}
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			c.JSON(502, gin.H{"error": "Service unavailable"})
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// NewStreamingProxy creates a reverse proxy that flushes each chunk immediately.
// Required for SSE (text/event-stream) endpoints.
func NewStreamingProxy(targetURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		target, err := url.Parse(targetURL)
		if err != nil {
			c.JSON(500, gin.H{"error": "Invalid target URL"})
			return
		}

		proxy := &httputil.ReverseProxy{
			FlushInterval: -1, // flush every write immediately
			Director: func(req *http.Request) {
				req.URL.Scheme = target.Scheme
				req.URL.Host = target.Host
				req.Host = target.Host
			},
			ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
				c.JSON(502, gin.H{"error": "Service unavailable"})
			},
			// Generous timeout for long-lived SSE connections
			Transport: &http.Transport{
				ResponseHeaderTimeout: 10 * time.Second,
			},
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
