package match

import "testing"

func TestCalculateMatchIndex(t *testing.T) {
	tests := []struct {
		name    string
		student string
		vacancy string
		want    int32
	}{
		// Exact and partial skill overlap.
		{"exact full overlap", "go,docker", "go,docker", 100},
		{"half overlap", "go", "go,rust", 50},
		{"one of three", "go", "go,rust,python", 33},
		{"no overlap", "python", "go,rust", 0},

		// Substring matching (either direction counts as a match).
		{"student skill contains vacancy skill", "javascript", "java", 100},
		{"vacancy skill contains student skill", "java", "javascript", 100},

		// Normalisation: case-insensitive and whitespace-trimmed.
		{"case insensitive", "GO,Docker", "go,DOCKER", 100},
		{"whitespace trimmed", "  go , docker ", "go,docker", 100},

		// Neutral / fallback scores (the actual behaviour — NOT 0).
		{"empty vacancy skills -> neutral 50", "go", "", 50},
		{"whitespace-only vacancy -> neutral 50", "go", "   ", 50},
		{"vacancy only separators -> neutral 50", "go", ",,", 50},
		{"empty student but vacancy present -> low 10", "", "go,docker", 10},
		{"both empty -> neutral 50 (vacancy wins first)", "", "", 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CalculateMatchIndex(tt.student, tt.vacancy); got != tt.want {
				t.Errorf("CalculateMatchIndex(%q, %q) = %d, want %d", tt.student, tt.vacancy, got, tt.want)
			}
		})
	}
}

// Guards against a divide-by-zero panic when the vacancy has no parsable skills.
func TestCalculateMatchIndex_NoPanicOnEmptyVacancy(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("unexpected panic: %v", r)
		}
	}()
	_ = CalculateMatchIndex("", "")
	_ = CalculateMatchIndex("go", ", , ,")
}
