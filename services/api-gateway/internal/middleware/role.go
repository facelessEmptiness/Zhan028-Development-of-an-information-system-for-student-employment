package middleware

import (
	"github.com/gin-gonic/gin"
)

func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(403, gin.H{"error": "Role not found"})
			c.Abort()
			return
		}
		userRole, ok := role.(string)
		if !ok {
			c.JSON(403, gin.H{"error": "Invalid role type"})
			c.Abort()
			return
		}
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}
		c.JSON(403, gin.H{"error": "Access denied for role: " + userRole})
		c.Abort()
	}
}
