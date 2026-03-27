package match

import (
	"strings"
)

// CalculateMatchIndex returns a 0-100 score based on skill overlap.
// studentSkills and vacancySkills are comma-separated strings.
func CalculateMatchIndex(studentSkills, vacancySkills string) int32 {
	if strings.TrimSpace(vacancySkills) == "" {
		return 50 // vacancy has no requirements → neutral score
	}

	vacancy := parseSkills(vacancySkills)
	if len(vacancy) == 0 {
		return 50
	}

	student := parseSkills(studentSkills)
	if len(student) == 0 {
		return 10 // student has no skills but vacancy has requirements → low score
	}

	matched := 0
	for _, vs := range vacancy {
		for _, ss := range student {
			if strings.Contains(ss, vs) || strings.Contains(vs, ss) {
				matched++
				break
			}
		}
	}

	score := int32(float64(matched) / float64(len(vacancy)) * 100)
	return score
}

func parseSkills(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
