package main
import("bytes";"encoding/json";"fmt";"os";"net/url";"strings";"time";"crypto/sha256")
type Evidence struct {
	SourceURL          string `json:"sourceUrl"`
	SnapshotPath       string `json:"snapshotPath"`
	SnapshotSHA256     string `json:"snapshotSHA256"`
	SourceLocator      string `json:"sourceLocator"`
	CheckedAt          string `json:"checkedAt"`
	ActorType          string `json:"actorType"`
	VerificationMethod string `json:"verificationMethod"`
}
func validateEvidence(e Evidence) error {
	u, err := url.Parse(e.SourceURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.User != nil {
		return fmt.Errorf("invalid evidence URL: %q", e.SourceURL)
	}
	if strings.TrimSpace(e.SourceLocator) == "" || strings.TrimSpace(e.VerificationMethod) == "" || (e.ActorType != "human" && e.ActorType != "ai") {
		return fmt.Errorf("missing evidence verification details")
	}
	if _, err := time.Parse("2006-01-02", e.CheckedAt); err != nil {
		return fmt.Errorf("invalid evidence checkedAt: %w", err)
	}
	b, err := os.ReadFile(e.SnapshotPath)
	if err != nil {
		return fmt.Errorf("evidence snapshot: %w", err)
	}
	if hash(b) != e.SnapshotSHA256 {
		return fmt.Errorf("evidence snapshot hash mismatch: %s", e.SnapshotPath)
	}
	return nil
}

func hash(b []byte) string { return fmt.Sprintf("%x",sha256.Sum256(b)) }
func main(){raw,err:=os.ReadFile("data/national/issue5/yokohama-priority.json");if err!=nil{panic(err)};var c struct{ Updates []struct{Evidence json.RawMessage} };if err=json.Unmarshal(raw,&c);err!=nil{panic(err)};for _,u:=range c.Updates{d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;if err=d.Decode(&e);err!=nil{panic(err)};if err=validateEvidence(e);err!=nil{panic(err)}};fmt.Println("PASS: actual Go Evidence strict decode and validateEvidence")}
