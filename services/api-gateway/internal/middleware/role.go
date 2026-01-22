package middleware

import (
	"github.com/gin-gonic/gin"
)

func RoleMiddleware(allowedRoles string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(403, gin.H{"error": "Role not found: "})
			c.Abort()
			return
		}
		if role.(string) != allowedRoles {
			c.JSON(403, gin.H{"error": "Access denied for role: " + role.(string)})
			c.Abort()
			return
		}
		c.Next()

	}

}
